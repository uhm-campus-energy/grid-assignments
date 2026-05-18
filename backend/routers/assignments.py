from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..csv_store import get_assignments, get_meters, upsert_assignment

router = APIRouter()


class AssignmentUpdate(BaseModel):
    scenario: str
    substation_meter: str


@router.get("/scenarios")
def get_scenarios():
    rows = get_assignments()
    seen = set()
    result = []
    for row in rows:
        s = row.get("scenario", "")
        if s and s not in seen:
            seen.add(s)
            result.append(s)
    return sorted(result)


@router.get("/grid-assignments")
def get_grid_assignments(scenario: str = "2026_04_23"):
    meters = {m["meter_name"]: m for m in get_meters()}
    assignments = [a for a in get_assignments() if a.get("scenario") == scenario]

    result = []
    for a in assignments:
        m = meters.get(a["meter_name"])
        if m is None:
            continue
        result.append({
            "meter_name": m["meter_name"],
            "node": m.get("node"),
            "node_x": _float(m.get("node_x")),
            "node_y": _float(m.get("node_y")),
            "x_geo": _float(m.get("x_geo")),
            "y_geo": _float(m.get("y_geo")),
            "circuit": m.get("circuit"),
            "misc": m.get("misc") or None,
            "avg_kw_10_to_2": _float(m.get("avg_kw_10_to_2")),
            "substation_meter": a.get("substation_meter") or None,
            "scenario": a["scenario"],
            "notes": a.get("notes") or None,
            "assignment": a.get("assignment") or None,
        })
    return sorted(result, key=lambda r: r["meter_name"])


@router.put("/assignments/{meter_name}")
def update_assignment(meter_name: str, body: AssignmentUpdate):
    meters = {m["meter_name"]: m for m in get_meters()}
    if meter_name not in meters:
        raise HTTPException(status_code=404, detail="Meter not found")
    updated = upsert_assignment(meter_name, body.scenario, body.substation_meter)
    return {
        "meter_name": updated["meter_name"],
        "scenario": updated["scenario"],
        "substation_meter": updated["substation_meter"],
        "updated_at": updated.get("updated_at"),
    }


def _float(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
