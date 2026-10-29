"""OpenLoop API. Every POST returns the full case bundle (see docs/design.md)."""
import base64
import binascii
import hashlib
import hmac
import json
import os
import threading
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

from fastapi import FastAPI, Header, HTTPException, Query, Request  # noqa: E402
from fastapi.responses import PlainTextResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from typing import Literal  # noqa: E402

from pydantic import BaseModel, Field  # noqa: E402

from . import auth, case_views, chat, learner, messages, notifier, profiles, registry  # noqa: E402
from . import template as T  # noqa: E402
from .agent import ScriptedAgent, make_agent  # noqa: E402
from .engine import Case, _pending, keys_match, pending_confirmations  # noqa: E402
from .fastjson import json_response  # noqa: E402
from .scenario import CASE_START, WRONG_COMPANY  # noqa: E402
from .store import Store  # noqa: E402

app = FastAPI(title="OpenLoop", version="0.2.0")


@app.middleware("http")
async def revalidate_pages(request, call_next):
    """HTML pages are always revalidated, so a rebuilt UI shows at once (the hashed JS/CSS assets stay cacheable)."""
    response = await call_next(request)
    if response.headers.get("content-type", "").startswith("text/html"):
        response.headers["Cache-Control"] = "no-cache"
    return response
CASES: dict[str, Case] = {}
# Login and the access policy for every /api route (backend/app/auth.py). OPENLOOP_AUTH=off restores the open demo.
auth.install(app, case_company=lambda case_id: CASES[case_id].profile["id"] if case_id in CASES else None)
AGENT = make_agent()
LOCK = threading.Lock()  # one writer at a time keeps the hash chain linear (e.g. laptop + projector tabs)
# Every ledger lives in one SQLite table (production: PostgreSQL on the bank's own servers). OPENLOOP_DB=:memory: in tests.
STORE = Store(os.environ.get("OPENLOOP_DB") or ROOT / "data" / "openloop.db")

# Synthetic files the queue starts with: (company, template, inbound items delivered), each at a different stage.
SEEDS = [("verde", "sme_loan", ["day0-pack", "onrc-cert", "fiscal-cert"]),
         ("carpatic", "sme_loan", ["day0-pack", "onrc-cert", "fiscal-cert"]),
         ("delta", "sme_loan", ["day0-pack", "onrc-cert", "fiscal-cert"]),
         ("nord", "sme_loan", ["day0-pack", "onrc-cert", "fiscal-cert"]),
         ("medica", "sme_loan", ["day0-pack", "onrc-cert", "fiscal-cert"]),
         ("solaris", "sme_loan", ["day0-pack", "onrc-cert", "fiscal-cert"]),
         ("atelier", "kyb_review", ["day0-pack"])]


class Inbound(BaseModel):
    item_id: str


class Advance(BaseModel):
    days: float = 1


class Resolve(BaseModel):
    action_id: str
    note: str = ""
    by: str | None = Field(default=None, max_length=80)  # set from the session by the auth policy


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


def bundle_case_header(case: Case) -> dict:
    st = case.state()
    opened, t = case.ledger.events[0]["payload"], T.TEMPLATES[st["template"]]
    return {"id": case.id, "title": opened.get("title", t["title"]), "goal": opened.get("goal", t["goal"]),
            "status": st["status"], "sim_now": st["now"].isoformat(), "day": (st["now"] - CASE_START).days,
            "opened_at": CASE_START.isoformat(), "template": st["template"], "template_title": t["title"],
            "decision": t["decision"], "company_id": st["profile"]["id"], "company": st["profile"]["name"],
            "product": st["profile"]["product"]}


def bundle(case: Case) -> dict:
    st = case.state()
    ev = case.ledger.events
    steps = st["trace"]
    return {
        "case": bundle_case_header(case),
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
                      "internal": "events" in i} for i in case.scenario],
        "learning": {"checks": learner.PROMOTED, "proposals": len(learner.proposals(st))},
        "outbox": [{"seq": e["seq"], "sim_time": e["sim_time"], "status": "sent" if e["type"] == "EMAIL_SENT" else "failed",
                    **{k: e["payload"].get(k) for k in ("to", "subject", "body", "mode", "error")}}
                   for e in reversed(ev) if e["type"] in ("EMAIL_SENT", "EMAIL_FAILED")],
    }


def _case(case_id: str) -> Case:
    if case_id not in CASES:
        raise HTTPException(404, f"case {case_id} not found")
    return CASES[case_id]


