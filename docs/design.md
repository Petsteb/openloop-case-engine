# OpenLoop: design (MVP)

**One line:** an AI case agent for multi-day banking files. Every case is an append-only, hash-chained event ledger. Code computes each requirement's state and enforces the hard rules. The agent plans and calls tools, but only actions the rules allow can run. A judge (Featherless Simple JEV) settles fuzzy matches. Exceptions go to an analyst triage card, and a simulated clock with time-skip drives deadlines.

**Demo use case:** an SME loan and KYB file for a fictional company, "Brutăria Aurora SRL".

## Principles
- Only the engine changes state; the LLM never mutates it. State = `reduce(events)`.
- Hard rules (tax-ID checksum, registry status, beneficial owners ≥25%, DSCR ≥1.2, document validity) are plain code, and each has a rule ID.
- No model overrides a hard rule. The judge only settles fuzzy matches above a threshold, after the hard facts match; otherwise it escalates. The only approve tool is hard-wired to DENY (GATE-02). Expiry, legal clocks and escalations are enforced in code.
- Every agent step is logged: reason, tool, input, output, gate verdict.
- Runs with no API keys: `AGENT_MODE=scripted` uses the deterministic planner and `JUDGE_MODE=heuristic` uses a string-similarity judge. With keys: `AGENT_MODE=bedrock` (Claude on Amazon Bedrock) and `JUDGE_MODE=featherless`.

## Layout
```
backend/app/
  main.py        FastAPI app; serves /api/* and the static frontend at /
  ledger.py      append-only hash-chained event store
  engine.py      Case (simulated clock, deliver/advance/resolve), reducer (events -> state), gate, agent tools
  template.py    KYB case template: requirements, rules, timers
  rules.py       hard rules (pure functions, rule IDs)
  judge.py       fuzzy judge: heuristic | featherless
  extract.py     document field extraction with verbatim quotes, plus quote verification
  registry.py    mock trade-register (ONRC) API
  agent.py       case agent: scripted planner | Claude-on-Bedrock planner (+ code safety net)
  scenario.py    demo case documents and scripted inbound items
backend/tests/   pytest
frontend/        index.html, app.js, styles.css (no build step)
docs/            design.md, auth.md, ui-design.md, security-audit.md, pitch/
research/        domain evidence (sources for every claim in the pitch)
```

