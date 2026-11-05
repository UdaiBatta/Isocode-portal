import io
import os
from datetime import date
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from fees.models import AttendanceWeekly, Guardian, GuardianStudent, StaffUser, Student, TestScore


class StudentRecordTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        patcher = patch.dict(os.environ, {"INTERNAL_API_SECRET": "test-internal-key", "DEMO_MODE": "true"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def sign_in(self, email="accounts@demo.test"):
        user = StaffUser.objects.get(email=email)
        session = self.client.session
        session["subject_type"] = "staff"
        session["subject_id"] = str(user.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        return user

    def get_record(self, code="STU-0587", **headers):
        return self.client.get("/api/student_record", {"student": code},
                               HTTP_X_INTERNAL_KEY="test-internal-key", **headers)

    def test_info_reads_current_database_values_and_has_no_risk_or_money_fields(self):
        self.sign_in()
        student = Student.objects.select_related("batch__centre").get(code="STU-0587")
        student.full_name = "Changed synthetic student"
        student.save(update_fields=["full_name"])
        guardian = GuardianStudent.objects.get(student=student, is_primary=True).guardian
        guardian.language = "hi"
        guardian.save(update_fields=["language"])

        response = self.get_record()
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(set(result), {"ok", "info", "progress"})
        self.assertEqual(result["info"], {
            "code": student.code, "name": "Changed synthetic student", "batch": "JEE 2027 Evening",
            "centre": "Malviya Nagar", "status": "active", "enrolledOn": student.enrolled_on.isoformat(),
            "guardianPhone": guardian.phone, "preferredLanguage": "hi",
            "course": {"exam": "JEE", "examYear": "2027", "timing": "Evening",
                       "sessionStart": "2026-04-01", "sessionEnd": "2027-03-31", "instalments": 4},
        })
        self.assertEqual(set(result["progress"]), {"attendance", "tests"})
        self.assertTrue(all(set(row) == {"weekStart", "attended", "held"}
                            for row in result["progress"]["attendance"]))
        self.assertTrue(all(set(row) == {"testDate", "testName", "score", "maxScore"}
                            for row in result["progress"]["tests"]))

    def test_progress_is_newest_first_and_stops_at_today_or_withdrawal(self):
        self.sign_in()
        student = Student.objects.get(code="STU-0587")
        for day in [date(2026, 3, 2), date(2026, 11, 9)]:
            AttendanceWeekly.objects.create(student=student, week_start=day, attended=1, held=2)
            TestScore.objects.create(student=student, test_date=day, test_name="Outside period", score=1, max_score=2)

        progress = self.get_record().json()["progress"]
        self.assertEqual(len(progress["attendance"]), 8)
        self.assertEqual(len(progress["tests"]), 5)
        for rows, key in [(progress["attendance"], "weekStart"), (progress["tests"], "testDate")]:
            dates = [row[key] for row in rows]
            self.assertEqual(dates, sorted(dates, reverse=True))
            self.assertTrue(all(student.enrolled_on.isoformat() <= day <= "2026-11-02" for day in dates))

        student.status = "withdrawn"
        student.withdrawn_on = date(2026, 9, 10)
        student.save(update_fields=["status", "withdrawn_on"])
        record = self.get_record().json()
        self.assertEqual(record["info"]["status"], "withdrawn")
        self.assertTrue(all(row["weekStart"] <= "2026-09-10" for row in record["progress"]["attendance"]))
        self.assertTrue(all(row["testDate"] <= "2026-09-10" for row in record["progress"]["tests"]))

    def test_database_only_student_and_empty_history_work_without_fixtures(self):
        self.sign_in()
        source = Student.objects.get(code="STU-0587")
        student = Student.objects.create(code="STU-9998", full_name="Synthetic new student",
                                         batch=source.batch, enrolled_on=date(2026, 11, 2))
        guardian = Guardian.objects.create(phone="+919000009998", full_name="Synthetic guardian", language="en")
        GuardianStudent.objects.create(student=student, guardian=guardian, is_primary=True)
        record = self.get_record(student.code).json()
        self.assertEqual(record["info"]["code"], "STU-9998")
        self.assertEqual(record["info"]["course"]["instalments"], 0)
        self.assertEqual(record["progress"], {"attendance": [], "tests": []})

    def test_accounts_centre_and_role_scope(self):
        accounts = self.sign_in("accounts.mlv@demo.test")
        self.assertEqual(self.get_record().status_code, 200)
        other = Student.objects.exclude(batch__centre_id=accounts.centre_id).first()
        self.assertEqual(self.get_record(other.code).status_code, 403)
        self.sign_in("counsellor@demo.test")
        self.assertEqual(self.get_record().status_code, 403)
        user = StaffUser.objects.get(email="accounts@demo.test")
        user.role = "admin"
        user.save(update_fields=["role"])
        self.sign_in()
        self.assertEqual(self.get_record().status_code, 403)
        session = self.client.session
        session["subject_type"] = "guardian"
        session["subject_id"] = str(Guardian.objects.get(phone="+919000000587").pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        self.assertEqual(self.get_record().status_code, 403)

    def test_auth_internal_key_query_and_archive_boundaries(self):
        self.assertEqual(self.get_record().status_code, 401)
        self.sign_in()
        self.assertEqual(self.client.get("/api/student_record", {"student": "STU-0587"}).status_code, 403)
        self.assertEqual(self.get_record("not-a-code").status_code, 400)
        self.assertEqual(self.get_record("STU-9999").status_code, 404)
        self.assertEqual(self.client.post("/api/student_record", HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 405)
        Student.objects.filter(code="STU-0587").update(archived_at=timezone.now())
        self.assertEqual(self.get_record().status_code, 404)
