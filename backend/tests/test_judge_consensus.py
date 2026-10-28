"""Auto-accept needs the classifier AND the independent similarity check to agree (calibrated on eval/pairs.jsonl)."""
from app import judge


def test_overconfident_classifier_alone_cannot_auto_accept(monkeypatch):
    monkeypatch.setenv("JUDGE_MODE", "featherless")
    monkeypatch.setattr(judge, "_featherless_cached",
                        lambda kind, a, b: ({"same_address": 1.0, "different_address": 0.0}, "featherless (cached)"))
    j = judge.judge("address", "Str. Gării nr. 4, Arad", "Calea Gării nr. 4, Arad")   # can be different streets
    assert j["p_top"] == 1.0 and j["second_opinion"]["p_same"] < 0.8
    assert j["auto_accept"] is False


def test_agreement_auto_accepts(monkeypatch):
    monkeypatch.setenv("JUDGE_MODE", "featherless")
    monkeypatch.setattr(judge, "_featherless_cached",
                        lambda kind, a, b: ({"same_person": 0.99, "different_person": 0.01}, "featherless (cached)"))
    assert judge.judge("person", "Andrei Munteanu", "MUNTEANU ANDREI")["auto_accept"] is True


def test_calibrated_pairs_have_zero_false_approvals_with_consensus(monkeypatch):
    """Replays the cached Featherless answers on all 150 labelled pairs (no network)."""
    import json
    from pathlib import Path

    rows = [json.loads(l) for l in (Path(judge.__file__).resolve().parents[1] / "eval" / "pairs.jsonl")
            .read_text(encoding="utf-8").splitlines() if l.strip()]
    monkeypatch.setenv("JUDGE_MODE", "featherless")
    monkeypatch.setenv("JUDGE_CACHE", "1")
    monkeypatch.setattr(judge, "featherless_probs", lambda *a: (_ for _ in ()).throw(RuntimeError("no network in tests")))
    accepted = [r for r in rows if judge.judge(r["kind"], r["a"], r["b"])["auto_accept"]]
    assert accepted, "consensus should still auto-accept the clear matches"
    assert [r["id"] for r in accepted if r["label"] != "same"] == []
