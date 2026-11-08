from django.http import JsonResponse

from fees.auth import api, error
from fees.clock import today
from fees.forms import RefundActionForm, RefundDraftForm, RefundQueryForm
from fees.models import RefundPolicy
from fees.services.refunds import RefundError, approve_refund, get_refund, mark_refund_paid, save_refund_draft


@api(role="accounts", form=RefundQueryForm, methods=("GET",))
def refund(request):
    try:
        view = get_refund(student_code=request.data["student"], actor=request.subject,
                          withdrawal_date=request.data["withdrawalDate"])
    except RefundError as exc:
        return error(exc.code, str(exc), exc.status)
    return JsonResponse({"ok": True, **view})


@api(role="accounts", form=RefundDraftForm)
def save_draft(request):
    try:
        row = save_refund_draft(student_code=request.data["studentId"], withdrawal_date=request.data["withdrawalDate"],
                                reason=request.data["reason"], actor=request.subject)
    except RefundError as exc:
        return error(exc.code, str(exc), exc.status)
    return JsonResponse({"ok": True, "refundId": row.student.code})


@api(role="accounts", form=RefundActionForm)
def approve(request):
    try:
        row = approve_refund(student_code=request.data["refundId"], actor=request.subject)
    except RefundError as exc:
        return error(exc.code, str(exc), exc.status)
    return JsonResponse({"ok": True, "refundId": row.student.code})


@api(role="accounts", form=RefundActionForm)
def mark_paid(request):
    try:
        row = mark_refund_paid(student_code=request.data["refundId"], actor=request.subject)
    except RefundError as exc:
        return error(exc.code, str(exc), exc.status)
    return JsonResponse({"ok": True, "refundId": row.student.code, "paidOn": row.paid_on.isoformat()})


@api(role="public", methods=("GET",))
def policy(request):
    row = RefundPolicy.objects.filter(effective_from__lte=today()).order_by("-effective_from", "-created_at", "-pk").first()
    if not row:
        return error("not_found", "Refund policy not found.", 404)
    return JsonResponse({"ok": True, "version": row.version, "deadlineDays": row.deadline_days,
                         "textEn": row.text_en, "textHi": row.text_hi})
