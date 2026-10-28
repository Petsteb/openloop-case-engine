"""Append-only, hash-chained event ledger. Each event stores the hash of the previous one."""
import hashlib
import json
from datetime import datetime, timezone

GENESIS = "0" * 64


def _canonical(d: dict) -> str:
    return json.dumps(d, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str)


def _hash(body: dict) -> str:
    return hashlib.sha256(_canonical(body).encode()).hexdigest()


class Ledger:
    """In memory, optionally backed by a Store (SQLite). `events` reloads a stored ledger as-is."""

    def __init__(self, case_id: str, store=None, events: list[dict] | None = None):
        self.case_id = case_id
        self.store = store
        self.events: list[dict] = list(events or [])

    def append(self, type_: str, sim_time: datetime, actor: dict, payload: dict, summary: str) -> dict:
        body = {
            "case_id": self.case_id,
            "seq": len(self.events) + 1,
            "type": type_,
            "sim_time": sim_time.isoformat(),
            "wall_time": datetime.now(timezone.utc).isoformat(),
            "actor": actor,
            "payload": payload,
            "summary": summary,
            "prev_hash": self.events[-1]["hash"] if self.events else GENESIS,
        }
        event = {**body, "hash": _hash(body)}
        if self.store is not None:
            self.store.append(self.case_id, event, _canonical(event))
        self.events.append(event)
        return event

    def verify(self) -> dict:
        prev = GENESIS
        for e in self.events:
            body = {k: v for k, v in e.items() if k != "hash"}
            if e["prev_hash"] != prev or _hash(body) != e["hash"]:
                return {"ok": False, "length": len(self.events), "broken_at": e["seq"]}
            prev = e["hash"]
        return {"ok": True, "length": len(self.events), "broken_at": None}
