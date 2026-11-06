import ast
import hashlib
import io
from datetime import date
from pathlib import Path

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from fees import models as m
from fees.services.risk import run_risk_job


class RiskImportTests(SimpleTestCase):
    def test_risk_modules_never_import_financial_or_reminder_writes(self):
        root = Path(__file__).resolve().parents[1]
        for name in ("domain/risk.py", "services/risk.py"):
            tree = ast.parse((root / name).read_text(encoding="utf8"))
            for node in ast.walk(tree):
                modules = [alias.name for alias in node.names] if isinstance(node, ast.Import) else (
                    [node.module or "", *[alias.name for alias in node.names]] if isinstance(node, ast.ImportFrom) else [])
                for module in modules:
                    self.assertFalse(set(module.split(".")) & {"reminders", "messaging", "payments", "refunds", "views"}, (name, module))


class RiskDatabaseIsolationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())

    def test_job_preserves_every_financial_and_reminder_row_not_just_counts(self):
        models = (m.ReminderLog, m.Payment, m.Allocation, m.Instalment, m.Refund, m.Receipt,
                  m.UnmatchedPayment, m.PaymentEvent, m.FeePlan, m.Consent)

        def fingerprints():
            return {model._meta.db_table: hashlib.sha256(repr(list(model.objects.order_by("pk").values())).encode()).hexdigest()
                    for model in models}

        before = fingerprints()
        run_risk_job(date(2026, 11, 2))
        self.assertEqual(fingerprints(), before)
