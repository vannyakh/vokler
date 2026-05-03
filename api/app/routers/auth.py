import secrets
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user_id
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    OAuthSyncRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserPublic,
)
from app.services.auth_tokens import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)

router = APIRouter()


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    exists = await db.scalar(select(User).where(User.email == body.email))
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserPublic.model_validate(user)


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    access = create_access_token(
        user.id,
        timedelta(minutes=settings.access_token_expire_minutes),
    )
    refresh = create_refresh_token(
        user.id,
        timedelta(days=settings.refresh_token_expire_days),
    )
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest):
    try:
        user_id = decode_refresh_token(body.refresh_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e
    access = create_access_token(
        user_id,
        timedelta(minutes=settings.access_token_expire_minutes),
    )
    new_refresh = create_refresh_token(
        user_id,
        timedelta(days=settings.refresh_token_expire_days),
    )
    return TokenPair(access_token=access, refresh_token=new_refresh)


@router.post("/oauth-sync", response_model=TokenPair)
async def oauth_sync(
    body: OAuthSyncRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Provision FastAPI `users` row after Better Auth OAuth; called only from Next.js (shared secret)."""
    supplied = (request.headers.get("x-oauth-sync-secret") or "").strip()
    if not settings.oauth_sync_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth sync is not configured",
        )
    if not supplied or not secrets.compare_digest(supplied, settings.oauth_sync_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid oauth sync secret",
        )
    email_norm = str(body.email).strip().lower()
    user = await db.scalar(select(User).where(func.lower(User.email) == email_norm))
    if user is None:
        user = User(
            email=str(body.email).strip(),
            password_hash=hash_password(secrets.token_urlsafe(48)),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    access = create_access_token(
        user.id,
        timedelta(minutes=settings.access_token_expire_minutes),
    )
    refresh = create_refresh_token(
        user.id,
        timedelta(days=settings.refresh_token_expire_days),
    )
    return TokenPair(access_token=access, refresh_token=refresh)


@router.get("/me", response_model=UserPublic)
async def me(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublic.model_validate(user)
