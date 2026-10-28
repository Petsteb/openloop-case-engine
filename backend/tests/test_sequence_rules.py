"""SR-01: employee changes a client's contact data, then runs a credit action for them within 48 h."""
import os

os.environ["AGENT_MODE"] = "scripted"
os.environ["JUDGE_MODE"] = "heuristic"

from fastapi.testclient import TestClient  # noqa: E402

from app.engine import Case, allowed_actions  # noqa: E402
from app.main import app  # noqa: E402

STAFF = {"type": "employee", "id": "E-0317"}
CLIENT = {"type": "client", "id": "C-1042"}


def change(case, actor=STAFF):
    case.emit("STAFF_CONTACT_CHANGE", actor, {"client_id": "C-1042", "field": "phone", "old": "a", "new": "b"}, "change")


def credit(case, actor=STAFF):
    from app import sequence
    case.emit("CREDIT_ACTION", actor, {"client_id": "C-1042", "action": "credit_bureau_query"}, "credit check")
    return sequence.check(case)


def insider_cards(case):
    return [x for x in case.state()["exceptions"].values() if x["kind"] == "sequence_insider"]


def test_flags_same_employee_within_48h():
    case = Case("t")
    change(case)
    list(case.advance(2 / 24))                               # 2 hours later
    assert len(credit(case)) == 1
    assert len(insider_cards(case)) == 1
    from app import sequence
    assert sequence.check(case) == []                         # re-checking the same ledger never duplicates the card


def test_ignores_client_initiated_change():
    case = Case("t")
    change(case, actor=CLIENT)
    assert credit(case) == []


def test_ignores_after_48h():
    case = Case("t")
    change(case)
    list(case.advance(2.05))                                 # ~49 h
    assert credit(case) == []


def test_client_confirmation_clears():
    case = Case("t")
    change(case)
    case.emit("CLIENT_CONFIRMATION", CLIENT, {"client_id": "C-1042", "channel": "phone"}, "confirmed")
    assert credit(case) == []


def test_other_employee_does_not_match():
    case = Case("t")
    change(case)
    assert credit(case, actor={"type": "employee", "id": "E-9999"}) == []


def test_escalation_puts_case_on_hold():
    case = Case("t")
    change(case)
    ex_id = credit(case)[0]
    case.resolve(ex_id, "escalate_compliance")
    st = case.state()
    assert st["status"] == "ON_HOLD"
    assert allowed_actions(st) == []


def test_scenario_items_raise_card():
    c = TestClient(app)
    c.post("/api/demo/reset")
    c.post("/api/cases/demo-1/inbound", json={"item_id": "staff-phone-change"})
    b = c.post("/api/cases/demo-1/inbound", json={"item_id": "staff-credit-check"}).json()
    cards = [x for x in b["exceptions"] if x["kind"] == "sequence_insider" and x["status"] == "OPEN"]
    assert len(cards) == 1 and cards[0]["rule"]["id"] == "SR-01"
    assert c.get("/api/cases/demo-1/verify").json()["ok"]
