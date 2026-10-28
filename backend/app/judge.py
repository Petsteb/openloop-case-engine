"""Fuzzy judge for matches that exact code comparison can't settle (addresses, names).

The judge only answers "are these the same?" with probabilities; code decides what happens.
`heuristic` works offline; `featherless` calls Simple JEV (/v1/classifier) and falls back to
the heuristic on any error. Featherless answers are cached on disk (JUDGE_CACHE=1, the default) so the
calibration run and a live demo are repeatable and free; the fallback is never cached.
"""
import hashlib
import json
import os
import tempfile
import threading
from pathlib import Path

import requests

from .rules import norm_text
from .template import HEURISTIC_THRESHOLD, JUDGE_THRESHOLD

SAME_LABEL = {"address": "same_address", "person": "same_person"}

STREET_TYPES = {"str": "strada", "strada": "strada", "calea": "calea", "bd": "bulevardul", "bulevardul": "bulevardul",
                "sos": "soseaua", "soseaua": "soseaua", "aleea": "aleea", "piata": "piata"}
NOISE = {"nr", "jud", "judet", "judetul", "cod", "postal", "mun", "municipiul", "sediu", "sediul", "social"}

QUESTIONS = {
    "address": ("Do these two registered-office addresses refer to the same physical place? "
                "Formatting, abbreviations and word order may differ; a different street type "
                "(e.g. Strada vs Calea) or number can mean a different place.",
                {"same_address": "Same place, only formatting differs", "different_address": "Different place"}),
    "person": ("Do these two strings name the same person? Order, case and diacritics may differ.",
               {"same_person": "Same person", "different_person": "Different person"}),
}


def _tokens(s: str) -> tuple[set[str], set[str]]:
    toks = [STREET_TYPES.get(t, t) for t in norm_text(s).split()]
    types = {t for t in toks if t in STREET_TYPES.values()}
    return {t for t in toks if t not in NOISE}, types


def heuristic_probs(kind: str, a: str, b: str) -> dict:
    labels = list(QUESTIONS[kind][1])
    ta, types_a = _tokens(a)
    tb, types_b = _tokens(b)
    jaccard = len(ta & tb) / len(ta | tb) if ta | tb else 0.0
    if kind == "address" and types_a and types_b and types_a != types_b:
        jaccard *= 0.8
    p_same = round(min(0.97, 0.15 + 0.82 * jaccard), 2)
    return {labels[0]: p_same, labels[1]: round(1 - p_same, 2)}


def featherless_model() -> str:
    default = ("featherless-ai/gemma-4-26B-A4B-classifier" if os.environ.get("FEATHERLESS_API_KEY")  # production endpoint accepts this one
               else "featherless-ai/Qwen3.6-35B-A3B-classifier")  # public demo endpoint
    return os.environ.get("FEATHERLESS_MODEL") or default


def featherless_probs(kind: str, a: str, b: str) -> dict:
    key = os.environ.get("FEATHERLESS_API_KEY", "")
    url = os.environ.get("FEATHERLESS_URL") or ("https://api.featherless.ai/v1/classifier" if key
                                                 else "https://simple-jev-demo-api.featherless.ai/v1/classifier")
    instructions, criteria = QUESTIONS[kind]
    body = {"model": featherless_model(),
            "state": json.dumps({"value_a": a, "value_b": b}, ensure_ascii=False),
            "questions": {"match": {"type": "choice", "instructions": instructions, "criteria": criteria}}}
    headers = {"Content-Type": "application/json", **({"Authorization": f"Bearer {key}"} if key else {})}
    r = requests.post(url, json=body, headers=headers, timeout=20)
    r.raise_for_status()
    probs = r.json()["answers"]["match"]["probabilities"]
    return {k: round(float(v), 2) for k, v in probs.items()}


DEFAULT_CACHE_PATH = Path(__file__).resolve().parents[1] / "eval" / "judge_cache.json"
_CACHE_LOCK = threading.Lock()


def cache_path() -> Path:
    return Path(os.environ.get("JUDGE_CACHE_PATH") or DEFAULT_CACHE_PATH)


def cache_enabled() -> bool:
    return os.environ.get("JUDGE_CACHE", "1") != "0"


def cache_key(model: str, kind: str, a: str, b: str) -> str:
    return hashlib.sha256(f"{model}|{kind}|{a}|{b}".encode("utf-8")).hexdigest()


def _cache_load() -> dict:
    try:
        data = json.loads(cache_path().read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):  # missing or corrupt file is an empty cache
        return {}


def _cache_get(key: str) -> dict | None:
    entry = _cache_load().get(key)
    probs = entry.get("probs") if isinstance(entry, dict) and "probs" in entry else entry
    if isinstance(probs, dict) and probs and all(isinstance(v, (int, float)) for v in probs.values()):
        return {k: float(v) for k, v in probs.items()}
    return None


def _cache_put(key: str, entry: dict) -> None:
    """Read-modify-write under a lock; the file is replaced atomically so a crash never leaves half a file."""
    path = cache_path()
    with _CACHE_LOCK:
        data = _cache_load()
        data[key] = entry
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=path.name + ".", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1, sort_keys=True)
            os.replace(tmp, path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise


def _featherless_cached(kind: str, a: str, b: str) -> tuple[dict, str]:
    if not cache_enabled():
        return featherless_probs(kind, a, b), "featherless"
    model = featherless_model()
    key = cache_key(model, kind, a, b)
    hit = _cache_get(key)
    if hit is not None:
        return hit, "featherless (cached)"
    probs = featherless_probs(kind, a, b)  # raises on error: the fallback below is never written to the cache
    _cache_put(key, {"model": model, "kind": kind, "a": a, "b": b, "probs": probs})
    return probs, "featherless"


def judge(kind: str, a: str, b: str) -> dict:
    """Probabilities plus the auto-accept decision.

    Auto-accept needs the primary judge AND an independent second opinion to agree. On 150 labelled pairs
    (backend/eval/calibration.json) the Featherless classifier alone auto-approved 7 wrong matches at 0.9
    (e.g. Str. Gării vs Calea Gării at p=1.0); requiring the deterministic similarity check to agree at
    >= HEURISTIC_THRESHOLD gave 0 false approvals on tune and test with the same coverage.
    """
    mode = os.environ.get("JUDGE_MODE", "heuristic")
    source = mode
    heur = heuristic_probs(kind, a, b)
    try:
        if mode == "featherless":
            probs, source = _featherless_cached(kind, a, b)
        else:
            probs = heur
    except Exception as exc:  # judge outage must not stop the case: fall back, and say so
        probs, source = heur, f"heuristic (featherless failed: {type(exc).__name__})"
    top = max(probs, key=probs.get)
    same = SAME_LABEL[kind]
    heur_ok = heur[same] >= HEURISTIC_THRESHOLD
    primary_ok = top == same and probs[top] >= (JUDGE_THRESHOLD if source.startswith("featherless") else HEURISTIC_THRESHOLD)
    return {"question": QUESTIONS[kind][0], "probs": probs, "top": top, "p_top": probs[top],
            "threshold": JUDGE_THRESHOLD if source.startswith("featherless") else HEURISTIC_THRESHOLD,
            "second_opinion": {"method": "string similarity", "p_same": heur[same], "threshold": HEURISTIC_THRESHOLD},
            "auto_accept": primary_ok and heur_ok, "source": source, "a": a, "b": b}
