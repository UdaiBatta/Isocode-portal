from django.http import JsonResponse

from fees.auth import api, error
from fees.forms import ReceiptListQueryForm, ReceiptQueryForm
from fees.models import Consent, GuardianStudent, Receipt, UnmatchedPayment


@api(role="parent", form=ReceiptListQueryForm, methods=("GET",))
def receipts(request):
    linked = GuardianStudent.objects.filter(
        guardian=request.subject, student__archived_at__isnull=True,
    ).select_related("student").order_by("student__code")
    requested = request.data["student"]
    selected = next((link for link in linked if link.student.code == requested), None) if requested else None
    if requested and selected is None:
        return error("forbidden", "Student not found in your family.", 403)
    selected = selected or next(iter(linked), None)
    if selected is None:
        return error("forbidden", "Student not found in your family.", 403)
    student = selected.student

    rows = list(Receipt.objects.select_related("payment").filter(
        payment__student=student,
    ).order_by("-issued_on", "-number"))
    receipt_rows = [{
        "id": str(row.pk), "number": row.number, "issuedOn": row.issued_on.isoformat(),
        "amount": row.total_paise,
    } for row in rows]
    invoices = [{
        "id": str(row.pk), "number": row.number, "issuedOn": row.issued_on.isoformat(),
        "amount": row.total_paise, "method": row.payment.method, "status": "paid",
        "href": f"/receipts/{row.pk}",
    } for row in rows]
    invoices.extend({
        "id": str(row.pk), "number": row.reference or "—", "issuedOn": row.received_on.isoformat(),
        "amount": row.amount_paise, "method": None, "status": "pending", "href": None,
    } for row in UnmatchedPayment.objects.filter(
        status="open", suggested_instalment__plan__student=student,
    ).order_by("-received_on", "-created_at"))
    invoices.sort(key=lambda row: (row["issuedOn"], row["number"]), reverse=True)
    return JsonResponse({"ok": True, "selectedStudentId": student.code, "receipts": receipt_rows, "invoices": invoices})


@api(role="any", form=ReceiptQueryForm, methods=("GET",), consent=False)
def receipt(request):
    row = Receipt.objects.select_related(
        "payment__student__batch__centre",
    ).filter(pk=request.data["id"]).first()
    if not row:
        return error("not_found", "Receipt not found.", 404)

    student = row.payment.student
    if request.role == "parent":
        allowed = not request.session.get("consent_declined", False) and GuardianStudent.objects.filter(
            guardian=request.subject, student=student,
        ).exists() and Consent.objects.filter(
            guardian=request.subject, student=student, withdrawn_at__isnull=True,
        ).exists()
    elif request.role == "accounts":
        allowed = request.subject.centre_id is None or request.subject.centre_id == student.batch.centre_id
    else:
        allowed = False
    if not allowed:
        return error("not_found", "Receipt not found.", 404)

    return JsonResponse({"ok": True, "receipt": {
        "id": str(row.pk), "number": row.number, "issuedOn": row.issued_on.isoformat(),
        "amount": row.total_paise, "taxable": row.taxable_paise,
        "cgst": row.cgst_paise, "sgst": row.sgst_paise,
        "student": {
            "code": student.code, "name": student.full_name,
            "batch": student.batch.name, "centre": student.batch.centre.name,
        },
        "method": row.payment.method,
    }})
