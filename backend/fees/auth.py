import json
import os
from functools import wraps
from hashlib import sha256
from uuid import UUID

from django.db import connection
from django.http import JsonResponse
from django.utils.crypto import constant_time_compare

from fees.models import Guardian, StaffUser


def error(code, message, status=400):
    return JsonResponse({"ok": False, "code": code, "message": message}, status=status)


def lock_subject(kind, value):
    # Unknown phones/emails have no row to lock; serialize their rate-limit checks too.
    key = int.from_bytes(sha256(f"{kind}:{value}".encode()).digest()[:8], "big", signed=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [key])


def api(*, role, form=None, methods=("POST",)):
    def decorate(view):
        @wraps(view)
        def guarded(request, *args, **kwargs):
            secret = os.getenv("INTERNAL_API_SECRET", "")
            if not secret or not constant_time_compare(request.headers.get("X-Internal-Key", ""), secret):
                return error("forbidden", "Internal API access required.", 403)
            if request.method not in methods:
                response = error("method_not_allowed", "Method not allowed.", 405)
                response["Allow"] = ", ".join(methods)
                return response
            request.subject = None
            request.role = None
            if role != "public":
                try:
                    subject_id = UUID(request.session.get("subject_id", ""))
                except (ValueError, TypeError, AttributeError):
                    return error("unauthenticated", "Sign in to continue.", 401)
                if request.session.get("subject_type") == "guardian":
                    request.subject = Guardian.objects.filter(pk=subject_id).first()
                    request.role = "parent"
                elif request.session.get("subject_type") == "staff":
                    request.subject = StaffUser.objects.filter(pk=subject_id, archived_at__isnull=True).first()
                    request.role = request.subject.role if request.subject else None
                if not request.subject:
                    return error("unauthenticated", "Sign in to continue.", 401)
                if role != "any" and request.role != role:
                    return error("forbidden", "This account cannot access this operation.", 403)
            if form is not None:
                try:
                    data = json.loads(request.body)
                except (ValueError, UnicodeDecodeError):
                    return error("invalid", "A JSON object is required.")
                if not isinstance(data, dict):
                    return error("invalid", "A JSON object is required.")
                validated = form(data)
                if not validated.is_valid():
                    return error("invalid", "Check the entered values.")
                request.data = validated.cleaned_data
            return view(request, *args, **kwargs)
        guarded.api_role = role
        return guarded
    return decorate
