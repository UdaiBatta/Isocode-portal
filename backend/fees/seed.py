"""Insert fictional demo rows. Generating the rows stays in seed_data.py."""

import os
from datetime import datetime, time, timedelta
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from django.contrib.auth.hashers import make_password
from django.core.management.base import CommandError
from django.db import transaction

from fees import models as m
from fees.domain.dates import financial_year
from fees.domain.ledger import InstalmentHistory, over60_metric
from fees.domain.money import gst_split
from fees.policy_text import TEXT_EN, TEXT_HI
from fees.seed_data import (
    BATCH_NAMES, CENTRES, DEMO_TODAY, SESSION_END, SESSION_START,
    build_fleet, build_named,
)

STEPS = (-7, -3, 0, 3, 7, 15, 30)


def seed_id(key):
    return uuid5(NAMESPACE_URL, f"coaching-fees/demo/{key}")


def at_day(day):
    return datetime.combine(day, time(9), tzinfo=ZoneInfo("Asia/Kolkata"))


def seed_organisation():
    for code, name in CENTRES:
        centre, _ = m.Centre.objects.get_or_create(code=code, defaults={"id": seed_id(code), "name": name})
        for batch_name in BATCH_NAMES:
            m.Batch.objects.get_or_create(centre=centre, name=batch_name, defaults={
                "id": seed_id(f"{code}/{batch_name}"), "stream": batch_name.split()[0],
                "session_start": SESSION_START, "session_end": SESSION_END,
            })
    m.RefundPolicy.objects.get_or_create(version="v1", defaults={
        "id": seed_id("policy/v1"), "effective_from": SESSION_START,
        "text_en": TEXT_EN, "text_hi": TEXT_HI,
    })
    for email, name, role, centre in [
        ("accounts@demo.test", "Demo Accounts", "accounts", None),
        ("accounts.mlv@demo.test", "Demo MLV Accounts", "accounts", m.Centre.objects.get(code="MLV")),
        ("counsellor@demo.test", "Demo Counsellor", "counsellor", None),
    ]:
        if not m.StaffUser.objects.filter(email=email).exists():
            m.StaffUser.objects.create(id=seed_id(email), email=email, full_name=name, role=role,
                                       centre=centre, password_hash=make_password(os.environ["SEED_DEMO_PASSWORD"]))


