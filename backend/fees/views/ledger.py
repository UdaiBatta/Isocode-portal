from django.http import JsonResponse

from fees.auth import api, error
from fees.clock import today
from fees.domain.ledger import instalment_view
from fees.forms import LedgerQueryForm
from fees.models import FeePlan, GuardianStudent, InstalmentBalance, Payment, Receipt, Refund, Student


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
            # LIMIT: unsigned pay URLs become signed links in T2.4.
            "payUrl": f"/pay/{row.pk}" if view.balance and student.status == "active" else None,
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
        "instalments": instalments, "payments": payments, "timeline": [],
        "refund": {"id": str(refund.pk), "status": refund.status} if refund else None,
        "guardianPhone": guardian.guardian.phone if guardian else "",
    })
