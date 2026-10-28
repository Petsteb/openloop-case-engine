# Tasks: status and what's left (updated 2026-10-28, night)

The night plan is `docs/superpowers/plans/2026-10-28-openloop-final-14h.md`. Its backend tasks are **done**:
- hybrid agent with bring-your-own document AI;
- insider rule SR-01;
- role-scoped case views;
- case chat;
- client emails;
- learning loop.

The React bank screen is merged and the Featherless calibration is done (`backend/eval/calibration.json`). Still in
progress: the customer portal UI and the Documents tab.

**Ground rules**
- One branch per task. Run `cd backend && python -m pytest -q` before every push; the demo-flow test is the contract that the live demo works.
- Never commit `.env`. Copy `.env.example` and put the keys in privately.
- Feature freeze is at **08:00**; submit by **10:30**.

## ELTheo77 (starting ~04:00): quality, proof and deployment
Each task is independent. Take them in order and stop at freeze.

1. **End-to-end tests of the real UI** (Playwright, `web/` once merged):
   - Click through the README demo script at 1440×900 and at 1333×780 with deviceScaleFactor 1.5.
   - Assert there's no horizontal overflow, no console errors, and that the final screen reads "File complete".
   - Assert the chat answers render with citation chips.
   - Run it once with `AGENT_MODE=scripted JUDGE_MODE=heuristic`, since that's the offline insurance. Save it as `web/e2e/demo.spec.ts`, or as a Python script under `backend/tests/e2e/`.
2. **Model benchmark** (one slide's worth of numbers; put it in `docs/pitch/benchmark.md`):
   - **Planner:** compare `us.anthropic.claude-opus-5-5`, `us.anthropic.claude-sonnet-5-5` and `us.anthropic.claude-haiku-5-5` (Bedrock inference profiles; check the IDs work in `us-east-1` first).
   - **Planner measurements:** run the README demo once per model and record seconds per click, number of Claude calls, fallbacks, final status, and whether the trace reasons read well.
   - **Chat:** the same 4 questions as `backend/scripts/live_chat_check.py` (and `live_demo_run.py` for the demo): 2 employee, 2 client including the "show me the analyst notes" leak probe. Record latency and correctness, and confirm there are no leaks.
   - **Judge:** Featherless gemma vs the heuristic on `backend/eval/pairs.jsonl`. Use the results in `backend/eval/calibration.json` (already produced).
3. **Deployment (optional but impressive):** a public URL the jury can open.
   - The backend is FastAPI and serves the built `web/dist`.
   - **Options:** a Dockerfile plus Render, Railway or Fly. Vercel works too (Python functions). Use **synthetic data only**.
   - **Mode:** set `AGENT_MODE=scripted` unless the keys can be kept as platform secrets.
   - **README:** add the URL plus a "Deploy" section.
4. **Fine-tuning:**
   - **Judge:** if `calibration.json` recommends a different value, update `template.JUDGE_THRESHOLD` (one line plus the test expectations).
   - **Prompts:** tighten `agent.SYSTEM` and `chat.SYSTEM` wording based on the benchmark.
   - **Speed:** warm the Featherless cache by running the demo once before recording, so the cache file gets committed.
5. **Rehearsal support (08:00–10:00):** run the offline-mode recording as the backup video, and keep a clean browser profile at 1440×900.

## Petru + Claude (two sessions)
- [x] Backend tasks 1–4, 9, 12 + docs (`docs/design.md` → "API additions (v2)")
- [x] React bank screen merged into `main`; two code reviews fixed
- [x] Customer portal + document viewer backend (spec: `docs/superpowers/specs/2026-10-28-client-portal-design.md`)
- [x] Portal UI (`/client/`) + Documents tab (UI session; a last fix batch is in progress)
- [x] Full live + offline two-screen run in the browser; integration fixes pushed
- [ ] Deck + 3-min video script (`docs/pitch/`), using the `research/` folder for sources
- [ ] 08:00 freeze: commit `web/dist`, tag `v1.0-freeze`; rehearse ×2; record; submit by 10:30

For E2E task 1, add the portal flow too: upload the correct sample file (the request disappears), upload the wrong-company
sample (it shows "Not accepted" and the bank sees the reason), and answer "no" to a contact change (a card opens on the bank screen).