def insert_students(rows, *, named=False, restore=False):
    existing = set(m.Student.objects.filter(code__in=[r.code for r in rows]).values_list("code", flat=True))
    rows = [row for row in rows if restore or row.code not in existing]
    if not rows:
        return 0
    centres = {obj.code: obj for obj in m.Centre.objects.all()}
    batches = {(obj.centre_id, obj.name): obj for obj in m.Batch.objects.all()}
    policy = m.RefundPolicy.objects.get(version="v1")
    accounts = m.StaffUser.objects.get(email="accounts@demo.test")
    counsellor = m.StaffUser.objects.get(email="counsellor@demo.test")
    phones = {row.phone: row.language for row in rows}
    guardians = {obj.phone: obj for obj in m.Guardian.objects.filter(phone__in=phones)}
    new_guardians = [m.Guardian(id=seed_id(phone), phone=phone, language=language,
                               full_name="Demo guardian") for phone, language in phones.items() if phone not in guardians]
    m.Guardian.objects.bulk_create(new_guardians, batch_size=1000)
    guardians.update((obj.phone, obj) for obj in new_guardians)
    students, links, plans, instalments, payments, allocations = [], [], [], [], [], []
    receipts, events, reminders, attendance, scores, consents, challenges = [], [], [], [], [], [], []
    flags, tasks, refunds, audits = [], [], [], []
    counters = {(obj.centre_id, obj.fy): obj for obj in m.ReceiptCounter.objects.select_for_update()}
    old_counter_ids = {obj.pk for obj in counters.values()}
    touched_counters = set()
    challenge_ids = set(m.OtpChallenge.objects.filter(phone__in=phones).values_list("pk", flat=True))
    for row in rows:
        index = int(row.code.removeprefix("STU-")) - 1
        student_id = seed_id(row.code)
        plan_id = seed_id(f"{row.code}/plan")
        centre = centres[row.centre]
        guardian = guardians[row.phone]
        withdrawn = row.refund_status in ["approved", "paid"]
        students.append(m.Student(id=student_id, code=row.code, full_name=row.name,
                                  batch=batches[(centre.pk, row.batch_name)], enrolled_on=row.enrolled_on,
                                  status="withdrawn" if withdrawn else "active",
                                  withdrawn_on=row.withdrawal_date if withdrawn else None))
        links.append(m.GuardianStudent(id=seed_id(f"{row.code}/guardian"), student_id=student_id,
                                       guardian=guardian, is_primary=True))
        plans.append(m.FeePlan(id=plan_id, student_id=student_id, gross_paise=12000000,
                               discount_paise=row.discount, discount_reason=row.discount_reason,
                               net_paise=12000000 - row.discount, refund_policy=policy))
        audits.append(m.AuditLog(actor_type="system", action="seed_plan", entity="fee_plan", entity_id=plan_id,
                                 after={"studentCode": row.code, "grossPaise": 12000000, "discountPaise": row.discount}))
        if not named:
            challenge_id = seed_id(f"{row.phone}/consent-otp")
            if challenge_id not in challenge_ids:
                challenges.append(m.OtpChallenge(id=challenge_id, phone=row.phone, code_hash="seed-consumed",
                                                  expires_at=at_day(row.enrolled_on) + timedelta(minutes=5),
                                                  consumed_at=at_day(row.enrolled_on)))
                challenge_ids.add(challenge_id)
            consents.append(m.Consent(id=seed_id(f"{row.code}/consent"), guardian=guardian,
                                      student_id=student_id, wording_version="v1", language=row.language,
                                      otp_challenge_id=challenge_id, granted_at=at_day(row.enrolled_on)))
        for seq, item in enumerate(row.instalments, 1):
            instalment_id = seed_id(f"{row.code}/instalment/{seq}")
            instalments.append(m.Instalment(id=instalment_id, plan_id=plan_id, seq=seq,
                                            due_date=item.due_date, amount_paise=item.amount_paise))
            for part, (amount, received_on) in enumerate(item.allocations, 1):
                key = f"{row.code}/payment/{seq}/{part}"
                payment_id = seed_id(key)
                method = ("cash", "bank", "gateway", "cheque")[(index + seq) % 4]
                event_id = f"seed/{key}" if method == "gateway" else None
                payments.append(m.Payment(id=payment_id, student_id=student_id, amount_paise=amount,
                                           method=method, event_id=event_id, received_on=received_on,
                                           note="Fictional demo history", recorded_by=accounts if method != "gateway" else None))
                allocations.append(m.Allocation(id=seed_id(f"{key}/allocation"), payment_id=payment_id,
                                                instalment_id=instalment_id, amount_paise=amount))
                fy = financial_year(received_on)
                counter_key = (centre.pk, fy)
                if counter_key not in counters:
                    counters[counter_key] = m.ReceiptCounter(id=seed_id(f"counter/{row.centre}/{fy}"),
                                                             centre=centre, fy=fy, next_seq=1)
                counter = counters[counter_key]
                number = f"{row.centre}/{fy}/{counter.next_seq:06d}"
                counter.next_seq += 1
                touched_counters.add(counter_key)
                gst = gst_split(amount)
                receipts.append(m.Receipt(id=seed_id(f"{key}/receipt"), payment_id=payment_id, number=number,
                                           issued_on=received_on, taxable_paise=gst.taxable, cgst_paise=gst.cgst,
                                           sgst_paise=gst.sgst, total_paise=amount))
                if event_id:
                    events.append(m.PaymentEvent(event_id=event_id, payment_id=payment_id, result="allocated",
                                                  payload={"reference": row.code, "amountPaise": amount},
                                                  received_at=at_day(received_on)))
                audits.append(m.AuditLog(actor_type="system", action="seed_payment", entity="payment",
                                         entity_id=payment_id, after={"studentCode": row.code, "amountPaise": amount,
                                                                    "receivedOn": received_on.isoformat()}))
            if not named or row.code == "STU-0587" and seq == 3:
                for step in STEPS:
                    sent_on = item.due_date + timedelta(days=step)
                    if sent_on >= DEMO_TODAY or sent_on < row.enrolled_on:
                        continue
                    paid = sum(amount for amount, received in item.allocations if received <= sent_on)
                    if paid >= item.amount_paise:
                        continue
                    reminders.append(m.ReminderLog(id=seed_id(f"{row.code}/reminder/{seq}/{step}"),
                                                    instalment_id=instalment_id, step=step, language=row.language,
                                                    amount_paise=item.amount_paise - paid, sent_on=sent_on))
        attendance.extend(m.AttendanceWeekly(id=seed_id(f"{row.code}/attendance/{week}"), student_id=student_id,
                                               week_start=week, attended=attended, held=held)
                          for week, attended, held in row.attendance)
        scores.extend(m.TestScore(id=seed_id(f"{row.code}/test/{test_date}/{name}"), student_id=student_id,
                                  test_date=test_date, test_name=name, score=score, max_score=maximum)
                      for test_date, name, score, maximum in row.tests)
        if named and row.code == "STU-0733" or not named and index < 11:
            computed_on = DEMO_TODAY if named else DEMO_TODAY - timedelta(days=7)
            flag_id = seed_id(f"{row.code}/flag")
            flags.append(m.RiskFlag(id=flag_id, student_id=student_id, computed_on=computed_on,
                                    score=80, band="high", reasons=["attendance_drop", "test_drop", "fees_overdue"],
                                    features={"syntheticSeed": True}))
            status = "open" if named else "called" if index < 8 else "false_flag"
            tasks.append(m.CounsellorTask(id=seed_id(f"{row.code}/task"), flag_id=flag_id,
                                          student_id=student_id, score=80, status=status, created_on=computed_on,
                                          brief_source="template", closed_by=None if named else counsellor,
                                          closed_at=None if named else at_day(DEMO_TODAY - timedelta(days=3)),
                                          note=None if named else "Fictional completed demo call"))
        if row.refund_status:
            total_days = (SESSION_END - SESSION_START).days + 1
            elapsed = max(0, min(total_days, (row.withdrawal_date - SESSION_START).days + 1))
            net = 12000000 - row.discount
            paid = sum(amount for item in row.instalments for amount, _ in item.allocations)
            earned = net * elapsed // total_days
            amount = max(0, paid - earned)
            gst = gst_split(amount)
            refund_id = seed_id(f"{row.code}/refund")
            refunds.append(m.Refund(id=refund_id, student_id=student_id, policy=policy,
                                     withdrawal_date=row.withdrawal_date, reason="Fictional demo withdrawal",
                                     net_paise=net, paid_paise=paid, total_days=total_days, elapsed_days=elapsed,
                                     earned_paise=earned, refund_paise=amount, still_payable_paise=max(0, earned - paid),
                                     taxable_paise=gst.taxable, cgst_paise=gst.cgst, sgst_paise=gst.sgst,
                                     deadline=row.withdrawal_date + timedelta(days=10), status=row.refund_status,
                                     created_by=accounts, approved_by=accounts if withdrawn else None,
                                     approved_at=at_day(row.withdrawal_date) if withdrawn else None,
                                     paid_on=row.withdrawal_date + timedelta(days=5) if row.refund_status == "paid" else None))
            audits.append(m.AuditLog(actor_type="system", action="seed_refund", entity="refund", entity_id=refund_id,
                                     after={"studentCode": row.code, "status": row.refund_status, "refundPaise": amount}))
    if restore:
        m.Student.objects.bulk_update(students, ["status", "withdrawn_on"], batch_size=1000)
        m.FeePlan.objects.bulk_update(plans, ["gross_paise", "discount_paise", "discount_reason", "net_paise", "refund_policy"], batch_size=1000)
        m.Instalment.objects.bulk_update(instalments, ["amount_paise", "due_date"], batch_size=1000)
    else:
        for model, objects in [(m.Student, students), (m.GuardianStudent, links), (m.FeePlan, plans), (m.Instalment, instalments)]:
            model.objects.bulk_create(objects, batch_size=1000)
    for model, objects in [
        (m.Payment, payments), (m.Allocation, allocations), (m.Receipt, receipts), (m.PaymentEvent, events),
        (m.ReminderLog, reminders), (m.AttendanceWeekly, attendance), (m.TestScore, scores),
        (m.OtpChallenge, challenges), (m.Consent, consents), (m.RiskFlag, flags), (m.CounsellorTask, tasks),
        (m.Refund, refunds), (m.AuditLog, audits),
    ]:
        if restore and model in [m.AttendanceWeekly, m.TestScore]:
            continue
        model.objects.bulk_create(objects, batch_size=1000)
    touched = [counters[key] for key in touched_counters]
    m.ReceiptCounter.objects.bulk_create([c for c in touched if c.pk not in old_counter_ids], batch_size=1000)
    m.ReceiptCounter.objects.bulk_update([c for c in touched if c.pk in old_counter_ids], ["next_seq"], batch_size=1000)
    return 0 if restore else len(rows)


