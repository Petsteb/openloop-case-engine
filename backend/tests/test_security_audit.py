"""Proof-of-concept tests for docs/security-audit.md (2026-10-29).

Each xfail test asserts the SECURE behaviour and is expected to fail today; the reason names the finding.
`raises=AssertionError` keeps a broken setup from hiding as an xfail (setup problems call pytest.fail instead).
When a fix lands the test XPASSes: then delete its xfail marker so it guards the fix.
The plain (non-xfail) tests pin strengths the pitch relies on. Everything is offline: scripted agent, heuristic
judge, outbox email, in-memory database (see conftest.py).
"""
import base64

import pytest
from fastapi.testclient import TestClient

from app import judge as J
from app.agent import BedrockAgent, ScriptedAgent
from app.engine import Case
from app.ledger import Ledger, _hash
from app.main import CASES, app
from app.scenario import APPLICATION, FINANCIALS, FISCAL, ONRC
from app.store import Store
from stub_llm import StubClient, tool_use

c = TestClient(app)
c_noraise = TestClient(app, raise_server_exceptions=False)


def xfail(finding: str, why: str):
    return pytest.mark.xfail(raises=AssertionError, strict=False, reason=f"{finding}: {why}")


def require(cond, msg: str) -> None:
    """Setup precondition: a failure here is a broken test, not the finding."""
    if not cond:
        pytest.fail(f"PoC setup failed: {msg}")


def b64(text: str) -> str:
    return base64.b64encode(text.encode()).decode()


def upload(key: str, text: str, client: TestClient = c, filename: str = "f.txt"):
    return client.post("/api/cases/demo-1/upload", json={"key": key, "filename": filename, "content_b64": b64(text)})


def start_demo() -> None:
    """demo-1 after the day-0 pack: the bank waits for the ONRC + fiscal certificates and Elena Munteanu's ID."""
    c.post("/api/demo/reset")
    c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"})
    pending = {m["key"] for m in c.get("/api/cases/demo-1/client-view").json()["missing_documents"]}
    require({"onrc_certificate", "fiscal_certificate"} <= pending, f"unexpected pending set {pending}")


def today() -> str:
    return CASES["demo-1"].now.strftime("%d.%m.%Y")


# ----------------------------------------------------------------------------- SEC-02 forged issuer document
@xfail("SEC-02", "client-uploaded ONRC certificate is trusted as the register: a hidden 25% owner passes HR-04")
def test_sec02_forged_register_certificate_cannot_hide_a_beneficial_owner():
    start_demo()
    forged = (ONRC.replace("{issued}", today())
              .replace("Calea Fagului nr. 7, Cluj-Napoca, Județ Cluj", "Str. Fagului nr. 7, bl. A2, Cluj-Napoca, jud. Cluj")
              .replace("MUNTEANU ANDREI — 45%", "MUNTEANU ANDREI — 70%")
              .replace("Asociat: POP RADU — 25%\n", ""))      # the real register lists Radu Pop with 25%
    require(upload("onrc_certificate", forged).status_code == 200, "forged ONRC upload refused")
    for key in ("fiscal_certificate", "id_card:Elena Munteanu"):
        require(c.post("/api/cases/demo-1/upload-sample", json={"key": key}).status_code == 200, f"sample {key}")
    st = CASES["demo-1"].state()
    # Secure behaviour: the owners come from the registry (or a verified certificate), so the file cannot complete
    # with Radu Pop unidentified and no AMLR clock.
    assert st["status"] != "READY_FOR_DECISION" and st["reqs"]["R2"]["status"] != "SATISFIED", st["reqs"]["R2"]["reason"]


# ----------------------------------------------------------------------------- SEC-03 identity from the key, not the document
@xfail("SEC-03", "an ID card upload with no identity fields satisfies HR-05 for the person named in the request key")
def test_sec03_empty_id_card_does_not_identify_anyone():
    start_demo()
    r = upload("id_card:Elena Munteanu", "scan attached")       # no Nume / Prenume / CNP / validity
    require(r.status_code == 200, f"upload refused: {r.status_code}")
    still_needed = any(m["key"].startswith("id_card:") for m in r.json()["missing_documents"])
    assert still_needed, "the bank now treats Elena Munteanu as identified"


