import logging
from datetime import datetime

import psycopg2
import psycopg2.extras
from psycopg2.extensions import connection as PgConnection

from config import DATABASE_URL

logger = logging.getLogger(__name__)

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS runs (
    id                  SERIAL PRIMARY KEY,
    run_id              UUID        NOT NULL UNIQUE,
    device_id           TEXT        NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL,
    ended_at            TIMESTAMPTZ,
    total_measurements  INTEGER     NOT NULL DEFAULT 0,
    status              TEXT        NOT NULL DEFAULT 'active',
    label               TEXT
);

CREATE TABLE IF NOT EXISTS measurements (
    id                      SERIAL PRIMARY KEY,
    run_id                  UUID            NOT NULL REFERENCES runs(run_id),
    device_id               TEXT            NOT NULL,
    schema_version          TEXT            NOT NULL,
    timestamp               TIMESTAMPTZ     NOT NULL,
    timezone                TEXT            NOT NULL,
    x_m                     SMALLINT        NOT NULL,
    y_m                     SMALLINT        NOT NULL,
    latitud                 DOUBLE PRECISION NOT NULL,
    longitud                DOUBLE PRECISION NOT NULL,
    humedad_suelo_pct       REAL            NOT NULL,
    temperatura_suelo_c     REAL            NOT NULL,
    intensidad_luz          REAL            NOT NULL,
    lluvia_mm_h             REAL            NOT NULL,
    temperatura_ambiente_c  REAL            NOT NULL,
    distancia_rio_m         REAL            NOT NULL,
    influencia_rio          REAL            NOT NULL,
    retencion_suelo         REAL            NOT NULL,
    drenaje                 REAL            NOT NULL,
    sombra                  REAL            NOT NULL,
    indice_recorrido        INTEGER         NOT NULL,
    total_puntos            INTEGER         NOT NULL,
    received_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (run_id, x_m, y_m)
);

CREATE INDEX IF NOT EXISTS idx_meas_run_grid  ON measurements (run_id, x_m, y_m);
CREATE INDEX IF NOT EXISTS idx_meas_run_index ON measurements (run_id, indice_recorrido);
CREATE INDEX IF NOT EXISTS idx_meas_timestamp ON measurements (timestamp);
CREATE INDEX IF NOT EXISTS idx_runs_status    ON runs (status);

CREATE TABLE IF NOT EXISTS system_logs (
    id          SERIAL      PRIMARY KEY,
    level       TEXT        NOT NULL,  -- INFO | WARNING | ERROR | CRITICAL
    source      TEXT        NOT NULL,  -- module name (mqtt-service, backend, etc.)
    event       TEXT        NOT NULL,  -- short event key, e.g. 'broker_connected'
    message     TEXT        NOT NULL,
    run_id      UUID,                  -- nullable, set when event relates to a run
    metadata    JSONB,                 -- arbitrary extra fields
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_level      ON system_logs (level);
CREATE INDEX IF NOT EXISTS idx_logs_source     ON system_logs (source);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_run_id     ON system_logs (run_id) WHERE run_id IS NOT NULL;
"""


def connect() -> PgConnection:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    _bootstrap_schema(conn)
    logger.info("Connected to PostgreSQL and schema ready")
    return conn


def _bootstrap_schema(conn: PgConnection) -> None:
    with conn.cursor() as cur:
        cur.execute(SCHEMA_SQL)
    conn.commit()


def create_run(conn: PgConnection, run_id: str, device_id: str, started_at: datetime) -> None:
    sql = """
        INSERT INTO runs (run_id, device_id, started_at)
        VALUES (%s, %s, %s)
        ON CONFLICT (run_id) DO NOTHING
    """
    with conn.cursor() as cur:
        cur.execute(sql, (run_id, device_id, started_at))
    conn.commit()


def save_measurement(conn: PgConnection, doc: dict) -> None:
    sql = """
        INSERT INTO measurements (
            run_id, device_id, schema_version, timestamp, timezone,
            x_m, y_m, latitud, longitud,
            humedad_suelo_pct, temperatura_suelo_c, intensidad_luz,
            lluvia_mm_h, temperatura_ambiente_c, distancia_rio_m,
            influencia_rio, retencion_suelo, drenaje, sombra,
            indice_recorrido, total_puntos, received_at
        ) VALUES (
            %(run_id)s, %(device_id)s, %(schema_version)s, %(timestamp)s, %(timezone)s,
            %(x_m)s, %(y_m)s, %(latitud)s, %(longitud)s,
            %(humedad_suelo_pct)s, %(temperatura_suelo_c)s, %(intensidad_luz)s,
            %(lluvia_mm_h)s, %(temperatura_ambiente_c)s, %(distancia_rio_m)s,
            %(influencia_rio)s, %(retencion_suelo)s, %(drenaje)s, %(sombra)s,
            %(indice_recorrido)s, %(total_puntos)s, %(received_at)s
        )
        ON CONFLICT (run_id, x_m, y_m) DO UPDATE SET
            humedad_suelo_pct      = EXCLUDED.humedad_suelo_pct,
            temperatura_suelo_c    = EXCLUDED.temperatura_suelo_c,
            intensidad_luz         = EXCLUDED.intensidad_luz,
            lluvia_mm_h            = EXCLUDED.lluvia_mm_h,
            temperatura_ambiente_c = EXCLUDED.temperatura_ambiente_c,
            distancia_rio_m        = EXCLUDED.distancia_rio_m,
            influencia_rio         = EXCLUDED.influencia_rio,
            retencion_suelo        = EXCLUDED.retencion_suelo,
            drenaje                = EXCLUDED.drenaje,
            sombra                 = EXCLUDED.sombra,
            indice_recorrido       = EXCLUDED.indice_recorrido,
            received_at            = EXCLUDED.received_at
    """
    with conn.cursor() as cur:
        cur.execute(sql, doc)
    conn.commit()


def increment_run_count(conn: PgConnection, run_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE runs SET total_measurements = total_measurements + 1 WHERE run_id = %s",
            (run_id,),
        )
    conn.commit()


def get_active_run(conn: PgConnection) -> dict | None:
    """Return active run + last known indice_recorrido, or None if no active run."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT r.run_id, r.device_id, r.started_at,
                   COALESCE(MAX(m.indice_recorrido), -1) AS last_index
            FROM runs r
            LEFT JOIN measurements m ON m.run_id = r.run_id
            WHERE r.status = 'active'
            GROUP BY r.run_id, r.device_id, r.started_at
            ORDER BY r.started_at DESC
            LIMIT 1
        """)
        row = cur.fetchone()
    if row is None:
        return None
    return {
        "run_id":    str(row[0]),
        "device_id": row[1],
        "started_at": row[2],
        "last_index": row[3],
    }


def close_run(conn: PgConnection, run_id: str, ended_at: datetime) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE runs SET ended_at = %s, status = 'completed' WHERE run_id = %s",
            (ended_at, run_id),
        )
    conn.commit()


def log_event(
    conn: PgConnection,
    level: str,
    event: str,
    message: str,
    source: str = "mqtt-service",
    run_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO system_logs (level, source, event, message, run_id, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (level, source, event, message, run_id,
                 psycopg2.extras.Json(metadata) if metadata else None),
            )
        conn.commit()
    except Exception as e:
        logger.error(f"Failed to write log to DB: {e}")
