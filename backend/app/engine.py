"""Case engine: the ledger is the only source of truth; state = reduce(events).

Tools are the only way the agent touches a case. Every action tool passes the gate,
and every call is recorded as an AGENT_STEP (reason, tool, input, output, gate verdict).
"""
import re
from datetime import datetime, timedelta, timezone

from . import extract, extractors, learner, profiles, registry, rules, sequence
from . import template as T
from .judge import judge
from .ledger import Ledger
from .scenario import CASE_START, materialise

ENGINE = {"type": "system", "id": "engine"}
AGENT = {"type": "agent", "id": "case-agent"}
ANALYST = {"type": "analyst", "id": "analyst-1"}

ACTION_TOOLS = {"request_document", "send_reminder", "escalate_to_analyst", "start_legal_clock",
                "mark_ready_for_decision", "approve_credit"}


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s)


def _key_label(key: str) -> str:
    doc_type, _, person = key.partition(":")
    return f"{T.DOC_LABELS.get(doc_type, doc_type)}{' — ' + person if person else ''}"


# ----------------------------------------------------------------------------- reducer
def _initial_reqs(template_id: str) -> dict:
    active = T.TEMPLATES[template_id]["requirements"]
    return {r["id"]: {"id": r["id"], "title": r["title"], "status": "OPEN_WAITING",
                      "reason": "Waiting for: " + ", ".join(T.DOC_LABELS[d] for d in r["needs"]),
                      "rule_ids": r["rule_ids"], "evidence": [], "details": {}, "updated_at": None, "seq": 0}
            for r in T.REQUIREMENTS if r["id"] in active}


def reduce(events: list[dict]) -> dict:
    st = {"now": CASE_START, "status": "OPEN", "docs": {}, "extractions": {}, "registry": None,
          "template": "sme_loan", "profile": profiles.snapshot("aurora"), "reqs": _initial_reqs("sme_loan"),
          "exceptions": {}, "timers": {}, "requests": {}, "precedents": [], "trace": [], "delivered": set()}
    for e in events:
        p, st["now"] = e["payload"], max(st["now"], _dt(e["sim_time"]))
        match e["type"]:
            case "CASE_OPENED":
                st["template"] = "sme_loan" if p.get("template", "sme_loan") == "kyb_sme_v1" else p["template"]
                st["profile"] = p.get("profile") or st["profile"]
                st["reqs"] = _initial_reqs(st["template"])
            case "DOCUMENT_RECEIVED":
                doc = {**p, "received_at": e["sim_time"], "seq": e["seq"]}
                st["docs"][p["id"]] = doc
                for req in st["requests"].values():
                    if (req["status"] == "PENDING" and not p.get("quarantined") and not p.get("unreadable")
                            # a rejected or not-yet-readable upload fulfils nothing
                            and keys_match(req["key"], doc_key(doc))):
                        req["status"] = "FULFILLED"
            case "SCENARIO_DELIVERED":
                st["delivered"].add(p["item_id"])
            case "FIELDS_EXTRACTED":
                st["extractions"][p["doc_id"]] = p["extraction"]
            case "REGISTRY_CHECKED":
                st["registry"] = p
            case "REQUIREMENT_UPDATED":
                st["reqs"][p["req_id"]].update({k: p[k] for k in ("status", "reason", "rule_ids", "evidence", "details")},
                                               updated_at=e["sim_time"], by=e["actor"], seq=e["seq"])
            case "EXCEPTION_RAISED":
                st["exceptions"][p["id"]] = {**p, "status": "OPEN", "created_at": e["sim_time"], "notes": [], "seq": e["seq"]}
            case "EXCEPTION_ANNOTATED":
                if p["id"] in st["exceptions"]:
                    st["exceptions"][p["id"]]["notes"].append(p["note"])
            case "EXCEPTION_RESOLVED":
                ex = st["exceptions"][p["id"]]
                ex.update(status="RESOLVED", resolution={**p, "at": e["sim_time"], "by": e["actor"], "seq": e["seq"]})
                if ex["kind"] == "address_uncertain" and p["action_id"] == "same_address":
                    st["precedents"].append({"kind": "address", "a": ex["judge"]["a"], "b": ex["judge"]["b"],
                                             "postal": ex.get("postal"), "analyst": e["actor"].get("id"),
                                             "decision": "same_address", "exception_id": ex["id"], "seq": e["seq"]})
            case "TIMER_SET":
                st["timers"][p["id"]] = {**p, "status": "PENDING"}
            case "TIMER_FIRED" | "TIMER_CANCELLED":
                st["timers"][p["id"]]["status"] = "FIRED" if e["type"] == "TIMER_FIRED" else "CANCELLED"
            case "DOCUMENT_REQUESTED":
                st["requests"][p["key"]] = {**p, "status": "PENDING", "requested_at": e["sim_time"], "reminders": 0}
            case "REMINDER_SENT":
                st["requests"][p["key"]]["reminders"] += 1
            case "CASE_STATUS":
                st["status"] = p["status"]
            case "AGENT_STEP":
                st["trace"].append({"seq": e["seq"], "sim_time": e["sim_time"], "by": e["actor"].get("id"), **p})
    return st


CUI_RE = re.compile(r"(?:CUI|Cod unic de înregistrare)\s*:\s*(?:RO)?\s*(\d{2,10})", re.I)
DATE_RE = re.compile(r"Data(?: eliberării| declarației| cererii)?\s*:\s*(\d{2})\.(\d{2})\.(\d{4})")


EARLIEST_DOC_YEAR = 1990  # older "issue dates" on a KYB document are typos or forgeries


def _date_of(m: re.Match) -> datetime | None:
    day, month, year = (int(g) for g in m.groups())
    try:
        return datetime(year, month, day, 9, 0, tzinfo=timezone.utc)
    except ValueError:  # 31.02.2026, 00.13.2026
        return None


def _issued_from_text(text: str) -> datetime | None:
    m = DATE_RE.search(text or "")
    return _date_of(m) if m else None


def _date_problem(text: str, now: datetime) -> str | None:
    """SEC-04/05: the issue date comes from client-supplied text. It must be a real date, not later than the case's
    clock (a future date would keep a certificate valid for years), and not absurd (it would overflow expiry maths)."""
    m = DATE_RE.search(text or "")
    if not m:
        return None
    issued = _date_of(m)
    if issued is None or not EARLIEST_DOC_YEAR <= issued.year <= now.year + 1:
        return "its issue date is not a valid date"
    if issued.date() > now.date():
        return "its issue date is in the future"
    return None


