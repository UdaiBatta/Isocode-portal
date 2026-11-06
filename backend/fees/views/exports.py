import csv

from django.db.models import Sum
from django.http import HttpResponse

from fees.auth import api
from fees.clock import today
from fees.forms import DashboardQueryForm
from fees.models import InstalmentBalance, Receipt
from fees.services.reporting import scoped_students


def _csv(filename, headings, rows):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Cache-Control"] = "no-store"
    writer = csv.writer(response)
    writer.writerow(headings)
    for row in rows:
        writer.writerow(["'" + value if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")) else value
                         for value in row])
    return response


@api(role="accounts", form=DashboardQueryForm, methods=("GET",))
def dues(request):
    students = scoped_students(request.subject, request.data).filter(status="active")
    rows = InstalmentBalance.objects.filter(student__in=students).values(
        "student__code", "student__full_name", "batch__name", "centre__name",
    ).annotate(balance=Sum("balance_paise")).filter(balance__gt=0).order_by("student__code")
    return _csv(f"dues-{today().isoformat()}.csv", ["Student code", "Name", "Batch", "Centre", "Balance paise"], (
        [row["student__code"], row["student__full_name"], row["batch__name"], row["centre__name"], row["balance"]]
        for row in rows
    ))


@api(role="accounts", form=DashboardQueryForm, methods=("GET",))
def receipts(request):
    date = today()
    rows = Receipt.objects.filter(issued_on__year=date.year, issued_on__month=date.month)
    if request.subject.centre_id:
        rows = rows.filter(payment__student__batch__centre_id=request.subject.centre_id)
    if request.data.get("centre"):
        rows = rows.filter(payment__student__batch__centre__code=request.data["centre"])
    if request.data.get("batch"):
        rows = rows.filter(payment__student__batch_id=request.data["batch"])
    rows = rows.select_related("payment__student").order_by("issued_on", "number")
    return _csv(f"receipts-{date:%Y-%m}.csv", ["Student code", "Date", "Receipt", "Method", "Amount paise"], (
        [row.payment.student.code, row.issued_on.isoformat(), row.number, row.payment.method, row.total_paise]
        for row in rows
    ))