def seed_fleet(small=False):
    return insert_students(build_fleet(small))


@transaction.atomic
def seed_named():
    rows = build_named()
    codes = [row.code for row in rows]
    students = m.Student.objects.filter(code__in=codes)
    # Reset demo retains master rows and clears history; an ordinary rerun preserves mutations.
    restore = students.count() == len(rows) and not any([
        m.Payment.objects.filter(student__in=students).exists(),
        m.ReminderLog.objects.filter(instalment__plan__student__in=students).exists(),
        m.Consent.objects.filter(student__in=students).exists(),
        m.Refund.objects.filter(student__in=students).exists(),
        m.RiskFlag.objects.filter(student__in=students).exists(),
        m.CounsellorTask.objects.filter(student__in=students).exists(),
    ])
    inserted = insert_students(rows, named=True, restore=restore)
    seed_queue()
    return inserted


@transaction.atomic
def run_seed(small=False):
    if os.getenv("DEMO_MODE", "false").lower() != "true":
        raise CommandError("The fictional seed requires DEMO_MODE=true.")
    if not os.getenv("SEED_DEMO_PASSWORD"):
        raise CommandError("SEED_DEMO_PASSWORD is required.")
    seed_organisation()
    inserted = seed_fleet(small) + seed_named()
    m.AppSetting.objects.update_or_create(key="demo_today", defaults={"value": DEMO_TODAY.isoformat()})
    return inserted


