import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

from django.core.exceptions import ImproperlyConfigured

from fees.models import AppSetting


def today() -> date:
    if os.getenv("DEMO_MODE", "false").lower() != "true":
        return datetime.now(ZoneInfo("Asia/Kolkata")).date()
    try:
        value = AppSetting.objects.get(pk="demo_today").value
    except AppSetting.DoesNotExist as exc:
        raise ImproperlyConfigured("DEMO_MODE requires demo_today; run npm run db:seed.") from exc
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ImproperlyConfigured("demo_today must be a valid YYYY-MM-DD date.") from exc
