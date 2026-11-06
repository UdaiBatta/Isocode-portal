from datetime import timedelta
from decimal import Decimal

from django.db.models import BigIntegerField, Case, CharField, Count, Exists, F, Min, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce

from fees.domain.reminders import next_scheduled_step
from fees.models import Allocation, Batch, Centre, Instalment, InstalmentBalance, Payment, Refund, ReminderLog, Student, UnmatchedPayment


def scoped_students(actor, filters):
    rows = Student.objects.filter(archived_at__isnull=True)
    if actor.centre_id:
        rows = rows.filter(batch__centre_id=actor.centre_id)
    if filters.get("centre"):
        rows = rows.filter(batch__centre__code=filters["centre"])
    if filters.get("batch"):
        rows = rows.filter(batch_id=filters["batch"])
    if filters.get("q"):
        rows = rows.filter(Q(full_name__icontains=filters["q"]) | Q(code__icontains=filters["q"]))
    return rows


def roster_query(actor, filters, date):
    rows = scoped_students(actor, filters).annotate(
        balance=Coalesce(Sum("instalmentbalance__balance_paise"), 0, output_field=BigIntegerField()),
        oldest_due=Min("instalmentbalance__due_date", filter=Q(instalmentbalance__balance_paise__gt=0)),
        checking=Exists(UnmatchedPayment.objects.filter(
            status="open", suggested_instalment__plan__student=OuterRef("pk"),
        )),
    )
    return rows.annotate(list_status=Case(
        When(status="withdrawn", then=Value("withdrawn")),
        When(balance=0, then=Value("clear")),
        When(checking=True, then=Value("checking")),
        When(oldest_due__lt=date, then=Value("overdue")),
        default=Value("upcoming"), output_field=CharField(),
    ))


