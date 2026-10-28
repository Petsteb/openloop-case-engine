"""Document list, viewer detail with history, version polling."""
import json

from fastapi.testclient import TestClient

from app.main import app

c = TestClient(app)


def post(item):
    return c.post("/api/cases/demo-1/inbound", json={"item_id": item}).json()


def full_flow_to_fresh_onrc():
    c.post("/api/demo/reset")
    for item in ("day0-pack", "onrc-cert"):
        b = post(item)
    for x in [x for x in b["exceptions"] if x["status"] == "OPEN"]:
        c.post(f"/api/cases/demo-1/exceptions/{x['id']}/resolve",
               json={"action_id": "same_address" if x["kind"] == "address_uncertain" else "confirm_discrepancy"})
    post("updated-docs")
    c.post("/api/cases/demo-1/advance", json={"days": 10})   # the first ONRC certificate expires on day 9
    post("fresh-onrc")


def test_version_changes_only_when_the_ledger_grows():
    c.post("/api/demo/reset")
    v1 = c.get("/api/cases/demo-1/version").json()
    assert c.get("/api/cases/demo-1/version").json() == v1
    post("day0-pack")
    v2 = c.get("/api/cases/demo-1/version").json()
    assert v2["length"] > v1["length"] and v2["status"] == "OPEN"


def test_employee_document_list_statuses():
    full_flow_to_fresh_onrc()
    docs = c.get("/api/cases/demo-1/documents?role=employee").json()
    onrc = [d for d in docs if d["type"] == "onrc_certificate"]
    assert [d["status"] for d in onrc] == ["superseded", "valid"]
    ubo = [d for d in docs if d["type"] == "ubo_declaration"]
    assert [d["status"] for d in ubo] == ["superseded", "valid"]
    fin = next(d for d in docs if d["type"] == "financial_statement")
    assert fin["extractor"] == "bank_docai" and any(u["id"] == "R4" for u in fin["used_by"])


def test_employee_viewer_has_text_fields_offsets_and_history():
    full_flow_to_fresh_onrc()
    docs = c.get("/api/cases/demo-1/documents?role=employee").json()
    old_onrc = next(d for d in docs if d["type"] == "onrc_certificate" and d["status"] == "superseded")
    v = c.get(f"/api/cases/demo-1/documents/{old_onrc['id']}?role=employee").json()
    f = v["fields"][0]
    assert v["text"][f["start"]:f["end"]] == f["quote"]
    whats = " | ".join(h["what"] for h in v["history"])
    for expected in ("Requested from the client", "Received", "Extracted", "Validity ends", "expired", "Superseded by"):
        assert expected in whats, expected
    assert v["validity"]["expired"] is True


def test_client_documents_are_safe():
    full_flow_to_fresh_onrc()
    docs = c.get("/api/cases/demo-1/documents").json()                 # default role = client
    assert all(d["type"] != "email" for d in docs)
    assert all("used_by" not in d and "extractor" not in d for d in docs)
    assert {d["status_word"] for d in docs} <= {"Verified", "Received", "Please send a new one",
                                                  "Replaced by a newer version", "Not accepted"}
    one = c.get(f"/api/cases/demo-1/documents/{docs[0]['id']}").json()
    assert set(one) == {"id", "name", "received_day", "status_word", "text", "history"}
    blob = json.dumps(one["history"]).lower()
    for word in ("r1", "r2", "hr-", "conflict", "card", "judge"):
        assert word not in blob, word


def test_unknown_document_is_404_and_client_cannot_open_emails():
    c.post("/api/demo/reset")
    post("client-email")
    assert c.get("/api/cases/demo-1/documents/doc-99").status_code == 404
    email = next(d for d in c.get("/api/cases/demo-1/documents?role=employee").json() if d["type"] == "email")
    assert c.get(f"/api/cases/demo-1/documents/{email['id']}").status_code == 404
