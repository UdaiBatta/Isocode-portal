from django.urls import path

from fees.views import auth

urlpatterns = [
    path("request_otp", auth.request_otp),
    path("verify_otp", auth.verify_otp),
    path("staff_login", auth.staff_login),
    path("logout", auth.logout),
    path("set_language", auth.set_language),
    path("me", auth.me),
]