def _advance(case: Case, agent, days: float) -> None:
    fired = []
    for ev in case.advance(days):  # each timer goes through the pipeline as it fires...
        agent.pipeline(case, ev)
        fired.append(ev)
    if fired:
        agent.plan(case, fired)  # ...then one planning step for the whole skip


def _seed() -> None:
    """demo-1 (the scripted bakery demo) plus synthetic files at different stages. Always offline and free:
    scripted agent, heuristic judge, outbox email, whatever the live configuration is."""
    CASES["demo-1"] = Case("demo-1", STORE)
    agent, judge_mode = ScriptedAgent(), os.environ.get("JUDGE_MODE")
    os.environ["JUDGE_MODE"] = "heuristic"
    try:
        for n, (company, template, items) in enumerate(SEEDS, start=2):
            case = CASES[f"case-{n}"] = Case(f"case-{n}", STORE, template=template, profile_id=company)
            agent.handle_batch(case, [case.ledger.events[0]])  # the bank asks for the starting documents
            notifier.flush(case, mode="outbox")
            for i, item in enumerate(items):
                if i:
                    _advance(case, agent, 1)
                agent.handle_batch(case, case.deliver(item))
                if item == "day0-pack" and template == "sme_loan":  # consent comes with the signed application
                    agent.handle_batch(case, [case.client_confirm("credit_check_consent", "yes")])
                notifier.flush(case, mode="outbox")
    finally:
        if judge_mode is None:
            os.environ.pop("JUDGE_MODE", None)
        else:
            os.environ["JUDGE_MODE"] = judge_mode


def _load() -> None:
    """Reload every stored case on startup; seed a fresh database."""
    for case_id in STORE.case_ids():
        events = STORE.events(case_id)
        if not events:
            continue
        try:
            case = Case(case_id, STORE, events=events)
        except Exception as exc:  # a damaged ledger must not stop the server
            print(f"[openloop] skipped stored case {case_id}: cannot replay its ledger ({type(exc).__name__}: {exc})")
            continue
        if not case.ledger.verify()["ok"]:
            print(f"[openloop] skipped stored case {case_id}: its hash chain does not verify")
            continue
        CASES[case_id] = case
    for case in CASES.values():
        for e in case.ledger.events:
            if e["type"] == "CHECK_PROMOTED" and not any(c["id"] == e["payload"]["id"] for c in learner.PROMOTED):
                learner.PROMOTED.append({**e["payload"], "promoted_at": e["wall_time"],
                                         "backtest": learner.backtest(e["payload"]["proposal_id"])})
    if not CASES:
        STORE.wipe()  # nothing usable was stored: start clean
        _seed()
    elif "demo-1" not in CASES:
        STORE.clear_events("demo-1")
        CASES["demo-1"] = Case("demo-1", STORE)


@app.post("/api/demo/reset")
def reset_demo(all_cases: bool = Query(False, alias="all")):
    """Reset demo-1 to its start; ?all=true wipes the database and reseeds every synthetic file."""
    with LOCK:
        registry.state["down"] = False
        for old in ([*CASES.values()] if all_cases else [CASES.get("demo-1")]):
            if old is not None:  # detach: a request still holding the old object can no longer write to the store
                old.ledger.store = None
        if all_cases:
            STORE.wipe()
            CASES.clear()
            learner.PROMOTED.clear()  # the wipe removed the CHECK_PROMOTED events: a restart would forget them too
            _seed()
        else:
            STORE.clear_events("demo-1")
            CASES["demo-1"] = Case("demo-1", STORE)
        return bundle(CASES["demo-1"])


# ----------------------------------------------------------------------------- home: all cases, templates, companies
class NewCase(BaseModel):
    template: str = Field(min_length=1, max_length=40)
    company_id: str = Field(min_length=1, max_length=40)
    role: Literal["client", "employee"] = "employee"  # a client starting an application gets the client view back


@app.get("/api/version")
def global_version():
    """Cheap change detector for the home screens."""
    return {"cases": len(CASES), "events": sum(len(c.ledger.events) for c in list(CASES.values()))}


TEMPLATE_PUBLIC_FIELDS = ("id", "title", "description", "requirements", "goal", "decision")


@app.get("/api/templates")
def list_templates():
    """Templates with the words a UI needs (`decision`: "credit decision" / "annual review sign-off")."""
    return [{k: t[k] for k in TEMPLATE_PUBLIC_FIELDS} for t in T.TEMPLATES.values()]


