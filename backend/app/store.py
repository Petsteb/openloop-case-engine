"""SQLite event store: one append-only table holds every case's ledger.

The ledger already is the database design (append-only, hash-chained), so persistence is one table. SQLite ships with
Python; in production the same table lives in PostgreSQL on the bank's own servers, so no data leaves the bank.
"""
import json
import sqlite3
import threading
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    case_id TEXT NOT NULL,
    seq     INTEGER NOT NULL,
    type    TEXT NOT NULL,
    body    TEXT NOT NULL,          -- the full event as canonical JSON, including its hash
    PRIMARY KEY (case_id, seq)
);
CREATE TABLE IF NOT EXISTS cases (
    case_id    TEXT PRIMARY KEY,
    created    INTEGER NOT NULL      -- insertion order, for stable listing
);
"""


class Store:
    def __init__(self, path: str | Path):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path), check_same_thread=False)  # writes are serialised by main.LOCK
        self.lock = threading.Lock()
        with self.lock:
            self.db.executescript(SCHEMA)

    def append(self, case_id: str, event: dict, body: str) -> None:
        with self.lock, self.db:
            if event["seq"] == 1:
                self.db.execute("INSERT OR IGNORE INTO cases VALUES (?, (SELECT COUNT(*) FROM cases))", (case_id,))
            self.db.execute("INSERT INTO events VALUES (?, ?, ?, ?)", (case_id, event["seq"], event["type"], body))

    def case_ids(self) -> list[str]:
        with self.lock:
            return [r[0] for r in self.db.execute("SELECT case_id FROM cases ORDER BY created")]

    def events(self, case_id: str) -> list[dict]:
        with self.lock:
            rows = self.db.execute("SELECT body FROM events WHERE case_id = ? ORDER BY seq", (case_id,))
            return [json.loads(r[0]) for r in rows]

    def clear_events(self, case_id: str) -> None:
        """Demo reset of one case: its events go, its place in the list stays."""
        with self.lock, self.db:
            self.db.execute("DELETE FROM events WHERE case_id = ?", (case_id,))

    def wipe(self) -> None:
        with self.lock, self.db:
            self.db.execute("DELETE FROM events")
            self.db.execute("DELETE FROM cases")
