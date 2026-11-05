from django.http import JsonResponse

from fees.auth import api, error
from fees.clock import today
from fees.domain.ledger import instalment_view
from fees.forms import DuesQueryForm
from fees.domain.pay_token import sign_pay_token
from fees.models import GuardianStudent, InstalmentBalance, Refund, UnmatchedPayment


@api(role="parent", form=DuesQueryForm, methods=("GET",))
def dues(request):
    linked = list(GuardianStudent.objects.filter(
        guardian=request.subject, student__archived_at__isnull=True,
    ).select_related("student").order_by("student__code"))
    requested = request.data["student"]
    selected = next((link.student for link in linked if link.student.code == requested), None) if requested else None
    if requested and selected is None:
        return error("forbidden", "Student not found in your family.", 403)
    selected = selected or (linked[0].student if linked else None)
    if selected is None:
        return error("forbidden", "Student not found in your family.", 403)

    date = today()
    rows = list(InstalmentBalance.objects.filter(student=selected).order_by("due_date", "seq"))
    instalments = []
    for row in rows:
        view = instalment_view(row.amount_paise, row.paid_paise, row.due_date, date)
        instalments.append({
            "id": str(row.pk), "seq": row.seq, "dueDate": row.due_date.isoformat(),
            "amount": row.amount_paise, "paid": row.paid_paise, "balance": view.balance,
            "status": view.status, "partPaid": view.part_paid,
            "daysOverdue": view.days_overdue, "dueInDays": view.due_in_days,
            "payUrl": f"/mock-gateway/{sign_pay_token(row.pk)}" if view.balance and selected.status == "active" else None,
        })

    current = next((row for row in instalments if row["balance"] > 0), None)
    refund_record = Refund.objects.filter(student=selected).first()
    refund = None
    if selected.status == "withdrawn" and refund_record:
        refund = {
            "amount": refund_record.refund_paise, "stillPayable": refund_record.still_payable_paise,
            "status": refund_record.status, "deadline": refund_record.deadline.isoformat(),
        }
    review = current and UnmatchedPayment.objects.filter(
        suggested_instalment_id=current["id"], status="open",
    ).exists()
    mode = "withdrawn" if selected.status == "withdrawn" else "review" if review else (
        "pay" if current and current["dueInDays"] <= 30 else "clear"
    )
    return JsonResponse({
        "ok": True,
        "children": [{"studentId": link.student.code, "fullName": link.student.full_name} for link in linked],
        "selectedStudentId": selected.code, "mode": mode, "current": current,
        "next": {"amount": current["balance"], "dueDate": current["dueDate"]} if current else None,
        "moreUnpaid": max(0, sum(row["balance"] > 0 for row in instalments) - 1),
        "instalments": instalments, "refund": refund,
    })
