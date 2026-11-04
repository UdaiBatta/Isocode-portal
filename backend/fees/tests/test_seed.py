import hashlib
import io
from collections import Counter
from datetime import date
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db.models import Q, Sum
from django.test import SimpleTestCase, TestCase

from fees import models as m
from fees.domain.ledger import instalment_view, over60_metric
from fees.seed import at_day, database_over60_metric, seed_named
from fees.seed_data import DEMO_TODAY, NAMED_CODES, build_fleet, build_named


class SeedRowsTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fleet = build_fleet()
        cls.named = build_named()

    def test_full_rows_are_deterministic_and_cover_all_codes(self):
        self.assertEqual(build_fleet(), self.fleet)
        self.assertEqual(build_named(), self.named)
        rows = self.fleet + self.named
        self.assertEqual(len(rows), 2600)
        self.assertEqual({row.code for row in rows}, {f"STU-{n:04d}" for n in range(1, 2601)})
        counts = Counter((row.centre, row.batch_name) for row in self.fleet)
        self.assertEqual(len(counts), 16)
        self.assertLessEqual(max(counts.values()) - min(counts.values()), 1)
        self.assertEqual(len(build_fleet(small=True)), 200)

    def test_brief_sample_rows(self):
        rows = {row.code: row for row in self.named}
        for code, name, phone, language, amount, paid, due, status, part, balance, overdue, due_in in [
            ("STU-0412", "Aarav Meena", "+919000000412", "hi", 3000000, 3000000, date(2026, 10, 10), "paid", False, 0, 0, 0),
            ("STU-0587", "Ishita Sharma", "+919000000587", "en", 3000000, 1500000, date(2026, 10, 10), "overdue", True, 1500000, 23, 0),
            ("STU-0219", "Mohit Gurjar", "+919000000219", "hi", 4000000, 0, date(2026, 11, 15), "upcoming", False, 4000000, 0, 13),
        ]:
            with self.subTest(code=code):
                row = rows[code]
                self.assertEqual((row.name, row.phone, row.language), (name, phone, language))
                item = row.instalments[2]
                self.assertEqual((item.amount_paise, sum(value for value, _ in item.allocations), item.due_date), (amount, paid, due))
                view = instalment_view(amount, paid, due, DEMO_TODAY)
                self.assertEqual((view.status, view.part_paid, view.balance, view.days_overdue, view.due_in_days),
                                 (status, part, balance, overdue, due_in))
        self.assertEqual(sum(a for i in rows["STU-0412"].instalments for a, _ in i.allocations), 9000000)
        self.assertEqual(sum(a for i in rows["STU-0587"].instalments for a, _ in i.allocations), 7500000)
        self.assertEqual(sum(a for i in rows["STU-0219"].instalments for a, _ in i.allocations), 8000000)
        self.assertEqual(rows["STU-0771"].phone, rows["STU-0772"].phone)
        self.assertEqual(rows["STU-0771"].phone, "+919000000777")

    def test_late_baseline_and_plan_reconciliation(self):
        metric = over60_metric((item for row in self.fleet + self.named for item in row.instalments), DEMO_TODAY)
        self.assertGreaterEqual(metric.pct, 11)
        self.assertLessEqual(metric.pct, 13)
        for row in self.fleet + self.named:
            self.assertEqual(sum(item.amount_paise for item in row.instalments), 12000000 - row.discount)
            for item in row.instalments:
                self.assertLessEqual(sum(a for a, _ in item.allocations), item.amount_paise)
                self.assertTrue(all(received <= DEMO_TODAY for _, received in item.allocations))

    def test_academic_history_and_synthetic_mix(self):
        established = next(row for row in self.fleet if row.enrolled_on == date(2026, 4, 1))
        self.assertEqual(len(established.attendance), 30)
        self.assertEqual((established.attendance[0][0], established.attendance[-1][0]),
                         (date(2026, 4, 6), date(2026, 10, 26)))
        self.assertEqual(len(established.tests), 7)
        self.assertEqual(sum(row.enrolled_on == date(2026, 10, 20) for row in self.fleet), 30)
        discounted = sum(row.discount > 0 for row in self.fleet)
        self.assertTrue(12 * len(self.fleet) <= discounted * 100 <= 18 * len(self.fleet))
        self.assertTrue(65 * len(self.fleet) <= sum(row.language == "hi" for row in self.fleet) * 100 <= 75 * len(self.fleet))


class SeedDatabaseTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def test_small_insertion_and_named_states(self):
        self.assertEqual(m.Student.objects.count(), 212)
        self.assertEqual(m.Centre.objects.count(), 4)
        self.assertEqual(m.Batch.objects.count(), 16)
        self.assertEqual(m.FeePlan.objects.count(), 212)
        self.assertEqual(m.UnmatchedPayment.objects.count(), 6)
        self.assertEqual(m.CounsellorTask.objects.filter(status="open", student__code="STU-0733").count(), 1)
        self.assertEqual(m.CounsellorTask.objects.filter(status="called").count(), 8)
        self.assertEqual(m.CounsellorTask.objects.filter(status="false_flag").count(), 3)
        self.assertEqual(m.Refund.objects.filter(status="draft").count(), 1)
        self.assertEqual(m.Refund.objects.filter(status="approved").count(), 2)
        self.assertEqual(m.Refund.objects.filter(status="paid").count(), 1)
        approved = m.Refund.objects.get(student__code="STU-0802")
        self.assertEqual(approved.deadline, date(2026, 11, 7))
        self.assertEqual(approved.student.status, "withdrawn")
        late = m.Refund.objects.get(student__code="STU-0803")
        self.assertEqual(late.deadline, date(2026, 10, 25))
        named_codes = [f"STU-{n:04d}" for n in NAMED_CODES]
        self.assertFalse(m.Consent.objects.filter(student__code__in=named_codes).exists())
        self.assertEqual(m.Consent.objects.count(), 200)
        self.assertFalse(m.Consent.objects.filter(otp_challenge__consumed_at__isnull=True).exists())
        self.assertEqual(m.AppSetting.objects.get(pk="demo_today").value, "2026-11-02")
        self.assertEqual(list(m.ReminderLog.objects.filter(instalment__plan__student__code="STU-0587").order_by("step").values_list("step", "sent_on")),
                         [(-7, date(2026, 10, 3)), (-3, date(2026, 10, 7)), (0, date(2026, 10, 10)),
                          (3, date(2026, 10, 13)), (7, date(2026, 10, 17)), (15, date(2026, 10, 25))])
        self.assertFalse(m.ReminderLog.objects.filter(instalment__plan__student__code="STU-0219").exists())

    def test_database_balances_and_gst_reconcile_with_seed_rows(self):
        for row in build_named():
            balances = m.InstalmentBalance.objects.filter(student__code=row.code).order_by("seq")
            self.assertEqual([(b.amount_paise, b.paid_paise, b.balance_paise) for b in balances],
                             [(i.amount_paise, sum(a for a, _ in i.allocations), i.amount_paise - sum(a for a, _ in i.allocations)) for i in row.instalments])
        totals = m.Receipt.objects.aggregate(taxable=Sum("taxable_paise"), cgst=Sum("cgst_paise"), sgst=Sum("sgst_paise"), total=Sum("total_paise"))
        self.assertEqual(totals["taxable"] + totals["cgst"] + totals["sgst"], totals["total"])
        self.assertEqual(m.Payment.objects.count(), m.Receipt.objects.count())
        expected = over60_metric((i for r in build_fleet(small=True) + build_named() for i in r.instalments), DEMO_TODAY)
        self.assertEqual(database_over60_metric(), expected)
        self.assertEqual(m.AuditLog.objects.filter(action="seed_payment").count(), m.Payment.objects.count())

    def test_rerun_is_noop_for_seed_records(self):
        def fingerprint():
            digest = hashlib.sha256()
            for model in [m.Student, m.Guardian, m.GuardianStudent, m.FeePlan, m.Instalment, m.Payment,
                          m.Allocation, m.Receipt, m.ReceiptCounter, m.Consent, m.ReminderLog,
                          m.Refund, m.AttendanceWeekly, m.TestScore, m.RiskFlag, m.CounsellorTask,
                          m.UnmatchedPayment, m.PaymentEvent, m.AuditLog]:
                digest.update(repr(list(model.objects.order_by(model._meta.pk.name).values())).encode())
            return digest.hexdigest()
        before = fingerprint()
        output = io.StringIO()
        call_command("seed", small=True, stdout=output)
        self.assertIn("0 inserted", output.getvalue())
        self.assertEqual(fingerprint(), before)

    def test_named_reset_restores_history_without_replacing_master_records(self):
        rows = build_named()
        codes = [row.code for row in rows]
        masters = [m.Student, m.Guardian, m.GuardianStudent, m.FeePlan, m.Instalment,
                   m.AttendanceWeekly, m.TestScore]
        ids_before = {model: set(model.objects.values_list("pk", flat=True)) for model in masters}
        audit_ids = set(m.AuditLog.objects.values_list("pk", flat=True))
        counters_before = dict(m.ReceiptCounter.objects.values_list("pk", "next_seq"))
        self.assertTrue(m.PaymentEvent.objects.filter(payment__student__code="STU-0412").exists())
        ishita = m.Student.objects.get(code="STU-0587")
        challenge = m.OtpChallenge.objects.create(phone="+919000000587", code_hash="test-consumed",
                                                   expires_at=at_day(DEMO_TODAY), consumed_at=at_day(DEMO_TODAY))
        m.Consent.objects.create(student=ishita, guardian=m.Guardian.objects.get(phone=challenge.phone),
                                  wording_version="v1", language="en", otp_challenge=challenge,
                                  granted_at=at_day(DEMO_TODAY))
        m.Student.objects.filter(code__in=codes).update(status="withdrawn", withdrawn_on=date(2026, 11, 1))
        m.FeePlan.objects.filter(student=ishita).update(gross_paise=12100000, net_paise=12100000)
        m.Instalment.objects.filter(plan__student=ishita, seq=3).update(amount_paise=3100000)
        queue_ids = list(m.UnmatchedPayment.objects.values_list("pk", flat=True))
        # Event FKs protect payments and queue rows, so reset clears these dependent records first.
        m.PaymentEvent.objects.filter(Q(payment__student__code__in=codes) | Q(unmatched_id__in=queue_ids)).delete()
        m.UnmatchedPayment.objects.filter(pk__in=queue_ids).delete()
        m.CounsellorTask.objects.filter(student__code__in=codes).delete()
        m.RiskFlag.objects.filter(student__code__in=codes).delete()
        m.Refund.objects.filter(student__code__in=codes).delete()
        m.Allocation.objects.filter(payment__student__code__in=codes).delete()
        m.Receipt.objects.filter(payment__student__code__in=codes).delete()
        m.Payment.objects.filter(student__code__in=codes).delete()
        m.ReminderLog.objects.filter(instalment__plan__student__code__in=codes).delete()
        m.Consent.objects.filter(student__code__in=codes).delete()
        seed_named()
        self.assertEqual({model: set(model.objects.values_list("pk", flat=True)) for model in masters}, ids_before)
        self.assertTrue(audit_ids.issubset(set(m.AuditLog.objects.values_list("pk", flat=True))))
        for row in rows:
            student = m.Student.objects.get(code=row.code)
            withdrawn = row.refund_status in ["approved", "paid"]
            self.assertEqual((student.status, student.withdrawn_on),
                             ("withdrawn" if withdrawn else "active", row.withdrawal_date if withdrawn else None))
            self.assertEqual(student.feeplan.net_paise, 12000000)
            self.assertEqual(list(m.InstalmentBalance.objects.filter(student=student).order_by("seq").values_list("amount_paise", "paid_paise")),
                             [(item.amount_paise, sum(a for a, _ in item.allocations)) for item in row.instalments])
        self.test_small_insertion_and_named_states()
        self.assertTrue(m.PaymentEvent.objects.filter(payment__student__code="STU-0412", result="allocated").exists())
        kavya = m.UnmatchedPayment.objects.get(reason="amount_mismatch")
        self.assertEqual(kavya.suggested_instalment.plan.student.code, "STU-0771")
        self.assertTrue(m.PaymentEvent.objects.filter(unmatched=kavya, result="queued").exists())
        counters_after = dict(m.ReceiptCounter.objects.values_list("pk", "next_seq"))
        self.assertTrue(all(counters_after[pk] >= value for pk, value in counters_before.items()))
        self.assertNotEqual(counters_after, counters_before)
        receipts = list(m.Receipt.objects.order_by("pk").values())
        audits_after = set(m.AuditLog.objects.values_list("pk", flat=True))
        seed_named()
        self.assertEqual(list(m.Receipt.objects.order_by("pk").values()), receipts)
        self.assertEqual(set(m.AuditLog.objects.values_list("pk", flat=True)), audits_after)
        self.assertEqual(dict(m.ReceiptCounter.objects.values_list("pk", "next_seq")), counters_after)

    def test_plain_rerun_preserves_user_mutations(self):
        m.Student.objects.filter(code="STU-0412").update(full_name="Corrected demo name", status="withdrawn")
        m.FeePlan.objects.filter(student__code="STU-0412").update(discount_paise=100000, net_paise=11900000,
                                                                 discount_reason="Demo correction")
        m.UnmatchedPayment.objects.filter(reason="amount_mismatch").update(status="rejected", resolution_note="Demo rejection")
        m.CounsellorTask.objects.filter(student__code="STU-0733").update(status="called")
        call_command("seed", small=True, stdout=io.StringIO())
        aarav = m.Student.objects.get(code="STU-0412")
        self.assertEqual((aarav.full_name, aarav.status, aarav.feeplan.discount_paise),
                         ("Corrected demo name", "withdrawn", 100000))
        self.assertEqual(m.UnmatchedPayment.objects.get(reason="amount_mismatch").status, "rejected")
        self.assertEqual(m.CounsellorTask.objects.get(student__code="STU-0733").status, "called")

    @patch.dict("os.environ", {"DEMO_MODE": "false"})
    def test_seed_refuses_non_demo_environment(self):
        with self.assertRaisesMessage(CommandError, "DEMO_MODE=true"):
            call_command("seed", small=True, stdout=io.StringIO())
