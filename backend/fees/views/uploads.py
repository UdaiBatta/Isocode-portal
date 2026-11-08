from django.http import JsonResponse

from fees.auth import api, error
from fees.forms import ProgressUploadForm
from fees.services.uploads import upload_progress


@api(role="accounts", form=ProgressUploadForm)
def progress(request):
    result = upload_progress(request.subject, request.data)
    if result is None:
        return error("forbidden", "Choose an active batch in your centre scope.", 403)
    return JsonResponse({"ok": True, **result})
