# heat-map-soil

Real-time soil monitoring system. A robot traverses a 1-hectare field (100 m × 100 m), publishing one soil measurement per square meter via MQTT. This system ingests those measurements, persists them, and renders them as a live-updating spatial heat map — one colored cell per square meter.

![Status](https://img.shields.io/badge/status-active-22c55e?style=flat-square)
![Stack](https://img.shields.io/badge/stack-FastAPI%20%7C%20React%20%7C%20PostgreSQL%20%7C%20Docker-0f172a?style=flat-square)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Data Model](#data-model)
- [Monitored Variables](#monitored-variables)
- [API Reference](#api-reference)
- [Frontend](#frontend)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Development](#development)

---

## Overview

| Property | Value |
|---|---|
| Field size | 1 hectare — 100 m × 100 m |
| Grid resolution | 10,000 cells (1 cell = 1 m²) |
| Measurement interval | ~10 seconds per point |
| Full sweep duration | ~28 hours |
| MQTT broker | `190.248.28.132:3001` |
| Topic | `suelo/robot-01/#` |
| Device | `robot-suelo-01` |

The system supports:
- **Live heat map** — WebSocket-driven, updates cell-by-cell as the robot advances
- **Historical browsing** — full map replay for any past sweep
- **Statistical analysis** — per-variable stats (avg, min, max, median, stddev) and treemap distribution charts
- **Auto-resume** — on service restart, active run state is recovered from the database; no duplicate runs created

---

## Architecture

```
[MQTT Broker 190.248.28.132:3001]
          │
          ▼
  [mqtt-service]  ← Python · paho-mqtt
  Parse payload → validate fields → normalize UTC timestamp
  Detect run lifecycle (new / resume / complete)
          │
     ┌────┴────┐
     ▼         ▼
[PostgreSQL]  POST /internal/broadcast
(persist)          │
                   ▼
          [backend]  ← FastAPI · asyncpg
          REST API + WebSocket manager
                   │
                   ▼  (WebSocket push)
          [frontend]  ← React · nginx
          Canvas heat map · Treemap · Analytics
```

**Event flow:**
1. `mqtt-service` receives `/data` message → upserts measurement → POSTs event to `backend:8000/internal/broadcast`
2. Backend broadcasts event to all connected WebSocket clients
3. Frontend `useWebSocket` hook receives update → patches `Map<"x,y", value>` grid state in O(1)
4. Canvas re-renders only changed cells

---

## Services

| Service | Image / Build | Port (host) | Role |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5435` | Primary data store |
| `mqtt-service` | `./mqtt-service` | — | MQTT ingestion + persistence |
| `backend` | `./backend` | `8090` | REST API + WebSocket server |
| `frontend` | `./frontend` | `4200` | React SPA served by nginx |
| `pgadmin` *(dev)* | `dpage/pgadmin4` | `8081` | Database admin UI |

---

## Data Model

### `runs`

One row per robot sweep session.

```sql
run_id              UUID        UNIQUE NOT NULL
device_id           TEXT        NOT NULL
started_at          TIMESTAMPTZ NOT NULL
ended_at            TIMESTAMPTZ             -- NULL while active
total_measurements  INTEGER     DEFAULT 0
status              TEXT        DEFAULT 'active'  -- active | completed
label               TEXT                    -- optional human name
```

### `measurements`

One row per MQTT `/data` message. Upserted on `(run_id, x_m, y_m)` — safe to replay without duplicates.

```sql
run_id                UUID    REFERENCES runs(run_id)
x_m                   SMALLINT    -- 0–99
y_m                   SMALLINT    -- 0–99
timestamp             TIMESTAMPTZ -- UTC, normalized from America/Bogota
humedad_suelo_pct     REAL
temperatura_suelo_c   REAL
intensidad_luz        REAL
lluvia_mm_h           REAL
temperatura_ambiente_c REAL
distancia_rio_m       REAL
influencia_rio        REAL
retencion_suelo       REAL
drenaje               REAL
sombra                REAL
indice_recorrido      INTEGER
total_puntos          INTEGER
received_at           TIMESTAMPTZ DEFAULT NOW()

UNIQUE (run_id, x_m, y_m)
```

### `system_logs`

Structured event log written by `mqtt-service` for broker connections, run lifecycle events, and parse errors.

```sql
level       TEXT        -- INFO | WARNING | ERROR
source      TEXT        -- mqtt-service | backend
event       TEXT        -- broker_connected | run_started | ...
message     TEXT
run_id      UUID        -- nullable
metadata    JSONB
created_at  TIMESTAMPTZ DEFAULT NOW()
```

**Indexes:** `(run_id, x_m, y_m)` · `(run_id, indice_recorrido)` · `timestamp` · `status`

---

## Monitored Variables

All variables are selectable as the heat map variable. Each has a plain-language description shown in the UI.

| Key | Label (UI) | Unit | Description |
|---|---|---|---|
| `humedad_suelo_pct` | Humedad del suelo | % | Soil moisture content |
| `temperatura_suelo_c` | Temperatura del suelo | °C | Soil temperature |
| `intensidad_luz` | Luz solar | lux | Light intensity at soil level |
| `lluvia_mm_h` | Lluvia | mm/h | Rainfall rate |
| `temperatura_ambiente_c` | Temperatura del aire | °C | Ambient air temperature |
| `distancia_rio_m` | Distancia al río | m | Distance to nearest river |
| `influencia_rio` | Influencia del río | 0–1 | River influence factor |
| `retencion_suelo` | Retención de agua | 0–1 | Soil water retention capacity |
| `drenaje` | Drenaje | 0–1 | Soil drainage rate |
| `sombra` | Sombra | 0–1 | Shade coverage factor |

---

## API Reference

Base URL: `http://localhost:8090/api/v1`  
Interactive docs: `http://localhost:8090/docs`

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/variables` | List all mappable variables with label, unit, description |
| `GET` | `/runs` | List all sweep sessions, newest first |
| `GET` | `/runs/{run_id}` | Single run detail |
| `GET` | `/runs/{run_id}/stats` | AVG · MIN · MAX · MEDIAN · STDDEV for all 10 variables |
| `GET` | `/runs/{run_id}/grid?variable=X` | Full grid snapshot for heat map rendering |
| `GET` | `/runs/{run_id}/cell?x=N&y=N` | All field values for one specific grid cell |
| `GET` | `/runs/{run_id}/timeseries?x=N&y=N&variable=X` | Cell value across all runs (temporal trend) |
| `GET` | `/runs/{run_id}/distribution?variable=X&bins=12` | Histogram bins for treemap chart |
| `GET` | `/live/status` | Current robot state — position, progress, online flag |
| `WS` | `/ws/live` | Real-time measurement push to browser clients |
| `POST` | `/internal/broadcast` | Internal: mqtt-service → backend event relay |

### WebSocket Message Types

```json
{ "type": "measurement",   "data": { "run_id": "...", "x_m": 45, "y_m": 12, ... } }
{ "type": "run_started",   "data": { "run_id": "...", "device_id": "..." } }
{ "type": "run_completed", "data": { "run_id": "...", "total_measurements": 10000 } }
{ "type": "robot_online",  "data": { "run_id": "..." } }
{ "type": "robot_offline", "data": {} }
```

---

## Frontend

Built with React 18 + Vite, served by nginx. Three views:

### En vivo (Live)
- 100×100 canvas heat map with 1px cell gaps for grid texture
- D3 `interpolateRdYlBu` color scale — blue = low, red = high
- Vertical legend with tick marks and value labels
- Robot position indicator (green dot)
- Variable selector with plain-language description
- Click any cell → popup with all 10 field values + GPS coordinates
- WebSocket auto-reconnect on disconnect

### Historial (History)
- List of all past sweeps with timestamps and point counts
- Full heat map replay for any selected run

### Análisis (Analytics)
- Stat cards: Promedio · Mínimo · Máximo · Mediana
- Squarified treemap — blocks sized by frequency, colored by avg value
- WCAG-compliant text contrast via luminance calculation
- Summary table — all 10 variables, click row to switch active variable

**Design:** Industrial dark-first UI. Rubik font + IBM Plex Mono for data. Amber/green accent. Dark/light toggle persisted in `localStorage`.

---

## Getting Started

### Prerequisites

- Docker + Docker Compose v2
- Git

### 1. Clone

```bash
git clone https://github.com/lina082/heat-map-soil.git
cd heat-map-soil
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` — set a strong `POSTGRES_PASSWORD`. Do **not** commit `.env`.

### 3. Start

```bash
docker compose up -d
```

First run builds all images (~2–3 min). Subsequent starts are fast.

### 4. Access

| URL | Description |
|---|---|
| `http://localhost:4200` | Main application |
| `http://localhost:8090/docs` | API documentation |
| `localhost:5435` | PostgreSQL (user: from `.env`) |

### Stop

```bash
docker compose down
```

### Full reset (wipes all data)

**Warning:** This permanently deletes all measurements and run history.

```bash
docker compose down && docker volume rm heat-map-soil_pg_data
```

---

## Configuration

All configuration via environment variables in `.env`:

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `heatmap_soil` | Database name |
| `POSTGRES_USER` | — | Database user |
| `POSTGRES_PASSWORD` | — | Database password |
| `MQTT_BROKER` | `190.248.28.132` | MQTT broker host |
| `MQTT_PORT` | `3001` | MQTT broker port |
| `MQTT_TOPIC` | `suelo/robot-01/#` | MQTT subscription topic |
| `PGADMIN_DEFAULT_EMAIL` | — | pgAdmin login (dev only) |
| `PGADMIN_DEFAULT_PASSWORD` | — | pgAdmin password (dev only) |
| `DOMAIN` | — | Domain for TLS (production) |
| `CERTBOT_EMAIL` | — | Email for Let's Encrypt (production) |

---

## Project Structure

```
heat-map-soil/
├── docker-compose.yml          # Production stack
├── docker-compose.dev.yml      # Dev overlay — adds pgAdmin
├── .env.example                # Environment template
│
├── mqtt-service/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
│       ├── main.py             # Entry point — MQTT loop + message handler
│       ├── config.py           # Env vars
│       ├── parser.py           # Payload decode, field validation, UTC normalization
│       ├── run_manager.py      # Run lifecycle — detect new / resume / complete
│       ├── storage.py          # PostgreSQL — schema bootstrap, upsert, run CRUD
│       ├── emitter.py          # Event bus — POST to backend + local callbacks
│       └── models.py           # SoilMeasurement + Run dataclasses
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
│       ├── main.py             # FastAPI app + SkipCORSForWebSocket middleware
│       ├── config.py           # DATABASE_URL
│       ├── database.py         # asyncpg pool
│       ├── models.py           # Pydantic response models (UUID coercion)
│       ├── variables.py        # Single source of truth — all 10 variables
│       ├── ws_manager.py       # Thread-safe WebSocket broadcast
│       └── routes/
│           ├── runs.py         # /runs · /stats · /distribution
│           ├── grid.py         # /grid · /cell · /timeseries
│           ├── live.py         # /live/status · WS /ws/live
│           └── internal.py     # /internal/broadcast
│
└── frontend/
    ├── Dockerfile              # Multi-stage: node build → nginx serve
    ├── nginx.conf              # Proxy /api/ and /ws/live → backend, SPA fallback
    ├── tailwind.config.ts      # Industrial dark-first design tokens
    └── src/
        ├── App.tsx             # Nav, dark/light toggle, page routing
        ├── api/client.ts       # Typed REST wrappers
        ├── hooks/
        │   ├── useWebSocket.ts # WS with auto-reconnect
        │   └── useGrid.ts      # Map<"x,y", value> — O(1) updates
        ├── components/
        │   ├── HeatMapCanvas.tsx   # Canvas 700×700 + vertical legend
        │   ├── TreemapChart.tsx    # Squarified treemap, WCAG contrast
        │   ├── CellPopup.tsx       # All 10 values per cell
        │   └── ...
        └── pages/
            ├── LiveView.tsx
            ├── HistoryView.tsx
            └── AnalyticsView.tsx
```

---

## Development

### Run with pgAdmin

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

pgAdmin available at `http://localhost:8081`  
Connect to: host `postgres`, port `5432`, user/password from `.env`

### Rebuild a single service

```bash
docker compose build backend
docker compose up -d backend
```

### View logs

```bash
docker compose logs -f mqtt-service
docker compose logs -f backend
```

### Query the database directly

```bash
psql -h 127.0.0.1 -p 5435 -U <POSTGRES_USER> -d heatmap_soil
```

### Useful queries

```sql
-- Current active run
SELECT run_id, total_measurements, started_at FROM runs WHERE status = 'active';

-- How many rows measured per sweep row
SELECT y_m, COUNT(*) AS points FROM measurements
WHERE run_id = '<run_id>' GROUP BY y_m ORDER BY y_m;

-- Field stats for a variable
SELECT AVG(humedad_suelo_pct), MIN(humedad_suelo_pct), MAX(humedad_suelo_pct),
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY humedad_suelo_pct) AS median
FROM measurements WHERE run_id = '<run_id>';
```
