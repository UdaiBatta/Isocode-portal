import io
import os
from datetime import date
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from fees.models import Consent, Guardian, GuardianStudent, OtpChallenge, Receipt, StaffUser, UnmatchedPayment


class ReceiptTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())
        for phone in ["+919000000587", "+919000000412"]:
            guardian = Guardian.objects.get(phone=phone)
            challenge = OtpChallenge.objects.create(
                phone=phone, code_hash="test-consumed", expires_at=timezone.now(), consumed_at=timezone.now(),
            )
            for link in GuardianStudent.objects.filter(guardian=guardian):
                Consent.objects.create(
                    guardian=guardian, student=link.student, wording_version="v1",
                    language=guardian.language, otp_challenge=challenge, granted_at=timezone.now(),
                )

    def setUp(self):
        patcher = patch.dict(os.environ, {"INTERNAL_API_SECRET": "test-internal-key", "DEMO_MODE": "true"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def sign_in_parent(self, phone):
        guardian = Guardian.objects.get(phone=phone)
        session = self.client.session
        session["subject_type"] = "guardian"
        session["subject_id"] = str(guardian.pk)
        session["consent_declined"] = False
        session.save()
        self.client.cookies["sid"] = session.session_key

    def sign_in_staff(self, email):
        staff = StaffUser.objects.get(email=email)
        session = self.client.session
        session["subject_type"] = "staff"
        session["subject_id"] = str(staff.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key

    def get(self, path, data=None, **extra):
        return self.client.get(path, data=data, HTTP_X_INTERNAL_KEY="test-internal-key", **extra)

    def test_parent_list_and_detail_show_gst_receipt_and_pending_review(self):
        self.sign_in_parent("+919000000587")
        payment = Receipt.objects.get(payment__student__code="STU-0587", total_paise=1500000)
        unmatched = UnmatchedPayment.objects.create(
            reference="TXN-CHECK", amount_paise=500000, reason="amount_mismatch",
            suggested_instalment_id=payment.payment.allocation_set.get().instalment_id,
            received_on=date(2026, 11, 2),
        )

        response = self.get("/api/receipts", {"student": "STU-0587"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["selectedStudentId"], "STU-0587")
        self.assertEqual(len(data["receipts"]), 3)
        invoice = next(row for row in data["invoices"] if row["id"] == str(payment.pk))
        self.assertEqual((invoice["status"], invoice["amount"], invoice["href"]), ("paid", 1500000, f"/receipts/{payment.pk}"))
        pending = next(row for row in data["invoices"] if row["id"] == str(unmatched.pk))
        self.assertEqual((pending["status"], pending["number"], pending["href"]), ("pending", "TXN-CHECK", None))

        detail = self.get("/api/receipt", {"id": str(payment.pk)}).json()["receipt"]
        self.assertEqual(
            (detail["taxable"], detail["cgst"], detail["sgst"], detail["amount"]),
            (1271186, 114407, 114407, 1500000),
        )
        self.assertRegex(detail["number"], r"^MLV/2026-27/[0-9]{6}$")
        self.assertEqual(detail["student"], {
            "code": "STU-0587", "name": "Ishita Sharma", "batch": "JEE 2027 Evening", "centre": "Malviya Nagar",
        })

    def test_parent_cannot_read_another_familys_receipt_or_unconsented_list(self):
        target = Receipt.objects.filter(payment__student__code="STU-0587").first()
        self.sign_in_parent("+919000000412")
        self.assertEqual(self.get(f"/api/receipt?id={target.pk}").status_code, 404)
        self.assertEqual(self.get("/api/receipts", {"student": "STU-0587"}).status_code, 403)

        Consent.objects.filter(student__code="STU-0412").delete()
        self.assertEqual(self.get("/api/receipts").status_code, 403)

    def test_receipt_detail_is_scoped_to_accounts_centre_and_role(self):
        local = Receipt.objects.filter(payment__student__batch__centre__code="MLV").first()
        outside = Receipt.objects.filter(payment__student__batch__centre__code="VSH").first()
        self.sign_in_staff("accounts.mlv@demo.test")
        self.assertEqual(self.get(f"/api/receipt?id={local.pk}").status_code, 200)
        self.assertEqual(self.get(f"/api/receipt?id={outside.pk}").status_code, 404)

        self.sign_in_staff("counsellor@demo.test")
        self.assertEqual(self.get(f"/api/receipt?id={local.pk}").status_code, 404)

    def test_auth_and_query_inputs_are_required(self):
        self.assertEqual(self.get("/api/receipts").status_code, 401)
        self.sign_in_parent("+919000000587")
        self.assertEqual(self.get("/api/receipt?id=not-a-uuid").status_code, 400)
        self.assertEqual(self.get("/api/receipts", {"student": "bad-code"}).status_code, 400)
        self.assertEqual(self.get("/api/receipts", {"student": "STU-9999"}).status_code, 403)
