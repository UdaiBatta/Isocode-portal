import json
import logging
import math
import os
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import F, Window
from django.db.models.functions import RowNumber
from django.utils import timezone

from fees import models as m
from fees.auth import lock_subject
from fees.clock import today
from fees.domain.risk import RiskResult, score_risk, should_create_task

logger = logging.getLogger(__name__)
BRIEF_FEATURES = ("overdueInstalments", "oldestOverdueDays", "attendanceRecentPct", "attendancePriorPct", "testRecentPct", "testEarlierPct")
SYSTEM = """You write a two-sentence note for a school counsellor about to phone a parent.
Use only the facts provided. Do not say the student will drop out. Do not guess causes.
Do not mention money or suggest any fee action. Suggest an open, supportive question to ask."""


class RiskError(Exception):
    def __init__(self, code, message, status=400):
        super().__init__(message)
        self.code, self.status = code, status


@dataclass(frozen=True)
class Assessment:
    student: m.Student
    result: RiskResult
    attendance_weeks: int
    test_count: int


def assess_students(date, centre_id=None):
    students = m.Student.objects.filter(status="active", archived_at__isnull=True).select_related("batch__centre")
    if centre_id:
        students = students.filter(batch__centre_id=centre_id)
    students = list(students.order_by("pk"))
    ids = [row.pk for row in students]
    instalments, attendance, tests = defaultdict(list), defaultdict(list), defaultdict(list)
    for pk, balance, due in m.InstalmentBalance.objects.filter(student_id__in=ids).values_list("student_id", "balance_paise", "due_date"):
        instalments[pk].append((balance, max(0, (date - due).days)))
    weeks = m.AttendanceWeekly.objects.filter(
        student_id__in=ids, held__gt=0, week_start__lte=date, week_start__gte=F("student__enrolled_on"),
    ).annotate(position=Window(RowNumber(), partition_by=[F("student_id")], order_by=F("week_start").desc())).filter(position__lte=8)
    for pk, week, attended, held in weeks.values_list("student_id", "week_start", "attended", "held"):
        attendance[pk].append((week, attended, held))
    marks = m.TestScore.objects.filter(
        student_id__in=ids, test_date__lte=date, test_date__gte=F("student__enrolled_on"),
        max_score__gt=0, score__lte=F("max_score"),
    ).annotate(position=Window(RowNumber(), partition_by=[F("student_id")],
                               order_by=[F("test_date").desc(), F("test_name").desc(), F("pk").desc()])).filter(position__lte=5)
    for pk, on, name, key, score, maximum in marks.values_list("student_id", "test_date", "test_name", "pk", "score", "max_score"):
        tests[pk].append((on, name, key, score, maximum))
    result = []
    for student in students:
        weeks = [(a, h) for _, a, h in sorted(attendance[student.pk])]
        marks = [(s, maximum) for _, _, _, s, maximum in sorted(tests[student.pk])]
        result.append(Assessment(student, score_risk(instalments[student.pk], weeks, marks), len(weeks), len(marks)))
    return result


def _facts(result):
    return {"score": result.score, "reasons": list(result.reasons), "features": result.features}


def task_snapshots(tasks):
    tasks = {task.pk: task for task in tasks}
    snapshots = {}
    for row in m.AuditLog.objects.filter(entity="counsellor_task", entity_id__in=tasks,
                                         action="risk_task_created").order_by("created_at", "pk"):
        # Demo reset reuses seed IDs while preserving old audits; only this task creation's facts belong to it.
        if row.created_at >= tasks[row.entity_id].created_at:
            snapshots.setdefault(row.entity_id, row.after)
    return snapshots


def task_facts(task):
    return task_snapshots([task]).get(task.pk, {"score": task.score, "reasons": task.flag.reasons, "features": task.flag.features})


