from django.urls import path

from fees.views import auth, automation, consent, cron, dues, ledger, payment, receipts

urlpatterns = [
    path("request_otp", auth.request_otp),
    path("verify_otp", auth.verify_otp),
    path("staff_login", auth.staff_login),
    path("logout", auth.logout),
    path("set_language", auth.set_language),
    path("me", auth.me),
    path("grant_consent", consent.grant_consent),
    path("decline_consent", consent.decline_consent),
    path("dues", dues.dues),
    path("ledger", ledger.ledger),
    path("receipts", receipts.receipts),
    path("receipt", receipts.receipt),
    path("pay_details", payment.pay_details),
    path("payment_result", payment.payment_result),
    path("counter_payment", payment.counter_payment),
    path("webhooks/payment", payment.webhook),
    path("cron/reminders", cron.reminders),
    path("automation", automation.automation),
    path("resolve_unmatched", automation.resolve_unmatched),
    path("payment_candidates", automation.payment_candidates),
]
