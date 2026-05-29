"""Vercel Blob CSV backend (DATA_BACKEND=blob), public store.

Stores grid_assignments.csv in a public Vercel Blob store so reads and writes
are durable and shared across serverless instances. The login still gates the
app and API — only the raw (unguessable) blob URL is public. Row-processing is
shared with the local-file store via _csv_logic, so behavior matches
DATA_BACKEND=csv.

Consistency: overwriting a blob in place reads back stale (CDN + storage
replication lag), so each write instead creates a NEW immutable blob (random
suffix → brand-new URL that is never stale). A tiny "pointer" blob at a fixed
path stores the current CSV URL as plain text; reads fetch the pointer (plain
HTTP GET = 0 Advanced Ops) to find the latest URL, then use the existing
URL-based in-memory cache to avoid re-downloading unchanged CSVs. Older CSV
versions are deleted after each write (best-effort). Concurrent cross-instance
writes are last-write-wins (by upload time).

Env:
  BLOB_READ_WRITE_TOKEN  required (from the Vercel Blob store)
  BLOB_CSV_PATHNAME      base blob path, default "grid_assignments.csv"
  BLOB_CSV_URL           optional fallback URL if listing returns nothing
  BLOB_PTR_URL           public URL of the pointer blob; set after first write
                         to eliminate list calls from the read path entirely
"""
import os
import threading

import requests

from . import _csv_logic as L

_API_BASE = "https://blob.vercel-storage.com"
_API_VERSION = "10"

PATHNAME = os.getenv("BLOB_CSV_PATHNAME", "grid_assignments.csv")
_PREFIX = PATHNAME.rsplit(".", 1)[0]  # match "grid_assignments(-suffix).csv"
_PTR_PATHNAME = f"{_PREFIX}_ptr.txt"
_FALLBACK_URL = os.getenv("BLOB_CSV_URL") or None

_lock = threading.Lock()
_cache: tuple[list[str], list[list[str]]] | None = None
_cache_url: str | None = None


def _token() -> str:
    tok = os.getenv("BLOB_READ_WRITE_TOKEN")
    if not tok:
        raise RuntimeError("BLOB_READ_WRITE_TOKEN is not set (Vercel Blob).")
    return tok


def _list_blobs() -> list[dict]:
    """All blobs under the CSV prefix, newest first (by uploadedAt)."""
    headers = {"authorization": f"Bearer {_token()}", "x-api-version": _API_VERSION}
    resp = requests.get(
        _API_BASE, headers=headers, params={"prefix": _PREFIX, "limit": "1000"}, timeout=60
    )
    resp.raise_for_status()
    blobs = resp.json().get("blobs", [])
    blobs.sort(key=lambda b: b.get("uploadedAt", ""), reverse=True)
    return blobs


def _put_ptr(csv_url: str) -> str:
    """Write the current CSV URL into a fixed pointer blob (no Advanced Op on reads).
    Returns the pointer blob's public URL."""
    headers = {
        "authorization": f"Bearer {_token()}",
        "x-api-version": _API_VERSION,
        "access": "public",
        "x-content-type": "text/plain",
        "x-cache-control-max-age": "0",
    }
    resp = requests.put(
        f"{_API_BASE}/?pathname={_PTR_PATHNAME}",
        headers=headers,
        data=csv_url.encode(),
        timeout=60,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Blob ptr put failed ({resp.status_code}): {resp.text}")
    return resp.json().get("url", "")


def _latest_url() -> str | None:
    ptr_url = os.getenv("BLOB_PTR_URL")
    if ptr_url:
        try:
            resp = requests.get(ptr_url, timeout=30)
            if resp.status_code == 200:
                return resp.text.strip() or None
        except requests.RequestException:
            pass  # fall through to list-based lookup
    blobs = _list_blobs()
    return blobs[0]["url"] if blobs else _FALLBACK_URL


def put_csv(data: bytes) -> dict:
    """Upload the CSV as a NEW immutable public blob (random suffix). Returns the
    blob metadata (including 'url')."""
    headers = {
        "authorization": f"Bearer {_token()}",
        "x-api-version": _API_VERSION,
        "access": "public",
        "x-content-type": "text/csv",
        "x-add-random-suffix": "1",
    }
    resp = requests.put(f"{_API_BASE}/?pathname={PATHNAME}", headers=headers, data=data, timeout=120)
    if resp.status_code != 200:
        raise RuntimeError(f"Blob put failed ({resp.status_code}): {resp.text}")
    return resp.json()


def _delete(urls: list[str]) -> None:
    """Best-effort delete of old blob versions."""
    if not urls:
        return
    headers = {
        "authorization": f"Bearer {_token()}",
        "x-api-version": _API_VERSION,
        "content-type": "application/json",
    }
    try:
        requests.post(f"{_API_BASE}/delete", headers=headers, json={"urls": urls}, timeout=60)
    except requests.RequestException:
        pass  # cleanup is non-critical


def _read_all() -> tuple[list[str], list[list[str]]]:
    """Return (header, rows) from the newest blob version, downloading only when
    the current version's URL differs from what we cached."""
    global _cache, _cache_url
    url = _latest_url()
    if not url:
        return [], []
    if _cache is not None and url == _cache_url:
        return _cache
    resp = requests.get(url, timeout=120)  # unique URL -> immutable, never stale
    resp.raise_for_status()
    _cache = L.parse_csv(resp.content.decode("utf-8"))
    _cache_url = url
    return _cache


def get_scenarios() -> list[str]:
    _, rows = _read_all()
    return L.get_scenarios(rows)


def get_meter_names() -> set[str]:
    _, rows = _read_all()
    return L.get_meter_names(rows)


def get_assignments_for_scenario(scenario: str) -> list[dict]:
    _, rows = _read_all()
    return L.get_assignments_for_scenario(rows, scenario)


def get_kw_data(load_scenario: str | None = None, pv_scenario: str | None = None) -> list[dict]:
    _, rows = _read_all()
    return L.get_kw_data(rows, load_scenario, pv_scenario)


def upsert_assignment(meter_name: str, scenario: str, substation_meter: str) -> dict | None:
    global _cache, _cache_url
    with _lock:
        # Read the freshest version, apply, then write a new immutable version.
        _cache = None
        _cache_url = None
        header, rows = _read_all()
        result = L.apply_upsert(rows, meter_name, scenario, substation_meter)
        if result is not None:
            data = L.serialize_csv(header, rows).encode("utf-8")
            new_url = put_csv(data).get("url")
            # Update pointer so reads find the new URL without listing.
            ptr_url = _put_ptr(new_url)
            if not os.getenv("BLOB_PTR_URL"):
                print(f"[blob_store] Add to Vercel env vars: BLOB_PTR_URL={ptr_url}")
            # Delete superseded CSV versions (best-effort; pointer blob is overwritten in place).
            _delete([b["url"] for b in _list_blobs() if b.get("url") != new_url])
            _cache = (header, rows)
            _cache_url = new_url
    return result
