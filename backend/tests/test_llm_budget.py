"""The cost and load breaker in llm.py: past the budget, paid calls are refused and callers answer offline."""
import pytest

from app import chat, llm
from app.main import CASES
from stub_llm import StubClient, text


@pytest.fixture(autouse=True)
def fresh_budget(monkeypatch):
    monkeypatch.setattr(llm, "BUDGET", llm.Budget())


def test_hourly_budget_refuses_and_chat_falls_back_offline(monkeypatch):
    monkeypatch.setenv("LLM_MAX_CALLS_PER_HOUR", "1")
    client = StubClient([text("first"), text("second")])
    llm.create(client, system="s", messages=[], tools=[])
    with pytest.raises(llm.BudgetExceeded):
        llm.create(client, system="s", messages=[], tools=[])
    assert client.calls == 1 and llm.BUDGET.usage["refused_by_budget"] == 1
    out = chat.answer(CASES["demo-1"], "client", "What do you still need from me?", [], client=client)
    assert out["mode"] == "offline" and client.calls == 1  # no paid call past the budget


def test_concurrency_cap_refuses_instead_of_queueing(monkeypatch):
    monkeypatch.setenv("LLM_MAX_CONCURRENT", "1")
    llm.BUDGET.acquire()  # one call in flight
    with pytest.raises(llm.BudgetExceeded):
        llm.BUDGET.acquire()
    llm.BUDGET.release()
    llm.BUDGET.acquire()  # free again
    llm.BUDGET.release()


def test_a_failed_call_still_frees_its_slot(monkeypatch):
    monkeypatch.setenv("LLM_MAX_CONCURRENT", "1")
    with pytest.raises(TimeoutError):
        llm.create(StubClient([TimeoutError("slow")]), system="s", messages=[], tools=[])
    assert llm.BUDGET.in_flight == 0
