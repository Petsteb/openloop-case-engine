"""End-to-end demo scenario in scripted mode (no API keys needed)."""
import os

os.environ["AGENT_MODE"] = "scripted"
os.environ["JUDGE_MODE"] = "heuristic"

from fastapi.testclient import TestClient  # noqa: E402

from app.engine import gate  # noqa: E402
from app.main import CASES, app  # noqa: E402

c = TestClient(app)


def req(b, rid):
    return next(r for r in b["requirements"] if r["id"] == rid)


def open_ex(b):
    return [x for x in b["exceptions"] if x["status"] == "OPEN"]


def test_full_demo_flow():
    b = c.post("/api/demo/reset").json()
    assert all(r["status"] == "OPEN_WAITING" for r in b["requirements"])

    b = c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"}).json()
    assert req(b, "R4")["status"] == "SATISFIED"            # DSCR 1.4
    assert {"onrc_certificate", "fiscal_certificate"} <= {s["input"].get("key") for s in b["trace"] if s["tool"] == "request_document"}

    b = c.post("/api/cases/demo-1/advance", json={"days": 3}).json()
    assert any(s["tool"] == "send_reminder" for s in b["trace"])

    b = c.post("/api/cases/demo-1/inbound", json={"item_id": "onrc-cert"}).json()
    assert req(b, "R1")["status"] == "SATISFIED"
    assert req(b, "R2")["status"] == "CONTRADICTED"          # Radu Pop 25% undeclared
    assert req(b, "R3")["status"] == "NEEDS_REVIEW"          # Str. vs Calea — judge unsure
    assert req(b, "R5")["status"] == "SATISFIED"             # judge: same person
    assert any(t["kind"] == "legal_deadline" for t in b["timers"])
    kinds = {x["kind"]: x["id"] for x in open_ex(b)}
    assert set(kinds) == {"ubo_discrepancy", "address_uncertain"}

    # client email before the analyst decides: the agent may not contact the client about the discrepancy
    b = c.post("/api/cases/demo-1/inbound", json={"item_id": "client-email"}).json()
    assert any(s["gate"].startswith("DENY") for s in b["trace"])

    b = c.post(f"/api/cases/demo-1/exceptions/{kinds['address_uncertain']}/resolve", json={"action_id": "same_address"}).json()
    assert req(b, "R3")["status"] == "SATISFIED"
    b = c.post(f"/api/cases/demo-1/exceptions/{kinds['ubo_discrepancy']}/resolve", json={"action_id": "confirm_discrepancy"}).json()
    assert req(b, "R2")["status"] == "OPEN_WAITING"
    assert any(s["tool"] == "request_document" and s["input"].get("key") == "ubo_declaration" and s["gate"] == "ALLOW"
               for s in b["trace"])

    b = c.post("/api/cases/demo-1/inbound", json={"item_id": "updated-docs"}).json()
    assert req(b, "R2")["status"] == "SATISFIED"
    assert req(b, "R6")["status"] == "SATISFIED"
    assert any(t["kind"] == "legal_deadline" and t["status"] == "CANCELLED" for t in b["timers"])

    assert b["case"]["status"] == "READY_FOR_DECISION"      # everything verified on day 3...

    b = c.post("/api/cases/demo-1/advance", json={"days": 7}).json()
    assert req(b, "R1")["status"] == "EXPIRED"               # ...but the ONRC cert (issued 07 Oct) passes 30 days
    assert b["case"]["status"] == "OPEN"                     # a ready file regresses when evidence goes stale
    assert any(s["tool"] == "request_document" and s["input"].get("key") == "onrc_certificate" and s["gate"] == "ALLOW"
               and s["sim_time"] > "2026-11-05" for s in b["trace"])

    b = c.post("/api/cases/demo-1/inbound", json={"item_id": "fresh-onrc"}).json()
    assert all(r["status"] == "SATISFIED" for r in b["requirements"]), [(r["id"], r["status"], r["reason"]) for r in b["requirements"]]
    assert "precedent" in req(b, "R3")["reason"].lower()     # analyst ruling reused, no new triage card
    assert b["case"]["status"] == "READY_FOR_DECISION"
    assert not open_ex(b)

    assert c.get("/api/cases/demo-1/verify").json()["ok"]
    pending = [r["key"] for r in CASES["demo-1"].state()["requests"].values() if r["status"] == "PENDING"]
    assert pending == [], pending                            # every request closed by a matching document


def _to_triage():
    c.post("/api/demo/reset")
    c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"})
    return c.post("/api/cases/demo-1/inbound", json={"item_id": "onrc-cert"}).json()


def test_missed_legal_deadline_is_flagged_not_restarted():
    _to_triage()
    b = c.post("/api/cases/demo-1/advance", json={"days": 15}).json()
    legal = [t for t in b["timers"] if t["kind"] == "legal_deadline"]
    assert [t["status"] for t in legal] == ["FIRED"]         # one clock, never silently restarted
    ubo = next(x for x in b["exceptions"] if x["kind"] == "ubo_discrepancy")
    assert any("overdue" in n for n in ubo["notes"])


def test_dismiss_waives_discrepancy_but_not_ids():
    b = _to_triage()
    ex = next(x["id"] for x in b["exceptions"] if x["kind"] == "ubo_discrepancy")
    b = c.post(f"/api/cases/demo-1/exceptions/{ex}/resolve", json={"action_id": "dismiss"}).json()
    assert req(b, "R2")["status"] == "OPEN_WAITING"          # Radu Pop / Elena Munteanu IDs still required
    cancelled = [e for e in b["events"] if e["type"] == "TIMER_CANCELLED"]
    assert any("Timer cancelled: AMLR" in e["summary"] for e in cancelled)


def test_bad_tool_input_never_poisons_the_ledger():
    c.post("/api/demo/reset")
    out = CASES["demo-1"].run_tool("annotate_exception", {"exception_id": "EX-99", "note": "x"}, "bad id")
    assert "error" in out["output"]
    assert c.get("/api/cases/demo-1/bundle").status_code == 200
    assert c.get("/api/cases/demo-1/verify").json()["ok"]


def test_scenario_item_cannot_be_delivered_twice():
    c.post("/api/demo/reset")
    assert c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"}).status_code == 200
    assert c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"}).status_code == 409


def test_agent_can_never_approve_credit():
    c.post("/api/demo/reset")
    st = CASES["demo-1"].state()
    assert gate(st, "approve_credit", {}) == (False, "DENY: GATE-02")
