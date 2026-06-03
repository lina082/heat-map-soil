import json
import logging
from datetime import datetime, timezone
from typing import Optional

from dateutil import parser as dateutil_parser

logger = logging.getLogger(__name__)

TOPIC_DATA = "data"
TOPIC_STATUS = "status"

_REQUIRED_DATA_FIELDS = [
    "schema_version", "device_id", "timestamp", "timezone",
    "x_m", "y_m", "latitud", "longitud",
    "humedad_suelo_pct", "temperatura_suelo_c", "intensidad_luz",
    "lluvia_mm_h", "temperatura_ambiente_c", "distancia_rio_m",
    "influencia_rio", "retencion_suelo", "drenaje", "sombra",
    "indice_recorrido", "total_puntos",
]


def topic_type(topic: str) -> Optional[str]:
    parts = topic.split("/")
    if len(parts) < 3:
        return None
    last = parts[-1]
    return last if last in (TOPIC_DATA, TOPIC_STATUS) else None


def decode_payload(raw: str) -> Optional[dict]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning(f"Invalid JSON payload: {e} | raw: {raw[:120]}")
        return None


def normalize_timestamp(ts_str: str) -> datetime:
    """Parse ISO8601 timestamp with any offset and return UTC naive datetime."""
    dt = dateutil_parser.isoparse(ts_str)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def extract_data_fields(payload: dict) -> Optional[dict]:
    """Validate and cast all fields from a /data topic message."""
    missing = [f for f in _REQUIRED_DATA_FIELDS if f not in payload]
    if missing:
        logger.warning(f"Missing fields in /data payload: {missing}")
        return None

    try:
        return {
            "schema_version": payload["schema_version"],
            "device_id": payload["device_id"],
            "timestamp": normalize_timestamp(payload["timestamp"]),
            "timezone": payload["timezone"],
            "x_m": int(payload["x_m"]),
            "y_m": int(payload["y_m"]),
            "latitud": float(payload["latitud"]),
            "longitud": float(payload["longitud"]),
            "humedad_suelo_pct": float(payload["humedad_suelo_pct"]),
            "temperatura_suelo_c": float(payload["temperatura_suelo_c"]),
            "intensidad_luz": float(payload["intensidad_luz"]),
            "lluvia_mm_h": float(payload["lluvia_mm_h"]),
            "temperatura_ambiente_c": float(payload["temperatura_ambiente_c"]),
            "distancia_rio_m": float(payload["distancia_rio_m"]),
            "influencia_rio": float(payload["influencia_rio"]),
            "retencion_suelo": float(payload["retencion_suelo"]),
            "drenaje": float(payload["drenaje"]),
            "sombra": float(payload["sombra"]),
            "indice_recorrido": int(payload["indice_recorrido"]),
            "total_puntos": int(payload["total_puntos"]),
        }
    except (ValueError, TypeError) as e:
        logger.warning(f"Type casting error in /data payload: {e}")
        return None
