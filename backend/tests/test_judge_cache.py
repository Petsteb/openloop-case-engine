import json

import requests

from app import judge as J


def _boom(*args, **kwargs):
    raise AssertionError("network call attempted despite a cache hit")


def test_cache_hit_avoids_network(tmp_path, monkeypatch):
    cache = tmp_path / "judge_cache.json"
    monkeypatch.setenv("JUDGE_MODE", "featherless")
    monkeypatch.setenv("JUDGE_CACHE", "1")
    monkeypatch.setenv("JUDGE_CACHE_PATH", str(cache))
    monkeypatch.setenv("FEATHERLESS_MODEL", "test-model")
    monkeypatch.setattr(requests, "post", _boom)

    a, b = "Str. Fagului nr. 7, bl. A2, Cluj-Napoca", "Calea Fagului nr. 7, Cluj-Napoca"
    seeded = {"same_address": 0.31, "different_address": 0.69}
    cache.write_text(json.dumps({J.cache_key("test-model", "address", a, b): {"probs": seeded}}), encoding="utf-8")

    out = J.judge("address", a, b)
    assert out["source"] == "featherless (cached)"
    assert out["probs"] == seeded
    assert out["top"] == "different_address" and out["p_top"] == 0.69


def test_miss_calls_featherless_once_then_hits_cache(tmp_path, monkeypatch):
    cache = tmp_path / "judge_cache.json"
    monkeypatch.setenv("JUDGE_MODE", "featherless")
    monkeypatch.setenv("JUDGE_CACHE", "1")
    monkeypatch.setenv("JUDGE_CACHE_PATH", str(cache))
    monkeypatch.setenv("FEATHERLESS_MODEL", "test-model")
    calls = []

    class Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"answers": {"match": {"probabilities": {"same_person": 0.97, "different_person": 0.03}}}}

    monkeypatch.setattr(requests, "post", lambda *a, **k: calls.append(1) or Resp())
    first = J.judge("person", "Andrei Munteanu", "MUNTEANU ANDREI")
    assert first["source"] == "featherless" and len(calls) == 1
    assert J.cache_key("test-model", "person", "Andrei Munteanu", "MUNTEANU ANDREI") in json.loads(cache.read_text(encoding="utf-8"))

    monkeypatch.setattr(requests, "post", _boom)
    second = J.judge("person", "Andrei Munteanu", "MUNTEANU ANDREI")
    assert second["source"] == "featherless (cached)" and second["probs"] == first["probs"]


def test_fallback_is_never_cached(tmp_path, monkeypatch):
    cache = tmp_path / "judge_cache.json"
    monkeypatch.setenv("JUDGE_MODE", "featherless")
    monkeypatch.setenv("JUDGE_CACHE", "1")
    monkeypatch.setenv("JUDGE_CACHE_PATH", str(cache))
    monkeypatch.setenv("FEATHERLESS_MODEL", "test-model")

    def fail(*args, **kwargs):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(requests, "post", fail)
    out = J.judge("person", "Radu Pop", "Radu Popa")
    assert out["source"].startswith("heuristic (featherless failed")
    assert not cache.exists() or json.loads(cache.read_text(encoding="utf-8")) == {}


def test_cache_disabled_always_calls_network(tmp_path, monkeypatch):
    cache = tmp_path / "judge_cache.json"
    monkeypatch.setenv("JUDGE_MODE", "featherless")
    monkeypatch.setenv("JUDGE_CACHE", "0")
    monkeypatch.setenv("JUDGE_CACHE_PATH", str(cache))
    monkeypatch.setenv("FEATHERLESS_MODEL", "test-model")
    cache.write_text(json.dumps({J.cache_key("test-model", "person", "a b", "b a"): {"probs": {"same_person": 0.99, "different_person": 0.01}}}))
    monkeypatch.setattr(requests, "post", lambda *a, **k: (_ for _ in ()).throw(requests.ConnectionError("down")))
    out = J.judge("person", "a b", "b a")
    assert out["source"].startswith("heuristic (featherless failed")
