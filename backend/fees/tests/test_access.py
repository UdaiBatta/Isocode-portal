import os
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.contrib.sessions.models import Session
from django.http import JsonResponse
from django.test import RequestFactory, TestCase
from django.urls import URLResolver, get_resolver
from django.utils import timezone

from fees.auth import api
from fees.models import Guardian, LoginAttempt, StaffUser


class AccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        password_hash = make_password("test-staff-password")
        cls.staff = {}
        for role in ["accounts", "counsellor", "admin"]:
            cls.staff[role] = StaffUser.objects.create(email=f"{role}@demo.test", full_name=f"Demo {role}",
                                                      password_hash=password_hash, role=role)
        cls.guardian = Guardian.objects.create(phone="+919000000587", full_name="Demo guardian", language="hi")

    def setUp(self):
        patcher = patch.dict(os.environ, {"INTERNAL_API_SECRET": "test-internal-key"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def post(self, name, data=None):
        return self.client.post(f"/api/{name}", data or {}, content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key")

    def login(self, role="accounts", password="test-staff-password"):
        return self.post("staff_login", {"email": f"{role}@demo.test", "password": password})

    def test_all_url_patterns_require_api_decorator(self):
        def walk(patterns):
            for pattern in patterns:
                if isinstance(pattern, URLResolver):
                    walk(pattern.url_patterns)
                else:
                    self.assertTrue(hasattr(pattern.callback, "api_role"), str(pattern.pattern))
        walk(get_resolver().url_patterns)

    def test_missing_wrong_or_unconfigured_internal_key_is_refused(self):
        for name in ["request_otp", "verify_otp", "staff_login", "logout", "set_language", "me"]:
            with self.subTest(name=name):
                method = self.client.get if name == "me" else self.client.post
                self.assertEqual(method(f"/api/{name}").status_code, 403)
                self.assertEqual(method(f"/api/{name}", HTTP_X_INTERNAL_KEY="wrong").status_code, 403)
        with patch.dict(os.environ, {"INTERNAL_API_SECRET": ""}):
            self.assertEqual(self.post("request_otp", {"phone": self.guardian.phone}).status_code, 403)

    def test_methods_json_and_forms(self):
        self.assertEqual(self.client.get("/api/staff_login", HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 405)
        self.assertEqual(self.post("me").status_code, 405)
        for body in ["not json", "[]", '{"phone":"12345"}']:
            self.assertEqual(self.client.post("/api/request_otp", body, content_type="application/json",
                                             HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 400)
        self.assertEqual(self.post("verify_otp", {"phone": self.guardian.phone, "code": "123"}).status_code, 400)
        self.assertEqual(self.post("staff_login", {"email": "invalid", "password": "x"}).status_code, 400)
        self.assertEqual(self.post("set_language", {"language": "xx"}).status_code, 400)

    def test_language_is_public_and_only_updates_the_signed_in_guardian(self):
        self.assertEqual(self.post("set_language", {"language": "en"}).json(), {"ok": True, "language": "en"})
        other = Guardian.objects.create(phone="+919000000412", full_name="Other demo guardian", language="hi")
        session = self.client.session
        session["subject_type"] = "guardian"
        session["subject_id"] = str(self.guardian.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        self.post("set_language", {"language": "en"})
        self.guardian.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual((self.guardian.language, other.language), ("en", "hi"))

    def test_private_views_require_session(self):
        self.assertEqual(self.client.get("/api/me", HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 401)
        self.assertEqual(self.post("logout").status_code, 401)
        session = self.client.session
        session["subject_type"] = "staff"
        session["subject_id"] = "not-a-uuid"
        session.save()
        self.client.cookies["sid"] = session.session_key
        self.assertEqual(self.client.get("/api/me", HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 401)

    def test_staff_session_roles_expiry_logout_and_archival(self):
        for role, next_path in [("accounts", "/staff/dashboard"), ("counsellor", "/counsellor/tasks")]:
            with self.subTest(role=role):
                self.assertEqual(self.login(role).json()["next"], next_path)
                self.assertEqual(self.client.session.get_expiry_age(), 43200)
                response = self.client.get("/api/me", HTTP_X_INTERNAL_KEY="test-internal-key")
                self.assertEqual(response.json()["role"], role)
                self.assertNotIn("sid", response.cookies)
                key = self.client.session.session_key
                self.assertTrue(self.post("logout").json()["ok"])
                self.assertFalse(Session.objects.filter(session_key=key).exists())
                self.assertEqual(self.client.cookies["sid"]["max-age"], 0)
        self.login()
        StaffUser.objects.filter(pk=self.staff["accounts"].pk).update(archived_at=timezone.now())
        self.assertEqual(self.client.get("/api/me", HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 401)

    def test_admin_sign_in_waits_for_manage_workspace(self):
        response = self.login("admin")
        self.assertEqual((response.status_code, response.json()["code"]), (403, "role_unavailable"))
        self.assertNotIn("sid", self.client.cookies)

    def test_staff_failure_limit_and_window(self):
        for _ in range(10):
            self.assertEqual(self.login(password="wrong").status_code, 401)
        self.assertEqual(self.login().status_code, 429)
        LoginAttempt.objects.update(at=timezone.now() - timedelta(minutes=16))
        self.assertTrue(self.login().json()["ok"])
        self.assertFalse(LoginAttempt.objects.exists())
        known = self.login(password="wrong").json()
        unknown = self.post("staff_login", {"email": "unknown@demo.test", "password": "wrong"}).json()
        self.assertEqual(known, unknown)

    def test_role_comes_from_database_not_session_or_input(self):
        def protected(role):
            request = RequestFactory().post("/role-check", HTTP_X_INTERNAL_KEY="test-internal-key")
            request.session = self.client.session
            return api(role=role)(lambda request: JsonResponse({"ok": True}))(request)
        self.login("counsellor")
        self.assertEqual(protected("accounts").status_code, 403)
        self.assertEqual(protected("counsellor").status_code, 200)
        self.login()
        self.assertEqual(protected("counsellor").status_code, 403)
        session = self.client.session
        session["role"] = "admin"
        session.save()
        self.assertEqual(protected("admin").status_code, 403)
        session["subject_type"] = "guardian"
        session["subject_id"] = str(self.guardian.pk)
        session.save()
        self.assertEqual(protected("accounts").status_code, 403)
