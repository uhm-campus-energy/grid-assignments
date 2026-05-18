import csv
import os
import threading
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

_lock = threading.Lock()


def _read_csv(filename: str) -> list[dict]:
    path = DATA_DIR / filename
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _write_csv(filename: str, rows: list[dict], fieldnames: list[str]) -> None:
    path = DATA_DIR / filename
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def get_meters() -> list[dict]:
    return _read_csv("meters.csv")


def get_assignments() -> list[dict]:
    return _read_csv("assignments.csv")


def get_kw_data() -> list[dict]:
    return _read_csv("kw_data.csv")


def upsert_assignment(meter_name: str, scenario: str, substation_meter: str) -> dict:
    fieldnames = ["meter_name", "scenario", "substation_meter", "notes", "assignment", "updated_at"]
    with _lock:
        rows = _read_csv("assignments.csv")
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        updated = None
        for row in rows:
            if row["meter_name"] == meter_name and row["scenario"] == scenario:
                row["substation_meter"] = substation_meter
                row["updated_at"] = now
                updated = row
                break
        if updated is None:
            updated = {
                "meter_name": meter_name,
                "scenario": scenario,
                "substation_meter": substation_meter,
                "notes": "",
                "assignment": "",
                "updated_at": now,
            }
            rows.append(updated)
        _write_csv("assignments.csv", rows, fieldnames)
    return updated
