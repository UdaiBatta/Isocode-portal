from uuid import UUID

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone

from fees.auth import api, error, has_parent_consent
from fees.forms import GrantConsentForm
from fees.models import Consent, Guardian, GuardianStudent, OtpChallenge


@api(role="parent", form=GrantConsentForm, consent=False)
@transaction.atomic
def grant_consent(request):
    guardian = Guardian.objects.select_for_update().get(pk=request.subject.pk)
    try:
        otp_id = UUID(request.session.get("otp_challenge_id", ""))
    except (ValueError, TypeError, AttributeError):
        return error("otp_required", "Sign in again to verify your phone.", 401)
    challenge = OtpChallenge.objects.filter(pk=otp_id, phone=guardian.phone, consumed_at__isnull=False).first()
    if not challenge:
        return error("otp_required", "Sign in again to verify your phone.", 401)
    selected = request.data["studentIds"]
    children = list(GuardianStudent.objects.filter(guardian=guardian, student__archived_at__isnull=True,
                                                    student__code__in=selected).values_list("student_id", flat=True))
    if len(children) != len(selected):
        return error("forbidden", "Consent can cover only your linked children.", 403)
    now = timezone.now()
    for student_id in children:
        Consent.objects.get_or_create(guardian=guardian, student_id=student_id, withdrawn_at=None, defaults={
            "wording_version": request.data["wordingVersion"], "language": request.data["language"],
            "otp_challenge": challenge, "granted_at": now,
        })
    guardian.language = request.data["language"]
    guardian.save(update_fields=["language"])
    request.session["consent_declined"] = False
    return JsonResponse({"ok": True, "next": "/dashboard" if has_parent_consent(guardian) else "/consent"})


@api(role="parent", consent=False)
def decline_consent(request):
    request.session["consent_declined"] = True
    return JsonResponse({"ok": True})
