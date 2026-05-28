"""Data-access facade.

Re-exports the data functions from whichever backend DATA_BACKEND selects, so
the routers import from here and don't care whether the source is the local
CSV or the live Postgres database.

  DATA_BACKEND=csv  (default) -> backend/csv_store.py  (data/grid_assignments.csv)
  DATA_BACKEND=blob           -> backend/blob_store.py (same CSV in Vercel Blob)
  DATA_BACKEND=db             -> backend/db_store.py   (analysis.* views, DATABASE_URL)

Set these in a .env file (see .env.example); it is loaded here at import time.
"""
import os

from dotenv import load_dotenv

load_dotenv()

BACKEND = os.getenv("DATA_BACKEND", "csv").lower()

if BACKEND == "db":
    from .db_store import (  # noqa: F401
        get_assignments_for_scenario,
        get_kw_data,
        get_meter_names,
        get_scenarios,
        upsert_assignment,
    )
elif BACKEND == "blob":
    from .blob_store import (  # noqa: F401
        get_assignments_for_scenario,
        get_kw_data,
        get_meter_names,
        get_scenarios,
        upsert_assignment,
    )
else:
    from .csv_store import (  # noqa: F401
        get_assignments_for_scenario,
        get_kw_data,
        get_meter_names,
        get_scenarios,
        upsert_assignment,
    )

__all__ = [
    "BACKEND",
    "get_assignments_for_scenario",
    "get_kw_data",
    "get_meter_names",
    "get_scenarios",
    "upsert_assignment",
]
