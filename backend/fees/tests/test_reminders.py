import io
import os
from datetime import date
from unittest.mock import patch

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from fees.models import Instalment, ReminderLog, UnmatchedPayment
from fees.seed_data import DEMO_TODAY
from fees.services.payments import allocate_and_issue_receipt, process_payment_event
from fees.services.reminders import send_due_reminders


class ReminderServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        patcher = patch.dict(os.environ, {"DEMO_MODE": "true"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def instalment(self, code, seq=1):
        return Instalment.objects.select_related("plan__student").get(plan__student__code=code, seq=seq)

    def test_sends_latest_step_in_primary_guardian_language_and_is_idempotent(self):
        result = send_due_reminders(date(2026, 11, 9))
        mohit = ReminderLog.objects.get(instalment=self.instalment("STU-0219", 3), step=-7)
        ishita = ReminderLog.objects.get(instalment=self.instalment("STU-0587", 3), step=30)

        self.assertEqual((mohit.language, mohit.amount_paise, mohit.sent_on), ("hi", 4000000, date(2026, 11, 9)))
        self.assertEqual((ishita.language, ishita.amount_paise), ("en", 1500000))
        self.assertGreater(result["sent"], 0)
        self.assertEqual(send_due_reminders(date(2026, 11, 9))["sent"], 0)

    def test_part_payment_reminds_with_current_balance(self):
        instalment = self.instalment("STU-0219", 3)
        allocate_and_issue_receipt(
            student=instalment.plan.student, allocations=[(instalment, 1000000)],
            method="upi", received_on=DEMO_TODAY,
        )

        send_due_reminders(date(2026, 11, 9))

        reminder = ReminderLog.objects.get(instalment=instalment, step=-7)
        self.assertEqual(reminder.amount_paise, 3000000)

    def test_paid_instalment_and_open_payment_review_do_not_send(self):
        ishita = self.instalment("STU-0587", 3)
        process_payment_event(
            event_id="reminder-stop-paid", reference=str(ishita.pk), amount_paise=1500000,
            status="success", paid_on=date(2026, 11, 9),
        )
        mohit = self.instalment("STU-0219", 3)
        UnmatchedPayment.objects.create(
            event_id="reminder-stop-review", reference=str(mohit.pk), amount_paise=100000,
            reason="amount_mismatch", suggested_instalment=mohit, received_on=DEMO_TODAY,
        )

        send_due_reminders(date(2026, 11, 9))

        self.assertFalse(ReminderLog.objects.filter(instalment=ishita, step=30).exists())
        self.assertFalse(ReminderLog.objects.filter(instalment=mohit, step=-7).exists())


class ReminderCronTests(SimpleTestCase):
    def setUp(self):
        patcher = patch.dict(os.environ, {"CRON_SECRET": "test-cron-secret"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_requires_bearer_secret_and_get(self):
        url = "/api/cron/reminders"
        self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(self.client.get(url, HTTP_AUTHORIZATION="Bearer wrong").status_code, 401)
        with patch.dict(os.environ, {"CRON_SECRET": ""}):
            self.assertEqual(self.client.get(url, HTTP_AUTHORIZATION="Bearer test-cron-secret").status_code, 401)
        self.assertEqual(self.client.post(url, HTTP_AUTHORIZATION="Bearer test-cron-secret").status_code, 405)

    @patch("fees.views.cron.today", return_value=date(2026, 11, 9))
    @patch("fees.views.cron.send_due_reminders", return_value={"sent": 2, "skipped": 1})
    def test_calls_service_and_returns_counts(self, send, get_today):
        response = self.client.get("/api/cron/reminders", HTTP_AUTHORIZATION="Bearer test-cron-secret")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True, "sent": 2, "skipped": 1})
        send.assert_called_once_with(date(2026, 11, 9))
