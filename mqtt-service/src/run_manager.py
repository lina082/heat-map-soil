import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


class RunManager:
    """
    Tracks the active run in memory and detects when a new run must be created.

    A new run is triggered when:
      1. No active run exists (first message ever).
      2. indice_recorrido resets below the last known index (robot restarted).
      3. Gap between messages exceeds the configured timeout.
    """

    def __init__(self, timeout_seconds: int = 1800):
        self._active_run_id: Optional[str] = None
        self._active_device_id: Optional[str] = None
        self._last_index: int = -1
        self._last_seen: Optional[datetime] = None
        self._timeout = timedelta(seconds=timeout_seconds)

    @property
    def active_run_id(self) -> Optional[str]:
        return self._active_run_id

    def is_new_run(self, indice_recorrido: int, now: datetime) -> bool:
        if self._active_run_id is None:
            return True
        if indice_recorrido < self._last_index:
            logger.info(f"Index reset detected: {indice_recorrido} < {self._last_index}")
            return True
        if self._last_seen and (now - self._last_seen) > self._timeout:
            logger.info(f"Inactivity timeout exceeded: {now - self._last_seen}")
            return True
        return False

    def start_run(self, device_id: str, now: datetime) -> str:
        new_id = str(uuid.uuid4())
        logger.info(f"Starting new run: {new_id} | device: {device_id}")
        self._active_run_id = new_id
        self._active_device_id = device_id
        self._last_index = -1
        self._last_seen = now
        return new_id

    def update(self, indice_recorrido: int, now: datetime) -> None:
        self._last_index = indice_recorrido
        self._last_seen = now

    def resume(self, run_id: str, device_id: str, last_index: int, now: datetime) -> None:
        """Restore in-memory state from DB after a service restart."""
        logger.info(f"Resuming run {run_id} at index {last_index}")
        self._active_run_id = run_id
        self._active_device_id = device_id
        self._last_index = last_index
        self._last_seen = now

    def is_complete(self, total_puntos: int) -> bool:
        return self._last_index >= total_puntos - 1
