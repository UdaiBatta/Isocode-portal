from django.http import JsonResponse

from fees.auth import api, error
from fees.clock import today
from fees.forms import DuesQueryForm, LedgerQueryForm
from fees.models import Student
from fees.services.students import academic_progress, family_for, student_info


@api(role="accounts", form=LedgerQueryForm, methods=("GET",))
def student_record(request):
    student = Student.objects.select_related("batch__centre").filter(
        code=request.data["student"], archived_at__isnull=True,
    ).first()
    if not student:
        return error("not_found", "Student not found.", 404)
    if request.subject.centre_id and student.batch.centre_id != request.subject.centre_id:
        return error("forbidden", "Student is outside your centre.", 403)

    return JsonResponse({
        "ok": True, "info": student_info(student), "progress": academic_progress(student, today()),
    })


def _parent_read(request, kind):
    try:
        student, family = family_for(request.subject, request.data["student"])
    except PermissionError as exc:
        return error("forbidden", str(exc), 403)
    if kind == "family":
        result = {"selected": student.code, "family": family}
    elif kind == "info":
        result = student_info(student, request.subject)
    else:
        result = academic_progress(student, today())
    return JsonResponse({"ok": True, **result})


@api(role="parent", form=DuesQueryForm, methods=("GET",))
def family(request):
    return _parent_read(request, "family")


@api(role="parent", form=DuesQueryForm, methods=("GET",))
def info(request):
    return _parent_read(request, "info")


@api(role="parent", form=DuesQueryForm, methods=("GET",))
def progress(request):
    return _parent_read(request, "progress")
