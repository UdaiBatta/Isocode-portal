from datetime import date, timedelta


def diff_days(a: date, b: date) -> int:
    return (a - b).days


def add_days(value: date, days: int) -> date:
    return value + timedelta(days=days)


def financial_year(value: date) -> str:
    start = value.year if value.month >= 4 else value.year - 1
    return f"{start}-{(start + 1) % 100:02d}"
