from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from fees.clock import today
from fees.domain.refund import RefundResult, calculate_refund
from fees.models import Allocation, AuditLog, FeePlan, Instalment, Refund, Student, UnmatchedPayment


class RefundError(Exception):
    def __init__(self, code, message, status=400):
        super().__init__(message)
        self.code = code
        self.status = status


def _student(code, actor, *, lock=False):
    query = Student.objects.select_related("batch__centre").filter(code=code, archived_at__isnull=True)
    if lock:
        query = query.select_for_update(of=("self",))
    student = query.first()
    if not student:
        raise RefundError("not_found", "Student not found.", 404)
    if actor.centre_id and student.batch.centre_id != actor.centre_id:
        raise RefundError("forbidden", "Student is outside your centre.", 403)
    return student


def _validate_date(student, on, current_date):
    if on < student.enrolled_on or on > current_date:
        raise RefundError("invalid_date", "Choose a withdrawal date between enrolment and today.")


def _calculation(student, plan, on):
    paid = Allocation.objects.filter(instalment__plan__student=student).aggregate(total=Sum("amount_paise"))["total"] or 0
    return calculate_refund(net=plan.net_paise, paid=paid, session_start=student.batch.session_start,
                            session_end=student.batch.session_end, withdrawal_date=on,
                            deadline_days=plan.refund_policy.deadline_days, gst_rate_bps=plan.gst_rate_bps), paid


def _snapshot(plan, calculation, paid):
    return {
        "policy": plan.refund_policy, "net_paise": plan.net_paise, "paid_paise": paid,
        "total_days": calculation.total_days, "elapsed_days": calculation.elapsed_days,
        "earned_paise": calculation.earned, "refund_paise": calculation.refund,
        "still_payable_paise": calculation.still_payable, "deadline": calculation.deadline,
        "taxable_paise": calculation.taxable, "cgst_paise": calculation.cgst, "sgst_paise": calculation.sgst,
    }


def _audit_values(refund):
    return {"status": refund.status, "withdrawalDate": refund.withdrawal_date.isoformat(), "reason": refund.reason,
            "net": refund.net_paise, "paid": refund.paid_paise, "refund": refund.refund_paise,
            "stillPayable": refund.still_payable_paise, "policy": refund.policy.version,
            "totalDays": refund.total_days, "elapsedDays": refund.elapsed_days, "earned": refund.earned_paise,
            "deadline": refund.deadline.isoformat(), "taxable": refund.taxable_paise,
            "cgst": refund.cgst_paise, "sgst": refund.sgst_paise,
            "paidOn": refund.paid_on.isoformat() if refund.paid_on else None}


def _audit(refund, actor, action, before):
    AuditLog.objects.create(actor_type="staff", actor_id=actor.pk, action=action,
                            entity="refund", entity_id=refund.pk, before=before, after=_audit_values(refund))


def get_refund(*, student_code, actor, withdrawal_date=None):
    student = _student(student_code, actor)
    current_date = today()
    refund = Refund.objects.select_related("policy").filter(student=student).first()
    plan = FeePlan.objects.select_related("refund_policy").filter(student=student).first()
    frozen = refund and refund.status in ("approved", "paid")
    on = refund.withdrawal_date if frozen else withdrawal_date or (refund.withdrawal_date if refund else current_date)
    calculation = None
    policy = refund.policy if frozen else plan.refund_policy if plan else None
    if frozen:
        calculation = RefundResult(
            total_days=refund.total_days, elapsed_days=refund.elapsed_days, earned=refund.earned_paise,
            refund=refund.refund_paise, still_payable=refund.still_payable_paise, deadline=refund.deadline,
            taxable=refund.taxable_paise, cgst=refund.cgst_paise, sgst=refund.sgst_paise,
        )
    elif plan:
        _validate_date(student, on, current_date)
        calculation, _ = _calculation(student, plan, on)
    blocked = UnmatchedPayment.objects.filter(
        status="open", suggested_instalment__plan__student=student,
    ).order_by("created_at", "pk").first()
    return {
        "student": {"code": student.code, "name": student.full_name},
        "policy": {"version": policy.version if policy else ""},
        "input": {"withdrawalDate": on.isoformat() if calculation else None, "reason": refund.reason if refund else None},
        "calc": {
            "totalDays": calculation.total_days, "elapsedDays": calculation.elapsed_days,
            "earned": calculation.earned, "refund": calculation.refund, "stillPayable": calculation.still_payable,
            "deadline": calculation.deadline.isoformat(), "taxable": calculation.taxable,
            "cgst": calculation.cgst, "sgst": calculation.sgst,
        } if calculation else None,
        "status": refund.status if refund else "new",
        "blockedBy": {"unmatchedId": str(blocked.pk), "amount": blocked.amount_paise} if blocked else None,
        "overdueDeadline": bool(refund and refund.status == "approved" and current_date > refund.deadline),
    }


