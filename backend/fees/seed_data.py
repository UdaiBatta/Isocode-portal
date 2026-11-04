"""Fictional, reproducible seed rows; no database, clock or environment access."""

from dataclasses import dataclass
from datetime import date, timedelta
from random import Random

from fees.domain.ledger import InstalmentHistory, split_net

DEMO_TODAY = date(2026, 11, 2)
SESSION_START = date(2026, 4, 1)
SESSION_END = date(2027, 3, 31)
CENTRES = (("MLV", "Malviya Nagar"), ("VSH", "Vaishali Nagar"),
           ("MSR", "Mansarovar"), ("RJP", "Raja Park"))
BATCH_NAMES = ("JEE 2027 Morning", "JEE 2027 Evening", "NEET 2027 Morning", "NEET 2027 Evening")
DUE_DAYS = {"MLV": (10, 15), "VSH": (5, 9), "MSR": (30, 5), "RJP": (2, 20)}
NAMED_CODES = (412, 587, 219, 771, 772, 733, 734, 735, 801, 802, 803, 804)


@dataclass(frozen=True)
class StudentSeed:
    code: str
    name: str
    centre: str
    batch_name: str
    phone: str
    language: str
    discount: int
    discount_reason: str | None
    enrolled_on: date
    instalments: tuple[InstalmentHistory, ...]
    attendance: tuple[tuple[date, int, int], ...]
    tests: tuple[tuple[date, str, int, int], ...]
    refund_status: str | None = None
    withdrawal_date: date | None = None


def due_dates(centre: str, stream: str) -> tuple[date, ...]:
    jee_day, neet_day = DUE_DAYS[centre]
    if stream == "NEET":
        return tuple(date(2026, month, neet_day) for month in [3, 7, 11])
    if centre == "RJP":
        return (date(2026, 5, 2), date(2026, 8, 2), date(2026, 11, 2), date(2027, 2, 2))
    return (date(2026, 4, jee_day), date(2026, 7, jee_day),
            date(2026, 10, jee_day), date(2027, 1, jee_day))


def academic_history(profile: str, enrolled_on: date, rng: Random, withdrawal_date: date | None = None):
    until = min(DEMO_TODAY, withdrawal_date or DEMO_TODAY)
    weeks = [date(2026, 4, 6) + timedelta(weeks=n) for n in range(30)]
    attendance = []
    for index, week in enumerate(weeks):
        if not enrolled_on <= week <= until:
            continue
        attended = (6 if index < 22 else 3) if profile == "high" else rng.choice([5, 6, 6])
        attendance.append((week, attended, 6))
    tests = []
    for month in range(4, 11):
        test_date = date(2026, month, 28)
        if not enrolled_on <= test_date <= until:
            continue
        score = (70 if month < 9 else 45) if profile == "high" else rng.randint(72, 88)
        tests.append((test_date, f"Monthly Test {month - 3}", score, 100))
    return tuple(attendance), tuple(tests)


def build_fleet(small: bool = False) -> tuple[StudentSeed, ...]:
    rng = Random(20261102)
    codes = [n for n in range(1, 2601) if n not in NAMED_CODES]
    if small:
        codes = codes[:200]
    students = []
    for index, code in enumerate(codes):
        centre = CENTRES[index % 4][0]
        batch_name = BATCH_NAMES[(index // 4) % 4]
        stream = batch_name.split()[0]
        profile = "high" if index < 60 else "watch" if index < 160 else "new" if index < 190 else "steady"
        enrolled_on = date(2026, 10, 20) if profile == "new" else SESSION_START
        discount = rng.choice([600000, 1200000, 2400000]) if rng.randrange(100) < 15 else 0
        reason = rng.choice(["Merit", "Sibling"]) if discount else None
        phone = f"+9190001{code:05d}"
        if index and index % 50 == 1:
            phone = students[-1].phone
        language = students[-1].language if index and index % 50 == 1 else ("hi" if rng.randrange(100) < 70 else "en")
        instalments = []
        amounts = split_net(12000000 - discount, 4 if stream == "JEE" else 3)
        for seq, (due, amount) in enumerate(zip(due_dates(centre, stream), amounts, strict=True)):
            allocations = ()
            days = (DEMO_TODAY - due).days
            if days >= 0:
                roll = rng.randrange(100)
                if profile in ["high", "watch"] and seq > 0:
                    allocations = ()
                elif days > 60 and roll < 8:
                    allocations = ((amount, due + timedelta(days=75)),) if roll < 5 and days >= 75 else ()
                elif roll < 13:
                    allocations = ((amount // 2, min(DEMO_TODAY, due + timedelta(days=5))),)
                else:
                    allocations = ((amount, min(DEMO_TODAY, due + timedelta(days=rng.choice([0, 0, 3, 12])))),)
            instalments.append(InstalmentHistory(amount, due, allocations))
        attendance, tests = academic_history(profile, enrolled_on, rng)
        students.append(StudentSeed(f"STU-{code:04d}", f"Demo Student {code:04d}", centre,
                                    batch_name, phone, language, discount, reason, enrolled_on,
                                    tuple(instalments), attendance, tests))
    return tuple(students)


def build_named() -> tuple[StudentSeed, ...]:
    rng = Random(20261102)
    # Counts are fully paid instalments, followed by an optional part payment.
    rows = [
        (412, "Aarav Meena", 0, "hi", 3, 0, None, None),
        (587, "Ishita Sharma", 1, "en", 2, 1500000, None, None),
        (219, "Mohit Gurjar", 2, "hi", 2, 0, None, None),
        (771, "Kavya Joshi", 0, "hi", 2, 0, None, None),
        (772, "Dev Joshi", 2, "hi", 2, 0, None, None),
        (733, "Riya Verma", 1, "hi", 1, 0, None, None),
        (734, "Arjun Yadav", 3, "en", 1, 0, None, None),
        (735, "Neha Kumawat", 0, "hi", 3, 0, None, None),
        (801, "Sameer Rathore", 2, "en", 2, 0, "draft", date(2026, 11, 2)),
        (802, "Ananya Saini", 0, "en", 3, 0, "approved", date(2026, 10, 28)),
        (803, "Yash Jain", 1, "hi", 3, 0, "approved", date(2026, 10, 15)),
        (804, "Pooja Choudhary", 3, "en", 2, 0, "paid", date(2026, 10, 20)),
    ]
    result = []
    for code, name, batch, language, paid_count, partial, refund_status, withdrawal in rows:
        batch_name = BATCH_NAMES[batch]
        stream = batch_name.split()[0]
        instalments = []
        for seq, due in enumerate(due_dates("MLV", stream)):
            amount = 3000000 if stream == "JEE" else 4000000
            paid = amount if seq < paid_count else partial if seq == paid_count else 0
            received_on = date(2026, 10, 20) if code == 735 else due
            allocations = ((paid, received_on),) if paid else ()
            instalments.append(InstalmentHistory(amount, due, allocations))
        enrolled_on = date(2026, 10, 20) if code == 735 else SESSION_START
        profile = "high" if code == 733 else "steady"
        end = withdrawal if refund_status in ["approved", "paid"] else None
        attendance, tests = academic_history(profile, enrolled_on, rng, end)
        phone = "+919000000777" if code in [771, 772] else f"+9190000{code:05d}"
        result.append(StudentSeed(f"STU-{code:04d}", name, "MLV", batch_name, phone, language,
                                  0, None, enrolled_on, tuple(instalments), attendance, tests,
                                  refund_status, withdrawal))
    return tuple(result)
