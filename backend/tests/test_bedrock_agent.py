"""Hybrid agent: code pipeline + one Claude planning loop per batch (Claude replaced by a stub)."""
import os

os.environ["AGENT_MODE"] = "scripted"
os.environ["JUDGE_MODE"] = "heuristic"

from app.agent import BedrockAgent  # noqa: E402
from app.engine import Case  # noqa: E402
from stub_llm import Resp, StubClient, tool_use  # noqa: E402


def run(item_ids, client):
    case, agent = Case("t"), BedrockAgent(client=client)
    for item in item_ids:
        agent.handle_batch(case, case.deliver(item))
    return case, agent


def steps(case):
    return case.state()["trace"]


def test_tool_loop_executes_tools_and_logs_reasons():
    case, _ = run(["day0-pack"], StubClient([tool_use("get_case_state", {"reason": "Check state"})]))
    s = next(s for s in steps(case) if s["by"] == "claude")
    assert (s["tool"], s["reason"]) == ("get_case_state", "Check state")


def test_llm_failure_falls_back_to_scripted():
    case, agent = run(["day0-pack"], StubClient([TimeoutError("slow")]))
    assert any("falling back to scripted planner" in s["reason"] for s in steps(case))
    assert agent.status.startswith("fallback")


def test_refusal_falls_back_to_scripted():
    case, agent = run(["day0-pack"], StubClient([Resp([], "refusal")]))
    assert agent.status.startswith("fallback")


def test_safety_net_runs_follow_up():
    case, _ = run(["day0-pack"], StubClient())
    assert any(s["tool"] == "request_document" and s["input"].get("key") == "onrc_certificate" and s["gate"] == "ALLOW"
               for s in steps(case))


def test_pipeline_runs_even_if_llm_does_nothing():
    case, _ = run(["day0-pack"], StubClient())
    assert case.state()["reqs"]["R4"]["status"] == "SATISFIED"
    agent = BedrockAgent(client=StubClient())
    agent.handle_batch(case, case.deliver("onrc-cert"))
    kinds = {x["kind"] for x in case.state()["exceptions"].values() if x["status"] == "OPEN"}
    assert {"ubo_discrepancy", "address_uncertain"} <= kinds


def test_one_llm_loop_per_batch():
    client = StubClient()
    run(["day0-pack"], client)                                # 4 documents, one click
    assert client.calls == 1


def test_claude_cannot_call_pipeline_tools():
    case, _ = run(["day0-pack"], StubClient([tool_use("check_requirement", {"reason": "x", "req_id": "R1"})]))
    assert not any(s["by"] == "claude" and s["tool"] == "check_requirement" for s in steps(case))


def test_bank_docai_adapter_reads_financials():
    case, _ = run(["day0-pack"], StubClient())
    ext = next(s for s in steps(case) if s["tool"] == "extract_fields" and "ebitda" in s["output"])
    assert ext["output"]["extractor"] == "bank_docai"


def test_unverifiable_field_from_adapter_is_rejected(monkeypatch):
    monkeypatch.setenv("DOCAI_CURVEBALL", "1")
    case, _ = run(["day0-pack"], StubClient())
    fin = next(d for d in case.state()["docs"].values() if d["type"] == "financial_statement")
    fields = {f["field"] for f in case.state()["extractions"][fin["id"]]["fields"]}
    assert "net_debt" not in fields                          # its quote is not in the document
    assert case.state()["reqs"]["R4"]["status"] == "SATISFIED"