def _quarantine_reason(doc_type: str, person: str, text: str, cui: str) -> str | None:
    """Another company's document, or an ID card for another person, is never used as evidence."""
    m = CUI_RE.search(text or "")
    if m and m.group(1) != cui:
        return "it shows another company's tax ID"  # the other firm's number stays out of every summary
    if doc_type == "id_card" and person:
        last = re.search(r"^Nume\s*:\s*(.+)$", text or "", re.M)
        first = re.search(r"^Prenume\s*:\s*(.+)$", text or "", re.M)
        if last and first and not rules.same_name_exact(f"{first.group(1)} {last.group(1)}", person):
            return "it is an identity card for another person"
    return None


def pending_confirmations(events: list[dict]) -> list[dict]:
    """What the client must confirm in the portal: the latest unanswered staff contact change, and bureau consent."""
    answered = {e["payload"].get("ref_seq") for e in events if e["type"] in ("CLIENT_CONFIRMATION", "CLIENT_DISPUTE")}
    out = []
    changes = [e for e in events if e["type"] == "STAFF_CONTACT_CHANGE" and e["seq"] not in answered]
    if changes:
        c = changes[-1]
        field, new = c["payload"].get("field", "contact details"), c["payload"].get("new")
        out.append({"kind": "contact_change", "ref_seq": c["seq"],
                    "text": f"We updated your {field}{f' to {new}' if new else ''}. Did you request this change?"})
    if profiles.template_of(events) == "sme_loan" and not any(e["type"] == "CLIENT_CONSENT" for e in events):
        out.append({"kind": "credit_check_consent", "ref_seq": None,
                    "text": "We need your consent to check your company's credit history with the Credit Bureau."})
    return out


def _internal_summary(spec: dict) -> str:
    p, who = spec["payload"], spec["actor"].get("id", "?")
    if spec["type"] == "STAFF_CONTACT_CHANGE":
        return f"Employee {who} changed client {p['client_id']} {p['field']}"
    if spec["type"] == "CREDIT_ACTION":
        return f"Employee {who} ran a {p['action'].replace('_', ' ')} for client {p['client_id']}"
    if spec["type"] == "CLIENT_CONFIRMATION":
        return f"Client {p['client_id']} confirmed the change by {p.get('channel', 'phone')}"
    return spec["type"].replace("_", " ").lower()


def doc_key(doc: dict) -> str:
    return f"id_card:{doc['person']}" if doc["type"] == "id_card" else doc["type"]


def keys_match(a: str, b: str) -> bool:
    """'id_card:POP RADU' (register spelling) matches 'id_card:Radu Pop' (ID card spelling)."""
    ta, _, pa = a.partition(":")
    tb, _, pb = b.partition(":")
    return ta == tb and (pa == pb or rules.same_name_exact(pa, pb))


def latest_doc(st: dict, doc_type: str) -> dict | None:
    docs = [d for d in st["docs"].values()
            if d["type"] == doc_type and not d.get("quarantined") and not d.get("unreadable")]
    return max(docs, key=lambda d: (d["issued_at"], d["seq"])) if docs else None


def doc_expired(st: dict, doc: dict) -> bool:
    return doc["type"] in T.EXPIRING_DOCS and not rules.doc_is_valid(_dt(doc["issued_at"]), st["now"])


# ----------------------------------------------------------------------------- gate
def needed_doc_keys(st: dict) -> list[str]:
    """Documents the file still needs, for this case's template (missing, expired, or asked for by a rule)."""
    keys = []
    for t in T.template_docs(st.get("template", "sme_loan")):
        d = latest_doc(st, t)
        if (d is None and t != "ubo_declaration") or (d is not None and doc_expired(st, d)):
            keys.append(t)
    none = {"details": {}}
    r2 = st["reqs"].get("R2", none)
    if "R2" in st["reqs"] and (r2["details"].get("kind") == "awaiting_corrected_declaration"
                               or latest_doc(st, "ubo_declaration") is None):
        keys.append("ubo_declaration")
    for name in r2["details"].get("owners_without_id", []):
        keys.append(f"id_card:{name.title()}")
    if st["reqs"].get("R3", none)["details"].get("kind") == "address_differs":
        keys.append("address_proof")
    if st["reqs"].get("R5", none)["details"].get("kind") == "signatory_differs":
        keys.append("signatory_mandate")
    return keys


def _pending(st: dict, key: str) -> bool:
    return any(r["status"] == "PENDING" and keys_match(r["key"], key) for r in st["requests"].values())


def allowed_actions(st: dict) -> list[dict]:
    """OPEN: everything below. ON_HOLD (compliance): legal clocks and escalations still run, nothing reaches the
    client and nothing moves the file forward. READY_FOR_DECISION: nothing (a regression reopens the file first)."""
    if st["status"] not in ("OPEN", "ON_HOLD"):
        return []
    on_hold = st["status"] == "ON_HOLD"
    acts, open_ex = [], {e["requirement_id"] for e in st["exceptions"].values() if e["status"] == "OPEN"}
    for key in ([] if on_hold else needed_doc_keys(st)):
        if not _pending(st, key):
            acts.append({"tool": "request_document", "params": {"key": key}})
    r2 = st["reqs"].get("R2", {"status": None})
    # one legal clock per discrepancy: a FIRED deadline is never silently restarted
    if r2["status"] == "CONTRADICTED" and not any(t["kind"] == "legal_deadline" and t["status"] in ("PENDING", "FIRED")
                                                  for t in st["timers"].values()):
        acts.append({"tool": "start_legal_clock", "params": {"req_id": "R2"}})
    for r in st["reqs"].values():
        if r["status"] in ("CONTRADICTED", "NEEDS_REVIEW") and r["id"] not in open_ex and not _already_decided(st, r):
            acts.append({"tool": "escalate_to_analyst", "params": {"req_id": r["id"]}})
    if (not on_hold and all(r["status"] == "SATISFIED" for r in st["reqs"].values()) and not open_ex
            and not needed_doc_keys(st)):
        acts.append({"tool": "mark_ready_for_decision", "params": {}})
    return acts


def _already_decided(st: dict, req: dict) -> bool:
    """An analyst already ruled on this requirement after its newest evidence arrived — don't escalate again."""
    needs = next(r["needs"] for r in T.REQUIREMENTS if r["id"] == req["id"])
    newest_doc = max((d["seq"] for d in st["docs"].values() if d["type"] in needs), default=0)
    return any(x["requirement_id"] == req["id"] and x["seq"] > newest_doc for x in st["exceptions"].values())


def _ruling(st: dict, req_id: str, after_seq: int) -> dict | None:
    """Latest analyst resolution for this requirement made after the given evidence."""
    res = [x for x in st["exceptions"].values() if x["requirement_id"] == req_id and x["status"] == "RESOLVED"
           and x["resolution"]["by"]["type"] == "analyst" and x["resolution"]["seq"] > after_seq]
    return res[-1] if res else None


