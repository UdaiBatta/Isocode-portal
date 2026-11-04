import re


def normalize_phone(value: str) -> str | None:
    digits = re.sub(r"[\s-]", "", value)
    for prefix in ["+91", "91", "0"]:
        if digits.startswith(prefix) and len(digits) == len(prefix) + 10:
            digits = digits[len(prefix):]
            break
    return f"+91{digits}" if re.fullmatch(r"[6-9][0-9]{9}", digits) else None