def student_roster(actor, filters, date):
    rows = roster_query(actor, filters, date)
    statuses = ("overdue", "upcoming", "clear", "checking", "withdrawn")
    over60 = Q(list_status="overdue", oldest_due__lt=date - timedelta(days=60))
    counts = rows.aggregate(all=Count("pk"), over60=Count("pk", filter=over60), **{
        status: Count("pk", filter=Q(list_status=status)) for status in statuses
    })
    if filters.get("status") == "over60":
        rows = rows.filter(over60)
    elif filters.get("status"):
        rows = rows.filter(list_status=filters["status"])
    total = counts.get(filters.get("status"), counts["all"])
    pages = max(1, (total + 24) // 25)
    page = min(filters.get("page") or 1, pages)
    # Future due dates all have zero days overdue, so balance decides their order.
    rows = rows.annotate(sort_due=Case(When(oldest_due__lt=date, then=F("oldest_due")), default=Value(date)))
    latest = Payment.objects.filter(student=OuterRef("pk")).order_by("-received_on", "-created_at", "-pk")
    ordering = ("sort_due", "-balance", "code") if filters.get("status") else ("full_name", "code")
    rows = list(rows.annotate(last_on=Subquery(latest.values("received_on")[:1]),
                              last_method=Subquery(latest.values("method")[:1])).select_related("batch__centre").order_by(
        *ordering,
    )[(page - 1) * 25:page * 25])
    ids = [row.pk for row in rows]
    first_unpaid = {}
    for instalment in InstalmentBalance.objects.filter(student_id__in=ids, balance_paise__gt=0).order_by("due_date", "seq"):
        first_unpaid.setdefault(instalment.student_id, instalment)
    instalment_ids = [row.pk for row in first_unpaid.values()]
    sent = {}
    for pk, step in ReminderLog.objects.filter(instalment_id__in=instalment_ids).values_list("instalment_id", "step"):
        sent.setdefault(pk, []).append(step)
    held = set(UnmatchedPayment.objects.filter(status="open", suggested_instalment_id__in=instalment_ids).values_list(
        "suggested_instalment_id", flat=True,
    ))
    result = []
    for row in rows:
        instalment = first_unpaid.get(row.pk)
        stopped = "withdrawn" if row.status == "withdrawn" and instalment else (
            "payment being checked" if instalment and instalment.pk in held else None)
        step = next_scheduled_step(instalment.due_date, date, sent.get(instalment.pk, [])) if instalment and not stopped else None
        result.append({
            "id": str(row.pk), "code": row.code, "name": row.full_name, "batch": row.batch.name,
            "centre": row.batch.centre.name, "status": row.list_status, "balance": row.balance,
            "daysOverdue": max(0, (date - row.oldest_due).days) if row.oldest_due else 0,
            "next": (instalment.due_date + timedelta(days=step)).isoformat() if step is not None else None,
            "stopped": stopped, "lastPayment": {"on": row.last_on.isoformat(), "method": row.last_method} if row.last_on else None,
        })
    return {"today": date.isoformat(), "canPickCentre": not actor.centre_id,
            "rows": result, "page": page, "pages": pages, "counts": counts}


def dashboard(actor, filters, date):
    students = scoped_students(actor, filters)
    balances = InstalmentBalance.objects.filter(student__in=students, student__status="active")
    buckets = {
        "notDue": Q(due_date__gte=date),
        "d1_30": Q(due_date__lt=date, due_date__gte=date - timedelta(days=30)),
        "d31_60": Q(due_date__lt=date - timedelta(days=30), due_date__gte=date - timedelta(days=60)),
        "d61_90": Q(due_date__lt=date - timedelta(days=60), due_date__gte=date - timedelta(days=90)),
        "d90p": Q(due_date__lt=date - timedelta(days=90)),
    }
    grouped = {row["batch_id"]: row for row in balances.values("batch_id").annotate(
        studentsWithDues=Count("student_id", distinct=True, filter=Q(balance_paise__gt=0)),
        outstanding=Coalesce(Sum("balance_paise"), 0, output_field=BigIntegerField()),
        **{key: Coalesce(Sum("balance_paise", filter=value), 0, output_field=BigIntegerField()) for key, value in buckets.items()},
    )}
    batches = Batch.objects.select_related("centre").filter(archived_at__isnull=True, centre__archived_at__isnull=True)
    if actor.centre_id:
        batches = batches.filter(centre_id=actor.centre_id)
    if filters.get("centre"):
        batches = batches.filter(centre__code=filters["centre"])
    if filters.get("batch"):
        batches = batches.filter(pk=filters["batch"])
    keys = ("studentsWithDues", "outstanding", *buckets)
    rows, centres = [], {}
    for batch in batches.order_by("centre__code", "name", "pk"):
        values = grouped.get(batch.pk, {})
        row = {"id": str(batch.pk), "label": batch.name, "kind": "batch", **{key: values.get(key, 0) for key in keys}}
        rows.append(row)
        centre = centres.setdefault(batch.centre_id, {
            "id": batch.centre.code, "label": batch.centre.name, "kind": "centre", "children": [], **dict.fromkeys(keys, 0),
        })
        centre["children"].append(row)
        for key in keys:
            centre[key] += row[key]
    # The historical metric includes late allocations even after an instalment is cleared.
    past = Instalment.objects.filter(plan__student__in=students, due_date__lt=date)
    denominator = past.aggregate(total=Sum("amount_paise"))["total"] or 0
    old = past.filter(due_date__lt=date - timedelta(days=60))
    old_amount = old.aggregate(total=Sum("amount_paise"))["total"] or 0
    # Materialize scoped IDs to avoid deeply nested semi-joins on sparse-data query plans.
    past_ids = list(past.values_list("pk", flat=True))
    old_ids = list(old.values_list("pk", flat=True))
    received = Allocation.objects.filter(instalment_id__in=old_ids, payment__received_on__lte=date).aggregate(
        total=Sum("amount_paise"))["total"] or 0
    late = Allocation.objects.filter(
        instalment_id__in=past_ids, payment__received_on__lte=date,
        payment__received_on__gt=F("instalment__due_date") + timedelta(days=60),
    ).aggregate(total=Sum("amount_paise"))["total"] or 0
    refunds = Refund.objects.filter(student__in=students, status="approved")
    return {
        "today": date.isoformat(), "canPickCentre": not actor.centre_id,
        "totals": {"outstanding": sum(row["outstanding"] for row in rows),
                   "overdue": sum(row["outstanding"] - row["notDue"] for row in rows),
                   "over60Pct": float(Decimal(old_amount - received + late) * 100 / denominator) if denominator else 0,
                   "refundsDue": refunds.count(), "refundsLate": refunds.filter(deadline__lt=date).count()},
        "rows": rows if filters.get("group") == "batch" else list(centres.values()),
    }


def staff_directory(actor):
    centres = Centre.objects.filter(archived_at__isnull=True)
    batches = Batch.objects.filter(archived_at__isnull=True, centre__archived_at__isnull=True)
    students = scoped_students(actor, {})
    if actor.centre_id:
        centres = centres.filter(pk=actor.centre_id)
        batches = batches.filter(centre_id=actor.centre_id)
    return {
        "centres": [{"id": row.code, "name": row.name} for row in centres.order_by("code")],
        "batches": [{"id": str(row.pk), "name": row.name, "centreId": row.centre.code}
                    for row in batches.select_related("centre").order_by("centre__code", "name")],
        "students": [{"code": row.code, "name": row.full_name, "centreId": row.batch.centre.code, "batchId": str(row.batch_id)}
                     for row in students.select_related("batch__centre").order_by("full_name", "code")],
    }
