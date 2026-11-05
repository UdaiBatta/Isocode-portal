import hashlib
import hmac
import json
import os
from uuid import UUID

from django.core.signing import BadSignature
from django.http import JsonResponse

from fees.auth import api, error, has_parent_consent
from fees.clock import today
from fees.domain.pay_token import unsign_pay_token
from fees.forms import PaymentResultQueryForm, PaymentWebhookForm, PayTokenQueryForm
from fees.models import Guardian, GuardianStudent, InstalmentBalance, PaymentEvent, Receipt, StaffUser
from fees.services.payments import process_payment_event


def _token_id(token):
    try:
        return UUID(unsign_pay_token(token))
    except (BadSignature, ValueError, TypeError, AttributeError):
        return None


@api(role="public", form=PayTokenQueryForm, methods=("GET",))
def pay_details(request):
    instalment_id = _token_id(request.data["token"])
    row = InstalmentBalance.objects.select_related("student").filter(
        pk=instalment_id, student__archived_at__isnull=True, student__status="active",
    ).first() if instalment_id else None
    if not row:
        return JsonResponse({"ok": True, "valid": False})
    token = request.data["token"]
    return JsonResponse({
        "ok": True, "valid": True, "reference": str(row.pk), "firstName": row.student.full_name.split()[0],
        "seq": row.seq, "amount": row.balance_paise, "dueDate": row.due_date.isoformat(),
        "today": today().isoformat(), "paid": row.balance_paise == 0,
        "payUrl": f"/mock-gateway/{token}" if row.balance_paise else None,
    })


def _receipt_access(request, student):
    try:
        subject_id = UUID(request.session.get("subject_id", ""))
    except (ValueError, TypeError, AttributeError):
        return False, False
    if request.session.get("subject_type") == "guardian":
        guardian = Guardian.objects.filter(pk=subject_id).first()
        allowed = bool(guardian and not request.session.get("consent_declined", False)
                       and has_parent_consent(guardian) and GuardianStudent.objects.filter(
            guardian=guardian, student=student,
        ).exists())
        return allowed, allowed
    if request.session.get("subject_type") == "staff":
        staff = StaffUser.objects.filter(pk=subject_id, role="accounts", archived_at__isnull=True).first()
        allowed = bool(staff and (staff.centre_id is None or staff.centre_id == student.batch.centre_id))
        return False, allowed
    return False, False


@api(role="public", form=PaymentResultQueryForm, methods=("GET",))
def payment_result(request):
    instalment_id = _token_id(request.data["token"])
    if not instalment_id:
        return JsonResponse({"ok": True, "found": False})
    event = PaymentEvent.objects.select_related("payment").filter(event_id=request.data["eventId"]).first()
    if not event or event.payload.get("reference") != str(instalment_id):
        return JsonResponse({"ok": True, "found": False})
    row = InstalmentBalance.objects.select_related("student__batch__centre").filter(pk=instalment_id).first()
    if not row:
        return JsonResponse({"ok": True, "found": False})
    receipt = Receipt.objects.filter(payment_id=event.payment_id).first() if event.payment_id else None
    parent_can_access, can_view_receipt = _receipt_access(request, row.student)
    return JsonResponse({
        "ok": True, "found": True,
        "result": {"allocated": "paid", "queued": "checking", "failed": "failed", "pending": "checking"}[event.result],
        "receiptId": str(receipt.pk) if receipt else None,
        "firstName": row.student.full_name.split()[0], "studentCode": row.student.code, "seq": row.seq,
        "amount": event.payment.amount_paise if event.payment_id else event.payload["amount_paise"],
        "method": event.payment.method if event.payment_id else event.payload.get("method"),
        "on": event.payload["paid_on"], "reference": f"TXN-{event.event_id.replace('-', '')[:12].upper()}",
        "receiptNumber": receipt.number if receipt else None,
        "parentCanAccess": parent_can_access, "canViewReceipt": can_view_receipt,
    })


def webhook(request):
    if request.method != "POST":
        response = error("method_not_allowed", "Method not allowed.", 405)
        response["Allow"] = "POST"
        return response
    secret = os.getenv("PAYMENT_WEBHOOK_SECRET", "")
    signature = request.headers.get("X-Signature", "")
    expected = hmac.new(secret.encode(), request.body, hashlib.sha256).hexdigest() if secret else ""
    if not secret or len(signature) != 64 or not hmac.compare_digest(signature.encode("utf-8"), expected.encode("ascii")):
        return error("signature", "Payment signature is invalid.", 401)
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return error("invalid", "A JSON object is required.")
    if not isinstance(data, dict):
        return error("invalid", "A JSON object is required.")
    form = PaymentWebhookForm(data)
    if not form.is_valid():
        return error("invalid", "Check the payment event values.")
    event = process_payment_event(**form.cleaned_data)
    return JsonResponse({"ok": True, "eventId": event.event_id, "result": event.result})
