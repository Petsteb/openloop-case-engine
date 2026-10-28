"""OpenLoop API. Every POST returns the full case bundle (see docs/design.md)."""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from . import registry  # noqa: E402
from . import template as T  # noqa: E402
from .agent import make_agent  # noqa: E402
from .engine import Case  # noqa: E402
from .scenario import CASE_START, SCENARIO  # noqa: E402

app = FastAPI(title="OpenLoop", version="0.1.0")
CASES: dict[str, Case] = {}
AGENT = make_agent()


class Inbound(BaseModel):
    item_id: str


class Advance(BaseModel):
    days: float = 1


class Resolve(BaseModel):
    action_id: str
    note: str = ""


class RegistryToggle(BaseModel):
    down: bool


def _text(v) -> str:
    return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)


def bundle(case: Case) -> dict:
    st = case.state()
    ev = case.ledger.events
    steps = st["trace"]
    return {
        "case": {"id": case.id, "title": T.CASE_TITLE, "goal": T.CASE_GOAL, "status": st["status"],
                 "sim_now": st["now"].isoformat(), "day": (st["now"] - CASE_START).days, "opened_at": CASE_START.isoformat()},
        "config": {"agent_mode": AGENT.mode, "judge_mode": os.environ.get("JUDGE_MODE", "heuristic"),
                   "judge_threshold": T.JUDGE_THRESHOLD, "registry_down": registry.state["down"]},
        "requirements": [{k: r.get(k) for k in ("id", "title", "status", "reason", "rule_ids", "updated_at")} |
                         {"evidence": r["evidence"]} for r in st["reqs"].values()],
        "documents": [{k: d.get(k) for k in ("id", "type", "name", "received_at", "issued_at")} for d in st["docs"].values()],
        "exceptions": [{k: x.get(k) for k in ("id", "requirement_id", "status", "severity", "title", "summary", "rule",
                                              "snippets", "judge", "actions", "created_at", "notes", "kind")} |
                       {"resolution": ({k: v for k, v in x["resolution"].items() if k != "seq"} if x.get("resolution") else None)}
                       for x in st["exceptions"].values()],
        "timers": [{k: t.get(k) for k in ("id", "kind", "label", "due", "status")} for t in st["timers"].values()],
        "metrics": {
            "agent_steps": len(steps),
            "tool_calls": sum(1 for s in steps if s["tool"] not in ("get_case_state", "get_allowed_actions")),
            "auto_resolved": sum(1 for e in ev if e["type"] == "REQUIREMENT_UPDATED" and e["actor"]["type"] == "agent"
                                 and e["payload"]["status"] == "SATISFIED"),
            "sent_to_human": sum(1 for e in ev if e["type"] == "EXCEPTION_RAISED"),
            "denied_actions": sum(1 for s in steps if s["gate"].startswith("DENY")),
        },
        "events": [{k: e[k] for k in ("seq", "type", "sim_time", "actor", "summary", "hash", "prev_hash")} for e in ev],
        "trace": [{"seq": s["seq"], "sim_time": s["sim_time"], "reason": s["reason"], "tool": s["tool"],
                   "input": s["input"], "output": _text(s["output"]), "gate": s["gate"]} for s in steps],
        "scenario": [{"id": i["id"], "label": i["label"], "delivered": i["id"] in st["delivered"]} for i in SCENARIO],
    }


def _case(case_id: str) -> Case:
    if case_id not in CASES:
        raise HTTPException(404, f"case {case_id} not found")
    return CASES[case_id]


@app.post("/api/demo/reset")
def reset_demo():
    registry.state["down"] = False
    CASES["demo-1"] = Case("demo-1", ROOT / "data" / "ledger")
    return bundle(CASES["demo-1"])


@app.get("/api/cases/{case_id}/bundle")
def get_bundle(case_id: str):
    return bundle(_case(case_id))


@app.post("/api/cases/{case_id}/inbound")
def inbound(case_id: str, body: Inbound):
    case = _case(case_id)
    if body.item_id not in {i["id"] for i in SCENARIO}:
        raise HTTPException(422, "unknown scenario item")
    for event in case.deliver(body.item_id):
        AGENT.handle(case, event)
    return bundle(case)


@app.post("/api/cases/{case_id}/advance")
def advance(case_id: str, body: Advance):
    case = _case(case_id)
    if not 0 < body.days <= 60:
        raise HTTPException(422, "days must be in (0, 60]")
    for fired in case.advance(body.days):
        AGENT.handle(case, fired)
    return bundle(case)


@app.post("/api/cases/{case_id}/exceptions/{exception_id}/resolve")
def resolve(case_id: str, exception_id: str, body: Resolve):
    case = _case(case_id)
    if exception_id not in case.state()["exceptions"]:
        raise HTTPException(404, "exception not found")
    try:
        event = case.resolve(exception_id, body.action_id, body.note)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    AGENT.handle(case, event)
    return bundle(case)


@app.get("/api/cases/{case_id}/verify")
def verify(case_id: str):
    return _case(case_id).ledger.verify()


@app.post("/api/registry")
def toggle_registry(body: RegistryToggle):
    """Curveball switch for the demo: make the trade-register API 'go down'."""
    registry.state["down"] = body.down
    return {"down": registry.state["down"]}


app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="frontend")
