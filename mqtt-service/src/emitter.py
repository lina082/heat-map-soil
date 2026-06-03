import json
import logging
import os
from datetime import datetime
from typing import Any, Callable
from urllib import request, error

logger = logging.getLogger(__name__)

BACKEND_BROADCAST_URL = os.getenv(
    "BACKEND_BROADCAST_URL",
    "http://backend:8000/internal/broadcast",
)

_callbacks: list[Callable] = []


def register_callback(fn: Callable) -> None:
    _callbacks.append(fn)


def _serialize(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Non-serializable type: {type(obj)}")


def emit(event_type: str, data: dict) -> None:
    for cb in _callbacks:
        try:
            cb(event_type, data)
        except Exception as e:
            logger.error(f"Emitter callback error: {e}")
    _post_to_backend(event_type, data)


def _post_to_backend(event_type: str, data: dict) -> None:
    body = json.dumps({"type": event_type, "data": data}, default=_serialize).encode()
    req = request.Request(
        BACKEND_BROADCAST_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=2):
            pass
    except error.URLError as e:
        logger.warning(f"Could not reach backend broadcast: {e}")


def emit_measurement(doc: dict) -> None:
    emit("measurement", json.loads(json.dumps(doc, default=_serialize)))


def emit_run_started(run_id: str, device_id: str) -> None:
    emit("run_started", {"run_id": run_id, "device_id": device_id})


def emit_run_completed(run_id: str, total: int) -> None:
    emit("run_completed", {"run_id": run_id, "total_measurements": total})


def emit_robot_online(run_id: str) -> None:
    emit("robot_online", {"run_id": run_id})


def emit_robot_offline() -> None:
    emit("robot_offline", {})
