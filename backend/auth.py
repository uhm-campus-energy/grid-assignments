"""Shared-credential login that protects the data API.

One username/password (env-configured) is exchanged at POST /api/login for a
signed JWT. `require_auth` is attached to the data routers so every data
endpoint needs a valid token. /api/health and /api/login stay public.

Env (set real values on Vercel; the defaults are for local dev only):
  APP_USERNAME   default "admin"
  APP_PASSWORD   default "admin"
  AUTH_SECRET    HMAC signing secret — MUST be overridden in production
"""
import hmac
import os
import time

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

APP_USERNAME = os.getenv("APP_USERNAME", "admin")
APP_PASSWORD = os.getenv("APP_PASSWORD", "admin")
AUTH_SECRET = os.getenv("AUTH_SECRET", "dev-insecure-secret-change-me")
_ALGORITHM = "HS256"
_TTL_SECONDS = 12 * 60 * 60

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str


def _make_token(username: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {"sub": username, "iat": now, "exp": now + _TTL_SECONDS},
        AUTH_SECRET,
        algorithm=_ALGORITHM,
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    valid = hmac.compare_digest(body.username, APP_USERNAME) and hmac.compare_digest(
        body.password, APP_PASSWORD
    )
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return LoginResponse(token=_make_token(body.username))


def require_auth(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    """Dependency: require a valid Bearer token. Returns the username (sub)."""
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, AUTH_SECRET, algorithms=[_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return str(payload.get("sub", ""))
