"""json_response must send exactly the bytes FastAPI's own encoder would send, for every bundle."""
from datetime import datetime, timezone

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.fastjson import json_response
from app.main import CASES, app, bundle

c = TestClient(app)


def _fastapi_bytes(content) -> bytes:
    return JSONResponse(jsonable_encoder(content)).body


def test_every_bundle_is_byte_identical_to_fastapi_encoding():
    c.post("/api/demo/reset?all=true")
    for item in ("day0-pack", "onrc-cert", "client-email"):  # a demo file with cards, judge output and a trace
        c.post("/api/cases/demo-1/inbound", json={"item_id": item})
    c.post("/api/cases/case-3/messages", json={"role": "client", "text": "Bună ziua, #doc-1 @Radu Pop"})
    for case in CASES.values():
        b = bundle(case)
        fast = json_response(b)
        assert fast.body == _fastapi_bytes(b), case.id
        assert fast.headers["content-type"] == "application/json"
        assert c.get(f"/api/cases/{case.id}/bundle").json() == jsonable_encoder(b)


def test_non_json_values_fall_back_to_the_fastapi_encoder():
    content = {"when": datetime(2026, 10, 29, tzinfo=timezone.utc), "tags": ("a", "b"), "n": {1: 2.5}}
    assert json_response(content).body == _fastapi_bytes(content)
    assert json_response({"s": {"x"}}).body == _fastapi_bytes({"s": {"x"}})
