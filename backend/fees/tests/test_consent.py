import os
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.sessions.models import Session
from django.http import JsonResponse
from django.test import Client, TestCase, override_settings
from django.urls import include, path
from django.utils import timezone

from fees.auth import api
from fees.models import Batch, Centre, Consent, Guardian, GuardianStudent, OtpChallenge, StaffUser, Student


@api(role="parent", methods=("GET",))
def protected_parent(request):
    return JsonResponse({"ok": True, "protected": True})


urlpatterns = [path("api/", include("fees.urls")), path("api/parent_data", protected_parent)]


@override_settings(ROOT_URLCONF=__name__)
class ConsentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.guardian = Guardian.objects.create(phone="+919000000777", full_name="Demo guardian", language="hi")
        other = Guardian.objects.create(phone="+919000000587", full_name="Other guardian", language="en")
        centre = Centre.objects.create(code="MLV", name="Demo centre")
        batch = Batch.objects.create(centre=centre, name="Demo batch", stream="JEE",
                                     session_start=date(2026, 4, 1), session_end=date(2027, 3, 31))
        for code, guardian in [("STU-0771", cls.guardian), ("STU-0772", cls.guardian), ("STU-0587", other)]:
            student = Student.objects.create(code=code, full_name=f"Demo {code}", batch=batch, enrolled_on=date(2026, 4, 1))
            GuardianStudent.objects.create(guardian=guardian, student=student, is_primary=True)

    def setUp(self):
        for patcher in [patch.dict(os.environ, {"INTERNAL_API_SECRET": "test-internal-key", "DEMO_MODE": "true"}),
                        patch("fees.views.auth.secrets.randbelow", return_value=987654)]:
            patcher.start()
            self.addCleanup(patcher.stop)
        self.sign_in()

    def post(self, name, data=None):
        return self.client.post(f"/api/{name}", data or {}, content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key")

    def sign_in(self):
        self.post("request_otp", {"phone": self.guardian.phone})
        self.assertTrue(self.post("verify_otp", {"phone": self.guardian.phone, "code": "987654"}).json()["ok"])
        self.otp_id = self.client.session["otp_challenge_id"]

    def grant(self, codes=None, **extra):
        return self.post("grant_consent", {"studentIds": codes or ["STU-0771", "STU-0772"],
                                            "wordingVersion": "v1", "language": "en", **extra})

    def me(self):
        return self.client.get("/api/me", HTTP_X_INTERNAL_KEY="test-internal-key").json()

    def protected(self):
        return self.client.get("/api/parent_data", HTTP_X_INTERNAL_KEY="test-internal-key")

    def test_grant_records_exact_verified_otp_language_and_time_then_opens_access(self):
        self.assertEqual((self.protected().status_code, self.protected().json()["code"]), (403, "consent_required"))
        before = timezone.now()
        self.assertEqual(self.grant(otpChallengeId="ignored-client-value").json(), {"ok": True, "next": "/dashboard"})
        self.assertEqual(Consent.objects.count(), 2)
        for row in Consent.objects.all():
            self.assertEqual((row.guardian_id, str(row.otp_challenge_id), row.wording_version, row.language),
                             (self.guardian.pk, self.otp_id, "v1", "en"))
            self.assertLessEqual(before, row.granted_at)
            self.assertLessEqual(row.granted_at, timezone.now())
            self.assertIsNone(row.withdrawn_at)
        self.assertTrue(self.me()["consent"])
        self.assertFalse(self.me()["declined"])
        self.assertEqual(self.protected().status_code, 200)
        records = list(Consent.objects.order_by("pk").values())
        self.grant()
        self.assertEqual(list(Consent.objects.order_by("pk").values()), records)

    def test_unlinked_unknown_duplicate_and_bad_wording_are_rejected_without_partial_writes(self):
        for codes, extra, expected in [
            (["STU-0771", "STU-0587"], {}, 403),
            (["STU-9999"], {}, 403),
            (["STU-0771", "STU-0771"], {}, 400),
            (["STU-0771"], {"wordingVersion": "v2"}, 400),
            (["STU-0771"], {"language": "xx"}, 400),
        ]:
            with self.subTest(codes=codes, extra=extra):
                self.assertEqual(self.grant(codes, **extra).status_code, expected)
                self.assertFalse(Consent.objects.exists())
        self.assertEqual(self.post("grant_consent", {"studentIds": [], "wordingVersion": "v1", "language": "en"}).status_code, 400)

    def test_decline_is_persisted_in_db_session_without_withdrawing_existing_child_consent(self):
        self.assertEqual(self.grant(["STU-0771"]).json()["next"], "/consent")
        original = list(Consent.objects.values())
        self.assertEqual(self.protected().status_code, 403)
        self.assertTrue(self.post("decline_consent").json()["ok"])
        self.assertEqual(list(Consent.objects.values()), original)
        self.assertTrue(Session.objects.get(session_key=self.client.session.session_key).get_decoded()["consent_declined"])
        another_client = Client()
        another_client.cookies["sid"] = self.client.session.session_key
        self.assertTrue(another_client.get("/api/me", HTTP_X_INTERNAL_KEY="test-internal-key").json()["declined"])
        self.assertFalse(self.me()["consent"])
        self.assertEqual(self.protected().json()["code"], "consent_required")
        self.client.cookies.clear()
        self.sign_in()
        self.assertFalse(self.me()["declined"])
        self.assertFalse(self.me()["consent"])
        self.assertTrue(self.grant().json()["ok"])
        self.assertEqual(Consent.objects.count(), 2)
        self.assertEqual(self.protected().status_code, 200)

    def test_grant_requires_the_sessions_consumed_matching_otp(self):
        foreign = OtpChallenge.objects.create(phone="+919000000587", code_hash="test", expires_at=timezone.now(),
                                               consumed_at=timezone.now())
        unused = OtpChallenge.objects.create(phone=self.guardian.phone, code_hash="test", expires_at=timezone.now())
        for otp_id in [None, "not-a-uuid", str(foreign.pk), str(unused.pk)]:
            with self.subTest(otp_id=otp_id):
                session = self.client.session
                session["otp_challenge_id"] = otp_id
                session.save()
                self.assertEqual(self.grant().json()["code"], "otp_required")
                self.assertFalse(Consent.objects.exists())
        session = self.client.session
        session["otp_challenge_id"] = self.otp_id
        session.save()
        OtpChallenge.objects.filter(pk=self.otp_id).update(expires_at=timezone.now() - timedelta(days=1))
        self.assertTrue(self.grant().json()["ok"])

    def test_declined_marker_blocks_access_without_withdrawing_saved_consent(self):
        self.grant()
        self.assertEqual(self.protected().status_code, 200)
        original = list(Consent.objects.order_by("pk").values())
        self.post("decline_consent")
        self.assertEqual(self.protected().json()["code"], "consent_required")
        self.assertEqual(list(Consent.objects.order_by("pk").values()), original)
        self.assertEqual(Consent.objects.filter(withdrawn_at__isnull=True).count(), 2)
        self.assertTrue(self.me()["declined"])
        self.client.cookies.clear()
        self.sign_in()
        self.assertFalse(self.me()["declined"])
        self.assertTrue(self.me()["consent"])
        self.assertEqual(self.protected().status_code, 200)

    def test_consent_actions_require_parent_session_even_before_consent(self):
        anonymous = Client()
        self.assertEqual(anonymous.post("/api/decline_consent", HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 401)
        staff = StaffUser.objects.create(email="accounts@demo.test", full_name="Demo accounts", role="accounts", password_hash="!")
        session = self.client.session
        session["subject_type"] = "staff"
        session["subject_id"] = str(staff.pk)
        session.save()
        self.assertEqual(self.grant().status_code, 403)
        self.assertEqual(self.post("decline_consent").status_code, 403)
