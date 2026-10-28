"""OpenLoop API. Every POST returns the full case bundle (see docs/design.md)."""
import json
import os
import threading
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from typing import Literal  # noqa: E402

from pydantic import BaseModel, Field  # noqa: E402

from . import case_views, chat, learner, notifier, registry  # noqa: E402
from . import template as T  # noqa: E402
from .agent import make_agent  # noqa: E402
from .engine import Case  # noqa: E402
from .scenario import CASE_START, SCENARIO  # noqa: E402

app = FastAPI(title="OpenLoop", version="0.1.0")
CASES: dict[str, Case] = {}
AGENT = make_agent()
LOCK = threading.Lock()  # one writer at a time keeps the hash chain linear (e.g. laptop + projector tabs)


class Inbound(BaseModel):
    item_id: str


class Advance(BaseModel):
    days: float = 1


class Resolve(BaseModel):
    action_id: str
    note: str = ""


class RegistryToggle(BaseModel):
    down: bool


class Promote(BaseModel):
    by: str = Field(min_length=1, max_length=80)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=6000)


class ChatIn(BaseModel):
    role: Literal["client", "employee"]
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=10)


def _text(v) -> str:
    return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)


def bundle(case: Case) -> dict:
    st = case.state()
    ev = case.ledger.events
    steps = st["trace"]
    return {
        "case": {"id": case.id, "title": T.CASE_TITLE, "goal": T.CASE_GOAL, "status": st["status"],
                 "sim_now": st["now"].isoformat(), "day": (st["now"] - CASE_START).days, "opened_at": CASE_START.isoformat()},
        "config": {"agent_mode": AGENT.mode, "agent_status": AGENT.status,
                   "judge_mode": os.environ.get("JUDGE_MODE", "heuristic"),
                   "judge_threshold": T.JUDGE_THRESHOLD, "registry_down": registry.state["down"]},
        "requirements": [{k: r.get(k) for k in ("id", "title", "status", "reason", "rule_ids", "updated_at")} |
                         {"evidence": r["evidence"]} for r in st["reqs"].values()],
        "documents": [{k: d.get(k) for k in ("id", "type", "name", "received_at", "issued_at")} for d in st["docs"].values()],
        "exceptions": [{k: x.get(k) for k in ("id", "requirement_id", "status", "severity", "title", "summary", "rule",
                                              "snippets", "judge", "actions", "created_at", "notes", "kind",
                                              "first_seq", "then_seq")} |
                       {"resolution": ({k: v for k, v in x["resolution"].items() if k != "seq"} if x.get("resolution") else None)}
                       for x in st["exceptions"].values()],
        "timers": [{k: t.get(k) for k in ("id", "kind", "label", "due", "status")} for t in st["timers"].values()],
        "metrics": {
            "agent_steps": len(steps),
            "tool_calls": sum(1 for s in steps if s["tool"] not in ("get_case_state", "get_allowed_actions")),
            "auto_resolved": sum(1 for r in st["reqs"].values()
                                 if r["status"] == "SATISFIED" and r["details"].get("decided_by") != "analyst"),
            "sent_to_human": sum(1 for e in ev if e["type"] == "EXCEPTION_RAISED"),
            "denied_actions": sum(1 for s in steps if s["gate"].startswith("DENY")),
        },
        "events": [{k: e[k] for k in ("seq", "type", "sim_time", "actor", "summary", "hash", "prev_hash")} for e in ev],
        "trace": [{"seq": s["seq"], "sim_time": s["sim_time"], "reason": s["reason"], "tool": s["tool"],
                   "input": s["input"], "output": _text(s["output"]), "gate": s["gate"], "by": s.get("by")}
                  for s in steps],
        "scenario": [{"id": i["id"], "label": i["label"], "delivered": i["id"] in st["delivered"],
                      "internal": "events" in i} for i in SCENARIO],
        "learning": {"checks": learner.PROMOTED, "proposals": len(learner.proposals(st))},
        "outbox": [{"seq": e["seq"], "sim_time": e["sim_time"], "status": "sent" if e["type"] == "EMAIL_SENT" else "failed",
                    **{k: e["payload"].get(k) for k in ("to", "subject", "body", "mode", "error")}}
                   for e in reversed(ev) if e["type"] in ("EMAIL_SENT", "EMAIL_FAILED")],
    }


