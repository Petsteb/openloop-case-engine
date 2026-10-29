"""Case.state() is memoised on the chain head: it must always equal a full reduce of the ledger, be fresh after
every append, and never be changed by the read views that share it."""
import copy
import threading

from app import case_views, messages
from app.agent import ScriptedAgent
from app.engine import ENGINE, Case, reduce
from app.ledger import Ledger


class CheckedLedger(Ledger):
    """After every append, the case's state must already match a full reduce of the new ledger."""
    case: Case | None = None
    checks = 0

    def append(self, *args, **kw):
        ev = super().append(*args, **kw)
        if self.case is not None:
            assert self.case.state() == reduce(self.events), f"stale state after #{ev['seq']} {ev['type']}"
            CheckedLedger.checks += 1
        return ev


def test_state_after_an_append_is_fresh():
    case = Case("memo-1")
    before = case.state()
    assert case.state() is before                                    # no append: the memo answers
    case.emit("CASE_STATUS", ENGINE, {"status": "ON_HOLD", "reason": "test"}, "File on hold")
    after = case.state()
    assert after is not before and after["status"] == "ON_HOLD"     # the append invalidated it
    assert before["status"] == "OPEN"                                # a caller's older snapshot is left as it was
    assert after == reduce(case.ledger.events)


def test_state_matches_a_full_reduce_after_every_append_of_a_whole_case():
    case = Case("memo-2", template="sme_loan", profile_id="medica")
    case.ledger.__class__ = CheckedLedger
    case.ledger.case = case
    agent, CheckedLedger.checks = ScriptedAgent(), 0
    agent.handle_batch(case, [case.ledger.events[0]])
    for item in case.scenario:
        agent.handle_batch(case, case.deliver(item["id"]))
    for fired in case.advance(40):                                   # expiry, reminders: engine-owned appends
        agent.handle(case, fired)
    assert any(x["status"] == "OPEN" for x in case.state()["exceptions"].values())
    assert CheckedLedger.checks > 50 and case.state() == reduce(case.ledger.events)


def test_reloaded_case_state_equals_original():
    case = Case("memo-3", template="sme_loan", profile_id="verde")
    ScriptedAgent().handle_batch(case, [case.ledger.events[0]])
    reloaded = Case("memo-3", events=copy.deepcopy(case.ledger.events))
    assert reloaded.state() == case.state() and reloaded.state() is not case.state()


def test_read_views_do_not_mutate_the_shared_state():
    from app import main
    case = Case("memo-4", template="sme_loan", profile_id="aurora")
    agent = ScriptedAgent()
    for item in ("day0-pack", "onrc-cert", "client-email"):
        agent.handle_batch(case, case.deliver(item))
    messages.post(case, "client", "Hello, is anything missing? #doc-1")
    st = case.state()
    snapshot = copy.deepcopy(st)
    main.bundle(case), main._client_view(case)
    for role in ("client", "employee"):
        case_views.case_row(case, role), case_views.notifications(case, role), case_views.issues(case, role)
        case_views.document_fields(case, role), messages.thread(case, role), messages.mentionables(case, role)
        for d in case_views.documents(case, role):
            case_views.document_detail(case, role, d["id"])
    assert case.state() is st and st == snapshot


def test_concurrent_reads_during_appends_never_cache_a_wrong_state():
    case = Case("memo-5")
    stop, seen = threading.Event(), []

    def reader():
        while not stop.is_set():
            st = case.state()
            seen.append(len(st["trace"]))

    threads = [threading.Thread(target=reader) for _ in range(4)]
    for t in threads:
        t.start()
    for i in range(300):
        case.emit("AGENT_STEP", ENGINE, {"reason": "r", "tool": "get_case_state", "input": {}, "output": {}, "gate": "-"},
                  f"step {i}")
    stop.set()
    for t in threads:
        t.join()
    assert case.state() == reduce(case.ledger.events) and len(case.state()["trace"]) == 300
    assert seen and max(seen) <= 300
