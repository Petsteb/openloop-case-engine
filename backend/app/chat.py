"""Case chat: a client or a bank employee asks questions about one case.

Claude answers only from read-only, role-scoped case tools (case_views.py); the role filter is code, not
prompt. Every factual sentence should cite ledger events [#seq] or documents [doc-N]; code keeps only
citations that exist and that the role may see. The chat never changes the case: it only appends a
CHAT_TURN audit event (done by the API under its write lock, see log_turn).
"""
import hashlib
import json
import os
import re
import time

from . import case_views as V
from . import llm
from .rules import norm_text

ROLES = ("client", "employee")
BOTH = {"client", "employee"}

TOOLS = {
    "get_overview": ("Where the file stands: status, checks, number of open items.", {}, BOTH,
                     lambda case, role: V.overview(case, role)),
    "get_missing_documents": ("Documents still needed from the client, when they were requested, reminders.", {}, BOTH,
                              lambda case, role: V.missing_documents(case, role)),
    "get_timeline": ("What happened, as ledger events with #seq and day, oldest first. Returns the newest `limit` "
                     "(default 60, max 200) events in the since_day..until_day window; page with since_day/until_day.",
                     {"since_day": {"type": "integer"}, "until_day": {"type": "integer"}, "limit": {"type": "integer"}}, BOTH,
                     lambda case, role, since_day=None, until_day=None, limit=60:
                     V.timeline(case, role, since_day=since_day, until_day=until_day, limit=limit)),
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
    "client": "You help a small company's representative understand their own file at the bank (a loan application or "
              "an annual review; get_overview says which). Only use the tools; "
              "never guess. Never speculate about internal reviews, risk or compliance: say the bank is reviewing the "
              "file. Cite facts as [#seq] for events or [doc-N] for documents, one marker per reference, never ranges. "
              "Plain, friendly language, at most three short sentences unless asked for a list. Answer in the language "
              "of the question.",
    "employee": "You help a bank analyst audit this case. Use at most 4 tool calls. For people, owners or conflicts start "
                "with get_issues (it holds the conflicts and their evidence); for 'what happened' use get_timeline; use "
                "search_documents for names or fields (word order does not matter); use explain_step only for the one "
                "or two steps that matter. Cite every fact with [#seq] (ledger event) or [doc-N] (document), one marker "
                "per reference, never ranges. Answer in at most 5 short sentences or bullets: day N, names, rule ids, "
                "what was done. Only say something is not in the case after checking get_issues and search_documents. "
                "Answer in the language of the question.",
}
SYSTEM = {role: f"{text} {llm.UNTRUSTED_RULE}" for role, text in SYSTEM.items()}  # SEC-13: tool results are data
MAX_HISTORY = 8  # messages (4 exchanges) of context from the browser

CITE = re.compile(r"\s?\[(#\d+|doc-\d+)\]")
RANGE = re.compile(r"\s?[\[(]#\d+\s*[–,\-][^\])]*[\])]")  # e.g. [#3–#6], [#2, #3], (#4-5); only '#'-led groups


def tool_defs(role: str) -> list[dict]:
    return [{"name": n, "description": d, "input_schema": {"type": "object", "properties": props, "required": [
        k for k in props if n in ("explain_rule", "explain_step")]}}
            for n, (d, props, roles, _) in TOOLS.items() if role in roles]


def run_tool(case, role: str, name: str, params: dict):
    if name not in TOOLS or role not in TOOLS[name][2]:
        return {"error": "not available for this role"}
    try:
        return TOOLS[name][3](case, role, **params)
    except Exception as exc:  # a bad tool input is the model's problem to fix, not a reason to go offline
        return {"error": f"{type(exc).__name__}: {exc}"}


def citations(case, role: str, text: str) -> tuple[str, list[dict]]:
    """Keep only markers that exist and that this role may see; strip the rest from the text."""
    text = RANGE.sub("", text)  # grouped/range markers can't be validated: drop them
    visible = V.visible_events(case, role)
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


STOP = {"when", "what", "which", "where", "have", "with", "about", "from", "that", "this", "your", "file", "case",
         "learn", "know", "there", "they", "were", "does", "into", "show", "tell", "please", "still", "need"}


def _keywords(message: str) -> list[str]:
    return [w for w in norm_text(message).split() if len(w) >= 4 and w not in STOP]


