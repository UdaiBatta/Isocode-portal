from django.http import JsonResponse

from fees.auth import api
from fees.clock import today
from fees.forms import DashboardQueryForm, StudentsQueryForm
from fees.services import reporting


@api(role="accounts", form=DashboardQueryForm, methods=("GET",))
def dashboard(request):
    return JsonResponse({"ok": True, **reporting.dashboard(request.subject, request.data, today())})


@api(role="accounts", form=StudentsQueryForm, methods=("GET",))
def students(request):
    return JsonResponse({"ok": True, **reporting.student_roster(request.subject, request.data, today())})


@api(role="accounts", methods=("GET",))
def staff_directory(request):
    return JsonResponse({"ok": True, **reporting.staff_directory(request.subject)})
