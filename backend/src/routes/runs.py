from fastapi import APIRouter, HTTPException, Query
from database import get_pool
from models import RunSummary, RunStats
from variables import VARIABLES, get_variable

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[RunSummary])
async def list_runs():
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT * FROM runs ORDER BY started_at DESC"
    )
    return [dict(r) for r in rows]


@router.get("/{run_id}", response_model=RunSummary)
async def get_run(run_id: str):
    pool = get_pool()
    row = await pool.fetchrow("SELECT * FROM runs WHERE run_id = $1", run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    return dict(row)


@router.get("/{run_id}/stats", response_model=list[RunStats])
async def get_run_stats(run_id: str):
    pool = get_pool()
    row = await pool.fetchrow("SELECT 1 FROM runs WHERE run_id = $1", run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")

    results = []
    for key, meta in VARIABLES.items():
        # column name is trusted — comes from our own hardcoded dict, not user input
        sql = f"""
            SELECT
                AVG({meta.column})::float                                            AS avg,
                MIN({meta.column})::float                                            AS min,
                MAX({meta.column})::float                                            AS max,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY {meta.column})::float   AS median,
                STDDEV({meta.column})::float                                         AS stddev
            FROM measurements
            WHERE run_id = $1
        """
        stat = await pool.fetchrow(sql, run_id)
        if stat and stat["avg"] is not None:
            results.append(RunStats(
                variable=key,
                avg=round(stat["avg"], 4),
                min=round(stat["min"], 4),
                max=round(stat["max"], 4),
                median=round(stat["median"], 4),
                stddev=round(stat["stddev"] or 0.0, 4),
            ))
    return results


@router.get("/{run_id}/distribution")
async def get_distribution(
    run_id: str,
    variable: str = Query(...),
    bins: int = Query(10, ge=3, le=30),
):
    """Return histogram bins for a variable — used by the treemap/distribution view."""
    meta = get_variable(variable)
    pool = get_pool()

    row = await pool.fetchrow("SELECT 1 FROM runs WHERE run_id = $1", run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")

    # compute equal-width bins in SQL
    sql = f"""
        WITH bounds AS (
            SELECT MIN({meta.column})::float AS lo, MAX({meta.column})::float AS hi
            FROM measurements WHERE run_id = $1
        ),
        binned AS (
            SELECT
                WIDTH_BUCKET({meta.column}, b.lo, b.hi + 0.000001, $2) AS bucket,
                COUNT(*)::int AS count,
                AVG({meta.column})::float AS avg_value,
                b.lo,
                b.hi
            FROM measurements, bounds b
            WHERE run_id = $1
            GROUP BY bucket, b.lo, b.hi
            ORDER BY bucket
        )
        SELECT
            bucket,
            count,
            avg_value,
            lo + (bucket - 1) * (hi - lo) / $2 AS bin_min,
            lo + bucket       * (hi - lo) / $2 AS bin_max
        FROM binned
    """
    rows = await pool.fetch(sql, run_id, bins)
    return [
        {
            "bucket": r["bucket"],
            "count": r["count"],
            "avg_value": round(r["avg_value"], 4),
            "bin_min": round(r["bin_min"], 4),
            "bin_max": round(r["bin_max"], 4),
            "label": f"{r['bin_min']:.1f}–{r['bin_max']:.1f} {meta.unit}",
        }
        for r in rows
    ]
