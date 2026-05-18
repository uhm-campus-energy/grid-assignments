from fastapi import APIRouter
from typing import Optional
from ..csv_store import get_kw_data

router = APIRouter()


@router.get("/kw-data")
def get_kw_data_endpoint(
    load_scenario: Optional[str] = None,
    pv_scenario: Optional[str] = None,
):
    rows = get_kw_data()
    if load_scenario:
        rows = [r for r in rows if r.get("load_scenario") == load_scenario]
    if pv_scenario:
        rows = [r for r in rows if r.get("pv_scenario") == pv_scenario]

    result = []
    for i, r in enumerate(rows):
        result.append({
            "id": int(r["id"]) if r.get("id") else i + 1,
            "datetime_str": r.get("datetime_str"),
            "load_scenario": r.get("load_scenario"),
            "meter_name": r.get("meter_name"),
            "pv_scenario": r.get("pv_scenario"),
            "demand_kw": _float(r.get("demand_kw")),
            "pv_production_kw": _float(r.get("pv_production_kw")),
        })
    return sorted(result, key=lambda r: (r["meter_name"] or "", r["datetime_str"] or ""))


def _float(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
