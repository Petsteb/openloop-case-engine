"""Case chat: a client or a bank employee asks questions about one case.

Claude answers only from read-only, role-scoped case tools (case_views.py); the role filter is code, not
prompt. Every factual sentence should cite ledger events [#seq] or documents [doc-N]; code keeps only
citations that exist and that the role may see. The chat never changes the case: it only appends a
CHAT_TURN audit event (done by the API under its write lock, see log_turn).
"""
import hashlib
import json
import re

from . import case_views as V
from . import llm

ROLES = ("client", "employee")
BOTH = {"client", "employee"}

TOOLS = {
    "get_overview": ("Where the file stands: status, checks, number of open items.", {}, BOTH,
                     lambda case, role: V.overview(case, role)),
    "get_missing_documents": ("Documents still needed from the client, when they were requested, reminders.", {}, BOTH,
                              lambda case, role: V.missing_documents(case, role)),
    "get_timeline": ("What happened so far, as ledger events with #seq and day. Optional since_day.",
                     {"since_day": {"type": "integer"}}, BOTH,
                     lambda case, role, since_day=None: V.timeline(case, role, since_day=since_day)),
    "get_issues": ("Issues found so far. status: open | resolved | all.", {"status": {"type": "string"}}, BOTH,
                   lambda case, role, status="all": V.issues(case, role, status)),
    "search_documents": ("Fields from the case documents with verbatim quotes. query matches field, value or document "
                         "name; doc_id narrows to one document.",
                         {"query": {"type": "string"}, "doc_id": {"type": "string"}}, BOTH,
                         lambda case, role, query=None, doc_id=None: V.document_fields(case, role, doc_id=doc_id, query=query)),
    "explain_rule": ("What a rule checks, by rule id (e.g. HR-04, SR-01).", {"rule_id": {"type": "string"}}, BOTH,
                     lambda case, role, rule_id: V.explain_rule(rule_id, role)),
    "explain_step": ("Why the agent took a step: tool, reason, gate verdict, input and output for ledger #seq.",
                     {"seq": {"type": "integer"}}, {"employee"},
                     lambda case, role, seq: V.explain_step(case, role, seq)),
}

SYSTEM = {
    "client": "You help the applicant (a small company) understand their own loan file at the bank. Only use the tools; "
              "never guess. Never speculate about internal reviews, risk or compliance: say the bank is reviewing the "
              "file. Cite facts as [#seq] for events or [doc-N] for documents. Plain, friendly language, at most three "
              "short sentences unless asked for a list. Answer in the language of the question.",
    "employee": "You help a bank analyst audit this case. Use the tools and cite every fact with [#seq] (ledger event) "
                "or [doc-N] (document). When asked why something happened, use explain_step on the relevant steps. "
                "If the answer is not in the case, say so plainly. Be concise and specific: dates (day N), names, "
                "rule ids. Answer in the language of the question.",
}

CITE = re.compile(r"\s?\[(#\d+|doc-\d+)\]")


def tool_defs(role: str) -> list[dict]:
    return [{"name": n, "description": d, "input_schema": {"type": "object", "properties": props, "required": [
        k for k in props if n in ("explain_rule", "explain_step")]}}
            for n, (d, props, roles, _) in TOOLS.items() if role in roles]


def run_tool(case, role: str, name: str, params: dict):
    if name not in TOOLS or role not in TOOLS[name][2]:
        return {"error": "not available for this role"}
    try:
        return TOOLS[name][3](case, role, **params)
    except (TypeError, KeyError, ValueError) as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


def citations(case, role: str, text: str) -> tuple[str, list[dict]]:
    """Keep only markers that exist and that this role may see; strip the rest from the text."""
    visible = {e["seq"]: e["what"] for e in V.timeline(case, role, limit=100000)}
    if role == "employee":
        visible = {e["seq"]: e["summary"] for e in case.ledger.events}
    docs = {d["id"]: d["name"] for d in case.state()["docs"].values()}
    cites, seen = [], set()

    def keep(m: re.Match) -> str:
        ref = m.group(1)
        if ref.startswith("#") and int(ref[1:]) in visible:
            item = {"kind": "event", "ref": ref, "label": visible[int(ref[1:])]}
        elif ref in docs:
            item = {"kind": "doc", "ref": ref, "label": docs[ref]}
        else:
            return ""
        if ref not in seen:
            seen.add(ref)
            cites.append(item)
        return m.group(0)

    return CITE.sub(keep, text).strip(), cites


def offline_answer(case, role: str, message: str) -> str:
    """No model available: a templated answer from the same views, so the demo never goes silent."""
    q = message.lower()
    if any(w in q for w in ("need", "missing", "lips", "trimit", "send", "document")):
        missing = V.missing_documents(case, role)
        return ("Still needed: " + "; ".join(m["label"] for m in missing) + ".") if missing else "Nothing is missing right now."
    if any(w in q for w in ("happen", "so far", "timeline", "history", "pana acum", "până acum", "when", "când")):
        return " ".join(f"Day {e['day']}: {e['what']} [#{e['seq']}]." for e in V.timeline(case, role)[-6:])
    if any(w in q for w in ("issue", "problem", "review", "why", "de ce")):
        items = V.issues(case, role, "open")
        return "Open: " + "; ".join(i.get("title") or i.get("what", "") for i in items) + "." if items else "No open issues."
    return V.overview(case, role)["status_text"]


def answer(case, role: str, message: str, history: list[dict], client=None) -> dict:
    if role not in ROLES:
        raise ValueError("role must be client or employee")
    tools_used, mode = [], "bedrock"
    try:
        client = client or llm.make_client()
        messages = [{"role": h["role"], "content": h["content"]} for h in history[-10:]]
        messages.append({"role": "user", "content": message})
        text = "I could not finish looking this up; please ask a narrower question."
        for _ in range(6):
            resp = llm.create(client, system=SYSTEM[role], messages=messages, tools=tool_defs(role), max_tokens=1500)
            messages.append({"role": "assistant", "content": resp.content})
            uses = [b for b in resp.content if b.type == "tool_use"]
            if resp.stop_reason != "tool_use" or not uses:
                text = "".join(b.text for b in resp.content if b.type == "text").strip()
                break
            results = []
            for u in uses:
                params = dict(u.input or {})
                tools_used.append({"tool": u.name, "input": params})
                out = run_tool(case, role, u.name, params)
                results.append({"type": "tool_result", "tool_use_id": u.id,
                                "content": json.dumps(out, ensure_ascii=False, default=str)[:6000]})
            messages.append({"role": "user", "content": results})
    except Exception:  # no key, outage, refusal: answer from the views instead of going silent
        text, mode = offline_answer(case, role, message), "offline"
    clean, cites = citations(case, role, text)
    return {"answer": clean, "citations": cites, "tools_used": tools_used, "mode": mode}


def log_turn(case, role: str, message: str, result: dict) -> dict:
    """Audit the exchange in the ledger (the only write the chat ever makes)."""
    return case.emit("CHAT_TURN", {"type": role, "id": "chat"},
                     {"role": role, "question": message[:500], "tools": [t["tool"] for t in result["tools_used"]],
                      "mode": result["mode"], "answer_sha256": hashlib.sha256(result["answer"].encode()).hexdigest()},
                     f"Chat question from {role}")
