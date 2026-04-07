import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.security.app_key import app_key_matches

router = APIRouter()


@router.websocket("/ws/jobs/{job_id}")
async def job_progress_ws(websocket: WebSocket, job_id: UUID):
    """Stream progress updates for a job (replace with pub/sub or DB polling)."""
    if settings.frontend_app_key:
        supplied = websocket.headers.get("x-app-key") or websocket.query_params.get("app_key")
        if not app_key_matches(supplied):
            await websocket.close(code=1008, reason="Missing or invalid app key")
            return
    await websocket.accept()
    await websocket.send_text(
        json.dumps(
            {"job_id": str(job_id), "progress": 0.0, "status": "pending"},
        ),
    )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        return
