"""Local-file CSV backend (DATA_BACKEND=csv, the default).

Reads/writes a CSV on disk. The path defaults to data/grid_assignments.csv but
can be overridden with GRID_CSV_PATH — point tests at a throwaway copy so they
never mutate the real data file. Row-processing lives in _csv_logic so the
Blob-backed store (blob_store) shares identical behavior.
"""
import os
import threading
from pathlib import Path

from . import _csv_logic as L

_DEFAULT_PATH = Path(__file__).parent.parent / "data" / "grid_assignments.csv"
CSV_PATH = Path(os.getenv("GRID_CSV_PATH", str(_DEFAULT_PATH)))

_lock = threading.Lock()
_cache: tuple[list[str], list[list[str]]] | None = None
_cache_mtime: float = 0.0


def _read_all() -> tuple[list[str], list[list[str]]]:
    global _cache, _cache_mtime
    if not CSV_PATH.exists():
        return [], []
    mtime = CSV_PATH.stat().st_mtime
    if _cache is not None and mtime == _cache_mtime:
        return _cache
    with open(CSV_PATH, encoding="utf-8", newline="") as f:
        text = f.read()
    _cache = L.parse_csv(text)
    _cache_mtime = mtime
    return _cache


def _write_all(header: list[str], data_rows: list[list[str]]) -> None:
    global _cache, _cache_mtime
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(L.serialize_csv(header, data_rows))
    _cache = None
    _cache_mtime = 0.0


def get_scenarios() -> list[str]:
    _, rows = _read_all()
    return L.get_scenarios(rows)


def get_meter_names() -> set[str]:
    _, rows = _read_all()
    return L.get_meter_names(rows)


def get_assignments_for_scenario(scenario: str) -> list[dict]:
    _, rows = _read_all()
    return L.get_assignments_for_scenario(rows, scenario)


def get_kw_data(load_scenario: str | None = None, pv_scenario: str | None = None) -> list[dict]:
    _, rows = _read_all()
    return L.get_kw_data(rows, load_scenario, pv_scenario)


def upsert_assignment(meter_name: str, scenario: str, substation_meter: str) -> dict | None:
    with _lock:
        header, rows = _read_all()
        result = L.apply_upsert(rows, meter_name, scenario, substation_meter)
        _write_all(header, rows)
    return result
