from collections import defaultdict
from datetime import date

from django.db import transaction

from fees.domain.reminders import next_step
from fees.models import GuardianStudent, Instalment, InstalmentBalance, ReminderLog, UnmatchedPayment

CHUNK_SIZE = 200


def send_due_reminders(today: date) -> dict[str, int]:
    open_reviews = UnmatchedPayment.objects.filter(
        status="open", suggested_instalment_id__isnull=False,
    ).values_list("suggested_instalment_id", flat=True)
    candidates = list(InstalmentBalance.objects.filter(
        balance_paise__gt=0, student__status="active", student__archived_at__isnull=True,
    ).exclude(pk__in=open_reviews).order_by("pk").values_list("pk", flat=True))

    sent = 0
    skipped = 0
    for offset in range(0, len(candidates), CHUNK_SIZE):
        chunk = candidates[offset:offset + CHUNK_SIZE]
        with transaction.atomic():
            instalments = list(Instalment.objects.select_for_update(of=("self",)).filter(
                pk__in=chunk,
            ).select_related("plan__student").order_by("pk"))
            ids = [row.pk for row in instalments]
            balances = dict(InstalmentBalance.objects.filter(
                pk__in=ids, student__status="active", student__archived_at__isnull=True,
            ).values_list("pk", "balance_paise"))
            review_ids = set(UnmatchedPayment.objects.filter(
                status="open", suggested_instalment_id__in=ids,
            ).values_list("suggested_instalment_id", flat=True))
            sent_steps = defaultdict(list)
            for instalment_id, step in ReminderLog.objects.filter(
                instalment_id__in=ids,
            ).values_list("instalment_id", "step"):
                sent_steps[instalment_id].append(step)
            guardian_language = {}
            links = GuardianStudent.objects.filter(
                student_id__in={row.plan.student_id for row in instalments}, is_primary=True,
            ).select_related("guardian").order_by("created_at", "pk")
            for link in links:
                guardian_language.setdefault(link.student_id, link.guardian.language)

            rows = []
            for instalment in instalments:
                student = instalment.plan.student
                balance = balances.get(instalment.pk, 0)
                language = guardian_language.get(student.pk)
                if balance <= 0 or student.status != "active" or student.archived_at or instalment.pk in review_ids or not language:
                    continue
                step = next_step(instalment.due_date, today, sent_steps[instalment.pk])
                if step is not None:
                    rows.append(ReminderLog(
                        instalment=instalment, step=step, language=language,
                        amount_paise=balance, sent_on=today,
                    ))
            ReminderLog.objects.bulk_create(rows)
            sent += len(rows)
            skipped += len(chunk) - len(rows)

    return {"sent": sent, "skipped": skipped}
