from django.http import JsonResponse

from fees.auth import cron as cron_auth
from fees.clock import today
from fees.services.reminders import send_due_reminders


@cron_auth
def reminders(request):
    return JsonResponse({"ok": True, **send_due_reminders(today())})
