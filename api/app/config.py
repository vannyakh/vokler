from functools import lru_cache

from pydantic import Field, field_validator
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
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: list[str] = Field(
        default_factory=lambda: list(_DEFAULT_CORS),
        description="Allowed browser origins (comma-separated in env CORS_ORIGINS).",
    )
    cors_allow_localhost_regex: bool = Field(
        default=True,
        description='If True and app_env is development, also allow http(s)://localhost and 127.0.0.1 on any port.',
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> object:
        if v is None or v == "":
            return list(_DEFAULT_CORS)
        if isinstance(v, str):
            parts = [x.strip() for x in v.split(",") if x.strip()]
            return parts if parts else list(_DEFAULT_CORS)
        return v
    storage_backend: str = "local"
    local_storage_path: str = "./data/downloads"
    s3_bucket: str | None = None
    s3_region: str | None = None
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
