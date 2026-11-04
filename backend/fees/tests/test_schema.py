from datetime import date

from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase

from fees.models import (
    Allocation, Batch, Centre, CounsellorTask, FeePlan, Instalment,
    InstalmentBalance, Payment, RefundPolicy, ReminderLog, RiskFlag,
    StaffUser, Student,
)


class SchemaTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.today = date(2026, 11, 2)
        cls.centre = Centre.objects.create(code="TEST", name="Test centre")
        cls.batch = Batch.objects.create(
            centre=cls.centre, name="Test batch", stream="JEE",
            session_start=date(2026, 4, 1), session_end=date(2027, 3, 31),
        )
        cls.student = Student.objects.create(
            code="TEST-001", full_name="Fictional student", batch=cls.batch,
            enrolled_on=date(2026, 4, 1),
        )
        cls.policy = RefundPolicy.objects.create(
            version="test", effective_from=date(2026, 4, 1),
            text_en="Test policy", text_hi="Test policy",
        )
        cls.plan = FeePlan.objects.create(
            student=cls.student, gross_paise=3000000, net_paise=3000000,
            refund_policy=cls.policy,
        )
        cls.instalment = Instalment.objects.create(
            plan=cls.plan, seq=1, due_date=cls.today, amount_paise=3000000,
        )

    def test_bad_fee_plan_rejected_by_database(self):
        for values in [
            {"net_paise": 2999999},
            {"discount_paise": -1, "net_paise": 3000001},
        ]:
            with self.subTest(values=values):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    FeePlan.objects.filter(pk=self.plan.pk).update(**values)

    def test_duplicate_reminder_key_rejected_by_database(self):
        values = dict(
            instalment=self.instalment, step=7, language="hi",
            amount_paise=3000000, sent_on=self.today,
        )
        ReminderLog.objects.create(**values)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ReminderLog.objects.create(**values)

    def test_only_one_open_counsellor_task_per_student(self):
        flag = RiskFlag.objects.create(
            student=self.student, computed_on=self.today, score=80,
            band="high", reasons=[], features={},
        )
        values = dict(flag=flag, student=self.student, score=80, created_on=self.today)
        task = CounsellorTask.objects.create(**values)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CounsellorTask.objects.create(**values)
        task.status = "called"
        task.save(update_fields=["status"])
        CounsellorTask.objects.create(**values)

    def test_balance_view_aggregates_allocations_without_storing_balance(self):
        self.assertEqual(InstalmentBalance.objects.get(pk=self.instalment.pk).paid_paise, 0)
        for amount in [1000000, 500000]:
            payment = Payment.objects.create(
                student=self.student, amount_paise=amount, method="cash",
                received_on=self.today,
            )
            Allocation.objects.create(payment=payment, instalment=self.instalment, amount_paise=amount)
        balance = InstalmentBalance.objects.get(pk=self.instalment.pk)
        self.assertEqual((balance.paid_paise, balance.balance_paise), (1500000, 1500000))
        self.assertEqual((balance.student_id, balance.batch_id, balance.centre_id),
                         (self.student.pk, self.batch.pk, self.centre.pk))

    def test_admin_role_and_financial_record_protection(self):
        admin = StaffUser.objects.create(
            email="admin@demo.test", full_name="Fictional admin", password_hash="!", role="admin",
        )
        self.assertEqual(StaffUser.objects.get(pk=admin.pk).role, "admin")
        with self.assertRaises(IntegrityError), transaction.atomic():
            StaffUser.objects.filter(pk=admin.pk).update(role="unknown")
        with self.assertRaises(ProtectedError):
            self.student.delete()
