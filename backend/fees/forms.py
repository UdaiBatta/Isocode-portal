from django import forms

from fees.domain.phone import normalize_phone


def _clean_paise(value):
    if type(value) is not int:
        raise forms.ValidationError("Enter the amount as whole paise.")
    return value


class PhoneForm(forms.Form):
    phone = forms.CharField(max_length=40)

    def clean_phone(self):
        phone = normalize_phone(self.cleaned_data["phone"])
        if phone is None:
            raise forms.ValidationError("Enter a valid Indian mobile number.")
        return phone


class VerifyOtpForm(PhoneForm):
    code = forms.RegexField(r"^[0-9]{6}$", max_length=6)


class StaffLoginForm(forms.Form):
    email = forms.EmailField(max_length=254)
    password = forms.CharField(max_length=256, strip=False)

    def clean_email(self):
        return self.cleaned_data["email"].lower()


class LanguageForm(forms.Form):
    language = forms.ChoiceField(choices=[("hi", "Hindi"), ("en", "English")])


class GrantConsentForm(LanguageForm):
    studentIds = forms.JSONField()
    wordingVersion = forms.ChoiceField(choices=[("v1", "v1")])

    def clean(self):
        data = super().clean()
        values = data.get("studentIds")
        if not isinstance(values, list) or not values or any(not isinstance(value, str) for value in values):
            self.add_error("studentIds", "Select linked children.")
        elif len(set(values)) != len(values):
            self.add_error("studentIds", "Each child can be selected once.")
        return data


class DuesQueryForm(forms.Form):
    student = forms.CharField(required=False, max_length=32)


class LedgerQueryForm(forms.Form):
    student = forms.RegexField(r"^STU-[0-9]{4}$", max_length=32)


class DashboardQueryForm(forms.Form):
    group = forms.ChoiceField(required=False, choices=[("centre", "centre"), ("batch", "batch")])
    centre = forms.CharField(required=False, max_length=32)
    batch = forms.UUIDField(required=False)


class StudentsQueryForm(DashboardQueryForm):
    status = forms.ChoiceField(required=False, choices=[(value, value) for value in (
        "overdue", "upcoming", "clear", "checking", "withdrawn", "over60",
    )])
    q = forms.CharField(required=False, max_length=200)
    page = forms.IntegerField(required=False, min_value=1, max_value=100000)


class DemoDateForm(forms.Form):
    date = forms.DateField(input_formats=["%Y-%m-%d"])


class RefundQueryForm(LedgerQueryForm):
    withdrawalDate = forms.DateField(required=False, input_formats=["%Y-%m-%d"])


class RefundDraftForm(forms.Form):
    studentId = forms.RegexField(r"^STU-[0-9]{4}$", max_length=32)
    withdrawalDate = forms.DateField(input_formats=["%Y-%m-%d"])
    reason = forms.ChoiceField(choices=[(value, value) for value in ["Personal", "Moved city", "Changed course", "Health", "Other"]])


class RefundActionForm(forms.Form):
    refundId = forms.RegexField(r"^STU-[0-9]{4}$", max_length=32)


class ReceiptListQueryForm(forms.Form):
    student = forms.RegexField(r"^STU-[0-9]{4}$", required=False, max_length=32)


class ReceiptQueryForm(forms.Form):
    id = forms.UUIDField()


class CounterPaymentForm(forms.Form):
    student = forms.RegexField(r"^STU-[0-9]{4}$", max_length=32)
    amount_paise = forms.IntegerField(min_value=1)
    method = forms.ChoiceField(choices=[("cash", "Cash"), ("cheque", "Cheque"), ("bank", "Bank")])
    received_on = forms.DateField(input_formats=["%Y-%m-%d"])
    note = forms.CharField(required=False, max_length=300)

    def clean_amount_paise(self):
        return _clean_paise(self.data.get("amount_paise"))


class PayTokenQueryForm(forms.Form):
    token = forms.CharField(max_length=256)


class PaymentResultQueryForm(PayTokenQueryForm):
    eventId = forms.CharField(max_length=200)


class PaymentWebhookForm(forms.Form):
    event_id = forms.CharField(max_length=200)
    reference = forms.CharField(required=False, max_length=200)
    amount_paise = forms.IntegerField(min_value=1)
    status = forms.ChoiceField(choices=[("success", "success"), ("failed", "failed"), ("pending", "pending")])
    paid_on = forms.DateField(input_formats=["%Y-%m-%d"])
    method = forms.ChoiceField(choices=[("upi", "upi"), ("card", "card"), ("netbanking", "netbanking")])

    def clean_amount_paise(self):
        return _clean_paise(self.data.get("amount_paise"))

    def clean_reference(self):
        return self.cleaned_data["reference"] or None


