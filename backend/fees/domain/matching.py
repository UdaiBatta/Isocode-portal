def decide_payment(status, found, student_active, balance, amount):
    if status == "failed":
        return {"action": "none", "result": "failed"}
    if status == "pending":
        return {"action": "none", "result": "pending"}
    if status != "success":
        raise ValueError("Payment status is invalid.")
    if not found:
        return {"action": "queue", "reason": "unknown_reference"}
    if not student_active:
        return {"action": "queue", "reason": "student_withdrawn"}
    if balance == 0:
        return {"action": "queue", "reason": "already_paid"}
    if amount != balance:
        return {"action": "queue", "reason": "amount_mismatch"}
    return {"action": "allocate"}
