# OpenLoop: an AI case agent for long-running banking files

Banking back-office files stay open for days or weeks: documents arrive at different times, they have to be
cross-checked against each other and against the policy, legal deadlines tick, and exceptions need a human.
OpenLoop keeps each file as an **append-only, hash-chained event ledger**. **Code** computes every requirement's
state and enforces the hard rules. An **agent** plans and calls tools, but only actions the rules allow can run.
A **judge** (Featherless Simple JEV) settles fuzzy matches. Everything uncertain lands on an **analyst triage
card**, and analyst rulings are reused as precedents.

Demo case: an SME working-capital loan and KYB file for a fictional bakery. The case covers:
- an undeclared beneficial owner;
- an ambiguous address (Str. vs Calea);
- a certificate that expires while the file waits;
- a client email that arrives at the wrong moment.

## Run it (one command, no API keys)
```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --app-dir backend --port 8000
# open http://localhost:8000
```
Tests: `cd backend && python -m pytest -q` (rules, ledger tamper detection, and the full demo scenario end to end).

## Demo script (≈3 min)
1. **Inbound → "Day 0"**: 4 documents arrive.
   - DSCR 1.4 auto-verifies.
   - The agent requests the missing trade-register certificate, the fiscal certificate and the co-owner's ID.
2. **+3 days**: the reminder timers fire and the agent reminds the client.
3. **Inbound → trade register certificate**:
   - The registry API check passes.
   - **Beneficial-owner discrepancy**: Radu Pop holds 25% but isn't declared. This starts the 14-day AMLR clock and opens a triage card.
   - **Address**: "Str." vs "Calea". The judge is unsure (below the 0.9 threshold), so it opens a triage card.
4. **Inbound → client email** ("shareholder changed"). The agent attaches it to the open card. It tries to ask the client for a new declaration, and the **gate denies it** (GATE-01: the analyst hasn't decided yet).
5. **Triage**: rule "same address" (stored as a precedent), then "confirm discrepancy". The agent now asks for the corrected declaration.
6. **Inbound → updated documents**: the beneficial owners match, the IDs are on file, and the legal clock is **cancelled**. Every check passes, so the file becomes **READY_FOR_DECISION**.
7. **+7 days**: the certificate passes 30 days and becomes **EXPIRED**. The engine enforces this, not the agent. The file **reopens** and the agent re-requests the certificate.
8. **Inbound → fresh certificate**: everything is SATISFIED again. The address is resolved by **reusing the analyst's precedent**, with no new card. The file is **READY_FOR_DECISION** again; the credit decision stays human.
9. **Verify ledger**: the hash chain is intact.

## Modes
| Env | Values | Notes |
|---|---|---|
| `AGENT_MODE` | `scripted` (default) / `bedrock` | `bedrock` = Claude plans its own tool calls (Anthropic SDK Mantle client, key in `AWS_BEARER_TOKEN_BEDROCK`). On any failure it falls back to scripted (30 s timeout). Requests, legal clocks, escalations and expiry are enforced in code either way. |
| `JUDGE_MODE` | `heuristic` (default) / `featherless` | `featherless` calls `/v1/classifier`; on error it falls back to heuristic and says so |

Copy `.env.example` to `.env` to configure.

## Architecture
See `docs/design.md` (principles, module map, API contract). Key guarantees:
- **The ledger is the only truth.** State = `reduce(events)`, each event hashes the previous one, and `GET /api/cases/{id}/verify` checks the chain.
- **Hard rules are code** (`backend/app/rules.py`) and each has a rule ID: HR-01 CUI checksum through HR-08 fiscal certificate.
- **Gate** (`engine.gate`): only state-allowed actions run. The only approve tool is hard-wired to DENY (GATE-02), and duplicate requests are denied (GATE-03).
- **No model overrides a hard rule.** The judge only settles fuzzy matches (name and address variants). It auto-accepts only above its threshold, and only after the hard facts (postal code, tax ID) already match; otherwise it escalates.
- **Code enforces the obligations.** Document expiry, legal clocks, escalations and missing-document requests run in code whatever the model does. A ready file reopens when evidence goes stale.
- **Every agent step is logged** with its reason, tool, input, output and gate verdict, including failed calls.
- **Quotes are verified:** every extracted field carries a verbatim quote. A field whose quote isn't in the document text is dropped and can never serve as evidence.

## Domain evidence
`research/` holds sourced findings: Raiffeisen fines, the AMLR/DORA/AI Act timelines, prior art, and 13 processes where the
same engine applies (`research/07-impact-synthesis.md`).

## Team workflow
See `docs/TASKS.md` for the post-MVP task split.
