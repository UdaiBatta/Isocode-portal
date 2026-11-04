from uuid import uuid4

from django.db import models
from django.db.models import F, Q


LANGUAGES = [("hi", "Hindi"), ("en", "English")]


class Record(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class Centre(Record):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=200)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "centres"


class Batch(Record):
    centre = models.ForeignKey(Centre, on_delete=models.PROTECT)
    name = models.CharField(max_length=100)
    stream = models.CharField(max_length=4, choices=[("JEE", "JEE"), ("NEET", "NEET")])
    session_start = models.DateField()
    session_end = models.DateField()
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "batches"
        constraints = [
            models.UniqueConstraint(fields=["centre", "name"], name="batch_centre_name_unique"),
            models.CheckConstraint(condition=Q(stream__in=["JEE", "NEET"]), name="batch_stream_valid"),
        ]


class Student(Record):
    code = models.CharField(max_length=32, unique=True)
    full_name = models.CharField(max_length=200)
    batch = models.ForeignKey(Batch, on_delete=models.PROTECT)
    status = models.CharField(max_length=16, choices=[("active", "Active"), ("withdrawn", "Withdrawn")], default="active")
    enrolled_on = models.DateField()
    withdrawn_on = models.DateField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "students"
        constraints = [models.CheckConstraint(condition=Q(status__in=["active", "withdrawn"]), name="student_status_valid")]


class Guardian(Record):
    phone = models.CharField(max_length=16, unique=True)
    full_name = models.CharField(max_length=200)
    language = models.CharField(max_length=2, choices=LANGUAGES)

    class Meta:
        db_table = "guardians"
        constraints = [models.CheckConstraint(condition=Q(language__in=["hi", "en"]), name="guardian_language_valid")]


class GuardianStudent(Record):
    guardian = models.ForeignKey(Guardian, on_delete=models.CASCADE)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "guardian_students"
        constraints = [models.UniqueConstraint(fields=["guardian", "student"], name="guardian_student_unique")]


class StaffUser(Record):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200)
    password_hash = models.CharField(max_length=256)
    role = models.CharField(max_length=16, choices=[("accounts", "Accounts"), ("counsellor", "Counsellor"), ("admin", "Admin")])
    centre = models.ForeignKey(Centre, null=True, blank=True, on_delete=models.PROTECT)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "staff_users"
        constraints = [models.CheckConstraint(condition=Q(role__in=["accounts", "counsellor", "admin"]), name="staff_role_valid")]


class OtpChallenge(Record):
    phone = models.CharField(max_length=16)
    code_hash = models.CharField(max_length=256)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "otp_challenges"
        indexes = [models.Index(fields=["phone", "created_at"], name="otp_phone_created_idx")]


class LoginAttempt(Record):
    email = models.EmailField()
    at = models.DateTimeField()

    class Meta:
        db_table = "login_attempts"
        indexes = [models.Index(fields=["email", "at"], name="login_email_at_idx")]


class Consent(Record):
    guardian = models.ForeignKey(Guardian, on_delete=models.PROTECT)
    student = models.ForeignKey(Student, on_delete=models.PROTECT)
    wording_version = models.CharField(max_length=32)
    language = models.CharField(max_length=2, choices=LANGUAGES)
    otp_challenge = models.ForeignKey(OtpChallenge, on_delete=models.PROTECT)
    granted_at = models.DateTimeField()
    withdrawn_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "consents"
        constraints = [models.UniqueConstraint(fields=["guardian", "student"], condition=Q(withdrawn_at__isnull=True), name="consent_active_unique")]


class RefundPolicy(Record):
    version = models.CharField(max_length=32, unique=True)
    effective_from = models.DateField()
    deadline_days = models.PositiveSmallIntegerField(default=10)
    text_en = models.TextField()
    text_hi = models.TextField()

    class Meta:
        db_table = "refund_policies"


class FeePlan(Record):
    student = models.OneToOneField(Student, on_delete=models.PROTECT)
    gross_paise = models.BigIntegerField()
    discount_paise = models.BigIntegerField(default=0)
    discount_reason = models.TextField(null=True, blank=True)
    net_paise = models.BigIntegerField()
    gst_rate_bps = models.PositiveIntegerField(default=1800)
    refund_policy = models.ForeignKey(RefundPolicy, on_delete=models.PROTECT)

    class Meta:
        db_table = "fee_plans"
        constraints = [
            models.CheckConstraint(condition=Q(net_paise=F("gross_paise") - F("discount_paise")), name="fee_plan_net_matches"),
            models.CheckConstraint(condition=Q(discount_paise__gte=0), name="fee_plan_discount_nonnegative"),
        ]


