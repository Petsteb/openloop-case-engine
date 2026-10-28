"""Role-scoped, read-only case views: the client allow-list must never leak internal review details."""
import json
import os
import re

os.environ["AGENT_MODE"] = "scripted"
os.environ["JUDGE_MODE"] = "heuristic"

import pytest  # noqa: E402

from app import template as T  # noqa: E402
from app.agent import ScriptedAgent  # noqa: E402
from app.case_views import (CLIENT_RULE_TEXT, document_fields, explain_rule, explain_step, issues,  # noqa: E402
                            missing_documents, overview, timeline)
from app.engine import ENGINE, Case  # noqa: E402

CLIENT_EVENT_TYPES = {"DOCUMENT_RECEIVED", "DOCUMENT_REQUESTED", "REMINDER_SENT", "CASE_STATUS"}
# Words and patterns that must never reach the client, whatever the view.
CLIENT_BANNED = ("Radu", "discrep", "%", "judge", "note", "HR-", "JQ-", "GATE-", "SR-", "E-0317", "analyst", "complian")


def _case_at(*items):
    case, agent = Case("views-test"), ScriptedAgent()
    for item in items:
        for ev in case.deliver(item):
            agent.handle(case, ev)
    return case


def _to_triage():
    return _case_at("day0-pack", "onrc-cert")


def _add_insider_hold(case):
    """Stand-in for Task 2: the events a SR-01 hit would leave in the ledger (raw emits, as a test fixture)."""
    emp = {"type": "employee", "id": "E-0317"}
    case.emit("STAFF_CONTACT_CHANGE", emp, {"client_id": "C-1042", "field": "phone", "old": "0721", "new": "0799"},
              "Employee E-0317 changed the phone of C-1042")
    case.emit("CREDIT_ACTION", emp, {"client_id": "C-1042", "action": "credit_bureau_query"},
              "Employee E-0317 ran a credit bureau query for C-1042")
    case.emit("EXCEPTION_RAISED", ENGINE, {
        # only the keys the plan guarantees for the SR-01 card: no title, no summary
        "id": "EX-99", "requirement_id": "MON", "kind": "sequence_insider", "severity": "high",
        "rule": {"id": "SR-01", "text": "An employee changed the client's contact details and then started a credit action."},
        "snippets": [{"quote": "Employee E-0317 changed the phone of C-1042"}], "judge": None,
        "actions": [{"id": "escalate_compliance", "label": "Put on hold and escalate to compliance"}]},
        "EX-99 raised for MON: sequence_insider")
    case.emit("CASE_STATUS", ENGINE, {"status": "ON_HOLD"}, "Case put on hold: SR-01 escalated to compliance (E-0317)")
    case.emit("CHAT_TURN", {"type": "employee", "id": "chat"}, {"role": "employee", "question": "q", "tools": [],
                                                                "answer_sha256": "0"}, "Chat turn (employee)")


def test_client_issue_view_hides_internal_details():
    case = _to_triage()
    out = issues(case, "client")
    assert out and any(i["what"] == "Under review by the bank" for i in out)   # not vacuous
    assert any(i["what"].startswith("We need something from you") for i in out)   # pending requests are listed
    blob = json.dumps(out, ensure_ascii=False)
    for banned in CLIENT_BANNED:
        assert banned not in blob, banned
    # every client view, not only issues, stays clean
    for view in (overview(case, "client"), missing_documents(case, "client"), timeline(case, "client")):
        blob = json.dumps(view, ensure_ascii=False)
        for banned in CLIENT_BANNED:
            assert banned not in blob, (banned, view)


def test_employee_issue_view_is_complete():
    case = _to_triage()
    out = issues(case, "employee")
    ubo = next(i for i in out if i["requirement_id"] == "R2")
    assert {"id", "requirement_id", "title", "summary", "rule_id", "status", "notes", "judge"} <= set(ubo)
    assert ubo["summary"] and ubo["rule_id"] == "HR-04" and ubo["status"] == "open"
    addr = next(i for i in out if i["requirement_id"] == "R3")
    assert addr["rule_id"] == "JQ-01" and addr["judge"]["probs"]
    assert addr["judge"]["threshold"] in (T.JUDGE_THRESHOLD, T.HEURISTIC_THRESHOLD)
    assert addr["judge"]["second_opinion"]["threshold"] == T.HEURISTIC_THRESHOLD
    assert ubo["judge"] is None and ubo["notes"] == []
    # status filter, and a resolved issue keeps its ruling
    ScriptedAgent().handle(case, case.resolve(addr["id"], "same_address"))
    assert [i["id"] for i in issues(case, "employee", "open")] == [ubo["id"]]
    done = issues(case, "employee", "resolved")
    assert [i["id"] for i in done] == [addr["id"]] and done[0]["resolution"]["action_id"] == "same_address"
    assert {i["id"] for i in issues(case, "employee")} == {ubo["id"], addr["id"]}


