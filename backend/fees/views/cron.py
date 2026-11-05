import os

from django.db import OperationalError
from django.http import JsonResponse

from fees.auth import cron as cron_auth, error
from fees.clock import today
from fees.services.reminders import send_due_reminders
from fees.services.demo import reset_demo
from fees.services.risk import run_risk_job


@cron_auth
def risk(request):
    return JsonResponse({"ok": True, **run_risk_job(today())})


@cron_auth
def reminders(request):
    return JsonResponse({"ok": True, **send_due_reminders(today())})


@cron_auth
def demo_reset(request):
    if os.getenv("DEMO_MODE", "false").lower() != "true":
        return error("demo_only", "Demo controls are unavailable.", 403)
    try:
        result = reset_demo()
    except OperationalError:
        return error("demo_busy", "The demo is busy. Try resetting again after the current operation finishes.", 409)
    return JsonResponse({"ok": True, **result})