@transaction.atomic
def save_refund_draft(*, student_code, withdrawal_date, reason, actor):
    student = _student(student_code, actor, lock=True)
    list(Instalment.objects.select_for_update().filter(plan__student=student).order_by("due_date", "seq"))
    refund = Refund.objects.select_for_update(of=("self",)).select_related("policy").filter(student=student).first()
    if refund and refund.status != "draft":
        raise RefundError("read_only", "Approved refunds are read-only.", 409)
    if student.status != "active":
        raise RefundError("withdrawn", "This student is already withdrawn.", 409)
    _validate_date(student, withdrawal_date, today())
    plan = FeePlan.objects.select_related("refund_policy").filter(student=student).first()
    if not plan:
        raise RefundError("no_plan", "No fee plan is available for refund.", 409)
    calculation, paid = _calculation(student, plan, withdrawal_date)
    before = _audit_values(refund) if refund else None
    if not refund:
        refund = Refund(student=student, created_by=actor)
    for field, value in _snapshot(plan, calculation, paid).items():
        setattr(refund, field, value)
    refund.withdrawal_date = withdrawal_date
    refund.reason = reason
    refund.save()
    _audit(refund, actor, "refund_draft_saved", before)
    return refund


@transaction.atomic
def approve_refund(*, student_code, actor):
    student = _student(student_code, actor, lock=True)
    ids = list(Instalment.objects.select_for_update().filter(plan__student=student).order_by("due_date", "seq").values_list("pk", flat=True))
    refund = Refund.objects.select_for_update(of=("self",)).select_related("policy").filter(student=student).first()
    if not refund or refund.status != "draft":
        raise RefundError("not_draft", "Save a draft before approving the refund.", 409)
    if student.status != "active":
        raise RefundError("withdrawn", "This student is already withdrawn.", 409)
    if UnmatchedPayment.objects.filter(status="open", suggested_instalment_id__in=ids).exists():
        raise RefundError("unmatched", "Resolve the open payment before approving this refund.", 409)
    _validate_date(student, refund.withdrawal_date, today())
    plan = FeePlan.objects.select_related("refund_policy").get(student=student)
    calculation, paid = _calculation(student, plan, refund.withdrawal_date)
    before = _audit_values(refund)
    for field, value in _snapshot(plan, calculation, paid).items():
        setattr(refund, field, value)
    refund.status = "approved"
    refund.approved_by = actor
    refund.approved_at = timezone.now()
    refund.save()
    student.status = "withdrawn"
    student.withdrawn_on = refund.withdrawal_date
    student.save(update_fields=["status", "withdrawn_on"])
    _audit(refund, actor, "refund_approved", before)
    return refund


@transaction.atomic
def mark_refund_paid(*, student_code, actor):
    student = _student(student_code, actor, lock=True)
    refund = Refund.objects.select_for_update(of=("self",)).select_related("policy").filter(student=student).first()
    if not refund or refund.status != "approved":
        raise RefundError("not_approved", "Only approved refunds can be marked paid.", 409)
    before = _audit_values(refund)
    refund.status = "paid"
    refund.paid_on = today()
    refund.save(update_fields=["status", "paid_on"])
    _audit(refund, actor, "refund_paid", before)
    return refund
