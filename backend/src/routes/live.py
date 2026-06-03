import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from database import get_pool
from models import LiveStatus
from ws_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["live"])

OFFLINE_THRESHOLD = timedelta(minutes=5)


@router.get("/live/status", response_model=LiveStatus)
async def get_live_status():
    pool = get_pool()

    row = await pool.fetchrow("""
        SELECT
            r.run_id,
            r.device_id,
            m.x_m        AS last_x,
            m.y_m        AS last_y,
            m.indice_recorrido,
            m.total_puntos,
            m.received_at AS last_seen
        FROM runs r
        JOIN measurements m ON m.run_id = r.run_id
        WHERE r.status = 'active'
        ORDER BY m.received_at DESC
        LIMIT 1
    """)

    if not row:
        return LiveStatus(online=False, run_id=None, device_id=None,
                          last_x=None, last_y=None, indice_recorrido=None,
                          progress_pct=None, last_seen=None)

    last_seen: datetime = row["last_seen"]
    online = (datetime.now(timezone.utc) - last_seen) < OFFLINE_THRESHOLD
    progress = round(row["indice_recorrido"] / row["total_puntos"] * 100, 2)

    return LiveStatus(
        online=online,
        run_id=str(row["run_id"]),
        device_id=row["device_id"],
        last_x=row["last_x"],
        last_y=row["last_y"],
        indice_recorrido=row["indice_recorrido"],
        progress_pct=progress,
        last_seen=last_seen,
    )


@router.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)
