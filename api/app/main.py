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

# localhost vs 127.0.0.1 and varying dev ports are different browser origins — regex covers them.
_dev_origin_re = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
_cors_kw: dict = {
    "allow_origins": settings.cors_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.app_env == "development" and settings.cors_allow_localhost_regex:
    _cors_kw["allow_origin_regex"] = _dev_origin_re
# App key runs inside CORS so 403 (and other early responses) still get CORS headers.
app.add_middleware(FrontendAppKeyMiddleware)
app.add_middleware(CORSMiddleware, **_cors_kw)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(download.router, prefix="", tags=["download"])
app.include_router(history.router, prefix="/history", tags=["history"])
app.include_router(ws.router, prefix="", tags=["websocket"])


@app.get("/health")
async def health():
    return {"status": "ok"}
