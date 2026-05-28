import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import auth
from .auth import require_auth
from .routers import assignments, grid_map, kw_data

app = FastAPI(title="Grid Assignments API")

# Same-origin on Vercel (frontend + API share a domain) so CORS isn't needed
# there. These origins cover local dev (Vite at :5173) plus any extra origins
# from CORS_ORIGINS (comma-separated).
_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
_origins += [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Compress large JSON responses (the unfiltered /api/kw-data payload is ~2 MB).
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Public: health check and login.
app.include_router(grid_map.router, prefix="/api")
app.include_router(auth.router, prefix="/api")

# Protected: data routes require a valid login token.
app.include_router(assignments.router, prefix="/api", dependencies=[Depends(require_auth)])
app.include_router(kw_data.router, prefix="/api", dependencies=[Depends(require_auth)])
