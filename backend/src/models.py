from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, field_validator


def _str_uuid(v: Any) -> Any:
    return str(v) if v is not None else v


class RunSummary(BaseModel):
    run_id: str
    device_id: str
    started_at: datetime
    ended_at: Optional[datetime]
    total_measurements: int
    status: str
    label: Optional[str]

    @field_validator("run_id", mode="before")
    @classmethod
    def coerce_run_id(cls, v: Any) -> str:
        return str(v)


class GridCell(BaseModel):
    x: int
    y: int
    value: float


class GridResponse(BaseModel):
    run_id: str
    variable: str
    label: str
    unit: str
    min: float
    max: float
    grid: list[GridCell]


class CellDetail(BaseModel):
    run_id: str
    x_m: int
    y_m: int
    timestamp: datetime
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

    @field_validator("run_id", mode="before")
    @classmethod
    def coerce_run_id(cls, v: Any) -> str:
        return str(v)


class TimeseriesPoint(BaseModel):
    timestamp: datetime
    value: float


class RunStats(BaseModel):
    variable: str
    avg: float
    min: float
    max: float
    median: float
    stddev: float


class LiveStatus(BaseModel):
    online: bool
    run_id: Optional[str]
    device_id: Optional[str]
    last_x: Optional[int]
    last_y: Optional[int]
    indice_recorrido: Optional[int]
    progress_pct: Optional[float]
    last_seen: Optional[datetime]

    @field_validator("run_id", mode="before")
    @classmethod
    def coerce_run_id(cls, v: Any) -> Any:
        return str(v) if v is not None else v
