"""Case messages: one thread per case between the client and bank staff, plus the bank's automatic emails.

Messages are ledger events (MESSAGE_POSTED), so they are hash-chained and auditable like everything else. A message can
reference a document (#doc-3), a ledger event (#155) or a person (@Radu Pop). References are validated against what
the author's role may see, and filtered again for the reader: a client never receives a link to an internal event.
This is not the AI assistant ("Ask"): people talk to people here.
"""
import re

from . import case_views
from .engine import Case

DOC_TOKEN = re.compile(r"#(doc-\d+)\b")
INTERNAL_WORDS = re.compile(r"analyst|complian|officer|supervisor|risk|aml|kyc|insider|staff|internal", re.I)
EVENT_TOKEN = re.compile(r"(?<![\w-])#(\d+)\b")
ROLES = ("client", "employee")


def client_facing_name(author: str) -> str:
    """How a staff author is shown to a client: the person's name only, without internal roles or staff IDs."""
    name = re.sub(r"\s*\([^)]*\)|\bE-\d+\b", "", author or "")
    name = re.split(r"\s+[-–—|·]\s+|,", name)[0].strip(" ·-,")  # "Ana Pop - Compliance" -> "Ana Pop"
    plain = re.fullmatch(r"[^\W\d_]+(?:[ .'-][^\W\d_]+){0,3}", name)
    return name if plain and not INTERNAL_WORDS.search(name) else "Bank team"


def people_on_file(case: Case) -> list[str]:
    """Everyone the case's documents name: declared and registered owners, the administrator, ID card holders."""
    from .rules import same_name_exact
    st, names = case.state(), []
    for ext in st["extractions"].values():
        names += [o["name"] for k in ("declared_owners", "register_owners") for o in ext.get(k, [])]
        names += [f["value"] for f in ext.get("fields", []) if f["field"] in ("administrator", "signatory")]
    names += [d["person"] for d in st["docs"].values() if d.get("person") and not d.get("quarantined")]
    out = []
    for n in names:  # "POP RADU" (register) and "Radu Pop" (ID card) are one person: keep the first readable spelling
        if not any(same_name_exact(n, m) for m in out):
            out.append(n if not n.isupper() else " ".join(reversed(n.title().split())) if len(n.split()) == 2 else n.title())
    return out


def mentionables(case: Case, role: str) -> dict:
    """What this role may reference: people on the file, its documents, and the events it can see."""
    role = case_views._role(role)
    people = [{"id": p, "label": p} for p in people_on_file(case)]
    docs = [{"id": d["id"], "label": d["name"]} for d in case_views.documents(case, role)]
    events = [{"seq": e["seq"], "label": e["what"], "day": e["day"]}
              for e in case_views.timeline(case, role, limit=200) if e["type"] != "MESSAGE_POSTED"]
    return {"people": people, "docs": docs, "events": events}


def _resolve_refs(case: Case, role: str, text: str, refs: list[dict]) -> list[dict]:
    """Keep only references this role may make: explicit ones from the composer plus #doc-N / #N typed in the text."""
    m = mentionables(case, role)
    docs = {d["id"]: d["label"] for d in m["docs"]}
    events = {str(e["seq"]): e["label"] for e in m["events"]}
    people = {p["id"]: p["label"] for p in m["people"]}
    wanted = [(r.get("kind"), str(r.get("id"))) for r in refs or []]
    wanted += [("doc", d) for d in DOC_TOKEN.findall(text)] + [("event", s) for s in EVENT_TOKEN.findall(text)]
    wanted += [("person", p) for p in people if f"@{p}" in text]
    out, seen = [], set()
    for kind, ref_id in wanted:
        table = {"doc": docs, "event": events, "person": people}.get(kind, {})
        if ref_id in table and (kind, ref_id) not in seen:
            seen.add((kind, ref_id))
            out.append({"kind": kind, "id": int(ref_id) if kind == "event" else ref_id, "label": table[ref_id]})
    return out


def post(case: Case, role: str, text: str, author: str | None = None, refs: list[dict] | None = None) -> dict:
    role = case_views._role(role)
    text = (text or "").strip()
    if not text:
        raise ValueError("message is empty")
    # a client always posts as the company (the author field is ignored): nobody can write under a staff name
    name = case.profile["name"] if role == "client" else ((author or "").strip() or "Bank team")
    actor = case.client if role == "client" else {"type": "employee", "id": name}
    payload = {"role": role, "author": name, "text": text[:2000], "refs": _resolve_refs(case, role, text, refs or [])}
    who = "Client" if role == "client" else name
    return case.emit("MESSAGE_POSTED", actor, payload, f"{who} wrote: {text[:80]}")


def thread(case: Case, role: str) -> list[dict]:
    """Oldest first: people's messages and the bank's automatic emails, with references this reader may open."""
    role = case_views._role(role)
    doc_names = {d["id"]: d["name"] for d in case_views.documents(case, role)}
    event_labels = case_views.visible_events(case, role)  # labels in the reader's own words, never the author's
    out = []
    for e in case.ledger.events:
        # wall_time: when it was really sent (people's messages show it); sim_time: the case clock (emails show it)
        base = {"seq": e["seq"], "day": case_views._day(e["sim_time"]), "sim_time": e["sim_time"],
                "wall_time": e.get("wall_time")}
        if e["type"] == "MESSAGE_POSTED":
            p = e["payload"]
            refs = [r if r["kind"] == "person" else
                    {**r, "label": (doc_names if r["kind"] == "doc" else event_labels)[r["id"]]}
                    for r in p.get("refs", []) if r["kind"] == "person"
                    or (r["kind"] == "doc" and r["id"] in doc_names)
                    or (r["kind"] == "event" and r["id"] in event_labels)]
            name = client_facing_name(p["author"]) if role == "client" and p["role"] == "employee" else p["author"]
            out.append({**base, "kind": "message", "author": {"role": p["role"], "name": name},
                        "text": p["text"], "subject": None, "body": None, "refs": refs})
        elif e["type"] in ("EMAIL_SENT", "EMAIL_FAILED") and (role == "employee" or e["type"] == "EMAIL_SENT"):
            failed = e["type"] == "EMAIL_FAILED"  # the bank sees failed sends; the client only what reached them
            out.append({**base, "kind": "email", "author": {"role": "bank", "name": "Bank (automatic email)"},
                        "text": None, "subject": e["payload"].get("subject"), "body": e["payload"].get("body"),
                        "refs": [], "status": "failed" if failed else "sent",
                        "error": e["payload"].get("error") if failed else None})
    return out
