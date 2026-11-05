import io
import os
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from fees.domain.ledger import instalment_view
from fees.domain.pay_token import unsign_pay_token
from fees.models import StaffUser, Student
from fees.seed_data import DEMO_TODAY, build_named


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
                self.assertEqual(data["timeline"], [])
                if source.refund_status:
                    self.assertEqual(data["refund"]["status"], source.refund_status)

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
