import io
import os
from datetime import date
from unittest.mock import patch

from django.core.management import call_command
from django.db import OperationalError
from django.test import TestCase

from fees import models as m
from fees.seed import seed_id
from fees.seed_data import DEMO_TODAY, NAMED_CODES
from fees.services.demo import reset_demo
from fees.services.payments import process_payment_event, resolve_unmatched_payment


class DemoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        patcher = patch.dict(os.environ, {"DEMO_MODE": "true", "INTERNAL_API_SECRET": "test-internal-key",
                                         "CRON_SECRET": "test-cron-key"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def sign_in(self, email="accounts@demo.test"):
        user = m.StaffUser.objects.get(email=email)
        session = self.client.session
        session["subject_type"] = "staff"
        session["subject_id"] = str(user.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        return user

    def post(self, name, data=None):
        return self.client.post(f"/api/{name}", data or {}, content_type="application/json",
                                HTTP_X_INTERNAL_KEY="test-internal-key")

    def get(self, name):
        return self.client.get(f"/api/{name}", HTTP_X_INTERNAL_KEY="test-internal-key")

    def test_stop_on_payment_replay_and_reset(self):
        self.sign_in()
        ishita = m.Instalment.objects.get(plan__student__code="STU-0587", seq=3)
        mohit = m.Instalment.objects.get(plan__student__code="STU-0219", seq=3)
        ledger = self.get("ledger?student=STU-0587").json()
        line = next(row for row in ledger["timeline"] if row["instalmentId"] == str(ishita.pk))
        self.assertEqual(line["next"], {"step": 30, "on": "2026-11-09"})
        ledger = self.get("ledger?student=STU-0219").json()
        line = next(row for row in ledger["timeline"] if row["instalmentId"] == str(mohit.pk))
        self.assertEqual(line["next"], {"step": -7, "on": "2026-11-08"})

        self.assertEqual(self.post("counter_payment", {
            "student": "STU-0587", "amount_paise": 1500000, "method": "cash", "received_on": "2026-11-02",
        }).status_code, 200)
        ledger = self.get("ledger?student=STU-0587").json()
        line = next(row for row in ledger["timeline"] if row["instalmentId"] == str(ishita.pk))
        self.assertEqual(line["stopped"], "paid 2 Nov")
        self.assertEqual(self.post("set_demo_date", {"date": "2026-11-09"}).json(), {"ok": True, "date": "2026-11-09"})
        self.assertEqual(self.get("me").json()["today"], "2026-11-09")
        self.assertGreater(self.post("run_reminders_now").json()["sent"], 0)
        reminder = m.ReminderLog.objects.get(instalment=mohit, step=-7)
        self.assertEqual((reminder.language, reminder.sent_on, reminder.amount_paise), ("hi", date(2026, 11, 9), 4000000))
        self.assertFalse(m.ReminderLog.objects.filter(instalment=ishita, step=30).exists())
        self.assertEqual(self.post("run_reminders_now").json()["sent"], 0)

        self.assertEqual(self.post("reset_demo").json(), {"ok": True, "reset": True, "date": "2026-11-02"})
        self.assertEqual(m.InstalmentBalance.objects.get(pk=ishita.pk).balance_paise, 1500000)
        self.assertFalse(m.ReminderLog.objects.filter(instalment=mohit).exists())
        self.assertEqual(m.AppSetting.objects.get(pk="demo_today").value, DEMO_TODAY.isoformat())

    def test_reset_preserves_non_named_rows_audit_history_masters_and_receipt_sequence(self):
        actor = self.sign_in()
        codes = [f"STU-{number:04d}" for number in NAMED_CODES]
        outside = m.Student.objects.exclude(code__in=codes).first()
        other_queue = m.UnmatchedPayment.objects.create(
            reference="outside-unlinked-demo-review", amount_paise=100, reason="unknown_reference", received_on=DEMO_TODAY,
        )
        models = [m.Student, m.Guardian, m.GuardianStudent, m.FeePlan, m.Instalment, m.AttendanceWeekly, m.TestScore]
        masters = {model: set(model.objects.values_list("pk", flat=True)) for model in models}
        payments = list(m.Payment.objects.filter(student=outside).order_by("pk").values())
        receipts = list(m.Receipt.objects.filter(payment__student=outside).order_by("pk").values())
        old_numbers = set(m.Receipt.objects.filter(payment__student__code__in=codes).values_list("number", flat=True))
        audit_ids = set(m.AuditLog.objects.values_list("pk", flat=True))
        counters = dict(m.ReceiptCounter.objects.values_list("pk", "next_seq"))
        reset_demo(actor=actor)
        self.assertEqual({model: set(model.objects.values_list("pk", flat=True)) for model in models}, masters)
        self.assertEqual(list(m.Payment.objects.filter(student=outside).order_by("pk").values()), payments)
        self.assertEqual(list(m.Receipt.objects.filter(payment__student=outside).order_by("pk").values()), receipts)
        self.assertTrue(m.UnmatchedPayment.objects.filter(pk=other_queue.pk).exists())
        self.assertTrue(audit_ids.issubset(set(m.AuditLog.objects.values_list("pk", flat=True))))
        self.assertTrue(old_numbers.isdisjoint(m.Receipt.objects.filter(payment__student__code__in=codes).values_list("number", flat=True)))
        self.assertTrue(all(m.ReceiptCounter.objects.get(pk=pk).next_seq >= number for pk, number in counters.items()))
        self.assertEqual(m.AuditLog.objects.get(action="reset_demo").actor_id, actor.pk)

    def test_reset_clears_only_named_gateway_attempts(self):
        self.sign_in()
        instalment = m.Instalment.objects.get(plan__student__code="STU-0587", seq=3)
        process_payment_event(event_id="demo-reset-failed", reference=str(instalment.pk), amount_paise=1500000,
                              status="failed", paid_on=DEMO_TODAY)
        process_payment_event(event_id="unrelated-failed", reference="unknown-outside", amount_paise=100,
                              status="failed", paid_on=DEMO_TODAY)
        self.assertEqual(self.post("reset_demo").status_code, 200)
        self.assertFalse(m.PaymentEvent.objects.filter(pk="demo-reset-failed").exists())
        self.assertTrue(m.PaymentEvent.objects.filter(pk="unrelated-failed").exists())

    def test_seeded_review_matched_to_another_student_keeps_its_financial_history(self):
        actor = self.sign_in()
        codes = [f"STU-{number:04d}" for number in NAMED_CODES]
        item = m.UnmatchedPayment.objects.get(pk=seed_id("queue/1"))
        target = m.InstalmentBalance.objects.exclude(student__code__in=codes).filter(
            balance_paise__gte=item.amount_paise, student__status="active",
        ).first()
        result = resolve_unmatched_payment(
            unmatched_id=item.pk, action="match", instalment_id=target.pk, resolved_by=actor,
        )
        event = m.PaymentEvent.objects.get(pk=item.event_id)
        reset_demo(actor=actor)
        item.refresh_from_db()
        event.refresh_from_db()
        self.assertEqual(item.status, "matched")
        self.assertEqual(item.payment_id, event.payment_id)
        self.assertEqual(str(item.payment_id), result["paymentId"])
        self.assertTrue(m.Receipt.objects.filter(pk=result["receiptId"], payment_id=result["paymentId"]).exists())

    def test_reset_is_atomic_when_restoration_fails(self):
        self.sign_in()
        payments = list(m.Payment.objects.order_by("pk").values())
        receipts = list(m.Receipt.objects.order_by("pk").values())
        with patch("fees.services.demo.seed_named", side_effect=[0, RuntimeError("test restoration failure")]):
            with self.assertRaisesMessage(RuntimeError, "test restoration failure"):
                reset_demo()
        self.assertEqual(list(m.Payment.objects.order_by("pk").values()), payments)
        self.assertEqual(list(m.Receipt.objects.order_by("pk").values()), receipts)

    def test_controls_reject_unauthenticated_scoped_and_wrong_role_sessions(self):
        for name in ["set_demo_date", "run_reminders_now", "reset_demo"]:
            self.assertEqual(self.post(name, {"date": "2026-11-09"}).status_code, 401)
        for email in ["accounts.mlv@demo.test", "counsellor@demo.test"]:
            self.sign_in(email)
            for name in ["set_demo_date", "run_reminders_now", "reset_demo"]:
                self.assertEqual(self.post(name, {"date": "2026-11-09"}).status_code, 403)
        self.sign_in("accounts.mlv@demo.test")
        self.assertFalse(self.get("automation?list=unmatched").json()["demo"])

    def test_mode_internal_key_form_and_cron_boundaries(self):
        self.sign_in()
        self.assertEqual(self.client.post("/api/reset_demo").status_code, 403)
        self.assertEqual(self.get("reset_demo").status_code, 405)
        self.assertEqual(self.post("set_demo_date", {"date": "2026-02-30"}).status_code, 400)
        for authorization in [None, "Bearer wrong"]:
            headers = {"HTTP_AUTHORIZATION": authorization} if authorization else {}
            self.assertEqual(self.client.get("/api/cron/demo-reset", **headers).status_code, 401)
        with patch.dict(os.environ, {"DEMO_MODE": "false"}):
            for name in ["set_demo_date", "run_reminders_now", "reset_demo"]:
                self.assertEqual(self.post(name, {"date": "2026-11-09"}).status_code, 403)
            self.assertEqual(self.client.get("/api/cron/demo-reset", HTTP_AUTHORIZATION="Bearer test-cron-key").status_code, 403)
            with self.assertRaisesMessage(ValueError, "DEMO_MODE=true"):
                reset_demo()
        self.assertEqual(self.client.get("/api/cron/demo-reset", HTTP_AUTHORIZATION="Bearer test-cron-key").status_code, 200)

    def test_busy_reset_returns_retryable_error(self):
        self.sign_in()
        with patch("fees.views.demo.restore_demo", side_effect=OperationalError("row is locked")):
            self.assertEqual(self.post("reset_demo").status_code, 409)
