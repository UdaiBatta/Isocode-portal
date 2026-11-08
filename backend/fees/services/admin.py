from datetime import timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.db.models import BigIntegerField, Count, Exists, OuterRef, Prefetch, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from fees import models as m
from fees.auth import lock_subject
from fees.clock import today
from fees.domain.ledger import split_net

MODELS = {"student": m.Student, "batch": m.Batch, "centre": m.Centre, "staff": m.StaffUser}


class AdminError(Exception):
    def __init__(self, code, message, status=400):
        super().__init__(message)
        self.code, self.status = code, status


def _active(model, pk):
    row = model.objects.filter(pk=pk, archived_at__isnull=True).first()
    if not row:
        raise AdminError("not_found", "Choose an active record.", 404)
    return row


def _editable(model, pk):
    if not pk:
        return None
    row = model.objects.select_for_update().filter(pk=pk).first()
    if not row:
        raise AdminError("not_found", "Record not found.", 404)
    if row.archived_at:
        raise AdminError("archived", "Restore this record before editing it.", 409)
    return row


def _write_lock(actor):
    # Admin writes are rare; one transaction lock keeps parent/archive checks and generated codes consistent.
    lock_subject("admin", "manage")
    if not m.StaffUser.objects.filter(pk=actor.pk, role="admin", archived_at__isnull=True, centre__isnull=True).exists():
        raise AdminError("forbidden", "A global Admin account is required.", 403)


def _student_query():
    history = (Exists(m.Consent.objects.filter(student=OuterRef("pk"))) |
               Exists(m.Refund.objects.filter(student=OuterRef("pk"))) |
               Exists(m.RiskFlag.objects.filter(student=OuterRef("pk"))) |
               Exists(m.ReminderLog.objects.filter(instalment__plan__student=OuterRef("pk"))) |
               Exists(m.UnmatchedPayment.objects.filter(suggested_instalment__plan__student=OuterRef("pk"))))
    return m.Student.objects.select_related("batch__centre", "feeplan").prefetch_related(Prefetch(
        "guardianstudent_set", queryset=m.GuardianStudent.objects.select_related("guardian").order_by("-is_primary", "created_at", "pk"),
        to_attr="admin_guardians",
    )).annotate(paid=Coalesce(Sum("instalmentbalance__paid_paise"), 0, output_field=BigIntegerField()),
                has_payments=Exists(m.Payment.objects.filter(student=OuterRef("pk"))), has_history=history)


def _staff_activity(pk):
    return (m.Payment.objects.filter(recorded_by_id=pk).exists() or
            m.UnmatchedPayment.objects.filter(resolved_by_id=pk).exists() or
            m.Refund.objects.filter(Q(created_by_id=pk) | Q(approved_by_id=pk)).exists() or
            m.CounsellorTask.objects.filter(closed_by_id=pk).exists() or
            m.AuditLog.objects.filter(actor_type="staff", actor_id=pk).exists())


