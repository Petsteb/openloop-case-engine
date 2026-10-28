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
docs/            design.md, TASKS.md
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

## Rulings made under time pressure (MVP, 80 min)
- The controller (Claude) writes the backend inline; one subagent builds the frontend in parallel against this contract; one review at the end. Cost if wrong: less per-task review, so the bugs get caught later.
- Commits go straight to `main` in a new repo; the user asked for one shared repo. Cost if wrong: switching to branches later is trivial.
- The frontend is static HTML/JS with no build step, chosen for speed and one-command setup. Cost if wrong: porting to React later if needed.
- Documents are synthetic Romanian text files standing in for PDFs, and the extractor is regex-based in scripted mode. Cost if wrong: PDF/LLM extraction is a follow-up task.
