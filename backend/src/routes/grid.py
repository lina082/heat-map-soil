from fastapi import APIRouter, HTTPException, Query
from database import get_pool
from models import GridResponse, GridCell, CellDetail, TimeseriesPoint
from variables import get_variable

router = APIRouter(prefix="/runs", tags=["grid"])


@router.get("/{run_id}/grid", response_model=GridResponse)
async def get_grid(
    run_id: str,
    variable: str = Query(..., description="Column name to map"),
):
    meta = get_variable(variable)  # raises ValueError on unknown key
    pool = get_pool()

    run = await pool.fetchrow("SELECT 1 FROM runs WHERE run_id = $1", run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # column is safe — comes from our hardcoded VARIABLES dict
    sql = f"""
        SELECT
            x_m,
            y_m,
            {meta.column}::float AS value,
            MIN({meta.column}) OVER () AS global_min,
            MAX({meta.column}) OVER () AS global_max
        FROM measurements
        WHERE run_id = $1
        ORDER BY y_m, x_m
    """
    rows = await pool.fetch(sql, run_id)

    if not rows:
        return GridResponse(
            run_id=run_id, variable=variable,
            label=meta.label, unit=meta.unit,
            min=0.0, max=0.0, grid=[],
        )

    grid = [GridCell(x=r["x_m"], y=r["y_m"], value=r["value"]) for r in rows]
    return GridResponse(
        run_id=run_id,
        variable=variable,
        label=meta.label,
        unit=meta.unit,
        min=round(rows[0]["global_min"], 4),
        max=round(rows[0]["global_max"], 4),
        grid=grid,
    )


@router.get("/{run_id}/cell", response_model=CellDetail)
async def get_cell(run_id: str, x: int = Query(...), y: int = Query(...)):
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM measurements WHERE run_id = $1 AND x_m = $2 AND y_m = $3",
        run_id, x, y,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Cell not measured yet")
    return dict(row)


@router.get("/{run_id}/timeseries", response_model=list[TimeseriesPoint])
async def get_timeseries(
    run_id: str,
    x: int = Query(...),
    y: int = Query(...),
    variable: str = Query(...),
):
    meta = get_variable(variable)
    pool = get_pool()

    # compare same grid cell across all completed runs, ordered by time
    sql = f"""
        SELECT r.started_at AS timestamp, m.{meta.column}::float AS value
        FROM measurements m
        JOIN runs r ON r.run_id = m.run_id
        WHERE m.x_m = $1 AND m.y_m = $2
        ORDER BY r.started_at
    """
    rows = await pool.fetch(sql, x, y)
    return [TimeseriesPoint(timestamp=r["timestamp"], value=r["value"]) for r in rows]
