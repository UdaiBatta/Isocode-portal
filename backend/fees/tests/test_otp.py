import os
from datetime import timedelta
from unittest.mock import patch

from django.contrib.sessions.models import Session
from django.test import TestCase
from django.utils import timezone

from fees.models import Guardian, OtpChallenge
from fees.views.auth import otp_hash


class OtpTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.guardian = Guardian.objects.create(phone="+919000000587", full_name="Demo guardian", language="en")

    def setUp(self):
        for patcher in [patch.dict(os.environ, {"INTERNAL_API_SECRET": "test-internal-key", "DEMO_MODE": "true"}),
                        patch("fees.views.auth.secrets.randbelow", return_value=123456)]:
            patcher.start()
            self.addCleanup(patcher.stop)

    def post(self, name, data):
        return self.client.post(f"/api/{name}", data, content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key")

    def send(self, phone="+919000000587"):
        return self.post("request_otp", {"phone": phone})

    def verify(self, code="123456", phone="+919000000587"):
        return self.post("verify_otp", {"phone": phone, "code": code})

    def test_generated_code_is_hashed_and_demo_only(self):
        with patch("fees.views.auth.secrets.randbelow", return_value=12345):
            response = self.send("90000 00587")
        self.assertEqual(response.json(), {"ok": True, "phone": self.guardian.phone, "demoCode": "012345"})
        challenge = OtpChallenge.objects.get()
        self.assertEqual(challenge.code_hash, otp_hash(self.guardian.phone, "012345"))
        self.assertNotEqual(challenge.code_hash, "012345")
        self.assertLess(abs(challenge.expires_at - challenge.created_at - timedelta(minutes=5)), timedelta(seconds=1))
        with patch.dict(os.environ, {"DEMO_MODE": "false"}):
            self.assertNotIn("demoCode", self.send().json())

    def test_expiry(self):
        self.send()
        OtpChallenge.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.verify().json()["code"], "expired")
        self.assertNotIn("sid", self.client.cookies)

    def test_five_attempt_limit(self):
        self.send()
        for _ in range(5):
            self.assertEqual(self.verify("000000").json()["code"], "code_wrong")
        response = self.verify()
        self.assertEqual((response.status_code, response.json()["code"]), (429, "too_many"))
        self.assertEqual(OtpChallenge.objects.get().attempts, 5)

    def test_send_limit_and_window_for_known_and_unknown(self):
        for phone in [self.guardian.phone, "+919876543210"]:
            with self.subTest(phone=phone):
                for _ in range(3):
                    self.assertEqual(self.send(phone).status_code, 200)
                self.assertEqual(self.send(phone).status_code, 429)
                OtpChallenge.objects.filter(phone=phone).update(created_at=timezone.now() - timedelta(minutes=11))
                self.assertEqual(self.send(phone).status_code, 200)

    def test_resend_invalidates_previous_code(self):
        with patch("fees.views.auth.secrets.randbelow", side_effect=[111111, 222222]):
            self.send()
            first = OtpChallenge.objects.get()
            self.send()
        first.refresh_from_db()
        self.assertIsNotNone(first.consumed_at)
        self.assertEqual(self.verify("111111").json()["code"], "code_wrong")
        self.assertTrue(self.verify("222222").json()["ok"])

    def test_unknown_phone_has_generic_response_and_no_session(self):
        known = self.send().json()
        unknown = self.send("+919876543210").json()
        known.pop("phone")
        unknown.pop("phone")
        self.assertEqual(known, unknown)
        wrong_known = self.verify("000000").json()
        correct_unknown = self.verify(phone="+919876543210").json()
        self.assertEqual(wrong_known, correct_unknown)
        self.assertNotIn("sid", self.client.cookies)

    def test_session_rotation_expiry_and_single_use(self):
        session = self.client.session
        session["previous"] = "discard me"
        session.save()
        old_key = session.session_key
        self.client.cookies["sid"] = old_key
        self.send()
        self.assertEqual(self.verify().json()["next"], "/consent")
        session = self.client.session
        self.assertNotEqual(session.session_key, old_key)
        self.assertFalse(Session.objects.filter(session_key=old_key).exists())
        self.assertNotIn("previous", session)
        self.assertEqual(session["subject_id"], str(self.guardian.pk))
        self.assertEqual(session["subject_type"], "guardian")
        self.assertEqual(session["otp_challenge_id"], str(OtpChallenge.objects.get().pk))
        self.assertEqual(session.get_expiry_age(), 2592000)
        self.assertEqual(self.verify().json()["code"], "expired")
        response = self.client.get("/api/me", HTTP_X_INTERNAL_KEY="test-internal-key")
        self.assertEqual((response.json()["role"], response.json()["phone"]), ("parent", self.guardian.phone))
        self.assertNotIn("sid", response.cookies)
