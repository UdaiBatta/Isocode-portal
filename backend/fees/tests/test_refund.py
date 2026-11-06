import io
import os
from datetime import date, timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.utils import timezone

from fees import models as m
from fees.services.refunds import approve_refund, save_refund_draft
from fees.services.reminders import send_due_reminders


class RefundTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        patcher = patch.dict(os.environ, {"DEMO_MODE": "true", "INTERNAL_API_SECRET": "test-internal-key"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def sign_in(self, email="accounts@demo.test"):
        user = m.StaffUser.objects.get(email=email)
        session = self.client.session
        session["subject_type"] = "staff"
        session["subject_id"] = str(user.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        return user

    def post(self, name, values):
        return self.client.post(f"/api/{name}", values, content_type="application/json", HTTP_X_INTERNAL_KEY="test-internal-key")

    def get(self, name):
        return self.client.get(f"/api/{name}", HTTP_X_INTERNAL_KEY="test-internal-key")

    def draft(self, code="STU-0412", **changes):
        return self.post("save_refund_draft", {"studentId": code, "withdrawalDate": "2026-11-02", "reason": "Moved city", **changes})

    def test_new_preview_uses_current_values_without_writing_a_draft(self):
        self.sign_in()
        response = self.get("refund?student=STU-0412")
        self.assertEqual(response.status_code, 200)
        view = response.json()
        self.assertEqual(set(view), {"ok", "student", "policy", "input", "calc", "status", "blockedBy", "overdueDeadline"})
        self.assertEqual((view["status"], view["calc"]["refund"], view["calc"]["earned"]), ("new", 1898631, 7101369))
        self.assertEqual((view["calc"]["totalDays"], view["calc"]["elapsedDays"], view["calc"]["deadline"]), (365, 216, "2026-11-12"))
        preview = self.get("refund?student=STU-0412&withdrawalDate=2026-10-01").json()
        self.assertEqual(preview["input"]["withdrawalDate"], "2026-10-01")
        self.assertNotEqual(preview["calc"], view["calc"])
        self.assertFalse(m.Refund.objects.filter(student__code="STU-0412").exists())
        self.assertEqual(self.get("refund?student=STU-0801").json()["input"]["reason"], "Other")

    def test_draft_recalculates_after_payment_and_approval_freezes_a_fresh_snapshot(self):
        actor = self.sign_in()
        self.assertEqual(self.draft(refund=1, net=1, paid=1, status="paid").status_code, 200)
        row = m.Refund.objects.get(student__code="STU-0412")
        self.assertEqual((row.refund_paise, row.paid_paise, row.created_by_id), (1898631, 9000000, actor.pk))
        self.assertEqual(self.post("counter_payment", {"student": "STU-0412", "amount_paise": 1000000,
                                                       "method": "cash", "received_on": "2026-11-02"}).status_code, 200)
        self.assertEqual(self.get("refund?student=STU-0412").json()["calc"]["refund"], 2898631)
        row.refresh_from_db()
        self.assertEqual(row.paid_paise, 9000000)
        self.assertEqual(self.post("approve_refund", {"refundId": "STU-0412"}).status_code, 200)
        row.refresh_from_db()
        self.assertEqual((row.status, row.paid_paise, row.refund_paise, row.approved_by_id), ("approved", 10000000, 2898631, actor.pk))
        frozen = self.get("refund?student=STU-0412").json()["calc"]
        m.FeePlan.objects.filter(student=row.student).update(gross_paise=13000000, net_paise=13000000)
        m.AppSetting.objects.filter(pk="demo_today").update(value="2026-11-20")
        view = self.get("refund?student=STU-0412&withdrawalDate=2026-10-01").json()
        self.assertEqual(view["calc"], frozen)
        self.assertEqual(view["input"]["withdrawalDate"], "2026-11-02")
        self.assertTrue(view["overdueDeadline"])
        self.assertEqual(self.draft().status_code, 409)
        self.assertEqual(self.post("approve_refund", {"refundId": "STU-0412"}).status_code, 409)
        self.assertEqual(m.AuditLog.objects.filter(action="refund_approved", entity_id=row.pk).count(), 1)

    def test_open_payment_review_blocks_approval_until_resolved(self):
        self.sign_in()
        self.assertEqual(self.draft("STU-0771").status_code, 200)
        view = self.get("refund?student=STU-0771").json()
        self.assertIsNotNone(view["blockedBy"])
        self.assertEqual(self.post("approve_refund", {"refundId": "STU-0771"}).json()["code"], "unmatched")
        self.assertEqual(m.Student.objects.get(code="STU-0771").status, "active")
        self.assertEqual(self.post("resolve_unmatched", {"id": view["blockedBy"]["unmatchedId"],
                                                         "action": "reject", "note": "Synthetic review rejected"}).status_code, 200)
        self.assertEqual(self.post("approve_refund", {"refundId": "STU-0771"}).status_code, 200)

    def test_approval_stops_reminders_and_parent_sees_refund_then_mock_paid(self):
        self.sign_in()
        self.assertEqual(self.draft("STU-0587").status_code, 200)
        self.assertEqual(self.post("mark_refund_paid", {"refundId": "STU-0587"}).status_code, 409)
        self.assertEqual(self.post("approve_refund", {"refundId": "STU-0587"}).status_code, 200)
        send_due_reminders(date(2026, 11, 9))
        self.assertFalse(m.ReminderLog.objects.filter(instalment__plan__student__code="STU-0587", step=30).exists())
        self.assertEqual(self.post("mark_refund_paid", {"refundId": "STU-0587"}).json()["paidOn"], "2026-11-02")
        self.assertEqual(self.post("mark_refund_paid", {"refundId": "STU-0587"}).status_code, 409)
        self.assertEqual(m.AuditLog.objects.filter(action="refund_paid").count(), 1)
        self.assertEqual(m.AuditLog.objects.get(action="refund_paid").after["paidOn"], "2026-11-02")
        guardian = m.Guardian.objects.get(phone="+919000000587")
        student = m.Student.objects.get(code="STU-0587")
        challenge = m.OtpChallenge.objects.create(phone=guardian.phone, code_hash="synthetic-consumed",
                                                  consumed_at=timezone.now(), expires_at=timezone.now() + timedelta(minutes=5))
        m.Consent.objects.create(guardian=guardian, student=student, wording_version="v1", language="en",
                                 otp_challenge=challenge, granted_at=timezone.now())
        session = self.client.session
        session["subject_type"], session["subject_id"] = "guardian", str(guardian.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        view = self.get("dues?student=STU-0587").json()
        self.assertEqual((view["mode"], view["refund"]["amount"], view["refund"]["status"]), ("withdrawn", 398631, "paid"))

    def test_role_centre_and_input_boundaries(self):
        self.assertEqual(self.get("refund?student=STU-0412").status_code, 401)
        scoped = self.sign_in("accounts.mlv@demo.test")
        other = m.Student.objects.exclude(batch__centre_id=scoped.centre_id).first()
        self.assertEqual(self.get(f"refund?student={other.code}").status_code, 403)
        self.assertEqual(self.draft(other.code).status_code, 403)
        self.assertEqual(self.post("approve_refund", {"refundId": other.code}).status_code, 403)
        self.assertEqual(self.post("mark_refund_paid", {"refundId": other.code}).status_code, 403)
        self.sign_in("counsellor@demo.test")
        self.assertEqual(self.get("refund?student=STU-0412").status_code, 403)
        self.assertEqual(self.draft().status_code, 403)
        self.sign_in()
        for values in [{"withdrawalDate": "2026-11-03"}, {"withdrawalDate": "2026-03-31"}, {"reason": "bad"}]:
            self.assertEqual(self.draft(**values).status_code, 400)
        self.assertEqual(self.get("refund?student=invalid").status_code, 400)
        self.assertEqual(self.get("refund?student=STU-9999").status_code, 404)
        self.assertEqual(self.client.get("/api/refund?student=STU-0412").status_code, 403)
        self.assertEqual(self.get("save_refund_draft").status_code, 405)
        self.assertFalse(m.Refund.objects.filter(student__code="STU-0412").exists())
        source = m.Student.objects.get(code="STU-0412")
        m.Student.objects.create(code="STU-9998", full_name="Synthetic no-plan student", batch=source.batch,
                                  enrolled_on=date(2026, 11, 2))
        self.assertIsNone(self.get("refund?student=STU-9998").json()["calc"])
        self.assertEqual(self.draft("STU-9998").status_code, 409)

    def test_linked_policy_is_used_while_public_policy_is_latest_effective_version(self):
        self.sign_in()
        m.RefundPolicy.objects.create(version="v2", effective_from=date(2026, 10, 1), deadline_days=20,
                                       text_en="Synthetic current English policy", text_hi="Synthetic current Hindi policy")
        m.RefundPolicy.objects.create(version="v3", effective_from=date(2027, 1, 1), deadline_days=30,
                                       text_en="Future synthetic policy", text_hi="Future synthetic policy")
        self.assertEqual(self.get("refund_policy").json()["version"], "v2")
        view = self.get("refund?student=STU-0587").json()
        self.assertEqual((view["policy"]["version"], view["calc"]["deadline"]), ("v1", "2026-11-12"))

    def test_reminder_job_rechecks_withdrawal_after_loading_joined_student(self):
        actor = self.sign_in()
        save_refund_draft(student_code="STU-0587", withdrawal_date=date(2026, 11, 2), reason="Personal", actor=actor)
        instalment = m.Instalment.objects.get(plan__student__code="STU-0587", seq=3)
        changed = False

        def withdraw_after_select(execute, sql, params, many, context):
            nonlocal changed
            result = execute(sql, params, many, context)
            if not changed and sql.startswith("SELECT") and "FOR UPDATE" in sql and str(instalment.pk) in {str(value) for value in params or []}:
                changed = True
                # Simulate a joined student snapshot becoming stale while its instalment lock was awaited.
                approve_refund(student_code="STU-0587", actor=actor)
            return result

        with connection.execute_wrapper(withdraw_after_select):
            send_due_reminders(date(2026, 11, 9))
        self.assertTrue(changed)
        self.assertFalse(m.ReminderLog.objects.filter(instalment=instalment, step=30).exists())
