"""Pure CSV row-processing logic shared by the file- and Blob-backed stores.

The wide ``grid_assignments.csv`` carries both per-meter assignment data
(columns 0-14) and a demand/PV time series (columns 16-18). These helpers work
on already-parsed ``rows`` so identical behavior is reused whether the bytes
came from local disk (``csv_store``) or Vercel Blob (``blob_store``).

Behavior here is a straight extraction of the original ``csv_store`` logic — the
column indices, dedup rules and ``_MIN_COLS`` guard are unchanged.
"""
import csv
import io

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
MIN_COLS = 19


def parse_csv(text: str) -> tuple[list[str], list[list[str]]]:
    """Parse CSV text into (header, data_rows). Uses newline="" so embedded
    newlines inside quoted fields survive, matching open(path, newline="")."""
    rows = list(csv.reader(io.StringIO(text, newline="")))
    if not rows:
        return [], []
    return rows[0], rows[1:]


def serialize_csv(header: list[str], rows: list[list[str]]) -> str:
    """Serialize (header, rows) back to CSV text (csv.writer default \\r\\n)."""
    buf = io.StringIO(newline="")
    writer = csv.writer(buf)
    if header:
        writer.writerow(header)
    writer.writerows(rows)
    return buf.getvalue()


def _get(row: list[str], key: str) -> str:
    idx = _C[key]
    return row[idx] if len(row) > idx else ""


def get_scenarios(rows: list[list[str]]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for row in rows:
        s = _get(row, "assignment")
        if s and s not in seen:
            seen.add(s)
            result.append(s)
    return sorted(result)


def get_meter_names(rows: list[list[str]]) -> set[str]:
    return {_get(row, "meter_name") for row in rows if len(row) >= MIN_COLS}


def get_assignments_for_scenario(rows: list[list[str]], scenario: str) -> list[dict]:
    """Return one record per unique meter_name for the given scenario."""
    seen: dict[str, dict] = {}
    for row in rows:
        if len(row) < MIN_COLS:
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


def get_kw_data(
    rows: list[list[str]],
    load_scenario: str | None = None,
    pv_scenario: str | None = None,
) -> list[dict]:
    seen: set[tuple] = set()
    result: list[dict] = []
    for i, row in enumerate(rows):
        if len(row) < MIN_COLS:
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


def apply_upsert(
    rows: list[list[str]],
    meter_name: str,
    scenario: str,
    substation_meter: str,
) -> dict | None:
    """Mutate ``rows`` in place, setting substation_meter on every row matching
    meter_name + scenario. Returns the updated record, or None if no match."""
    result = None
    for row in rows:
        if len(row) < MIN_COLS:
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
    return result
