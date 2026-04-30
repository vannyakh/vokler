from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.middleware import FrontendAppKeyMiddleware
from app.routers import auth, download, history, ws


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await engine.dispose()


if settings.app_env == "production" and not settings.frontend_app_key:
    raise RuntimeError(
        "FRONTEND_APP_KEY must be set when APP_ENV=production (empty keys are not allowed).",
    )


app = FastAPI(
    title="Vokler Downloader API",
    version="0.1.0",
    lifespan=lifespan,
)

# Build the effective origin regex:
#   • In dev: cover any localhost / 127.0.0.1 port automatically.
#   • In any env: merge with CORS_ORIGIN_REGEX if the operator set one
#     (e.g. "https?://.*\.up\.railway\.app" covers all Railway preview domains).
_dev_re = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
_custom_re: str | None = (settings.cors_origin_regex or "").strip() or None

_parts: list[str] = []
if settings.app_env == "development" and settings.cors_allow_localhost_regex:
    _parts.append(_dev_re)
if _custom_re:
    _parts.append(_custom_re)

_cors_kw: dict = {
    "allow_origins": settings.cors_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if _parts:
    _cors_kw["allow_origin_regex"] = "|".join(f"(?:{p})" for p in _parts)

# App key middleware runs inside CORS so 403 responses still carry CORS headers.
app.add_middleware(FrontendAppKeyMiddleware)
app.add_middleware(CORSMiddleware, **_cors_kw)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(download.router, prefix="", tags=["download"])
app.include_router(history.router, prefix="/history", tags=["history"])
app.include_router(ws.router, prefix="", tags=["websocket"])


@app.get("/health")
async def health():
    return {"status": "ok"}
