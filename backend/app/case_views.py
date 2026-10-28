"""Role-scoped, read-only views over a case. The case chat answers only from these functions.

Everything here is a pure function of ``case.state()`` and ``case.ledger.events``: no view emits an event,
calls a tool or changes state, and nested values handed back to the caller are deep copies, so a caller
cannot reach into the ledger by accident.

Two roles exist: ``"client"`` (the applicant) and ``"employee"`` (a bank analyst); anything else raises
ValueError. Client output is an allow-list: every client dict is built field by field, never "employee dict
minus some keys". A client never receives judge probabilities, analyst notes, exception summaries or
snippets, rule IDs or rule thresholds, the agent trace, staff identities or ownership percentages.
"""
from __future__ import annotations

import copy
import re
from datetime import datetime
from typing import TYPE_CHECKING

from . import template as T
from .engine import keys_match
from .rules import norm_text
from .scenario import CASE_START

if TYPE_CHECKING:
    from .engine import Case

ROLES = ("client", "employee")

# ----------------------------------------------------------------------------- vocabulary
EMPLOYEE_STATUS_WORD = {"SATISFIED": "Verified", "OPEN_WAITING": "Waiting", "CONTRADICTED": "Conflict",
                        "NEEDS_REVIEW": "Needs review", "EXPIRED": "Expired"}
CLIENT_STATUS_WORD = {"SATISFIED": "Verified", "OPEN_WAITING": "We need something from you",
                      "EXPIRED": "Expired, please send a new one", "CONTRADICTED": "Under review by the bank",
                      "NEEDS_REVIEW": "Under review by the bank"}
UNDER_REVIEW = "Under review by the bank"
EMPLOYEE_CASE_TEXT = {"OPEN": "Open", "READY_FOR_DECISION": "Ready for decision", "ON_HOLD": "On hold"}

# Requirement titles shown to clients: plain language, no thresholds (the employee title of R4 says "≥ 1.2").
CLIENT_CHECK_TITLE = {
    "R1": "Company is active in the trade register",
    "R2": "Company owners are declared and identified",
    "R3": "Registered office is the same in all documents",
    "R4": "Company income covers the loan repayments",
    "R5": "Application is signed by the legal representative",
    "R6": "No unpaid tax obligations",
}

# One plain, threshold-free sentence per rule. No digits, no rule IDs.
CLIENT_RULE_TEXT: dict[str, str] = {
    "HR-01": "We check that your company's tax ID is valid.",
    "HR-02": "We check that your company is active in the trade register.",
    "HR-03": "Official certificates must be recent, so we may ask you for a fresh copy.",
    "HR-04": "We check that the owners shown in the trade register match the owners you declared to us.",
    "HR-05": "We need an identity document for each of the company's beneficial owners.",
    "HR-06": "We check that the company's registered office is the same in all of your documents.",
    "HR-07": "We check that the company's income comfortably covers its loan repayments.",
    "HR-08": "We check that your company has no unpaid tax obligations.",
    "JQ-01": "We check that the address on your application and the one in the trade register are the same place, "
             "even when they are written differently.",
    "JQ-02": "We check that the person who signed the application is the company's legal representative.",
    "GATE-01": "Only steps that are allowed at the current stage of your file are carried out.",
    "GATE-02": "Only a person at the bank can decide on your credit; the assistant never approves a loan.",
    "GATE-03": "We do not ask you for the same document twice while we are still waiting for it.",
    "SR-01": "Access to your file is limited and logged to keep your data safe.",
    "SR-02": "If you tell us you did not ask for a change to your details, the bank reviews it and contacts you.",
}

CLIENT_EVENT_TYPES = ("DOCUMENT_RECEIVED", "DOCUMENT_REQUESTED", "REMINDER_SENT", "CASE_STATUS",
                      "CLIENT_CONFIRMATION", "CLIENT_DISPUTE", "CLIENT_CONSENT")
