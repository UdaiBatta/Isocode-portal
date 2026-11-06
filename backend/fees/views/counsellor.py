from django.http import JsonResponse

from fees.auth import api, error
from fees.forms import CloseTaskForm, TaskForm
from fees.services import risk


@api(role="counsellor", methods=("GET",))
def counsellor(request):
    return JsonResponse({"ok": True, **risk.counsellor_view(request.subject)})


@api(role="counsellor", form=TaskForm)
def ensure_brief(request):
    try:
        result = risk.ensure_call_brief(task_id=request.data["taskId"], actor=request.subject)
    except risk.RiskError as exc:
        return error(exc.code, str(exc), exc.status)
    return JsonResponse({"ok": True, **result})


@api(role="counsellor", form=CloseTaskForm)
def close_task(request):
    try:
        result = risk.close_task(task_id=request.data["taskId"], outcome=request.data["outcome"],
                                 note=request.data["note"], actor=request.subject)
    except risk.RiskError as exc:
        return error(exc.code, str(exc), exc.status)
    return JsonResponse({"ok": True, **result})
