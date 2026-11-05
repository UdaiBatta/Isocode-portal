import csv
import io
import os
from datetime import date
from unittest.mock import patch

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from fees import models as m
from fees.views.exports import _csv


class CsvTests(SimpleTestCase):
    def test_formula_prefixes_and_csv_quoting(self):
        values = ['=SUM(A1)', '+123', '-1', '@name', ' \t=SUM(A1)', 'name, with "quotes"\nand newline', 'काल्पनिक नाम']
        response = _csv("example.csv", ["Value"], ([value] for value in values))
        rows = list(csv.reader(io.StringIO(response.content.decode())))
        self.assertEqual(rows, [["Value"], *[["'" + value if index < 5 else value] for index, value in enumerate(values)]])


class ExportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        env = patch.dict(os.environ, {"DEMO_MODE": "true", "INTERNAL_API_SECRET": "test-key"})
        env.start()
        self.addCleanup(env.stop)
        self.sign_in()

    def sign_in(self, email="accounts@demo.test"):
        user = m.StaffUser.objects.get(email=email)
        session = self.client.session
        session["subject_type"], session["subject_id"] = "staff", str(user.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key

    def get(self, endpoint):
        return self.client.get(f"/api/{endpoint}", HTTP_X_INTERNAL_KEY="test-key")

    def read(self, endpoint):
        response = self.get(endpoint)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertEqual(response["Cache-Control"], "no-store")
        return response, list(csv.DictReader(io.StringIO(response.content.decode())))

    def test_dues_total_matches_dashboard_with_scope_and_filters(self):
        response, rows = self.read("export/dues.csv")
        self.assertIn('filename="dues-2026-11-02.csv"', response["Content-Disposition"])
        self.assertEqual(sum(int(row["Balance paise"]) for row in rows), self.get("dashboard").json()["totals"]["outstanding"])
        self.assertNotIn("STU-0802", [row["Student code"] for row in rows])
        self.sign_in("accounts.mlv@demo.test")
        _, rows = self.read("export/dues.csv")
        self.assertTrue(all(row["Centre"] == "Malviya Nagar" for row in rows))
        self.assertEqual(sum(int(row["Balance paise"]) for row in rows), self.get("dashboard").json()["totals"]["outstanding"])
        self.assertEqual(self.read("export/dues.csv?centre=VSH")[1], [])
        student = m.Student.objects.get(code="STU-0587")
        _, rows = self.read(f"export/dues.csv?batch={student.batch_id}")
        self.assertTrue(all(row["Batch"] == student.batch.name for row in rows))

    def test_receipts_use_issue_month_and_retain_archived_history(self):
        payment = m.Payment.objects.create(student=m.Student.objects.get(code="STU-0587"), amount_paise=1500000,
                                           method="bank", received_on=date(2026, 10, 31))
        receipt = m.Receipt.objects.create(payment=payment, number="MLV/2026-27/TEST", issued_on=date(2026, 11, 2),
                                           total_paise=1500000, taxable_paise=1271186, cgst_paise=114407, sgst_paise=114407)
        m.Student.objects.filter(code="STU-0587").update(archived_at=timezone.now())
        response, rows = self.read("export/receipts.csv")
        self.assertIn('filename="receipts-2026-11.csv"', response["Content-Disposition"])
        exported = next(row for row in rows if row["Receipt"] == receipt.number)
        self.assertEqual((exported["Date"], int(exported["Amount paise"])), ("2026-11-02", 1500000))
        self.sign_in("accounts.mlv@demo.test")
        self.assertIn(receipt.number, [row["Receipt"] for row in self.read("export/receipts.csv")[1]])
        self.assertEqual(self.read("export/receipts.csv?centre=VSH")[1], [])

    def test_export_roles_filters_and_student_formula_text(self):
        m.Student.objects.filter(code="STU-0587").update(full_name="=Synthetic formula")
        self.assertEqual(next(row for row in self.read("export/dues.csv")[1] if row["Student code"] == "STU-0587")["Name"],
                         "'=Synthetic formula")
        self.assertEqual(self.get("export/dues.csv?batch=invalid").status_code, 400)
        self.sign_in("counsellor@demo.test")
        self.assertEqual(self.get("export/dues.csv").status_code, 403)
        self.assertEqual(self.get("export/receipts.csv").status_code, 403)