class ResolveUnmatchedForm(forms.Form):
    id = forms.UUIDField()
    action = forms.ChoiceField(choices=[("match", "Match"), ("reject", "Reject")])
    instalmentId = forms.UUIDField(required=False)
    note = forms.CharField(required=False, max_length=300)

    def clean(self):
        data = super().clean()
        if data.get("action") == "match" and not data.get("instalmentId"):
            self.add_error("instalmentId", "Choose a student and instalment.")
        if data.get("action") == "reject" and not data.get("note"):
            self.add_error("note", "A rejection reason is required.")
        return data


class AutomationQueryForm(forms.Form):
    list = forms.ChoiceField(required=False, choices=[
        (value, value) for value in ("sent", "upcoming", "stopped", "needsCall", "unmatched")
    ])
    page = forms.IntegerField(required=False, min_value=1, max_value=100000)
    focus = forms.UUIDField(required=False)


class AdminListForm(forms.Form):
    q = forms.CharField(required=False, max_length=200)
    centre = forms.UUIDField(required=False)
    batch = forms.UUIDField(required=False)
    state = forms.ChoiceField(required=False, choices=[("active", "active"), ("archived", "archived")])
    page = forms.IntegerField(required=False, min_value=1, max_value=100000)


class AdminHistoryForm(forms.Form):
    entity = forms.ChoiceField(required=False, choices=[(value, value) for value in ("student", "batch", "centre", "staff")])
    id = forms.UUIDField(required=False)
    page = forms.IntegerField(required=False, min_value=1, max_value=100000)


class AdminCentreForm(forms.Form):
    id = forms.UUIDField(required=False)
    code = forms.RegexField(r"^[A-Z]{3}$")
    name = forms.CharField(min_length=2, max_length=80)


class AdminBatchForm(forms.Form):
    id = forms.UUIDField(required=False)
    name = forms.RegexField(r"^(JEE|NEET) 20[0-9]{2} (Morning|Evening)$")
    centreId = forms.UUIDField()
    stream = forms.ChoiceField(choices=[("JEE", "JEE"), ("NEET", "NEET")])
    sessionStart = forms.DateField(input_formats=["%Y-%m-%d"])
    sessionEnd = forms.DateField(input_formats=["%Y-%m-%d"])


class AdminStaffForm(forms.Form):
    id = forms.UUIDField(required=False)
    fullName = forms.CharField(min_length=2, max_length=80)
    email = forms.EmailField(max_length=120)
    role = forms.ChoiceField(choices=[(value, value) for value in ("admin", "accounts", "counsellor")])
    centreId = forms.UUIDField(required=False)
    password = forms.CharField(required=False, min_length=12, max_length=128, strip=False)


class AdminStudentForm(forms.Form):
    id = forms.UUIDField(required=False)
    fullName = forms.CharField(min_length=2, max_length=80)
    batchId = forms.UUIDField()
    enrolledOn = forms.DateField(input_formats=["%Y-%m-%d"])
    guardianName = forms.CharField(min_length=2, max_length=80)
    guardianPhone = forms.CharField(max_length=40)
    guardianLanguage = forms.ChoiceField(choices=[("hi", "hi"), ("en", "en")])
    gross = forms.IntegerField(required=False, min_value=1, max_value=9007199254740991)
    discount = forms.IntegerField(required=False, min_value=0, max_value=9007199254740991)
    discountReason = forms.CharField(required=False, min_length=5, max_length=200)

    def clean_guardianPhone(self):
        phone = normalize_phone(self.cleaned_data["guardianPhone"])
        if phone is None:
            raise forms.ValidationError("Enter a valid Indian mobile number.")
        return phone

    def clean_gross(self):
        return _clean_paise(self.data["gross"]) if self.cleaned_data["gross"] is not None else None

    def clean_discount(self):
        return _clean_paise(self.data["discount"]) if self.cleaned_data["discount"] is not None else 0


class AdminFeeForm(forms.Form):
    studentId = forms.UUIDField()
    gross = forms.IntegerField(min_value=1, max_value=9007199254740991)
    discount = forms.IntegerField(min_value=0, max_value=9007199254740991)
    reason = forms.CharField(min_length=5, max_length=200)

    def clean_gross(self):
        return _clean_paise(self.data["gross"])

    def clean_discount(self):
        return _clean_paise(self.data["discount"])


class AdminTargetForm(forms.Form):
    entity = forms.ChoiceField(choices=[(value, value) for value in ("student", "batch", "centre", "staff")])
    id = forms.UUIDField()
