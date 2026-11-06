import io
import os
from datetime import date, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from fees import models as m
from fees.services.risk import run_risk_job


class CounsellorTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())
        run_risk_job(date(2026, 11, 2))

    def setUp(self):
        env = patch.dict(os.environ, {"DEMO_MODE": "true", "INTERNAL_API_SECRET": "test-key", "ANTHROPIC_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)
        self.sign_in("counsellor@demo.test")

    def sign_in(self, email):
        user = m.StaffUser.objects.get(email=email)
        session = self.client.session
        session["subject_type"], session["subject_id"] = "staff", str(user.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        return user

    def get(self, path="counsellor"):
        return self.client.get(f"/api/{path}", HTTP_X_INTERNAL_KEY="test-key")

    def post(self, path, values):
        return self.client.post(f"/api/{path}", values, content_type="application/json", HTTP_X_INTERNAL_KEY="test-key")

    def riya_task(self):
        return m.CounsellorTask.objects.get(student__code="STU-0733", status="open")

    def test_screen_contract_named_lists_and_no_financial_amounts(self):
        response = self.get()
        self.assertEqual(response.status_code, 200)
        view = response.json()
        self.assertEqual(set(view), {"ok", "accuracy", "open", "closed", "watch", "unknown"})
        self.assertEqual(view["accuracy"], {"genuine": 8, "total": 11})
        riya = next(row for row in view["open"] if row["studentCode"] == "STU-0733")
        self.assertEqual((riya["guardianPhone"], riya["band"], riya["briefSource"]), ("+919000000733", "high", "template"))
        self.assertGreaterEqual(riya["score"], 60)
        self.assertIn("STU-0734", [row["studentCode"] for row in view["watch"]])
        self.assertIn("STU-0735", [row["studentCode"] for row in view["unknown"]])
        self.assertNotIn("STU-0587", [row["studentCode"] for key in ("open", "watch", "unknown") for row in view[key]])
        self.assertNotIn("₹", response.content.decode())

        def check(value):
            if isinstance(value, dict):
                self.assertFalse(set(value) & {"amount", "balance", "paid", "gross", "net", "amountPaise", "features"})
                for child in value.values():
                    check(child)
            elif isinstance(value, list):
                for child in value:
                    check(child)
        check(view)

    def test_false_flag_needs_note_changes_accuracy_and_suppresses_recreation(self):
        task = self.riya_task()
        values = {"taskId": str(task.pk), "outcome": "false_flag", "note": "   "}
        self.assertEqual(self.post("close_task", values).json()["code"], "note_required")
        values["note"] = "Synthetic review: the family confirmed continued study."
        with patch("fees.services.risk.timezone.localtime", return_value=datetime(2026, 11, 2, 1, tzinfo=ZoneInfo("Asia/Kolkata"))):
            self.assertEqual(self.post("close_task", values).status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.closed_at.date(), date(2026, 11, 1))
        self.assertEqual((task.status, timezone.localdate(task.closed_at), task.closed_by.email),
                         ("false_flag", date(2026, 11, 2), "counsellor@demo.test"))
        self.assertEqual(self.get().json()["accuracy"], {"genuine": 8, "total": 12})
        self.assertEqual(self.post("close_task", values).status_code, 409)
        run_risk_job(date(2026, 11, 2))
        self.assertFalse(m.CounsellorTask.objects.filter(student=task.student, status="open").exists())
        self.assertTrue(m.AuditLog.objects.filter(entity_id=task.pk, action="risk_task_closed").exists())

    def test_called_is_genuine_and_template_brief_is_cached(self):
        task = self.riya_task()
        first = self.post("ensure_call_brief", {"taskId": str(task.pk)})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["briefSource"], "template")
        self.assertEqual(self.post("ensure_call_brief", {"taskId": str(task.pk)}).json(), first.json())
        task.refresh_from_db()
        self.assertEqual(task.brief, first.json()["brief"])
        self.assertEqual(self.post("close_task", {"taskId": str(task.pk), "outcome": "called", "note": ""}).status_code, 200)
        self.assertEqual(self.get().json()["accuracy"], {"genuine": 9, "total": 12})

    def test_roles_internal_key_and_centre_scope(self):
        task = self.riya_task()
        self.assertEqual(self.client.get("/api/counsellor").status_code, 403)
        for email in ("accounts@demo.test", "admin@demo.test"):
            self.sign_in(email)
            self.assertEqual(self.get().status_code, 403)
            self.assertEqual(self.post("ensure_call_brief", {"taskId": str(task.pk)}).status_code, 403)
            self.assertEqual(self.post("close_task", {"taskId": str(task.pk), "outcome": "called"}).status_code, 403)
        session = self.client.session
        session["subject_type"], session["subject_id"] = "guardian", str(m.Guardian.objects.first().pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        self.assertEqual(self.get().status_code, 403)
        centre = m.Centre.objects.get(code="VSH")
        m.StaffUser.objects.create(full_name="Fictional VSH counsellor", email="scoped@demo.test", password_hash="unused",
                                    role="counsellor", centre=centre)
        self.sign_in("scoped@demo.test")
        view = self.get().json()
        allowed = set(m.Student.objects.filter(batch__centre=centre).values_list("code", flat=True))
        self.assertTrue(all(row["studentCode"] in allowed for key in ("open", "closed", "watch", "unknown") for row in view[key]))
        self.assertEqual(self.post("ensure_call_brief", {"taskId": str(task.pk)}).status_code, 403)
        self.assertEqual(self.post("close_task", {"taskId": str(task.pk), "outcome": "called"}).status_code, 403)

    def test_watch_reads_refresh_after_payment_without_financial_writes_from_risk(self):
        self.assertIn("STU-0734", [row["studentCode"] for row in self.get().json()["watch"]])
        self.sign_in("accounts@demo.test")
        response = self.post("counter_payment", {"student": "STU-0734", "amount_paise": 12000000,
                                                   "method": "cash", "received_on": "2026-11-02"})
        self.assertEqual(response.status_code, 200)
        self.sign_in("counsellor@demo.test")
        self.assertNotIn("STU-0734", [row["studentCode"] for row in self.get().json()["watch"]])

    def test_invalid_inputs_and_inactive_open_task(self):
        task = self.riya_task()
        self.assertEqual(self.post("ensure_call_brief", {"taskId": "not-a-uuid"}).status_code, 400)
        self.assertEqual(self.post("close_task", {"taskId": str(task.pk), "outcome": "unknown"}).status_code, 400)
        self.assertEqual(self.post("close_task", {"taskId": str(task.pk), "outcome": "called", "note": "x" * 301}).status_code, 400)
        m.Student.objects.filter(pk=task.student_id).update(status="withdrawn", withdrawn_on=date(2026, 11, 2))
        self.assertEqual(self.post("close_task", {"taskId": str(task.pk), "outcome": "called"}).status_code, 409)
        self.assertNotIn("STU-0733", [row["studentCode"] for row in self.get().json()["open"]])
