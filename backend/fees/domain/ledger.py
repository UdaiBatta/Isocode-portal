from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Iterable

from fees.domain.dates import diff_days


@dataclass(frozen=True)
class InstalmentView:
    status: str
    part_paid: bool
    balance: int
    days_overdue: int
    due_in_days: int


@dataclass(frozen=True)
class InstalmentHistory:
    amount_paise: int
    due_date: date
    allocations: tuple[tuple[int, date], ...] = ()


@dataclass(frozen=True)
class Over60Metric:
    numerator: int
    denominator: int

    @property
    def pct(self) -> Decimal:
        return Decimal(self.numerator) * 100 / self.denominator if self.denominator else Decimal(0)


def split_net(net: int, count: int) -> list[int]:
    if net < 0 or count <= 0:
        raise ValueError("Net must be nonnegative and instalment count positive.")
    amount = net // count
    return [amount] * (count - 1) + [net - amount * (count - 1)]


def instalment_view(amount: int, paid: int, due_date: date, today: date) -> InstalmentView:
    if amount <= 0 or not 0 <= paid <= amount:
        raise ValueError("Paid amount must be between zero and the positive instalment amount.")
    balance = amount - paid
    days = diff_days(today, due_date)
    status = "paid" if not balance else "overdue" if days > 0 else "due_today" if days == 0 else "upcoming"
    return InstalmentView(status, 0 < paid < amount, balance,
                          max(0, days) if balance else 0,
                          max(0, -days) if balance else 0)


def allocate_oldest_first(amount: int, balances: list[int]) -> tuple[list[int], int]:
    if amount < 0 or any(balance < 0 for balance in balances):
        raise ValueError("Payment and balances must be nonnegative.")
    allocations = []
    for balance in balances:
        if not amount:
            break
        allocated = min(amount, balance)
        allocations.append(allocated)
        amount -= allocated
    return allocations, amount


def ageing_bucket(days_from_due: int) -> str:
    if days_from_due <= 0:
        return "not_due"
    if days_from_due <= 30:
        return "1–30"
    if days_from_due <= 60:
        return "31–60"
    if days_from_due <= 90:
        return "61–90"
    return "90+"


def over60_metric(instalments: Iterable[InstalmentHistory], today: date) -> Over60Metric:
    numerator = denominator = 0
    for row in instalments:
        days = diff_days(today, row.due_date)
        if days <= 0:
            continue
        denominator += row.amount_paise
        received = [(amount, received_on) for amount, received_on in row.allocations if received_on <= today]
        numerator += sum(amount for amount, received_on in received
                         if diff_days(received_on, row.due_date) > 60)
        if days > 60:
            numerator += row.amount_paise - sum(amount for amount, _ in received)
    return Over60Metric(numerator, denominator)