@transaction.atomic
def run_risk_job(date):
    lock_subject("risk", "job")
    assessments = assess_students(date)
    by_student = {row.student.pk: row for row in assessments}
    # Keep a task's trigger facts even when the same day's derived flag is refreshed.
    tasks = list(m.CounsellorTask.objects.filter(flag__computed_on=date).select_related("flag"))
    captured = task_snapshots(tasks)
    audits = []
    for task in tasks:
        if task.pk in captured:
            continue
        current = by_student.get(task.student_id)
        if task.flag.features.get("syntheticSeed") and task.status == "open" and current and current.result.band == "high":
            task.score = current.result.score
            task.save(update_fields=["score"])
            facts = _facts(current.result)
        else:
            facts = {"score": task.score, "reasons": task.flag.reasons, "features": task.flag.features}
        audits.append(m.AuditLog(actor_type="job", action="risk_task_created", entity="counsellor_task",
                                  entity_id=task.pk, after=facts))
    m.AuditLog.objects.bulk_create(audits)
    flags = [m.RiskFlag(student=row.student, computed_on=date, score=row.result.score, band=row.result.band,
                        reasons=list(row.result.reasons), features={**row.result.features,
                            "attendanceWeeks": row.attendance_weeks, "testsCount": row.test_count})
             for row in assessments if row.result.band != "none"]
    m.RiskFlag.objects.bulk_create(flags, update_conflicts=True, unique_fields=["student", "computed_on"],
                                   update_fields=["score", "band", "reasons", "features"], batch_size=500)
    flags = {row.student_id: row for row in m.RiskFlag.objects.filter(computed_on=date, student_id__in=by_student)}
    open_ids = set(m.CounsellorTask.objects.filter(status="open", student_id__in=by_student).values_list("student_id", flat=True))
    last_false = {}
    for pk, closed_at, score in m.CounsellorTask.objects.filter(
        status="false_flag", student_id__in=by_student, closed_at__date__lte=date,
    ).order_by("-closed_at", "-pk").values_list("student_id", "closed_at", "score"):
        last_false.setdefault(pk, (timezone.localtime(closed_at).date(), score))
    new_tasks, audits = [], []
    for row in assessments:
        pk, result = row.student.pk, row.result
        if should_create_task(result.band, result.score, pk in open_ids, last_false.get(pk), date):
            task = m.CounsellorTask(student=row.student, flag=flags[pk], score=result.score, created_on=date)
            new_tasks.append(task)
            audits.append(m.AuditLog(actor_type="job", action="risk_task_created", entity="counsellor_task",
                                      entity_id=task.pk, after=_facts(result)))
    m.CounsellorTask.objects.bulk_create(new_tasks)
    m.AuditLog.objects.bulk_create(audits)
    return {"scored": len(assessments), "flags": len(flags), "tasksCreated": len(new_tasks)}


def _safe_features(features):
    return {key: features[key] for key in BRIEF_FEATURES if key in features and (
        type(features[key]) is int or type(features[key]) is float and math.isfinite(features[key]))}


def call_model(features):
    # Optional provider dependencies must not prevent the no-key application from starting.
    import anthropic
    from pydantic import BaseModel

    class Brief(BaseModel):
        brief: str

    client = anthropic.Anthropic()
    response = client.with_options(timeout=15.0, max_retries=1).messages.parse(
        model=os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5"), max_tokens=2000, system=SYSTEM,
        messages=[{"role": "user", "content": json.dumps(_safe_features(features))}],
        output_format=Brief, output_config={"effort": "low"},
    )
    if response.stop_reason != "end_turn":
        return None
    return response.parsed_output.brief if response.parsed_output else None


def plain_reasons(reasons):
    legacy = {"attendance_drop": "Attendance decreased", "test_drop": "Test scores decreased", "fees_overdue": "Instalments were overdue"}
    return [legacy.get(reason, reason) for reason in reasons]


def standard_brief(reasons):
    reasons = plain_reasons(reasons)
    return f"Flagged because: {'; '.join(reasons) if reasons else 'several signals changed'}. Ask how things are going; this call is about support, not fees."


def generate_brief(features, call=call_model, *, reasons=()):
    fallback = {"brief": standard_brief(reasons), "briefSource": "template"}
    if not os.getenv("ANTHROPIC_API_KEY"):
        logger.info("risk_brief: missing_key")
        return fallback
    payload = _safe_features(features)
    if not payload:
        logger.warning("risk_brief: missing_numeric_features")
        return fallback
    try:
        text = call(payload)
    except Exception:
        logger.warning("risk_brief: provider_error")
        return fallback
    if text is None:
        logger.warning("risk_brief: empty_or_refused")
        return fallback
    if not isinstance(text, str) or not text.strip() or len(text) > 400 or "₹" in text:
        logger.warning("risk_brief: invalid_text")
        return fallback
    return {"brief": text.strip(), "briefSource": "llm"}


def _task(task_id, actor, *, lock=False):
    if actor.role != "counsellor" or actor.archived_at:
        raise RiskError("forbidden", "A counsellor account is required.", 403)
    query = m.CounsellorTask.objects.filter(pk=task_id)
    if lock:
        query = query.select_for_update()
    row = query.first()
    if not row:
        raise RiskError("not_found", "Call task not found.", 404)
    row = m.CounsellorTask.objects.select_related("student__batch__centre", "flag").get(pk=row.pk)
    if actor.centre_id and row.student.batch.centre_id != actor.centre_id:
        raise RiskError("forbidden", "This student is outside your centre.", 403)
    if row.status == "open" and (row.student.status != "active" or row.student.archived_at):
        raise RiskError("inactive", "This student is no longer active. The call history is retained.", 409)
    return row