def offline_answer(case, role: str, message: str) -> str:
    """No model available: a templated answer from the same views, so the demo never goes silent."""
    q, keys = message.lower(), _keywords(message)
    status = V.overview(case, role)["status_text"]
    if role == "employee" and keys:  # a specific person or term: answer from the issue that mentions it
        for i in V.issues(case, role, "all"):
            hay = norm_text(f"{i.get('title', '')} {i.get('summary', '')}")
            if any(k in hay for k in keys):
                res = i.get("resolution") or {}
                done = f" Analyst decision: {res.get('action_id')}." if res else " Still open with the analyst."
                return (f"Day {i.get('since_day')}: {i.get('title')}. {i.get('summary')} [#{i.get('seq')}]{done}")
        hits = V.document_fields(case, role, query=" ".join(keys[:2]))
        if hits:
            return "; ".join(f"{h['doc_name']}: “{h['quote']}” [{h['doc_id']}]" for h in hits[:3])
    if any(w in q for w in ("need", "missing", "lips", "trimit", "send", "document")):
        missing = V.missing_documents(case, role)
        return ("Still needed: " + "; ".join(m["label"] for m in missing) + ".") if missing else "Nothing is missing right now."
    if any(w in q for w in ("happen", "so far", "timeline", "history", "pana acum", "până acum", "when", "când")):
        return " ".join(f"Day {e['day']}: {e['what']} [#{e['seq']}]." for e in V.timeline(case, role)[-6:])
    if any(w in q for w in ("issue", "problem", "review", "why", "de ce", "wrong")):
        items = V.issues(case, role, "open")
        listed = "Open: " + "; ".join(i.get("title") or i.get("what", "") for i in items) + "." if items else "No open items."
        return f"{status} {listed}"
    return status


def _answer_hashes(case, role: str) -> set[str]:
    """sha256 of every answer this server gave to this role in this case (logged as CHAT_TURN events)."""
    return {e["payload"].get("answer_sha256") for e in list(case.ledger.events)
            if e["type"] == "CHAT_TURN" and e["payload"].get("role") == role}


def _clean_history(history: list[dict], trusted_answers: set[str] | frozenset = frozenset()) -> list[dict]:
    """The API wants user-first, non-empty, alternating turns; UI history may start with a greeting.

    SEC-13: the history comes from the browser. A user turn is the asker's own words; an assistant turn is kept
    only if it is an answer this server really gave (its hash is in the case ledger), so nobody can put words in
    the assistant's mouth. Only the last MAX_HISTORY messages count."""
    msgs = []
    for h in history[-10:]:
        content = str(h.get("content", "")).strip()
        if not content or h.get("role") not in ("user", "assistant"):
            continue
        if h["role"] == "assistant" and hashlib.sha256(content.encode()).hexdigest() not in trusted_answers:
            continue  # forged, edited, or a UI greeting
        msgs.append({"role": h["role"], "content": content})
    msgs = msgs[-MAX_HISTORY:]
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    out = []
    for m in msgs:
        if out and out[-1]["role"] == m["role"]:
            out[-1]["content"] += "\n" + m["content"]
        else:
            out.append(m)
    if out and out[-1]["role"] == "user":  # the new question is appended as the next user turn
        out.pop()
    return out


def answer(case, role: str, message: str, history: list[dict], client=None) -> dict:
    if role not in ROLES:
        raise ValueError("role must be client or employee")
    tools_used, mode = [], "bedrock"
    deadline = time.monotonic() + float(os.environ.get("CHAT_BUDGET_S", "25"))
    try:
        client = client or llm.make_client()
        messages = _clean_history(history, _answer_hashes(case, role))
        messages.append({"role": "user", "content": message})
        text = "I could not finish looking this up; please ask a narrower question."
        for _ in range(6):
            resp = llm.create(client, system=SYSTEM[role], messages=messages, tools=tool_defs(role), max_tokens=3000,
                              deadline=deadline)
            messages.append({"role": "assistant", "content": resp.content})
            uses = [b for b in resp.content if b.type == "tool_use"]
            if resp.stop_reason != "tool_use" or not uses:
                text = "".join(b.text for b in resp.content if b.type == "text").strip()
                if not text:
                    raise RuntimeError(f"empty answer ({resp.stop_reason})")
                break
            results = []
            for u in uses:
                params = dict(u.input or {})
                tools_used.append({"tool": u.name, "input": params})
                out = run_tool(case, role, u.name, params)
                results.append({"type": "tool_result", "tool_use_id": u.id,  # documents and messages are client text
                                "content": llm.untrusted(json.dumps(out, ensure_ascii=False, default=str)[:6000], u.name)})
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
