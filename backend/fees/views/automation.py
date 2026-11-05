import os
from math import ceil

from django.db.models import Max, Q
from django.http import JsonResponse

from fees.auth import api, error
from fees.clock import today
from fees.domain.dates import add_days
from fees.domain.reminders import next_scheduled_step
from fees.domain.pay_token import sign_pay_token
from fees.forms import AutomationQueryForm, ResolveUnmatchedForm
from fees.models import GuardianStudent, InstalmentBalance, ReminderLog, UnmatchedPayment
from fees.services.payments import UnmatchedPaymentError, resolve_unmatched_payment

PAGE_SIZE = 25


def _row(instalment, *, step, on, language, amount, stopped_reason=None, student=None):
    student = student or instalment.student
    return {
        "instalmentId": f"{student.code}-{instalment.seq}", "studentCode": student.code,
        "studentName": student.full_name, "step": step, "on": on.isoformat() if on else None,
        "language": language, "amount": amount, "stoppedReason": stopped_reason,
        "dueDate": instalment.due_date.isoformat(), "payUrl": f"/pay/{sign_pay_token(instalment.pk)}",
    }


def _queue_rows(request):
    rows = UnmatchedPayment.objects.select_related(
        "suggested_instalment__plan__student", "resolved_by",
    )
    if request.subject.centre_id:
        rows = rows.filter(
            Q(suggested_instalment__isnull=True) |
            Q(suggested_instalment__plan__student__batch__centre_id=request.subject.centre_id)
        )
    return rows.order_by("-received_on", "-created_at", "-pk")


def _counts(request, current_date):
    unmatched = UnmatchedPayment.objects.filter(status="open")
    instalments = InstalmentBalance.objects.filter(
        student__archived_at__isnull=True, balance_paise__gt=0,
        due_date__lt=add_days(current_date, -30),
    )
    if request.subject.centre_id:
        unmatched = unmatched.filter(
            Q(suggested_instalment__isnull=True) |
            Q(suggested_instalment__plan__student__batch__centre_id=request.subject.centre_id)
        )
        instalments = instalments.filter(centre_id=request.subject.centre_id)
    return {"unmatchedOpen": unmatched.count(), "needsCall": instalments.count()}


def _page(total, requested_page):
    total_pages = max(1, ceil(total / PAGE_SIZE))
    page = min(requested_page, total_pages)
    return page, total_pages, (page - 1) * PAGE_SIZE


def _queue_row(item):
    student = item.suggested_instalment.plan.student if item.suggested_instalment_id else None
    return {
        "id": str(item.pk), "receivedOn": item.received_on.isoformat(),
        "amount": item.amount_paise, "reference": item.reference,
        "reason": item.reason,
        "suggested": {
            "instalmentId": str(item.suggested_instalment_id),
            "studentCode": student.code, "studentName": student.full_name,
        } if student else None,
        "status": item.status,
        "resolvedBy": item.resolved_by.full_name if item.resolved_by_id else None,
    }


def _reminder_rows(request, list_name, current_date):
    rows_query = InstalmentBalance.objects.select_related("student").filter(
        student__archived_at__isnull=True,
    )
    if request.subject.centre_id:
        rows_query = rows_query.filter(centre_id=request.subject.centre_id)

    if list_name == "sent":
        logs = ReminderLog.objects.select_related("instalment__plan__student").filter(
            instalment_id__in=rows_query.values("id"),
        )
        total = logs.count()
        return total, lambda offset, page_size: [
            _row(log.instalment, step=log.step, on=log.sent_on, language=log.language,
                 amount=log.amount_paise, student=log.instalment.plan.student)
            for log in logs.order_by("-sent_on", "-created_at", "-pk")[offset:offset + page_size]
        ]

    if list_name == "needsCall":
        rows = rows_query.filter(
            balance_paise__gt=0, due_date__lt=add_days(current_date, -30),
        ).order_by("student__code", "due_date", "seq")
        total = rows.count()

        def get_needs_call(offset, page_size):
            page_rows = list(rows[offset:offset + page_size])
            languages = {}
            for student_id, language in GuardianStudent.objects.filter(
                student_id__in={row.student_id for row in page_rows}, is_primary=True,
            ).order_by("created_at", "pk").values_list("student_id", "guardian__language"):
                languages.setdefault(student_id, language)
            return [
                _row(row, step=None, on=row.due_date,
                     language=languages.get(row.student_id, "hi"), amount=row.balance_paise)
                for row in page_rows
            ]

        return total, get_needs_call

    if list_name == "upcoming":
        rows = list(rows_query.filter(
            balance_paise__gt=0, student__status="active",
            due_date__gte=add_days(current_date, -30), due_date__lte=add_days(current_date, 14),
        ).order_by("student__code", "due_date", "seq"))
        ids = [row.pk for row in rows]
        languages = {}
        for student_id, language in GuardianStudent.objects.filter(
            student_id__in={row.student_id for row in rows}, is_primary=True,
        ).order_by("created_at", "pk").values_list("student_id", "guardian__language"):
            languages.setdefault(student_id, language)
        last_steps = dict(ReminderLog.objects.filter(instalment_id__in=ids).values(
            "instalment_id",
        ).annotate(last_step=Max("step")).values_list("instalment_id", "last_step"))
        reviews = set(UnmatchedPayment.objects.filter(
            status="open", suggested_instalment_id__in=ids,
        ).values_list("suggested_instalment_id", flat=True))
        upcoming = []
        for row in rows:
            language = languages.get(row.student_id)
            if row.pk in reviews or not language:
                continue
            step = next_scheduled_step(row.due_date, current_date, [last_steps[row.pk]] if row.pk in last_steps else [])
            if step is not None:
                scheduled = add_days(row.due_date, step)
                if current_date <= scheduled <= add_days(current_date, 7):
                    upcoming.append(_row(
                        row, step=step, on=scheduled, language=language, amount=row.balance_paise,
                    ))
        return len(upcoming), lambda offset, page_size: upcoming[offset:offset + page_size]

    open_reviews = UnmatchedPayment.objects.filter(
        status="open", suggested_instalment_id__in=rows_query.values("id"),
    ).values("suggested_instalment_id")
    sent_instalments = ReminderLog.objects.filter(
        instalment_id__in=rows_query.values("id"),
    ).values("instalment_id")
    stopped = rows_query.filter(
        Q(balance_paise=0, pk__in=sent_instalments) |
        Q(balance_paise__gt=0, student__status="withdrawn") |
        Q(balance_paise__gt=0, pk__in=open_reviews)
    ).order_by("student__code", "due_date", "seq")
    total = stopped.count()

    def get_stopped(offset, page_size):
        page_rows = list(stopped[offset:offset + page_size])
        ids = [row.pk for row in page_rows]
        languages = {}
        for student_id, language in GuardianStudent.objects.filter(
            student_id__in={row.student_id for row in page_rows}, is_primary=True,
        ).order_by("created_at", "pk").values_list("student_id", "guardian__language"):
            languages.setdefault(student_id, language)
        last_logs = {}
        for log in ReminderLog.objects.filter(instalment_id__in=ids).order_by(
            "-sent_on", "-created_at", "-pk",
        ):
            last_logs.setdefault(log.instalment_id, log)
        result = []
        for row in page_rows:
            last = last_logs.get(row.pk)
            if row.balance_paise == 0:
                reason = "paid"
            elif row.student.status != "active":
                reason = "withdrawn"
            else:
                reason = "payment being checked"
            result.append(_row(
                row, step=last.step if last else None, on=last.sent_on if last else None,
                language=last.language if last else languages.get(row.student_id, "hi"),
                amount=last.amount_paise if last else row.balance_paise, stopped_reason=reason,
            ))
        return result

    return total, get_stopped


