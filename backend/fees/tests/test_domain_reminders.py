from datetime import date

from django.test import SimpleTestCase

from fees.domain.reminders import next_scheduled_step, next_step


class ReminderRuleTests(SimpleTestCase):
    def test_b8_7_reminder_steps(self):
        cases = [
            ("2026-11-15", "2026-11-02", (), None),
            ("2026-11-15", "2026-11-08", (), -7),
            ("2026-11-15", "2026-11-09", (), -7),
            ("2026-11-15", "2026-11-09", (-7,), None),
            ("2026-11-15", "2026-11-12", (-7,), -3),
            ("2026-11-15", "2026-11-15", (-7, -3), 0),
            ("2026-10-10", "2026-11-02", (-7, -3, 0, 3, 7, 15), None),
            ("2026-10-10", "2026-11-09", (-7, -3, 0, 3, 7, 15), 30),
            ("2026-10-10", "2026-11-20", (-7, -3, 0, 3, 7, 15, 30), None),
            ("2026-10-10", "2026-10-20", (-7, -3), 7),
            ("2026-10-10", "2026-10-25", (-7, -3, 7), 15),
        ]
        for due, today, sent, expected in cases:
            with self.subTest(due=due, today=today, sent=sent):
                self.assertEqual(next_step(date.fromisoformat(due), date.fromisoformat(today), sent), expected)

    def test_next_scheduled_reminder_for_display(self):
        for due, today, sent, expected in [
            ("2026-11-15", "2026-11-02", (), -7),
            ("2026-11-15", "2026-11-09", (-7,), -3),
            ("2026-10-10", "2026-11-02", (-7, -3, 0, 3, 7, 15), 30),
            ("2026-10-10", "2026-11-20", (-7, -3, 0, 3, 7, 15, 30), None),
        ]:
            with self.subTest(due=due, today=today, sent=sent):
                self.assertEqual(next_scheduled_step(date.fromisoformat(due), date.fromisoformat(today), sent), expected)
