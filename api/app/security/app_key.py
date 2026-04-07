import secrets

from app.config import settings


def app_key_enforced() -> bool:
    return bool(settings.frontend_app_key)


def app_key_matches(supplied: str | None) -> bool:
    expected = settings.frontend_app_key
    if not expected:
        return True
    if supplied is None or supplied == "":
        return False
    if len(supplied) != len(expected):
        return False
    return secrets.compare_digest(supplied, expected)
