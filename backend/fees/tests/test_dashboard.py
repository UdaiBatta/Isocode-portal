import io
import os
from datetime import date, timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from fees import models as m
from fees.seed_data import NAMED_CODES


class DashboardTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())
        cls.centre = m.Centre.objects.create(code="ZZZ", name="Fictional test centre")
        cls.batch = m.Batch.objects.create(centre=cls.centre, name="JEE 2027 Morning", stream="JEE",
                                          session_start=date(2026, 4, 1), session_end=date(2027, 3, 31))

    def setUp(self):
        env = patch.dict(os.environ, {"DEMO_MODE": "true", "INTERNAL_API_SECRET": "test-key"})
        env.start()
        self.addCleanup(env.stop)
        self.sign_in()

    def sign_in(self, email="accounts@demo.test", kind="staff"):
        user = m.StaffUser.objects.get(email=email) if kind == "staff" else m.Guardian.objects.first()
        session = self.client.session
        session["subject_type"], session["subject_id"] = kind, str(user.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key

    def get(self, path):
        return self.client.get(f"/api/{path}", HTTP_X_INTERNAL_KEY="test-key")

    def create_due(self, index, days, paid=0, paid_days=None):
        student = m.Student.objects.create(code=f"STU-{9000 + index}", full_name=f"Fictional example {index}",
                                           batch=self.batch, enrolled_on=date(2026, 4, 1))
        plan = m.FeePlan.objects.create(student=student, gross_paise=10000, net_paise=10000,
                                        refund_policy=m.RefundPolicy.objects.first())
        due = date(2026, 11, 2) - timedelta(days=days)
        instalment = m.Instalment.objects.create(plan=plan, seq=1, due_date=due, amount_paise=10000)
        if paid:
            payment = m.Payment.objects.create(student=student, amount_paise=paid, method="cash",
                                               received_on=due + timedelta(days=paid_days or 0))
            m.Allocation.objects.create(payment=payment, instalment=instalment, amount_paise=paid)
        return student

    def test_every_ageing_boundary_is_hand_counted(self):
        for index, days in enumerate((-1, 0, 1, 30, 31, 60, 61, 90, 91)):
            self.create_due(index, days, paid=4000 if days == 61 else 0)
        view = self.get("dashboard?centre=ZZZ").json()
        row = view["rows"][0]
        self.assertEqual({key: row[key] for key in ("outstanding", "notDue", "d1_30", "d31_60", "d61_90", "d90p")},
                         {"outstanding": 86000, "notDue": 20000, "d1_30": 20000, "d31_60": 20000, "d61_90": 16000, "d90p": 10000})
        self.assertEqual((row["studentsWithDues"], view["totals"]["overdue"]), (9, 66000))
        batches = self.get("dashboard?centre=ZZZ&group=batch").json()["rows"]
        self.assertEqual(batches, row["children"])

    def test_historical_metric_keeps_late_payments_and_excludes_future_receipts(self):
        for index, (days, paid, delay) in enumerate(((100, 0, 0), (100, 10000, 10), (100, 10000, 70),
                                                    (30, 0, 0), (90, 4000, 5), (-29, 0, 0))):
            self.create_due(index, days, paid, delay)
        self.assertEqual(self.get("dashboard?centre=ZZZ").json()["totals"]["over60Pct"], 52)
        future = m.Payment.objects.create(student=m.Student.objects.get(code="STU-9000"), amount_paise=10000,
                                           received_on=date(2026, 11, 3), method="bank")
        m.Allocation.objects.create(payment=future, instalment=m.Instalment.objects.get(plan__student=future.student), amount_paise=10000)
        self.assertEqual(self.get("dashboard?centre=ZZZ").json()["totals"]["over60Pct"], 52)

    def test_named_rows_match_ledger_and_aggregate_totals(self):
        active_total = 0
        codes = [f"STU-{number:04d}" for number in NAMED_CODES]
        for code in codes:
            row = self.get(f"students?q={code}").json()["rows"][0]
            ledger = self.get(f"ledger?student={code}").json()
            self.assertEqual(row["balance"], ledger["plan"]["balance"])
            self.assertEqual(row["daysOverdue"], max(item["daysOverdue"] for item in ledger["instalments"]))
            unpaid = next((item for item in ledger["instalments"] if item["balance"]), None)
            line = next((item for item in ledger["timeline"] if unpaid and item["instalmentId"] == unpaid["id"]), None)
            self.assertEqual(row["next"], line["next"]["on"] if line and line["next"] else None)
            self.assertEqual(row["stopped"], line["stopped"] if line else None)
            if ledger["student"]["status"] == "active":
                active_total += row["balance"]
        # Limit to named examples rather than including the small synthetic fleet.
        m.Student.objects.exclude(code__in=codes).update(archived_at=timezone.now())
        self.assertEqual(self.get("dashboard").json()["totals"]["outstanding"], active_total)

    def test_scope_and_totals_and_counter_payment(self):
        all_view = self.get("dashboard").json()
        self.assertEqual(all_view["totals"]["outstanding"], sum(
            self.get(f"dashboard?centre={code}").json()["totals"]["outstanding"]
            for code in m.Centre.objects.values_list("code", flat=True)))
        response = self.client.post("/api/counter_payment", {"student": "STU-0587", "amount_paise": 1500000,
                                                             "method": "cash", "received_on": "2026-11-02"},
                                    content_type="application/json", HTTP_X_INTERNAL_KEY="test-key")
        self.assertEqual(response.status_code, 200)
        after = self.get("dashboard").json()["totals"]
        self.assertEqual((all_view["totals"]["outstanding"] - after["outstanding"],
                          all_view["totals"]["overdue"] - after["overdue"]), (1500000, 1500000))
        self.sign_in("accounts.mlv@demo.test")
        scoped = self.get("dashboard").json()
        self.assertFalse(scoped["canPickCentre"])
        self.assertEqual([row["id"] for row in scoped["rows"]], ["MLV"])
        self.assertEqual(self.get("dashboard?centre=ZZZ").json()["totals"]["outstanding"], 0)
        self.assertEqual(self.get("students?centre=ZZZ").json()["counts"]["all"], 0)
        directory = self.get("staff_directory").json()
        self.assertEqual([row["id"] for row in directory["centres"]], ["MLV"])
        self.assertTrue(all(row["centreId"] == "MLV" for row in directory["students"]))

    def test_roster_filters_sort_counts_and_pages_are_consistent(self):
        for index in range(30):
            self.create_due(index, index)
        view = self.get("students?centre=ZZZ").json()
        self.assertEqual((len(view["rows"]), view["pages"], view["counts"]["all"], view["counts"]["overdue"]), (25, 2, 30, 29))
        self.assertEqual([row["daysOverdue"] for row in view["rows"]], list(range(29, 4, -1)))
        page = self.get("students?centre=ZZZ&page=99").json()
        self.assertEqual((page["page"], len(page["rows"])), (2, 5))
        upcoming = self.get(f"students?batch={self.batch.pk}&status=upcoming").json()
        self.assertEqual((len(upcoming["rows"]), upcoming["counts"]), (1, view["counts"]))
        self.assertEqual(self.get("students?centre=ZZZ&q=stu-9000").json()["rows"][0]["code"], "STU-9000")
        self.assertEqual(self.get("students?centre=ZZZ&status=over60").json()["rows"], [])

    def test_roles_and_invalid_filters_are_rejected(self):
        for query in ("students?status=bad", "students?page=0", "students?batch=bad", "dashboard?group=bad"):
            self.assertEqual(self.get(query).status_code, 400)
        self.sign_in("counsellor@demo.test")
        for view in ("dashboard", "students", "staff_directory"):
            self.assertEqual(self.get(view).status_code, 403)
