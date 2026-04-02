from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services.auth_tokens import decode_access_token

_bearer = HTTPBearer(auto_error=False)


async def get_optional_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UUID | None:
    """Bearer JWT if valid; otherwise ``None`` (public / anonymous clients)."""
    if creds is None or creds.scheme.lower() != "bearer":
        return None
    try:
        return decode_access_token(creds.credentials)
    except ValueError:
        return None


async def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UUID:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return decode_access_token(creds.credentials)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e
