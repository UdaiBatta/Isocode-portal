from django.core.signing import Signer


def sign_pay_token(instalment_id):
    return Signer(salt="pay-token", sep=".").sign(str(instalment_id))


def unsign_pay_token(token):
    return Signer(salt="pay-token", sep=".").unsign(token)
