from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ..auth import current_user, require_active, require_admin
from ..store import delete_assignment, get_scenarios, get_assignments_for_scenario, upsert_assignment
from . import my_assignments as mine

router = APIRouter()


class AssignmentUpdate(BaseModel):
    scenario: str
    substation_meter: str
    meter_names: list[str] = Field(min_length=1)


@router.get("/scenarios")
def list_scenarios(user: dict = Depends(current_user)):
    """Dropdown entries: base assignments for everyone, then personal ones."""
    base = [
        {"key": s, "label": s, "group": "Base", "editable": user["role"] == "admin" and not user["inactive"]}
        for s in get_scenarios()
    ]
    return base + mine.list_for(user)


@router.get("/grid-assignments")
def get_grid_assignments(scenario: str = "2026_04_23", user: dict = Depends(current_user)):
    if mine.is_personal(scenario):
        records = mine.records(scenario, user)
    else:
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


@router.put("/assignments")
def update_assignments(body: AssignmentUpdate, user: dict = Depends(current_user)):
    """Move one or more meters to the same bus in one assignment, all or nothing."""
    require_active(user)
    if mine.is_personal(body.scenario):
        updated = mine.save(body.scenario, user, body.meter_names, body.substation_meter)
    else:
        require_admin(user)
        updated = upsert_assignment(body.meter_names, body.scenario, body.substation_meter)
    if updated is None:
        raise HTTPException(status_code=404, detail="Meter/scenario combination not found")
    return [
        {"meter_name": u["meter_name"], "scenario": u["scenario"], "substation_meter": u["substation_meter"]}
        for u in updated
    ]


@router.delete("/assignments/{scenario}")
def delete_base_assignment(scenario: str, user: dict = Depends(current_user)):
    """Admins delete a base assignment for everyone. Personal copies made from
    it are kept (see my_assignments.records)."""
    require_active(user)
    require_admin(user)
    scenarios = get_scenarios()
    if scenario not in scenarios:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if len(scenarios) == 1:
        raise HTTPException(status_code=400, detail="Can't delete the last base assignment")
    delete_assignment(scenario)
    return {"ok": True}


def _float(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
