from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class HistoryItem(BaseModel):
    id: UUID
    job_id: UUID | None
    title: str
    source_url: str
    artifact_uri: str
    created_at: datetime

    model_config = {"from_attributes": True}


class HistoryList(BaseModel):
    items: list[HistoryItem]
