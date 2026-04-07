from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.security.app_key import app_key_enforced, app_key_matches


class FrontendAppKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not app_key_enforced():
            return await call_next(request)
        if request.method == "OPTIONS":
            return await call_next(request)
        if request.url.path.rstrip("/") == "/health":
            return await call_next(request)
        supplied = request.headers.get("x-app-key")
        if not app_key_matches(supplied):
            return JSONResponse(
                status_code=403,
                content={"detail": "Missing or invalid app key"},
            )
        return await call_next(request)