def _case(case_id: str) -> Case:
    if case_id not in CASES:
        raise HTTPException(404, f"case {case_id} not found")
    return CASES[case_id]


@app.post("/api/demo/reset")
def reset_demo():
    with LOCK:
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
    with LOCK:
        if body.item_id in case.state()["delivered"]:
            raise HTTPException(409, "scenario item already delivered")
        AGENT.handle_batch(case, case.deliver(body.item_id))  # pipeline per document, one planning step per click
        notifier.flush(case)
        return bundle(case)


@app.post("/api/cases/{case_id}/advance")
def advance(case_id: str, body: Advance):
    case = _case(case_id)
    if not 0 < body.days <= 60:
        raise HTTPException(422, "days must be in (0, 60]")
    with LOCK:
        fired = []
        for ev in case.advance(body.days):  # each timer goes through the pipeline as it fires...
            AGENT.pipeline(case, ev)
            fired.append(ev)
        if fired:
            AGENT.plan(case, fired)  # ...then one planning step for the whole skip
        notifier.flush(case)
        return bundle(case)


@app.post("/api/cases/{case_id}/exceptions/{exception_id}/resolve")
def resolve(case_id: str, exception_id: str, body: Resolve):
    case = _case(case_id)
    if exception_id not in case.state()["exceptions"]:
        raise HTTPException(404, "exception not found")
    with LOCK:
        try:
            event = case.resolve(exception_id, body.action_id, body.note)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        AGENT.handle_batch(case, [event])
        notifier.flush(case)
        return bundle(case)


@app.post("/api/cases/{case_id}/chat")
def chat_endpoint(case_id: str, body: ChatIn):
    """Read-only Q&A about the case for a client or an employee; only the audit append takes the write lock."""
    case = _case(case_id)
    result = chat.answer(case, body.role, body.message, [h.model_dump() for h in body.history])
    with LOCK:
        if CASES.get(case_id) is case:  # a reset during the answer replaced the case: don't log into the new ledger
            chat.log_turn(case, body.role, body.message, result)
    return result


@app.get("/api/cases/{case_id}/client-view")
def client_view(case_id: str):
    """Everything the applicant may see, for a customer-facing page (same allow-list as the client chat)."""
    case = _case(case_id)
    return {"overview": case_views.overview(case, "client"),
            "missing_documents": case_views.missing_documents(case, "client"),
            "issues": case_views.issues(case, "client", "open"),
            "timeline": case_views.timeline(case, "client"),
            "emails": [{k: e["payload"].get(k) for k in ("subject", "body")} | {"sim_time": e["sim_time"]}
                       for e in case.ledger.events if e["type"] == "EMAIL_SENT"]}


def _learning_case() -> Case:
    return _case("demo-1")


@app.get("/api/learning")
def learning_state():
    return {"proposals": learner.proposals(_learning_case().state()), "checks": learner.PROMOTED}


@app.post("/api/learning/proposals/{proposal_id}/backtest")
def learning_backtest(proposal_id: str):
    try:
        return learner.backtest(proposal_id)
    except KeyError:
        raise HTTPException(404, "unknown proposal")


@app.post("/api/learning/proposals/{proposal_id}/promote")
def learning_promote(proposal_id: str, body: Promote):
    """Maker-checker: 409 when the promoter is one of the analysts whose rulings created the proposal."""
    case = _learning_case()
    with LOCK:
        try:
            check = learner.promote(case.state(), proposal_id, body.by)
        except KeyError:
            raise HTTPException(404, "unknown proposal")
        except PermissionError as exc:
            raise HTTPException(409, str(exc))
        case.emit("CHECK_PROMOTED", {"type": "employee", "id": check["promoted_by"]},
                  {k: check[k] for k in ("id", "proposal_id", "description", "promoted_by", "support")},
                  f"Learned check {check['id']} promoted by {check['promoted_by']}")
    return {"check": check}


@app.get("/api/cases/{case_id}/verify")
def verify(case_id: str):
    return _case(case_id).ledger.verify()


@app.post("/api/registry")
def toggle_registry(body: RegistryToggle):
    """Curveball switch for the demo: make the trade-register API 'go down'."""
    registry.state["down"] = body.down
    return {"down": registry.state["down"]}


reset_demo()  # a fresh demo case exists from startup, so the first page load never 404s

app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="frontend")
