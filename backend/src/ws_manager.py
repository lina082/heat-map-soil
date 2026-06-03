import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


def _serialize(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Non-serializable: {type(obj)}")


class ConnectionManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
        logger.info(f"WS client connected. Total: {len(self._connections)}")

    async def connect_accepted(self, ws: WebSocket) -> None:
        """Use when the caller already called ws.accept()."""
        async with self._lock:
            self._connections.add(ws)
        logger.info(f"WS client connected. Total: {len(self._connections)}")

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)
        logger.info(f"WS client disconnected. Total: {len(self._connections)}")

    async def broadcast(self, event_type: str, data: dict) -> None:
        if not self._connections:
            return
        message = json.dumps({"type": event_type, "data": data}, default=_serialize)
        dead: set[WebSocket] = set()
        async with self._lock:
            targets = set(self._connections)
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        if dead:
            async with self._lock:
                self._connections -= dead


manager = ConnectionManager()
