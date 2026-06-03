import asyncio
import logging

from fastapi import APIRouter, Request

from ws_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/broadcast")
async def broadcast(request: Request):
    """
    Called by mqtt-service to push events to all WebSocket clients.
    Not exposed to the public — sits behind the internal Docker network.
    """
    body = await request.json()
    event_type = body.get("type")
    data = body.get("data", {})

    if not event_type:
        return {"ok": False, "error": "missing type"}

    asyncio.create_task(manager.broadcast(event_type, data))
    return {"ok": True}