def gate(st: dict, tool: str, params: dict) -> tuple[bool, str]:
    if tool not in ACTION_TOOLS:
        return True, "-"
    if tool == "approve_credit":
        return False, "DENY: GATE-02"
    if tool == "send_reminder":
        ok = st["status"] == "OPEN" and st["requests"].get(params.get("key"), {}).get("status") == "PENDING"
        return (True, "ALLOW") if ok else (False, "DENY: GATE-01")
    if tool == "request_document" and _pending(st, params.get("key", "")):
        return False, "DENY: GATE-03"
    wanted = {k: params.get(k) for k in ("key", "req_id") if k in params}
    if any(a["tool"] == tool and all(a["params"].get(k) == v for k, v in wanted.items()) for a in allowed_actions(st)):
        return True, "ALLOW"
    return False, "DENY: GATE-01"


# ----------------------------------------------------------------------------- case
class Case:
    def __init__(self, case_id: str, store=None, *, template: str = "sme_loan", profile_id: str = "aurora",
                 events: list[dict] | None = None):
        """A new case (opens its ledger), or with `events` a stored case reloaded as-is."""
        self.id = case_id
        self.ledger = Ledger(case_id, store, events)
        if events:
            st = self.state()
            self.now, self.template, self.profile = st["now"], st["template"], st["profile"]
            return
        self.now, self.template, self.profile = CASE_START, template, profiles.snapshot(profile_id, template)
        t = T.TEMPLATES[template]
        title = f"{t['title']} — {self.profile['name']}"
        self.emit("CASE_OPENED", ENGINE, {"title": title, "goal": t["goal"], "template": template, "profile": self.profile},
                  f"Case opened: {t['title']} for {self.profile['name']}")

    @property
    def client(self) -> dict:
        return {"type": "client", "id": self.profile.get("actor_id", self.profile["id"])}

    @property
    def scenario(self) -> list[dict]:
        return profiles.scenario_for(self.profile["id"], self.template)

    # --- low level
    def emit(self, type_: str, actor: dict, payload: dict, summary: str) -> dict:
        return self.ledger.append(type_, self.now, actor, payload, summary)

    def state(self) -> dict:
        return reduce(self.ledger.events)

    def _next_id(self, prefix: str, collection: str) -> str:
        return f"{prefix}-{len(self.state()[collection]) + 1}"

    # --- inbound world events
    def deliver(self, item_id: str) -> list[dict]:
        item = next(i for i in self.scenario if i["id"] == item_id)
        self.emit("SCENARIO_DELIVERED", ENGINE, {"item_id": item_id}, f"Inbound: {item['label']}")
        received = []
        for spec in item.get("events", []):  # internal bank events (staff actions), checked by sequence rules
            received.append(self.emit(spec["type"], spec["actor"], spec["payload"], _internal_summary(spec)))
            sequence.check(self)
        for doc in (materialise(item, self.now) if item.get("docs") else []):
            doc_id = self._next_id("doc", "docs")
            payload = {"id": doc_id, **doc}
            noun = "Email" if doc["type"] == "email" else "Document"
            received.append(self.emit("DOCUMENT_RECEIVED", self.client, payload, f"{noun} received: {doc['name']}"))
            self._cancel_reminders(payload)
        return received

    def _cancel_reminders(self, payload: dict) -> None:
        for t in self.state()["timers"].values():  # the document arrived: its reminder is moot
            if t["kind"] == "reminder" and t["status"] == "PENDING" and keys_match(t.get("key", ""), doc_key(payload)):
                self.emit("TIMER_CANCELLED", ENGINE, {"id": t["id"], "reason": "Document received"},
                          f"Timer cancelled: {t['label']}")

    def receive_upload(self, key: str, filename: str, text: str, pdf: dict | None = None) -> dict:
        """A client upload from the portal. Wrong company or wrong person: kept, but quarantined (fulfils nothing).
        A PDF is stored as received-but-unreadable until it is read (no extraction in the demo)."""
        doc_type, _, person = key.partition(":")
        name = T.DOC_LABELS.get(doc_type, doc_type) + (f" — {person}" if person else "")
        reason = _quarantine_reason(doc_type, person, text, self.profile["cui"])
        kind = "wrong_owner" if reason else None
        if not reason and not pdf and (reason := _date_problem(text, self.now)):
            kind = "bad_date"
        issued = None if reason else _issued_from_text(text)  # a rejected date is never stored as the issue date
        payload = {"id": self._next_id("doc", "docs"), "type": doc_type, "name": name, "text": text,
                   "issued_at": (issued or self.now).isoformat(), "source": "upload",
                   "filename": filename, **({"person": person} if person else {})}
        if reason:
            payload.update(quarantined=True, quarantine_reason=reason, quarantine_kind=kind)
            if (m := CUI_RE.search(text or "")) and m.group(1) != self.profile["cui"]:
                payload["quarantine_cui"] = m.group(1)  # for the bank's viewer only
        elif pdf:
            payload.update(unreadable=True, **pdf)
        summary = (f"Upload not accepted: {name} ({reason})" if reason else
                   f"PDF uploaded, waiting for manual reading: {name}" if pdf else f"Document uploaded by client: {name}")
        ev = self.emit("DOCUMENT_RECEIVED", self.client, payload, summary)
        if not (reason or pdf):
            self._cancel_reminders(payload)
        return ev

    def client_confirm(self, kind: str, answer: str) -> dict:
        """The client answers a portal confirmation; 'no' to a staff contact change raises a card for the bank."""
        item = next((c for c in pending_confirmations(self.ledger.events) if c["kind"] == kind), None)
        if item is None:
            raise ValueError("nothing to confirm")
        if kind == "credit_check_consent":
            return self.emit("CLIENT_CONSENT", self.client, {"scope": "credit_bureau", "granted": answer == "yes",
                                                       "channel": "portal"},
                             f"Client {'gave' if answer == 'yes' else 'refused'} consent for the credit bureau check")
        change = next(e for e in self.ledger.events if e["seq"] == item["ref_seq"])
        payload = {"client_id": change["payload"]["client_id"], "channel": "portal", "ref_seq": change["seq"]}
        if answer == "yes":
            ev = self.emit("CLIENT_CONFIRMATION", self.client, payload, "Client confirmed the contact change in the portal")
            for x in self.state()["exceptions"].values():
                if x["kind"] == "sequence_insider" and x["status"] == "OPEN" and x.get("first_seq") == change["seq"]:
                    self.emit("EXCEPTION_ANNOTATED", ENGINE, {"id": x["id"], "note": f"Client confirmed this change in "
                              f"the portal (#{ev['seq']}), after the credit action"}, f"Note added to {x['id']}")
            return ev
        ev = self.emit("CLIENT_DISPUTE", self.client, payload, "Client says they did not request the contact change")
        ex_id = self._next_id("EX", "exceptions")
        staff, field = change["actor"].get("id"), change["payload"].get("field", "contact details")
        self.emit("EXCEPTION_RAISED", ENGINE, {
            "id": ex_id, "requirement_id": "MON", "kind": "client_dispute", "severity": "high",
            "title": "Client says they did not request the contact change",
            "summary": f"Employee {staff} changed the client's {field} (#{change['seq']}); the client disputes it in the "
                       f"portal (#{ev['seq']}).",
            "rule": {"id": "SR-02", "text": T.RULES["SR-02"]},
            "snippets": [{"doc_id": None, "label": f"Ledger #{change['seq']}", "quote": change["summary"]},
                         {"doc_id": None, "label": f"Ledger #{ev['seq']}", "quote": ev["summary"]}],
            "judge": None, "first_seq": change["seq"], "then_seq": ev["seq"],
            "actions": [{"id": "escalate_compliance", "label": "Put on hold and escalate to compliance"},
                        {"id": "acknowledge", "label": "Acknowledge: the change was legitimate"}]},
            f"{ex_id} raised: client disputes a staff contact change")
        return ev

    def advance(self, days: float):
        """Generator: fires due timers in order (the caller lets the agent react to each), then lands on the target."""
        target = self.now + timedelta(days=days)
        while True:
            st = self.state()
            due = sorted((t for t in st["timers"].values() if t["status"] == "PENDING" and _dt(t["due"]) <= target),
                         key=lambda t: t["due"])
            if not due:
                break
            t = due[0]
            self.now = max(self.now, _dt(t["due"]))
            fired = self.emit("TIMER_FIRED", ENGINE, {"id": t["id"], "kind": t["kind"], "key": t.get("key"),
                                                      "req_id": t.get("req_id"), "label": t["label"], "cui": t.get("cui")},
                              f"Timer fired: {t['label']}")
            if t["kind"] == "doc_expiry" and t.get("req_id"):  # expiry is enforced by code, whatever the agent does
                try:
                    apply_result(self, t["req_id"], _evaluate(self.state(), t["req_id"]))
                except Exception as exc:
                    self.fail_closed(t["req_id"], exc)
            yield fired
        self.now = target
        self.emit("CLOCK_ADVANCED", ENGINE, {"days": days, "to": target.isoformat()}, f"Clock advanced {days:g} day(s)")

    def resolve(self, exception_id: str, action_id: str, note: str = "") -> dict:
        st = self.state()
        ex = st["exceptions"][exception_id]
        if ex["status"] != "OPEN" or action_id not in {a["id"] for a in ex["actions"]}:
            raise ValueError("exception not open or action not offered")
        ev = self.emit("EXCEPTION_RESOLVED", ANALYST, {"id": exception_id, "action_id": action_id, "note": note,
                                                       "requirement_id": ex["requirement_id"]},
                       f"Analyst resolved {exception_id}: {action_id}")
        if ex["kind"] in ("sequence_insider", "client_dispute") and action_id == "escalate_compliance":
            self.emit("CASE_STATUS", ENGINE, {"status": "ON_HOLD", "reason": f"Escalated to compliance ({exception_id})"},
                      f"File on hold: {exception_id} escalated to compliance")
        return ev

    def release_hold(self, by: str, note: str = "") -> dict:
        """Compliance clears the file: back to OPEN so the agent and the client flow resume."""
        if self.state()["status"] != "ON_HOLD":
            raise ValueError("file is not on hold")
        return self.emit("CASE_STATUS", {"type": "compliance", "id": by},
                         {"status": "OPEN", "reason": f"Hold released by compliance ({by})", "note": note},
                         f"Hold released by compliance ({by})")

    # --- tool execution (the agent's only door into the case)
    def run_tool(self, tool: str, params: dict, reason: str, actor: dict = AGENT) -> dict:
        st = self.state()
        ok, verdict = gate(st, tool, params)
        if ok:
            try:
                output = TOOLS[tool](self, **params)
            except registry.RegistryUnavailable as exc:
                output = {"error": str(exc)}
            except Exception as exc:  # bad input or a poison document: a logged failed step, never a crash (SEC-05)
                output = {"error": f"{type(exc).__name__}: {exc}"[:300]}
                if tool == "check_requirement":
                    self.fail_closed(params.get("req_id"), exc)
        else:
            output = {"blocked": T.RULES[verdict.split(": ")[1]]}
        self.emit("AGENT_STEP", actor, {"reason": reason, "tool": tool, "input": params, "output": output, "gate": verdict},
                  f"{tool} → {verdict}")
        return {"ok": ok, "gate": verdict, "output": output}

    def fail_closed(self, req_id, exc: Exception) -> None:
        """A rule check that cannot run never leaves its requirement SATISFIED: it needs a human (SEC-05, SEC-23)."""
        if req_id not in self.state()["reqs"]:
            return
        try:
            apply_result(self, req_id, {"status": "NEEDS_REVIEW", "reason": f"The rule check could not run on the "
                                        f"documents ({type(exc).__name__}); a person must review them",
                                        "evidence": [], "details": {"kind": "check_failed"}})
        except Exception:  # never let the safety path itself break the case
            pass


