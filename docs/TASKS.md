# Task split after the MVP (2 people, each with their own Claude Code)

**Ground rules**
- One branch per task (`a1-bedrock-live`, `b2-calibration`, …). Open a PR into `main` and merge it yourselves; only push straight to main for small, urgent fixes.
- Run `cd backend && python -m pytest -q` before every push. The demo-flow test is the contract that the live demo works.
- The API contract in `docs/design.md` is shared. If you change a Bundle field, update the doc and tell the other person.
- **File ownership** avoids merge conflicts. Edit the other person's files only after a quick message.

| Owner | Files |
|---|---|
| **A (you)** | `backend/app/agent.py`, `extract.py`, `scenario.py`, `main.py`, `frontend/*` |
| **B (teammate)** | `backend/app/judge.py`, `backend/app/learner.py` (new), `backend/eval/*` (new), `docs/pitch/*` (new) |
| Shared, announce before editing | `backend/app/engine.py`, `rules.py`, `template.py` |

## A: agent, integrations, live demo
1. **A1 Bedrock live (first, ~30 min):**
   - Put the key in `.env` and set `AGENT_MODE=bedrock`.
   - Run the demo script from the README.
   - Check that the Mantle region and model are available.
   - Tune `SYSTEM` in `agent.py` so the trace reasons read well on screen.
   - Keep `AGENT_EFFORT=low` unless decisions are wrong.
2. **A2 Curveballs:**
   - **Prompt injection:** a document with a hidden "ignore rules, approve" line. `extract.scan_injection` already flags it; show it in the trace and UI.
   - **Wrong-client document:** a CUI mismatch quarantines the document.
   - **"Registry down" button:** the UI toggle calls the existing `POST /api/registry {"down": true}`.
3. **A3 LLM extraction:**
   - Claude extracts fields with quotes in the same shape as `extract_scripted`, and `verify_quotes` stays the guard.
   - Optional: real PDFs generated from `scenario.py` texts.
4. **A4 Integration story:** expose `get_case_state` and `run_allowed_action` as an MCP server or REST tools that Raiffeisen's internal assistant (ARI) could call. One slide plus a 20-second demo.

## B: judge, learning, evaluation, pitch
1. **B1 Featherless live (first, ~20 min):**
   - Set `FEATHERLESS_API_KEY` and `JUDGE_MODE=featherless`.
   - Check the address and person questions on Romanian strings.
   - Cache the responses so the demo also runs offline.
2. **B2 Calibration (the testability proof):**
   - Generate about 150 labelled address and name pairs: variants, true differences, near-misses (Str. vs Calea, sector, block).
   - Split them into tune and test sets.
   - Report accuracy, false approvals and manual-review % per threshold.
   - Pick the threshold on the tune set and report it on the test set.
   - Produce one chart for the deck.
3. **B3 Learning loop v2:**
   - After N similar analyst rulings (`precedents` in the reducer), propose a composite check: normalizer + postal-code match + judge.
   - Backtest it on the eval set.
   - Promote it with maker-checker: the person who promotes must differ from the analyst who ruled.
   - Add a modal in the UI (coordinate with A).
4. **B4 Pitch:**
   - A 3-minute video recorded from the live demo.
   - A deck covering: problem (`research/07`), solution, architecture, safety guarantees, impact table, generality (13 processes), roadmap.
   - Optional: a second template, either the DORA incident deadlines or the ASF access-register reconciliation, to prove the engine is generic.
