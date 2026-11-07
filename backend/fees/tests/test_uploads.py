import io
import os
from datetime import date, timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from fees import models as m


class UploadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        env = patch.dict(os.environ, {"DEMO_MODE": "true", "INTERNAL_API_SECRET": "test-key"})
        env.start()
        self.addCleanup(env.stop)
        self.student = m.Student.objects.get(code="STU-0587")
        self.sign_in()

    def sign_in(self, email="accounts@demo.test"):
        actor = m.StaffUser.objects.get(email=email)
        session = self.client.session
        session["subject_type"], session["subject_id"] = "staff", str(actor.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        return actor

    def upload(self, rows="STU-0587,2026-10-26,5,6\n", **changes):
        data = {"batchId": str(self.student.batch_id), "kind": "attendance", "commit": False,
                "csv": "student_code,week_start,attended,held\n" + rows, **changes}
        return self.client.post("/api/upload_progress", data, content_type="application/json", HTTP_X_INTERNAL_KEY="test-key")

    def test_validate_does_not_write_then_commit_upserts_and_audits_once(self):
        key = {"student": self.student, "week_start": date(2026, 10, 26)}
        before = m.AttendanceWeekly.objects.get(**key).attended
        audits = m.AuditLog.objects.count()
        self.assertEqual(self.upload().json(), {"ok": True, "rows": 1, "errors": [], "applied": False})
        self.assertEqual(m.AttendanceWeekly.objects.get(**key).attended, before)
        self.assertEqual(m.AuditLog.objects.count(), audits)
        count = m.AttendanceWeekly.objects.count()
        for _ in range(2):
            self.assertTrue(self.upload(commit=True).json()["applied"])
        self.assertEqual(m.AttendanceWeekly.objects.count(), count)
        self.assertEqual(m.AttendanceWeekly.objects.get(**key).attended, 5)
        logs = m.AuditLog.objects.filter(action="upload_progress")
        self.assertEqual(logs.count(), 2)
        self.assertEqual(logs.first().entity_id, self.student.batch_id)
        self.assertEqual(logs.first().after, {"kind": "attendance", "rows": 1})

    def test_tests_upsert_on_date_and_name_with_last_duplicate_winning(self):
        csv = "student_code,test_date,test_name,score,max_score\nSTU-0587,2026-10-28,Monthly Test 7,87,100\n"
        csv += "STU-0587,2026-10-28,Monthly Test 7,88,100\n"
        count = m.TestScore.objects.count()
        self.assertEqual(self.upload(kind="tests", csv=csv, commit=True).json(),
                         {"ok": True, "rows": 2, "errors": [], "applied": True})
        self.assertEqual(m.TestScore.objects.count(), count)
        self.assertEqual(m.TestScore.objects.get(student=self.student, test_date="2026-10-28", test_name="Monthly Test 7").score, 88)

    def test_bad_rows_block_every_write_and_report_physical_lines(self):
        before = list(m.AttendanceWeekly.objects.values())
        audits = m.AuditLog.objects.count()
        rows = "STU-0587,2026-10-26,1,6\nSTU-0587,2026-10-26,7,6\nSTU-9999,2026-10-26,5,6\n"
        result = self.upload(rows, commit=True).json()
        self.assertEqual((result["rows"], result["applied"]), (3, False))
        self.assertEqual([error["line"] for error in result["errors"]], [3, 4])
        self.assertEqual(list(m.AttendanceWeekly.objects.values()), before)
        self.assertEqual(m.AuditLog.objects.count(), audits)
        result = self.upload('"bad\ncode",2026-10-26,1,6\nSTU-0587,2026-10-26,-1,6\n').json()
        self.assertEqual([error["line"] for error in result["errors"]], [2, 4])

    def test_dates_whole_numbers_headers_empty_and_malformed_csv(self):
        for row in ["STU-0587,20261026,1,6", "STU-0587,2026-02-30,1,6", "STU-0587,2026-10-26,1.0,6",
                    "STU-0587,2026-10-26,-1,6", "STU-0587,2026-10-26,1,2147483648", "STU-0587,2026-10-26,1"]:
            with self.subTest(row=row):
                result = self.upload(row, commit=True).json()
                self.assertFalse(result["applied"])
                self.assertEqual(result["errors"][0]["line"], 2)
        for text in ["wrong\n", "student_code,week_start,attended,held\n", 'student_code,week_start,attended,held\n"unterminated']:
            self.assertTrue(self.upload(csv=text).json()["errors"])
        self.assertTrue(self.upload("STU-0587,2026-10-26,0,0", commit=True).json()["applied"])

    def test_test_score_validation(self):
        for values in ["Test,101,100", "Test,0,0", ",1,100", "X" * 201 + ",1,100", "Test,1.5,100"]:
            with self.subTest(values=values):
                result = self.upload(kind="tests", commit=True, csv=(
                    "student_code,test_date,test_name,score,max_score\nSTU-0587,2026-10-28," + values)).json()
                self.assertFalse(result["applied"])
                self.assertEqual(result["errors"][0]["line"], 2)

    def test_csv_byte_row_limits_and_strict_request_types(self):
        for changes in [{"csv": "अ" * 350000}, {"csv": 123}, {"commit": "false"}, {"commit": 0},
                        {"batchId": "invalid"}, {"kind": "unknown"}]:
            with self.subTest(changes=list(changes)):
                self.assertEqual(self.upload(**changes).status_code, 400)
        result = self.upload("STU-0587,2026-10-26,1,6\n" * 5000).json()
        self.assertEqual((result["rows"], result["errors"]), (5000, []))
        result = self.upload("STU-0587,2026-10-26,1,6\n" * 5001, commit=True).json()
        self.assertFalse(result["applied"])
        self.assertEqual(result["errors"][0]["line"], 5002)

    def test_active_student_batch_and_centre_scope(self):
        self.sign_in("accounts.mlv@demo.test")
        self.assertFalse(self.upload().json()["errors"])
        other = m.Batch.objects.filter(centre__code="VSH").first()
        self.assertEqual(self.upload(batchId=str(other.pk), commit=True).status_code, 403)
        m.Student.objects.filter(pk=self.student.pk).update(status="withdrawn")
        self.assertTrue(self.upload().json()["errors"])
        m.Student.objects.filter(pk=self.student.pk).update(status="active", archived_at=timezone.now())
        self.assertTrue(self.upload().json()["errors"])
        m.Student.objects.filter(pk=self.student.pk).update(archived_at=None, batch=other)
        self.assertTrue(self.upload(batchId=str(self.student.batch_id)).json()["errors"])
        m.Batch.objects.filter(pk=self.student.batch_id).update(archived_at=timezone.now())
        self.assertEqual(self.upload().status_code, 403)

    def test_commits_5000_rows_in_one_upload(self):
        rows = "".join(f"STU-0587,{date(2000, 1, 1) + timedelta(days=i)},1,6\n" for i in range(5000))
        count = m.AttendanceWeekly.objects.count()
        self.assertEqual(self.upload(rows, commit=True).json(), {"ok": True, "rows": 5000, "errors": [], "applied": True})
        self.assertEqual(m.AttendanceWeekly.objects.count(), count + 5000)
        self.assertEqual(m.AuditLog.objects.filter(action="upload_progress").count(), 1)

    def test_auth_roles_methods_and_internal_key(self):
        for email in ["counsellor@demo.test", "admin@demo.test"]:
            self.sign_in(email)
            self.assertEqual(self.upload(commit=True).status_code, 403)
        session = self.client.session
        session["subject_type"], session["subject_id"] = "guardian", str(m.Guardian.objects.first().pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        self.assertEqual(self.upload(commit=True).status_code, 403)
        self.client.cookies.clear()
        self.assertEqual(self.upload().status_code, 401)
        self.assertEqual(self.client.post("/api/upload_progress").status_code, 403)
        self.sign_in()
        self.assertEqual(self.client.get("/api/upload_progress", HTTP_X_INTERNAL_KEY="test-key").status_code, 405)

    def test_audit_failure_rolls_back_the_entire_upload(self):
        before = list(m.AttendanceWeekly.objects.values())
        with patch("fees.services.uploads.AuditLog.objects.create", side_effect=RuntimeError("audit unavailable")):
            with self.assertRaisesMessage(RuntimeError, "audit unavailable"):
                self.upload("STU-0587,2026-10-26,1,6\nSTU-0587,2026-11-02,2,6\n", commit=True)
        self.assertEqual(list(m.AttendanceWeekly.objects.values()), before)
