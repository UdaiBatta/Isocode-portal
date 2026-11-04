from dataclasses import dataclass


@dataclass(frozen=True)
class GstSplit:
    taxable: int
    cgst: int
    sgst: int


def gst_split(amount: int, rate_bps: int = 1800) -> GstSplit:
    if amount < 0 or rate_bps < 0:
        raise ValueError("Amount and GST rate must be nonnegative.")
    denominator = 10000 + rate_bps
    taxable = (2 * amount * 10000 + denominator) // (2 * denominator)
    gst = amount - taxable
    return GstSplit(taxable, gst // 2, gst - gst // 2)
