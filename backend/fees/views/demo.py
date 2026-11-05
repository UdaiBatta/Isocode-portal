import os

from django.db import OperationalError
from django.http import JsonResponse

from fees.auth import api, error
from fees.clock import today
from fees.forms import DemoDateForm
from fees.models import AppSetting
from fees.services.demo import reset_demo as restore_demo
from fees.services.reminders import send_due_reminders


def _demo_error(request):
    if os.getenv("DEMO_MODE", "false").lower() != "true":
        return error("demo_only", "Demo controls are unavailable.", 403)
    if request.subject.centre_id:
        return error("forbidden", "Shared demo controls require an all-centres accounts user.", 403)


@api(role="accounts", form=DemoDateForm)
def set_demo_date(request):
    if response := _demo_error(request):
        return response
    date = request.data["date"].isoformat()
    AppSetting.objects.update_or_create(key="demo_today", defaults={"value": date})
    return JsonResponse({"ok": True, "date": date})


@api(role="accounts")
def run_reminders_now(request):
    if response := _demo_error(request):
        return response
    return JsonResponse({"ok": True, **send_due_reminders(today())})


@api(role="accounts")
def reset_demo(request):
    if response := _demo_error(request):
        return response
    try:
        result = restore_demo(actor=request.subject)
    except OperationalError:
        return error("demo_busy", "The demo is busy. Try resetting again after the current operation finishes.", 409)
    return JsonResponse({"ok": True, **result})