class Instalment(Record):
    plan = models.ForeignKey(FeePlan, on_delete=models.PROTECT)
    seq = models.PositiveSmallIntegerField()
    due_date = models.DateField()
    amount_paise = models.BigIntegerField()

    class Meta:
        db_table = "instalments"
        constraints = [
            models.UniqueConstraint(fields=["plan", "seq"], name="instalment_plan_seq_unique"),
            models.CheckConstraint(condition=Q(amount_paise__gt=0), name="instalment_amount_positive"),
        ]


class Payment(Record):
    student = models.ForeignKey(Student, on_delete=models.PROTECT)
    amount_paise = models.BigIntegerField()
    method = models.CharField(max_length=16, choices=[(v, v) for v in ["gateway", "cash", "cheque", "bank"]])
    event_id = models.CharField(max_length=200, null=True, blank=True)
    received_on = models.DateField()
    note = models.TextField(null=True, blank=True)
    recorded_by = models.ForeignKey(StaffUser, null=True, blank=True, on_delete=models.PROTECT)

    class Meta:
        db_table = "payments"
        constraints = [
            models.CheckConstraint(condition=Q(amount_paise__gt=0), name="payment_amount_positive"),
            models.CheckConstraint(condition=Q(method__in=["gateway", "cash", "cheque", "bank"]), name="payment_method_valid"),
        ]


class Allocation(Record):
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT)
    instalment = models.ForeignKey(Instalment, on_delete=models.PROTECT)
    amount_paise = models.BigIntegerField()

    class Meta:
        db_table = "allocations"
        constraints = [models.CheckConstraint(condition=Q(amount_paise__gt=0), name="allocation_amount_positive")]


class Receipt(Record):
    payment = models.OneToOneField(Payment, on_delete=models.PROTECT)
    number = models.CharField(max_length=64, unique=True)
    issued_on = models.DateField()
    taxable_paise = models.BigIntegerField()
    cgst_paise = models.BigIntegerField()
    sgst_paise = models.BigIntegerField()
    total_paise = models.BigIntegerField()

    class Meta:
        db_table = "receipts"
        constraints = [models.CheckConstraint(condition=Q(total_paise=F("taxable_paise") + F("cgst_paise") + F("sgst_paise")), name="receipt_parts_match_total")]


class ReceiptCounter(Record):
    centre = models.ForeignKey(Centre, on_delete=models.PROTECT)
    fy = models.CharField(max_length=7)
    next_seq = models.PositiveIntegerField()

    class Meta:
        db_table = "receipt_counters"
        constraints = [models.UniqueConstraint(fields=["centre", "fy"], name="receipt_counter_centre_fy_unique")]


class PaymentEvent(models.Model):
    event_id = models.CharField(max_length=200, primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)
    payload = models.JSONField()
    result = models.CharField(max_length=16, choices=[(v, v) for v in ["allocated", "queued", "failed", "pending"]])
    unmatched = models.ForeignKey("UnmatchedPayment", null=True, blank=True, on_delete=models.PROTECT)
    payment = models.ForeignKey(Payment, null=True, blank=True, on_delete=models.PROTECT)
    received_at = models.DateTimeField()

    class Meta:
        db_table = "payment_events"
        constraints = [models.CheckConstraint(condition=Q(result__in=["allocated", "queued", "failed", "pending"]), name="payment_event_result_valid")]


class UnmatchedPayment(Record):
    event_id = models.CharField(max_length=200, null=True, blank=True)
    reference = models.CharField(max_length=200, null=True, blank=True)
    amount_paise = models.BigIntegerField()
    reason = models.CharField(max_length=32, choices=[(v, v) for v in ["unknown_reference", "amount_mismatch", "already_paid", "student_withdrawn", "excess_counter_payment"]])
    suggested_instalment = models.ForeignKey(Instalment, null=True, blank=True, on_delete=models.PROTECT)
    status = models.CharField(max_length=16, choices=[(v, v) for v in ["open", "matched", "rejected"]], default="open")
    received_on = models.DateField()
    resolved_by = models.ForeignKey(StaffUser, null=True, blank=True, on_delete=models.PROTECT)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(null=True, blank=True)
    payment = models.ForeignKey(Payment, null=True, blank=True, on_delete=models.PROTECT)

    class Meta:
        db_table = "unmatched_payments"
        constraints = [
            models.CheckConstraint(condition=Q(status__in=["open", "matched", "rejected"]), name="unmatched_status_valid"),
            models.CheckConstraint(condition=Q(reason__in=["unknown_reference", "amount_mismatch", "already_paid", "student_withdrawn", "excess_counter_payment"]), name="unmatched_reason_valid"),
        ]


class ReminderLog(Record):
    instalment = models.ForeignKey(Instalment, on_delete=models.PROTECT)
    step = models.IntegerField()
    language = models.CharField(max_length=2, choices=LANGUAGES)
    channel = models.CharField(max_length=32, default="whatsapp_mock")
    amount_paise = models.BigIntegerField()
    sent_on = models.DateField()

    class Meta:
        db_table = "reminder_log"
        constraints = [models.UniqueConstraint(fields=["instalment", "step"], name="reminder_instalment_step_unique")]


