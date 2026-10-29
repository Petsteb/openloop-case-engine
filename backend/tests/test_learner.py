"""Learning loop: analyst rulings -> proposed check -> backtest -> maker-checker promotion -> used before the judge."""
import os

os.environ["AGENT_MODE"] = "scripted"
os.environ["JUDGE_MODE"] = "heuristic"
os.environ["EMAIL_MODE"] = "outbox"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import learner  # noqa: E402
from app.main import CASES, app  # noqa: E402

c = TestClient(app)


@pytest.fixture(autouse=True)
def clean_rulebook():
    learner.PROMOTED.clear()
    yield
    learner.PROMOTED.clear()


def to_address_card():
    c.post("/api/demo/reset")
    for item in ("day0-pack", "onrc-cert"):
        b = c.post("/api/cases/demo-1/inbound", json={"item_id": item}).json()
    return next(x["id"] for x in b["exceptions"] if x["kind"] == "address_uncertain")


def test_proposal_appears_after_3_similar_rulings():
    ex = to_address_card()
    assert c.get("/api/learning").json()["proposals"] == []          # 2 past rulings: not yet a pattern
    c.post(f"/api/cases/demo-1/exceptions/{ex}/resolve", json={"action_id": "same_address"})
    props = c.get("/api/learning").json()["proposals"]
    assert len(props) == 1 and props[0]["support"] == 3
    assert "analyst-1" in props[0]["ruled_by"]


def test_check_matches_street_type_variant_only():
    a, b = "Str. Fagului nr. 7, bl. A2, Cluj-Napoca, jud. Cluj", "Calea Fagului nr. 7, Cluj-Napoca, Județ Cluj"
    assert learner.check_matches(a, b, "400127", "400127")
    assert not learner.check_matches(a, "Calea Fagului nr. 9, Cluj-Napoca", "400127", "400127")
    assert not learner.check_matches(a, b, "400127", "400134")
    assert not learner.check_matches(a, "Calea Fagului nr. 7, Turda", "400127", "400127")
    # small town with one postal code for every street: never auto-accepted, even though everything else matches
    assert not learner.check_matches("Str. Gării nr. 4, Sântana, jud. Arad", "Calea Gării nr. 4, Sântana, Județ Arad",
                                     "317280", "317280")


def test_backtest_reports_zero_false_approvals_on_eval():
    r = learner.backtest(learner.PROPOSAL_ID)
    assert r["n"] == 48 and r["false_approvals"] == 0 and r["auto_resolved"] >= 10
    assert r["naive_rule_false_approvals"] == 8          # the counterexamples the city condition exists for


def test_promote_rejects_maker_as_checker():
    ex = to_address_card()
    c.post(f"/api/cases/demo-1/exceptions/{ex}/resolve", json={"action_id": "same_address"})
    r = c.post(f"/api/learning/proposals/{learner.PROPOSAL_ID}/promote", json={"by": "analyst-1"})
    assert r.status_code == 409
    assert learner.PROMOTED == []


def test_promoted_check_resolves_address_without_judge(monkeypatch):
    ex = to_address_card()
    c.post(f"/api/cases/demo-1/exceptions/{ex}/resolve", json={"action_id": "same_address"})
    r = c.post(f"/api/learning/proposals/{learner.PROPOSAL_ID}/promote", json={"by": "supervisor-1"})
    assert r.status_code == 200 and r.json()["check"]["id"] == "LC-1"
    assert any(e["type"] == "CHECK_PROMOTED" for e in CASES["demo-1"].ledger.events)

    from app.judge import judge as real_judge

    def no_address_judge(kind, a, b):
        assert kind != "address", "the learned check must answer before the judge is asked"
        return real_judge(kind, a, b)
    monkeypatch.setattr("app.engine.judge", no_address_judge)
    to_address_card_after_reset = c.post("/api/demo/reset")
    assert to_address_card_after_reset.status_code == 200
    for item in ("day0-pack", "onrc-cert"):
        b = c.post("/api/cases/demo-1/inbound", json={"item_id": item}).json()
    r3 = next(r for r in b["requirements"] if r["id"] == "R3")
    assert r3["status"] == "SATISFIED" and "Learned check LC-1" in r3["reason"]
    assert not any(x["kind"] == "address_uncertain" for x in b["exceptions"])


def test_learning_overview_lists_rulings_and_where_they_were_reused():
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    c.post("/api/demo/reset")
    for item in ("day0-pack", "onrc-cert"):
        b = c.post("/api/cases/demo-1/inbound", json={"item_id": item}).json()
    ex = next(x["id"] for x in b["exceptions"] if x["kind"] == "address_uncertain")
    c.post(f"/api/cases/demo-1/exceptions/{ex}/resolve", json={"action_id": "same_address"})
    o = c.get("/api/learning/overview").json()
    mine = [p for p in o["precedents"] if p["case_id"] == "demo-1"]
    assert mine and mine[0]["decision"] == "same_address" and mine[0]["by"] == "analyst-1"
    assert o["proposals"] and o["proposals"][0]["support"] >= o["min_support"]  # 2 past rulings + this one
    assert not [a for a in o["applied"] if a["case_id"] == "demo-1"]  # a fresh ruling is not a reuse


def test_full_reset_forgets_promoted_checks_like_a_restart_would():
    from fastapi.testclient import TestClient
    from app import learner
    from app.main import app
    learner.PROMOTED.append({"id": "LC-9", "proposal_id": learner.PROPOSAL_ID, "promoted_by": "supervisor-1"})
    TestClient(app).post("/api/demo/reset?all=true")
    assert not learner.PROMOTED  # otherwise the next demo run settles the address with no card
