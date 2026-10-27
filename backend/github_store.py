"""GitHub-repo CSV backend (DATA_BACKEND=github).

Reads and writes the committed data/grid_assignments.csv through the GitHub
REST API, so every reassignment made in the deployed app becomes a commit on
the repo. (A Vercel function can't write its own bundle: the filesystem is
read-only and each instance is thrown away.) Row-processing is shared with the
other CSV stores via _csv_logic, so behavior matches DATA_BACKEND=csv.

Consistency: every read first asks GitHub for the file's current blob SHA (a
small metadata call) and only re-downloads the CSV when that SHA differs from
the cached one. A write sends the SHA it was based on, so GitHub rejects it
(409) if someone else committed in between; we then re-read and retry once
instead of silently overwriting their change.

Env:
  GITHUB_TOKEN     required for writes (fine-grained PAT, Contents: read/write
                   on this repo). Reads of a public repo work without it.
  GITHUB_REPO      "owner/name"; defaults to the repo Vercel deployed from
  GITHUB_BRANCH    branch to read/commit, default "main"
  GITHUB_CSV_PATH  path in the repo, default "data/grid_assignments.csv"
"""
import base64
import os
import threading

import requests

from . import _csv_logic as L

_API_BASE = "https://api.github.com"

REPO = os.getenv("GITHUB_REPO") or "/".join(
    filter(None, [os.getenv("VERCEL_GIT_REPO_OWNER"), os.getenv("VERCEL_GIT_REPO_SLUG")])
)
BRANCH = os.getenv("GITHUB_BRANCH", "main")
PATH = os.getenv("GITHUB_CSV_PATH", "data/grid_assignments.csv")

_lock = threading.Lock()
_cache: tuple[list[str], list[list[str]]] | None = None
_cache_sha: str | None = None


def _headers(accept: str) -> dict:
    headers = {"accept": accept, "x-github-api-version": "2022-11-28"}
    tok = os.getenv("GITHUB_TOKEN")
    if tok:
        headers["authorization"] = f"Bearer {tok}"
    return headers


def _contents_url() -> str:
    if "/" not in REPO:
        raise RuntimeError("GITHUB_REPO is not set (expected 'owner/name').")
    return f"{_API_BASE}/repos/{REPO}/contents/{PATH}"


def _current_sha() -> str:
    """Blob SHA of the CSV at the branch head. The 'object' media type returns
    metadata only for files over 1 MB, so this stays a small call."""
    resp = requests.get(
        _contents_url(),
        headers=_headers("application/vnd.github.object+json"),
        params={"ref": BRANCH},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["sha"]


def _read_all() -> tuple[list[str], list[list[str]]]:
    """Return (header, rows) for the branch head, downloading only when the
    file's SHA differs from what we cached."""
    global _cache, _cache_sha
    sha = _current_sha()
    if _cache is not None and sha == _cache_sha:
        return _cache
    # Fetch by blob SHA (not by path) so the bytes always match the SHA above.
    resp = requests.get(
        f"{_API_BASE}/repos/{REPO}/git/blobs/{sha}",
        headers=_headers("application/vnd.github.raw+json"),
        timeout=120,
    )
    resp.raise_for_status()
    _cache = L.parse_csv(resp.content.decode("utf-8"))
    _cache_sha = sha
    return _cache


def _commit(data: bytes, sha: str, message: str) -> str | None:
    """Commit new CSV bytes on top of ``sha``. Returns the new blob SHA, or None
    if the file changed underneath us (caller should re-read and retry)."""
    if not os.getenv("GITHUB_TOKEN"):
        raise RuntimeError("GITHUB_TOKEN is not set (needed to commit the CSV).")
    resp = requests.put(
        _contents_url(),
        headers=_headers("application/vnd.github+json"),
        json={
            "message": message,
            "content": base64.b64encode(data).decode("ascii"),
            "sha": sha,
            "branch": BRANCH,
        },
        timeout=120,
    )
    if resp.status_code == 409:
        return None
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"GitHub commit failed ({resp.status_code}): {resp.text}")
    return resp.json()["content"]["sha"]


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


def _commit_edit(message: str, edit):
    """Run ``edit(rows) -> (new_rows, result) | None`` on the branch head and
    commit the new rows, re-reading and retrying once on a conflict. Returns
    ``result``, or None (nothing committed) if ``edit`` returned None."""
    global _cache, _cache_sha
    with _lock:
        for _ in range(2):
            # Re-read from the branch head so the edit lands on the latest data.
            _cache = None
            _cache_sha = None
            header, rows = _read_all()
            edited = edit(rows)
            if edited is None:
                return None
            new_rows, result = edited
            new_sha = _commit(L.serialize_csv(header, new_rows).encode("utf-8"), _cache_sha, message)
            if new_sha:
                _cache = (header, new_rows)
                _cache_sha = new_sha
                return result
        _cache = None
        _cache_sha = None
        raise RuntimeError("GitHub commit kept conflicting with concurrent edits; try again.")


def upsert_assignment(meter_names: list[str], scenario: str, substation_meter: str) -> list[dict] | None:
    # One commit for the whole batch. "[skip ci]" keeps a data-only commit from
    # running the GitHub Actions suite.
    who = meter_names[0] if len(meter_names) == 1 else f"{len(meter_names)} meters ({', '.join(meter_names)})"
    message = f"Reassign {who} to {substation_meter} ({scenario}) [skip ci]"

    def edit(rows):
        result = L.apply_upsert(rows, meter_names, scenario, substation_meter)
        return None if result is None else (rows, result)

    return _commit_edit(message, edit)


def delete_assignment(scenario: str) -> bool:
    def edit(rows):
        kept = L.apply_delete(rows, scenario)
        return None if kept is None else (kept, True)

    return bool(_commit_edit(f"Delete assignment {scenario} [skip ci]", edit))
