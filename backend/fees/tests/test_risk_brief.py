import io
import json
import os
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from fees import models as m
from fees.services.risk import RiskError, call_model, ensure_call_brief, generate_brief, run_risk_job, standard_brief

FEATURES = {"overdueInstalments": 2, "oldestOverdueDays": 70, "attendanceRecentPct": 60,
            "attendancePriorPct": 90, "testRecentPct": 49, "testEarlierPct": 69}
REASONS = ("2 instalments overdue, oldest 70 days", "Attendance 60% in the last 4 weeks, was 90%")


class BriefGenerationTests(SimpleTestCase):
    def test_no_key_returns_template_without_calling_provider(self):
        call = Mock()
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}):
            result = generate_brief(FEATURES, call=call, reasons=REASONS)
        self.assertEqual(result, {"brief": standard_brief(REASONS), "briefSource": "template"})
        call.assert_not_called()

    def test_failures_and_invalid_text_use_template_and_log_only_category(self):
        calls = [Mock(side_effect=RuntimeError("Sensitive fictional exception text")), Mock(return_value=None),
                 Mock(return_value="x" * 401), Mock(return_value="Discuss ₹500"), Mock(return_value=" "), Mock(return_value={"brief": "text"})]
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-provider-key"}):
            for call in calls:
                with self.subTest(call=call), self.assertLogs("fees.services.risk", level="WARNING") as logs:
                    result = generate_brief(FEATURES, call=call, reasons=REASONS)
                self.assertEqual(result["briefSource"], "template")
                self.assertNotIn("Sensitive fictional exception text", str(logs.output))
                self.assertNotIn("test-provider-key", str(logs.output))
                self.assertNotIn("70", str(logs.output))

    def test_provider_receives_only_allowlisted_finite_numbers(self):
        call = Mock(return_value="Attendance and test results have changed. How are things going at school?")
        features = {**FEATURES, "studentName": "Fictional private name", "phone": "+919000000000", "studentCode": "STU-0000",
                    "amountPaise": 123456789, "attendanceWeeks": 8}
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-provider-key"}):
            self.assertEqual(generate_brief(features, call=call)["briefSource"], "llm")
        call.assert_called_once_with(FEATURES)
        call.reset_mock()
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-provider-key"}):
            result = generate_brief({"studentName": "Fictional", "oldestOverdueDays": float("nan")}, call=call)
        self.assertEqual(result["briefSource"], "template")
        call.assert_not_called()

    def test_sdk_contract_model_override_refusal_and_json_privacy_with_fake_modules(self):
        base = type("FakeBaseModel", (), {})
        response = SimpleNamespace(stop_reason="end_turn", parsed_output=SimpleNamespace(brief="Two supportive sentences."))
        constructor = Mock()
        constructor.return_value.with_options.return_value.messages.parse.return_value = response
        with patch.dict("sys.modules", {"anthropic": SimpleNamespace(Anthropic=constructor), "pydantic": SimpleNamespace(BaseModel=base)}), \
                patch.dict(os.environ, {"ANTHROPIC_MODEL": "test-model"}):
            self.assertEqual(call_model({**FEATURES, "studentCode": "STU-0000"}), "Two supportive sentences.")
            options = constructor.return_value.with_options
            options.assert_called_once_with(timeout=15.0, max_retries=1)
            args = options.return_value.messages.parse.call_args.kwargs
            self.assertEqual((args["model"], args["max_tokens"], args["output_config"]), ("test-model", 2000, {"effort": "low"}))
            self.assertEqual(json.loads(args["messages"][0]["content"]), FEATURES)
            self.assertTrue(issubclass(args["output_format"], base))
            response.stop_reason = "refusal"
            self.assertIsNone(call_model(FEATURES))


class BriefCacheTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", small=True, stdout=io.StringIO())
        run_risk_job(date(2026, 11, 2))

    def setUp(self):
        self.actor = m.StaffUser.objects.get(email="counsellor@demo.test")
        self.task = m.CounsellorTask.objects.get(student__code="STU-0733", status="open")

    def test_generated_text_is_saved_once_per_task(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-provider-key"}), \
                patch("fees.services.risk.call_model", return_value="Attendance and tests changed. What support would help?") as call:
            first = ensure_call_brief(task_id=self.task.pk, actor=self.actor)
            second = ensure_call_brief(task_id=self.task.pk, actor=self.actor)
        self.assertEqual(first, second)
        self.assertEqual(first["briefSource"], "llm")
        call.assert_called_once()
        self.assertTrue(all(type(value) is int for value in call.call_args.args[0].values()))
        self.task.refresh_from_db()
        self.assertEqual((self.task.brief, self.task.brief_source), (first["brief"], "llm"))

    def test_template_is_cached_too_and_does_not_retry_when_a_key_appears(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}):
            first = ensure_call_brief(task_id=self.task.pk, actor=self.actor)
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-provider-key"}), patch("fees.services.risk.call_model") as call:
            self.assertEqual(ensure_call_brief(task_id=self.task.pk, actor=self.actor), first)
        call.assert_not_called()
        self.assertEqual(first["briefSource"], "template")

    def test_roles_centre_and_inactive_student_are_checked_before_generation(self):
        for actor in (m.StaffUser.objects.get(email="accounts@demo.test"),
                      m.StaffUser.objects.create(full_name="Fictional scoped counsellor", email="scoped.counsellor@demo.test",
                                                role="counsellor", centre=m.Centre.objects.get(code="VSH"), password_hash="unused")):
            with self.assertRaises(RiskError) as caught:
                ensure_call_brief(task_id=self.task.pk, actor=actor)
            self.assertEqual(caught.exception.status, 403)
        m.Student.objects.filter(pk=self.task.student_id).update(status="withdrawn", withdrawn_on=date(2026, 11, 2))
        with self.assertRaises(RiskError) as caught:
            ensure_call_brief(task_id=self.task.pk, actor=self.actor)
        self.assertEqual(caught.exception.status, 409)