# ----------------------------------------------------------------------------- tools
def t_get_case_state(case: Case) -> dict:
    st = case.state()
    return {"template": T.TEMPLATES[st["template"]]["title"], "client": st["profile"]["name"],
            "status": st["status"], "now": st["now"].isoformat(),
            "requirements": {r["id"]: f"{r['status']}: {r['reason']}" for r in st["reqs"].values()},
            "open_exceptions": [e["id"] for e in st["exceptions"].values() if e["status"] == "OPEN"],
            "documents": [f"{d['id']} {d['type']} {d.get('person', '')}".strip() for d in st["docs"].values()]}


def t_get_allowed_actions(case: Case) -> list[dict]:
    return allowed_actions(case.state())


def t_get_document(case: Case, doc_id: str) -> dict:
    d = case.state()["docs"][doc_id]
    return {"id": d["id"], "type": d["type"], "name": d["name"], "issued_at": d["issued_at"], "text": d["text"]}


def t_extract_fields(case: Case, doc_id: str) -> dict:
    doc = case.state()["docs"][doc_id]
    ex, extractor = extractors.extract(doc["type"], doc["text"])
    unverified = extract.verify_quotes(doc["text"], ex)
    if unverified:  # a field whose quote is not in the document can never be used as evidence
        ex["fields"] = [f for f in ex["fields"] if f["quote"] not in unverified]
        for k in ("declared_owners", "register_owners"):
            if k in ex:
                ex[k] = [o for o in ex[k] if o["quote"] not in unverified]
    injections = extract.scan_injection(doc["text"])
    case.emit("FIELDS_EXTRACTED", AGENT, {"doc_id": doc_id, "extraction": ex, "unverified_quotes": unverified,
                                          "injection_lines": injections, "extractor": extractor},
              f"Extracted {len(ex['fields'])} fields from {doc['name']} via {extractor}"
              + (f"; rejected {len(unverified)} field(s) whose quote is not in the document" if unverified else
                 "; all quotes verified"))
    out = {"extractor": extractor, **{f["field"]: f["value"] for f in ex["fields"]}}
    if unverified:
        out["rejected_unverified_quotes"] = unverified
    for k in ("declared_owners", "register_owners"):
        if k in ex:
            out[k] = [f"{o['name']} {o['pct']:g}%" for o in ex[k]]
    out["quotes_verified"] = not unverified
    if injections:
        out["injection_flagged"] = injections
    return out


