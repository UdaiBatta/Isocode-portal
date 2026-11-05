from collections.abc import Iterable
from datetime import date

from fees.domain.dates import add_days, diff_days

REMINDER_STEPS = (-7, -3, 0, 3, 7, 15, 30)


def next_step(due_date: date, today: date, sent_steps: Iterable[int]) -> int | None:
    days_from_due = diff_days(today, due_date)
    latest = max((step for step in REMINDER_STEPS if step <= days_from_due), default=None)
    sent = tuple(sent_steps)
    if latest is None or (sent and latest <= max(sent)):
        return None
    return latest


def next_scheduled_step(due_date: date, today: date, sent_steps: Iterable[int]) -> int | None:
    sent = tuple(sent_steps)
    step = next_step(due_date, today, sent)
    if step is not None:
        return step
    latest_sent = max(sent, default=None)
    return next((step for step in REMINDER_STEPS
                 if (latest_sent is None or step > latest_sent) and add_days(due_date, step) >= today), None)
