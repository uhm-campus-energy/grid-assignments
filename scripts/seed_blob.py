"""One-time (and re-runnable) upload of the grid CSV into Vercel Blob.

Usage (token can live in .env, which this loads):
    python scripts/seed_blob.py [csv_path]

Uploads the CSV to a PRIVATE Vercel Blob, verifies it can be read back, and
prints the blob URL. Set that URL as BLOB_CSV_URL on Vercel (and locally) so
the backend can read it. Safe to re-run; it overwrites the same pathname.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")

import requests  # noqa: E402

from backend import blob_store  # noqa: E402

DEFAULT_CSV = _ROOT / "data" / "grid_assignments.csv"


def main() -> int:
    if not os.getenv("BLOB_READ_WRITE_TOKEN"):
        print("ERROR: BLOB_READ_WRITE_TOKEN is not set (add it to .env).", file=sys.stderr)
        return 1

    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    if not csv_path.exists():
        print(f"ERROR: CSV not found: {csv_path}", file=sys.stderr)
        return 1

    data = csv_path.read_bytes()
    print(f"Uploading {csv_path} ({len(data):,} bytes) -> blob '{blob_store.PATHNAME}' ...")
    meta = blob_store.put_csv(data)
    url = meta.get("url")
    print("Upload OK.")

    # Verify the round-trip: read it back with the token.
    print("Verifying read-back ...")
    resp = requests.get(
        url, headers={"authorization": f"Bearer {os.environ['BLOB_READ_WRITE_TOKEN']}"}, timeout=120
    )
    resp.raise_for_status()
    header, rows = __import__("backend._csv_logic", fromlist=["x"]).parse_csv(resp.content.decode("utf-8"))
    print(f"Read-back OK: {len(rows):,} data rows, {len(header)} columns.")

    print("\nBlob URL (set this as BLOB_CSV_URL locally and on Vercel):")
    print(f"BLOB_CSV_URL={url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
