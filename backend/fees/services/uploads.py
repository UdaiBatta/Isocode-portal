import csv
import io
import re
from datetime import date

from django.db import transaction

from fees.models import AttendanceWeekly, AuditLog, Batch, Student, TestScore


@transaction.atomic
def upload_progress(actor, data):
    batches = Batch.objects.select_for_update().filter(
        pk=data["batchId"], archived_at__isnull=True, centre__archived_at__isnull=True,
    )
    if actor.centre_id:
        batches = batches.filter(centre_id=actor.centre_id)
    batch = batches.first()
    if batch is None:
        return None
    students = {row.code: row for row in Student.objects.select_for_update().filter(
        batch=batch, status="active", archived_at__isnull=True,
    ).order_by("pk")}
    attendance = data["kind"] == "attendance"
    headings = (["student_code", "week_start", "attended", "held"] if attendance else
                ["student_code", "test_date", "test_name", "score", "max_score"])
    reader = csv.reader(io.StringIO(data["csv"], newline=""), strict=True)
    errors, rows = [], []
    count = 0
    try:
        if next(reader, None) != headings:
            return {"rows": 0, "errors": [{"line": 1, "message": "Expected columns: " + ",".join(headings)}], "applied": False}
        while True:
            line = reader.line_num + 1
            values = next(reader, None)
            if values is None:
                break
            count += 1
            if count > 5000:
                errors.append({"line": line, "message": "Upload at most 5,000 rows."})
                break
            try:
                if len(values) != len(headings) or any("\x00" in value for value in values):
                    raise ValueError("Use the expected number of CSV columns without null characters.")
                student = students.get(values[0])
                if student is None:
                    raise ValueError("Student must be active and in the selected batch.")
                if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", values[1]):
                    raise ValueError("Use YYYY-MM-DD dates.")
                on = date.fromisoformat(values[1])
                numbers = values[2:] if attendance else values[3:]
                if any(not re.fullmatch(r"[0-9]{1,10}", value) or int(value) > 2147483647 for value in numbers):
                    raise ValueError("Use non-negative whole numbers up to 2147483647.")
                achieved, maximum = map(int, numbers)
                if achieved > maximum or (not attendance and maximum == 0):
                    raise ValueError("Attended must not exceed held; scores must not exceed a positive max_score.")
                if attendance:
                    rows.append(({"student": student, "week_start": on}, {"attended": achieved, "held": maximum}))
                else:
                    if not values[2].strip() or len(values[2]) > 200:
                        raise ValueError("Use a test_name of 1 to 200 characters.")
                    rows.append(({"student": student, "test_date": on, "test_name": values[2]},
                                 {"score": achieved, "max_score": maximum}))
            except ValueError as exc:
                errors.append({"line": line, "message": str(exc)})
    except csv.Error:
        errors.append({"line": reader.line_num, "message": "Malformed CSV."})
    if count == 0 and not errors:
        errors.append({"line": 1, "message": "Include at least one data row."})
    applied = data["commit"] and not errors
    if applied:
        model = AttendanceWeekly if attendance else TestScore
        records = {tuple(key.values()): model(**key, **defaults) for key, defaults in rows}
        model.objects.bulk_create(list(records.values()), update_conflicts=True,
                                  unique_fields=list(rows[0][0]), update_fields=list(rows[0][1]))
        AuditLog.objects.create(actor_type="staff", actor_id=actor.pk, action="upload_progress", entity="batch",
                                entity_id=batch.pk, after={"kind": data["kind"], "rows": count})
    return {"rows": count, "errors": errors, "applied": applied}
