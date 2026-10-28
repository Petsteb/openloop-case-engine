"""Client portal backend: uploads (real, sample, wrong company, PDF), confirmations, client-view."""
import base64
import json

from fastapi.testclient import TestClient

from app.main import CASES, app

c = TestClient(app)


def post(item):
    return c.post("/api/cases/demo-1/inbound", json={"item_id": item}).json()


def b64(text: str) -> str:
    return base64.b64encode(text.encode()).decode()


def start():
    c.post("/api/demo/reset")
    post("day0-pack")                                    # requests: onrc, fiscal, id_card:Elena Munteanu


def test_sample_upload_fulfils_the_request_and_runs_the_pipeline():
    start()
    v = c.post("/api/cases/demo-1/upload-sample", json={"key": "fiscal_certificate"}).json()
    assert "fiscal_certificate" not in {m["key"] for m in v["missing_documents"]}
    assert CASES["demo-1"].state()["reqs"]["R6"]["status"] == "SATISFIED"
    assert any(d["type"] == "fiscal_certificate" and d["status_word"] == "Verified" for d in v["documents"])


def test_real_upload_and_validation():
    start()
    files = c.get("/api/demo/sample-files").json()
    onrc = next(f for f in files if f["key"] == "onrc_certificate" and f["variant"] == "ok")
    text = c.get(f"/api/demo/sample-files/{onrc['filename']}").text
    assert "Cod unic de înregistrare: 94123877" in text
    r = c.post("/api/cases/demo-1/upload", json={"key": "onrc_certificate", "filename": "onrc.txt", "content_b64": b64(text)})
    assert r.status_code == 200
    assert CASES["demo-1"].state()["reqs"]["R1"]["status"] == "SATISFIED"
    bad = {"key": "fiscal_certificate", "filename": "x.exe", "content_b64": b64("x")}
    assert c.post("/api/cases/demo-1/upload", json=bad).status_code == 422
    not_requested = {"key": "application", "filename": "a.txt", "content_b64": b64("x")}
    assert c.post("/api/cases/demo-1/upload", json=not_requested).status_code == 422
    assert c.post("/api/cases/demo-1/upload", json={**bad, "filename": "x.txt", "content_b64": "%%%"}).status_code == 422


def test_wrong_company_upload_is_quarantined_and_explained():
    start()
    v = c.post("/api/cases/demo-1/upload-sample", json={"key": "onrc_certificate", "variant": "wrong_company"}).json()
    assert "onrc_certificate" in {m["key"] for m in v["missing_documents"]}            # still needed
    assert any(d["status_word"] == "Not accepted" for d in v["documents"])
    assert CASES["demo-1"].state()["reqs"]["R1"]["status"] == "OPEN_WAITING"           # never used as evidence
    assert "Document neacceptat" in v["emails"][-1]["subject"]
    assert "93052816" not in json.dumps(v)                                            # no other firm's data to the client


def test_id_card_for_another_person_is_quarantined():
    start()
    text = "CARTE DE IDENTITATE (copie)\nNume: POPESCU\nPrenume: MARIA\nCNP: 2••••••\nValabilă până la: 12.03.2031"
    v = c.post("/api/cases/demo-1/upload", json={"key": "id_card:Elena Munteanu", "filename": "ci.txt",
                                                 "content_b64": b64(text)}).json()
    assert any(d["status_word"] == "Not accepted" for d in v["documents"])
    assert "id_card:Elena Munteanu" in {m["key"] for m in v["missing_documents"]}
    case = CASES["demo-1"]
    case.run_tool("check_requirement", {"req_id": "R2"}, "re-check after the upload")
    assert "Elena" in case.state()["reqs"]["R2"]["reason"]                              # still missing her ID
    bad = next(d for d in v["documents"] if d["status_word"] == "Not accepted")
    client = c.get(f"/api/cases/demo-1/documents/{bad['id']}").json()
    assert any("another person" in h["what"] for h in client["history"])


def test_pdf_upload_waits_for_manual_reading():
    start()
    v = c.post("/api/cases/demo-1/upload", json={"key": "fiscal_certificate", "filename": "fiscal.pdf",
                                                 "content_b64": b64("%PDF-1.4 fake")}).json()
    assert any(d["status_word"] == "Received, waiting for manual reading" for d in v["documents"])
    assert CASES["demo-1"].state()["reqs"]["R6"]["status"] == "OPEN_WAITING"


def test_contact_change_confirmation_prevents_the_insider_card():
    c.post("/api/demo/reset")
    post("staff-phone-change")
    v = c.get("/api/cases/demo-1/client-view").json()
    assert v["confirmations"][0]["kind"] == "contact_change" and "phone" in v["confirmations"][0]["text"]
    c.post("/api/cases/demo-1/client-confirm", json={"kind": "contact_change", "answer": "yes"})
    b = post("staff-credit-check")
    assert not any(x["kind"] == "sequence_insider" for x in b["exceptions"])