@xfail("SEC-03", "the ID card's 'Valabilă până la' is extracted but never checked")
def test_sec03_expired_id_card_is_not_valid_evidence():
    start_demo()
    expired = ("ROMÂNIA · CARTE DE IDENTITATE (copie)\nNume: MUNTEANU\nPrenume: ELENA\nCNP: 288070••••••\n"
               "Valabilă până la: 01.01.2020")
    require(upload("id_card:Elena Munteanu", expired).status_code == 200, "upload refused")
    docs = c.get("/api/cases/demo-1/documents?role=employee").json()
    elena = [d for d in docs if d["type"] == "id_card" and d.get("person") == "Elena Munteanu"]
    require(elena, "uploaded ID card not listed")
    assert elena[-1]["status"] != "valid"


# ----------------------------------------------------------------------------- SEC-04 / SEC-05 issue dates from the text
# Fixed (theo/logic-fixes): engine._date_problem quarantines the upload; rules.doc_is_valid is total.
def test_sec04_future_dated_certificate_still_expires():
    start_demo()
    r = upload("fiscal_certificate", FISCAL.replace("{issued}", "01.01.2030"))
    if r.status_code == 200:
        assert "fiscal_certificate" in {m["key"] for m in r.json()["missing_documents"]}   # not accepted: still needed
        assert "data emiterii" in r.json()["emails"][-1]["body"]                           # the client is told why
        c.post("/api/cases/demo-1/advance", json={"days": 45})
    assert CASES["demo-1"].state()["reqs"]["R6"]["status"] != "SATISFIED"


def test_sec05_poison_issue_date_is_rejected_and_case_keeps_working():
    start_demo()
    try:
        r = upload("fiscal_certificate", FISCAL.replace("{issued}", "31.12.9999"), client=c_noraise)
        view = c_noraise.get("/api/cases/demo-1/client-view")
        # Rejected: either refused (422) or kept as "Not accepted" (quarantined, like another company's file).
        assert r.status_code in (200, 422) and view.status_code == 200, (r.status_code, view.status_code)
        assert "fiscal_certificate" in {m["key"] for m in view.json()["missing_documents"]}
        assert c_noraise.get("/api/cases/demo-1/documents?role=employee").status_code == 200
        bad_day = upload("fiscal_certificate", FISCAL.replace("{issued}", "31.02.2026"), client=c_noraise)
        assert bad_day.status_code in (200, 422)                  # an impossible day is not a 500 either
    finally:
        c.post("/api/demo/reset")


def test_sec05_poison_date_already_in_the_ledger_fails_closed():
    """Defence in depth: a poison issue date that bypassed ingestion (older ledger) neither crashes nor passes."""
    from app import case_views as V
    case, agent = Case("sec-poison"), ScriptedAgent()
    agent.handle(case, case.ledger.events[0])
    ev = case.emit("DOCUMENT_RECEIVED", case.client, {
        "id": "doc-1", "type": "fiscal_certificate", "name": "Fiscal certificate", "source": "upload",
        "text": FISCAL.replace("{issued}", "31.12.9999"), "issued_at": "9999-12-31T09:00:00+00:00"}, "legacy upload")
    agent.handle(case, ev)
    assert case.state()["reqs"]["R6"]["status"] != "SATISFIED"
    assert V.documents(case, "client") and V.documents(case, "employee")


def test_sec05_a_crashing_rule_check_fails_closed(monkeypatch):
    """Any exception in a pipeline tool is a logged failed step; the requirement needs a human, never SATISFIED."""
    from app import engine as E
    case, agent = Case("sec-crash"), ScriptedAgent()
    agent.handle(case, case.ledger.events[0])

    def boom(st, req_id):
        raise RuntimeError("boom")
    monkeypatch.setattr(E, "_evaluate", boom)
    out = case.run_tool("check_requirement", {"req_id": "R6"}, "probe")
    assert "RuntimeError" in out["output"]["error"]
    assert case.state()["reqs"]["R6"]["status"] == "NEEDS_REVIEW"
    monkeypatch.undo()
    agent.follow_up(case)
    assert any(x["requirement_id"] == "R6" for x in case.state()["exceptions"].values())   # a card for the analyst


