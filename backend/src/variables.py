from dataclasses import dataclass


@dataclass(frozen=True)
class VariableMeta:
    column: str
    label: str
    unit: str
    description: str


VARIABLES: dict[str, VariableMeta] = {
    "humedad_suelo_pct": VariableMeta(
        "humedad_suelo_pct", "Humedad del suelo", "%",
        "Qué tan húmeda está la tierra. Más alto = más agua en el suelo.",
    ),
    "temperatura_suelo_c": VariableMeta(
        "temperatura_suelo_c", "Temperatura del suelo", "°C",
        "Qué tan caliente está la tierra. Afecta el crecimiento de las raíces.",
    ),
    "intensidad_luz": VariableMeta(
        "intensidad_luz", "Luz solar", "lux",
        "Cuánta luz llega al suelo. Más alto = más sol directo.",
    ),
    "lluvia_mm_h": VariableMeta(
        "lluvia_mm_h", "Lluvia", "mm/h",
        "Cuánta lluvia está cayendo. 0 = sin lluvia.",
    ),
    "temperatura_ambiente_c": VariableMeta(
        "temperatura_ambiente_c", "Temperatura del aire", "°C",
        "Qué tan caliente está el aire sobre el campo.",
    ),
    "distancia_rio_m": VariableMeta(
        "distancia_rio_m", "Distancia al río", "m",
        "Qué tan lejos está ese punto del río más cercano.",
    ),
    "influencia_rio": VariableMeta(
        "influencia_rio", "Influencia del río", "0–1",
        "Cuánto afecta el río a ese punto. 1 = muy cerca y muy influenciado.",
    ),
    "retencion_suelo": VariableMeta(
        "retencion_suelo", "Retención de agua", "0–1",
        "Qué tan bien retiene el agua ese suelo. Más alto = tierra más esponjosa.",
    ),
    "drenaje": VariableMeta(
        "drenaje", "Drenaje", "0–1",
        "Qué tan rápido escapa el agua del suelo. Más alto = se escurre más rápido.",
    ),
    "sombra": VariableMeta(
        "sombra", "Sombra", "0–1",
        "Qué tan sombreado está ese punto. 1 = completamente en sombra.",
    ),
}


def get_variable(key: str) -> VariableMeta:
    if key not in VARIABLES:
        raise ValueError(f"Unknown variable: {key}. Valid: {list(VARIABLES)}")
    return VARIABLES[key]
