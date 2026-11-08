from django.db import IntegrityError
from django.db.models.deletion import ProtectedError
from django.http import JsonResponse

from fees.auth import api, error
from fees.forms import (AdminBatchForm, AdminCentreForm, AdminFeeForm, AdminHistoryForm, AdminListForm,
                        AdminStaffForm, AdminStudentForm, AdminTargetForm)
from fees.services import admin as service


def _list(request, entity):
    if request.subject.centre_id:
        return error("forbidden", "A global Admin account is required.", 403)
    return JsonResponse({"ok": True, **service.listing(entity, request.data, request.subject)})


@api(role="admin", form=AdminListForm, methods=("GET",))
def students(request):
    return _list(request, "student")


@api(role="admin", form=AdminListForm, methods=("GET",))
def batches(request):
    return _list(request, "batch")


@api(role="admin", form=AdminListForm, methods=("GET",))
def centres(request):
    return _list(request, "centre")


@api(role="admin", form=AdminListForm, methods=("GET",))
def staff(request):
    return _list(request, "staff")


@api(role="admin", methods=("GET",))
def directory(request):
    if request.subject.centre_id:
        return error("forbidden", "A global Admin account is required.", 403)
    return JsonResponse({"ok": True, **service.directory()})


@api(role="admin", form=AdminHistoryForm, methods=("GET",))
def history(request):
    if request.subject.centre_id:
        return error("forbidden", "A global Admin account is required.", 403)
    return JsonResponse({"ok": True, **service.history(request.data)})


def _mutate(request, operation, *args):
    try:
        pk = operation(request.data, request.subject, *args)
    except service.AdminError as exc:
        return error(exc.code, str(exc), exc.status)
    except ProtectedError:
        return error("history", "This record has protected history. Archive it instead.", 409)
    except IntegrityError:
        return error("conflict", "The record changed or duplicates an existing record. Refresh and try again.", 409)
    return JsonResponse({"ok": True, "id": str(pk)})


@api(role="admin", form=AdminCentreForm)
def save_centre(request):
    return _mutate(request, service.save_centre)


@api(role="admin", form=AdminBatchForm)
def save_batch(request):
    return _mutate(request, service.save_batch)


@api(role="admin", form=AdminStaffForm)
def save_staff(request):
    return _mutate(request, service.save_staff)


@api(role="admin", form=AdminStudentForm)
def save_student(request):
    return _mutate(request, service.save_student)


@api(role="admin", form=AdminFeeForm)
def change_fee(request):
    return _mutate(request, service.change_fee)


@api(role="admin", form=AdminTargetForm)
def archive(request):
    return _mutate(request, service.lifecycle, "archive")


@api(role="admin", form=AdminTargetForm)
def restore(request):
    return _mutate(request, service.lifecycle, "restore")


@api(role="admin", form=AdminTargetForm)
def delete(request):
    return _mutate(request, service.lifecycle, "delete")
