"""Regression tests for the a-backend review findings (I3, I4, I5, I6, M3, M5, M6)."""
from fastapi.testclient import TestClient

from app import chat
from app.engine import allowed_actions
from app.main import CASES, app

c = TestClient(app)


def post(item):
    return c.post("/api/cases/demo-1/inbound", json={"item_id": item}).json()


def test_on_hold_keeps_legal_clock_and_escalations_but_stops_chasing_the_client():   # I3
    c.post("/api/demo/reset")
    post("day0-pack")
    post("staff-phone-change")
    b = post("staff-credit-check")
    ex = next(x["id"] for x in b["exceptions"] if x["kind"] == "sequence_insider")
    c.post(f"/api/cases/demo-1/exceptions/{ex}/resolve", json={"action_id": "escalate_compliance"})
    b = post("onrc-cert")
    assert b["case"]["status"] == "ON_HOLD"
    kinds = {x["kind"] for x in b["exceptions"] if x["status"] == "OPEN"}
    assert {"ubo_discrepancy", "address_uncertain"} <= kinds
    assert any(t["kind"] == "legal_deadline" for t in b["timers"])
    reminders_before = sum(1 for s in b["trace"] if s["tool"] == "send_reminder")
    b = c.post("/api/cases/demo-1/advance", json={"days": 3}).json()
    assert sum(1 for s in b["trace"] if s["tool"] == "send_reminder") == reminders_before
    assert all(a["tool"] in ("start_legal_clock", "escalate_to_analyst") for a in allowed_actions(CASES["demo-1"].state()))


def test_week_skip_email_lists_each_document_once():                                 # I4
    c.post("/api/demo/reset")
    post("day0-pack")
    b = c.post("/api/cases/demo-1/advance", json={"days": 7}).json()
    body = b["outbox"][0]["body"]
    assert body.count("Certificatul constatator ONRC") == 1


def test_employee_timeline_can_page_back_to_day_0():                                 # I5
    c.post("/api/demo/reset")
    post("day0-pack")
    c.post("/api/cases/demo-1/advance", json={"days": 3})
    post("onrc-cert")
    first = chat.run_tool(CASES["demo-1"], "employee", "get_timeline", {"until_day": 0, "limit": 200})
    assert first and first[0]["day"] == 0 and all(e["day"] == 0 for e in first)


def test_offline_employee_answer_finds_the_person():                                 # I6
    c.post("/api/demo/reset")
    post("day0-pack")
    post("onrc-cert")
    out = chat.offline_answer(CASES["demo-1"], "employee", "When did we learn about Radu Pop and what did we do?")
    assert "RADU" in out.upper() and "Day 0" in out and "[#" in out


def test_range_citations_are_stripped():                                             # M3
    c.post("/api/demo/reset")
    post("day0-pack")
    text, cites = chat.citations(CASES["demo-1"], "client", "Requested on day 0 [#3–#6] and (#2, #4). See (2–3 days).")
    assert "#3" not in text and "#4" not in text and "(2–3 days)" in text and cites == []


def test_staff_cannot_confirm_on_behalf_of_the_client():                             # M5
    from app import sequence
    from app.engine import Case
    staff = {"type": "employee", "id": "E-0317"}
    case = Case("t")
    case.emit("STAFF_CONTACT_CHANGE", staff, {"client_id": "C-1042", "field": "phone"}, "change")
    case.emit("CLIENT_CONFIRMATION", staff, {"client_id": "C-1042", "channel": "phone"}, "self-confirmed")
    case.emit("CREDIT_ACTION", staff, {"client_id": "C-1042", "action": "credit_bureau_query"}, "credit")
    assert len(sequence.check(case)) == 1


def test_insider_card_reopens_a_ready_file():                                       # M6
    c.post("/api/demo/reset")
    for item in ("day0-pack", "onrc-cert"):
        b = post(item)
    for x in [x for x in b["exceptions"] if x["status"] == "OPEN"]:
        c.post(f"/api/cases/demo-1/exceptions/{x['id']}/resolve",
               json={"action_id": "same_address" if x["kind"] == "address_uncertain" else "confirm_discrepancy"})
    assert post("updated-docs")["case"]["status"] == "READY_FOR_DECISION"
    post("staff-phone-change")
    assert post("staff-credit-check")["case"]["status"] == "OPEN"