def record_vm(entity, row, actor):
    active = row.archived_at is None
    actions = {"canEdit": active, "canArchive": False, "canRestore": False, "canDelete": False, "blockedReason": None}
    result = {"id": str(row.pk), "state": "active" if active else "archived", "actions": actions}
    if entity == "centre":
        batches = row.batch_set.count()
        staff = row.staffuser_set.count()
        active_batches = row.batch_set.filter(archived_at__isnull=True).count()
        active_staff = row.staffuser_set.filter(archived_at__isnull=True).count()
        actions.update(canArchive=active and not active_batches and not active_staff, canRestore=not active,
                       canDelete=not batches and not staff,
                       blockedReason="Archive its active batches and move or archive its staff first." if active_batches or active_staff else None)
        result.update(code=row.code, name=row.name, batches=active_batches, staff=active_staff,
                      students=m.Student.objects.filter(batch__centre=row, archived_at__isnull=True).count())
    elif entity == "batch":
        total = row.student_set.count()
        current = row.student_set.filter(archived_at__isnull=True).count()
        actions.update(canArchive=active and not total, canRestore=not active and row.centre.archived_at is None,
                       canDelete=not total, blockedReason="Move all linked students, including archived ones, first." if total else
                       "Restore its centre first." if row.centre.archived_at else None)
        result.update(name=row.name, centreId=str(row.centre_id), centre=row.centre.name, stream=row.stream,
                      sessionStart=row.session_start.isoformat(), sessionEnd=row.session_end.isoformat(), students=current)
    elif entity == "staff":
        own = row.pk == actor.pk
        activity = _staff_activity(row.pk)
        parent_active = row.centre_id is None or row.centre.archived_at is None
        actions.update(canArchive=active and not own, canRestore=not active and parent_active,
                       canDelete=not own and not activity,
                       blockedReason="You cannot archive or delete your own account." if own else
                       "Restore its centre first." if not parent_active else
                       "Has recorded activity; archive it instead." if activity else None)
        result.update(fullName=row.full_name, email=row.email, role=row.role,
                      centreId=str(row.centre_id) if row.centre_id else None, centre=row.centre.name if row.centre_id else None)
    else:
        plan = getattr(row, "feeplan", None)
        net = plan.net_paise if plan else 0
        settled = row.status == "withdrawn" or (plan is not None and row.paid >= net)
        parent_active = row.batch.archived_at is None and row.batch.centre.archived_at is None
        actions.update(canArchive=active and settled, canRestore=not active and parent_active,
                       canDelete=not row.has_payments and not row.has_history,
                       blockedReason="Still studying with a balance. Withdraw through the refund flow first." if active and not settled else
                       "Restore its batch and centre first." if not parent_active else
                       "Has payments or recorded history; archive it instead." if row.has_payments or row.has_history else None)
        link = row.admin_guardians[0] if row.admin_guardians else None
        result.update(code=row.code, name=row.full_name, batchId=str(row.batch_id), batch=row.batch.name,
                      centreId=str(row.batch.centre_id), centre=row.batch.centre.name, status=row.status,
                      enrolledOn=row.enrolled_on.isoformat(),
                      guardian={"name": link.guardian.full_name if link else "", "phone": link.guardian.phone if link else "",
                                "language": link.guardian.language if link else "hi"},
                      fee={"gross": plan.gross_paise if plan else 0, "discount": plan.discount_paise if plan else 0,
                           "discountReason": plan.discount_reason if plan else None, "net": net, "paid": row.paid,
                           "editable": active and not settled and plan is not None,
                           "lockedReason": "No fee plan." if not plan else "Withdrawn. Use the refund flow." if row.status == "withdrawn"
                           else "Fully paid. Payments are never edited." if settled else None})
    return result


