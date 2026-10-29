"""One writer per file: a slow agent step on one file never holds up writes to another, and concurrent writes to
the same file still leave one linear hash chain."""
import threading
import time

from fastapi.testclient import TestClient

from app import main
from app.main import app

c = TestClient(app)


def test_a_slow_file_does_not_block_another_file(monkeypatch):
    c.post("/api/demo/reset?all=true")
    real = main.AGENT.handle_batch

    def slow_on_case_2(case, events):
        if case.id == "case-2":
            time.sleep(1.5)  # a live model call taking its time
        return real(case, events)

    monkeypatch.setattr(main.AGENT, "handle_batch", slow_on_case_2)
    monkeypatch.setattr(main, "_advance", lambda case, agent, days: agent.handle_batch(case, list(case.advance(days))))
    slow = threading.Thread(target=lambda: c.post("/api/cases/case-2/advance", json={"days": 1}))
    slow.start()
    time.sleep(0.2)  # case-2 is now inside its slow step, holding only its own lock
    t0 = time.monotonic()
    assert c.post("/api/cases/case-3/advance", json={"days": 1}).status_code == 200
    assert time.monotonic() - t0 < 1.0  # did not wait for case-2
    slow.join()


def test_concurrent_writes_to_one_file_keep_one_chain():
    c.post("/api/demo/reset?all=true")
    threads = [threading.Thread(target=lambda: c.post("/api/cases/case-4/advance", json={"days": 1})) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    v = c.get("/api/cases/case-4/verify").json()
    assert v["ok"], v


def test_reset_waits_for_a_write_in_flight_and_ends_clean(monkeypatch):
    c.post("/api/demo/reset?all=true")
    real = main.AGENT.handle_batch
    monkeypatch.setattr(main.AGENT, "handle_batch", lambda case, ev: (time.sleep(0.8), real(case, ev))[1])
    monkeypatch.setattr(main, "_advance", lambda case, agent, days: agent.handle_batch(case, list(case.advance(days))))
    status = {}
    w = threading.Thread(target=lambda: status.update(
        write=c.post("/api/cases/case-5/advance", json={"days": 1}).status_code))
    w.start()
    time.sleep(0.2)
    t0 = time.monotonic()
    assert c.post("/api/demo/reset?all=true").status_code == 200
    assert time.monotonic() - t0 > 0.4  # the reset waited for the write in flight
    w.join()
    assert status["write"] == 200
    assert all(c.get(f"/api/cases/{cid}/verify").json()["ok"] for cid in list(main.CASES))