@app.get("/api/companies")
def list_companies(request: Request):
    """Synthetic client companies (all fictional), with the one problem each file exercises.
    A signed-in client sees only its own company, without the bank's note on what its file exercises."""
    who = auth.actor(request)
    if who and who["role"] == "client":
        return [{k: p[k] for k in ("id", "name", "cui", "city", "county", "product", "templates")}
                for p in profiles.PROFILES.values() if p["id"] == who["company_id"]]
    return [{k: p[k] for k in ("id", "name", "cui", "city", "county", "product", "story", "templates")}
            for p in profiles.PROFILES.values()]


@app.get("/api/cases")
def list_cases(role: Literal["client", "employee"] = "employee", company_id: str = "aurora",
               x_staff_token: str | None = Header(default=None)):
    """Employee: the work queue, needs-you first. Client: that company's files (identity is simulated in the demo)."""
    if role == "employee":
        _require_staff(x_staff_token)
    cases = [c for c in list(CASES.values()) if role == "employee" or c.profile["id"] == company_id]
    return sorted((case_views.case_row(c, role) for c in cases), key=case_views.queue_sort_key)


@app.post("/api/cases")
def create_case(body: NewCase):
    """Open a new file; the agent immediately asks the client for the starting documents."""
    company = profiles.PROFILES.get(body.company_id)
    if body.template not in T.TEMPLATES or company is None:
        raise HTTPException(422, "unknown template or company")
    if body.template not in company["templates"]:
        raise HTTPException(422, f"{company['name']} has no synthetic documents for {body.template}")
    with LOCK:
        used = set(CASES) | set(STORE.case_ids())  # a skipped damaged ledger still owns its id
        n = 1 + max((int(cid.split("-")[1]) for cid in used if cid.split("-")[-1].isdigit()), default=1)
        case = CASES[f"case-{n}"] = Case(f"case-{n}", STORE, template=body.template, profile_id=body.company_id)
        AGENT.handle_batch(case, [case.ledger.events[0]])
        notifier.flush(case)
        if body.role == "client":  # never the bank bundle (agent trace, internal events) to a client
            return {"case": {k: bundle_case_header(case)[k] for k in
                             ("id", "template", "template_title", "company_id", "company", "product")},
                    **_client_view(case)}
        return bundle(case)


@app.get("/api/notifications")
def list_notifications(role: Literal["client", "employee"] = "employee", company_id: str = "aurora",
                       x_staff_token: str | None = Header(default=None)):
    """Newest first: actions this role owes and messages for it, across its cases."""
    if role == "employee":
        _require_staff(x_staff_token)
    cases = [c for c in list(CASES.values()) if role == "employee" or c.profile["id"] == company_id]
    items = [n for c in cases for n in case_views.notifications(c, role)]
    return sorted(items, key=lambda n: (n["day"], n["seq"]), reverse=True)[:100]


@app.get("/api/cases/{case_id}/bundle")
def get_bundle(case_id: str):
    return json_response(bundle(_case(case_id)))  # same bytes as FastAPI's encoder, ~8 ms less per bundle


@app.post("/api/cases/{case_id}/inbound")
def inbound(case_id: str, body: Inbound):
    case = _case(case_id)
    if body.item_id not in {i["id"] for i in case.scenario}:
        raise HTTPException(422, "unknown scenario item")
    with LOCK:
        case = _case(case_id)  # look it up again under the lock: a reset may have replaced it
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
        case = _case(case_id)  # look it up again under the lock: a reset may have replaced it
        _advance(case, AGENT, body.days)
        notifier.flush(case)
        return bundle(case)


@app.post("/api/cases/{case_id}/exceptions/{exception_id}/resolve")
def resolve(case_id: str, exception_id: str, body: Resolve):
    case = _case(case_id)
    if exception_id not in case.state()["exceptions"]:
        raise HTTPException(404, "exception not found")
    with LOCK:
        case = _case(case_id)  # look it up again under the lock: a reset may have replaced it
        try:
            event = case.resolve(exception_id, body.action_id, body.note, by=body.by)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        AGENT.handle_batch(case, [event])
        notifier.flush(case)
        return bundle(case)


class Release(BaseModel):
    by: str = Field(min_length=1, max_length=80)
    note: str = Field(default="", max_length=500)


