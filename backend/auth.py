"""Login: Sign in with Google (hawaii.edu accounts), users kept in a hosted Postgres.

Flow:
  1. The frontend shows Google's button; Google hands it an ID token.
  2. POST /api/auth/google verifies that token with Google, records the user
     in the `users` table, and sets a signed session cookie.
  3. Every other /api route depends on current_user, which checks the cookie
     and re-reads the user row so a block takes effect immediately.

The users table lives in the Postgres added from Vercel's Storage tab (Neon),
read from POSTGRES_URL. This is NOT the uhm2023 database (DATABASE_URL), which
Vercel cannot reach.

Roles: "host" can save assignments, "user" can only view. Emails in HOST_EMAILS
are always hosts, so there is always a way in. Anyone else is promoted or
blocked by editing their row (Neon console -> Tables -> users).

Local dev / CI: set DEV_LOGIN_EMAIL to skip Google and act as that host. With
POSTGRES_URL also set it uses that database (needed for personal assignments);
without it, no database at all. It is ignored on Vercel.
"""
import hashlib
import hmac
import os
import time

import psycopg
import requests
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

ALLOWED_DOMAIN = "hawaii.edu"
COOKIE = "session"
SESSION_SECONDS = 14 * 24 * 3600

router = APIRouter(prefix="/auth")


def _dev_email() -> str | None:
    return None if os.getenv("VERCEL") else os.getenv("DEV_LOGIN_EMAIL")


def _host_emails() -> set[str]:
    return {e.strip().lower() for e in os.getenv("HOST_EMAILS", "").split(",") if e.strip()}


def _secret() -> bytes:
    secret = os.getenv("AUTH_SECRET")
    if not secret:
        raise RuntimeError("AUTH_SECRET is not set (see .env.example).")
    return secret.encode()


# --- session cookie: "<email>|<expiry>.<hmac>" -------------------------------

def sign(email: str, now: float | None = None) -> str:
    payload = f"{email}|{int((now or time.time()) + SESSION_SECONDS)}"
    sig = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def verify(token: str, now: float | None = None) -> str | None:
    """Return the email in a valid, unexpired token, else None."""
    payload, _, sig = token.rpartition(".")
    expected = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    email, _, exp = payload.rpartition("|")
    if not exp.isdigit() or int(exp) < (now or time.time()):
        return None
    return email


# --- users table --------------------------------------------------------------

def _connect():
    # ponytail: one connection per request; fine through Neon's pooled URL at
    # this traffic. Use a pool if requests start queueing.
    dsn = os.getenv("POSTGRES_URL")
    if not dsn:
        raise RuntimeError("POSTGRES_URL is not set. Connect a Neon database in Vercel's Storage tab.")
    return psycopg.connect(dsn)


# Three linked tables: a user owns personal assignments, and each assignment
# holds one bus choice per meter. Deleting a user or an assignment deletes
# what hangs off it (ON DELETE CASCADE).
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      text NOT NULL UNIQUE,
    name       text,
    role       text NOT NULL DEFAULT 'user' CHECK (role IN ('host', 'user')),
    blocked    boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login timestamptz
);
CREATE TABLE IF NOT EXISTS assignments (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            text NOT NULL,
    base_assignment text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);
CREATE TABLE IF NOT EXISTS assignment_meters (
    assignment_id    bigint NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    meter_name       text NOT NULL,
    substation_meter text,
    PRIMARY KEY (assignment_id, meter_name)
);
"""


def _record_login(email: str, name: str | None) -> None:
    with _connect() as conn:
        conn.execute(SCHEMA)
        conn.execute(
            """
            INSERT INTO users (email, name, last_login) VALUES (%s, %s, now())
            ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, last_login = now()
            """,
            (email, name),
        )


def _load_user(email: str) -> dict | None:
    """The signed-in user with their effective role, or None if unknown/blocked."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, name, role, blocked FROM users WHERE email = %s", (email,)
        ).fetchone()
    if row is None or row[3]:
        return None
    role = "host" if email in _host_emails() else row[2]
    return {"id": row[0], "email": email, "name": row[1], "role": role}


# --- dependencies used by the other routers ----------------------------------

def current_user(request: Request) -> dict:
    if dev := _dev_email():
        if not os.getenv("POSTGRES_URL"):
            return {"id": None, "email": dev, "name": "Dev", "role": "host"}
        _record_login(dev, "Dev")  # dev only: a real row, so personal assignments work
        return {**_load_user(dev), "role": "host"}
    token = request.cookies.get(COOKIE)
    email = verify(token) if token else None
    user = _load_user(email) if email else None
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in required")
    return user


def require_host(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "host":
        raise HTTPException(status_code=403, detail="Only hosts can change assignments")
    return user


# --- endpoints ----------------------------------------------------------------

class GoogleLogin(BaseModel):
    credential: str


@router.get("/me")
def me(request: Request):
    """The signed-in user, or user=null plus what the frontend needs to sign in."""
    try:
        user = current_user(request)
    except HTTPException:
        user = None
    return {"user": user, "google_client_id": os.getenv("GOOGLE_CLIENT_ID")}


@router.post("/google")
def google_login(body: GoogleLogin, response: Response):
    # ponytail: Google's tokeninfo endpoint does the signature check for us (one
    # HTTP call per sign-in). Switch to google-auth's local verify if sign-ins
    # ever get frequent.
    r = requests.get(
        "https://oauth2.googleapis.com/tokeninfo",
        params={"id_token": body.credential},
        timeout=10,
    )
    info = r.json() if r.ok else {}
    if info.get("aud") != os.getenv("GOOGLE_CLIENT_ID") or info.get("email_verified") != "true":
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified")
    if info.get("hd") != ALLOWED_DOMAIN:
        raise HTTPException(status_code=403, detail=f"Use your @{ALLOWED_DOMAIN} account")

    email = info["email"].lower()
    _record_login(email, info.get("name"))
    if _load_user(email) is None:
        raise HTTPException(status_code=403, detail="Your account has been blocked")

    response.set_cookie(
        COOKIE,
        sign(email),
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=bool(os.getenv("VERCEL")),
        samesite="lax",
    )
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}


if __name__ == "__main__":
    # Self-check of the cookie signing: python -m backend.auth
    os.environ.setdefault("AUTH_SECRET", "test-secret")
    t = sign("a.b@hawaii.edu", now=1000)
    assert verify(t, now=1000) == "a.b@hawaii.edu"
    assert verify(t, now=1000 + SESSION_SECONDS + 1) is None, "expired"
    assert verify(t.replace("a.b@", "x.y@"), now=1000) is None, "tampered email"
    assert verify(t[:-1] + ("0" if t[-1] != "0" else "1"), now=1000) is None, "tampered sig"
    assert verify("", now=1000) is None and verify("garbage", now=1000) is None
    os.environ["AUTH_SECRET"] = "other"
    assert verify(t, now=1000) is None, "different secret"
    print("auth self-check ok")
