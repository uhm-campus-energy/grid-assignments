import csv
import threading
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
CSV_FILE = "grid_assignments.csv"

_lock = threading.Lock()
_cache: tuple[list[str], list[list[str]]] | None = None
_cache_mtime: float = 0.0

# 0-based column indices for grid_assignments.csv
# (duplicate column names are handled by using indices directly)
_C = {
    "meter_name":       0,
    "substation_meter": 1,
    "assignment":       2,   # "scenario" in the API
    "notes":            3,
    "circuit":          4,
    "x":                5,   # x_geo
    "y":                6,   # y_geo
    "misc":             7,
    "load_scenario":    8,
    "avg_kw_10_to_2":   9,
    "node":             10,
    "node_x":           11,
    "node_y":           12,
    # col 13: load_scenario duplicate
    "pv_scenario":      14,
    # col 15: meter_name duplicate
    "datetime":         16,
    "demand_kw":        17,
    "pv_production_kw": 18,
}
_MIN_COLS = 19


def _read_all() -> tuple[list[str], list[list[str]]]:
    global _cache, _cache_mtime
    path = DATA_DIR / CSV_FILE
    if not path.exists():
        return [], []
    mtime = path.stat().st_mtime
    if _cache is not None and mtime == _cache_mtime:
        return _cache
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    if not rows:
        _cache = ([], [])
        _cache_mtime = mtime
        return [], []
    _cache = (rows[0], rows[1:])
    _cache_mtime = mtime
    return _cache


def _write_all(header: list[str], data_rows: list[list[str]]) -> None:
    global _cache, _cache_mtime
    path = DATA_DIR / CSV_FILE
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(data_rows)
    _cache = None
    _cache_mtime = 0.0


def _get(row: list[str], key: str) -> str:
    idx = _C[key]
    return row[idx] if len(row) > idx else ""


def get_scenarios() -> list[str]:
    _, rows = _read_all()
    seen: set[str] = set()
    result: list[str] = []
    for row in rows:
        s = _get(row, "assignment")
        if s and s not in seen:
            seen.add(s)
            result.append(s)
    return sorted(result)


def get_meter_names() -> set[str]:
    _, rows = _read_all()
    return {_get(row, "meter_name") for row in rows if len(row) >= _MIN_COLS}


def get_assignments_for_scenario(scenario: str) -> list[dict]:
    """Return one record per unique meter_name for the given scenario."""
    _, rows = _read_all()
    seen: dict[str, dict] = {}
    for row in rows:
        if len(row) < _MIN_COLS:
            continue
        if _get(row, "assignment") != scenario:
            continue
        mname = _get(row, "meter_name")
        if mname not in seen:
            seen[mname] = {
                "meter_name": mname,
                "substation_meter": _get(row, "substation_meter") or None,
                "scenario": scenario,
                "notes": _get(row, "notes") or None,
                "circuit": _get(row, "circuit") or None,
                "x_geo": _get(row, "x") or None,
                "y_geo": _get(row, "y") or None,
                "misc": _get(row, "misc") or None,
                "avg_kw_10_to_2": _get(row, "avg_kw_10_to_2") or None,
                "node": _get(row, "node") or None,
                "node_x": _get(row, "node_x") or None,
                "node_y": _get(row, "node_y") or None,
                "assignment": scenario,
            }
    return list(seen.values())


def get_kw_data(load_scenario: str | None = None, pv_scenario: str | None = None) -> list[dict]:
    _, rows = _read_all()
    seen: set[tuple] = set()
    result: list[dict] = []
    for i, row in enumerate(rows):
        if len(row) < _MIN_COLS:
            continue
        ls = _get(row, "load_scenario")
        ps = _get(row, "pv_scenario")
        if load_scenario and ls != load_scenario:
            continue
        if pv_scenario and ps != pv_scenario:
            continue
        mname = _get(row, "meter_name")
        dt = _get(row, "datetime")
        key = (mname, dt, ls, ps)
        if key in seen:
            continue
        seen.add(key)
        result.append({
            "id": i + 1,
            "meter_name": mname,
            "datetime_str": dt,
            "load_scenario": ls,
            "pv_scenario": ps,
            "demand_kw": _get(row, "demand_kw"),
            "pv_production_kw": _get(row, "pv_production_kw"),
        })
    return result


def upsert_assignment(meter_name: str, scenario: str, substation_meter: str) -> dict | None:
    with _lock:
        header, rows = _read_all()
        result = None
        for row in rows:
            if len(row) < _MIN_COLS:
                continue
            if _get(row, "meter_name") == meter_name and _get(row, "assignment") == scenario:
                row[_C["substation_meter"]] = substation_meter
                if result is None:
                    result = {
                        "meter_name": meter_name,
                        "scenario": scenario,
                        "substation_meter": substation_meter,
                        "notes": _get(row, "notes"),
                    }
        _write_all(header, rows)
    return result
