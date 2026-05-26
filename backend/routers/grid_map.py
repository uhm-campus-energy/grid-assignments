from fastapi import APIRouter

from .. import store

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "db": store.BACKEND}