@app.post("/api/cases/{case_id}/release-hold")
def release_hold(case_id: str, body: Release, x_staff_token: str | None = Header(default=None)):
    """Compliance lifts an ON_HOLD (e.g. the insider pattern turned out legitimate)."""
    _require_staff(x_staff_token)
    case = _case(case_id)
    with LOCK:
        case = _case(case_id)  # look it up again under the lock: a reset may have replaced it
        try:
            event = case.release_hold(body.by, body.note)
        except ValueError as exc:
            raise HTTPException(409, str(exc))
        AGENT.handle_batch(case, [event])
        notifier.flush(case)
        return bundle(case)


def _require_staff(token: str | None) -> None:
    """Demo has no login; set STAFF_TOKEN to require X-Staff-Token on staff-only calls (production: bank SSO)."""
    expected = os.environ.get("STAFF_TOKEN", "")
    if expected and not hmac.compare_digest((token or "").encode(), expected.encode()):
        raise HTTPException(403, "staff token required")


@app.post("/api/cases/{case_id}/chat")
def chat_endpoint(case_id: str, body: ChatIn, x_staff_token: str | None = Header(default=None)):
    """Read-only Q&A about the case for a client or an employee; only the audit append takes the write lock."""
    if body.role == "employee":
        _require_staff(x_staff_token)
    case = _case(case_id)
    result = chat.answer(case, body.role, body.message, [h.model_dump() for h in body.history])
    with LOCK:
        case = _case(case_id)  # look it up again under the lock: a reset may have replaced it
        if CASES.get(case_id) is case:  # a reset during the answer replaced the case: don't log into the new ledger
            chat.log_turn(case, body.role, body.message, result)
    return result


@app.get("/api/cases/{case_id}/version")
def case_version(case_id: str):
    """Cheap polling target: refetch the bundle only when `length` changes."""
    return case_views.version(_case(case_id))


@app.get("/api/cases/{case_id}/documents")
def list_documents(case_id: str, role: Literal["client", "employee"] = "client",
                   x_staff_token: str | None = Header(default=None)):
    """Fails closed: without role=employee the caller gets the client list."""
    if role == "employee":
        _require_staff(x_staff_token)
    return case_views.documents(_case(case_id), role)


@app.get("/api/cases/{case_id}/documents/{doc_id}")
def get_document(case_id: str, doc_id: str, role: Literal["client", "employee"] = "client",
                 x_staff_token: str | None = Header(default=None)):
    if role == "employee":
        _require_staff(x_staff_token)
    try:
        return case_views.document_detail(_case(case_id), role, doc_id)
    except KeyError:
        raise HTTPException(404, "document not found")


@app.get("/api/cases/{case_id}/client-view")
def client_view(case_id: str):
    """Everything the applicant may see, for a customer-facing page (same allow-list as the client chat)."""
    return _client_view(_case(case_id))


def _client_view(case: Case) -> dict:
    return {"overview": case_views.overview(case, "client"),
            "missing_documents": case_views.missing_documents(case, "client"),
            "issues": case_views.issues(case, "client", "open"),
            "timeline": case_views.timeline(case, "client"),
            "documents": case_views.documents(case, "client"),
            "confirmations": [{k: c[k] for k in ("kind", "text", "ref_seq")}
                              for c in pending_confirmations(case.ledger.events)],
            "emails": [{k: e["payload"].get(k) for k in ("subject", "body")} | {"sim_time": e["sim_time"]}
                       for e in case.ledger.events if e["type"] == "EMAIL_SENT"]}


