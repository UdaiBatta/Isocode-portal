import io
import os
from unittest.mock import patch

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from fees.domain.matching import decide_payment
from fees.models import Allocation, AuditLog, Instalment, InstalmentBalance, Payment, Receipt, UnmatchedPayment
from fees.seed_data import DEMO_TODAY
from fees.services.payments import process_payment_event


class PaymentRuleTests(SimpleTestCase):
    def test_b8_8_decision_order(self):
        cases = [
            (("failed", False, False, 0, 100), {"action": "none", "result": "failed"}),
            (("pending", False, False, 0, 100), {"action": "none", "result": "pending"}),
            (("success", False, False, 0, 100), {"action": "queue", "reason": "unknown_reference"}),
            (("success", True, False, 100, 100), {"action": "queue", "reason": "student_withdrawn"}),
            (("success", True, True, 0, 100), {"action": "queue", "reason": "already_paid"}),
            (("success", True, True, 100, 99), {"action": "queue", "reason": "amount_mismatch"}),
            (("success", True, True, 100, 100), {"action": "allocate"}),
        ]
        for arguments, expected in cases:
            with self.subTest(arguments=arguments):
                self.assertEqual(decide_payment(*arguments), expected)


class PaymentServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        patcher = patch.dict(os.environ, {"DEMO_MODE": "true"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def event(self, event_id, reference, amount, status="success"):
        return process_payment_event(
            event_id=event_id, reference=reference, amount_paise=amount,
            status=status, paid_on=DEMO_TODAY,
        )

    def test_allocates_receipt_gst_audit_and_is_idempotent(self):
        instalment = Instalment.objects.get(plan__student__code="STU-0587", seq=3)
        event = self.event("event-ishita-1", str(instalment.pk), 1500000)
        self.assertEqual(event.result, "allocated")
        payment = Payment.objects.get(event_id=event.event_id)
        receipt = Receipt.objects.get(payment=payment)
        self.assertEqual((payment.amount_paise, payment.method, payment.received_on), (1500000, "gateway", DEMO_TODAY))
        self.assertEqual((receipt.taxable_paise, receipt.cgst_paise, receipt.sgst_paise, receipt.total_paise),
                         (1271186, 114407, 114407, 1500000))
        self.assertRegex(receipt.number, r"^MLV/2026-27/[0-9]{6}$")
        self.assertEqual(Allocation.objects.filter(payment=payment).values_list("amount_paise", flat=True).get(), 1500000)
        self.assertEqual(InstalmentBalance.objects.get(pk=instalment.pk).balance_paise, 0)
        self.assertEqual(AuditLog.objects.get(entity_id=payment.pk, action="payment_allocated").after["receipt_number"], receipt.number)

        counts = (Payment.objects.count(), Allocation.objects.count(), Receipt.objects.count(), AuditLog.objects.count())
        replay = self.event("event-ishita-1", str(instalment.pk), 999, status="success")
        self.assertEqual(replay.result, "allocated")
        self.assertEqual((Payment.objects.count(), Allocation.objects.count(), Receipt.objects.count(), AuditLog.objects.count()), counts)

    def test_non_allocating_decisions_only_queue_when_required(self):
        paid = Instalment.objects.get(plan__student__code="STU-0412", seq=1)
        withdrawn = Instalment.objects.get(plan__student__code="STU-0802", seq=4)
        part_paid = Instalment.objects.get(plan__student__code="STU-0587", seq=3)
        cases = [
            ("failed-event", str(part_paid.pk), 1, "failed", "failed", None),
            ("pending-event", str(part_paid.pk), 1, "pending", "pending", None),
            ("unknown-event", "bad-reference", 1, "success", "queued", "unknown_reference"),
            ("withdrawn-event", str(withdrawn.pk), 3000000, "success", "queued", "student_withdrawn"),
            ("paid-event", str(paid.pk), 3000000, "success", "queued", "already_paid"),
            ("mismatch-event", str(part_paid.pk), 1499000, "success", "queued", "amount_mismatch"),
        ]
        before = (Payment.objects.count(), Allocation.objects.count(), Receipt.objects.count())
        for event_id, reference, amount, status, expected_result, expected_reason in cases:
            with self.subTest(event=event_id):
                event = self.event(event_id, reference, amount, status)
                self.assertEqual(event.result, expected_result)
                unmatched = UnmatchedPayment.objects.filter(event_id=event_id).first()
                if expected_reason:
                    self.assertIsNotNone(unmatched)
                    self.assertEqual(unmatched.reason, expected_reason)
                    self.assertEqual(unmatched.status, "open")
                else:
                    self.assertIsNone(unmatched)
        self.assertEqual((Payment.objects.count(), Allocation.objects.count(), Receipt.objects.count()), before)

    def test_receipt_numbers_remain_unique_across_twenty_payments(self):
        rows = list(InstalmentBalance.objects.filter(
            student__status="active", balance_paise__gt=0,
        ).order_by("due_date", "seq")[:20])
        self.assertEqual(len(rows), 20)
        for index, row in enumerate(rows):
            with self.subTest(index=index):
                event = self.event(f"sequence-event-{index}", str(row.pk), row.balance_paise)
                self.assertEqual(event.result, "allocated")
        receipts = Receipt.objects.filter(payment__event_id__startswith="sequence-event-")
        self.assertEqual(receipts.count(), 20)
        self.assertEqual(receipts.values("number").distinct().count(), 20)
