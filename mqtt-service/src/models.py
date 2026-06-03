from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class SoilMeasurement:
    run_id: str
    schema_version: str
    device_id: str
    timestamp: datetime
    timezone: str
    x_m: int
    y_m: int
    latitud: float
    longitud: float
    humedad_suelo_pct: float
    temperatura_suelo_c: float
    intensidad_luz: float
    lluvia_mm_h: float
    temperatura_ambiente_c: float
    distancia_rio_m: float
    influencia_rio: float
    retencion_suelo: float
    drenaje: float
    sombra: float
    indice_recorrido: int
    total_puntos: int
    received_at: datetime = field(default_factory=datetime.utcnow)

    def to_document(self) -> dict:
        return {
            "run_id": self.run_id,
            "schema_version": self.schema_version,
            "device_id": self.device_id,
            "timestamp": self.timestamp,
            "timezone": self.timezone,
            "x_m": self.x_m,
            "y_m": self.y_m,
            "latitud": self.latitud,
            "longitud": self.longitud,
            "humedad_suelo_pct": self.humedad_suelo_pct,
            "temperatura_suelo_c": self.temperatura_suelo_c,
            "intensidad_luz": self.intensidad_luz,
            "lluvia_mm_h": self.lluvia_mm_h,
            "temperatura_ambiente_c": self.temperatura_ambiente_c,
            "distancia_rio_m": self.distancia_rio_m,
            "influencia_rio": self.influencia_rio,
            "retencion_suelo": self.retencion_suelo,
            "drenaje": self.drenaje,
            "sombra": self.sombra,
            "indice_recorrido": self.indice_recorrido,
            "total_puntos": self.total_puntos,
            "received_at": self.received_at,
        }


@dataclass
class Run:
    run_id: str
    device_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    total_measurements: int = 0
    status: str = "active"  # active | completed
    label: Optional[str] = None

    def to_document(self) -> dict:
        return {
            "run_id": self.run_id,
            "device_id": self.device_id,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "total_measurements": self.total_measurements,
            "status": self.status,
            "label": self.label,
        }
