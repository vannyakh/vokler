from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_optional_user_id
from app.models.history import HistoryEntry
from app.schemas.history import HistoryItem, HistoryList

router = APIRouter()


@router.get("", response_model=HistoryList)
async def list_history(
    user_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(HistoryEntry).order_by(HistoryEntry.created_at.desc())
    if user_id is None:
        q = q.where(HistoryEntry.user_id.is_(None))
    else:
        q = q.where(HistoryEntry.user_id == user_id)
    result = await db.scalars(q)
    items = result.all()
    return HistoryList(items=[HistoryItem.model_validate(h) for h in items])


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history_entry(
    entry_id: UUID,
    user_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id is None:
        entry = await db.scalar(
            select(HistoryEntry).where(
                HistoryEntry.id == entry_id,
                HistoryEntry.user_id.is_(None),
            ),
        )
    else:
        entry = await db.scalar(
            select(HistoryEntry).where(
                HistoryEntry.id == entry_id,
                HistoryEntry.user_id == user_id,
            ),
        )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(entry)
    await db.commit()
