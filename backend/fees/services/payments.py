from datetime import date
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from fees.clock import today
from fees.domain.dates import financial_year
from fees.domain.ledger import allocate_oldest_first
from fees.domain.matching import decide_payment
from fees.domain.money import gst_split
from fees.models import (Allocation, AuditLog, Instalment, InstalmentBalance, Payment, PaymentEvent,
                         Receipt, ReceiptCounter, Student, UnmatchedPayment)


class CounterPaymentError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


class UnmatchedPaymentError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


@transaction.atomic
def allocate_and_issue_receipt(*, student, allocations, method, received_on, event_id=None, note=None, recorded_by=None):
    amount = sum(value for _, value in allocations)
    if amount <= 0 or not allocations:
        raise ValueError("An allocation must contain a positive amount.")
    if any(value <= 0 for _, value in allocations):
        raise ValueError("Allocation amounts must be positive.")

    payment = Payment.objects.create(
        student=student, amount_paise=amount, method=method, event_id=event_id,
        received_on=received_on, note=note, recorded_by=recorded_by,
    )
    Allocation.objects.bulk_create([
        Allocation(payment=payment, instalment=instalment, amount_paise=value)
        for instalment, value in allocations
    ])

    centre = student.batch.centre
    fy = financial_year(received_on)
    counter, _ = ReceiptCounter.objects.get_or_create(centre=centre, fy=fy, defaults={"next_seq": 1})
    counter = ReceiptCounter.objects.select_for_update().get(pk=counter.pk)
    sequence = counter.next_seq
    counter.next_seq += 1
    counter.save(update_fields=["next_seq"])

    plan = student.feeplan
    gst = gst_split(amount, plan.gst_rate_bps)
    receipt = Receipt.objects.create(
        payment=payment, number=f"{centre.code}/{fy}/{sequence:06d}", issued_on=received_on,
        taxable_paise=gst.taxable, cgst_paise=gst.cgst, sgst_paise=gst.sgst, total_paise=amount,
    )
    AuditLog.objects.create(
        actor_type="staff" if recorded_by else "gateway", actor_id=recorded_by.pk if recorded_by else None,
        action="payment_allocated", entity="payment", entity_id=payment.pk,
        after={"amount_paise": amount, "method": method,
               "allocations": [{"instalment_id": str(item.pk), "amount_paise": value} for item, value in allocations],
               "receipt_number": receipt.number},
    )
    return payment, receipt


@transaction.atomic
def process_payment_event(*, event_id, reference, amount_paise, status, paid_on, method="gateway"):
    if not event_id or len(event_id) > 200 or not isinstance(amount_paise, int) or isinstance(amount_paise, bool) or amount_paise <= 0:
        raise ValueError("Payment event identity and amount must be valid.")
    if not isinstance(paid_on, date):
        raise ValueError("Payment date must be a date.")
    if method not in {"gateway", "cash", "cheque", "bank", "upi", "card", "netbanking"}:
        raise ValueError("Payment method is invalid.")

    payload = {"event_id": event_id, "reference": reference, "amount_paise": amount_paise,
               "status": status, "paid_on": paid_on.isoformat(), "method": method}
    event, created = PaymentEvent.objects.get_or_create(
        event_id=event_id, defaults={"payload": payload, "result": "pending", "received_at": timezone.now()},
    )
    if not created:
        return event

    if status != "success":
        decision = decide_payment(status, False, False, 0, amount_paise)
        event.result = decision["result"]
        event.save(update_fields=["result"])
        return event

    instalment = None
    balance = None
    if reference:
        try:
            reference_id = UUID(reference)
        except (ValueError, TypeError, AttributeError):
            reference_id = None
        if reference_id:
            instalment = Instalment.objects.select_for_update(of=("self",)).select_related(
                "plan__student__batch__centre", "plan",
            ).filter(pk=reference_id).first()
            if instalment:
                balance = InstalmentBalance.objects.filter(pk=instalment.pk).first()

    found = instalment is not None and balance is not None
    decision = decide_payment(
        status, found, bool(found and instalment.plan.student.status == "active"),
        balance.balance_paise if found else 0, amount_paise,
    )
    if decision["action"] == "queue":
        unmatched = UnmatchedPayment.objects.create(
            event_id=event_id, reference=reference, amount_paise=amount_paise,
            reason=decision["reason"], suggested_instalment=instalment if found else None,
            received_on=paid_on,
        )
        event.result = "queued"
        event.unmatched = unmatched
    else:
        payment, _ = allocate_and_issue_receipt(
            student=instalment.plan.student, allocations=[(instalment, amount_paise)],
            method=method, received_on=paid_on, event_id=event_id,
        )
        event.result = "allocated"
        event.payment = payment
    event.save(update_fields=["result", "unmatched", "payment"])
    return event