EMPLOYEE_HIDDEN_EVENT_TYPES = ("AGENT_STEP", "CHAT_TURN")   # the trace goes through explain_step; chat is audit only
CLIENT_HIDDEN_EXCEPTION_KINDS = ("sequence_insider",)
CLIENT_EVENT_FALLBACK = {"DOCUMENT_RECEIVED": "A document was received", "DOCUMENT_REQUESTED": "The bank asked you for a document",
                         "REMINDER_SENT": "A reminder was sent to you", "CASE_STATUS": "Your file status changed"}
# Anything that looks internal is replaced by a neutral sentence before it can reach a client.
_INTERNAL_MARKER = re.compile(r"\b(?:HR|JQ|GATE|SR)-\d+\b|\bE-\d+\b|%|discrep|judge|analyst|complian|probab|insider|AMLR",
                              re.I)


# ----------------------------------------------------------------------------- helpers
def _role(role) -> str:
    if role not in ROLES:
        raise ValueError(f"role must be one of {ROLES}, got {role!r}")
    return role


def _day(iso: str) -> int:
    """Whole days since the case started (sim time)."""
    return (datetime.fromisoformat(iso) - CASE_START).days


def _int_or_none(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _client_safe(text: str, fallback: str) -> str:
    return fallback if _INTERNAL_MARKER.search(text or "") else text


def _client_case_event(status) -> str:
    return {"READY_FOR_DECISION": "Your file is complete and waiting for the bank's credit decision",
            "ON_HOLD": UNDER_REVIEW,
            "OPEN": "Your file is open again while the bank completes its checks"}.get(status, "Your file status changed")


def _client_answer_event(e: dict) -> str:
    """The client's own portal answers, in their words (the ledger summaries are written for the bank)."""
    if e["type"] == "CLIENT_CONFIRMATION":
        return "You confirmed the change to your contact details"
    if e["type"] == "CLIENT_DISPUTE":
        return "You told us you did not request the change to your contact details. Our team will contact you."
    return ("You gave consent for the credit history check" if e["payload"].get("granted")
            else "You did not give consent for the credit history check")


def _check_ids() -> set[str]:
    return {r["id"] for r in T.REQUIREMENTS}


def _request_seqs(case: Case) -> dict[str, int]:
    """Key of a document request -> seq of its latest DOCUMENT_REQUESTED event (for citations)."""
    return {e["payload"]["key"]: e["seq"] for e in case.ledger.events if e["type"] == "DOCUMENT_REQUESTED"}


def _visible_exceptions(st: dict, role: str, status: str | None = None) -> list[dict]:
    """Exceptions in raise order. Clients only see the ones about a client-facing check, never the insider card."""
    out = sorted(st["exceptions"].values(), key=lambda x: x["seq"])
    if status:
        out = [x for x in out if x["status"] == status]
    if role == "client":
        out = [x for x in out if x.get("requirement_id") in _check_ids() and x.get("kind") not in CLIENT_HIDDEN_EXCEPTION_KINDS]
    return out


def _pending_requests(st: dict) -> list[dict]:
    return sorted((r for r in st["requests"].values() if r["status"] == "PENDING"), key=lambda r: r["requested_at"])


# ----------------------------------------------------------------------------- views
def overview(case: Case, role: str) -> dict:
    """{"status_text", "day", "checks": [{"id", "title", "status_word"}], "open_items": int}"""
    role = _role(role)
    st = case.state()
    pending, open_ex = _pending_requests(st), _visible_exceptions(st, role, "OPEN")
    day = (st["now"] - CASE_START).days
    reqs = list(st["reqs"].values())
    if role == "employee":
        checks = [{"id": r["id"], "title": r["title"], "status_word": EMPLOYEE_STATUS_WORD.get(r["status"], r["status"]),
                   "reason": r["reason"], "seq": r["seq"] or None} for r in reqs]
        status_text = EMPLOYEE_CASE_TEXT.get(st["status"], st["status"].replace("_", " ").capitalize())
    else:
        checks = [{"id": r["id"], "title": CLIENT_CHECK_TITLE.get(r["id"], "Another check"),
                   "status_word": CLIENT_STATUS_WORD.get(r["status"], UNDER_REVIEW)} for r in reqs]
        if st["status"] == "READY_FOR_DECISION" and not _disputed(st):
            status_text = "Complete: waiting for the bank's credit decision"
        elif st["status"] == "READY_FOR_DECISION":
            status_text = UNDER_REVIEW
        elif st["status"] == "ON_HOLD":
            status_text = UNDER_REVIEW
        elif pending:
            status_text = "We need something from you"
        elif open_ex or any(CLIENT_STATUS_WORD.get(r["status"]) == UNDER_REVIEW for r in reqs):
            status_text = UNDER_REVIEW
        else:
            status_text = "We are checking your file"
    return {"status_text": status_text, "state": _state(st, pending, open_ex), "day": day, "checks": checks,
            "open_items": len(pending) + len(open_ex), "company": T.CLIENT_COMPANY, "product": T.PRODUCT}


def _disputed(st: dict) -> bool:
    """The client reported a change they did not make: a complete file is not 'complete' to them until it's settled.
    Read from state, not the role-filtered list: the client made this report themselves."""
    return any(x.get("kind") == "client_dispute" and x["status"] == "OPEN" for x in st["exceptions"].values())


def _state(st: dict, pending: list, open_ex: list) -> str:
    """needs_you | under_review | complete | in_progress (for UI tone and progress, same rule for both roles)."""
    if st["status"] == "READY_FOR_DECISION":
        return "under_review" if _disputed(st) else "complete"
    if st["status"] == "ON_HOLD":
        return "under_review"
    if pending:
        return "needs_you"
    if open_ex or any(r["status"] in ("CONTRADICTED", "NEEDS_REVIEW") for r in st["reqs"].values()):
        return "under_review"
    return "in_progress"


WHY_BY_DOC = {
    "application": "Your application tells us what financing you are asking for.",
    "financial_statement": "We check that the company's income comfortably covers its loan repayments.",
    "ubo_declaration": "The law requires us to know who ultimately owns or controls your company.",
    "id_card": "We must identify everyone who owns a significant share of the company.",
    "onrc_certificate": "It confirms your company is registered and active; it must be issued in the last 30 days.",
    "fiscal_certificate": "It shows your company has no outstanding tax debts.",
    "address_proof": "We need to confirm your company's registered office.",
    "signatory_mandate": "We need proof that the person who signed may act for the company.",
}


def missing_documents(case: Case, role: str) -> list[dict]:
    """Documents the bank asked for that have not arrived: [{"key", "label", "requested_day", "reminders", "next_reminder_day", "seq"}]."""
    _role(role)   # same facts for both roles: it is what the bank asked the client
    st = case.state()
    seqs = _request_seqs(case)
    out = []
    for r in _pending_requests(st):
        due = [t["due"] for t in st["timers"].values()
               if t["kind"] == "reminder" and t["status"] == "PENDING" and keys_match(t.get("key", ""), r["key"])]
        out.append({"key": r["key"], "label": r["label"], "why": WHY_BY_DOC.get(r["key"].partition(":")[0], ""),
                    "requested_day": _day(r["requested_at"]),
                    "reminders": r["reminders"], "next_reminder_day": _day(min(due)) if due else None,
                    "seq": seqs.get(r["key"])})
    return out


def _timeline_all(case: Case, role: str, since_day=None, until_day=None, types=None) -> list[dict]:
    role = _role(role)
    if isinstance(types, str):
        types = [types]
    wanted = set(types) if types else None
    since_day, until_day = _int_or_none(since_day), _int_or_none(until_day)
    out = []
    for e in case.ledger.events:
        t = e["type"]
        if (t not in CLIENT_EVENT_TYPES) if role == "client" else (t in EMPLOYEE_HIDDEN_EVENT_TYPES):
            continue
        if wanted is not None and t not in wanted:
            continue
        day = _day(e["sim_time"])
        if (since_day is not None and day < since_day) or (until_day is not None and day > until_day):
            continue
        if role == "client":
            what = (_client_case_event(e["payload"].get("status")) if t == "CASE_STATUS"
                    else _client_answer_event(e) if t.startswith("CLIENT_")
                    else _client_safe(e["summary"], CLIENT_EVENT_FALLBACK[t]))
        else:
            what = e["summary"]
        out.append({"seq": e["seq"], "day": day, "when": e["sim_time"], "type": t, "what": what})
    return out


def timeline(case: Case, role: str, since_day: int | None = None, types: list[str] | None = None,
             limit: int = 40, until_day: int | None = None) -> list[dict]:
    """[{"seq", "day", "when", "type", "what"}] in time order; the newest `limit` (max 200) events in the window.

    Clients see only document, reminder and status events. Employees see everything except the agent trace and
    chat audit events. `types` narrows the role's own set; it can never widen it. Use since_day / until_day to page.
    """
    n = max(1, min(_int_or_none(limit) or 40, 200))
    return _timeline_all(case, role, since_day, until_day, types)[-n:]


def visible_events(case: Case, role: str) -> dict[int, str]:
    """Every event this role may see, by seq (used to validate chat citations)."""
    return {e["seq"]: e["what"] for e in _timeline_all(case, role)}


def issues(case: Case, role: str, status: str = "all") -> list[dict]:
    """Open and resolved issues. `status` is "open", "resolved" or "all" (anything else means "all").

    Employee: {"id", "requirement_id", "title", "summary", "rule_id", "status", "notes", "judge", + seq, kind,
    severity, since_day, snippets, resolution}.
    Client: only {"what", "since_day"}: "Under review by the bank" per open check, plus one "we need X from you"
    entry (with the seq of the request) per pending document request. Nothing about the content of a review.
    """
    role = _role(role)
    want = str(status).lower() if str(status).lower() in ("open", "resolved") else "all"
    st = case.state()
    if role == "client":
        if want == "resolved":   # clients only ever see what is still open
            return []
        seqs = _request_seqs(case)
        out = [{"what": f"We need something from you: {r['label']}", "since_day": _day(r["requested_at"]),
                "seq": seqs.get(r["key"])} for r in _pending_requests(st)]
        out += [{"what": UNDER_REVIEW, "since_day": _day(x["created_at"])} for x in _visible_exceptions(st, role, "OPEN")]
        return out
    out = []
    for x in _visible_exceptions(st, role):
        state = "open" if x["status"] == "OPEN" else "resolved"
        if want != "all" and state != want:
            continue
        res = x.get("resolution")
        out.append({
            "id": x["id"], "requirement_id": x.get("requirement_id"), "title": x.get("title") or x.get("kind") or "Issue",
            "summary": x.get("summary") or "",
            "rule_id": (x.get("rule") or {}).get("id"), "status": state, "notes": list(x["notes"]),
            "judge": copy.deepcopy(x.get("judge")),
            "seq": x["seq"], "kind": x.get("kind"), "severity": x.get("severity"), "since_day": _day(x["created_at"]),
            "snippets": copy.deepcopy(x.get("snippets") or []),
            "resolution": ({"action_id": res["action_id"], "note": res.get("note", ""), "by": copy.deepcopy(res["by"]),
                            "seq": res["seq"], "day": _day(res["at"])} if res else None)})
    return out


def _owner_rows(ext: dict) -> list[tuple[str, str, str]]:
    rows = []
    for key, field in (("declared_owners", "declared_owner"), ("register_owners", "register_owner")):
        rows += [(field, f"{o['name']} {o['pct']:g}%", o["quote"]) for o in ext.get(key, [])]
    return rows


def _matches(query: str, *haystacks: str) -> bool:
    """Every query word appears somewhere, in any order: "Radu Pop" finds "POP RADU — 25%"."""
    words = norm_text(query).split()
    text = " ".join(norm_text(h) for h in haystacks)
    return bool(words) and all(w in text for w in words)


def document_fields(case: Case, role: str, doc_id: str | None = None, query: str | None = None) -> list[dict]:
    """Extracted fields with their verbatim quotes: [{"doc_id", "doc_name", "field", "value", "quote"}].

    `query` matches when all its words appear (any order, case and diacritics ignored) in field name, value
    or document name.
    Ownership lines (declared and register owners with their shares) are employee-only: they are the evidence
    behind an internal check, so clients get the plain fields only.
    """
    role = _role(role)
    st = case.state()
    q = (query or "").strip()
    out = []
    for did, doc in st["docs"].items():
        if doc_id and did.lower() != str(doc_id).strip().lower():
            continue
        ext = st["extractions"].get(did)
        if not ext:
            continue
        rows = [(f["field"], f["value"], f["quote"]) for f in ext.get("fields", [])]
        if role == "employee":
            rows += _owner_rows(ext)
        out += [{"doc_id": did, "doc_name": doc["name"], "field": field, "value": value, "quote": quote}
                for field, value, quote in rows if not q or _matches(q, field, value, doc["name"])]
    return out


def explain_step(case: Case, role: str, seq: int) -> dict:
    """Why the agent did something: {"seq", "tool", "reason", "gate", "input", "output"}. Employees only."""
    if _role(role) != "employee":
        return {"error": "not available"}
    try:
        seq = int(seq)
    except (TypeError, ValueError):
        return {"error": "seq must be an event number"}
    ev = next((e for e in case.ledger.events if e["seq"] == seq), None)
    if ev is None or ev["type"] != "AGENT_STEP":
        return {"error": f"event #{seq} is not an agent step"}
    p = ev["payload"]
    return {"seq": seq, "tool": p["tool"], "reason": p["reason"], "gate": p["gate"],
            "input": copy.deepcopy(p["input"]), "output": copy.deepcopy(p["output"])}


def explain_rule(rule_id: str, role: str) -> dict:
    """Employee: {"id", "text"} from template.RULES. Client: {"text"} in plain language, with no rule ID and no
    threshold (a rule ID in a client answer would point at internal rules)."""
    role = _role(role)
    rid = str(rule_id).strip().upper()
    if role == "employee":
        return {"id": rid, "text": T.RULES[rid]} if rid in T.RULES else {"error": f"unknown rule {rid}"}
    return {"text": CLIENT_RULE_TEXT[rid]} if rid in CLIENT_RULE_TEXT else {"error": "unknown rule"}


# ----------------------------------------------------------------------------- documents (portal + viewer)
EMPLOYEE_DOC_WORD = {"valid": "Valid", "expired": "Expired", "superseded": "Superseded", "quarantined": "Quarantined",
                     "unreadable": "Needs manual reading"}
CLIENT_DOC_WORD = {"expired": "Please send a new one", "superseded": "Replaced by a newer version",
                   "quarantined": "Not accepted", "unreadable": "Received, waiting for manual reading"}


def _doc_status(st: dict, d: dict) -> str:
    from .engine import doc_expired, doc_key
    if d.get("quarantined"):
        return "quarantined"
    if d.get("unreadable"):
        return "unreadable"
    if d["type"] != "email" and any(
            not x.get("quarantined") and x["id"] != d["id"] and x["type"] == d["type"]
            and keys_match(doc_key(x), doc_key(d)) and (x["issued_at"], x["seq"]) > (d["issued_at"], d["seq"])
            for x in st["docs"].values()):
        return "superseded"
    return "expired" if doc_expired(st, d) else "valid"


def _used_by(st: dict, doc_id: str) -> list[dict]:
    return [{"id": r["id"], "title": r["title"], "status_word": EMPLOYEE_STATUS_WORD.get(r["status"], r["status"])}
            for r in st["reqs"].values() if any(ev.get("doc_id") == doc_id for ev in r.get("evidence") or [])]


def _client_doc_word(st: dict, d: dict, status: str) -> str:
    if status != "valid":
        return CLIENT_DOC_WORD[status]
    used = [r for r in st["reqs"].values() if any(ev.get("doc_id") == d["id"] for ev in r.get("evidence") or [])]
    return "Verified" if used and all(r["status"] == "SATISFIED" for r in used) else "Received"


def documents(case: Case, role: str) -> list[dict]:
    """Every case document. Client: own uploads (no emails), client words, no internal links."""
    role = _role(role)
    st = case.state()
    out = []
    for d in sorted(st["docs"].values(), key=lambda x: x["seq"]):
        status = _doc_status(st, d)
        base = {"id": d["id"], "type": d["type"], "label": T.DOC_LABELS.get(d["type"], d["type"]), "name": d["name"],
                "issued_day": _day(d["issued_at"]), "received_day": _day(d["received_at"]), "status": status}
        if role == "client":
            if d["type"] == "email":
                continue
            out.append({**base, "status_word": _client_doc_word(st, d, status)})
        else:
            ext = _extraction_event(case, d["id"])
            out.append({**base, "status_word": EMPLOYEE_DOC_WORD[status], "person": d.get("person"),
                        "source": d.get("source", "scenario"), "used_by": _used_by(st, d["id"]),
                        "extractor": ext["payload"].get("extractor") if ext else None})
    return out


def _extraction_event(case: Case, doc_id: str) -> dict | None:
    return next((e for e in reversed(case.ledger.events)
                 if e["type"] == "FIELDS_EXTRACTED" and e["payload"].get("doc_id") == doc_id), None)


def _doc_history(case: Case, st: dict, d: dict) -> list[dict]:
    """Ledger events that touched this document, oldest first: [{"seq", "day", "type", "what"}]."""
    from .engine import doc_key
    key, doc_id, out = doc_key(d), d["id"], []
    expiry_timers = {e["payload"]["id"] for e in case.ledger.events
                     if e["type"] == "TIMER_SET" and e["payload"].get("doc_id") == doc_id}
    prior_request = max((e["seq"] for e in case.ledger.events if e["type"] == "DOCUMENT_REQUESTED"
                         and e["seq"] < d["seq"] and keys_match(e["payload"]["key"], key)), default=0)
    for e in case.ledger.events:
        p, t, what = e["payload"], e["type"], None
        if t == "DOCUMENT_REQUESTED" and e["seq"] == prior_request:
            what = f"Requested from the client: {p.get('label', key)}"
        elif t == "REMINDER_SENT" and prior_request < e["seq"] < d["seq"] and keys_match(p.get("key", ""), key):
            what = "Reminder sent to the client"
        elif t == "DOCUMENT_RECEIVED" and p.get("id") == doc_id:
            what = ("Received but not accepted: " + p.get("quarantine_reason", "quarantined")) if p.get("quarantined") \
                else f"Received ({p.get('source', 'scenario')})"
        elif t == "FIELDS_EXTRACTED" and p.get("doc_id") == doc_id:
            what = e["summary"]
        elif t == "REQUIREMENT_UPDATED" and any(ev.get("doc_id") == doc_id for ev in
                                                (p.get("evidence") or []) + ((p.get("details") or {}).get("snippets") or [])):
            what = f"Used as evidence: {p['req_id']} → {EMPLOYEE_STATUS_WORD.get(p['status'], p['status'])}"
        elif t == "EXCEPTION_RAISED" and any(s.get("doc_id") == doc_id for s in p.get("snippets") or []):
            what = f"Quoted on decision card {p['id']}: {p.get('title', '')}"
        elif t == "TIMER_SET" and p.get("doc_id") == doc_id:
            what = f"Validity ends day {_day(p['due'])}"
        elif t == "TIMER_FIRED" and p.get("id") in expiry_timers:
            what = "Validity window ended: expired"
        elif (t == "DOCUMENT_RECEIVED" and p.get("id") != doc_id and not p.get("quarantined") and e["seq"] > d["seq"]
              and p.get("type") == d["type"] and keys_match(doc_key(p), key) and d["type"] != "email"):
            what = f"Superseded by {p['id']} ({p['name']})"
        if what:
            out.append({"seq": e["seq"], "day": _day(e["sim_time"]), "type": t, "what": what})
    return out


CLIENT_HISTORY_TYPES = {"DOCUMENT_REQUESTED", "REMINDER_SENT", "DOCUMENT_RECEIVED", "FIELDS_EXTRACTED", "TIMER_FIRED"}


def _client_history(rows: list[dict]) -> list[dict]:
    words = {"DOCUMENT_REQUESTED": "The bank asked for this document", "REMINDER_SENT": "Reminder sent",
             "FIELDS_EXTRACTED": "Checked by the bank", "TIMER_FIRED": "No longer valid: please send a new one"}
    out = []
    for r in rows:
        if r["type"] not in CLIENT_HISTORY_TYPES:
            continue
        if r["type"] == "DOCUMENT_RECEIVED":
            what = ("Not accepted: it seems to be for another person" if "another person" in r["what"]
                    else "Not accepted: it seems to belong to another company" if r["what"].startswith("Received but not")
                    else "Replaced by your newer upload" if r["what"].startswith("Superseded")
                    else "Received")
        else:
            what = words[r["type"]]
        out.append({"day": r["day"], "what": what})
    return out


def document_detail(case: Case, role: str, doc_id: str) -> dict:
    """Employee: full text, fields with quotes, rejected quotes, used-by, validity, history. Client: own view."""
    role = _role(role)
    st = case.state()
    d = st["docs"].get(doc_id)
    if d is None or (role == "client" and d["type"] == "email"):
        raise KeyError(doc_id)
    status, history = _doc_status(st, d), _doc_history(case, st, d)
    if role == "client":
        return {"id": d["id"], "name": d["name"], "received_day": _day(d["received_at"]),
                "status_word": _client_doc_word(st, d, status), "text": d.get("text", ""),
                "history": _client_history(history)}
    from .engine import doc_expired
    from .rules import doc_expires_at
    ext = _extraction_event(case, doc_id)
    extraction = (ext or {}).get("payload", {}).get("extraction", {})
    fields = [{**{k: f[k] for k in ("field", "value", "quote")}, "verified": True} for f in extraction.get("fields", [])]
    for k in ("declared_owners", "register_owners"):
        fields += [{"field": k[:-1], "value": f"{o['name']} {o['pct']:g}%", "quote": o["quote"], "verified": True}
                   for o in extraction.get(k, [])]
    text = d.get("text", "")
    for f in fields:  # verified quotes are exact substrings, so offsets are exact (for highlighting)
        start = text.find(f["quote"])
        f["start"], f["end"] = (start, start + len(f["quote"])) if start >= 0 else (None, None)
    expires = (_day(doc_expires_at(datetime.fromisoformat(d["issued_at"])).isoformat())
               if d["type"] in T.EXPIRING_DOCS else None)
    return {"id": d["id"], "type": d["type"], "label": T.DOC_LABELS.get(d["type"], d["type"]), "name": d["name"],
            "text": d.get("text", ""), "status": status, "status_word": EMPLOYEE_DOC_WORD[status],
            "source": d.get("source", "scenario"), "extractor": (ext or {}).get("payload", {}).get("extractor"),
            "fields": fields, "rejected": list((ext or {}).get("payload", {}).get("unverified_quotes", [])),
            "injection_lines": list((ext or {}).get("payload", {}).get("injection_lines", [])),
            "used_by": _used_by(st, doc_id),
            "validity": None if status in ("quarantined", "unreadable") else  # never checked, so no validity window
                        {"issued_day": _day(d["issued_at"]), "expires_day": expires, "expired": doc_expired(st, d)},
            "quarantine_reason": _bank_quarantine_reason(d),
            "history": history}


def _bank_quarantine_reason(d: dict) -> str | None:
    """Bank-only wording: names the other company's tax ID, which the client never sees."""
    if not d.get("quarantined"):
        return None
    if d.get("quarantine_cui"):
        return (f"The tax ID on this document ({d['quarantine_cui']}) belongs to another company, "
                f"not to the applicant ({T.CASE_CUI}).")
    return f"Not accepted: {d.get('quarantine_reason', 'quarantined')}."


def version(case: Case) -> dict:
    """Cheap change detector for polling: ledger length + current case status."""
    status = next((e["payload"]["status"] for e in reversed(case.ledger.events) if e["type"] == "CASE_STATUS"), "OPEN")
    return {"length": len(case.ledger.events), "status": status}
