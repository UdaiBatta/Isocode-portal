import io
import os
from datetime import date
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from fees.domain.ledger import instalment_view
from fees.domain.pay_token import unsign_pay_token
from fees.models import AppSetting, Instalment, StaffUser, Student, UnmatchedPayment
from fees.seed_data import DEMO_TODAY, build_named
from fees.services.reminders import send_due_reminders


class LedgerTests(TestCase):
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

    def get_ledger(self, code, key="test-internal-key"):
        headers = {"HTTP_X_INTERNAL_KEY": key} if key is not None else {}
        return self.client.get(f"/api/ledger?student={code}", **headers)

    def test_each_named_s2_ledger_matches_seed_data(self):
        self.sign_in()
        for source in build_named():
            with self.subTest(student=source.code):
                response = self.get_ledger(source.code)
                self.assertEqual(response.status_code, 200)
                data = response.json()
                paid = sum(amount for instalment in source.instalments for amount, _ in instalment.allocations)
                self.assertEqual(data["student"]["name"], source.name)
                self.assertEqual(data["student"]["status"], "withdrawn" if source.refund_status in ("approved", "paid") else "active")
                self.assertEqual(data["student"]["batch"], source.batch_name)
                self.assertEqual(data["student"]["centre"], "Malviya Nagar")
                self.assertEqual(data["plan"], {
                    "gross": 12000000, "discount": source.discount,
                    "discountReason": source.discount_reason, "net": 12000000 - source.discount,
                    "paid": paid, "balance": 12000000 - source.discount - paid,
                })
                self.assertEqual(data["guardianPhone"], source.phone)
                self.assertEqual(len(data["instalments"]), len(source.instalments))
                for seq, (actual, expected) in enumerate(zip(data["instalments"], source.instalments, strict=True), 1):
                    expected_paid = sum(amount for amount, _ in expected.allocations)
                    view = instalment_view(expected.amount_paise, expected_paid, expected.due_date, DEMO_TODAY)
                    self.assertEqual(
                        (actual["seq"], actual["dueDate"], actual["amount"], actual["paid"], actual["balance"],
                         actual["status"], actual["partPaid"], actual["daysOverdue"], actual["dueInDays"]),
                        (seq, expected.due_date.isoformat(), expected.amount_paise, expected_paid,
                         view.balance, view.status, view.part_paid, view.days_overdue, view.due_in_days),
                    )
                    self.assertEqual(bool(actual["payUrl"]), bool(view.balance and data["student"]["status"] == "active"))
                    if actual["payUrl"]:
                        self.assertEqual(unsign_pay_token(actual["payUrl"].removeprefix("/pay/")), actual["id"])
                self.assertEqual(sum(payment["amount"] for payment in data["payments"]), paid)
                self.assertTrue(all(payment["receiptId"] for payment in data["payments"]))
                self.assertEqual([line["instalmentId"] for line in data["timeline"]], [row["id"] for row in data["instalments"]])
                self.assertTrue(all(set(line) == {"instalmentId", "sent", "next", "stopped"} for line in data["timeline"]))
                if source.refund_status:
                    self.assertEqual(data["refund"]["status"], source.refund_status)

    def test_timeline_shows_real_sent_next_and_stopped_states(self):
        self.sign_in()
        ishita = self.get_ledger("STU-0587").json()
        ishita_row = next(row for row in ishita["instalments"] if row["seq"] == 3)
        ishita_line = next(line for line in ishita["timeline"] if line["instalmentId"] == ishita_row["id"])
        self.assertEqual([row["step"] for row in ishita_line["sent"]], [-7, -3, 0, 3, 7, 15])
        self.assertEqual(ishita_line["next"], {"step": 30, "on": "2026-11-09"})

        mohit = Instalment.objects.get(plan__student__code="STU-0219", seq=3)
        initial = self.get_ledger("STU-0219").json()
        initial_line = next(line for line in initial["timeline"] if line["instalmentId"] == str(mohit.pk))
        self.assertEqual(initial_line["next"], {"step": -7, "on": "2026-11-08"})
        send_due_reminders(date(2026, 11, 9))
        AppSetting.objects.filter(pk="demo_today").update(value="2026-11-09")

        response = self.get_ledger("STU-0219").json()
        mohit_line = next(line for line in response["timeline"] if line["instalmentId"] == str(mohit.pk))
        self.assertEqual(mohit_line["sent"], [{"step": -7, "on": "2026-11-09", "language": "hi"}])
        self.assertEqual(mohit_line["next"], {"step": -3, "on": "2026-11-12"})

        payment = self.client.post("/api/counter_payment", {
            "student": "STU-0219", "amount_paise": 12000000, "method": "cash",
            "received_on": "2026-11-09", "note": "settle demo balance",
        }, content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key")
        self.assertEqual(payment.status_code, 200)
        response = self.get_ledger("STU-0219").json()
        paid_line = next(line for line in response["timeline"] if line["instalmentId"] == str(mohit.pk))
        self.assertEqual(paid_line["stopped"], "paid 9 Nov")

    def test_timeline_shows_payment_review_stop_reason(self):
        self.sign_in()
        instalment = Instalment.objects.get(plan__student__code="STU-0219", seq=3)
        UnmatchedPayment.objects.create(
            reference=str(instalment.pk), amount_paise=100000, reason="amount_mismatch",
            suggested_instalment=instalment, received_on=DEMO_TODAY,
        )

        response = self.get_ledger("STU-0219").json()
        line = next(line for line in response["timeline"] if line["instalmentId"] == str(instalment.pk))
        self.assertIsNone(line["next"])
        self.assertEqual(line["stopped"], "payment being checked")

    def test_single_centre_accounts_and_role_scope(self):
        mlv = self.sign_in("accounts.mlv@demo.test")
        self.assertEqual(self.get_ledger("STU-0412").status_code, 200)
        outside = Student.objects.exclude(batch__centre_id=mlv.centre_id).first()
        self.assertIsNotNone(outside)
        self.assertEqual(self.get_ledger(outside.code).status_code, 403)

        self.sign_in("counsellor@demo.test")
        self.assertEqual(self.get_ledger("STU-0412").status_code, 403)

    def test_login_and_student_query_are_required(self):
        self.assertEqual(self.get_ledger("STU-0412").status_code, 401)
        self.sign_in()
        self.assertEqual(self.get_ledger("STU-0001", key=None).status_code, 403)
        self.assertEqual(self.get_ledger("not-a-student").status_code, 400)
        self.assertEqual(self.get_ledger("STU-9999").status_code, 404)
