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


class DemoDateForm(forms.Form):
    date = forms.DateField(input_formats=["%Y-%m-%d"])


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
