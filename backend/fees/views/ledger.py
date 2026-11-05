from django.http import JsonResponse

from fees.auth import api, error
from fees.clock import today
from fees.domain.dates import add_days
from fees.domain.ledger import instalment_view
from fees.domain.reminders import next_scheduled_step
from fees.forms import LedgerQueryForm
from fees.domain.pay_token import sign_pay_token
from fees.models import (Allocation, FeePlan, GuardianStudent, InstalmentBalance, Payment, Receipt, Refund,
                         ReminderLog, Student, UnmatchedPayment)


@api(role="accounts", form=LedgerQueryForm, methods=("GET",))
def ledger(request):
    student = Student.objects.select_related("batch__centre").filter(
        code=request.data["student"], archived_at__isnull=True,
    ).first()
    if not student:
        return error("not_found", "Student not found.", 404)
    if request.subject.centre_id and student.batch.centre_id != request.subject.centre_id:
        return error("forbidden", "Student is outside your centre.", 403)

    rows = list(InstalmentBalance.objects.filter(student=student).order_by("due_date", "seq"))
    date = today()
    instalments = []
    for row in rows:
        view = instalment_view(row.amount_paise, row.paid_paise, row.due_date, date)
        instalments.append({
            "id": str(row.pk), "seq": row.seq, "dueDate": row.due_date.isoformat(),
            "amount": row.amount_paise, "paid": row.paid_paise, "balance": view.balance,
            "status": view.status, "partPaid": view.part_paid,
            "daysOverdue": view.days_overdue, "dueInDays": view.due_in_days,
            "payUrl": f"/pay/{sign_pay_token(row.pk)}" if view.balance and student.status == "active" else None,
        })

    plan = FeePlan.objects.get(student=student)
    paid = sum(row.paid_paise for row in rows)
    balance = sum(row.balance_paise for row in rows)
    receipt_ids = dict(Receipt.objects.filter(payment__student=student).values_list("payment_id", "id"))
    payments = [{
        "id": str(payment.pk), "on": payment.received_on.isoformat(), "method": payment.method,
        "amount": payment.amount_paise,
        "receiptId": str(receipt_ids[payment.pk]) if payment.pk in receipt_ids else None,
    } for payment in Payment.objects.filter(student=student).order_by("-received_on", "-created_at")]
    guardian = GuardianStudent.objects.filter(student=student).select_related("guardian").order_by(
        "-is_primary", "guardian__created_at",
    ).first()
    refund = Refund.objects.filter(student=student).first()
    ids = [row.pk for row in rows]
    reminders = {}
    sent_steps = {}
    for item in ReminderLog.objects.filter(instalment_id__in=ids).order_by("sent_on", "step").values(
        "instalment_id", "step", "sent_on", "language",
    ):
        reminders.setdefault(item["instalment_id"], []).append({
            "step": item["step"], "on": item["sent_on"].isoformat(), "language": item["language"],
        })
        sent_steps.setdefault(item["instalment_id"], []).append(item["step"])
    open_reviews = set(UnmatchedPayment.objects.filter(
        status="open", suggested_instalment_id__in=ids,
    ).values_list("suggested_instalment_id", flat=True))
    paid_by_instalment = {}
    allocated_by_instalment = {}
    amounts = {row.pk: row.amount_paise for row in rows}
    for allocation in Allocation.objects.filter(instalment_id__in=ids).select_related("payment").order_by(
        "payment__received_on", "payment__created_at",
    ):
        instalment_id = allocation.instalment_id
        allocated_by_instalment[instalment_id] = allocated_by_instalment.get(instalment_id, 0) + allocation.amount_paise
        if allocated_by_instalment[instalment_id] >= amounts[instalment_id]:
            paid_by_instalment.setdefault(instalment_id, allocation.payment.received_on)
    timeline = []
    for row in rows:
        history = sent_steps.get(row.pk, [])
        stopped = None
        next_reminder = None
        if row.balance_paise == 0:
            paid_on = paid_by_instalment.get(row.pk)
            stopped = f"paid {paid_on.day} {paid_on.strftime('%b')}" if paid_on else "paid"
        elif student.status == "withdrawn":
            stopped = "withdrawn"
        elif row.pk in open_reviews:
            stopped = "payment being checked"
        else:
            step = next_scheduled_step(row.due_date, date, history)
            if step is not None:
                next_reminder = {"step": step, "on": add_days(row.due_date, step).isoformat()}
        timeline.append({
            "instalmentId": str(row.pk), "sent": reminders.get(row.pk, []),
            "next": next_reminder, "stopped": stopped,
        })

    return JsonResponse({
        "ok": True,
        "student": {
            "id": str(student.pk), "code": student.code, "name": student.full_name,
            "batch": student.batch.name, "centre": student.batch.centre.name, "status": student.status,
        },
        "plan": {
            "gross": plan.gross_paise, "discount": plan.discount_paise,
            "discountReason": plan.discount_reason, "net": plan.net_paise,
            "paid": paid, "balance": balance,
        },
        "instalments": instalments, "payments": payments, "timeline": timeline,
        "refund": {"id": str(refund.pk), "status": refund.status} if refund else None,
        "guardianPhone": guardian.guardian.phone if guardian else "",
    })
