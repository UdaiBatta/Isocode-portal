import io
import os
from datetime import date
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from fees.domain.pay_token import unsign_pay_token
from fees.models import Consent, Guardian, GuardianStudent, Instalment, OtpChallenge, Refund, UnmatchedPayment


class DuesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())
        for phone in ["+919000000587", "+919000000412", "+919000000219", "+919000000777", "+919000000802"]:
            guardian = Guardian.objects.get(phone=phone)
            challenge = OtpChallenge.objects.create(phone=phone, code_hash="test-consumed",
                                                    expires_at=timezone.now(), consumed_at=timezone.now())
            for link in GuardianStudent.objects.filter(guardian=guardian):
                Consent.objects.create(guardian=guardian, student=link.student, wording_version="v1",
                                       language=guardian.language, otp_challenge=challenge,
                                       granted_at=timezone.now())

    def setUp(self):
        patcher = patch.dict(os.environ, {"INTERNAL_API_SECRET": "test-internal-key", "DEMO_MODE": "true"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def sign_in(self, phone):
        session = self.client.session
        session["subject_type"] = "guardian"
        session["subject_id"] = str(Guardian.objects.get(phone=phone).pk)
        session["consent_declined"] = False
        session.save()
        self.client.cookies["sid"] = session.session_key

    def get_dues(self, student=None, key="test-internal-key"):
        query = f"?student={student}" if student else ""
        headers = {"HTTP_X_INTERNAL_KEY": key} if key is not None else {}
        return self.client.get(f"/api/dues{query}", **headers)

    def test_brief_sample_students_return_the_dues_contract(self):
        for phone, code, mode, amount, paid, balance, status, overdue, due_in, due_date in [
            ("+919000000587", "STU-0587", "pay", 3000000, 1500000, 1500000, "overdue", 23, 0, "2026-10-10"),
            ("+919000000219", "STU-0219", "pay", 4000000, 0, 4000000, "upcoming", 0, 13, "2026-11-15"),
        ]:
            with self.subTest(code=code):
                self.sign_in(phone)
                result = self.get_dues().json()
                self.assertEqual((result["selectedStudentId"], result["mode"]), (code, mode))
                current = result["current"]
                self.assertEqual((current["amount"], current["paid"], current["balance"], current["status"],
                                  current["daysOverdue"], current["dueInDays"], current["dueDate"]),
                                 (amount, paid, balance, status, overdue, due_in, due_date))
                self.assertTrue(current["payUrl"].startswith("/mock-gateway/"))
                self.assertEqual(unsign_pay_token(current["payUrl"].removeprefix("/mock-gateway/")), current["id"])

        self.sign_in("+919000000412")
        aarav = self.get_dues().json()
        self.assertEqual((aarav["mode"], aarav["current"]["seq"], aarav["next"]),
                         ("clear", 4, {"amount": 3000000, "dueDate": "2027-01-10"}))

    def test_review_withdrawn_and_family_scope_modes(self):
        self.sign_in("+919000000587")
        current = Instalment.objects.get(plan__student__code="STU-0587", seq=3)
        UnmatchedPayment.objects.create(amount_paise=100000, reason="amount_mismatch",
                                        suggested_instalment=current, received_on=date(2026, 11, 2))
        self.assertEqual(self.get_dues().json()["mode"], "review")
        self.assertEqual(self.get_dues("STU-0412").status_code, 403)

        self.sign_in("+919000000802")
        withdrawn = self.get_dues().json()
        self.assertEqual(withdrawn["mode"], "withdrawn")
        self.assertEqual(withdrawn["refund"]["status"], "approved")
        self.assertEqual(withdrawn["refund"]["deadline"], "2026-11-07")
        Refund.objects.filter(student__code="STU-0802").update(status="draft")
        self.assertEqual(self.get_dues().json()["refund"]["status"], "draft")

    def test_get_auth_and_query_validation(self):
        self.assertEqual(self.get_dues().status_code, 401)
        self.sign_in("+919000000587")
        self.assertEqual(self.get_dues(key=None).status_code, 403)
        self.assertEqual(self.get_dues("x" * 33).status_code, 400)
