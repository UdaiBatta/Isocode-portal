from datetime import date, timedelta

from django.test import SimpleTestCase

from fees.domain.risk import score_risk, should_create_task


class RiskDomainTests(SimpleTestCase):
    def test_all_b8_9_score_rows(self):
        examples = [
            ([70, 40], [90] * 4 + [60] * 4, [72, 70, 65, 50, 48], (40, 33, 17, 90, "high")),
            ([70, 40], [95] * 8, [70, 71, 70, 71, 70], (40, 0, 0, 40, "watch")),
            ([70], [50] * 2, [40], (0, 0, 0, None, "insufficient")),
            ([], [50] * 8, [40, 30], (0, 0, 0, None, "insufficient")),
            ([], [90] * 4 + [70] * 4, [70, 70, 70, 58, 56], (0, 18, 10, 28, "none")),
            ([23], [90] * 4 + [60] * 4, [70, 70, 70, 58, 56], (17, 33, 10, 60, "high")),
            ([23], [90] * 4 + [60] * 4, [70, 70, 70, 59, 57], (17, 33, 9, 59, "watch")),
            ([23], [92] * 8, [68, 70, 69, 71, 70], (17, 0, 0, 17, "none")),
            ([15], [92] * 8, [68, 70, 69, 71, 70], (0, 0, 0, 0, "none")),
            ([], [60] * 6, [70, 60, 50], (0, 8, 12, 20, "none")),
        ]
        for days, attendance, tests, expected in examples:
            with self.subTest(expected=expected):
                result = score_risk([(10000, day) for day in days], [(value, 100) for value in attendance], [(value, 100) for value in tests])
                self.assertEqual((result.fee, result.attendance, result.tests, result.score, result.band), expected)

    def test_task_suppression_table_and_boundaries(self):
        today = date(2026, 11, 2)
        for band, opened, days, old_score, score, expected in [
            ("high", False, None, None, 70, True), ("high", True, None, None, 70, False),
            ("watch", False, None, None, 50, False), ("high", False, 10, 70, 75, False),
            ("high", False, 10, 70, 85, True), ("high", False, 30, 70, 70, False),
            ("high", False, 31, 70, 70, True), ("high", False, 10, 70, 84, False),
            ("high", False, -1, 70, 70, True), ("insufficient", False, None, None, None, False),
        ]:
            with self.subTest(band=band, days=days, score=score):
                flag = (today - timedelta(days=days), old_score) if days is not None else None
                self.assertEqual(should_create_task(band, score, opened, flag, today), expected)

    def test_no_single_signal_reaches_high_and_reasons_have_no_amounts(self):
        for instalments, attendance, tests in [
            ([(987654321, 300)] * 8, [(100, 100)] * 8, [(100, 100)] * 5),
            ([], [(100, 100)] * 4 + [(0, 100)] * 4, [(100, 100)] * 5),
            ([], [(100, 100)] * 8, [(100, 100)] * 3 + [(0, 100)] * 2),
        ]:
            result = score_risk(instalments, attendance, tests)
            self.assertLessEqual(result.score, 40)
            self.assertNotEqual(result.band, "high")
            self.assertNotIn("987654321", str(result.features) + str(result.reasons))
            self.assertNotIn("₹", str(result.reasons))

    def test_weighted_counts_windows_reasons_and_invalid_values(self):
        result = score_risk([(10000, 70), (10000, 40)], [(90, 100)] * 4 + [(60, 100)] * 4,
                            [(72, 100), (70, 100), (65, 100), (50, 100), (48, 100)])
        self.assertEqual(result.reasons, ("2 instalments overdue, oldest 70 days", "Attendance 60% in the last 4 weeks, was 90%",
                                          "Test scores down from 69% to 49%"))
        weighted = score_risk([], [(1, 1), (9, 10), (90, 100), (0, 0)], [(7, 10)] * 3)
        self.assertEqual(weighted.band, "insufficient")
        for instalments, attendance, tests in [([(-1, 20)], [], []), ([(True, 20)], [], []),
                                               ([], [(2, 1)], []), ([], [], [(1, 0)])]:
            with self.assertRaises(ValueError):
                score_risk(instalments, attendance, tests)