def t_lookup_registry(case: Case, cui: str) -> dict:
    try:
        res = registry.lookup(cui)
    except registry.RegistryUnavailable as exc:
        case.emit("REGISTRY_CHECKED", AGENT, {"cui": cui, "error": str(exc)}, "Trade register API unavailable")
        _set_timer(case, "registry_retry", (case.now + timedelta(days=1)).isoformat(), "Retry trade register API",
                   cui=cui, req_id="R1")
        raise
    case.emit("REGISTRY_CHECKED", AGENT, {"cui": cui, "result": res}, f"Trade register: {res.get('status')}")
    return res


def _ev(doc: dict, ext: dict, name: str) -> list[dict]:
    f = extract.field(ext, name)
    return [{"doc_id": doc["id"], "label": doc["name"], "field": name, "quote": f["quote"]}] if f else []


def _same_seat(a: str, b: str) -> bool:
    """Same street and number (the part before the first comma); city and county spellings vary between forms."""
    return rules.norm_text(a.split(",")[0]) == rules.norm_text(b.split(",")[0]) != ""


def _id_quote(d: dict) -> str:
    m = re.search(r"^Nume\s*:.*$", d.get("text") or "", re.M)
    return m.group(0) if m else d["name"]


def _evaluate(st: dict, req_id: str) -> dict:
    """Pure evaluation of one requirement against the current documents + rules."""
    X = st["extractions"]
    app, fin = latest_doc(st, "application"), latest_doc(st, "financial_statement")
    onrc, ubo, fisc = latest_doc(st, "onrc_certificate"), latest_doc(st, "ubo_declaration"), latest_doc(st, "fiscal_certificate")
    have = lambda d: d is not None and d["id"] in X
    wait = lambda *labels: {"status": "OPEN_WAITING", "reason": "Waiting for: " + ", ".join(labels), "evidence": [], "details": {}}

    if req_id == "R1":
        if not have(onrc):
            return wait(T.DOC_LABELS["onrc_certificate"])
        e, ev = X[onrc["id"]], []
        cui = extract.field(e, "cui")["value"]
        ev = _ev(onrc, e, "cui") + _ev(onrc, e, "status") + _ev(onrc, e, "issued")
        if doc_expired(st, onrc):
            return {"status": "EXPIRED", "reason": f"Certificate issued {onrc['issued_at'][:10]} is older than "
                    f"{T.DOC_VALIDITY_DAYS} days (HR-03)", "evidence": ev, "details": {"doc_id": onrc["id"]}}
        if not rules.cui_checksum_valid(cui):
            return {"status": "CONTRADICTED", "reason": f"CUI {cui} fails checksum (HR-01)", "evidence": ev, "details": {"kind": "bad_cui"}}
        reg = st["registry"]
        if not reg or reg.get("cui") != cui:
            return wait("trade register API check")
        if "error" in reg:
            return {"status": "OPEN_WAITING", "reason": "Waiting on external service: ONRC API unavailable — will retry",
                    "evidence": ev, "details": {}}
        if rules.norm_text(reg["result"]["status"]) != "activa":
            return {"status": "CONTRADICTED", "reason": f"Registry status {reg['result']['status']} (HR-02)", "evidence": ev,
                    "details": {"kind": "inactive"}}
        return {"status": "SATISFIED", "reason": f"CUI {cui} checksum valid; registry ACTIVE; certificate valid until "
                f"{rules.doc_expires_at(_dt(onrc['issued_at'])).date()}", "evidence": ev,
                "details": {"doc_id": onrc["id"], "expires_at": rules.doc_expires_at(_dt(onrc['issued_at'])).isoformat()}}

    if req_id == "R2":
        id_docs = [d for d in st["docs"].values()  # a quarantined or unread ID card identifies nobody
                   if d["type"] == "id_card" and not d.get("quarantined") and not d.get("unreadable")]
        ids = [d["person"] for d in id_docs]
        if not have(ubo):
            return wait(T.DOC_LABELS["ubo_declaration"])
        declared = X[ubo["id"]].get("declared_owners", [])
        ruling = _ruling(st, "R2", max(ubo["seq"], onrc["seq"] if onrc else 0))
        if ruling and ruling["resolution"]["action_id"] == "dismiss":  # dismissing waives the discrepancy, not the IDs
            reg_ubos = ([o for o in X[onrc["id"]].get("register_owners", []) if o["pct"] >= T.UBO_THRESHOLD_PCT]
                        if have(onrc) else [])
            missing_ids = rules.owners_without_id(reg_ubos, ids)
            if missing_ids:
                return {**wait(*[f"ID — {n.title()}" for n in missing_ids]),
                        "details": {"analyst_override": ruling["id"], "owners_without_id": missing_ids}}
            return {"status": "SATISFIED", "reason": f"Analyst dismissed the discrepancy ({ruling['id']}); owners have IDs",
                    "evidence": [], "details": {"analyst_override": ruling["id"], "decided_by": "analyst"}}
        if ruling and ruling["resolution"]["action_id"] == "confirm_discrepancy":
            missing = rules.owners_without_id([o for o in X[onrc['id']].get('register_owners', [])
                                               if o['pct'] >= T.UBO_THRESHOLD_PCT] if have(onrc) else [], ids)
            # the missing names are part of the reason, so an ID arriving first is recorded (no stale re-request)
            return {"status": "OPEN_WAITING", "reason": f"Discrepancy confirmed by analyst ({ruling['id']}); waiting for "
                    "a corrected UBO declaration" + (f" and IDs for {', '.join(n.title() for n in missing)}" if missing else ""),
                    "evidence": [], "details": {"kind": "awaiting_corrected_declaration", "owners_without_id": missing}}
        if not have(onrc):
            missing_ids = rules.owners_without_id([o for o in declared if o["pct"] >= T.UBO_THRESHOLD_PCT], ids)
            labels = [T.DOC_LABELS["onrc_certificate"]] + [f"ID — {n}" for n in missing_ids]
            return {**wait(*labels), "details": {"owners_without_id": missing_ids}}
        register = X[onrc["id"]].get("register_owners", [])
        res = rules.ubo_check(register, declared)
        if not res["ok"]:
            parts = [f"{o['name']} ({o['pct']:g}%) in register but not declared" for o in res["missing"]]
            parts += [f"{m['name']}: register {m['register_pct']:g}% vs declared {m['declared_pct']:g}%" for m in res["pct_mismatch"]]
            snippets = [{"doc_id": onrc["id"], "label": onrc["name"], "quote": "\n".join(o["quote"] for o in register)},
                        {"doc_id": ubo["id"], "label": ubo["name"], "quote": "\n".join(o["quote"] for o in declared)}]
            return {"status": "CONTRADICTED", "reason": "; ".join(parts) + " (HR-04)", "evidence": snippets,
                    "details": {"kind": "ubo_discrepancy", "snippets": snippets, "missing": [o["name"] for o in res["missing"]]}}
        missing_ids = rules.owners_without_id(res["ubos"], ids)
        if missing_ids:
            return {**wait(*[f"ID — {n.title()}" for n in missing_ids]), "details": {"owners_without_id": missing_ids}}
        return {"status": "SATISFIED", "reason": f"{len(res['ubos'])} beneficial owners match the register and have IDs",
                "evidence": [{"doc_id": ubo["id"], "label": ubo["name"], "quote": "\n".join(o["quote"] for o in declared)}]
                + [{"doc_id": d["id"], "label": d["name"], "quote": _id_quote(d)} for d in id_docs],  # HR-05 evidence
                "details": {}}

    if req_id == "R3":
        if not (have(onrc) and have(app)):
            return wait(*[T.DOC_LABELS[t] for t, d in (("onrc_certificate", onrc), ("application", app)) if not have(d)])
        ea, eo = X[app["id"]], X[onrc["id"]]
        ev = _ev(app, ea, "address") + _ev(onrc, eo, "address")
        pa, po = extract.field(ea, "postal_code")["value"], extract.field(eo, "postal_code")["value"]
        if not rules.postal_match(pa, po):
            return {"status": "CONTRADICTED", "reason": f"Postal code {pa} vs {po} (HR-06)", "evidence": ev,
                    "details": {"kind": "postal_mismatch"}}
        a, b = extract.field(ea, "address")["value"], extract.field(eo, "address")["value"]
        if rules.norm_text(a) == rules.norm_text(b):
            return {"status": "SATISFIED", "reason": "Addresses identical", "evidence": ev, "details": {}}
        prec = next((p for p in st["precedents"] if {rules.norm_text(p["a"]), rules.norm_text(p["b"])} ==
                     {rules.norm_text(a), rules.norm_text(b)}), None)
        if prec:
            fresh = prec["seq"] > max(app["seq"], onrc["seq"])
            reason = (f"Analyst ruled: same address ({prec['exception_id']})" if fresh else
                      f"Precedent {prec['exception_id']} reused: an analyst already ruled this address pair the same place")
            return {"status": "SATISFIED", "reason": reason, "evidence": ev,
                    "details": {"precedent": prec["exception_id"], **({"decided_by": "analyst"} if fresh else {})}}
        ruling = _ruling(st, "R3", max(app["seq"], onrc["seq"]))
        if ruling and ruling["resolution"]["action_id"] == "different_address":
            proof = latest_doc(st, "address_proof")
            if proof and have(proof) and proof["seq"] > ruling["resolution"]["seq"]:
                ep = X[proof["id"]]
                pp = (extract.field(ep, "postal_code") or {}).get("value", "")
                if _same_seat((extract.field(ep, "address") or {}).get("value", ""), b) and rules.postal_match(pp, po):
                    return {"status": "SATISFIED", "reason": f"Proof of registered office ({proof['id']}) matches the "
                            "trade register", "evidence": ev + _ev(proof, ep, "address"),
                            "details": {"doc_id": proof["id"], "decided_by": "analyst"}}
            return {"status": "CONTRADICTED", "reason": f"Analyst ruled the addresses differ ({ruling['id']}); "
                    "client must clarify the registered office", "evidence": ev, "details": {"kind": "address_differs"}}
        learned = learner.promoted_check_for(a, b, pa, po)
        if learned:
            return {"status": "SATISFIED", "reason": f"Learned check {learned['id']} (promoted by {learned['promoted_by']}): "
                    "same street, number, city and postal code; only the street type differs", "evidence": ev,
                    "details": {"learned_check": learned["id"]}}
        j = judge("address", a, b)
        if j["auto_accept"]:
            return {"status": "SATISFIED", "reason": f"Postal codes match; judge and similarity check agree: same address "
                    f"(p={j['p_top']}, {j['second_opinion']['p_same']})",
                    "evidence": ev, "details": {"judge": j}}
        return {"status": "NEEDS_REVIEW", "reason": f"Postal codes match but judge is unsure "
                f"(same {j['probs'].get('same_address')} / different {j['probs'].get('different_address')}, "
                f"threshold {j['threshold']})", "evidence": ev,
                "details": {"kind": "address_uncertain", "judge": j, "snippets": ev, "postal": [pa, po]}}

    if req_id == "R4":
        if not (have(app) and have(fin)):
            return wait(*[T.DOC_LABELS[t] for t, d in (("application", app), ("financial_statement", fin)) if not have(d)])
        ea, ef = X[app["id"]], X[fin["id"]]
        ebitda, existing = extract.amount(ef, "ebitda"), extract.amount(ef, "existing_annual_debt_service")
        new = extract.amount(ea, "new_annual_debt_service")
        ev = _ev(fin, ef, "ebitda") + _ev(fin, ef, "existing_annual_debt_service") + _ev(app, ea, "new_annual_debt_service")
        # SEC-06: a missing or unreadable amount is never 0, and debt service must be a positive amount
        missing = [n for n, v in (("EBITDA", ebitda), ("existing annual debt service", existing),
                                  ("new annual debt service", new)) if v is None]
        if missing or existing < 0 or new < 0 or existing + new <= 0:
            why = (f"{', '.join(missing)} missing or unreadable" if missing else "debt service must be a positive amount")
            return {"status": "NEEDS_REVIEW", "reason": f"DSCR cannot be computed: {why} (HR-07)", "evidence": ev,
                    "details": {"kind": "dscr_unreadable", "snippets": ev}}
        value = rules.dscr(ebitda, existing, new)
        status = "SATISFIED" if rules.dscr_ok(value) else "CONTRADICTED"
        return {"status": status, "reason": f"DSCR = {ebitda:,.0f} / ({existing:,.0f} + {new:,.0f}) = {value} "
                f"({'≥' if status == 'SATISFIED' else '<'} {T.DSCR_MIN})", "evidence": ev,
                "details": {"kind": "dscr", "dscr": value}}

    if req_id == "R5":
        if not (have(onrc) and have(app)):
            return wait(*[T.DOC_LABELS[t] for t, d in (("onrc_certificate", onrc), ("application", app)) if not have(d)])
        ea, eo = X[app["id"]], X[onrc["id"]]
        s, adm = extract.field(ea, "signatory")["value"], extract.field(eo, "administrator")["value"]
        ev = _ev(app, ea, "signatory") + _ev(onrc, eo, "administrator")
        ruling = _ruling(st, "R5", max(app["seq"], onrc["seq"]))
        if ruling and ruling["resolution"]["action_id"] == "same_person":
            return {"status": "SATISFIED", "reason": f"Analyst confirmed signatory = administrator ({ruling['id']})",
                    "evidence": ev, "details": {"decided_by": "analyst"}}
        if ruling and ruling["resolution"]["action_id"] == "different_person":
            mandate = latest_doc(st, "signatory_mandate")
            if mandate and have(mandate) and mandate["seq"] > ruling["resolution"]["seq"]:
                em = X[mandate["id"]]
                agent_of = (extract.field(em, "authorized_person") or {}).get("value", "")
                granted_by = (extract.field(em, "administrator") or {}).get("value", "")
                if rules.same_name_exact(agent_of, s) and rules.same_name_exact(granted_by, adm):
                    return {"status": "SATISFIED", "reason": f"Signatory acts under a mandate from the administrator "
                            f"({mandate['id']})", "evidence": ev + _ev(mandate, em, "authorized_person"),
                            "details": {"doc_id": mandate["id"], "decided_by": "analyst"}}
            return {"status": "CONTRADICTED", "reason": f"Analyst ruled the signatory is not the administrator ({ruling['id']}); "
                    "a signed mandate is required", "evidence": ev, "details": {"kind": "signatory_differs"}}
        j = judge("person", s, adm)
        if j["auto_accept"]:
            return {"status": "SATISFIED", "reason": f"Signatory = administrator (judge p={j['p_top']}, similarity "
                    f"{j['second_opinion']['p_same']})", "evidence": ev,
                    "details": {"judge": j}}
        return {"status": "NEEDS_REVIEW", "reason": f"Signatory vs administrator unclear (p_same={j['probs'].get('same_person')})",
                "evidence": ev, "details": {"kind": "signatory_uncertain", "judge": j, "snippets": ev}}

    if req_id == "R6":
        if not have(fisc):
            return wait(T.DOC_LABELS["fiscal_certificate"])
        ef = X[fisc["id"]]
        ev = _ev(fisc, ef, "outstanding_obligations") + _ev(fisc, ef, "issued")
        if doc_expired(st, fisc):
            return {"status": "EXPIRED", "reason": f"Fiscal certificate older than {T.DOC_VALIDITY_DAYS} days (HR-03)",
                    "evidence": ev, "details": {"doc_id": fisc["id"]}}
        owed = extract.field(ef, "outstanding_obligations")["value"]
        if not rules.fiscal_clean(owed):
            return {"status": "CONTRADICTED", "reason": f"Outstanding tax obligations: {owed} (HR-08)", "evidence": ev,
                    "details": {"kind": "tax_debt"}}
        return {"status": "SATISFIED", "reason": "No outstanding tax obligations; certificate valid", "evidence": ev,
                "details": {"doc_id": fisc["id"], "expires_at": rules.doc_expires_at(_dt(fisc['issued_at'])).isoformat()}}
    raise KeyError(req_id)


