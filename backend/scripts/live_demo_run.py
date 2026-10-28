"""Run the README demo once with AGENT_MODE=bedrock and JUDGE_MODE=featherless (from .env)."""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # repo root
sys.path.insert(0, str(ROOT / "backend"))
from fastapi.testclient import TestClient  # noqa: E402

from app.main import AGENT, app  # noqa: E402

c = TestClient(app)
print("agent mode:", AGENT.mode)


def show(label, b, t0):
    reqs = " ".join(f"{r['id']}:{r['status'][:4]}" for r in b["requirements"])
    tr = b["trace"]
    fallbacks = sum(1 for s in tr if "falling back" in s["reason"])
    denies = [f"{s['tool']}({s['gate']})" for s in tr if s["gate"].startswith("DENY")]
    print(f"{label:<28} {time.time() - t0:6.1f}s  status={b['case']['status']:<18} {reqs}  steps={len(tr)}  "
          f"open_ex={sum(1 for x in b['exceptions'] if x['status'] == 'OPEN')}  fallbacks={fallbacks}  "
          f"agent_status={b['config']['agent_status']}  denies={denies}")


steps = [("reset", "post", "/api/demo/reset", {}),
         ("day0 pack", "post", "/api/cases/demo-1/inbound", {"item_id": "day0-pack"}),
         ("+3 days", "post", "/api/cases/demo-1/advance", {"days": 3}),
         ("onrc cert", "post", "/api/cases/demo-1/inbound", {"item_id": "onrc-cert"}),
         ("client email", "post", "/api/cases/demo-1/inbound", {"item_id": "client-email"})]
for label, _, url, body in steps:
    t0 = time.time()
    b = c.post(url, json=body).json()
    show(label, b, t0)

for kind, action in (("address_uncertain", "same_address"), ("ubo_discrepancy", "confirm_discrepancy")):
    ex = next((x for x in b["exceptions"] if x["kind"] == kind and x["status"] == "OPEN"), None)
    if ex is None:
        print(f"no open {kind} card — skipping")
        continue
    if ex.get("judge"):
        print("   judge:", ex["judge"]["probs"], ex["judge"].get("source"))
    t0 = time.time()
    b = c.post(f"/api/cases/demo-1/exceptions/{ex['id']}/resolve", json={"action_id": action}).json()
    show(f"resolve {action}", b, t0)

for label, url, body in (("updated docs", "/api/cases/demo-1/inbound", {"item_id": "updated-docs"}),
                         ("+7 days", "/api/cases/demo-1/advance", {"days": 7}),
                         ("fresh onrc", "/api/cases/demo-1/inbound", {"item_id": "fresh-onrc"})):
    t0 = time.time()
    b = c.post(url, json=body).json()
    show(label, b, t0)

print("verify:", c.get("/api/cases/demo-1/verify").json())
print("\nlast 8 agent reasons:")
for s in b["trace"][-8:]:
    print(f"  [{s['gate']:<14}] {str(s.get('by')):<10} {s['tool']:<24} {s['reason'][:110]}")


