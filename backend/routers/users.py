"""Host-only user management: list users with their personal assignments,
mark them active/inactive, and delete.

Inactive users can still sign in and view, but can't change anything. Hosts
can't change or delete themselves or anyone in HOST_EMAILS, so there is always
a way in. Deleting a user also deletes their personal assignments (ON DELETE
CASCADE); they can sign in again as a new, active user, so marking someone
inactive is the way to keep them view-only.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import _connect, _host_emails, require_active, require_host
from .my_assignments import PREFIX

router = APIRouter(dependencies=[Depends(require_host)])


@router.get("/users")
def list_users():
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.email, u.name, u.role, u.inactive, u.created_at, u.last_login,
                   coalesce(json_agg(json_build_object('id', a.id, 'name', a.name, 'base', a.base_assignment)
                                     ORDER BY a.name) FILTER (WHERE a.id IS NOT NULL), '[]')
            FROM users u LEFT JOIN assignments a ON a.user_id = u.id
            GROUP BY u.id
            ORDER BY u.created_at
            """
        ).fetchall()
    hosts = _host_emails()
    return [
        {
            "id": id_,
            "email": email,
            "name": name,
            "role": "host" if email in hosts else role,
            "protected": email in hosts,
            "inactive": inactive,
            "created_at": created,
            "last_login": last,
            "assignments": [
                {"key": f"{PREFIX}{a['id']}", "name": a["name"], "base": a["base"]} for a in assignments
            ],
        }
        for id_, email, name, role, inactive, created, last, assignments in rows
    ]


def _check_target(user_id: int, me: dict) -> None:
    require_active(me)
    with _connect() as conn:
        row = conn.execute("SELECT email FROM users WHERE id = %s", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == me["id"]:
        raise HTTPException(status_code=400, detail="You can't change or delete your own account")
    if row[0] in _host_emails():
        raise HTTPException(status_code=400, detail="This user is in HOST_EMAILS; remove them there first")


class UserUpdate(BaseModel):
    inactive: bool


@router.patch("/users/{user_id}")
def update_user(user_id: int, body: UserUpdate, me: dict = Depends(require_host)):
    _check_target(user_id, me)
    with _connect() as conn:
        conn.execute("UPDATE users SET inactive = %s WHERE id = %s", (body.inactive, user_id))
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, me: dict = Depends(require_host)):
    _check_target(user_id, me)
    with _connect() as conn:
        conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
    return {"ok": True}
