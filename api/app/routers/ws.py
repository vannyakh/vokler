import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws/jobs/{job_id}")
async def job_progress_ws(websocket: WebSocket, job_id: UUID):
    """Stream progress updates for a job (replace with pub/sub or DB polling)."""
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