def seed_queue():
    accounts = m.StaffUser.objects.get(email="accounts@demo.test")
    for index, reason in enumerate(["amount_mismatch", "unknown_reference", "already_paid", "student_withdrawn",
                                    "excess_counter_payment", "unknown_reference"]):
        unmatched_id = seed_id(f"queue/{index}")
        if m.UnmatchedPayment.objects.filter(pk=unmatched_id).exists():
            continue
        event_id = f"seed/queue/{index}"
        amount = 2900000 if index == 0 else 1000000 + index * 100000
        m.UnmatchedPayment.objects.create(id=unmatched_id, event_id=event_id, reference="STU-0771" if index == 0 else None,
                                          amount_paise=amount, reason=reason, status="open", received_on=DEMO_TODAY,
                                          suggested_instalment_id=seed_id("STU-0771/instalment/3") if index == 0 else None)
        m.PaymentEvent.objects.create(event_id=event_id, result="queued", unmatched_id=unmatched_id,
                                       payload={"amountPaise": amount, "syntheticSeed": True}, received_at=at_day(DEMO_TODAY))
        m.AuditLog.objects.create(actor_type="staff", actor_id=accounts.pk, action="seed_unmatched",
                                  entity="unmatched_payment", entity_id=unmatched_id,
                                  after={"amountPaise": amount, "reason": reason})


def database_over60_metric():
    allocations = {}
    for instalment_id, amount, received_on in m.Allocation.objects.values_list("instalment_id", "amount_paise", "payment__received_on"):
        allocations.setdefault(instalment_id, []).append((amount, received_on))
    return over60_metric((InstalmentHistory(amount, due, tuple(allocations.get(pk, [])))
                          for pk, amount, due in m.InstalmentBalance.objects.values_list("id", "amount_paise", "due_date")), DEMO_TODAY)
