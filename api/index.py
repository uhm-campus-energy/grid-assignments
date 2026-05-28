"""Vercel Python entry point.

Vercel's Python runtime serves the module-level ASGI `app`. All routes are
defined under /api in backend.main, and vercel.json rewrites /api/* here, so
the FastAPI app sees the original path and matches as usual.
"""
import os
import sys

# Ensure the repo root (parent of /api) is importable so `backend` resolves.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app  # noqa: E402

__all__ = ["app"]
