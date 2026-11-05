import io
import json
import os
from datetime import date
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from fees.models import Allocation, AuditLog, Batch, FeePlan, Instalment, Payment, Receipt, RefundPolicy, StaffUser, Student, UnmatchedPayment
from fees.services.payments import CounterPaymentError, record_counter_payment


class CounterPaymentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())
        cls.accounts = StaffUser.objects.get(email="accounts.mlv@demo.test")
        cls.student = Student.objects.create(
            code="STU-9998", full_name="Demo Counter Student",
            batch=Batch.objects.get(centre__code="MLV", name="JEE 2027 Morning"), enrolled_on=date(2026, 4, 1),
        )
        cls.plan = FeePlan.objects.create(
            student=cls.student, gross_paise=7500000, discount_paise=0, net_paise=7500000,
            refund_policy=RefundPolicy.objects.get(version="v1"),
        )
        Instalment.objects.bulk_create([
            Instalment(plan=cls.plan, seq=seq, due_date=date(2026, month, 10), amount_paise=amount)
            for seq, (month, amount) in enumerate([(4, 1500000), (7, 3000000), (10, 3000000)], 1)
        ])

    def setUp(self):
        patcher = patch.dict(os.environ, {"INTERNAL_API_SECRET": "test-internal-key", "DEMO_MODE": "true"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def sign_in(self, email="accounts.mlv@demo.test"):
        user = StaffUser.objects.get(email=email)
        session = self.client.session
        session["subject_type"] = "staff"
        session["subject_id"] = str(user.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key

    def record(self, amount_paise, *, received_on=date(2026, 11, 2), method="cash", note="Desk payment"):
        return record_counter_payment(
            student_code=self.student.code, amount_paise=amount_paise, method=method,
            received_on=received_on, note=note, recorded_by=self.accounts,
        )

    def test_allocates_fifty_thousand_oldest_first_and_issues_one_receipt(self):
        payment, receipt, excess = self.record(5000000)
        self.assertEqual(excess, 0)
        self.assertEqual(payment.amount_paise, 5000000)
        self.assertEqual(payment.note, "Desk payment")
        self.assertEqual(receipt.total_paise, 5000000)
        self.assertEqual(
            list(Allocation.objects.filter(payment=payment).order_by("instalment__seq").values_list("instalment__seq", "amount_paise")),
            [(1, 1500000), (2, 3000000), (3, 500000)],
        )
        self.assertEqual(Receipt.objects.filter(payment=payment).count(), 1)
        self.assertTrue(AuditLog.objects.filter(entity_id=payment.pk, action="payment_allocated").exists())

    def test_excess_goes_to_queue_and_is_audited(self):
        payment, receipt, excess = self.record(10000000)
        queued = UnmatchedPayment.objects.get(reason="excess_counter_payment", suggested_instalment__plan=self.plan)
        self.assertEqual((payment.amount_paise, receipt.total_paise, excess), (7500000, 7500000, 2500000))
        self.assertEqual((queued.amount_paise, queued.status, queued.suggested_instalment_id), (2500000, "open", Instalment.objects.get(plan=self.plan, seq=1).pk))
        self.assertTrue(AuditLog.objects.filter(entity_id=queued.pk, action="counter_payment_excess_queued").exists())

    def test_fully_paid_student_queues_the_full_amount_without_a_zero_receipt(self):
        self.record(7500000)
        payment, receipt, excess = self.record(100000)
        self.assertIsNone(payment)
        self.assertIsNone(receipt)
        self.assertEqual(excess, 100000)
        self.assertFalse(Receipt.objects.filter(payment__student=self.student, total_paise=0).exists())
        self.assertEqual(UnmatchedPayment.objects.get(reason="excess_counter_payment", suggested_instalment__plan=self.plan).amount_paise, 100000)

    def test_future_and_withdrawn_payments_are_rejected_without_money_rows(self):
        with self.assertRaises(CounterPaymentError) as future:
            self.record(100000, received_on=date(2026, 11, 3))
        self.assertEqual(future.exception.code, "invalid_date")
        Student.objects.filter(pk=self.student.pk).update(status="withdrawn")
        with self.assertRaises(CounterPaymentError) as withdrawn:
            self.record(100000)
        self.assertEqual(withdrawn.exception.code, "withdrawn")
        self.assertFalse(Payment.objects.filter(student=self.student).exists())

    def test_api_validates_auth_roles_centre_and_payload(self):
        body = {"student": self.student.code, "amount_paise": 5000000, "method": "cash", "received_on": "2026-11-02", "note": ""}
        url = "/api/counter_payment"
        self.assertEqual(self.client.post(url, json.dumps(body), content_type="application/json").status_code, 403)
        self.sign_in()
        self.assertEqual(self.client.post(url, json.dumps({**body, "amount_paise": 1.5}), content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 400)
        self.assertEqual(self.client.post(url, json.dumps({**body, "received_on": "2026-11-03"}), content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key").json()["code"], "invalid_date")
        outside = Student.objects.get(code="STU-0002")
        self.assertEqual(self.client.post(url, json.dumps({**body, "student": outside.code}), content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 403)
        response = self.client.post(url, json.dumps(body), content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["receiptId"])
        self.assertTrue(response.json()["receiptNumber"].startswith("MLV/2026-27/"))
        self.sign_in("counsellor@demo.test")
        self.assertEqual(self.client.post(url, json.dumps(body), content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key").status_code, 403)
