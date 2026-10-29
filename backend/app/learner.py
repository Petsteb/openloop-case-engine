"""Learning from analysts: repeated rulings become a reusable check, proposed, backtested, and promoted
only by a second person (maker-checker).

The judge sees two address strings and can't tell "Str. Fagului 7" from "Calea Fagului 7" (in Romania they
can be different streets). Analysts settle it with a fact the judge question doesn't carry: the postal code.
After MIN_SUPPORT matching rulings, OpenLoop proposes a check that encodes exactly that rule.
Promoted checks live in a module registry (the bank's rulebook, not one case), so they survive a demo reset.
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from .judge import NOISE, STREET_TYPES
from .rules import norm_text

EVAL = Path(__file__).resolve().parents[1] / "eval"
HISTORY = EVAL / "history_rulings.jsonl"
CASES = EVAL / "address_cases.jsonl"
MIN_SUPPORT = 3
PROPOSAL_ID = "P-address-variant"
DESCRIPTION = ("In cities whose postal codes identify the street: same street name and number, same city and postal "
               "code; only the street type differs (Str./Calea/Bd.) and building details (bl., sc., ap.) may be omitted")
BUILDING = {"bl", "sc", "ap", "et"}
# Romanian municipalities use street-level postal codes; small localities often share one code for every street,
# so there "Str. Gării" and "Calea Gării" with the same code can still be different streets.
STREET_LEVEL_POSTAL_CITIES = [("cluj", "napoca"), ("timisoara",), ("sibiu",), ("oradea",), ("constanta",), ("craiova",),
                              ("galati",), ("ploiesti",), ("arad",), ("bacau",), ("brasov",), ("iasi",), ("bucuresti",)]
PROMOTED: list[dict] = []


def _core(address: str) -> set[str]:
    toks, out, skip = norm_text(address).split(), set(), False
    for t in toks:
        if t in ("jud", "judet", "judetul"):  # the county is not the locality ("Sântana, jud. Arad" is not Arad)
            break
        if skip:
            skip = False
            continue
        if t in BUILDING:
            skip = True
            continue
        if t in STREET_TYPES or t in STREET_TYPES.values() or t in NOISE:
            continue
        out.add(t)
    return out


def check_matches(a: str, b: str, postal_a: str, postal_b: str, street_level_only: bool = True) -> bool:
    """The composite check: postal codes equal and identical street name, number and city once types are ignored,
    and (by default) only in cities whose postal codes are street-level."""
    pa, pb = re.sub(r"\D", "", postal_a or ""), re.sub(r"\D", "", postal_b or "")
    core = _core(a)
    if not (pa and pa == pb and core and core == _core(b)):
        return False
    return not street_level_only or any(set(city) <= core for city in STREET_LEVEL_POSTAL_CITIES)


_ROWS: dict[str, tuple] = {}  # path -> ((mtime, size), rows): every bundle asks for proposals, the file rarely changes


def _rows(path: Path) -> list[dict]:
    try:
        stat = path.stat()
    except OSError:
        return []
    stamp, hit = (stat.st_mtime_ns, stat.st_size), _ROWS.get(str(path))
    if hit is None or hit[0] != stamp:
        hit = _ROWS[str(path)] = (stamp, [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()])
    return [dict(r) for r in hit[1]]  # callers get their own rows


def _rulings(st: dict) -> list[dict]:
    live = [{"a": p["a"], "b": p["b"], "postal_a": (p.get("postal") or ["", ""])[0], "postal_b": (p.get("postal") or ["", ""])[1],
             "decision": p["decision"], "analyst": p.get("analyst", "analyst-1"), "source": p["exception_id"]}
            for p in st.get("precedents", [])]
    return _rows(HISTORY) + live


def proposals(st: dict) -> list[dict]:
    support = [r for r in _rulings(st) if r["decision"] == "same_address"
               and check_matches(r["a"], r["b"], r["postal_a"], r["postal_b"])]
    if len(support) < MIN_SUPPORT or any(c["proposal_id"] == PROPOSAL_ID for c in PROMOTED):
        return []
    return [{"id": PROPOSAL_ID, "kind": "address_variant", "support": len(support),
             "ruled_by": sorted({r["analyst"] for r in support}), "description": DESCRIPTION,
             "examples": [{"a": r["a"], "b": r["b"], "source": r.get("source", "history")} for r in support[-3:]]}]


def backtest(proposal_id: str) -> dict:
    if proposal_id != PROPOSAL_ID:
        raise KeyError(proposal_id)
    rows = _rows(CASES)
    hits = [r for r in rows if check_matches(r["a"], r["b"], r["postal_a"], r["postal_b"])]
    false_approvals = [r["id"] for r in hits if r["label"] != "same"]
    naive = [r for r in rows if check_matches(r["a"], r["b"], r["postal_a"], r["postal_b"], street_level_only=False)]
    return {"n": len(rows), "auto_resolved": len(hits), "false_approvals": len(false_approvals),
            "false_approval_ids": false_approvals, "manual_review_rate": round(1 - len(hits) / len(rows), 3) if rows else None,
            "same_pairs_caught": sum(1 for r in hits if r["label"] == "same"),
            "same_pairs_total": sum(1 for r in rows if r["label"] == "same"),
            # what the rule would have done without the street-level-postal-code condition (small-town counterexamples)
            "naive_rule_false_approvals": sum(1 for r in naive if r["label"] != "same")}


def promote(st: dict, proposal_id: str, by: str) -> dict:
    """Maker-checker: the promoter must not be one of the analysts whose rulings created the proposal."""
    prop = next((p for p in proposals(st) if p["id"] == proposal_id), None)
    if prop is None:
        raise KeyError(proposal_id)
    if not by.strip() or by.strip() in prop["ruled_by"]:
        raise PermissionError("the promoter must be a different person from the analysts who ruled")
    check = {"id": f"LC-{len(PROMOTED) + 1}", "proposal_id": proposal_id, "description": DESCRIPTION,
             "promoted_by": by.strip(), "promoted_at": datetime.now(timezone.utc).isoformat(),
             "support": prop["support"], "backtest": backtest(proposal_id)}
    PROMOTED.append(check)
    return check


def promoted_check_for(a: str, b: str, postal_a: str, postal_b: str) -> dict | None:
    return next((c for c in PROMOTED if c["proposal_id"] == PROPOSAL_ID and check_matches(a, b, postal_a, postal_b)), None)