@transaction.atomic
def ensure_call_brief(*, task_id, actor):
    task = _task(task_id, actor, lock=True)
    if task.brief:
        return {"brief": task.brief, "briefSource": task.brief_source}
    facts = task_facts(task)
    result = generate_brief(facts["features"], call=call_model, reasons=facts["reasons"])
    task.brief, task.brief_source = result["brief"], result["briefSource"]
    task.save(update_fields=["brief", "brief_source"])
    return result


def counsellor_view(actor):
    date = today()
    tasks = m.CounsellorTask.objects.select_related("student__batch", "flag")
    if actor.centre_id:
        tasks = tasks.filter(student__batch__centre_id=actor.centre_id)
    opened = list(tasks.filter(status="open", student__status="active", student__archived_at__isnull=True).order_by(
        "-score", "created_on", "student__code"))
    closed = list(tasks.exclude(status="open").order_by("-closed_at", "-created_on", "student__code"))
    all_tasks = opened + closed
    snapshots = task_snapshots(all_tasks)
    phones = {}
    for pk, phone in m.GuardianStudent.objects.filter(student_id__in={row.student_id for row in all_tasks}).order_by(
        "-is_primary", "created_at", "pk").values_list("student_id", "guardian__phone"):
        phones.setdefault(pk, phone)

    def task_row(task):
        facts = snapshots.get(task.pk, {"score": task.score, "reasons": task.flag.reasons})
        reasons = plain_reasons(facts["reasons"])
        return {"id": str(task.pk), "studentCode": task.student.code, "studentName": task.student.full_name,
                "batch": task.student.batch.name, "guardianPhone": phones.get(task.student_id, ""),
                "score": facts["score"], "band": "high", "reasons": reasons,
                "brief": task.brief or standard_brief(reasons), "briefSource": task.brief_source,
                "createdOn": task.created_on.isoformat(), "status": task.status, "note": task.note}

    open_ids = {row.student_id for row in opened}
    watch, unknown = [], []
    for row in assess_students(date, actor.centre_id):
        if row.student.pk in open_ids:
            continue
        identity = {"studentCode": row.student.code, "studentName": row.student.full_name, "batch": row.student.batch.name}
        if row.result.band == "watch":
            watch.append({**identity, "score": row.result.score, "reasons": list(row.result.reasons)})
        elif row.result.band == "insufficient":
            missing = []
            if row.attendance_weeks < 4:
                missing.append(f"{row.attendance_weeks} attendance weeks; need at least 4")
            if row.test_count < 3:
                missing.append(f"{row.test_count} test results; need at least 3")
            unknown.append({**identity, "missing": "; ".join(missing)})
    return {"accuracy": {"genuine": sum(row.status == "called" for row in closed), "total": len(closed)},
            "open": [task_row(row) for row in opened], "closed": [task_row(row) for row in closed],
            "watch": sorted(watch, key=lambda row: (-row["score"], row["studentCode"])),
            "unknown": sorted(unknown, key=lambda row: row["studentCode"])}


@transaction.atomic
def close_task(*, task_id, outcome, note, actor):
    lock_subject("risk", "job")
    task = _task(task_id, actor, lock=True)
    if task.status != "open":
        raise RiskError("closed", "This task is already closed.", 409)
    if outcome not in {"called", "false_flag"} or (outcome == "false_flag" and not note.strip()):
        raise RiskError("note_required", "Explain why this was a false flag.")
    before = {"status": task.status, "note": task.note}
    task.status, task.note, task.closed_by = outcome, note.strip() or None, actor
    # Suppression uses the business date; the audit timestamp still records actual wall time.
    task.closed_at = datetime.combine(today(), timezone.localtime().time(), tzinfo=ZoneInfo("Asia/Kolkata"))
    task.save(update_fields=["status", "note", "closed_by", "closed_at"])
    m.AuditLog.objects.create(actor_type="staff", actor_id=actor.pk, action="risk_task_closed",
                             entity="counsellor_task", entity_id=task.pk, before=before,
                             after={"status": task.status, "note": task.note, "score": task.score,
                                    "closedOn": task.closed_at.date().isoformat()})
    return {"taskId": str(task.pk)}