def t_check_requirement(case: Case, req_id: str) -> dict:
    res = _evaluate(case.state(), req_id)
    apply_result(case, req_id, res)
    return {"status": res["status"], "reason": res["reason"]}


def apply_result(case: Case, req_id: str, res: dict) -> None:
    """Record a rule evaluation plus its deterministic side effects. Owned by code (actor = engine), not by the model."""
    st = case.state()
    cur = st["reqs"][req_id]
    if (cur["status"], cur["reason"]) != (res["status"], res["reason"]):
        case.emit("REQUIREMENT_UPDATED", ENGINE, {"req_id": req_id, "rule_ids": cur["rule_ids"], **res},
                  f"{req_id} → {res['status']}")
        if st["status"] == "READY_FOR_DECISION" and res["status"] != "SATISFIED":  # a ready file can regress
            case.emit("CASE_STATUS", ENGINE, {"status": "OPEN", "reason": f"{req_id} is {res['status']}"},
                      f"File reopened: {req_id} is {res['status'].lower().replace('_', ' ')}")
    st = case.state()
    doc_id = res["details"].get("doc_id")
    if res["status"] == "SATISFIED" and doc_id and res["details"].get("expires_at") and not any(
            t["kind"] == "doc_expiry" and t.get("doc_id") == doc_id for t in st["timers"].values()):
        _set_timer(case, "doc_expiry", res["details"]["expires_at"], f"{T.DOC_LABELS[st['docs'][doc_id]['type']]} expires",
                   doc_id=doc_id, req_id=req_id)
    if (req_id == "R2" and res["status"] != "CONTRADICTED"  # a failed check never cancels the legal clock
            and res["details"].get("kind") not in ("awaiting_corrected_declaration", "check_failed")):
        why = (f"Analyst dismissed the discrepancy ({res['details']['analyst_override']})"
               if res["details"].get("analyst_override") else "Declaration corrected — register and bank data agree")
        for t in st["timers"].values():
            if t["kind"] == "legal_deadline" and t["status"] == "PENDING":
                case.emit("TIMER_CANCELLED", ENGINE, {"id": t["id"], "reason": why}, f"Timer cancelled: {t['label']}")
    if res["status"] == "SATISFIED":
        for x in st["exceptions"].values():
            if x["requirement_id"] == req_id and x["status"] == "OPEN":
                case.emit("EXCEPTION_RESOLVED", ENGINE, {"id": x["id"], "action_id": "superseded", "requirement_id": req_id,
                                                         "note": "Rule now passes on newer documents"},
                          f"{x['id']} closed: superseded by newer documents")