## API contract (frontend ↔ backend)
Base URL is the same origin, e.g. `http://localhost:8000`. All POST bodies are JSON. **Every POST returns a Bundle.**

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/demo/reset` | `{}` | Bundle for the fresh demo case `demo-1` |
| GET | `/api/cases/{case_id}/bundle` | none | Bundle |
| POST | `/api/cases/{case_id}/inbound` | `{"item_id": "..."}` | Bundle (delivers a scripted document or email, then the agent runs) |
| POST | `/api/cases/{case_id}/advance` | `{"days": 1}` | Bundle (moves the sim clock, fires due timers, then the agent runs) |
| POST | `/api/cases/{case_id}/exceptions/{exception_id}/resolve` | `{"action_id": "...", "note": ""}` | Bundle |
| GET | `/api/cases/{case_id}/verify` | none | `{"ok": true, "length": 42, "broken_at": null}` |

### Bundle
```json
{
  "case": {"id": "demo-1", "title": "SME loan & KYB — Brutăria Aurora SRL", "goal": "File ready for credit decision",
           "status": "OPEN", "sim_now": "2026-10-28T09:00:00Z", "day": 0, "opened_at": "2026-10-28T09:00:00Z"},
  "config": {"agent_mode": "scripted", "judge_mode": "heuristic", "judge_threshold": 0.9},
  "requirements": [
    {"id": "R1", "title": "Company active in trade register", "status": "SATISFIED",
     "reason": "CUI checksum valid; registry status ACTIVE", "rule_ids": ["HR-01", "HR-02"],
     "evidence": [{"doc_id": "doc-onrc", "field": "status", "quote": "Stare firmă: ACTIVĂ"}],
     "updated_at": "2026-10-31T09:00:00Z"}
  ],
  "documents": [{"id": "doc-app", "type": "application", "name": "Cerere de credit", "received_at": "...", "issued_at": "..."}],
  "exceptions": [
    {"id": "EX-1", "requirement_id": "R2", "status": "OPEN", "severity": "high",
     "title": "Undeclared beneficial owner", "summary": "Trade register lists Radu Pop with 25%; UBO declaration omits him.",
     "rule": {"id": "HR-04", "text": "Every person with ≥25% ownership must be declared and identified (Law 129/2019; AMLR: report register discrepancies within 14 days)."},
     "snippets": [{"doc_id": "doc-onrc", "label": "Trade register certificate", "quote": "..."},
                  {"doc_id": "doc-ubo", "label": "UBO declaration", "quote": "..."}],
     "judge": null,
     "actions": [{"id": "confirm_discrepancy", "label": "Confirm discrepancy → request new declaration + draft report"},
                 {"id": "dismiss", "label": "Dismiss (documents agree)"}],
     "created_at": "..."}
  ],
  "timers": [{"id": "T-1", "kind": "legal_deadline", "label": "AMLR discrepancy report due", "due": "...", "status": "PENDING"}],
  "metrics": {"agent_steps": 12, "tool_calls": 10, "auto_resolved": 4, "sent_to_human": 2, "denied_actions": 1},
  "events": [{"seq": 1, "type": "CASE_OPENED", "sim_time": "...", "actor": {"type": "system", "id": "engine"},
              "summary": "Case opened", "hash": "ab12...", "prev_hash": "0000..."}],
  "trace": [{"seq": 7, "sim_time": "...", "reason": "New trade-register certificate; re-check ownership",
             "tool": "lookup_registry", "input": {"cui": "..."}, "output": "...", "gate": "ALLOW"}],
  "scenario": [{"id": "day0-docs", "label": "Day 0 · Client uploads application pack", "delivered": false}]
}
```
- **Requirement `status`:** `SATISFIED` | `OPEN_WAITING` | `CONTRADICTED` | `NEEDS_REVIEW` | `EXPIRED`
- **Exception `status`:** `OPEN` | `RESOLVED`
- **Timer `status`:** `PENDING` | `FIRED` | `CANCELLED`
- **`judge`**, when present: `{"question": "...", "probs": {"same_address": 0.86, "different_address": 0.14}, "threshold": 0.9}`
- **`gate` in trace:** `ALLOW` | `DENY: <rule id>` | `-` (read-only tools)

### API additions (v2, all additive)
- **`POST /api/cases/{case_id}/chat`**
  - **Body:** `{"role": "client" | "employee", "message": "1–1000 chars", "history": [{"role": "user" | "assistant", "content": "..."}]}`, with at most 10 history items.
  - **Returns:**
    ```json
    {"answer": "Text with [#42] / [doc-3] markers",
     "citations": [{"kind": "event" | "doc", "ref": "#42" | "doc-3", "label": "event summary or document name"}],
     "tools_used": [{"tool": "get_timeline", "input": {}}],
     "mode": "bedrock" | "offline"}
    ```
  - **Read-only:** the chat appends one `CHAT_TURN` event to the ledger and changes nothing else.
  - **Client role:** never receives internal review details.
- **`GET /api/cases/{case_id}/client-view`:** returns `{"overview", "missing_documents", "issues", "timeline", "emails"}`. Everything the applicant may see, from the same allow-list as the client chat. Use it for an optional customer page.
- **`POST /api/cases/{case_id}/release-hold`:**
  - **Body:** `{"by": "compliance-1", "note": "..."}`.
  - **Effect:** compliance lifts an `ON_HOLD`. Returns the bundle with status `OPEN`; the agent resumes, so a file whose checks all pass goes straight back to `READY_FOR_DECISION` (no second "complete" email to the client).
  - **409** if the file is not on hold.
- **Optional staff token:** if `STAFF_TOKEN` is set, employee chat, `release-hold` and `promote` require the header `X-Staff-Token`. Unset in the demo; production takes identity from the bank's SSO.
- **`case.status`:** may also be `ON_HOLD` (show as "On hold", brick red). It is set when an insider-pattern card is escalated to compliance.
- **`exceptions[]` with `kind: "sequence_insider"`** (rule `SR-01`):
  - `requirement_id` is `"MON"`, meaning monitoring, not one of R1–R6.
  - Each `snippets[]` entry has `doc_id: null` and `label: "Ledger #<seq>"`, and its quote is the event summary.
  - Actions: `escalate_compliance`, `legitimate`.
  - Extra fields: `first_seq`, `then_seq`.
- **`trace[].by`:** who acted.
  - `"pipeline"`: code, always runs.
  - `"claude"`: Bedrock planner.
  - `"planner"`: scripted planner.
  - `"safety-net"`: code, after Claude.
- **`scenario[].internal`:** `true` for bank-internal events (staff actions), as opposed to client uploads. Suggested label prefix: "Internal: …".
- **`outbox[]`, newest first:** `{"seq", "sim_time", "status": "sent" | "failed", "to", "subject", "body", "mode": "outbox" | "gmail", "error"}`. These are client emails, in Romanian.
- **`config.agent_status`:** `"ok"` or `"fallback (<Error>)"`.
- **`exceptions[].judge.second_opinion`:** `{"method": "string similarity", "p_same": 0.48, "threshold": 0.8}`.
  - Auto-accept needs the classifier (`probs`, ≥ `threshold`) **and** this second opinion to agree.
  - Show it as a second bar labelled "Similarity check".
  - Calibration on 150 labelled pairs: the classifier alone had 7 false approvals; with both required, 0. See `backend/eval/calibration.json` and `docs/pitch/calibration.png`.
- **Learning loop:** analyst rulings become a check; promotion requires a second person.
  - **`GET /api/learning`** returns `{"proposals": [...], "checks": [...]}`.
    - A proposal is `{"id": "P-address-variant", "kind", "support": 3, "ruled_by": ["analyst-1", ...], "description", "examples": [{"a", "b", "source"}]}`.
    - It appears after 3 matching rulings. In the demo that is 2 past rulings plus the analyst's "same address" click.
  - **`POST /api/learning/proposals/{id}/backtest`** returns `{"n": 40, "auto_resolved", "false_approvals": 0, "false_approval_ids", "manual_review_rate", "same_pairs_caught", "same_pairs_total"}`.
  - **`POST /api/learning/proposals/{id}/promote`**
    - **Body:** `{"by": "supervisor-1"}`.
    - **Returns:** `{"check": {"id": "LC-1", "promoted_by", "promoted_at", "support", "backtest", "description"}}`.
    - **409** when `by` is one of `ruled_by` (maker-checker), for example `analyst-1`.
    - It also writes a `CHECK_PROMOTED` event to the ledger.
  - **Bundle:** `learning: {"checks": [...], "proposals": <count>}`.
  - **After promotion:** the next time the file reaches R3 (for example after "Reset demo" plus the trade-register certificate), R3 is verified by `Learned check LC-1` with no card. Promoted checks survive a reset.
- **New event types in `events[]`:**
  - **Hide from the timeline rail; show in the Ledger tab only:** `CHAT_TURN`, `EMAIL_SENT`, `EMAIL_FAILED`.
  - **Bank-internal; show in the Ledger tab:** `STAFF_CONTACT_CHANGE`, `CREDIT_ACTION`, `CLIENT_CONFIRMATION`.

### API additions (v3: many cases, messages, notifications)
- **Storage:** every ledger lives in one SQLite table (`data/openloop.db`, git-ignored; `OPENLOOP_DB` overrides it, tests use `:memory:`). Cases survive a restart. In production the same table lives in PostgreSQL on the bank's own servers.
- **Synthetic companies** (`backend/app/profiles.py`, all fictional): each has a full document set and one `story`, the rule path it exercises.
  - `aurora` (demo-1): the scripted demo.
  - `verde`: clean file.
  - `carpatic`: tax debt.
  - `delta`: suspended company.
  - `nord`: DSCR 1.06.
  - `medica`: signatory is not the administrator.
  - `solaris`: certificate already 45 days old.
  - `atelier`: annual review.
- **Templates** (`template.TEMPLATES`): `sme_loan` (R1–R6) and `kyb_review` (R1, R2, R6). The requested documents follow the template.
- **`GET /api/version`** → `{cases, events}`, a global change detector.
- **`GET /api/templates`** → `[{id, title, description, requirements}]`.
- **`GET /api/companies`** → `[{id, name, cui, city, county, product, story, templates}]`.
- **`GET /api/cases?role=employee`** → the work queue, needs-you first.
  - **Row:** `{id, title, template, template_title, company_id, company, product, status, state, status_text, needs_you, open_decisions, waiting_on_client, day, events, last_message_seq, last_action_seq, last_activity}`.
  - **Client:** `?role=client&company_id=aurora` → that company's files, client wording, no `open_decisions`.
- **`POST /api/cases`** `{template, company_id}` → the new case's bundle. The agent immediately requests the starting documents. Returns 422 if the company has no documents for that template.
- **Bundle `case{}`** gains `template, template_title, company_id, company, product`. `scenario` (the demo dock) is per case.
- **`GET /api/cases/{id}/sample-files`** and **`/{filename}`**: that company's synthetic files plus the wrong-company file. Keys are spelled like the case's pending requests.
- **`GET /api/cases/{id}/messages?role=`** → the thread, oldest first.
  - **Item:** `[{seq, day, sim_time, kind: "message"|"email", author: {role, name}, text, subject, body, refs: [{kind: "doc"|"event"|"person", id, label}]}]`.
  - **Filtering:** refs are filtered per reader; a client never gets a link to an internal event.
- **`POST /api/cases/{id}/messages`** `{role, text, author?, refs?}` → the thread.
  - **Refs:** validated against what the author may see; `#doc-N`, `#N` and `@Name` typed in the text are recognised.
  - **Client messages** go through the agent pipeline like emails (`classify_message`).
- **`GET /api/cases/{id}/mentionables?role=`** → `{people, docs, events}`, role-filtered.
- **`GET /api/notifications?role=employee`** (or `role=client&company_id=`) → newest first `[{case_id, company, kind: "action"|"message", text, seq, day}]`. Read state is kept by the UI.
- **`POST /api/demo/reset?all=true`** wipes the database and reseeds every synthetic file; without `all` only demo-1 resets.
- **New event type:** `MESSAGE_POSTED` (bank timeline: shown; client timeline: shown in the thread instead).

## Early design decisions (MVP)
- The first UI was static HTML/JS with no build step (still in `frontend/`), chosen for speed; the current UI is React (`web/`).
- Documents are synthetic Romanian text files standing in for PDFs, and the scripted extractor is regex-based. Reading real PDFs (OCR) is a follow-up.