def listing(entity, filters, actor):
    rows = _student_query() if entity == "student" else MODELS[entity].objects.all()
    if entity in ("batch", "staff"):
        rows = rows.select_related("centre")
    if filters.get("centre") and entity != "centre":
        rows = rows.filter(**{"batch__centre_id" if entity == "student" else "centre_id": filters["centre"]})
    if filters.get("batch") and entity == "student":
        rows = rows.filter(batch_id=filters["batch"])
    if filters.get("q"):
        fields = {"centre": ("name", "code"), "batch": ("name", "centre__name"),
                  "staff": ("full_name", "email"), "student": ("full_name", "code")}[entity]
        search = Q()
        for field in fields:
            search |= Q(**{f"{field}__icontains": filters["q"]})
        if entity == "student":
            search |= Q(pk__in=m.GuardianStudent.objects.filter(guardian__phone__icontains=filters["q"]).values("student_id"))
        rows = rows.filter(search)
    counts = rows.aggregate(active=Count("pk", filter=Q(archived_at__isnull=True)),
                            archived=Count("pk", filter=Q(archived_at__isnull=False)))
    state = filters.get("state") or "active"
    rows = rows.filter(archived_at__isnull=state == "active")
    pages = max(1, (counts[state] + 24) // 25)
    page = min(filters.get("page") or 1, pages)
    rows = rows.order_by("full_name" if entity in ("student", "staff") else "name", "pk")[(page - 1) * 25:page * 25]
    return {"today": today().isoformat(), "rows": [record_vm(entity, row, actor) for row in rows],
            "page": page, "pages": pages, "counts": counts}


def directory():
    return {"centres": [{"id": str(row.pk), "name": row.name} for row in m.Centre.objects.filter(
        archived_at__isnull=True).order_by("code")],
        "batches": [{"id": str(row.pk), "name": row.name, "centreId": str(row.centre_id)} for row in m.Batch.objects.filter(
            archived_at__isnull=True, centre__archived_at__isnull=True).order_by("centre__code", "name")]}


def _snapshot(entity, row):
    if entity == "centre":
        return {"name": row.name, "code": row.code}
    if entity == "batch":
        return {"name": row.name, "centreId": row.centre.name, "stream": row.stream,
                "sessionStart": row.session_start.isoformat(), "sessionEnd": row.session_end.isoformat()}
    if entity == "staff":
        return {"fullName": row.full_name, "email": row.email, "role": row.role,
                "centreId": row.centre.name if row.centre_id else None}
    row = _student_query().get(pk=row.pk)
    view = record_vm("student", row, row)
    return {"name": row.full_name, "code": row.code, "batchId": row.batch.name,
            "enrolledOn": row.enrolled_on.isoformat(), "guardianName": view["guardian"]["name"],
            "guardianPhone": view["guardian"]["phone"], "guardianLanguage": view["guardian"]["language"],
            "gross": view["fee"]["gross"], "discount": view["fee"]["discount"], "discountReason": view["fee"]["discountReason"]}


def _audit(entity, row, actor, action, before, after, reason=None):
    label = getattr(row, "full_name", None) or row.name
    details = {"_label": label, "_actor": actor.full_name, "_reason": reason}
    m.AuditLog.objects.create(actor_type="staff", actor_id=actor.pk, entity=entity, entity_id=row.pk,
                             action=f"admin_{action}", before={**before, **details} if before is not None else None,
                             after={**after, **details} if after is not None else None)


def history(filters):
    rows = m.AuditLog.objects.filter(action__startswith="admin_")
    if filters.get("entity"):
        rows = rows.filter(entity=filters["entity"])
    if filters.get("id"):
        rows = rows.filter(entity_id=filters["id"])
    pages = max(1, (rows.count() + 24) // 25)
    page = min(filters.get("page") or 1, pages)
    result = []
    for row in rows.order_by("-created_at", "-pk")[(page - 1) * 25:page * 25]:
        before, after = row.before or {}, row.after or {}
        meta = after or before
        keys = (before.keys() | after.keys()) - {key for key in before.keys() | after.keys() if key.startswith("_")}
        result.append({"id": str(row.pk), "at": row.created_at.astimezone(ZoneInfo("Asia/Kolkata")).isoformat(),
                       "actor": meta["_actor"], "action": row.action.removeprefix("admin_"), "entity": row.entity,
                       "entityId": str(row.entity_id), "label": meta["_label"], "reason": meta.get("_reason"),
                       "changes": [{"field": key, "before": before.get(key), "after": after.get(key)} for key in sorted(keys)
                                   if before.get(key) != after.get(key)]})
    return {"today": today().isoformat(), "rows": result, "page": page, "pages": pages}


@transaction.atomic
def save_centre(data, actor):
    _write_lock(actor)
    row = _editable(m.Centre, data.get("id"))
    before = _snapshot("centre", row) if row else None
    if row and row.code != data["code"]:
        raise AdminError("code_locked", "Centre codes cannot change because receipt numbers use them.")
    if m.Centre.objects.filter(code=data["code"]).exclude(pk=row.pk if row else None).exists():
        raise AdminError("duplicate", "This centre code already exists.")
    row = row or m.Centre(code=data["code"])
    row.name = data["name"]
    row.save()
    _audit("centre", row, actor, "update" if before else "create", before, _snapshot("centre", row))
    return row.pk


@transaction.atomic
def save_batch(data, actor):
    _write_lock(actor)
    row = _editable(m.Batch, data.get("id"))
    before = _snapshot("batch", row) if row else None
    centre = _active(m.Centre, data["centreId"])
    if data["sessionEnd"] <= data["sessionStart"] or not data["name"].startswith(data["stream"] + " "):
        raise AdminError("invalid", "Check the exam and session dates.")
    if row and row.centre_id != centre.pk and row.student_set.exists():
        raise AdminError("has_students", "Move all students, including archived ones, before changing the centre.", 409)
    if m.Batch.objects.filter(centre=centre, name=data["name"]).exclude(pk=row.pk if row else None).exists():
        raise AdminError("duplicate", "This centre already has a batch with that name, including archived batches.")
    row = row or m.Batch()
    row.centre, row.name, row.stream = centre, data["name"], data["stream"]
    row.session_start, row.session_end = data["sessionStart"], data["sessionEnd"]
    row.save()
    _audit("batch", row, actor, "update" if before else "create", before, _snapshot("batch", row))
    return row.pk


@transaction.atomic
def save_staff(data, actor):
    _write_lock(actor)
    row = _editable(m.StaffUser, data.get("id"))
    before = _snapshot("staff", row) if row else None
    if row and data.get("password"):
        raise AdminError("password_locked", "Password is create-only in Manage.")
    if not row and not data.get("password"):
        raise AdminError("password_required", "Set a password of at least twelve characters.")
    if data["role"] == "admin" and data.get("centreId"):
        raise AdminError("invalid_centre", "Admins work across all centres.")
    centre = _active(m.Centre, data.get("centreId")) if data["role"] != "admin" else None
    if row and row.pk == actor.pk and data["role"] != "admin":
        raise AdminError("self", "You cannot change your own role.")
    email = data["email"].lower()
    if m.StaffUser.objects.filter(email__iexact=email).exclude(pk=row.pk if row else None).exists():
        raise AdminError("duplicate", "Another account uses this email.")
    row = row or m.StaffUser(password_hash=make_password(data["password"]))
    row.full_name, row.email, row.role, row.centre = data["fullName"], email, data["role"], centre
    row.save()
    _audit("staff", row, actor, "update" if before else "create", before, _snapshot("staff", row))
    return row.pk


@transaction.atomic
def save_student(data, actor):
    _write_lock(actor)
    row = _editable(m.Student, data.get("id"))
    if row:
        list(m.Instalment.objects.select_for_update().filter(plan__student=row).order_by("pk"))
    before = _snapshot("student", row) if row else None
    batch = _active(m.Batch, data["batchId"])
    if batch.centre.archived_at:
        raise AdminError("invalid_batch", "Restore its centre first.")
    if data["enrolledOn"] > today():
        raise AdminError("invalid_date", "Enrolment cannot be in the future.")
    if row and (data.get("gross") is not None or data.get("discount") or data.get("discountReason")):
        raise AdminError("fee_locked", "Use Change fee with a reason to change an existing fee.")
    if not row:
        gross, discount = data.get("gross"), data.get("discount") or 0
        if not gross or discount >= gross or (discount and not data.get("discountReason")):
            raise AdminError("invalid_fee", "Enter a positive net course fee and a reason for any discount.")
        policy = m.RefundPolicy.objects.filter(effective_from__lte=today()).order_by("-effective_from", "-created_at").first()
        if not policy:
            raise AdminError("policy_required", "A refund policy is required before enrolment.", 409)
        last = m.Student.objects.order_by("-code").values_list("code", flat=True).first()
        number = int(last.removeprefix("STU-")) + 1 if last else 1
        if number > 9999:
            raise AdminError("capacity", "The four-digit student code range is full.", 409)
        row = m.Student(code=f"STU-{number:04d}")
    row.full_name, row.batch, row.enrolled_on = data["fullName"], batch, data["enrolledOn"]
    row.save()
    guardian, _ = m.Guardian.objects.get_or_create(phone=data["guardianPhone"], defaults={
        "full_name": data["guardianName"], "language": data["guardianLanguage"],
    })
    guardian.full_name, guardian.language = data["guardianName"], data["guardianLanguage"]
    guardian.save(update_fields=["full_name", "language"])
    primary = m.GuardianStudent.objects.filter(student=row).order_by("-is_primary", "created_at", "pk").first()
    # Replacing the primary contact revokes that login link for this child; consent history and other guardians remain.
    if primary and primary.guardian_id != guardian.pk:
        primary.delete()
    m.GuardianStudent.objects.filter(student=row, is_primary=True).exclude(guardian=guardian).update(is_primary=False)
    m.GuardianStudent.objects.update_or_create(student=row, guardian=guardian, defaults={"is_primary": True})
    if before is None:
        net = gross - discount
        template = m.FeePlan.objects.filter(student__batch=batch).order_by("created_at", "pk").first()
        dates = list(template.instalment_set.order_by("seq").values_list("due_date", flat=True)) if template else []
        if not dates:
            count = 4 if batch.stream == "JEE" else 3
            dates = [batch.session_start + timedelta(days=((batch.session_end - batch.session_start).days + 1) * index // count)
                     for index in range(count)]
        dates = dates[:min(len(dates), net)]
        plan = m.FeePlan.objects.create(student=row, gross_paise=gross, discount_paise=discount,
                                       discount_reason=data.get("discountReason") or None, net_paise=net, refund_policy=policy)
        m.Instalment.objects.bulk_create([m.Instalment(plan=plan, seq=index + 1, due_date=on, amount_paise=amount)
                                          for index, (on, amount) in enumerate(zip(dates, split_net(net, len(dates))))])
    _audit("student", row, actor, "update" if before else "create", before, _snapshot("student", row))
    return row.pk


@transaction.atomic
def lifecycle(data, actor, action):
    _write_lock(actor)
    entity = data["entity"]
    row = MODELS[entity].objects.select_for_update().filter(pk=data["id"]).first()
    if not row:
        raise AdminError("not_found", "Record not found.", 404)
    subject = _student_query().get(pk=row.pk) if entity == "student" else row
    view = record_vm(entity, subject, actor)
    allowed = {"archive": "canArchive", "restore": "canRestore", "delete": "canDelete"}[action]
    if not view["actions"][allowed]:
        raise AdminError("blocked", view["actions"]["blockedReason"] or "This record cannot change now.", 409)
    before = {**_snapshot(entity, row), "state": view["state"]}
    if action == "delete":
        _audit(entity, row, actor, action, before, None)
        if entity == "student":
            plan = m.FeePlan.objects.filter(student=row).first()
            if plan:
                plan.instalment_set.all().delete()
                plan.delete()
        row.delete()
    else:
        row.archived_at = timezone.now() if action == "archive" else None
        row.save(update_fields=["archived_at"])
        after = {**_snapshot(entity, row), "state": "archived" if row.archived_at else "active"}
        _audit(entity, row, actor, action, before, after)
    return data["id"]


@transaction.atomic
def change_fee(data, actor):
    _write_lock(actor)
    student = _editable(m.Student, data["studentId"])
    instalments = list(m.Instalment.objects.select_for_update().filter(plan__student=student).order_by("due_date", "seq"))
    plan = m.FeePlan.objects.filter(student=student).first()
    if not plan or student.status != "active":
        raise AdminError("locked", "Fee changes require an active student with a fee plan.", 409)
    balances = {row.pk: row for row in m.InstalmentBalance.objects.filter(student=student)}
    paid = sum(row.paid_paise for row in balances.values())
    unpaid = [row for row in instalments if balances[row.pk].balance_paise > 0]
    if not unpaid:
        raise AdminError("locked", "Fully paid. Payments are never edited.", 409)
    gross, discount = data["gross"], data["discount"]
    if discount >= gross:
        raise AdminError("invalid_fee", "The discount must be less than the course fee.")
    net = gross - discount
    if net < paid:
        raise AdminError("below_paid", "The new fee cannot be less than what is already paid.")
    if gross == plan.gross_paise and discount == plan.discount_paise:
        raise AdminError("unchanged", "Change the fee or discount first.")
    amounts = [balances[row.pk].paid_paise + value for row, value in zip(unpaid, split_net(net - paid, len(unpaid)))]
    before = {**_snapshot("student", student), "_instalments": {str(row.pk): row.amount_paise for row in instalments}}
    for row, amount in zip(unpaid, amounts):
        row.amount_paise = amount
    m.Instalment.objects.bulk_update(unpaid, ["amount_paise"])
    plan.gross_paise, plan.discount_paise, plan.net_paise = gross, discount, net
    plan.discount_reason = data["reason"] if discount else None
    plan.save(update_fields=["gross_paise", "discount_paise", "net_paise", "discount_reason"])
    after = {**_snapshot("student", student), "_instalments": {str(row.pk): row.amount_paise for row in instalments}}
    _audit("student", student, actor, "fee", before, after, data["reason"])
    return student.pk
