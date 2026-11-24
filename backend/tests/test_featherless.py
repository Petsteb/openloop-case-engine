"""Featherless (OpenAI-compatible chat API with tool calling) behind the Anthropic-shaped client the agent and the
case chat use: client.messages.create(...) -> .content (text / tool_use blocks), .stop_reason, .usage."""
import json
import os

os.environ["AGENT_MODE"] = "scripted"
os.environ["JUDGE_MODE"] = "heuristic"
os.environ["EMAIL_MODE"] = "outbox"

import pytest  # noqa: E402

from app import chat, llm  # noqa: E402
from app.agent import BedrockAgent, make_agent  # noqa: E402
from app.engine import Case  # noqa: E402


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code, self.payload = status_code, payload

    def json(self):
        return self.payload


class FakeSession:
    """Records every POST and answers from a queue (the HTTP layer is the only thing replaced)."""

    def __init__(self, responses):
        self.responses, self.posts = list(responses), []

    def post(self, url, json=None, headers=None, timeout=None):
        self.posts.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        return self.responses.pop(0)


def reply(content=None, tool_calls=(), reasoning=None, finish="stop", usage=(100, 20)):
    msg = {"role": "assistant", "content": content}
    if tool_calls:
        msg["tool_calls"] = [{"id": f"call_{i}", "type": "function", "function": {"name": n, "arguments": json.dumps(a)}}
                             for i, (n, a) in enumerate(tool_calls)]
    if reasoning:
        msg["reasoning_content"] = reasoning
    return FakeResponse(200, {"choices": [{"message": msg, "finish_reason": "tool_calls" if tool_calls else finish}],
                              "usage": {"prompt_tokens": usage[0], "completion_tokens": usage[1]}})


def client(*responses):
    session = FakeSession(responses)
    return llm.FeatherlessClient("test-key", session=session), session


def ask(c, messages=None, tools=(), model="org/model"):
    return c.messages.create(model=model, max_tokens=100, system="sys", tools=list(tools),
                             messages=messages or [{"role": "user", "content": "q"}])


def test_tool_call_reply_becomes_a_tool_use_block():
    c, _ = client(reply(tool_calls=[("get_issues", {"status": "open"})]))
    r = ask(c)
    [b] = [b for b in r.content if b.type == "tool_use"]
    assert (r.stop_reason, b.name, b.input, b.id) == ("tool_use", "get_issues", {"status": "open"}, "call_0")
    assert (r.usage.input_tokens, r.usage.output_tokens) == (100, 20)


def test_second_turn_sends_openai_messages_with_tool_results_and_prior_reasoning():
    tools = [{"name": "get_issues", "description": "Issues", "input_schema": {"type": "object", "properties": {}}}]
    c, session = client(reply(tool_calls=[("get_issues", {})], reasoning="I should list the issues."), reply(content="done"))
    msgs = [{"role": "user", "content": "q"}]
    r1 = ask(c, msgs, tools)
    msgs += [{"role": "assistant", "content": r1.content},
             {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "call_0", "content": "<case_data>x</case_data>"}]}]
    r2 = ask(c, msgs, tools)
    body = session.posts[1]["json"]
    assert body["model"] == "org/model"
    assert body["tools"] == [{"type": "function", "function": {"name": "get_issues", "description": "Issues",
                                                               "parameters": {"type": "object", "properties": {}}}}]
    assert [m["role"] for m in body["messages"]] == ["system", "user", "assistant", "tool"]
    assistant = body["messages"][2]
    assert assistant["tool_calls"][0]["function"] == {"name": "get_issues", "arguments": "{}"}
    assert assistant["reasoning_content"] == "I should list the issues."  # agentic thinking is carried forward
    assert body["messages"][3] == {"role": "tool", "tool_call_id": "call_0", "content": "<case_data>x</case_data>"}
    assert body["chat_template_kwargs"]["enable_thinking"] is True
    assert (r2.stop_reason, r2.content[-1].text) == ("end_turn", "done")
    assert session.posts[0]["headers"]["Authorization"] == "Bearer test-key"


def test_truncated_reply_reports_max_tokens():
    c, _ = client(reply(content="partial", finish="length"))
    assert ask(c).stop_reason == "max_tokens"


def test_busy_model_raises_so_callers_fall_back():
    c, _ = client(FakeResponse(200, {"error": {"message": "This model is busy, please try again later."}}))
    with pytest.raises(RuntimeError, match="busy"):
        ask(c)


def test_http_error_raises():
    c, _ = client(FakeResponse(429, {"error": {"message": "rate limited"}}))
    with pytest.raises(RuntimeError, match="429"):
        ask(c)


def test_deadline_timeout_reaches_the_http_call():
    """llm.create narrows the client to the time left via with_options; the HTTP call must honour it."""
    c, session = client(reply(content="ok"))
    ask(c.with_options(timeout=7.5, max_retries=0))
    assert session.posts[0]["timeout"] == 7.5


def test_agent_mode_featherless_selects_the_featherless_client_and_model(monkeypatch):
    monkeypatch.setenv("AGENT_MODE", "featherless")
    monkeypatch.setenv("FEATHERLESS_API_KEY", "k")
    monkeypatch.delenv("FEATHERLESS_CHAT_MODEL", raising=False)
    assert isinstance(llm.make_client(), llm.FeatherlessClient)
    assert llm.model_id() == "Qwen/Qwen3.8-2.4T-A95B"
    monkeypatch.setenv("FEATHERLESS_CHAT_MODEL", "zai-org/GLM-5.3")
    assert llm.model_id() == "zai-org/GLM-5.3"


def test_featherless_without_a_key_refuses(monkeypatch):
    monkeypatch.setenv("AGENT_MODE", "featherless")
    monkeypatch.setenv("FEATHERLESS_API_KEY", "")
    monkeypatch.setenv("AWS_BEARER_TOKEN_BEDROCK", "a-bedrock-key")  # must not silently fall through to Bedrock
    with pytest.raises(RuntimeError, match="FEATHERLESS_API_KEY"):
        llm.make_client()


def test_chat_answers_through_featherless_and_labels_the_mode(monkeypatch):
    monkeypatch.setenv("AGENT_MODE", "featherless")
    monkeypatch.delenv("FEATHERLESS_CHAT_MODEL", raising=False)
    c, session = client(reply(tool_calls=[("get_overview", {})]), reply(content="Your file is under review."))
    out = chat.answer(Case("fl-chat"), "client", "Where is my file?", [], client=c)
    assert (out["mode"], out["answer"]) == ("featherless", "Your file is under review.")
    assert session.posts[0]["json"]["model"] == "Qwen/Qwen3.8-2.4T-A95B"


def test_planner_steps_by_an_open_model_are_not_labelled_claude(monkeypatch):
    monkeypatch.setenv("AGENT_MODE", "featherless")
    c, _ = client(reply(tool_calls=[("get_case_state", {"reason": "Check state"})]), reply(content="No action needed"))
    case, agent = Case("fl-agent"), BedrockAgent(client=c)
    agent.handle_batch(case, case.deliver("day0-pack"))
    step = next(s for s in case.state()["trace"] if s["tool"] == "get_case_state" and s["reason"] == "Check state")
    assert (step["by"], agent.mode) == ("llm", "featherless")


def test_make_agent_builds_the_llm_planner_in_featherless_mode(monkeypatch):
    monkeypatch.setenv("AGENT_MODE", "featherless")
    monkeypatch.setenv("FEATHERLESS_API_KEY", "k")
    assert make_agent().mode == "featherless"
