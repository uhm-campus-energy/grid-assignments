from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..store import get_scenarios, get_assignments_for_scenario, upsert_assignment

router = APIRouter()


class AssignmentUpdate(BaseModel):
    scenario: str
    substation_meter: str


@router.get("/scenarios")
def list_scenarios():
    return get_scenarios()


@router.get("/grid-assignments")
def get_grid_assignments(scenario: str = "2026_04_23"):
    records = get_assignments_for_scenario(scenario)
    result = []
    for r in records:
        result.append({
            "meter_name": r["meter_name"],
            "node": r["node"],
            "node_x": _float(r.get("node_x")),
            "node_y": _float(r.get("node_y")),
            "x_geo": _float(r.get("x_geo")),
            "y_geo": _float(r.get("y_geo")),
            "circuit": r.get("circuit"),
            "misc": r.get("misc"),
            "avg_kw_10_to_2": _float(r.get("avg_kw_10_to_2")),
            "substation_meter": r.get("substation_meter"),
            "scenario": r["scenario"],
            "notes": r.get("notes"),
            "assignment": r.get("assignment"),
        })
    return sorted(result, key=lambda r: r["meter_name"])


@router.put("/assignments/{meter_name}")
def update_assignment(meter_name: str, body: AssignmentUpdate):
    updated = upsert_assignment(meter_name, body.scenario, body.substation_meter)
    if updated is None:
        raise HTTPException(status_code=404, detail="Meter/scenario combination not found")
    return {
        "meter_name": updated["meter_name"],
        "scenario": updated["scenario"],
        "substation_meter": updated["substation_meter"],
    }


def _float(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
