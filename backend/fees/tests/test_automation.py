import io
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.core.management import call_command
from django.db import close_old_connections
from django.db.models import Q
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from fees.models import (Allocation, AuditLog, Instalment, InstalmentBalance, Payment, PaymentEvent,
                         Receipt, ReminderLog, StaffUser, UnmatchedPayment)
from fees.seed_data import DEMO_TODAY
from fees.services.payments import UnmatchedPaymentError, resolve_unmatched_payment


class AutomationViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        patcher = patch.dict(os.environ, {"DEMO_MODE": "true", "INTERNAL_API_SECRET": "test-internal-key"})
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

    def get(self, name):
        return self.client.get(f"/api/{name}", HTTP_X_INTERNAL_KEY="test-internal-key")

    def post(self, name, body):
        return self.client.post(f"/api/{name}", body, content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key")

    def create_queue_item(self, *, instalment=None, amount=100000, event_id=None):
        item = UnmatchedPayment.objects.create(
            event_id=event_id, reference="DEMO-REVIEW", amount_paise=amount,
            reason="amount_mismatch" if instalment else "unknown_reference",
            suggested_instalment=instalment, received_on=DEMO_TODAY,
        )
        if event_id:
            PaymentEvent.objects.create(
                event_id=event_id, payload={"method": "upi"}, result="queued", unmatched=item,
                received_at=timezone.now(),
            )
        return item

    def test_automation_and_candidates_use_seeded_django_rows(self):
        self.sign_in()
        sent_first = self.get("automation?list=sent").json()
        sent = sent_first["sent"] + [
            row for page in range(2, sent_first["totalPages"] + 1)
            for row in self.get(f"automation?list=sent&page={page}").json()["sent"]
        ]
        upcoming_first = self.get("automation?list=upcoming").json()
        upcoming = upcoming_first["upcoming"] + [
            row for page in range(2, upcoming_first["totalPages"] + 1)
            for row in self.get(f"automation?list=upcoming&page={page}").json()["upcoming"]
        ]
        ishita = next(row for row in sent if row["instalmentId"] == "STU-0587-3" and row["step"] == 15)
        mohit = next(row for row in upcoming if row["instalmentId"] == "STU-0219-3")
        self.assertEqual((ishita["language"], ishita["amount"], ishita["on"]), ("en", 1500000, "2026-10-25"))
        self.assertEqual((mohit["step"], mohit["on"], mohit["language"], mohit["amount"]),
                         (-7, "2026-11-08", "hi", 4000000))
        candidates = self.get("payment_candidates").json()["candidates"]
        kavya = next(row for row in candidates if row["code"] == "STU-0771")
        self.assertEqual([row["seq"] for row in kavya["instalments"]], [3, 4])
        self.assertTrue(all(row["balance"] > 0 for row in kavya["instalments"]))

    def test_single_centre_scope_applies_to_candidates_and_known_queue_items(self):
        staff = self.sign_in("accounts.mlv@demo.test")
        outside = Instalment.objects.filter(plan__student__batch__centre__code="VSH", plan__student__status="active").first()
        item = self.create_queue_item(instalment=outside)

        candidates = self.get("payment_candidates").json()["candidates"]
        data = self.get("automation?list=unmatched").json()

        self.assertTrue(all(row["code"] != outside.plan.student.code for row in candidates))
        self.assertNotIn(str(item.pk), [row["id"] for row in data["unmatched"]])
        self.assertEqual(data["unmatchedOpen"], sum(row["status"] == "open" for row in data["unmatched"]))
        counts = self.get("automation_counts").json()
        self.assertEqual(counts["unmatchedOpen"], UnmatchedPayment.objects.filter(status="open").filter(
            Q(suggested_instalment__isnull=True) |
            Q(suggested_instalment__plan__student__batch__centre_id=staff.centre_id),
        ).count())
        self.assertEqual(counts["needsCall"], InstalmentBalance.objects.filter(
            centre_id=staff.centre_id, student__archived_at__isnull=True, balance_paise__gt=0,
            due_date__lt=DEMO_TODAY - timedelta(days=30),
        ).count())

    def test_automation_counts_are_accounts_only_and_return_only_counts(self):
        self.assertEqual(self.get("automation_counts").status_code, 401)
        self.sign_in()
        response = self.get("automation_counts")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(set(data), {"ok", "unmatchedOpen", "needsCall"})
        self.assertEqual(data["unmatchedOpen"], UnmatchedPayment.objects.filter(status="open").count())
        self.assertEqual(data["needsCall"], InstalmentBalance.objects.filter(
            student__archived_at__isnull=True, balance_paise__gt=0,
            due_date__lt=DEMO_TODAY - timedelta(days=30),
        ).count())
        self.sign_in("counsellor@demo.test")
        self.assertEqual(self.get("automation_counts").status_code, 403)

    def test_automation_lists_are_server_paged_and_focus_opens_the_queue_item(self):
        self.sign_in()
        items = [self.create_queue_item() for _ in range(27)]
        first = self.get("automation?list=unmatched&page=1").json()
        second = self.get("automation?list=unmatched&page=2").json()
        self.assertEqual((first["page"], first["pageSize"], first["totalPages"]), (1, 25, 2))
        self.assertEqual((len(first["unmatched"]), second["page"], len(second["unmatched"])), (25, 2, first["total"] - 25))
        self.assertEqual(len({row["id"] for row in first["unmatched"] + second["unmatched"]}), first["total"])
        focused = self.get(f"automation?list=unmatched&focus={items[0].pk}").json()
        self.assertEqual(focused["page"], 2)
        self.assertIn(str(items[0].pk), [row["id"] for row in focused["unmatched"]])
        self.assertEqual(self.get("automation?list=invalid").status_code, 400)
        self.assertEqual(self.get("automation?list=unmatched&page=0").status_code, 400)

    def test_sent_reminders_are_server_paged(self):
        self.sign_in()
        ReminderLog.objects.all().delete()
        instalments = Instalment.objects.filter(plan__student__archived_at__isnull=True).order_by("pk")[:27]
        ReminderLog.objects.bulk_create([
            ReminderLog(instalment=row, step=1000 + index, language="en", amount_paise=100,
                        sent_on=DEMO_TODAY)
            for index, row in enumerate(instalments)
        ])

        first = self.get("automation?list=sent&page=1").json()
        second = self.get("automation?list=sent&page=2").json()

        self.assertEqual((first["page"], first["pageSize"], first["total"], first["totalPages"]), (1, 25, 27, 2))
        self.assertEqual((len(first["sent"]), second["page"], len(second["sent"])), (25, 2, 2))

    def test_match_allocates_oldest_first_creates_receipt_and_rejects_replay(self):
        staff = self.sign_in()
        instalment = Instalment.objects.select_related("plan__student").get(plan__student__code="STU-0587", seq=3)
        item = self.create_queue_item(instalment=instalment, amount=4500000, event_id="review-match-event")
        body = {"id": str(item.pk), "action": "match", "instalmentId": str(instalment.pk), "note": "Bank transfer verified"}

        response = self.post("resolve_unmatched", body)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["receiptNumber"].startswith("MLV/2026-27/"))
        payment = Payment.objects.get(pk=response.json()["paymentId"])
        receipt = Receipt.objects.get(payment=payment)
        self.assertEqual((payment.amount_paise, payment.method, receipt.total_paise), (4500000, "upi", 4500000))
        self.assertEqual(list(Allocation.objects.filter(payment=payment).order_by("instalment__seq").values_list(
            "instalment__seq", "amount_paise",
        )), [(3, 1500000), (4, 3000000)])
        item.refresh_from_db()
        self.assertEqual((item.status, item.resolved_by_id, item.resolution_note, item.payment_id),
                         ("matched", staff.pk, "Bank transfer verified", payment.pk))
        event = PaymentEvent.objects.get(pk="review-match-event")
        self.assertEqual((event.result, event.payment_id), ("allocated", payment.pk))
        self.assertEqual(AuditLog.objects.filter(entity_id=item.pk, action="unmatched_payment_matched").count(), 1)
        self.assertEqual(self.post("resolve_unmatched", body).status_code, 409)
        self.assertEqual(Payment.objects.filter(event_id="review-match-event").count(), 1)

        row = next(row for row in self.get("automation?list=unmatched").json()["unmatched"] if row["id"] == str(item.pk))
        self.assertEqual(row["resolvedBy"], staff.full_name)

    def test_match_above_remaining_balance_is_rejected_without_writes(self):
        self.sign_in()
        instalment = Instalment.objects.get(plan__student__code="STU-0587", seq=3)
        item = self.create_queue_item(instalment=instalment, amount=5000000, event_id="review-excess-event")

        response = self.post("resolve_unmatched", {
            "id": str(item.pk), "action": "match", "instalmentId": str(instalment.pk),
        })

        self.assertEqual((response.status_code, response.json()["code"]), (400, "excess"))
        item.refresh_from_db()
        self.assertEqual(item.status, "open")
        self.assertFalse(Payment.objects.filter(event_id="review-excess-event").exists())
        self.assertFalse(Receipt.objects.filter(payment__event_id="review-excess-event").exists())

    def test_reject_requires_reason_and_records_resolver(self):
        staff = self.sign_in()
        item = self.create_queue_item()
        body = {"id": str(item.pk), "action": "reject"}
        self.assertEqual(self.post("resolve_unmatched", body).status_code, 400)

        response = self.post("resolve_unmatched", {**body, "note": "Duplicate bank reference"})

        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual((item.status, item.resolved_by_id, item.resolution_note),
                         ("rejected", staff.pk, "Duplicate bank reference"))

    def test_unknown_queue_item_can_only_be_matched_inside_staff_centre(self):
        self.sign_in("accounts.mlv@demo.test")
        item = self.create_queue_item()
        outside = Instalment.objects.filter(
            plan__student__batch__centre__code="VSH", plan__student__status="active",
        ).first()

        response = self.post("resolve_unmatched", {
            "id": str(item.pk), "action": "match", "instalmentId": str(outside.pk),
        })

        self.assertEqual((response.status_code, response.json()["code"]), (403, "forbidden"))
        item.refresh_from_db()
        self.assertEqual(item.status, "open")


class ConcurrentResolutionTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        call_command("seed", small=True, stdout=io.StringIO())
        self.env = patch.dict(os.environ, {"DEMO_MODE": "true"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.staff = StaffUser.objects.get(email="accounts@demo.test")
        instalment = Instalment.objects.get(plan__student__code="STU-0587", seq=3)
        self.item = UnmatchedPayment.objects.create(
            event_id="concurrent-resolution-event", reference="CONCURRENT", amount_paise=1000000, reason="amount_mismatch",
            suggested_instalment=instalment, received_on=DEMO_TODAY,
        )

    def test_only_one_concurrent_resolution_allocates(self):
        barrier = Barrier(2)

        def resolve():
            close_old_connections()
            try:
                staff = StaffUser.objects.get(pk=self.staff.pk)
                instalment = Instalment.objects.get(plan__student__code="STU-0587", seq=3)
                barrier.wait(timeout=5)
                try:
                    resolve_unmatched_payment(
                        unmatched_id=self.item.pk, action="match", instalment_id=instalment.pk,
                        resolved_by=staff,
                    )
                    return "matched"
                except UnmatchedPaymentError as exc:
                    return exc.code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = sorted(pool.map(lambda _: resolve(), range(2)))

        self.assertEqual(results, ["matched", "resolved"])
        self.assertEqual(Payment.objects.filter(event_id="concurrent-resolution-event").count(), 1)
        self.assertEqual(Receipt.objects.filter(payment__event_id="concurrent-resolution-event").count(), 1)
