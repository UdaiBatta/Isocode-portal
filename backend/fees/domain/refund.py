from dataclasses import dataclass
from datetime import date

from fees.domain.dates import add_days, diff_days
from fees.domain.money import gst_split


@dataclass(frozen=True)
class RefundResult:
    total_days: int
    elapsed_days: int
    earned: int
    refund: int
    still_payable: int
    deadline: date
    taxable: int
    cgst: int
    sgst: int


def calculate_refund(*, net: int, paid: int, session_start: date, session_end: date,
                     withdrawal_date: date, deadline_days: int = 10, gst_rate_bps: int = 1800) -> RefundResult:
    if any(type(value) is not int or value < 0 for value in (net, paid, deadline_days, gst_rate_bps)):
        raise ValueError("Money, deadline days and GST rate must be nonnegative integers.")
    total_days = diff_days(session_end, session_start) + 1
    if total_days <= 0:
        raise ValueError("The session must end on or after it starts.")
    elapsed_days = max(0, min(total_days, diff_days(withdrawal_date, session_start) + 1))
    earned = net * elapsed_days // total_days
    refund = max(0, paid - earned)
    gst = gst_split(refund, gst_rate_bps)
    return RefundResult(
        total_days=total_days, elapsed_days=elapsed_days, earned=earned, refund=refund,
        still_payable=max(0, earned - paid), deadline=add_days(withdrawal_date, deadline_days),
        taxable=gst.taxable, cgst=gst.cgst, sgst=gst.sgst,
    )