@transaction.atomic
def record_counter_payment(*, student_code, amount_paise, method, received_on, note, recorded_by):
    if not isinstance(amount_paise, int) or isinstance(amount_paise, bool) or amount_paise <= 0:
        raise ValueError("Payment amount must be a positive whole number of paise.")
    if method not in {"cash", "cheque", "bank"}:
        raise ValueError("Counter payment method is invalid.")
    if not isinstance(received_on, date):
        raise ValueError("Payment date must be a date.")
    if len(note or "") > 300:
        raise ValueError("Payment note is too long.")

    student = Student.objects.select_for_update(of=("self",)).select_related("batch__centre").filter(
        code=student_code, archived_at__isnull=True,
    ).first()
    if not student:
        raise CounterPaymentError("not_found", "Student not found.")
    if student.status != "active":
        raise CounterPaymentError("withdrawn", "This student has withdrawn.")
    if received_on > today():
        raise CounterPaymentError("invalid_date", "A payment cannot be recorded in the future.")

    instalments = list(Instalment.objects.select_for_update(of=("self",)).filter(
        plan__student=student,
    ).order_by("due_date", "seq"))
    balances = dict(InstalmentBalance.objects.filter(
        pk__in=[row.pk for row in instalments],
    ).values_list("pk", "balance_paise"))
    unpaid = [(row, balances.get(row.pk, 0)) for row in instalments if balances.get(row.pk, 0) > 0]
    amounts, excess = allocate_oldest_first(amount_paise, [balance for _, balance in unpaid])
    allocations = [(row, amount) for (row, _), amount in zip(unpaid, amounts) if amount]

    payment = receipt = None
    if allocations:
        payment, receipt = allocate_and_issue_receipt(
            student=student, allocations=allocations, method=method, received_on=received_on,
            note=note or None, recorded_by=recorded_by,
        )
    if excess:
        queued = UnmatchedPayment.objects.create(
            amount_paise=excess, reason="excess_counter_payment",
            suggested_instalment=instalments[0] if instalments else None, received_on=received_on,
        )
        AuditLog.objects.create(
            actor_type="staff", actor_id=recorded_by.pk, action="counter_payment_excess_queued",
            entity="unmatched_payment", entity_id=queued.pk,
            after={"student_code": student.code, "amount_paise": excess},
        )
    return payment, receipt, excess