class Upload(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    filename: str = Field(min_length=1, max_length=200)
    content_b64: str = Field(min_length=1, max_length=1_400_000)


class UploadSample(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    variant: Literal["ok", "wrong_company"] = "ok"


class Confirm(BaseModel):
    kind: Literal["contact_change", "credit_check_consent"]
    answer: Literal["yes", "no"]


def _ingest_upload(case: Case, key: str, filename: str, raw: bytes) -> dict:
    """Shared by real and sample uploads: validate, store, run the pipeline + planner, notify the client."""
    ext = Path(filename).suffix.lower()
    if ext not in (".txt", ".pdf"):
        raise HTTPException(422, "only .txt or .pdf files are accepted")
    if len(raw) > 1_000_000:
        raise HTTPException(422, "file is larger than 1 MB")
    with LOCK:
        case = _case(case.id)  # look it up again under the lock: a reset may have replaced it
        if not _pending(case.state(), key):
            raise HTTPException(422, "this document was not requested (or was already received)")
        if ext == ".pdf":
            event = case.receive_upload(key, filename, "", pdf={"pdf": True, "bytes": len(raw),
                                                                "sha256": hashlib.sha256(raw).hexdigest()})
        else:
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                raise HTTPException(422, "text files must be UTF-8")
            event = case.receive_upload(key, filename, text)
        AGENT.handle_batch(case, [event])
        notifier.flush(case)
        return _client_view(case)


@app.post("/api/cases/{case_id}/upload")
def upload(case_id: str, body: Upload):
    """Client portal upload (JSON + base64; no multipart dependency)."""
    try:
        raw = base64.b64decode(body.content_b64.split(",", 1)[-1], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "content_b64 is not valid base64")
    return _ingest_upload(_case(case_id), body.key, body.filename, raw)


@app.post("/api/cases/{case_id}/upload-sample")
def upload_sample(case_id: str, body: UploadSample):
    """Demo: upload the prepared synthetic file for a request (variant=wrong_company: another firm's certificate)."""
    case = _case(case_id)
    sample = _sample(case, body.key, body.variant)
    if sample is None:
        raise HTTPException(404, "no sample file for this request")
    filename, template = sample
    return _ingest_upload(case, body.key, filename, template.replace("{issued}", case.now.strftime("%d.%m.%Y")).encode())


def _sample(case: Case, key: str, variant: str = "ok") -> tuple[str, str] | None:
    """The company's synthetic file for a request key (names match in any order); or another firm's certificate."""
    if variant == "wrong_company":
        return WRONG_COMPANY
    return next((v for k, v in profiles.samples_for(case.profile["id"]).items() if keys_match(k, key)), None)


def _sample_list(case: Case) -> list[dict]:
    """Keys are spelled like the case's pending requests (e.g. 'id_card:Pop Radu'), so the portal can match exactly."""
    pending = [r["key"] for r in case.state()["requests"].values() if r["status"] == "PENDING"]
    active = case.state()["reqs"]
    wanted = set(T.template_docs(case.template)) | {"id_card"} | {
        d for d, reqs in T.FOLLOW_UP_DOCS.items() if any(r in active for r in reqs)}
    items = []
    for k, (f, _) in profiles.samples_for(case.profile["id"]).items():
        if k.partition(":")[0] not in wanted:
            continue
        key = next((p for p in pending if keys_match(p, k)), k)
        doc_type, _, person = key.partition(":")
        items.append({"key": key, "label": T.DOC_LABELS.get(doc_type, doc_type) + (f" — {person}" if person else ""),
                      "filename": f, "variant": "ok"})
    return items + [{"key": "onrc_certificate", "label": "Trade register certificate (another company: wrong file)",
                     "filename": WRONG_COMPANY[0], "variant": "wrong_company"}]


def _sample_text(case: Case, filename: str) -> PlainTextResponse:
    match = next((t for f, t in [*profiles.samples_for(case.profile["id"]).values(), WRONG_COMPANY] if f == filename), None)
    if match is None:
        raise HTTPException(404, "unknown sample file")
    return PlainTextResponse(match.replace("{issued}", case.now.strftime("%d.%m.%Y")), headers={
        "Content-Disposition": f'attachment; filename="{filename}"'})


@app.get("/api/cases/{case_id}/sample-files")
def case_sample_files(case_id: str):
    return _sample_list(_case(case_id))


@app.get("/api/cases/{case_id}/sample-files/{filename}")
def case_sample_file_content(case_id: str, filename: str):
    return _sample_text(_case(case_id), filename)


@app.get("/api/demo/sample-files")
def sample_files(case_id: str = "demo-1"):
    return _sample_list(_case(case_id))


@app.get("/api/demo/sample-files/{filename}")
def sample_file_content(filename: str, case_id: str = "demo-1"):
    return _sample_text(_case(case_id), filename)


# ----------------------------------------------------------------------------- messages between the client and staff
class MessageIn(BaseModel):
    role: Literal["client", "employee"]
    text: str = Field(min_length=1, max_length=2000)
    author: str | None = Field(default=None, max_length=80)
    refs: list[dict] = Field(default_factory=list, max_length=20)


@app.get("/api/cases/{case_id}/messages")
def get_messages(case_id: str, role: Literal["client", "employee"] = "client",
                 x_staff_token: str | None = Header(default=None)):
    if role == "employee":
        _require_staff(x_staff_token)
    return messages.thread(_case(case_id), role)


@app.post("/api/cases/{case_id}/messages")
def post_message(case_id: str, body: MessageIn, x_staff_token: str | None = Header(default=None)):
    """A client's message also goes through the agent pipeline, like an email (e.g. "a new shareholder joined")."""
    if body.role == "employee":
        _require_staff(x_staff_token)
    case = _case(case_id)
    with LOCK:
        case = _case(case_id)  # look it up again under the lock: a reset may have replaced it
        try:
            event = messages.post(case, body.role, body.text, body.author, body.refs)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        if body.role == "client":
            AGENT.handle_batch(case, [event])
            notifier.flush(case)
        return messages.thread(case, body.role)


@app.get("/api/cases/{case_id}/mentionables")
def get_mentionables(case_id: str, role: Literal["client", "employee"] = "client",
                     x_staff_token: str | None = Header(default=None)):
    if role == "employee":
        _require_staff(x_staff_token)
    return messages.mentionables(_case(case_id), role)


@app.post("/api/cases/{case_id}/client-confirm")
def client_confirm(case_id: str, body: Confirm):
    case = _case(case_id)
    with LOCK:
        case = _case(case_id)  # look it up again under the lock: a reset may have replaced it
        try:
            event = case.client_confirm(body.kind, body.answer)
        except ValueError as exc:
            raise HTTPException(409, str(exc))
        AGENT.handle_batch(case, [event])
        notifier.flush(case)
        return _client_view(case)


def _rulings() -> tuple[dict, list[Case]]:
    """Analyst rulings (precedents) from every case, tagged with their case, plus the cases they came from."""
    cases = [c for c in list(CASES.values()) if c.state()["precedents"]]
    precedents = [{**p, "exception_id": f"{c.id}/{p['exception_id']}"} for c in cases for p in c.state()["precedents"]]
    return {"precedents": precedents}, cases


@app.get("/api/learning")
def learning_state():
    return {"proposals": learner.proposals(_rulings()[0]), "checks": learner.PROMOTED}


@app.get("/api/learning/overview")
def learning_overview():
    """Everything the agent has learned, for the work queue's panel: promoted checks, proposals waiting for a second
    person, the analyst rulings it keeps as precedents, and every place a precedent or a learned check settled a check."""
    rulings, _ = _rulings()
    precedents, applied = [], []
    for c in list(CASES.values()):
        st = c.state()
        when = {e["seq"]: e["sim_time"] for e in c.ledger.events}
        precedents += [{"case_id": c.id, "company": c.profile["name"], "a": p["a"], "b": p["b"], "decision": p["decision"],
                        "by": p.get("analyst"), "exception_id": p["exception_id"], "sim_time": when.get(p["seq"])}
                       for p in st["precedents"]]
        for r in st["reqs"].values():
            d = r.get("details") or {}
            source = d.get("learned_check") or (d.get("precedent") if d.get("decided_by") != "analyst" else None)
            if source:
                applied.append({"case_id": c.id, "company": c.profile["name"], "requirement_id": r["id"],
                                "title": r["title"], "source": source, "reason": r["reason"]})
    return {"checks": learner.PROMOTED, "proposals": learner.proposals(rulings), "precedents": precedents,
            "applied": applied, "history_rulings": len(learner._rows(learner.HISTORY)), "min_support": learner.MIN_SUPPORT}


@app.post("/api/learning/proposals/{proposal_id}/backtest")
def learning_backtest(proposal_id: str):
    try:
        return learner.backtest(proposal_id)
    except KeyError:
        raise HTTPException(404, "unknown proposal")


@app.post("/api/learning/proposals/{proposal_id}/promote")
def learning_promote(proposal_id: str, body: Promote, x_staff_token: str | None = Header(default=None)):
    """Maker-checker: 409 when the promoter is one of the analysts whose rulings created the proposal.
    Identity here is the typed name (no login in the demo); production takes it from the bank's SSO."""
    _require_staff(x_staff_token)
    with LOCK:
        rulings, cases = _rulings()
        try:
            check = learner.promote(rulings, proposal_id, body.by)
        except KeyError:
            raise HTTPException(404, "unknown proposal")
        except PermissionError as exc:
            raise HTTPException(409, str(exc))
        for case in cases:  # the promotion is recorded in every file whose ruling supported it
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


_load()  # stored cases come back after a restart; a fresh database is seeded, so the first page load never 404s

# The React app (web/, built to web/dist) when it has been built; the original static UI otherwise.
# Every /api route is registered above this catch-all mount.
WEB_DIST = ROOT / "web" / "dist"
STATIC = WEB_DIST if (WEB_DIST / "index.html").exists() else ROOT / "frontend"
app.mount("/", StaticFiles(directory=STATIC, html=True), name="frontend")