def test_missing_documents_lists_pending_requests():
    case = _case_at("day0-pack")
    for role in ("client", "employee"):
        out = missing_documents(case, role)
        assert {"onrc_certificate", "fiscal_certificate"} <= {d["key"] for d in out}
    onrc = next(d for d in missing_documents(case, "client") if d["key"] == "onrc_certificate")
    assert onrc["label"] == T.DOC_LABELS["onrc_certificate"]
    assert (onrc["requested_day"], onrc["reminders"], onrc["next_reminder_day"]) == (0, 0, T.REMINDER_AFTER_DAYS)
    agent = ScriptedAgent()
    for fired in case.advance(T.REMINDER_AFTER_DAYS):
        agent.handle(case, fired)
    onrc = next(d for d in missing_documents(case, "client") if d["key"] == "onrc_certificate")
    assert (onrc["reminders"], onrc["next_reminder_day"]) == (1, 2 * T.REMINDER_AFTER_DAYS)
    for ev in case.deliver("onrc-cert"):
        agent.handle(case, ev)
    assert "onrc_certificate" not in {d["key"] for d in missing_documents(case, "client")}   # fulfilled


def test_timeline_client_hides_internal_events():
    case = _to_triage()
    _add_insider_hold(case)
    type_of = {e["seq"]: e["type"] for e in case.ledger.events}
    cl = timeline(case, "client")
    seen = {type_of[i["seq"]] for i in cl}
    assert "DOCUMENT_RECEIVED" in seen and seen <= CLIENT_EVENT_TYPES   # no AGENT_STEP, EXCEPTION_*, STAFF_*
    assert timeline(case, "client", types=["AGENT_STEP", "EXCEPTION_RAISED", "STAFF_CONTACT_CHANGE"]) == []
    assert all(isinstance(i["day"], int) and isinstance(i["when"], str) and i["what"] for i in cl)
    hold = [i for i in cl if type_of[i["seq"]] == "CASE_STATUS"][-1]
    assert hold["what"] == "Under review by the bank"   # the raw ON_HOLD summary names SR-01 and the employee
    emp = timeline(case, "employee", limit=200)
    emp_types = {type_of[i["seq"]] for i in emp}
    assert not emp_types & {"AGENT_STEP", "CHAT_TURN"}
    assert {"EXCEPTION_RAISED", "STAFF_CONTACT_CHANGE", "CREDIT_ACTION", "DOCUMENT_RECEIVED"} <= emp_types
    by_seq = {e["seq"]: e for e in case.ledger.events}
    assert all(i["what"] == by_seq[i["seq"]]["summary"] and i["when"] == by_seq[i["seq"]]["sim_time"] for i in emp)
    # employees can't use `types` to reach the agent trace either
    assert timeline(case, "employee", types=["AGENT_STEP", "CHAT_TURN"]) == []


def test_timeline_filters_by_day_and_limit():
    case = _case_at("day0-pack")
    agent = ScriptedAgent()
    for fired in case.advance(T.REMINDER_AFTER_DAYS):
        agent.handle(case, fired)
    late = timeline(case, "client", since_day=T.REMINDER_AFTER_DAYS)
    assert late and all(i["day"] >= T.REMINDER_AFTER_DAYS for i in late)
    assert len(timeline(case, "client", since_day=T.REMINDER_AFTER_DAYS + 50)) == 0
    allv = timeline(case, "employee", limit=200)
    last2 = timeline(case, "employee", limit=2)
    assert [i["seq"] for i in last2] == [i["seq"] for i in allv][-2:]   # newest events, still in time order


def test_document_field_search_returns_verbatim_quote():
    case = _case_at("day0-pack")
    docs = case.state()["docs"]
    for role in ("employee", "client"):
        out = document_fields(case, role, query="EBITDA")
        assert len(out) == 1 and out[0]["value"] == "420.000 RON" and out[0]["field"] == "ebitda"
        doc = docs[out[0]["doc_id"]]
        assert out[0]["quote"] in doc["text"] and out[0]["doc_name"] == doc["name"]
        assert document_fields(case, role, query="ebitda") == out                      # case-insensitive
        assert {f["field"] for f in document_fields(case, role, doc_id=out[0]["doc_id"])} >= {"ebitda", "cui"}
        assert document_fields(case, role, query="financial statements")              # matches the document name
        assert document_fields(case, role, doc_id="doc-999") == []
    # owner lines are evidence for an internal check: the client does not get them, the employee does
    owners = document_fields(case, "employee", query="Munteanu")
    assert any(f["field"] == "declared_owner" and f["value"] == "Andrei Munteanu 70%" and f["quote"] in
               docs[f["doc_id"]]["text"] for f in owners)
    assert not [f for f in document_fields(case, "client", query="Munteanu") if "owner" in f["field"]]


