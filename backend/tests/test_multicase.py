"""Multi-case: synthetic companies, templates, the SQLite store, home rows, messages and notifications."""
import json

import pytest
from fastapi.testclient import TestClient

from app import profiles, rules
from app.agent import ScriptedAgent
from app.engine import Case
from app.main import CASES, app
from app.store import Store

c = TestClient(app)

# company -> (template, expected status, expected requirement statuses, expected open card kind)
EXPECTED = {
    "verde": ("sme_loan", "READY_FOR_DECISION", {}, None),
    "carpatic": ("sme_loan", "OPEN", {"R6": "CONTRADICTED"}, "tax_debt"),
    "delta": ("sme_loan", "OPEN", {"R1": "CONTRADICTED"}, "inactive"),
    "nord": ("sme_loan", "OPEN", {"R4": "CONTRADICTED"}, "dscr"),
    "medica": ("sme_loan", "OPEN", {"R5": "NEEDS_REVIEW"}, "signatory_uncertain"),
    "solaris": ("sme_loan", "OPEN", {"R1": "EXPIRED"}, None),
}


def _run(company: str, template: str) -> Case:
    """A fresh case for this company, every scripted inbound item delivered (offline agent)."""
    case, agent = Case(f"t-{company}", template=template, profile_id=company), ScriptedAgent()
    agent.handle_batch(case, [case.ledger.events[0]])
    for item in case.scenario:
        if item["id"] in ("fresh-onrc", "mandate"):
            continue  # the follow-up documents a human or a rule asks for later
        agent.handle_batch(case, case.deliver(item["id"]))
    return case


@pytest.mark.parametrize("company", sorted(EXPECTED))
def test_every_synthetic_company_ends_on_its_story(company):
    template, status, reqs, card = EXPECTED[company]
    st = _run(company, template).state()
    assert st["status"] == status
    for rid, want in reqs.items():
        assert st["reqs"][rid]["status"] == want, (rid, st["reqs"][rid]["reason"])
    others = {r: v["status"] for r, v in st["reqs"].items() if r not in reqs}
    assert set(others.values()) == {"SATISFIED"}, others
    open_kinds = [x["kind"] for x in st["exceptions"].values() if x["status"] == "OPEN"]
    assert open_kinds == ([card] if card else [])


def test_synthetic_documents_are_internally_consistent():
    for pid, p in profiles.PROFILES.items():
        assert rules.cui_checksum_valid(p["cui"]), pid
        if pid == "aurora":
            continue
        samples = profiles.samples_for(pid)
        assert all(p["cui"] in text for key, (_, text) in samples.items() if not key.startswith("id_card")), pid
        assert sum(o["pct"] for o in p["owners"]) == 100, pid


def test_trade_register_numbers_follow_the_new_onrc_format():
    from app import scenario as S
    numbers = [S.AURORA_J, S._DOINA_J] + [profiles._reg(profiles.PROFILES[k]) for k in profiles.FOUNDED]
    for n in numbers:   # J + year + 6-digit serial + county + check digit (sum of digits, J counted as 4, mod 10)
        assert len(n) == 14 and n[0] == "J"
        assert str((ord("J") % 10 + sum(int(ch) for ch in n[1:-1])) % 10) == n[-1], n
    assert all(p["cui"].startswith("9") for p in profiles.PROFILES.values())   # unassigned range, not a real firm


def test_kyb_review_only_checks_registry_owners_and_taxes():
    case = _run("verde", "kyb_review")
    st = case.state()
    assert list(st["reqs"]) == ["R1", "R2", "R6"] and st["status"] == "READY_FOR_DECISION"
    assert not any(r["key"] in ("application", "financial_statement") for r in st["requests"].values())


def test_solaris_fresh_certificate_completes_the_file():
    case, agent = _run("solaris", "sme_loan"), ScriptedAgent()
    agent.handle_batch(case, case.deliver("fresh-onrc"))
    assert case.state()["status"] == "READY_FOR_DECISION"


def test_store_round_trip_keeps_the_chain(tmp_path):
    store = Store(tmp_path / "t.db")
    case, agent = Case("p-1", store, template="sme_loan", profile_id="carpatic"), ScriptedAgent()
    agent.handle_batch(case, [case.ledger.events[0]])
    agent.handle_batch(case, case.deliver("day0-pack"))
    reloaded = Case("p-1", Store(tmp_path / "t.db"), events=Store(tmp_path / "t.db").events("p-1"))
    assert reloaded.ledger.verify()["ok"] and reloaded.state()["reqs"] == case.state()["reqs"]
    assert reloaded.profile["id"] == "carpatic" and reloaded.template == "sme_loan"
    agent.handle_batch(reloaded, reloaded.deliver("onrc-cert"))   # keeps appending after a reload
    assert reloaded.ledger.verify()["ok"] and len(store.events("p-1")) == len(reloaded.ledger.events)


