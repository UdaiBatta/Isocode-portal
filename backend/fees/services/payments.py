from datetime import date
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from fees.domain.dates import financial_year
from fees.domain.matching import decide_payment
from fees.domain.money import gst_split
from fees.models import (Allocation, AuditLog, Instalment, InstalmentBalance, Payment, PaymentEvent,
                         Receipt, ReceiptCounter, UnmatchedPayment)


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
