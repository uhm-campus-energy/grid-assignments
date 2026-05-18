from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import assignments, grid_map, kw_data

app = FastAPI(title="Grid Assignments API (CSV)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "PUT", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(grid_map.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(kw_data.router, prefix="/api")
