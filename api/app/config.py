from functools import lru_cache
from urllib.parse import urlparse, urlunparse

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_CORS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://vokler:vokler@localhost:5433/vokler"
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        validation_alias=AliasChoices("REDIS_URL", "REDIS_PRIVATE_URL"),
        description="Redis connection URL. Railway exposes REDIS_URL (public) and REDIS_PRIVATE_URL (internal network).",
    )
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    frontend_app_key: str = Field(
        default="",
        validation_alias=AliasChoices("FRONTEND_APP_KEY", "APP_FRONTEND_KEY"),
        description="If non-empty, browsers and other clients must send header X-App-Key with this value "
        "(WebSocket may use query app_key=… or the same header). GET /health and OPTIONS are exempt.",
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: list(_DEFAULT_CORS),
        description="Allowed browser origins (comma-separated in env CORS_ORIGINS).",
    )
    cors_allow_localhost_regex: bool = Field(
        default=True,
        description='If True and app_env is development, also allow http(s)://localhost and 127.0.0.1 on any port.',
    )
    cors_origin_regex: str | None = Field(
        default=None,
        description=(
            "Optional regex for allowed browser origins, applied in addition to cors_origins. "
            "Useful for Railway preview URLs: https?://.*\\.up\\.railway\\.app"
        ),
    )

    @field_validator("redis_url", mode="before")
    @classmethod
    def normalise_redis_url(cls, v: object) -> object:
        """Railway Redis plugin may omit the DB index. Ensure the URL always has one so arq is happy."""
        if not isinstance(v, str):
            return v
        s = v.strip()
        parsed = urlparse(s)
        # Add /0 if there is no DB path component (e.g. redis://host:6379 → redis://host:6379/0)
        path = parsed.path if parsed.path and parsed.path != "/" else "/0"
        return urlunparse(parsed._replace(path=path))

    @field_validator("database_url", mode="before")
    @classmethod
    def database_url_asyncpg(cls, v: object) -> object:
        """Railway/Heroku often set ``postgresql://`` or ``postgres://`` without the async driver."""
        if not isinstance(v, str):
            return v
        s = v.strip()
        if s.startswith("postgresql+asyncpg://"):
            return s
        if s.startswith("postgresql://"):
            return "postgresql+asyncpg://" + s.removeprefix("postgresql://")
        if s.startswith("postgres://"):
            return "postgresql+asyncpg://" + s.removeprefix("postgres://")
        return s

    @field_validator("frontend_app_key", mode="after")
    @classmethod
    def strip_frontend_app_key(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> object:
        if v is None or v == "":
            return list(_DEFAULT_CORS)
        if isinstance(v, str):
            parts = [x.strip() for x in v.split(",") if x.strip()]
            return parts if parts else list(_DEFAULT_CORS)
        return v
    storage_backend: str = Field(
        default="local",
        description="local | r2 | s3 — r2 uses S3 API (Cloudflare R2); s3 is AWS or any S3-compatible store.",
    )
    local_storage_path: str = "./data/downloads"
    s3_bucket: str | None = None
    s3_region: str | None = Field(
        default=None,
        description="AWS region; use 'auto' for Cloudflare R2.",
    )
    s3_endpoint_url: str | None = Field(
        default=None,
        description="S3 API endpoint, e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com for Cloudflare R2.",
    )
    s3_force_path_style: bool = Field(
        default=True,
        description="Set True for R2 and many S3-compatible endpoints.",
    )
    r2_public_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("R2_PUBLIC_BASE_URL", "S3_PUBLIC_BASE_URL"),
        description="Optional public HTTPS base (R2 custom domain or r2.dev) for direct browser URLs; "
        "if unset, downloads use presigned redirects to the bucket.",
    )
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None

    @property
    def arq_redis_settings(self):  # type: ignore[return]
        """Pre-parsed arq RedisSettings built from ``redis_url``."""
        from arq.connections import RedisSettings  # local import avoids circular deps at module load

        return RedisSettings.from_dsn(self.redis_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
