import os

from django.db import transaction
from django.db.models import Q

from fees import models as m
from fees.seed import seed_id, seed_named
from fees.seed_data import DEMO_TODAY, NAMED_CODES


@transaction.atomic
def reset_demo(*, actor=None):
    if os.getenv("DEMO_MODE", "false").lower() != "true":
        raise ValueError("Demo reset requires DEMO_MODE=true.")
    codes = [f"STU-{number:04d}" for number in NAMED_CODES]
    # The first pass only fills missing named records; the final pass restores their histories.
    seed_named()
    students = list(m.Student.objects.select_for_update(nowait=True).filter(code__in=codes).order_by("pk"))
    student_ids = [student.pk for student in students]
    instalment_ids = list(m.Instalment.objects.select_for_update(nowait=True).filter(
        plan__student_id__in=student_ids,
    ).order_by("pk").values_list("pk", flat=True))
    payment_ids = list(m.Payment.objects.filter(student_id__in=student_ids).values_list("pk", flat=True))
    queue_ids = list(m.UnmatchedPayment.objects.select_for_update(of=("self",), nowait=True).filter(
        Q(suggested_instalment_id__in=instalment_ids) | Q(payment_id__in=payment_ids) |
        Q(reference__in=codes + [str(pk) for pk in instalment_ids]) |
        Q(pk__in=[seed_id(f"queue/{index}") for index in range(6)])
    ).order_by("pk").values_list("pk", flat=True))
    event_ids = list(m.PaymentEvent.objects.select_for_update(nowait=True).filter(
        Q(payment_id__in=payment_ids) | Q(unmatched_id__in=queue_ids) |
        Q(payload__reference__in=[str(pk) for pk in instalment_ids])
    ).order_by("pk").values_list("pk", flat=True))
    m.PaymentEvent.objects.filter(pk__in=event_ids).delete()
    m.UnmatchedPayment.objects.filter(pk__in=queue_ids).delete()
    m.CounsellorTask.objects.filter(student_id__in=student_ids).delete()
    m.RiskFlag.objects.filter(student_id__in=student_ids).delete()
    m.Refund.objects.filter(student_id__in=student_ids).delete()
    m.Allocation.objects.filter(payment_id__in=payment_ids).delete()
    m.Receipt.objects.filter(payment_id__in=payment_ids).delete()
    m.Payment.objects.filter(pk__in=payment_ids).delete()
    m.ReminderLog.objects.filter(instalment_id__in=instalment_ids).delete()
    m.Consent.objects.filter(student_id__in=student_ids).delete()
    seed_named()
    m.AppSetting.objects.update_or_create(key="demo_today", defaults={"value": DEMO_TODAY.isoformat()})
    m.AuditLog.objects.create(
        actor_type="staff" if actor else "system", actor_id=actor.pk if actor else None,
        action="reset_demo", entity="demo", entity_id=seed_id("demo"),
        after={"studentCodes": codes, "date": DEMO_TODAY.isoformat()},
    )
    return {"reset": True, "date": DEMO_TODAY.isoformat()}
