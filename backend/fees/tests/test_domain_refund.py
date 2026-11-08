from datetime import date

from django.test import SimpleTestCase

from fees.domain.refund import calculate_refund


class RefundRuleTests(SimpleTestCase):
    def calculate(self, **values):
        return calculate_refund(**{
            "net": 12000000, "paid": 7500000, "session_start": date(2026, 4, 1),
            "session_end": date(2027, 3, 31), "withdrawal_date": date(2026, 11, 2), **values,
        })

    def test_all_eleven_b8_5_rows(self):
        for case, net, paid, withdrawal, elapsed, earned, refund, payable, deadline in [
            ("Aarav", 12000000, 9000000, "2026-11-02", 216, 7101369, 1898631, 0, "2026-11-12"),
            ("Ishita", 12000000, 7500000, "2026-11-02", 216, 7101369, 398631, 0, "2026-11-12"),
            ("Mohit", 12000000, 8000000, "2026-11-02", 216, 7101369, 898631, 0, "2026-11-12"),
            ("Paid less", 12000000, 6000000, "2026-11-02", 216, 7101369, 0, 1101369, "2026-11-12"),
            ("Before", 12000000, 3000000, "2026-03-20", 0, 0, 3000000, 0, "2026-03-30"),
            ("First day", 12000000, 3000000, "2026-04-01", 1, 32876, 2967124, 0, "2026-04-11"),
            ("Last day", 12000000, 12000000, "2027-03-31", 365, 12000000, 0, 0, "2027-04-10"),
            ("After", 12000000, 12000000, "2027-05-01", 365, 12000000, 0, 0, "2027-05-11"),
            ("Overpaid", 12000000, 12500000, "2027-05-01", 365, 12000000, 500000, 0, "2027-05-11"),
            ("Discount", 10800000, 5400000, "2026-11-02", 216, 6391232, 0, 991232, "2026-11-12"),
            ("Nothing paid", 12000000, 0, "2026-11-02", 216, 7101369, 0, 7101369, "2026-11-12"),
        ]:
            with self.subTest(case=case):
                result = self.calculate(net=net, paid=paid, withdrawal_date=date.fromisoformat(withdrawal))
                self.assertEqual((result.total_days, result.elapsed_days, result.earned, result.refund,
                                  result.still_payable, result.deadline.isoformat()),
                                 (365, elapsed, earned, refund, payable, deadline))
                self.assertEqual(result.taxable + result.cgst + result.sgst, refund)
                self.assertTrue(all(type(value) is int for value in [result.earned, result.refund, result.taxable,
                                                                   result.cgst, result.sgst, result.still_payable]))

    def test_worked_gst_split_and_linked_policy_inputs(self):
        result = self.calculate()
        self.assertEqual((result.taxable, result.cgst, result.sgst), (337823, 30404, 30404))
        result = self.calculate(gst_rate_bps=0, deadline_days=3)
        self.assertEqual((result.taxable, result.cgst, result.sgst), (398631, 0, 0))
        self.assertEqual(result.deadline, date(2026, 11, 5))

    def test_one_day_session_and_invalid_inputs(self):
        result = self.calculate(session_start=date(2026, 11, 2), session_end=date(2026, 11, 2))
        self.assertEqual((result.total_days, result.elapsed_days, result.earned), (1, 1, 12000000))
        for values in [{"net": -1}, {"paid": -1}, {"net": 12000000.0}, {"paid": True},
                       {"deadline_days": -1}, {"gst_rate_bps": -1}, {"session_end": date(2026, 3, 31)}]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.calculate(**values)
