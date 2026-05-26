"""Postgres-backed data store.

Mirrors the public functions of csv_store so the routers don't care which
backend is active (see backend/store.py, selected by DATA_BACKEND=db).

Reads come from two views in the `analysis` schema:
  - analysis.grid_assignments_view    meter / map / assignment data
  - analysis.grid_kw_low_load_high_pv  demand + pv time series (a UNION)

Writes (bus reassignments) go straight to the base table
analysis.grid_assignments — the views are read-only joins and cannot be
updated directly. The connecting DB user therefore needs UPDATE on that table.

The connection string is read from DATABASE_URL (see .env / .env.example).
"""
import os

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None


def _get_pool() -> ConnectionPool:
    """Lazily open a small connection pool from DATABASE_URL."""
    global _pool
    if _pool is None:
        dsn = os.getenv("DATABASE_URL")
        if not dsn:
            raise RuntimeError(
                "DATABASE_URL is not set. Copy .env.example to .env and fill in "
                "the connection string (the database is behind the VPN — connect "
                "first). See tutorial.txt."
            )
        _pool = ConnectionPool(
            conninfo=dsn,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row},
            open=True,
        )
    return _pool


def get_scenarios() -> list[str]:
    sql = (
        "SELECT DISTINCT assignment FROM analysis.grid_assignments_view "
        "WHERE assignment IS NOT NULL ORDER BY assignment"
    )
    with _get_pool().connection() as conn:
        rows = conn.execute(sql).fetchall()
    return [r["assignment"] for r in rows]


def get_meter_names() -> set[str]:
    sql = (
        "SELECT DISTINCT meter_name FROM analysis.grid_assignments_view "
        "WHERE meter_name IS NOT NULL"
    )
    with _get_pool().connection() as conn:
        rows = conn.execute(sql).fetchall()
    return {r["meter_name"] for r in rows}


def get_assignments_for_scenario(scenario: str) -> list[dict]:
    """One record per meter_name for the given assignment scenario.

    DISTINCT ON (meter_name) collapses the multiple rows the view can emit per
    meter when grid_avg_kw holds several load scenarios — matching csv_store's
    "first row per meter" dedup.
    """
    sql = """
        SELECT DISTINCT ON (meter_name)
               meter_name, substation_meter, assignment, notes, circuit,
               x, y, misc, avg_kw_10_to_2, node, node_x, node_y
        FROM analysis.grid_assignments_view
        WHERE assignment = %s
        ORDER BY meter_name
    """
    with _get_pool().connection() as conn:
        rows = conn.execute(sql, (scenario,)).fetchall()
    return [
        {
            "meter_name": r["meter_name"],
            "substation_meter": r["substation_meter"],
            "scenario": scenario,
            "notes": r["notes"],
            "circuit": r["circuit"],
            "x_geo": r["x"],
            "y_geo": r["y"],
            "misc": r["misc"],
            "avg_kw_10_to_2": r["avg_kw_10_to_2"],
            "node": r["node"],
            "node_x": r["node_x"],
            "node_y": r["node_y"],
            "assignment": r["assignment"],
        }
        for r in rows
    ]


def get_kw_data(
    load_scenario: str | None = None, pv_scenario: str | None = None
) -> list[dict]:
    """Demand + pv time series, optionally filtered by scenario.

    The view is a UNION of demand-only and pv-only rows, so each row carries
    exactly one of demand_kw / pv_production_kw (the other is NULL); the
    frontend sums them per (substation, datetime). The ::text casts let the
    NULL-or-equals filter type-check when a parameter is NULL.
    """
    sql = """
        SELECT load_scenario, pv_scenario, meter_name,
               to_char(datetime, 'YYYY-MM-DD HH24:MI:SS') AS datetime_str,
               demand_kw, pv_production_kw
        FROM analysis.grid_kw_low_load_high_pv
        WHERE (%(load)s::text IS NULL OR load_scenario = %(load)s::text)
          AND (%(pv)s::text   IS NULL OR pv_scenario   = %(pv)s::text)
        ORDER BY meter_name, datetime
    """
    with _get_pool().connection() as conn:
        rows = conn.execute(sql, {"load": load_scenario, "pv": pv_scenario}).fetchall()
    return [
        {
            "id": i + 1,
            "meter_name": r["meter_name"],
            "datetime_str": r["datetime_str"],
            "load_scenario": r["load_scenario"],
            "pv_scenario": r["pv_scenario"],
            "demand_kw": r["demand_kw"],
            "pv_production_kw": r["pv_production_kw"],
        }
        for i, r in enumerate(rows)
    ]


def upsert_assignment(
    meter_name: str, scenario: str, substation_meter: str
) -> dict | None:
    """Overwrite substation_meter on the base grid_assignments table.

    Returns the updated row, or None if no meter/scenario row matched (the
    router turns None into a 404).
    """
    sql = """
        UPDATE analysis.grid_assignments
        SET substation_meter = %s
        WHERE meter_name = %s AND assignment = %s
        RETURNING meter_name, assignment AS scenario, substation_meter, notes
    """
    with _get_pool().connection() as conn:
        row = conn.execute(sql, (substation_meter, meter_name, scenario)).fetchone()
        conn.commit()
    return row