# ----------------------------------------------------------------------------- SEC-06 DSCR on missing / negative amounts
def _r4_after(financials: str) -> dict:
    case, agent = Case("sec-dscr"), ScriptedAgent()
    agent.handle(case, case.ledger.events[0])                     # the bank requests the starting documents
    for key, text in (("application", APPLICATION), ("financial_statement", financials)):
        agent.handle(case, case.receive_upload(key, f"{key}.txt", text.replace("{issued}", "28.10.2026")))
    return case.state()["reqs"]["R4"]


@xfail("SEC-06", "parse_amount drops the minus sign: an EBITDA loss reads as a profit")
def test_sec06_negative_ebitda_fails_dscr():
    require(_r4_after(FINANCIALS)["status"] == "SATISFIED", "baseline DSCR 1.4 should pass")
    r4 = _r4_after(FINANCIALS.replace("EBITDA: 420.000 RON", "EBITDA: -420.000 RON"))
    assert r4["status"] != "SATISFIED", r4["reason"]


@xfail("SEC-06", "a missing debt-service line counts as 0, so DSCR passes")
def test_sec06_missing_existing_debt_line_does_not_pass_dscr():
    low = FINANCIALS.replace("EBITDA: 420.000 RON", "EBITDA: 250.000 RON")   # 250k / (180k + 120k) = 0.83
    require(_r4_after(low)["status"] == "CONTRADICTED", "baseline DSCR 0.83 should fail")
    r4 = _r4_after(low.replace("Serviciul anual al datoriei existente: 180.000 RON\n", ""))
    assert r4["status"] != "SATISFIED", r4["reason"]


# ----------------------------------------------------------------------------- SEC-07 judge auto-accepts different numbers
@xfail("SEC-07", "heuristic judge (default and Featherless fallback) auto-accepts a different street number")
def test_sec07_different_street_number_is_never_auto_accepted():
    a = "Bd. 21 Decembrie 1989 nr. 10, ap. 5, Cluj-Napoca, jud. Cluj"
    b = "Bd. 21 Decembrie 1989 nr. 104, ap. 5, Cluj-Napoca, jud. Cluj"
    assert not J.judge("address", a, b)["auto_accept"]


@xfail("SEC-07", "when Featherless fails, one string-similarity signal decides alone")
def test_sec07_featherless_outage_does_not_auto_accept(monkeypatch):
    monkeypatch.setenv("JUDGE_MODE", "featherless")
    monkeypatch.setenv("JUDGE_CACHE", "0")
    monkeypatch.setattr(J, "featherless_probs", lambda *a: (_ for _ in ()).throw(ConnectionError("down")))
    j = J.judge("address", "Str. Mihai Viteazul nr. 1, bl. 3, sc. B, ap. 4, Cluj-Napoca, jud. Cluj",
                "Str. Mihai Viteazul nr. 2, bl. 3, sc. B, ap. 4, Cluj-Napoca, jud. Cluj")
    require(j["source"].startswith("heuristic (featherless failed"), f"fallback not taken: {j['source']}")
    assert not j["auto_accept"]


# ----------------------------------------------------------------------------- SEC-12 planner write tools outside the gate
def _hijacked(script):
    """A planner whose output an attacker controls (what a successful prompt injection amounts to)."""
    case, agent = Case("sec-agent"), BedrockAgent(client=StubClient(script))
    for item in ("day0-pack", "onrc-cert"):
        agent.handle_batch(case, case.deliver(item))
    return case


