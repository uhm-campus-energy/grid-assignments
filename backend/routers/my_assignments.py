"""Personal assignments: a user's own copy of a base assignment, kept in Neon.

Only substation_meter differs between assignments, so a copy stores just the
bus per meter (assignment_meters). Everything else (map position, circuit,
avg kW, time series) still comes from the base assignment in the data store.

The frontend refers to a personal assignment by the key "p:<id>"; base
assignment names never start with that. Owners can edit and delete their own;
hosts can view everyone's but not change them.
"""
from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import UniqueViolation
from pydantic import BaseModel, Field

from ..auth import _connect, current_user
from ..store import get_assignments_for_scenario, get_scenarios

PREFIX = "p:"

router = APIRouter()


def is_personal(key: str) -> bool:
    return key.startswith(PREFIX)


def _need_db(user: dict) -> None:
    if user["id"] is None:
        raise HTTPException(status_code=503, detail="Personal assignments need POSTGRES_URL")


def list_for(user: dict) -> list[dict]:
    """The personal assignments this user may see, as dropdown entries."""
    if user["id"] is None:
        return []
    host = user["role"] == "host"
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT a.id, a.name, a.user_id, u.email
            FROM assignments a JOIN users u ON u.id = a.user_id
            WHERE %s OR a.user_id = %s
            ORDER BY u.email, a.name
            """,
            (host, user["id"]),
        ).fetchall()
    return [
        {
            "key": f"{PREFIX}{id_}",
            "label": name if owner == user["id"] else f"{name} ({email})",
            "group": "Mine" if owner == user["id"] else "Others",
            "editable": owner == user["id"],
        }
        for id_, name, owner, email in rows
    ]


def _find(key: str, user: dict) -> tuple[int, int, str]:
    """(id, owner id, base assignment) of a personal assignment this user may see."""
    _need_db(user)
    try:
        id_ = int(key.removeprefix(PREFIX))
    except ValueError:
        raise HTTPException(status_code=404, detail="Assignment not found")
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, user_id, base_assignment FROM assignments WHERE id = %s", (id_,)
        ).fetchone()
    if row is None or (row[1] != user["id"] and user["role"] != "host"):
        raise HTTPException(status_code=404, detail="Assignment not found")
    return row


def records(key: str, user: dict) -> list[dict]:
    """The base assignment's meter records with this assignment's buses laid over them."""
    id_, _, base = _find(key, user)
    with _connect() as conn:
        buses = dict(conn.execute(
            "SELECT meter_name, substation_meter FROM assignment_meters WHERE assignment_id = %s",
            (id_,),
        ).fetchall())
    return [
        {**r, "substation_meter": buses.get(r["meter_name"]), "scenario": key, "assignment": key}
        for r in get_assignments_for_scenario(base)
        if r["meter_name"] in buses
    ]


def save(key: str, user: dict, meter_name: str, substation_meter: str) -> dict | None:
    id_, owner, _ = _find(key, user)
    if owner != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can change this assignment")
    with _connect() as conn:
        row = conn.execute(
            """
            UPDATE assignment_meters SET substation_meter = %s
            WHERE assignment_id = %s AND meter_name = %s
            RETURNING meter_name, substation_meter
            """,
            (substation_meter, id_, meter_name),
        ).fetchone()
    return row and {"meter_name": row[0], "scenario": key, "substation_meter": row[1]}


class NewAssignment(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    base: str


@router.post("/my-assignments")
def create(body: NewAssignment, user: dict = Depends(current_user)):
    _need_db(user)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give the assignment a name")
    if body.base not in get_scenarios():
        raise HTTPException(status_code=400, detail="Copy must be based on a base assignment")
    meters = [(r["meter_name"], r["substation_meter"]) for r in get_assignments_for_scenario(body.base)]
    try:
        with _connect() as conn:
            (id_,) = conn.execute(
                "INSERT INTO assignments (user_id, name, base_assignment) VALUES (%s, %s, %s) RETURNING id",
                (user["id"], name, body.base),
            ).fetchone()
            conn.cursor().executemany(
                "INSERT INTO assignment_meters (assignment_id, meter_name, substation_meter) VALUES (%s, %s, %s)",
                [(id_, m, b) for m, b in meters],
            )
    except UniqueViolation:
        raise HTTPException(status_code=409, detail=f'You already have an assignment named "{name}"')
    return {"key": f"{PREFIX}{id_}"}


@router.delete("/my-assignments/{key}")
def delete(key: str, user: dict = Depends(current_user)):
    id_, owner, _ = _find(key, user)
    if owner != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can delete this assignment")
    with _connect() as conn:
        conn.execute("DELETE FROM assignments WHERE id = %s", (id_,))
    return {"ok": True}
