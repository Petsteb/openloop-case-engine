"""Client email notifications: client-safe, one per step, audited, never breaking the case."""
import os

os.environ["AGENT_MODE"] = "scripted"
os.environ["JUDGE_MODE"] = "heuristic"
os.environ["EMAIL_MODE"] = "outbox"

from fastapi.testclient import TestClient  # noqa: E402

from app import notifier  # noqa: E402
from app.main import CASES, app  # noqa: E402

c = TestClient(app)


def emails():
    return [e for e in CASES["demo-1"].ledger.events if e["type"] in ("EMAIL_SENT", "EMAIL_FAILED")]


def test_outbox_email_lists_requested_documents():
    c.post("/api/demo/reset")
    b = c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"}).json()
    assert len(emails()) == 1
    body = emails()[0]["payload"]["body"]
    assert "Certificatul constatator ONRC" in body and "Certificatul de atestare fiscală" in body
    assert b["outbox"][0]["subject"].startswith("Documente necesare")


def test_no_internal_details_ever_reach_the_client():
    c.post("/api/demo/reset")
    for item in ("day0-pack", "onrc-cert", "client-email", "staff-phone-change", "staff-credit-check"):
        c.post("/api/cases/demo-1/inbound", json={"item_id": item})
    text = " ".join(e["payload"]["subject"] + e["payload"]["body"] for e in emails()).lower()
    for word in ("radu", "discrep", "judge", "e-0317", "risc", "hold", "compliance", "%"):
        assert word not in text, word


def test_flush_is_idempotent():
    c.post("/api/demo/reset")
    c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"})
    assert notifier.flush(CASES["demo-1"]) is None


def test_ready_email_after_file_completes():
    c.post("/api/demo/reset")
    for item in ("day0-pack", "onrc-cert"):
        c.post("/api/cases/demo-1/inbound", json={"item_id": item})
    b = c.get("/api/cases/demo-1/bundle").json()
    for x in [x for x in b["exceptions"] if x["status"] == "OPEN"]:
        action = "same_address" if x["kind"] == "address_uncertain" else "confirm_discrepancy"
        c.post(f"/api/cases/demo-1/exceptions/{x['id']}/resolve", json={"action_id": action})
    c.post("/api/cases/demo-1/inbound", json={"item_id": "updated-docs"})
    assert any("Dosar complet" in e["payload"]["subject"] for e in emails())


def test_gmail_failure_is_logged_not_raised(monkeypatch):
    monkeypatch.setenv("EMAIL_MODE", "gmail")
    monkeypatch.delenv("GMAIL_USER", raising=False)
    c.post("/api/demo/reset")
    r = c.post("/api/cases/demo-1/inbound", json={"item_id": "day0-pack"})
    assert r.status_code == 200
    assert emails()[-1]["type"] == "EMAIL_FAILED"
    assert c.get("/api/cases/demo-1/verify").json()["ok"]