def _set_timer(case: Case, kind: str, due_iso: str, label: str, **extra) -> str:
    tid = case._next_id("T", "timers")
    case.emit("TIMER_SET", ENGINE, {"id": tid, "kind": kind, "due": due_iso, "label": label, **extra}, f"Timer set: {label}")
    return tid


def t_request_document(case: Case, key: str, note: str = "") -> dict:
    label = _key_label(key)
    case.emit("DOCUMENT_REQUESTED", AGENT, {"key": key, "label": label, "note": note}, f"Requested from client: {label}")
    due = (case.now + timedelta(days=T.REMINDER_AFTER_DAYS)).isoformat()
    _set_timer(case, "reminder", due, f"Reminder if {label} not received", key=key)
    return {"requested": label, "reminder_due": due[:10]}


def t_send_reminder(case: Case, key: str) -> dict:
    label = _key_label(key)
    case.emit("REMINDER_SENT", AGENT, {"key": key}, f"Reminder sent to client: {label}")
    due = (case.now + timedelta(days=T.REMINDER_AFTER_DAYS)).isoformat()
    _set_timer(case, "reminder", due, f"Next reminder: {label}", key=key)
    return {"reminded": label}


def t_start_legal_clock(case: Case, req_id: str) -> dict:
    due = (case.now + timedelta(days=T.AMLR_REPORT_DAYS)).isoformat()
    _set_timer(case, "legal_deadline", due, "AMLR — report register discrepancy", req_id=req_id)
    return {"deadline": due[:10], "rule": "HR-04"}