def test_home_queue_puts_needs_you_first_and_clients_see_only_their_files():
    rows = c.get("/api/cases", params={"role": "employee"}).json()
    assert {r["company_id"] for r in rows} >= set(EXPECTED) | {"aurora", "atelier"}
    needs = [r["needs_you"] > 0 for r in rows]
    assert needs == sorted(needs, reverse=True)
    mine = c.get("/api/cases", params={"role": "client", "company_id": "verde"}).json()
    assert mine and all(r["company_id"] == "verde" for r in mine) and "open_decisions" not in mine[0]
    assert {t["id"] for t in c.get("/api/templates").json()} == {"sme_loan", "kyb_review"}
    assert len(c.get("/api/companies").json()) == len(profiles.PROFILES)


def test_new_case_asks_for_starting_documents_and_takes_sample_uploads():
    v0 = c.get("/api/version").json()
    b = c.post("/api/cases", json={"template": "kyb_review", "company_id": "verde"}).json()
    cid = b["case"]["id"]
    assert b["case"]["template_title"] == "Annual business review" and b["case"]["company"] == "Verde Logistic SRL"
    assert c.get("/api/version").json()["cases"] == v0["cases"] + 1
    view = c.get(f"/api/cases/{cid}/client-view").json()
    assert {m["key"] for m in view["missing_documents"]} == {"ubo_declaration", "onrc_certificate", "fiscal_certificate"}
    for key in ("ubo_declaration", "onrc_certificate", "fiscal_certificate"):
        c.post(f"/api/cases/{cid}/upload-sample", json={"key": key})
    keys = {s["key"] for s in c.get(f"/api/cases/{cid}/sample-files").json()}
    pending = {m["key"] for m in c.get(f"/api/cases/{cid}/client-view").json()["missing_documents"]}
    assert pending and pending <= keys                         # ID requests use the same spelling as the samples
    for key in pending:
        c.post(f"/api/cases/{cid}/upload-sample", json={"key": key})
    assert c.get(f"/api/cases/{cid}/bundle").json()["case"]["status"] == "READY_FOR_DECISION"
    assert c.post("/api/cases", json={"template": "kyb_review", "company_id": "nord"}).status_code == 422


def test_messages_thread_refs_and_role_filtering():
    c.post("/api/demo/reset")
    c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"})
    c.post("/api/cases/demo-1/inbound", json={"item_id": "onrc-cert"})
    events = c.get("/api/cases/demo-1/bundle").json()["events"]
    internal = next(e["seq"] for e in events if e["type"] == "EXCEPTION_RAISED")
    c.post("/api/cases/demo-1/messages", json={"role": "employee", "author": "Ana Pop (analyst)",
                                                 "text": f"Please check #doc-3 and @Radu Pop; see #{internal}"})
    staff_view = c.get("/api/cases/demo-1/messages", params={"role": "employee"}).json()
    msg = [m for m in staff_view if m["kind"] == "message"][-1]
    assert {r["kind"] for r in msg["refs"]} == {"doc", "person", "event"}
    client_msg = [m for m in c.get("/api/cases/demo-1/messages").json() if m["kind"] == "message"][-1]
    assert {r["kind"] for r in client_msg["refs"]} == {"doc", "person"}          # no link to an internal event
    assert any(m["kind"] == "email" and m["subject"] for m in staff_view)
    ment = c.get("/api/cases/demo-1/mentionables").json()
    assert ment["people"] and ment["docs"] and all(e["seq"] != internal for e in ment["events"])


def test_client_message_about_a_new_shareholder_reaches_the_agent():
    c.post("/api/demo/reset")
    c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"})
    c.post("/api/cases/demo-1/inbound", json={"item_id": "onrc-cert"})
    c.post("/api/cases/demo-1/messages", json={"role": "client", "text": "Radu Pop became a shareholder (asociat) this month."})
    b = c.get("/api/cases/demo-1/bundle").json()
    assert any(s["tool"] == "classify_message" and "ownership_change" in s["output"] for s in b["trace"])
    card = next(x for x in b["exceptions"] if x["kind"] == "ubo_discrepancy")
    assert any("Client message" in n for n in card["notes"])


def test_notifications_for_both_roles():
    c.post("/api/demo/reset")
    c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"})
    staff = c.get("/api/notifications", params={"role": "employee"}).json()
    assert any(n["kind"] == "action" and n["text"].startswith("Decision needed") for n in staff)
    client = c.get("/api/notifications", params={"role": "client", "company_id": "aurora"}).json()
    assert any(n["text"].startswith("Please send") for n in client)
    assert all(n["case_id"] in CASES and CASES[n["case_id"]].profile["id"] == "aurora" for n in client)
    blob = json.dumps(client).lower()
    assert "decision needed" not in blob and "insider" not in blob


def test_pages_are_revalidated_so_a_rebuilt_ui_is_never_stale():
    for path in ("/", "/client/"):
        r = c.get(path)
        if r.status_code == 200 and r.headers["content-type"].startswith("text/html"):
            assert r.headers["cache-control"] == "no-cache", path
