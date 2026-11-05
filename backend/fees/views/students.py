from django.http import JsonResponse

from fees.auth import api, error
from fees.clock import today
from fees.forms import LedgerQueryForm
from fees.models import AttendanceWeekly, GuardianStudent, Instalment, Student, TestScore


@api(role="accounts", form=LedgerQueryForm, methods=("GET",))
def student_record(request):
    student = Student.objects.select_related("batch__centre").filter(
        code=request.data["student"], archived_at__isnull=True,
    ).first()
    if not student:
        return error("not_found", "Student not found.", 404)
    if request.subject.centre_id and student.batch.centre_id != request.subject.centre_id:
        return error("forbidden", "Student is outside your centre.", 403)

    link = GuardianStudent.objects.filter(student=student).select_related("guardian").order_by(
        "-is_primary", "created_at", "pk",
    ).first()
    batch = student.batch
    # B10 batch names encode the exam year and timing; Manage must preserve this contract.
    _, exam_year, timing = batch.name.split(" ", 2)
    date = today()
    until = min(date, student.withdrawn_on or date)
    attendance = AttendanceWeekly.objects.filter(
        student=student, week_start__gte=student.enrolled_on, week_start__lte=until,
    ).order_by("-week_start")[:8]
    tests = TestScore.objects.filter(
        student=student, test_date__gte=student.enrolled_on, test_date__lte=until,
    ).order_by("-test_date", "test_name", "pk")[:5]
    return JsonResponse({
        "ok": True,
        "info": {
            "code": student.code, "name": student.full_name, "batch": batch.name,
            "centre": batch.centre.name, "status": student.status,
            "enrolledOn": student.enrolled_on.isoformat(),
            "guardianPhone": link.guardian.phone if link else "",
            "preferredLanguage": link.guardian.language if link else "hi",
            "course": {
                "exam": batch.stream, "examYear": exam_year, "timing": timing,
                "sessionStart": batch.session_start.isoformat(), "sessionEnd": batch.session_end.isoformat(),
                "instalments": Instalment.objects.filter(plan__student=student).count(),
            },
        },
        "progress": {
            "attendance": [{"weekStart": row.week_start.isoformat(), "attended": row.attended, "held": row.held}
                           for row in attendance],
            "tests": [{"testDate": row.test_date.isoformat(), "testName": row.test_name,
                       "score": row.score, "maxScore": row.max_score} for row in tests],
        },
    })