@transaction.atomic
def resolve_unmatched_payment(*, unmatched_id, action, instalment_id=None, note="", resolved_by):
    item = UnmatchedPayment.objects.select_for_update(of=("self",)).select_related(
        "suggested_instalment__plan__student__batch",
    ).filter(pk=unmatched_id).first()
    if not item:
        raise UnmatchedPaymentError("not_found", "Payment review not found.")
    if item.status != "open":
        raise UnmatchedPaymentError("resolved", "This payment was already resolved.")
    if item.amount_paise <= 0:
        raise UnmatchedPaymentError("invalid", "This payment amount cannot be resolved.")
    if action not in {"match", "reject"}:
        raise UnmatchedPaymentError("invalid", "Choose match or reject.")
    if action == "reject" and not note.strip():
        raise UnmatchedPaymentError("note_required", "A rejection reason is required.")
    if resolved_by.centre_id and item.suggested_instalment_id and \
            item.suggested_instalment.plan.student.batch.centre_id != resolved_by.centre_id:
        raise UnmatchedPaymentError("forbidden", "This payment is outside your centre.")

    event = PaymentEvent.objects.select_for_update().filter(event_id=item.event_id).first() if item.event_id else None
    now = timezone.now()
    payment = receipt = None
    if action == "match":
        if not instalment_id:
            raise UnmatchedPaymentError("invalid", "Choose a student and instalment.")
        selected = Instalment.objects.select_related("plan__student").filter(pk=instalment_id).first()
        if not selected:
            raise UnmatchedPaymentError("instalment_not_found", "Choose an unpaid instalment.")
        student = Student.objects.select_for_update(of=("self",)).select_related("batch__centre").filter(
            pk=selected.plan.student_id, archived_at__isnull=True,
        ).first()
        if not student:
            raise UnmatchedPaymentError("instalment_not_found", "Choose an unpaid instalment.")
        if resolved_by.centre_id and student.batch.centre_id != resolved_by.centre_id:
            raise UnmatchedPaymentError("forbidden", "This student is outside your centre.")
        if student.status != "active":
            raise UnmatchedPaymentError("withdrawn", "A payment cannot be allocated to a withdrawn student.")

        instalments = list(Instalment.objects.select_for_update(of=("self",)).filter(
            plan__student=student,
        ).select_related("plan").order_by("due_date", "seq"))
        start = next((index for index, row in enumerate(instalments) if row.pk == selected.pk), None)
        if start is None:
            raise UnmatchedPaymentError("instalment_not_found", "Choose an unpaid instalment.")
        balances = dict(InstalmentBalance.objects.filter(
            pk__in=[row.pk for row in instalments[start:]],
        ).values_list("pk", "balance_paise"))
        open_balances = [balances.get(row.pk, 0) for row in instalments[start:]]
        if open_balances[0] <= 0:
            raise UnmatchedPaymentError("already_paid", "Choose an unpaid instalment.")
        amounts, excess = allocate_oldest_first(item.amount_paise, open_balances)
        if excess:
            raise UnmatchedPaymentError("excess", "The payment exceeds the remaining balance.")
        allocations = [(row, amount) for row, amount in zip(instalments[start:], amounts) if amount]
        method = event.payload.get("method", "bank") if event and isinstance(event.payload, dict) else "bank"
        if method not in {"gateway", "cash", "cheque", "bank", "upi", "card", "netbanking"}:
            method = "bank"
        payment, receipt = allocate_and_issue_receipt(
            student=student, allocations=allocations, method=method, received_on=item.received_on,
            event_id=item.event_id, note=note.strip() or None, recorded_by=resolved_by,
        )
        item.payment = payment
        item.status = "matched"
        item.resolved_by = resolved_by
        item.resolved_at = now
        item.resolution_note = note.strip() or None
        if event:
            event.result = "allocated"
            event.payment = payment
            event.save(update_fields=["result", "payment"])
    else:
        item.status = "rejected"
        item.resolved_by = resolved_by
        item.resolved_at = now
        item.resolution_note = note.strip()

    item.save(update_fields=["payment", "status", "resolved_by", "resolved_at", "resolution_note"])
    AuditLog.objects.create(
        actor_type="staff", actor_id=resolved_by.pk,
        action=f"unmatched_payment_{item.status}", entity="unmatched_payment", entity_id=item.pk,
        after={"amount_paise": item.amount_paise, "note": item.resolution_note,
               "payment_id": str(payment.pk) if payment else None},
    )
    return {"paymentId": str(payment.pk) if payment else None,
            "receiptId": str(receipt.pk) if receipt else None,
            "receiptNumber": receipt.number if receipt else None}
