import csv
from xml.etree.ElementTree import Element, SubElement, tostring

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


def _monthly_receipts(request):
    date = today()
    rows = Receipt.objects.filter(issued_on__year=date.year, issued_on__month=date.month)
    if request.subject.centre_id:
        rows = rows.filter(payment__student__batch__centre_id=request.subject.centre_id)
    if request.data.get("centre"):
        rows = rows.filter(payment__student__batch__centre__code=request.data["centre"])
    if request.data.get("batch"):
        rows = rows.filter(payment__student__batch_id=request.data["batch"])
    return rows.select_related("payment__student").order_by("issued_on", "number")


@api(role="accounts", form=DashboardQueryForm, methods=("GET",))
def receipts(request):
    date = today()
    rows = _monthly_receipts(request)
    return _csv(f"receipts-{date:%Y-%m}.csv", ["Student code", "Date", "Receipt", "Method", "Amount paise"], (
        [row.payment.student.code, row.issued_on.isoformat(), row.number, row.payment.method, row.total_paise]
        for row in rows
    ))


def _amount(paise):
    return f"{'-' if paise < 0 else ''}{abs(paise) // 100}.{abs(paise) % 100:02d}"


@api(role="accounts", form=DashboardQueryForm, methods=("GET",))
def tally(request):
    envelope = Element("ENVELOPE")
    SubElement(SubElement(envelope, "HEADER"), "TALLYREQUEST").text = "Import Data"
    body = SubElement(SubElement(envelope, "BODY"), "IMPORTDATA")
    SubElement(SubElement(body, "REQUESTDESC"), "REPORTNAME").text = "Vouchers"
    vouchers = SubElement(body, "REQUESTDATA")
    for receipt in _monthly_receipts(request):
        student = receipt.payment.student
        voucher = SubElement(SubElement(vouchers, "TALLYMESSAGE"), "VOUCHER", VCHTYPE="Receipt", ACTION="Create")
        for name, text in {
            "DATE": receipt.issued_on.strftime("%Y%m%d"), "VOUCHERTYPENAME": "Receipt", "VOUCHERNUMBER": receipt.number,
            "PARTYLEDGERNAME": f"{student.code} {student.full_name}",
            "NARRATION": f"Fee receipt {receipt.number}; taxable INR {_amount(receipt.taxable_paise)}; "
                         f"CGST INR {_amount(receipt.cgst_paise)}; SGST INR {_amount(receipt.sgst_paise)}",
        }.items():
            SubElement(voucher, name).text = text
        ledger = "Cash" if receipt.payment.method == "cash" else "Bank"
        for name, amount in [(f"{student.code} {student.full_name}", receipt.total_paise), (ledger, -receipt.total_paise)]:
            entry = SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            SubElement(entry, "LEDGERNAME").text = name
            SubElement(entry, "ISDEEMEDPOSITIVE").text = "Yes" if amount < 0 else "No"
            SubElement(entry, "AMOUNT").text = _amount(amount)
    response = HttpResponse(tostring(envelope, encoding="utf-8", xml_declaration=True), content_type="text/xml; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="tally-receipts-{today():%Y-%m}.xml"'
    response["Cache-Control"] = "no-store"
    return response
