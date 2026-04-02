"""Local entrypoint: ``uv run python run.py`` from the ``api`` directory."""

from __future__ import annotations

import os

import uvicorn

_HOST = os.environ.get("HOST", "0.0.0.0")
_PORT = int(os.environ.get("PORT", "8000"))
_RELOAD = os.environ.get("RELOAD", "").lower() in ("1", "true", "yes")
_RELOAD = _RELOAD or os.environ.get("APP_ENV", "").lower() == "development"


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host=_HOST,
        port=_PORT,
        reload=_RELOAD,
        factory=False,
    )


if __name__ == "__main__":
    main()
