from fees.models import AttendanceWeekly, GuardianStudent, Instalment, TestScore


def family_for(guardian, requested):
    students = [link.student for link in GuardianStudent.objects.filter(
        guardian=guardian, student__archived_at__isnull=True,
    ).select_related("student__batch__centre").order_by("student__code")]
    selected = next((row for row in students if row.code == requested), None) if requested else (students[0] if students else None)
    if selected is None:
        raise PermissionError("Student not found in your family.")
    return selected, [{"studentId": row.code, "fullName": row.full_name} for row in students]


def student_info(student, guardian=None):
    if guardian is None:
        link = GuardianStudent.objects.filter(student=student).select_related("guardian").order_by(
            "-is_primary", "created_at", "pk").first()
        guardian = link.guardian if link else None
    batch = student.batch
    # Manage validates B10's canonical exam/year/timing names.
    _, exam_year, timing = batch.name.split(" ", 2)
    return {
        "code": student.code, "name": student.full_name, "batch": batch.name,
        "centre": batch.centre.name, "status": student.status, "enrolledOn": student.enrolled_on.isoformat(),
        "guardianPhone": guardian.phone if guardian else "", "preferredLanguage": guardian.language if guardian else "hi",
        "course": {"exam": batch.stream, "examYear": exam_year, "timing": timing,
                   "sessionStart": batch.session_start.isoformat(), "sessionEnd": batch.session_end.isoformat(),
                   "instalments": Instalment.objects.filter(plan__student=student).count()},
    }


def academic_progress(student, date):
    until = min(date, student.withdrawn_on or date)
    attendance = AttendanceWeekly.objects.filter(
        student=student, week_start__gte=student.enrolled_on, week_start__lte=until,
    ).order_by("-week_start")[:8]
    tests = TestScore.objects.filter(
        student=student, test_date__gte=student.enrolled_on, test_date__lte=until,
    ).order_by("-test_date", "test_name", "pk")[:5]
    return {
        "attendance": [{"weekStart": row.week_start.isoformat(), "attended": row.attended, "held": row.held} for row in attendance],
        "tests": [{"testDate": row.test_date.isoformat(), "testName": row.test_name, "score": row.score, "maxScore": row.max_score}
                  for row in tests],
    }