def test_contact_change_dispute_raises_a_card_and_can_hold_the_file():
    c.post("/api/demo/reset")
    post("staff-phone-change")
    c.post("/api/cases/demo-1/client-confirm", json={"kind": "contact_change", "answer": "no"})
    b = c.get("/api/cases/demo-1/bundle").json()
    card = next(x for x in b["exceptions"] if x["kind"] == "client_dispute")
    c.post(f"/api/cases/demo-1/exceptions/{card['id']}/resolve", json={"action_id": "escalate_compliance"})
    assert c.get("/api/cases/demo-1/bundle").json()["case"]["status"] == "ON_HOLD"
    from app import case_views
    assert card["id"] in case_views.overview(CASES["demo-1"], "employee")["hold"]["reason"]   # chat can say why
    assert "hold" not in case_views.overview(CASES["demo-1"], "client")
    assert c.post("/api/cases/demo-1/client-confirm", json={"kind": "contact_change", "answer": "yes"}).status_code == 409


def test_dispute_has_its_own_rule_and_a_client_visible_trace():
    c.post("/api/demo/reset")
    post("staff-phone-change")
    v = c.post("/api/cases/demo-1/client-confirm", json={"kind": "contact_change", "answer": "no"}).json()
    card = next(x for x in c.get("/api/cases/demo-1/bundle").json()["exceptions"] if x["kind"] == "client_dispute")
    assert card["rule"]["id"] == "SR-02" and "credit action" not in card["rule"]["text"]
    assert "nu ați solicitat" in v["emails"][-1]["body"]                                  # survives a reload
    assert any("did not request the change" in t["what"] for t in v["timeline"])


def test_complete_file_with_an_open_dispute_reads_under_review():
    c.post("/api/demo/reset")
    for item in ("day0-pack", "onrc-cert", "client-email"):
        post(item)
    b = c.get("/api/cases/demo-1/bundle").json()
    for x in b["exceptions"]:   # same address, then confirm the discrepancy (the README order)
        if x["kind"] != "ubo_discrepancy" and x["status"] == "OPEN":
            c.post(f"/api/cases/demo-1/exceptions/{x['id']}/resolve", json={"action_id": x["actions"][0]["id"]})
    ubo = next(x for x in b["exceptions"] if x["kind"] == "ubo_discrepancy")
    c.post(f"/api/cases/demo-1/exceptions/{ubo['id']}/resolve", json={"action_id": "confirm_discrepancy"})
    post("updated-docs")
    assert c.get("/api/cases/demo-1/client-view").json()["overview"]["state"] == "complete"
    post("staff-phone-change")
    v = c.post("/api/cases/demo-1/client-confirm", json={"kind": "contact_change", "answer": "no"}).json()
    assert v["overview"]["state"] == "under_review" and "Complete" not in v["overview"]["status_text"]


def test_quarantined_doc_detail_for_the_bank():
    start()
    c.post("/api/cases/demo-1/upload-sample", json={"key": "onrc_certificate", "variant": "wrong_company"})
    docs = c.get("/api/cases/demo-1/documents", params={"role": "employee"}).json()
    doc = next(d for d in docs if d["status"] == "quarantined")
    bank = c.get(f"/api/cases/demo-1/documents/{doc['id']}", params={"role": "employee"}).json()
    assert "93052816" in bank["quarantine_reason"] and bank["validity"] is None
    assert "(upload)" not in bank["name"]
    client = c.get(f"/api/cases/demo-1/documents/{doc['id']}").json()
    assert "quarantine_reason" not in client and "93052816" not in json.dumps(client["history"])  # text is their own file


def test_an_id_card_sent_before_the_corrected_declaration_is_not_asked_for_again():
    c.post("/api/demo/reset")
    post("day0-pack")
    post("onrc-cert")
    for x in c.get("/api/cases/demo-1/bundle").json()["exceptions"]:
        act = "same_address" if x["kind"] == "address_uncertain" else "confirm_discrepancy"
        c.post(f"/api/cases/demo-1/exceptions/{x['id']}/resolve", json={"action_id": act})
    pending = lambda: [r["key"] for r in CASES["demo-1"].state()["requests"].values() if r["status"] == "PENDING"]
    radu = next(k for k in pending() if "Radu" in k)
    c.post("/api/cases/demo-1/upload-sample", json={"key": radu})
    assert not any("Radu" in k for k in pending())
    for key in [k for k in pending() if k != "fiscal_certificate"]:   # then the declaration and Elena's ID
        c.post("/api/cases/demo-1/upload-sample", json={"key": key})
    assert CASES["demo-1"].state()["reqs"]["R2"]["status"] == "SATISFIED" and not any("id_card" in k for k in pending())


def test_consent_is_recorded_once():
    c.post("/api/demo/reset")
    v = c.post("/api/cases/demo-1/client-confirm", json={"kind": "credit_check_consent", "answer": "yes"}).json()
    assert all(x["kind"] != "credit_check_consent" for x in v["confirmations"])
    assert c.post("/api/cases/demo-1/client-confirm", json={"kind": "credit_check_consent", "answer": "yes"}).status_code == 409


def test_client_view_stays_free_of_internal_details_with_portal_fields():
    start()
    post("onrc-cert")
    post("staff-phone-change")
    post("staff-credit-check")
    blob = json.dumps(c.get("/api/cases/demo-1/client-view").json(), ensure_ascii=False).lower()
    for word in ("radu", "discrep", "judge", "hr-", "sr-", "e-0317", "insider", "compliance", "45%", "25%"):
        assert word not in blob, word