@api(role="accounts", methods=("GET",))
def automation_counts(request):
    return JsonResponse({"ok": True, **_counts(request, today())})


@api(role="accounts", form=AutomationQueryForm, methods=("GET",))
def automation(request):
    current_date = today()
    list_name = request.data.get("list") or "upcoming"
    requested_page = request.data.get("page") or 1
    focus = request.data.get("focus")
    if list_name == "unmatched":
        rows = _queue_rows(request)
        total = rows.count()
        if focus:
            item = rows.filter(pk=focus).first()
            if item:
                ahead = rows.filter(
                    Q(received_on__gt=item.received_on) |
                    Q(received_on=item.received_on, created_at__gt=item.created_at) |
                    Q(received_on=item.received_on, created_at=item.created_at, pk__gt=item.pk)
                ).count()
                requested_page = ahead // PAGE_SIZE + 1
        page, total_pages, offset = _page(total, requested_page)
        page_rows = [_queue_row(item) for item in rows[offset:offset + PAGE_SIZE]]
        total = rows.count()
    else:
        total, get_rows = _reminder_rows(request, list_name, current_date)
        page, total_pages, offset = _page(total, requested_page)
        page_rows = get_rows(offset, PAGE_SIZE)

    payload = {
        "ok": True, "today": current_date.isoformat(),
        "demo": os.getenv("DEMO_MODE", "false").lower() == "true",
        "list": list_name, "page": page, "pageSize": PAGE_SIZE,
        "total": total, "totalPages": total_pages,
        **_counts(request, current_date),
        "sent": [], "upcoming": [], "stopped": [], "needsCall": [], "unmatched": [],
    }
    payload[list_name] = page_rows
    return JsonResponse(payload)


@api(role="accounts", form=ResolveUnmatchedForm)
def resolve_unmatched(request):
    item = UnmatchedPayment.objects.select_related(
        "suggested_instalment__plan__student__batch",
    ).filter(pk=request.data["id"]).first()
    if not item:
        return error("not_found", "Payment review not found.", 404)
    if request.subject.centre_id and item.suggested_instalment_id and \
            item.suggested_instalment.plan.student.batch.centre_id != request.subject.centre_id:
        return error("forbidden", "This payment is outside your centre.", 403)
    try:
        result = resolve_unmatched_payment(
            unmatched_id=request.data["id"], action=request.data["action"],
            instalment_id=request.data["instalmentId"], note=request.data["note"],
            resolved_by=request.subject,
        )
    except UnmatchedPaymentError as exc:
        status = {"not_found": 404, "forbidden": 403, "resolved": 409, "withdrawn": 409,
                  "already_paid": 409, "instalment_not_found": 400}.get(exc.code, 400)
        return error(exc.code, str(exc), status)
    return JsonResponse({"ok": True, **result})


@api(role="accounts", methods=("GET",))
def payment_candidates(request):
    rows = InstalmentBalance.objects.filter(
        balance_paise__gt=0, student__status="active", student__archived_at__isnull=True,
    )
    if request.subject.centre_id:
        rows = rows.filter(centre_id=request.subject.centre_id)
    candidates = {}
    for row in rows.order_by("student__code", "seq").values(
        "id", "seq", "balance_paise", "student__code", "student__full_name",
    ):
        code = row["student__code"]
        candidate = candidates.setdefault(code, {
            "code": code, "name": row["student__full_name"], "instalments": [],
        })
        candidate["instalments"].append({
            "id": str(row["id"]), "seq": row["seq"], "balance": row["balance_paise"],
        })
    return JsonResponse({"ok": True, "candidates": list(candidates.values())})
