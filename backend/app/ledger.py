"""Append-only, hash-chained event ledger. Each event stores the hash of the previous one."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

GENESIS = "0" * 64


def _canonical(d: dict) -> str:
    return json.dumps(d, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str)


def _hash(body: dict) -> str:
    return hashlib.sha256(_canonical(body).encode()).hexdigest()


class Ledger:
    def __init__(self, case_id: str, persist_dir: Path | None = None):
        self.case_id = case_id
        self.events: list[dict] = []
        self.path = None
        if persist_dir:
            persist_dir.mkdir(parents=True, exist_ok=True)
            self.path = persist_dir / f"{case_id}.jsonl"
            self.path.write_text("", encoding="utf-8")

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
        self.events.append(event)
        if self.path:
            with self.path.open("a", encoding="utf-8") as f:
                f.write(_canonical(event) + "\n")
        return event

    def verify(self) -> dict:
        prev = GENESIS
        for e in self.events:
            body = {k: v for k, v in e.items() if k != "hash"}
            if e["prev_hash"] != prev or _hash(body) != e["hash"]:
                return {"ok": False, "length": len(self.events), "broken_at": e["seq"]}
            prev = e["hash"]
        return {"ok": True, "length": len(self.events), "broken_at": None}
