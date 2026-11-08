import io
import os
from datetime import date, timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from fees import models as m


class ParentStudentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        env = patch.dict(os.environ, {"DEMO_MODE": "true", "INTERNAL_API_SECRET": "test-key"})
        env.start()
        self.addCleanup(env.stop)

    def sign_in(self, code, consent=True):
        guardian = m.GuardianStudent.objects.select_related("guardian").get(student__code=code, is_primary=True).guardian
        session = self.client.session
        session["subject_type"], session["subject_id"] = "guardian", str(guardian.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        if consent:
            challenge = m.OtpChallenge.objects.create(phone=guardian.phone, code_hash="synthetic-test-hash",
                                                       expires_at=timezone.now() + timedelta(minutes=5), consumed_at=timezone.now())
            for link in m.GuardianStudent.objects.filter(guardian=guardian):
                if not m.Consent.objects.filter(guardian=guardian, student=link.student, withdrawn_at__isnull=True).exists():
                    m.Consent.objects.create(guardian=guardian, student=link.student, wording_version="v1", language=guardian.language,
                                             otp_challenge=challenge, granted_at=timezone.now())
        return guardian

    def get(self, path):
        return self.client.get(f"/api/{path}", HTTP_X_INTERNAL_KEY="test-key")

    def test_real_family_selection_and_current_database_identity(self):
        guardian = self.sign_in("STU-0771")
        family = self.get("family").json()
        self.assertEqual(family["selected"], "STU-0771")
        self.assertEqual([row["studentId"] for row in family["family"]], ["STU-0771", "STU-0772"])
        self.assertEqual(self.get("family?student=STU-0772").json()["selected"], "STU-0772")
        m.Student.objects.filter(code="STU-0772").update(full_name="Fictional updated child")
        info = self.get("student_info?student=STU-0772").json()
        self.assertEqual((info["name"], info["guardianPhone"], info["preferredLanguage"]),
                         ("Fictional updated child", guardian.phone, guardian.language))
        self.assertEqual(set(info), {"ok", "code", "name", "batch", "centre", "status", "enrolledOn", "guardianPhone", "preferredLanguage", "course"})
        self.assertEqual((info["course"]["exam"], info["course"]["examYear"], info["course"]["instalments"]), ("NEET", "2027", 3))

    def test_fleet_child_not_in_frontend_fixture_catalog_is_readable(self):
        self.sign_in("STU-0001")
        info = self.get("student_info").json()
        self.assertEqual(info["code"], "STU-0001")
        progress = self.get("progress").json()
        self.assertEqual(set(progress), {"ok", "attendance", "tests"})
        self.assertEqual((len(progress["attendance"]), len(progress["tests"])), (8, 5))
        self.assertEqual([row["weekStart"] for row in progress["attendance"]], sorted(
            [row["weekStart"] for row in progress["attendance"]], reverse=True))

    def test_progress_excludes_before_enrolment_future_and_after_withdrawal(self):
        self.sign_in("STU-0802")
        student = m.Student.objects.get(code="STU-0802")
        for week in (date(2026, 3, 30), date(2026, 11, 2), date(2026, 11, 9)):
            m.AttendanceWeekly.objects.create(student=student, week_start=week, attended=1, held=6)
        for day in (date(2026, 3, 31), date(2026, 10, 30), date(2026, 11, 9)):
            m.TestScore.objects.create(student=student, test_date=day, test_name="Excluded synthetic test", score=1, max_score=100)
        view = self.get("progress").json()
        self.assertTrue(all("2026-04-01" <= row["weekStart"] <= "2026-10-28" for row in view["attendance"]))
        self.assertTrue(all("2026-04-01" <= row["testDate"] <= "2026-10-28" for row in view["tests"]))
        self.assertNotIn("Excluded synthetic test", [row["testName"] for row in view["tests"]])

    def test_consent_role_child_scope_and_archives(self):
        self.sign_in("STU-0771", consent=False)
        for endpoint in ("family", "student_info", "progress"):
            self.assertEqual(self.get(endpoint).json()["code"], "consent_required")
        self.sign_in("STU-0771")
        for endpoint in ("family", "student_info", "progress"):
            self.assertEqual(self.get(f"{endpoint}?student=STU-0587").status_code, 403)
            self.assertEqual(self.get(f"{endpoint}?student=STU-9999").status_code, 403)
        m.Student.objects.filter(code="STU-0772").update(archived_at=timezone.now())
        self.assertEqual([row["studentId"] for row in self.get("family").json()["family"]], ["STU-0771"])
        self.assertEqual(self.get("progress?student=STU-0772").status_code, 403)
        session = self.client.session
        session["subject_type"], session["subject_id"] = "staff", str(m.StaffUser.objects.get(email="accounts@demo.test").pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        self.assertEqual(self.get("student_info?student=STU-0771").status_code, 403)
        self.assertEqual(self.client.get("/api/family").status_code, 403)

    def test_secondary_guardian_sees_their_own_verified_contact(self):
        student = m.Student.objects.get(code="STU-0587")
        guardian = m.Guardian.objects.create(phone="+919888880003", full_name="Fictional second guardian", language="hi")
        m.GuardianStudent.objects.create(guardian=guardian, student=student, is_primary=False)
        challenge = m.OtpChallenge.objects.create(phone=guardian.phone, code_hash="synthetic-test-hash",
                                                   expires_at=timezone.now() + timedelta(minutes=5), consumed_at=timezone.now())
        m.Consent.objects.create(guardian=guardian, student=student, wording_version="v1", language="hi",
                                 otp_challenge=challenge, granted_at=timezone.now())
        session = self.client.session
        session["subject_type"], session["subject_id"] = "guardian", str(guardian.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        info = self.get("student_info").json()
        self.assertEqual((info["guardianPhone"], info["preferredLanguage"]), (guardian.phone, "hi"))
