import io
import os
from datetime import date, timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from fees import models as m
from fees.seed import at_day
from fees.services.risk import assess_students, run_risk_job, task_facts
from fees.services.demo import reset_demo


class RiskJobTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        env = patch.dict(os.environ, {"DEMO_MODE": "true", "CRON_SECRET": "test-cron"})
        env.start()
        self.addCleanup(env.stop)

    def test_named_results_and_repeat_job_does_not_duplicate_open_tasks(self):
        date_ = date(2026, 11, 2)
        result = run_risk_job(date_)
        self.assertEqual(result["scored"], 209)
        riya = m.RiskFlag.objects.get(student__code="STU-0733", computed_on=date_)
        self.assertEqual(riya.band, "high")
        self.assertEqual(m.CounsellorTask.objects.filter(student__code="STU-0733", status="open").count(), 1)
        arjun = m.RiskFlag.objects.get(student__code="STU-0734", computed_on=date_)
        self.assertEqual(arjun.band, "watch")
        self.assertFalse(m.CounsellorTask.objects.filter(student__code="STU-0734").exists())
        neha = m.RiskFlag.objects.get(student__code="STU-0735", computed_on=date_)
        self.assertEqual((neha.band, neha.score), ("insufficient", None))
        self.assertFalse(m.RiskFlag.objects.filter(student__code="STU-0587").exists())
        self.assertFalse(m.RiskFlag.objects.filter(student__status="withdrawn", computed_on=date_).exists())
        count, audits = m.CounsellorTask.objects.count(), m.AuditLog.objects.filter(action="risk_task_created").count()
        self.assertEqual(run_risk_job(date_)["tasksCreated"], 0)
        self.assertEqual((m.CounsellorTask.objects.count(), m.AuditLog.objects.filter(action="risk_task_created").count()), (count, audits))
        self.assertTrue(all(type(value) is int for key, value in riya.features.items()))

    def test_false_flag_suppression_and_frozen_task_trigger_facts(self):
        date_ = date(2026, 11, 2)
        run_risk_job(date_)
        task = m.CounsellorTask.objects.select_related("flag").get(student__code="STU-0733", status="open")
        facts = task_facts(task)
        task.status, task.closed_at, task.note = "false_flag", at_day(date_), "Synthetic false flag outcome"
        task.save(update_fields=["status", "closed_at", "note"])
        self.assertEqual(run_risk_job(date_)["tasksCreated"], 0)
        self.assertFalse(m.CounsellorTask.objects.filter(student=task.student, status="open").exists())
        # A same-day feature refresh cannot rewrite the reasons used for the closed call.
        m.AttendanceWeekly.objects.filter(student=task.student).update(attended=6)
        run_risk_job(date_)
        task.refresh_from_db()
        self.assertEqual(task_facts(task), facts)
        self.assertFalse(m.CounsellorTask.objects.filter(student=task.student, status="open").exists())

    def test_inputs_use_only_latest_valid_windows_and_current_scope(self):
        student = m.Student.objects.get(code="STU-0733")
        m.AttendanceWeekly.objects.create(student=student, week_start=date(2026, 11, 9), attended=0, held=6)
        m.TestScore.objects.create(student=student, test_date=date(2026, 11, 9), test_name="Future synthetic", score=0, max_score=100)
        m.TestScore.objects.create(student=student, test_date=date(2026, 11, 1), test_name="Invalid synthetic", score=1, max_score=0)
        scores = assess_students(date(2026, 11, 2), student.batch.centre_id)
        row = next(row for row in scores if row.student.pk == student.pk)
        self.assertEqual((row.attendance_weeks, row.test_count), (8, 5))
        self.assertEqual(row.result.band, "high")
        self.assertTrue(all(item.student.batch.centre_id == student.batch.centre_id for item in scores))
        m.Student.objects.filter(pk=student.pk).update(archived_at=at_day(date(2026, 11, 2)))
        self.assertNotIn(student.pk, [row.student.pk for row in assess_students(date(2026, 11, 2))])

    def test_cron_secret_and_method(self):
        self.assertEqual(self.client.get("/api/cron/risk").status_code, 401)
        self.assertEqual(self.client.get("/api/cron/risk", HTTP_AUTHORIZATION="Bearer wrong").status_code, 401)
        self.assertEqual(self.client.post("/api/cron/risk", HTTP_AUTHORIZATION="Bearer test-cron").status_code, 405)
        response = self.client.get("/api/cron/risk", HTTP_AUTHORIZATION="Bearer test-cron")
        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.json()["scored"], 0)

    def test_future_false_flag_does_not_suppress_today(self):
        date_ = date(2026, 11, 2)
        task = m.CounsellorTask.objects.get(student__code="STU-0733", status="open")
        task.status, task.closed_at = "false_flag", at_day(date_ + timedelta(days=1))
        task.save(update_fields=["status", "closed_at"])
        run_risk_job(date_)
        self.assertTrue(m.CounsellorTask.objects.filter(student=task.student, status="open").exists())

    def test_reset_reused_task_id_gets_new_facts_and_preserves_old_audit(self):
        date_ = date(2026, 11, 2)
        run_risk_job(date_)
        task = m.CounsellorTask.objects.get(student__code="STU-0733", status="open")
        old = m.AuditLog.objects.get(entity_id=task.pk, action="risk_task_created")
        old.after = {"score": 90, "reasons": ["Historical trigger retained"], "features": {"oldestOverdueDays": 90}}
        old.save(update_fields=["after"])
        reset_demo(actor=m.StaffUser.objects.get(email="accounts@demo.test"))
        fresh = m.CounsellorTask.objects.select_related("flag").get(student__code="STU-0733", status="open")
        self.assertEqual(fresh.pk, task.pk)
        self.assertGreater(fresh.created_at, old.created_at)
        self.assertEqual(task_facts(fresh)["score"], 80)
        run_risk_job(date_)
        fresh.refresh_from_db()
        current = task_facts(fresh)
        self.assertEqual(current["score"], fresh.score)
        self.assertNotEqual(current["score"], 90)
        self.assertNotIn("Historical trigger retained", current["reasons"])
        self.assertEqual(m.AuditLog.objects.filter(entity_id=fresh.pk, action="risk_task_created",
                                                   created_at__gte=fresh.created_at).count(), 1)
        old.refresh_from_db()
        self.assertEqual(old.after["score"], 90)
