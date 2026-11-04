from datetime import date, datetime, timezone
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from fees.clock import today
from fees.domain.dates import add_days, diff_days, financial_year
from fees.domain.phone import normalize_phone
from fees.models import AppSetting


class DatesPhoneTests(SimpleTestCase):
    def test_financial_year_b8_1(self):
        for value, expected in [
            (date(2026, 11, 2), "2026-27"),
            (date(2027, 3, 31), "2026-27"),
            (date(2027, 4, 1), "2027-28"),
        ]:
            with self.subTest(value=value):
                self.assertEqual(financial_year(value), expected)

    def test_date_arithmetic(self):
        for start, end, days in [
            (date(2026, 10, 10), date(2026, 11, 2), 23),
            (date(2027, 3, 31), date(2027, 4, 1), 1),
            (date(2024, 2, 28), date(2024, 3, 1), 2),
        ]:
            with self.subTest(start=start, end=end):
                self.assertEqual(diff_days(end, start), days)
                self.assertEqual(diff_days(start, end), -days)
                self.assertEqual(add_days(start, days), end)
                self.assertEqual(add_days(end, -days), start)

    def test_phone_b8_2(self):
        for value, expected in [
            ("98765 43210", "+919876543210"),
            ("+919876543210", "+919876543210"),
            ("09876543210", "+919876543210"),
            ("919876543210", "+919876543210"),
            ("98765-43210", "+919876543210"),
            ("12345", None),
            ("5876543210", None),
            ("+9198765432100", None),
            ("9198765432", "+919198765432"),
            ("98765abc10", None),
        ]:
            with self.subTest(value=value):
                self.assertEqual(normalize_phone(value), expected)


class ClockTests(SimpleTestCase):
    @patch.dict("os.environ", {"DEMO_MODE": "false"})
    @patch("fees.clock.datetime")
    def test_ist_date_b8_1(self, mock_datetime):
        instant = datetime(2026, 11, 1, 20, tzinfo=timezone.utc)
        mock_datetime.now.side_effect = lambda tz: instant.astimezone(tz)
        self.assertEqual(today(), date(2026, 11, 2))
        mock_datetime.now.assert_called_once_with(ZoneInfo("Asia/Kolkata"))

    @patch.dict("os.environ", {"DEMO_MODE": "true"})
    @patch("fees.clock.AppSetting.objects.get")
    def test_demo_uses_stored_date(self, get):
        get.return_value = AppSetting(key="demo_today", value="2026-11-09")
        self.assertEqual(today(), date(2026, 11, 9))
        get.assert_called_once_with(pk="demo_today")

    @patch.dict("os.environ", {"DEMO_MODE": "true"})
    @patch("fees.clock.AppSetting.objects.get")
    def test_missing_demo_date_fails_instead_of_using_real_today(self, get):
        get.side_effect = AppSetting.DoesNotExist
        with self.assertRaisesMessage(ImproperlyConfigured, "run npm run db:seed"):
            today()

    @patch.dict("os.environ", {"DEMO_MODE": "true"})
    @patch("fees.clock.AppSetting.objects.get")
    def test_invalid_demo_date_is_configuration_error(self, get):
        get.return_value = AppSetting(key="demo_today", value="2026-02-30")
        with self.assertRaisesMessage(ImproperlyConfigured, "YYYY-MM-DD"):
            today()
