import csv
import io
import os
from datetime import date
from decimal import Decimal
from unittest.mock import patch
from xml.etree.ElementTree import fromstring

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

    def test_tally_vouchers_match_csv_totals_and_escape_party_text(self):
        m.Student.objects.filter(code="STU-0587").update(full_name='Fictional <name> & "family"')
        payment = m.Payment.objects.create(student=m.Student.objects.get(code="STU-0587"), amount_paise=101,
                                           method="cash", received_on=date(2026, 11, 2))
        m.Receipt.objects.create(payment=payment, number="TALLY-ESCAPED", issued_on=date(2026, 11, 2),
                                 total_paise=101, taxable_paise=85, cgst_paise=8, sgst_paise=8)
        response = self.get("export/tally.xml")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/xml; charset=utf-8")
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response["Content-Disposition"], 'attachment; filename="tally-receipts-2026-11.xml"')
        root = fromstring(response.content)
        self.assertEqual(root.findtext("HEADER/TALLYREQUEST"), "Import Data")
        vouchers = root.findall(".//VOUCHER")
        receipts = self.read("export/receipts.csv")[1]
        self.assertEqual(len(vouchers), len(receipts))
        self.assertGreater(len(vouchers), 0)
        self.assertEqual({v.findtext("VOUCHERNUMBER") for v in vouchers}, {r["Receipt"] for r in receipts})
        total = 0
        for voucher in vouchers:
            self.assertEqual(voucher.get("VCHTYPE"), "Receipt")
            self.assertTrue(voucher.findtext("DATE").startswith("202611"))
            entries = voucher.findall("ALLLEDGERENTRIES.LIST")
            amounts = [Decimal(e.findtext("AMOUNT")) for e in entries]
            self.assertEqual(sum(amounts), 0)
            total += amounts[0] * 100
            receipt = m.Receipt.objects.get(number=voucher.findtext("VOUCHERNUMBER"))
            self.assertEqual(amounts[0] * 100, receipt.total_paise)
            self.assertIn(f"CGST INR {receipt.cgst_paise // 100}.{receipt.cgst_paise % 100:02d}", voucher.findtext("NARRATION"))
            self.assertIn(f"SGST INR {receipt.sgst_paise // 100}.{receipt.sgst_paise % 100:02d}", voucher.findtext("NARRATION"))
        self.assertEqual(total, sum(int(row["Amount paise"]) for row in receipts))
        self.assertTrue(any(v.findtext("PARTYLEDGERNAME") == 'STU-0587 Fictional <name> & "family"' for v in vouchers))

    def test_tally_issue_month_scope_filters_and_archived_history(self):
        student = m.Student.objects.get(code="STU-0587")
        payment = m.Payment.objects.create(student=student, amount_paise=101, method="cash", received_on=date(2026, 10, 31))
        current = m.Receipt.objects.create(payment=payment, number="TALLY-CURRENT", issued_on=date(2026, 11, 1),
                                          total_paise=101, taxable_paise=85, cgst_paise=8, sgst_paise=8)
        previous_payment = m.Payment.objects.create(student=student, amount_paise=101, method="cash", received_on=date(2026, 10, 31))
        m.Receipt.objects.create(payment=previous_payment, number="TALLY-PREVIOUS", issued_on=date(2026, 10, 31),
                                 total_paise=101, taxable_paise=85, cgst_paise=8, sgst_paise=8)
        m.Student.objects.filter(pk=student.pk).update(archived_at=timezone.now())
        self.sign_in("accounts.mlv@demo.test")
        vouchers = fromstring(self.get(f"export/tally.xml?batch={student.batch_id}").content).findall(".//VOUCHER")
        numbers = [v.findtext("VOUCHERNUMBER") for v in vouchers]
        self.assertIn(current.number, numbers)
        self.assertNotIn("TALLY-PREVIOUS", numbers)
        self.assertTrue(all(m.Receipt.objects.get(number=number).payment.student.batch_id == student.batch_id for number in numbers))
        self.assertEqual(fromstring(self.get("export/tally.xml?centre=VSH").content).findall(".//VOUCHER"), [])
        other = m.Batch.objects.filter(centre__code="VSH").first()
        self.assertEqual(fromstring(self.get(f"export/tally.xml?batch={other.pk}").content).findall(".//VOUCHER"), [])
        self.assertEqual(self.get("export/tally.xml?batch=invalid").status_code, 400)

    def test_tally_denies_other_roles_anonymous_and_missing_internal_key(self):
        for email in ["counsellor@demo.test", "admin@demo.test"]:
            self.sign_in(email)
            self.assertEqual(self.get("export/tally.xml").status_code, 403)
        session = self.client.session
        session["subject_type"], session["subject_id"] = "guardian", str(m.Guardian.objects.first().pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        self.assertEqual(self.get("export/tally.xml").status_code, 403)
        self.client.cookies.clear()
        self.assertEqual(self.get("export/tally.xml").status_code, 401)
        self.assertEqual(self.client.get("/api/export/tally.xml").status_code, 403)
