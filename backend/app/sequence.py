"""Sequence rules: patterns that only show up in the order of events, never in a single document.

SR-01 mirrors the real ANSPDCP case against Raiffeisen Bank Romania (Nov 2024): an employee changed clients'
contact details and then opened products in their name. Evaluation is pure over the ledger; raising the
exception is done by code (actor = engine), never by a model.
"""
from datetime import datetime, timedelta

from . import template as T

ENGINE = {"type": "system", "id": "engine"}


def _get(event: dict, path: str):
    head, _, key = path.partition(".")
    return (event.get(head) or {}).get(key)


def find_violations(events: list[dict], rule: dict) -> list[tuple[dict, dict]]:
    """(first, then) event pairs that break the rule: same keys, within the window, no 'unless' event between."""
    firsts = [e for e in events if e["type"] == rule["first"] and e["actor"].get("type") == rule["first_actor_type"]]
    pairs = []
    for f in firsts:
        t_first = datetime.fromisoformat(f["sim_time"])
        for t in events:
            if t["seq"] <= f["seq"] or t["type"] != rule["then"]:
                continue
            if any(_get(t, k) != _get(f, k) for k in rule["same"]):
                continue
            if datetime.fromisoformat(t["sim_time"]) - t_first > timedelta(hours=rule["within_hours"]):
                continue
            cleared = any(u["type"] == rule["unless"] and f["seq"] < u["seq"] < t["seq"]
                          and _get(u, "payload.client_id") == _get(f, "payload.client_id") for u in events)
            if not cleared:
                pairs.append((f, t))
    return pairs


def check(case) -> list[str]:
    """Raise one exception per new violation; returns the new exception ids."""
    st = case.state()
    known = {(x.get("first_seq"), x.get("then_seq")) for x in st["exceptions"].values() if x["kind"] == "sequence_insider"}
    new_ids = []
    for rule in T.SEQUENCE_RULES:
        for f, t in find_violations(case.ledger.events, rule):
            if (f["seq"], t["seq"]) in known:
                continue
            hours = (datetime.fromisoformat(t["sim_time"]) - datetime.fromisoformat(f["sim_time"])).total_seconds() / 3600
            staff, field = f["actor"].get("id"), f["payload"].get("field", "contact details")
            action = t["payload"].get("action", "credit action").replace("_", " ")
            ex_id = case._next_id("EX", "exceptions")
            case.emit("EXCEPTION_RAISED", ENGINE, {
                "id": ex_id, "requirement_id": "MON", "kind": "sequence_insider", "severity": "high",
                "title": "Possible insider pattern: contact change, then credit action",
                "summary": f"Employee {staff} changed the client's {field} (#{f['seq']}) and {hours:.0f} h later ran a "
                           f"{action} (#{t['seq']}) for the same client, with no client confirmation in between.",
                "rule": {"id": rule["id"], "text": T.RULES[rule["id"]]},
                "snippets": [{"doc_id": None, "label": f"Ledger #{f['seq']}", "quote": f["summary"]},
                             {"doc_id": None, "label": f"Ledger #{t['seq']}", "quote": t["summary"]}],
                "judge": None, "first_seq": f["seq"], "then_seq": t["seq"],
                "actions": [{"id": "escalate_compliance", "label": "Put on hold and escalate to compliance"},
                            {"id": "legitimate", "label": "Legitimate: client confirmed by phone"}]},
                f"{ex_id} raised: {rule['id']} insider pattern")
            new_ids.append(ex_id)
    return new_ids
