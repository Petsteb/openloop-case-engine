"""Fuzzy judge for matches that exact code comparison can't settle (addresses, names).

The judge only answers "are these the same?" with probabilities; code decides what happens.
`heuristic` works offline; `featherless` calls Simple JEV (/v1/classifier) and falls back to
the heuristic on any error.
"""
import json
import os

import requests

from .rules import norm_text
from .template import JUDGE_THRESHOLD

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


def featherless_probs(kind: str, a: str, b: str) -> dict:
    key = os.environ.get("FEATHERLESS_API_KEY", "")
    url = os.environ.get("FEATHERLESS_URL") or ("https://api.featherless.ai/v1/classifier" if key
                                                 else "https://simple-jev-demo-api.featherless.ai/v1/classifier")
    instructions, criteria = QUESTIONS[kind]
    body = {"model": os.environ.get("FEATHERLESS_MODEL", "featherless-ai/Qwen3.6-35B-A3B-classifier"),
            "state": json.dumps({"value_a": a, "value_b": b}, ensure_ascii=False),
            "questions": {"match": {"type": "choice", "instructions": instructions, "criteria": criteria}}}
    headers = {"Content-Type": "application/json", **({"Authorization": f"Bearer {key}"} if key else {})}
    r = requests.post(url, json=body, headers=headers, timeout=20)
    r.raise_for_status()
    probs = r.json()["answers"]["match"]["probabilities"]
    return {k: round(float(v), 2) for k, v in probs.items()}


def judge(kind: str, a: str, b: str) -> dict:
    mode = os.environ.get("JUDGE_MODE", "heuristic")
    source = mode
    try:
        probs = featherless_probs(kind, a, b) if mode == "featherless" else heuristic_probs(kind, a, b)
    except Exception as exc:  # judge outage must not stop the case: fall back, and say so
        probs, source = heuristic_probs(kind, a, b), f"heuristic (featherless failed: {type(exc).__name__})"
    top = max(probs, key=probs.get)
    return {"question": QUESTIONS[kind][0], "probs": probs, "top": top, "p_top": probs[top],
            "threshold": JUDGE_THRESHOLD, "source": source, "a": a, "b": b}