def t_escalate_to_analyst(case: Case, req_id: str, summary: str = "") -> dict:
    st = case.state()
    req = st["reqs"][req_id]
    d = req["details"]
    kind = d.get("kind", "generic")
    cards = {
        "ubo_discrepancy": ("high", "Beneficial-owner discrepancy vs trade register",
                            [{"id": "confirm_discrepancy", "label": "Confirm discrepancy and request a corrected declaration"},
                             {"id": "dismiss", "label": "Dismiss: the documents agree"}]),
        "address_uncertain": ("medium", "Registered office: same place?",
                              [{"id": "same_address", "label": "Same address, only formatting differs"},
                               {"id": "different_address", "label": "Different address, ask the client"}]),
        "signatory_uncertain": ("medium", "Signatory: same person as the administrator?",
                                [{"id": "same_person", "label": "Same person"},
                                 {"id": "different_person", "label": "Different person, ask for a mandate"}]),
    }
    decision = T.TEMPLATES[st["template"]]["decision"]
    noted = [{"id": "acknowledge", "label": f"Noted: keep this finding for the {decision}"}]
    cards |= {  # hard-rule failures: the card names the problem, not the requirement it fails
        "tax_debt": ("high", "Outstanding tax debt on the ANAF certificate", noted),
        "inactive": ("high", "Company is not active in the trade register", noted),
        "bad_cui": ("high", "Tax ID fails the official checksum", noted),
        "dscr": ("medium", f"Debt service coverage below {T.DSCR_MIN}", noted),
        "dscr_unreadable": ("medium", "Debt service coverage cannot be computed from the documents", noted),
    }
    severity, title, actions = cards.get(kind, ("medium", f"Check failed: {req['title']}", noted))
    # the rule the card cites is the one that failed, not the first rule of the requirement
    rule_id = {"bad_cui": "HR-01", "inactive": "HR-02", "ubo_discrepancy": "HR-04", "postal_mismatch": "HR-06",
               "address_differs": "HR-06", "dscr": "HR-07", "dscr_unreadable": "HR-07", "tax_debt": "HR-08", "address_uncertain": "JQ-01",
               "signatory_uncertain": "JQ-02", "signatory_differs": "JQ-02"}.get(
        kind, next((r for r in req["rule_ids"] if r.startswith("HR")), req["rule_ids"][0]))
    ex_id = case._next_id("EX", "exceptions")
    judge_view = None
    if d.get("judge"):
        judge_view = {"question": d["judge"]["question"], "probs": d["judge"]["probs"], "threshold": d["judge"]["threshold"],
                      "source": d["judge"]["source"], "a": d["judge"]["a"], "b": d["judge"]["b"],
                      "second_opinion": d["judge"].get("second_opinion"), "auto_accept": d["judge"].get("auto_accept")}
    case.emit("EXCEPTION_RAISED", AGENT, {
        "id": ex_id, "requirement_id": req_id, "kind": kind, "severity": severity, "title": title,
        "summary": summary or req["reason"], "rule": {"id": rule_id, "text": T.RULES[rule_id]},
        "snippets": d.get("snippets", req["evidence"]), "judge": judge_view, "actions": actions,
        **({"postal": d["postal"]} if d.get("postal") else {})}, f"{ex_id} raised for {req_id}: {title}")
    return {"exception": ex_id, "title": title}


def t_mark_ready_for_decision(case: Case) -> dict:
    decision = T.TEMPLATES[case.template]["decision"]
    case.emit("CASE_STATUS", AGENT, {"status": "READY_FOR_DECISION"}, f"File complete — ready for the human {decision}")
    return {"status": "READY_FOR_DECISION"}


def t_annotate_exception(case: Case, exception_id: str, note: str) -> dict:
    if exception_id not in case.state()["exceptions"]:
        raise KeyError(f"unknown exception {exception_id}")
    case.emit("EXCEPTION_ANNOTATED", AGENT, {"id": exception_id, "note": note}, f"Note added to {exception_id}")
    return {"annotated": exception_id}


def t_classify_email(case: Case, doc_id: str) -> dict:
    return classify_text(case.state()["docs"][doc_id]["text"])


def t_classify_message(case: Case, seq: int) -> dict:
    e = next(e for e in case.ledger.events if e["seq"] == int(seq) and e["type"] == "MESSAGE_POSTED")
    return classify_text(e["payload"]["text"])


def classify_text(raw: str) -> dict:
    text = rules.norm_text(raw)
    if any(w in text for w in ("asociat", "actionariat", "beneficiar real", "shareholder", "new owner", "co owner")):
        return {"intent": "ownership_change", "affects": "R2"}
    if any(w in text for w in ("adresa", "sediu")):
        return {"intent": "address_change", "affects": "R3"}
    return {"intent": "other", "affects": None}


def t_approve_credit(case: Case) -> dict:  # never reachable: the gate always denies it (GATE-02)
    raise RuntimeError("approve_credit must never execute")


TOOLS = {
    "get_case_state": t_get_case_state, "get_allowed_actions": t_get_allowed_actions, "get_document": t_get_document,
    "extract_fields": t_extract_fields, "lookup_registry": t_lookup_registry, "check_requirement": t_check_requirement,
    "classify_email": t_classify_email, "classify_message": t_classify_message, "annotate_exception": t_annotate_exception,
    "request_document": t_request_document, "send_reminder": t_send_reminder, "start_legal_clock": t_start_legal_clock,
    "escalate_to_analyst": t_escalate_to_analyst, "mark_ready_for_decision": t_mark_ready_for_decision,
    "approve_credit": t_approve_credit,
}
