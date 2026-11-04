import os
import secrets
from datetime import timedelta
from uuid import UUID

from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from fees.auth import api, error, has_parent_consent, lock_subject
from fees.forms import LanguageForm, PhoneForm, StaffLoginForm, VerifyOtpForm
from fees.models import Guardian, GuardianStudent, LoginAttempt, OtpChallenge, StaffUser

DUMMY_PASSWORD_HASH = make_password("dummy-staff-password")


def otp_hash(phone, code):
    return salted_hmac("fees.phone-otp", f"{phone}:{code}", algorithm="sha256").hexdigest()


def sign_in(request, subject_type, subject_id, expiry, otp_id=None):
    request.session.clear()
    request.session.cycle_key()
    request.session["subject_type"] = subject_type
    request.session["subject_id"] = str(subject_id)
    if otp_id:
        request.session["otp_challenge_id"] = str(otp_id)
    request.session.set_expiry(expiry)


def parent_state(guardian, declined=False):
    children = list(GuardianStudent.objects.filter(guardian=guardian, student__archived_at__isnull=True)
                    .values("student_id", "student__code", "student__full_name"))
    return {"phone": guardian.phone, "consent": not declined and has_parent_consent(guardian),
            "declined": declined, "children": [{"id": child["student__code"], "name": child["student__full_name"]} for child in children]}


@api(role="public", form=PhoneForm)
@transaction.atomic
def request_otp(request):
    phone = request.data["phone"]
    lock_subject("otp", phone)
    now = timezone.now()
    if OtpChallenge.objects.filter(phone=phone, created_at__gte=now - timedelta(minutes=10)).count() >= 3:
        return error("too_many", "Wait ten minutes before requesting another code.", 429)
    code = f"{secrets.randbelow(1000000):06d}"
    OtpChallenge.objects.filter(phone=phone, consumed_at__isnull=True).update(consumed_at=now)
    OtpChallenge.objects.create(phone=phone, code_hash=otp_hash(phone, code), expires_at=now + timedelta(minutes=5))
    result = {"ok": True, "phone": phone}
    if os.getenv("DEMO_MODE", "false").lower() == "true":
        result["demoCode"] = code
    return JsonResponse(result)


@api(role="public", form=VerifyOtpForm)
@transaction.atomic
def verify_otp(request):
    phone, code = request.data["phone"], request.data["code"]
    lock_subject("otp", phone)
    now = timezone.now()
    challenge = OtpChallenge.objects.select_for_update().filter(phone=phone).order_by("-created_at", "-id").first()
    if not challenge or challenge.consumed_at or challenge.expires_at <= now:
        return error("expired", "Request a new code.")
    if challenge.attempts >= 5:
        return error("too_many", "Too many attempts. Request a new code.", 429)
    challenge.attempts += 1
    challenge.save(update_fields=["attempts"])
    valid = constant_time_compare(challenge.code_hash, otp_hash(phone, code))
    guardian = Guardian.objects.filter(phone=phone).first() if valid else None
    if not guardian:
        return error("code_wrong", "The code is incorrect.")
    challenge.consumed_at = now
    challenge.save(update_fields=["consumed_at"])
    sign_in(request, "guardian", guardian.pk, 30 * 24 * 60 * 60, challenge.pk)
    return JsonResponse({"ok": True, "verified": True,
                         "next": "/dashboard" if parent_state(guardian)["consent"] else "/consent"})


@api(role="public", form=StaffLoginForm)
@transaction.atomic
def staff_login(request):
    email, password = request.data["email"], request.data["password"]
    lock_subject("staff-login", email)
    now = timezone.now()
    failures = LoginAttempt.objects.filter(email=email, at__gte=now - timedelta(minutes=15))
    if failures.count() >= 10:
        return error("too_many", "Too many attempts. Try again later.", 429)
    staff = StaffUser.objects.filter(email__iexact=email, archived_at__isnull=True).first()
    valid = check_password(password, staff.password_hash if staff else DUMMY_PASSWORD_HASH)
    if not staff or not valid:
        LoginAttempt.objects.create(email=email, at=now)
        return error("credentials", "The email or password is incorrect.", 401)
    if staff.role == "admin":
        return error("role_unavailable", "Admin sign-in is unavailable until the Manage workspace is ready.", 403)
    LoginAttempt.objects.filter(email=email).delete()
    sign_in(request, "staff", staff.pk, 12 * 60 * 60)
    return JsonResponse({"ok": True, "next": "/counsellor/tasks" if staff.role == "counsellor" else "/staff/dashboard"})


@api(role="any")
def logout(request):
    request.session.flush()
    return JsonResponse({"ok": True, "next": "/login"})


@api(role="public", form=LanguageForm)
def set_language(request):
    language = request.data["language"]
    if request.session.get("subject_type") == "guardian":
        try:
            guardian_id = UUID(request.session.get("subject_id", ""))
        except (ValueError, TypeError, AttributeError):
            guardian_id = None
        if guardian_id:
            Guardian.objects.filter(pk=guardian_id).update(language=language)
    return JsonResponse({"ok": True, "language": language})


@api(role="any", methods=("GET",))
def me(request):
    if request.role == "parent":
        return JsonResponse({"ok": True, "role": "parent", "centreId": None,
                             **parent_state(request.subject, request.session.get("consent_declined", False))})
    staff = request.subject
    return JsonResponse({"ok": True, "role": staff.role,
                         "centreId": staff.centre.code if staff.centre_id else None,
                         "phone": None, "consent": False, "declined": False, "children": []})
