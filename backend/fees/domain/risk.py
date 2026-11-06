from dataclasses import dataclass
from datetime import date
from math import floor
from typing import Sequence


@dataclass(frozen=True)
class RiskResult:
    score: int | None
    band: str
    fee: int
    attendance: int
    tests: int
    reasons: tuple[str, ...]
    features: dict[str, int]


def score_risk(instalments: Sequence[tuple[int, int]], attendance: Sequence[tuple[int, int]],
               tests: Sequence[tuple[int, int]]) -> RiskResult:
    """Inputs are (balance, days overdue), (attended, held), (score, maximum), oldest first."""
    if any(type(balance) is not int or type(days) is not int or balance < 0 for balance, days in instalments):
        raise ValueError("Instalment balances and days must be integers, with nonnegative balances.")
    if any(type(a) is not int or type(h) is not int or not 0 <= a <= h for a, h in attendance):
        raise ValueError("Attendance must contain valid nonnegative integer counts.")
    if any(type(s) is not int or type(m) is not int or not 0 <= s <= m or m <= 0 for s, m in tests):
        raise ValueError("Test scores must be integers within a positive maximum.")
    attendance = [(a, h) for a, h in attendance if h > 0]
    if len(attendance) < 4 or len(tests) < 3:
        return RiskResult(None, "insufficient", 0, 0, 0, (), {})
    overdue = [days for balance, days in instalments if balance > 0 and days > 15]
    oldest = max(overdue, default=0)
    fee = min(40, 10 + 10 * (len(overdue) - 1) + min(20, floor(oldest / 3))) if overdue else 0
    recent = sum(a for a, _ in attendance[-4:]) / sum(h for _, h in attendance[-4:])
    prior = sum(a for a, _ in attendance[-8:-4]) / sum(h for _, h in attendance[-8:-4]) if len(attendance) >= 8 else None
    drop = (prior - recent) * 100 if prior is not None else 0
    drop_points = min(25, max(0, floor(drop - 5 + 0.5)))
    level_points = min(10, floor((0.75 - recent) * 100 / 2 + 0.5)) if recent < 0.75 else 0
    att = min(35, drop_points + level_points)
    percentages = [score * 100 / maximum for score, maximum in tests[-5:]]
    earlier_mean = sum(percentages[:-2]) / len(percentages[:-2])
    recent_mean = sum(percentages[-2:]) / 2
    test = min(25, max(0, floor(earlier_mean - recent_mean - 3 + 0.5)))
    score = fee + att + test
    band = "high" if score >= 60 else "watch" if score >= 35 else "none"
    features = {"overdueInstalments": len(overdue), "oldestOverdueDays": oldest,
                "attendanceRecentPct": floor(recent * 100 + 0.5),
                "testRecentPct": floor(recent_mean + 0.5), "testEarlierPct": floor(earlier_mean + 0.5)}
    if prior is not None:
        features["attendancePriorPct"] = floor(prior * 100 + 0.5)
    reasons = []
    if fee:
        reasons.append(f"{len(overdue)} instalment{'s' if len(overdue) != 1 else ''} overdue, oldest {oldest} days")
    if att >= 5:
        text = f"Attendance {features['attendanceRecentPct']}% in the last 4 weeks"
        reasons.append(text + (f", was {features['attendancePriorPct']}%" if prior is not None else ""))
    if test >= 5:
        reasons.append(f"Test scores down from {features['testEarlierPct']}% to {features['testRecentPct']}%")
    return RiskResult(score, band, fee, att, test, tuple(reasons), features)


def should_create_task(band: str, score: int | None, open_task_exists: bool,
                       last_false_flag: tuple[date, int] | None, today: date) -> bool:
    if band != "high" or score is None or open_task_exists:
        return False
    if last_false_flag is None or not 0 <= (today - last_false_flag[0]).days <= 30:
        return True
    return score >= last_false_flag[1] + 15
