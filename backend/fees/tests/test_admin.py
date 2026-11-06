import io
import json
import os
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.core.management import call_command
from django.db.models import Sum
from django.test import TestCase
from django.utils import timezone

from fees import models as m
from fees.services import admin
from fees.services.payments import CounterPaymentError, UnmatchedPaymentError, process_payment_event, record_counter_payment, resolve_unmatched_payment
from fees.services.refunds import RefundError, save_refund_draft
from fees.domain.pay_token import sign_pay_token


class AdminTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def setUp(self):
        env = patch.dict(os.environ, {"DEMO_MODE": "true", "INTERNAL_API_SECRET": "test-key"})
        env.start()
        self.addCleanup(env.stop)
        self.actor = self.sign_in()

    def sign_in(self, email="admin@demo.test"):
        user = m.StaffUser.objects.get(email=email)
        session = self.client.session
        session["subject_type"], session["subject_id"] = "staff", str(user.pk)
        session.save()
        self.client.cookies["sid"] = session.session_key
        return user

    def get(self, path):
        return self.client.get(f"/api/{path}", HTTP_X_INTERNAL_KEY="test-key")

    def post(self, path, data):
        return self.client.post(f"/api/{path}", data, content_type="application/json", HTTP_X_INTERNAL_KEY="test-key")

    def centre(self, code="ZZZ"):
        response = self.post("admin_save_centre", {"code": code, "name": "Fictional centre " + code})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["id"]

    def batch(self, centre):
        response = self.post("admin_save_batch", {"centreId": centre, "name": "JEE 2028 Morning", "stream": "JEE",
                                                  "sessionStart": "2026-04-01", "sessionEnd": "2027-03-31"})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["id"]

    def student(self, batch=None, **changes):
        batch = batch or str(m.Batch.objects.filter(centre__code="MLV", stream="JEE").first().pk)
        return self.post("admin_save_student", {"fullName": "Fictional new student", "batchId": batch, "enrolledOn": "2026-11-02",
                                                "guardianName": "Fictional guardian", "guardianPhone": "+919888880001",
                                                "guardianLanguage": "hi", "gross": 12000000, "discount": 999999,
                                                "discountReason": "Synthetic scholarship", **changes})

    def target(self, action, entity, pk):
        return self.post(f"admin_{action}", {"entity": entity, "id": str(pk)})

    def test_lists_filters_paging_and_no_risk_fields(self):
        view = self.get("admin_students").json()
        self.assertEqual((len(view["rows"]), view["counts"]["active"], view["pages"]), (25, 212, 9))
        row = self.get("admin_students?q=STU-0587").json()["rows"][0]
        self.assertEqual((row["fee"]["net"], row["fee"]["paid"], row["guardian"]["phone"]), (12000000, 7500000, "+919000000587"))
        mlv = m.Centre.objects.get(code="MLV")
        scoped = self.get(f"admin_students?centre={mlv.pk}&q=STU-0587").json()
        self.assertEqual(scoped["counts"]["active"], 1)
        self.assertEqual(self.get("admin_students?q=9000000587").json()["counts"]["active"], 1)
        for endpoint in ("admin_centres", "admin_batches", "admin_staff", "admin_directory"):
            response = self.get(endpoint)
            self.assertEqual(response.status_code, 200)
            text = response.content.decode()
            self.assertNotIn("password", text)
            self.assertNotIn('"score"', text)
            self.assertNotIn('"risk"', text)

    def test_centre_lifecycle_retains_audit_and_immutable_code(self):
        pk = self.centre()
        self.assertEqual(self.post("admin_save_centre", {"id": pk, "code": "YYY", "name": "Fictional renamed"}).json()["code"], "code_locked")
        self.assertEqual(self.target("archive", "centre", pk).status_code, 200)
        self.assertEqual(self.get("admin_centres?state=archived").json()["counts"], {"active": 4, "archived": 1})
        self.assertEqual(self.target("restore", "centre", pk).status_code, 200)
        self.assertEqual(self.target("delete", "centre", pk).status_code, 200)
        self.assertFalse(m.Centre.objects.filter(pk=pk).exists())
        history = self.get(f"admin_history?entity=centre&id={pk}").json()["rows"]
        self.assertEqual([row["action"] for row in history], ["delete", "restore", "archive", "create"])
        self.assertTrue(all(row["actor"] == "Demo Admin" and row["at"].endswith("+05:30") for row in history))

    def test_batch_guards_include_archived_students_and_parent_state(self):
        batch = m.Batch.objects.get(centre__code="MLV", name="JEE 2027 Morning")
        m.Student.objects.filter(batch=batch).update(archived_at=timezone.now())
        view = self.get(f"admin_batches?centre={batch.centre_id}").json()
        row = next(row for row in view["rows"] if row["id"] == str(batch.pk))
        self.assertFalse(row["actions"]["canArchive"])
        self.assertEqual(self.target("archive", "batch", batch.pk).status_code, 409)
        centre = self.centre()
        self.assertEqual(self.post("admin_save_batch", {"id": str(batch.pk), "centreId": centre, "name": batch.name,
                                                        "stream": batch.stream, "sessionStart": "2026-04-01",
                                                        "sessionEnd": "2027-03-31"}).json()["code"], "has_students")
        empty = self.batch(centre)
        self.assertEqual(self.target("archive", "centre", centre).status_code, 409)
        self.assertEqual(self.target("archive", "batch", empty).status_code, 200)
        self.assertEqual(self.target("archive", "centre", centre).status_code, 200)
        self.assertEqual(self.target("restore", "batch", empty).status_code, 409)
        self.assertNotIn(empty, [row["id"] for row in self.get("admin_directory").json()["batches"]])

    def test_staff_password_scope_self_and_activity_rules(self):
        centre = self.centre()
        values = {"fullName": "Fictional staff", "email": "fictional@demo.test", "role": "accounts", "centreId": centre,
                  "password": "a-test-password-only"}
        response = self.post("admin_save_staff", values)
        self.assertEqual(response.status_code, 200, response.content)
        pk = response.json()["id"]
        row = m.StaffUser.objects.get(pk=pk)
        self.assertTrue(check_password(values["password"], row.password_hash))
        self.assertNotIn(values["password"], json.dumps(list(m.AuditLog.objects.values("before", "after"))))
        self.assertEqual(self.post("admin_save_staff", {**values, "id": pk}).json()["code"], "password_locked")
        self.assertEqual(self.target("archive", "staff", self.actor.pk).status_code, 409)
        self.assertEqual(self.target("delete", "staff", self.actor.pk).status_code, 409)
        self.assertEqual(self.post("admin_save_staff", {"id": str(self.actor.pk), "fullName": "Demo Admin", "email": self.actor.email,
                                                       "role": "accounts", "centreId": centre}).json()["code"], "self")
        self.assertEqual(self.target("archive", "staff", pk).status_code, 200)
        self.assertEqual(self.target("archive", "centre", centre).status_code, 200)
        self.assertEqual(self.target("restore", "staff", pk).status_code, 409)
        self.assertEqual(self.target("delete", "staff", pk).status_code, 200)
        active = m.StaffUser.objects.get(email="accounts@demo.test")
        m.AuditLog.objects.create(actor_type="staff", actor_id=active.pk, entity="centre", entity_id=m.Centre.objects.first().pk,
                                  action="test_activity")
        self.assertEqual(self.target("delete", "staff", active.pk).status_code, 409)

    def test_create_student_splits_full_fee_and_can_delete_only_without_history(self):
        response = self.student()
        self.assertEqual(response.status_code, 200, response.content)
        pk = response.json()["id"]
        row = m.Student.objects.get(pk=pk)
        self.assertEqual(row.code, "STU-0805")
        plan = m.FeePlan.objects.get(student=row)
        amounts = list(plan.instalment_set.order_by("seq").values_list("amount_paise", flat=True))
        self.assertEqual((len(amounts), sum(amounts)), (4, 11000001))
        self.assertEqual(self.target("archive", "student", pk).status_code, 409)
        self.assertEqual(self.target("delete", "student", pk).status_code, 200)
        self.assertFalse(m.Student.objects.filter(pk=pk).exists())
        self.assertEqual(m.AuditLog.objects.filter(entity_id=pk, action="admin_delete").count(), 1)
        paid = m.Student.objects.get(code="STU-0219")
        record_counter_payment(student_code=paid.code, amount_paise=4000000, method="cash", received_on=date(2026, 11, 2),
                               note="Synthetic full settlement", recorded_by=m.StaffUser.objects.get(email="accounts@demo.test"))
        financial = (m.Payment.objects.count(), m.Receipt.objects.count())
        self.assertEqual(self.target("delete", "student", paid.pk).status_code, 409)
        self.assertEqual(self.target("archive", "student", paid.pk).status_code, 200)
        self.assertEqual(financial, (m.Payment.objects.count(), m.Receipt.objects.count()))

    def test_student_primary_contact_change_retains_old_consent_and_other_guardians(self):
        row = m.Student.objects.get(code="STU-0587")
        old = m.GuardianStudent.objects.get(student=row, is_primary=True).guardian
        challenge = m.OtpChallenge.objects.create(phone=old.phone, code_hash="synthetic-test-hash",
                                                   expires_at=timezone.now() + timedelta(minutes=5))
        consent = m.Consent.objects.create(guardian=old, student=row, wording_version="v1", language="hi",
                                           otp_challenge=challenge, granted_at=timezone.now())
        secondary = m.Guardian.objects.create(phone="+919888880002", full_name="Fictional secondary", language="en")
        m.GuardianStudent.objects.create(student=row, guardian=secondary)
        batch = m.Batch.objects.filter(centre__code="VSH").first()
        response = self.student(id=str(row.pk), batch=str(batch.pk), gross=None, discount=0, discountReason="")
        self.assertEqual(response.status_code, 200, response.content)
        row.refresh_from_db()
        self.assertEqual(row.batch_id, batch.pk)
        self.assertFalse(m.GuardianStudent.objects.filter(student=row, guardian=old).exists())
        self.assertTrue(m.GuardianStudent.objects.filter(student=row, guardian=secondary).exists())
        self.assertTrue(m.Guardian.objects.filter(pk=old.pk).exists())
        self.assertTrue(m.Consent.objects.filter(pk=consent.pk).exists())
        self.assertEqual(m.GuardianStudent.objects.get(student=row, is_primary=True).guardian.phone, "+919888880001")

    def test_validation_and_roles_cannot_be_overridden_by_input(self):
        for values in ({"gross": True}, {"gross": "12000000"}, {"gross": 1.5}, {"discount": 12000000},
                       {"enrolledOn": "2026-11-03"}, {"guardianPhone": "123"}):
            self.assertEqual(self.student(**values).status_code, 400)
        self.assertEqual(self.get("admin_students?page=0").status_code, 400)
        self.sign_in("accounts@demo.test")
        for name in ("admin_students", "admin_batches", "admin_centres", "admin_staff", "admin_directory", "admin_history"):
            self.assertEqual(self.get(name).status_code, 403)
        self.assertEqual(self.post("admin_save_centre", {"code": "ZZZ", "name": "Fictional", "role": "admin"}).status_code, 403)

    def test_audit_failure_rolls_back_the_entire_write(self):
        with patch("fees.services.admin._audit", side_effect=RuntimeError("synthetic audit failure")):
            with self.assertRaises(RuntimeError):
                admin.save_centre({"code": "ZZZ", "name": "Fictional centre"}, self.actor)
        self.assertFalse(m.Centre.objects.filter(code="ZZZ").exists())

    def test_moved_student_money_actions_recheck_current_centre(self):
        student = m.Student.objects.get(code="STU-0587")
        batch = m.Batch.objects.filter(centre__code="VSH", stream="JEE").first()
        response = self.student(id=str(student.pk), batch=str(batch.pk), gross=None, discount=0, discountReason="")
        self.assertEqual(response.status_code, 200)
        actor = m.StaffUser.objects.get(email="accounts.mlv@demo.test")
        with self.assertRaises(CounterPaymentError) as caught:
            record_counter_payment(student_code=student.code, amount_paise=1500000, method="cash", received_on=date(2026, 11, 2),
                                   note="", recorded_by=actor)
        self.assertEqual(caught.exception.code, "forbidden")
        with self.assertRaises(RefundError) as caught:
            save_refund_draft(student_code=student.code, withdrawal_date=date(2026, 11, 2), reason="Other", actor=actor)
        self.assertEqual(caught.exception.code, "forbidden")
        instalment = m.InstalmentBalance.objects.filter(student=student, balance_paise=1500000).get()
        item = m.UnmatchedPayment.objects.filter(status="open", suggested_instalment__plan__student__code="STU-0771").get()
        with self.assertRaises(UnmatchedPaymentError) as caught:
            resolve_unmatched_payment(unmatched_id=item.pk, action="match", instalment_id=instalment.pk, resolved_by=actor)
        self.assertEqual(caught.exception.code, "forbidden")
        event = process_payment_event(event_id="test-admin-move", reference=str(instalment.pk), amount_paise=1500000,
                                       status="success", paid_on=date(2026, 11, 2))
        self.assertEqual(event.result, "allocated")
        self.assertTrue(m.Receipt.objects.get(payment=event.payment).number.startswith("VSH/"))

    def test_fee_change_only_respreads_unpaid_and_retains_financial_facts(self):
        student = m.Student.objects.get(code="STU-0412")
        before = list(m.Instalment.objects.filter(plan__student=student).order_by("seq").values_list("pk", "amount_paise"))
        facts = list(m.Allocation.objects.filter(payment__student=student).values_list("pk", "amount_paise"))
        receipts = list(m.Receipt.objects.filter(payment__student=student).values_list("pk", "total_paise"))
        values = {"studentId": str(student.pk), "gross": 12000000, "discount": 2000000, "reason": "Synthetic scholarship review"}
        self.assertEqual(self.post("admin_change_fee", {**values, "discount": 4000000}).json()["code"], "below_paid")
        self.assertEqual(self.post("admin_change_fee", {**values, "reason": ""}).status_code, 400)
        self.assertEqual(self.post("admin_change_fee", values).status_code, 200)
        after = list(m.Instalment.objects.filter(plan__student=student).order_by("seq").values_list("pk", "amount_paise"))
        self.assertEqual(before[:3], after[:3])
        self.assertEqual(after[3][1], 1000000)
        self.assertEqual(facts, list(m.Allocation.objects.filter(payment__student=student).values_list("pk", "amount_paise")))
        self.assertEqual(receipts, list(m.Receipt.objects.filter(payment__student=student).values_list("pk", "total_paise")))
        history = self.get(f"admin_history?entity=student&id={student.pk}").json()["rows"][0]
        self.assertEqual((history["action"], history["reason"]), ("fee", values["reason"]))
        self.assertIn({"field": "discount", "before": 0, "after": 2000000}, history["changes"])
        self.assertEqual(m.InstalmentBalance.objects.filter(student=student).aggregate(total=Sum("balance_paise"))["total"], 1000000)
        audit = m.AuditLog.objects.get(entity_id=student.pk, action="admin_fee")
        self.assertEqual(len(audit.before["_instalments"]), 4)
        self.assertEqual(self.post("admin_change_fee", values).json()["code"], "unchanged")

    def test_audited_zero_value_reduction_retains_history_and_clears_dues(self):
        student = m.Student.objects.get(code="STU-0587")
        models = (m.Payment, m.Allocation, m.Receipt, m.ReminderLog, m.UnmatchedPayment, m.Consent)
        before = {model: list(model.objects.order_by("pk").values()) for model in models}
        response = self.post("admin_change_fee", {"studentId": str(student.pk), "gross": 12000000,
                                                   "discount": 4500000, "reason": "Approved synthetic fee reduction"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(before, {model: list(model.objects.order_by("pk").values()) for model in models})
        amounts = list(m.Instalment.objects.filter(plan__student=student).order_by("seq").values_list("amount_paise", flat=True))
        self.assertEqual(amounts, [3000000, 3000000, 1500000, 0])
        self.assertEqual(m.InstalmentBalance.objects.filter(student=student).aggregate(total=Sum("balance_paise"))["total"], 0)
        row = self.get("admin_students?q=STU-0587").json()["rows"][0]
        self.assertFalse(row["fee"]["editable"])
        self.assertTrue(row["actions"]["canArchive"])
        audit = m.AuditLog.objects.get(entity_id=student.pk, action="admin_fee")
        self.assertIn(0, audit.after["_instalments"].values())
        zero = m.Instalment.objects.get(plan__student=student, amount_paise=0)
        details = self.get(f"pay_details?token={sign_pay_token(zero.pk)}").json()
        self.assertEqual((details["paid"], details["amount"], details["payUrl"]), (True, 0, None))
        self.sign_in("accounts@demo.test")
        ledger = self.get("ledger?student=STU-0587").json()
        self.assertEqual(ledger["plan"]["balance"], 0)
        self.assertEqual(ledger["instalments"][-1]["status"], "paid")
