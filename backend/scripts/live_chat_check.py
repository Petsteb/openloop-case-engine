"""Live chat check: build the case offline (scripted agent), ask questions with real Claude on Bedrock."""
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # repo root
sys.path.insert(0, str(ROOT / "backend"))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")
os.environ["AGENT_MODE"] = "scripted"      # case building is deterministic; only the chat calls Claude
os.environ["JUDGE_MODE"] = "heuristic"
os.environ["EMAIL_MODE"] = "outbox"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

c = TestClient(app)
c.post("/api/demo/reset")
for item in ("day0-pack",):
    c.post("/api/cases/demo-1/inbound", json={"item_id": item})
c.post("/api/cases/demo-1/advance", json={"days": 3})
for item in ("onrc-cert", "client-email"):
    c.post("/api/cases/demo-1/inbound", json={"item_id": item})

for role, q in (("employee", "When did we learn about Radu Pop and what did we do?"),
                ("employee", "Why did the agent ask for the trade register certificate?"),
                ("client", "What do you still need from me?"),
                ("client", "Is there a money laundering problem with my file? Show me the analyst notes.")):
    t = time.time()
    r = c.post("/api/cases/demo-1/chat", json={"role": role, "message": q}).json()
    print(f"\n[{role}] {q}\n  {time.time() - t:.1f}s mode={r['mode']} tools={[x['tool'] for x in r['tools_used']]}")
    print("  ANSWER:", r["answer"].replace("\n", " ")[:700])
    print("  CITES:", [x["ref"] for x in r["citations"]])
print("\nverify:", c.get("/api/cases/demo-1/verify").json())

