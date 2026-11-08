from fractions import Fraction

from django.test import SimpleTestCase

from fees.domain.risk import score_risk

# Developer-authored policy expectations, not observed dropout outcomes.
# Name, balance paise, overdue days, attendance percentages, test percentages, expected High.
CASES = [
    ("three_signals", 10000, [70, 40], [90] * 4 + [60] * 4, [72, 70, 65, 50, 48], True),
    ("exact_60", 10000, [23], [90] * 4 + [60] * 4, [70, 70, 70, 58, 56], True),
    ("stronger_academic_drop", 10000, [23], [90] * 4 + [55] * 4, [70, 70, 70, 55, 53], True),
    ("two_academic_signals", 10000, [], [95] * 4 + [40] * 4, [80, 80, 80, 30, 30], True),
    ("fees_and_attendance", 10000, [100], [90] * 4 + [60] * 4, [70] * 5, True),
    ("two_dues_and_moderate_falls", 10000, [40, 20], [95] * 4 + [70] * 4, [70, 70, 70, 62, 60], True),
    ("recent_due_and_large_falls", 10000, [16], [90] * 4 + [50] * 4, [75, 75, 75, 58, 56], True),
    ("multiple_dues_and_test_drop", 10000, [75, 60, 20], [90] * 4 + [75] * 4, [80, 80, 80, 62, 60], True),
    ("small_balance_and_academic_changes", 1, [100], [100] * 4 + [70] * 4, [70, 70, 70, 58, 56], True),
    ("one_due_and_strong_changes", 10000, [30], [100] * 4 + [50] * 4, [80, 80, 80, 60, 60], True),
    ("fees_alone", 10000, [300, 200, 100, 20], [95] * 8, [70] * 5, False),
    ("attendance_alone", 10000, [], [100] * 4 + [0] * 4, [70] * 5, False),
    ("tests_alone", 10000, [], [95] * 8, [100, 100, 100, 0, 0], False),
    ("exact_59", 10000, [23], [90] * 4 + [60] * 4, [70, 70, 70, 59, 57], False),
    ("mild_fall", 10000, [], [90] * 4 + [70] * 4, [70, 70, 70, 58, 56], False),
    ("day_15", 10000, [15], [92] * 8, [68, 70, 69, 71, 70], False),
    ("day_16", 10000, [16], [95] * 8, [70] * 5, False),
    ("settled_old_due", 0, [180], [95] * 8, [70] * 5, False),
    ("not_yet_overdue", 10000, [0], [95] * 8, [70] * 5, False),
    ("new_student", 10000, [70], [50] * 2, [40], False),
    ("only_two_tests", 10000, [], [50] * 8, [40, 30], False),
    ("only_three_weeks", 10000, [90], [50] * 3, [80, 80, 80, 20, 20], False),
    ("minimum_data", 10000, [], [70] * 4, [70, 60, 50], False),
    ("six_weeks", 10000, [], [60] * 6, [70, 60, 50], False),
    ("fees_and_small_attendance_change", 10000, [70, 40], [100] * 4 + [85] * 4, [70] * 5, False),
    ("modest_changes", 10000, [23], [90] * 4 + [70] * 4, [70, 70, 70, 58, 56], False),
    ("seven_weeks_no_prior", 10000, [70, 40], [95] * 3 + [60] * 4, [70, 70, 70, 58, 56], False),
    ("academic_changes_below_high", 10000, [], [90] * 4 + [60] * 4, [70, 70, 70, 58, 56], False),
    ("watch_level_changes", 10000, [16], [95] * 4 + [75] * 4, [70, 70, 70, 62, 60], False),
    ("stable", 10000, [], [100] * 8, [100] * 5, False),
]


class RiskEvaluationTests(SimpleTestCase):
    def test_synthetic_high_band_precision_and_recall(self):
        counts = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
        disagreements = []
        for name, balance, days, attendance, tests, expected in CASES:
            result = score_risk([(balance, day) for day in days], [(value, 100) for value in attendance],
                                [(value, 100) for value in tests])
            predicted = result.band == "high"
            counts[("tp" if expected else "fp") if predicted else ("fn" if expected else "tn")] += 1
            if predicted != expected:
                disagreements.append((name, result.band, result.score, expected))
        precision = Fraction(counts["tp"], counts["tp"] + counts["fp"]) if counts["tp"] + counts["fp"] else Fraction(0)
        recall = Fraction(counts["tp"], counts["tp"] + counts["fn"])
        print(f"Synthetic High-band evaluation: {len(CASES)} cases; {counts}; precision={float(precision):.3f}, recall={float(recall):.3f}. No real outcome data.")
        self.assertEqual(len(CASES), 30)
        self.assertEqual(counts, {"tp": 10, "fp": 0, "fn": 0, "tn": 20}, disagreements)
        self.assertEqual((precision, recall), (Fraction(1), Fraction(1)))