class Refund(Record):
    student = models.OneToOneField(Student, on_delete=models.PROTECT)
    policy = models.ForeignKey(RefundPolicy, on_delete=models.PROTECT)
    withdrawal_date = models.DateField()
    reason = models.TextField()
    net_paise = models.BigIntegerField()
    paid_paise = models.BigIntegerField()
    total_days = models.PositiveIntegerField()
    elapsed_days = models.PositiveIntegerField()
    earned_paise = models.BigIntegerField()
    refund_paise = models.BigIntegerField()
    still_payable_paise = models.BigIntegerField()
    taxable_paise = models.BigIntegerField()
    cgst_paise = models.BigIntegerField()
    sgst_paise = models.BigIntegerField()
    deadline = models.DateField()
    status = models.CharField(max_length=16, choices=[(v, v) for v in ["draft", "approved", "paid"]], default="draft")
    created_by = models.ForeignKey(StaffUser, on_delete=models.PROTECT, related_name="created_refunds")
    approved_by = models.ForeignKey(StaffUser, null=True, blank=True, on_delete=models.PROTECT, related_name="approved_refunds")
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_on = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "refunds"
        constraints = [models.CheckConstraint(condition=Q(status__in=["draft", "approved", "paid"]), name="refund_status_valid")]


class AttendanceWeekly(Record):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    week_start = models.DateField()
    attended = models.PositiveIntegerField()
    held = models.PositiveIntegerField()

    class Meta:
        db_table = "attendance_weekly"
        constraints = [
            models.UniqueConstraint(fields=["student", "week_start"], name="attendance_student_week_unique"),
            models.CheckConstraint(condition=Q(attended__lte=F("held")), name="attendance_not_above_held"),
        ]


class TestScore(Record):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    test_date = models.DateField()
    test_name = models.CharField(max_length=200)
    score = models.PositiveIntegerField()
    max_score = models.PositiveIntegerField()

    class Meta:
        db_table = "test_scores"
        constraints = [models.UniqueConstraint(fields=["student", "test_date", "test_name"], name="test_student_date_name_unique")]


class RiskFlag(Record):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    computed_on = models.DateField()
    score = models.IntegerField(null=True, blank=True)
    band = models.CharField(max_length=16, choices=[(v, v) for v in ["high", "watch", "insufficient"]])
    reasons = models.JSONField()
    features = models.JSONField()

    class Meta:
        db_table = "risk_flags"
        constraints = [
            models.UniqueConstraint(fields=["student", "computed_on"], name="risk_student_date_unique"),
            models.CheckConstraint(condition=Q(band__in=["high", "watch", "insufficient"]), name="risk_band_valid"),
        ]


class CounsellorTask(Record):
    flag = models.ForeignKey(RiskFlag, on_delete=models.PROTECT)
    student = models.ForeignKey(Student, on_delete=models.PROTECT)
    score = models.IntegerField()
    status = models.CharField(max_length=16, choices=[(v, v) for v in ["open", "called", "false_flag"]], default="open")
    brief = models.TextField(null=True, blank=True)
    brief_source = models.CharField(max_length=16, choices=[("llm", "LLM"), ("template", "Template")], default="template")
    created_on = models.DateField()
    note = models.TextField(null=True, blank=True)
    closed_by = models.ForeignKey(StaffUser, null=True, blank=True, on_delete=models.PROTECT)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "counsellor_tasks"
        constraints = [
            models.UniqueConstraint(fields=["student"], condition=Q(status="open"), name="counsellor_student_open_unique"),
            models.CheckConstraint(condition=Q(status__in=["open", "called", "false_flag"]), name="counsellor_status_valid"),
            models.CheckConstraint(condition=Q(brief_source__in=["llm", "template"]), name="counsellor_brief_source_valid"),
        ]


class AuditLog(Record):
    actor_type = models.CharField(max_length=32)
    actor_id = models.UUIDField(null=True, blank=True)
    action = models.CharField(max_length=64)
    entity = models.CharField(max_length=64)
    entity_id = models.UUIDField()
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "audit_log"


class AppSetting(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    value = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_settings"


class InstalmentBalance(models.Model):
    id = models.UUIDField(primary_key=True)
    created_at = models.DateTimeField()
    plan = models.ForeignKey(FeePlan, on_delete=models.DO_NOTHING)
    seq = models.PositiveSmallIntegerField()
    due_date = models.DateField()
    amount_paise = models.BigIntegerField()
    student = models.ForeignKey(Student, on_delete=models.DO_NOTHING)
    batch = models.ForeignKey(Batch, on_delete=models.DO_NOTHING)
    centre = models.ForeignKey(Centre, on_delete=models.DO_NOTHING)
    paid_paise = models.BigIntegerField()
    balance_paise = models.BigIntegerField()

    class Meta:
        managed = False
        db_table = "instalment_balances"
