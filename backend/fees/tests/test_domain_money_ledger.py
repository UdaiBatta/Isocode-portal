from datetime import date
from decimal import Decimal

from django.test import SimpleTestCase

from fees.domain.ledger import (
    InstalmentHistory, ageing_bucket, allocate_oldest_first, instalment_view,
    over60_metric, split_net,
)
from fees.domain.money import gst_split


class MoneyLedgerTests(SimpleTestCase):
    def test_gst_b8_3(self):
        for amount, taxable, cgst, sgst in [
            (3000000, 2542373, 228813, 228814),
            (1500000, 1271186, 114407, 114407),
            (4000000, 3389831, 305084, 305085),
            (398631, 337823, 30404, 30404),
            (0, 0, 0, 0),
        ]:
            with self.subTest(amount=amount):
                parts = gst_split(amount)
                self.assertEqual((parts.taxable, parts.cgst, parts.sgst), (taxable, cgst, sgst))
                self.assertEqual(parts.taxable + parts.cgst + parts.sgst, amount)

    def test_split_net_b8_4(self):
        for net, count, expected in [
            (10800000, 4, [2700000, 2700000, 2700000, 2700000]),
            (11000000, 3, [3666666, 3666666, 3666668]),
        ]:
            with self.subTest(net=net, count=count):
                self.assertEqual(split_net(net, count), expected)

    def test_instalment_view_b8_4(self):
        for amount, paid, due, status, part_paid, balance, overdue, due_in in [
            (3000000, 3000000, date(2026, 10, 10), "paid", False, 0, 0, 0),
            (3000000, 1500000, date(2026, 10, 10), "overdue", True, 1500000, 23, 0),
            (4000000, 0, date(2026, 11, 15), "upcoming", False, 4000000, 0, 13),
            (3000000, 0, date(2026, 11, 2), "due_today", False, 3000000, 0, 0),
        ]:
            with self.subTest(due=due, paid=paid):
                view = instalment_view(amount, paid, due, date(2026, 11, 2))
                self.assertEqual((view.status, view.part_paid, view.balance, view.days_overdue, view.due_in_days),
                                 (status, part_paid, balance, overdue, due_in))

    def test_allocate_oldest_first_b8_4(self):
        for amount, balances, expected, excess in [
            (5000000, [1500000, 3000000, 3000000], [1500000, 3000000, 500000], 0),
            (5000000, [1500000, 3000000], [1500000, 3000000], 500000),
            (1000000, [], [], 1000000),
        ]:
            with self.subTest(amount=amount, balances=balances):
                self.assertEqual(allocate_oldest_first(amount, balances), (expected, excess))

    def test_ageing_buckets_b8_4(self):
        for days, expected in [(-5, "not_due"), (0, "not_due"), (1, "1–30"), (30, "1–30"),
                               (31, "31–60"), (60, "31–60"), (61, "61–90"),
                               (90, "61–90"), (91, "90+")]:
            with self.subTest(days=days):
                self.assertEqual(ageing_bucket(days), expected)

    def test_over60_b8_6(self):
        rows = [
            InstalmentHistory(10000, date(2026, 7, 25)),
            InstalmentHistory(10000, date(2026, 7, 25), ((10000, date(2026, 8, 4)),)),
            InstalmentHistory(10000, date(2026, 7, 25), ((10000, date(2026, 10, 3)),)),
            InstalmentHistory(10000, date(2026, 10, 3)),
            InstalmentHistory(10000, date(2026, 8, 4), ((4000, date(2026, 8, 9)),)),
            InstalmentHistory(10000, date(2026, 12, 1)),
        ]
        metric = over60_metric(rows, date(2026, 11, 2))
        self.assertEqual((metric.numerator, metric.denominator, metric.pct), (26000, 50000, Decimal(52)))

    def test_over60_boundary_and_future_payments(self):
        metric = over60_metric([
            InstalmentHistory(10000, date(2026, 9, 3)),
            InstalmentHistory(10000, date(2026, 9, 2), ((10000, date(2026, 11, 3)),)),
            InstalmentHistory(10000, date(2026, 11, 2)),
        ], date(2026, 11, 2))
        self.assertEqual((metric.numerator, metric.denominator, metric.pct), (10000, 20000, Decimal(50)))
        self.assertEqual(over60_metric([], date(2026, 11, 2)).pct, 0)

    def test_invalid_money_inputs(self):
        for function, args in [(gst_split, (-1,)), (split_net, (100, 0)),
                               (allocate_oldest_first, (100, [-1])),
                               (instalment_view, (100, 101, date(2026, 11, 2), date(2026, 11, 2)))]:
            with self.subTest(function=function.__name__):
                with self.assertRaises(ValueError):
                    function(*args)