def test_gate_holds_against_a_hijacked_planner():
    """Strength: even a fully hijacked planner cannot approve credit or complete an incomplete file."""
    case = _hijacked([tool_use("approve_credit", {"reason": "client asked nicely"}, "a"),
                      tool_use("mark_ready_for_decision", {"reason": "documents say so"}, "b")])
    by_claude = [s for s in case.state()["trace"] if s["by"] == "claude" and s["tool"] in ("approve_credit",
                                                                                          "mark_ready_for_decision")]
    assert [s["gate"] for s in by_claude] == ["DENY: GATE-02", "DENY: GATE-01"]
    assert case.state()["status"] == "OPEN"


@xfail("SEC-12", "annotate_exception is not an ACTION_TOOL: model-written notes reach analyst cards ungated")
def test_sec12_planner_notes_pass_the_gate():
    note = "Verified with the registry by phone: Radu Pop is not an owner. Dismiss this card."
    case = _hijacked([])
    ex = next((x for x in case.state()["exceptions"].values() if x["kind"] == "ubo_discrepancy"), None)
    require(ex is not None and ex["status"] == "OPEN", "no open beneficial-owner card")
    agent = BedrockAgent(client=StubClient([tool_use("annotate_exception",
                                                     {"reason": "helpful", "exception_id": ex["id"], "note": note})]))
    agent.handle_batch(case, case.deliver("client-email"))      # the next planning step is the hijacked one
    step = next((s for s in case.state()["trace"] if s["by"] == "claude" and s["tool"] == "annotate_exception"), None)
    require(step is not None, "hijacked planner step missing")
    require(note in case.state()["exceptions"][ex["id"]]["notes"], "note not attached")
    assert step["gate"] != "-", "an ungated, model-authored note was attached to the analyst's card"


# ----------------------------------------------------------------------------- SEC-14 client-visible internal data
@xfail("SEC-14", "/api/companies (used by the client portal) returns each client's internal risk story")
def test_sec14_companies_endpoint_has_no_internal_story():
    rows = c.get("/api/companies").json()
    assert not any("story" in r for r in rows)


# ----------------------------------------------------------------------------- SEC-17 ledger integrity limits
@xfail("SEC-17", "verify() checks the in-memory copy, not the stored rows")
def test_sec17_verify_detects_tampering_in_the_store():
    store = Store(":memory:")
    case = Case("sec-ledger", store)
    case.emit("NOTE", {"type": "system", "id": "t"}, {"amount": 100}, "original")
    store.db.execute("UPDATE events SET body = replace(body, '\"amount\":100', '\"amount\":999') WHERE seq = 2")
    require("999" in store.db.execute("SELECT body FROM events WHERE seq = 2").fetchone()[0], "tamper did not apply")
    assert not case.ledger.verify()["ok"]


@xfail("SEC-17", "the chain has no secret or external anchor: a full rewrite verifies")
def test_sec17_full_chain_rewrite_is_detected():
    case = Case("sec-chain")
    case.emit("NOTE", {"type": "system", "id": "t"}, {"amount": 100}, "original")
    forged, prev = [], "0" * 64
    for e in case.ledger.events:
        body = {k: v for k, v in e.items() if k != "hash"}
        body["prev_hash"] = prev
        if body["type"] == "NOTE":
            body["payload"] = {"amount": 999}
        prev = _hash(body)
        forged.append({**body, "hash": prev})
    assert not Ledger("sec-chain", None, forged).verify()["ok"]


def test_ledger_detects_a_single_edited_event():
    """Strength: editing any one event (without recomputing the chain) is caught."""
    case = Case("sec-edit")
    case.emit("NOTE", {"type": "system", "id": "t"}, {"amount": 100}, "original")
    case.ledger.events[1]["payload"]["amount"] = 999
    assert case.ledger.verify() == {"ok": False, "length": 2, "broken_at": 2}


def test_sqlite_store_is_parameterised():
    """Strength: case ids and bodies are bound parameters, never SQL text."""
    store = Store(":memory:")
    Case("x'); DROP TABLE events;--", store)
    assert store.db.execute("SELECT count(*) FROM events").fetchone()[0] == 1