def test_explain_rule_client_hides_threshold():
    client, employee = explain_rule("HR-07", "client"), explain_rule("HR-07", "employee")
    assert "1.2" not in client["text"] and "1.2" in employee["text"] and employee["id"] == "HR-07"
    assert client["text"] == "We check that the company's income comfortably covers its loan repayments."
    assert "HR-" not in json.dumps(client)
    for rid in list(T.RULES) + ["SR-01"]:                      # every rule has a plain, threshold-free client sentence
        text = CLIENT_RULE_TEXT[rid]
        assert text and not re.search(r"\d|%|HR-|JQ-|GATE-|SR-", text), (rid, text)
        assert explain_rule(rid.lower(), "client")["text"] == text
    for role in ("client", "employee"):
        assert "error" in explain_rule("NOPE-99", role)


def test_explain_step_denied_for_client():
    case = _case_at("day0-pack")
    step = next(e for e in case.ledger.events if e["type"] == "AGENT_STEP")
    assert explain_step(case, "client", step["seq"]) == {"error": "not available"}
    out = explain_step(case, "employee", step["seq"])
    p = step["payload"]
    assert out == {"seq": step["seq"], "tool": p["tool"], "reason": p["reason"], "gate": p["gate"],
                   "input": p["input"], "output": p["output"]}
    assert "error" in explain_step(case, "employee", 1)         # CASE_OPENED is not an agent step
    assert "error" in explain_step(case, "employee", 99999)


def test_client_hides_sequence_exception_and_hold_details():
    case = _to_triage()
    before = issues(case, "client")
    _add_insider_hold(case)
    assert issues(case, "client") == before                     # the insider card is invisible to the client
    ov = overview(case, "client")
    assert ov["status_text"] == "Under review by the bank"
    blob = json.dumps([ov, issues(case, "client"), missing_documents(case, "client"), timeline(case, "client")])
    for banned in CLIENT_BANNED:
        assert banned not in blob, banned
    emp_ov = overview(case, "employee")
    assert emp_ov["status_text"] == "On hold"
    card = next(i for i in issues(case, "employee") if i["requirement_id"] == "MON")
    assert card["rule_id"] == "SR-01" and card["kind"] == "sequence_insider"
    assert card["title"] and card["summary"] == ""               # missing title/summary degrade, they do not raise
    assert timeline(case, "employee", since_day="0", limit="5")  # string ints from an LLM tool call are tolerated
    assert emp_ov["open_items"] == overview(case, "client")["open_items"] + 1   # employees count the insider card too


def test_overview_status_words_per_role():
    case = _to_triage()
    emp = overview(case, "employee")
    assert emp["day"] == 0 and emp["status_text"] == "Open"
    assert {c["id"] for c in emp["checks"]} == {r["id"] for r in T.REQUIREMENTS}
    words = {c["id"]: c["status_word"] for c in emp["checks"]}
    assert words == {"R1": "Verified", "R2": "Conflict", "R3": "Needs review", "R4": "Verified", "R5": "Verified", "R6": "Waiting"}
    cl = overview(case, "client")
    cw = {c["id"]: c["status_word"] for c in cl["checks"]}
    assert cw == {"R1": "Verified", "R2": "Under review by the bank", "R3": "Under review by the bank", "R4": "Verified",
                  "R5": "Verified", "R6": "We need something from you"}
    assert not [c for c in cl["checks"] if re.search(r"\d|%", c["title"])]   # e.g. R4's "≥ 1.2" is not shown to clients
    assert emp["open_items"] == cl["open_items"] > 0
    # an expired certificate asks for a new one
    agent = ScriptedAgent()
    for fired in case.advance(40):
        agent.handle(case, fired)
    cw = {c["id"]: c["status_word"] for c in overview(case, "client")["checks"]}
    assert cw["R1"] == "Expired, please send a new one"
    assert {c["id"]: c["status_word"] for c in overview(case, "employee")["checks"]}["R1"] == "Expired"


def test_views_are_read_only_and_return_copies():
    case = _to_triage()
    n = len(case.ledger.events)
    step = next(e for e in case.ledger.events if e["type"] == "AGENT_STEP")
    for role in ("client", "employee"):
        overview(case, role), missing_documents(case, role), timeline(case, role), issues(case, role)
        document_fields(case, role), explain_rule("HR-07", role), explain_step(case, role, step["seq"])
    assert len(case.ledger.events) == n and case.ledger.verify()["ok"]
    for iss in issues(case, "employee"):                          # callers may scribble on what they get back
        iss["notes"].append("x")
        iss["snippets"].clear()
        if iss["judge"]:
            iss["judge"]["probs"].clear()
    explain_step(case, "employee", step["seq"])["input"]["tampered"] = True
    assert len(case.ledger.events) == n and case.ledger.verify()["ok"]
    assert all(i["notes"] == [] for i in issues(case, "employee"))


def test_invalid_role_raises():
    case = _case_at("day0-pack")
    for call in (lambda r: overview(case, r), lambda r: missing_documents(case, r), lambda r: timeline(case, r),
                 lambda r: issues(case, r), lambda r: document_fields(case, r), lambda r: explain_step(case, r, 1),
                 lambda r: explain_rule("HR-07", r)):
        for bad in ("admin", "", None, "Client"):
            with pytest.raises(ValueError):
                call(bad)
