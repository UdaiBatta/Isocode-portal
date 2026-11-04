from django import forms

from fees.domain.phone import normalize_phone


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
