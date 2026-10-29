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

## Status for Theo (updated 29 Oct, 03:00)
**Works on `main`** (125 backend tests pass; both apps browser-tested at 390 px to 2560 px):
- **Bank app** (`/`):
  - **Work queue** (`#/`): every file, needs-you first, filters, New case.
  - **Case screen** (`#/case/<id>`): timeline, checklist, decision cards, agent reasoning, ledger, Messages, documents with history, notification bell.
- **Client portal** (`/client/`):
  - **My files:** with "Start a new application" and a "viewing as" picker for the 8 demo companies.
  - **Each file:** status, uploads (incl. a wrong-company demo file), confirmations, Messages with the bank, documents, chat.
  - **Live and responsive:** it updates live next to the bank app and works on a phone.
- **Many cases** in a SQLite store (`data/openloop.db`, git-ignored; cases survive restarts).
  - **8 synthetic companies:** each has one problem and realistic Romanian documents built from the real forms (`research/09-document-templates.md`).
  - **2 templates:** "SME loan and KYB check" and "Annual business review".
- **The whole demo script below**, browser-tested offline and live (Claude on Bedrock + Featherless judge).

**Still being done tonight by Petru + 2 Claude sessions:** a last UI polish pass, final code reviews, then the deck and video script.
**Parked on purpose:** an admin editor for case templates. It comes last, after everything else.

**Not done yet: what you can pick up** (details in `docs/TASKS.md`):
1. **E2E tests** of the real UI with Playwright: the demo script, the portal upload, no console errors.
2. **Model benchmark:** Opus vs Sonnet vs Haiku 5.5 as planner and chat (speed, correctness, leaks) → `docs/pitch/benchmark.md`.
3. **Deploy** a public URL (Dockerfile + Render/Railway/Fly). Use `AGENT_MODE=scripted` unless the keys are platform secrets.
4. **Tuning:** prompts in `agent.py`/`chat.py`; warm the Featherless cache before recording.
5. **Backup video:** record one run in offline mode as insurance.

**Resume where we left off:** start with `docs/handoff/README.md`. It has the read order, the setup, and a prompt to paste into Claude Code.

**Rules:** never commit `.env` (keys come privately); run the tests before every push; feature freeze is at 08:00 and we submit by 10:30.

## Run it (one command, no API keys)
```bash
pip install -r requirements.txt
cd web && npm ci && npm run build && cd ..   # React UI; without it the older static UI in frontend/ is served
python -m uvicorn app.main:app --app-dir backend --port 8000
# bank app: http://localhost:8000    client portal: http://localhost:8000/client/
# reset every demo file: curl -X POST "localhost:8000/api/demo/reset?all=true"
```
Tests: `cd backend && python -m pytest -q` (rules, ledger tamper detection, and the full demo scenario end to end).

## Demo script (≈3 min)
Open the bank app at `http://localhost:8000/#/case/demo-1`. The demo toolbar at the bottom drives the case: **Next client event** (documents and emails), **Next internal event** (staff actions), **Skip 1 day / 3 days / A week**, **Reset demo**.

1. **Next client event (day 0)**: 4 documents arrive.
   - DSCR 1.4 auto-verifies.
   - The agent requests the missing trade-register certificate, the fiscal certificate and the co-owner's ID.
2. **3 days**: the reminder timers fire and the agent reminds the client.
3. **Next client event → trade register certificate**:
   - The registry API check passes.
   - **Beneficial-owner discrepancy**: Radu Pop holds 25% but isn't declared. This starts the 14-day AMLR clock and opens a triage card.
   - **Address**: "Str." vs "Calea". The judge is unsure (below the 0.9 threshold), so it opens a triage card.
4. **Next client event → client email** ("shareholder changed"). The agent attaches it to the open card. It tries to ask the client for a new declaration, and the **gate denies it** (GATE-01: the analyst hasn't decided yet).
5. **Decision cards**: rule "same address" (stored as a precedent), then "confirm discrepancy". The agent now asks for the corrected declaration.
6. **Next client event → updated documents**: the beneficial owners match, the IDs are on file, and the legal clock is **cancelled**. Every check passes, so the file becomes **READY_FOR_DECISION**.
7. **A week**: the certificate passes 30 days and becomes **EXPIRED**. The engine enforces this, not the agent. The file **reopens** and the agent re-requests the certificate.
8. **Next client event → fresh certificate**: everything is SATISFIED again. The address is resolved by **reusing the analyst's precedent**, with no new card. The file is **READY_FOR_DECISION** again; the credit decision stays human.
9. **Next internal event ×2** (SR-01, the pattern behind Raiffeisen Romania's 2024 ANSPDCP fine): employee E-0317 changes the client's phone, then runs a credit-bureau check for the same client. An insider-pattern card opens; "escalate to compliance" puts the file **ON_HOLD**.
10. **Ask tab** (chat, two roles):
    - **Employee:** "When did we learn about Radu Pop and what did we do?" The answer cites ledger events `[#seq]`.
    - **Client:** "What do you still need from me?" The answer is plain-language. The client role never sees internal reviews.
11. **Messages tab**: the client got one Romanian email per step (documents needed, reminders, file complete), never anything internal. Bank staff and the client can also write to each other there, referencing documents (`#doc-3`), events (`#12`) and people (`@Radu Pop`).
12. **Check ledger**: the hash chain is intact, including every chat turn and email.

**Two-screen moments.** Open the customer portal (`/client/`) beside the bank screen; both update live.
- **After step 2:** on the portal, click "I consent" on the credit-check question. Then use "Try a wrong file (demo)": the upload shows "Not accepted", the client gets a Romanian email, and the bank's document viewer shows why (another company's tax ID).
- **At step 9:** on the portal, answer "No, I didn't" to the contact-change question. This opens a second card for the bank (SR-02), and the client sees "Our team will contact you".

**Many files (the work queue).** Open `http://localhost:8000/#/` for the queue of 8 synthetic files, each built to show one rule.
- **Verde Logistic:** the agent completed it with no human involved.
- **Carpatic Lemn:** tax debt on the ANAF certificate.
- **Delta Pescăria:** the company is suspended in the trade register.
- **Nord Construct:** debt service coverage of 1.06.
- **Medica Plus:** the application was signed by someone other than the administrator.
  - **Decide:** "Different person, ask for a mandate".
  - **Then:** Next client event → the mandate arrives and the file completes.
- **Solaris Agro:** the certificate was already 45 days old, so a fresh one is requested.
- **Atelier Croitorie:** an annual business review, a second template.
**New case** opens a file for any company and template, and the agent immediately asks the client for the starting documents. On the portal (`/client/`), pick a company in "viewing as". Then "Start a new application" and "Use sample file" on each request complete a file from the client side.

## Modes
| Env | Values | Notes |
|---|---|---|
| `AGENT_MODE` | `scripted` (default) / `bedrock` | **Code always runs the document pipeline**: extraction with verified quotes, registry lookup, rule checks. **Claude (Bedrock, `us.anthropic.claude-opus-5-5`, `us-east-1`) plans once per click** over the allowed actions, interprets emails and words escalations. On any failure, or when the 20 s budget per click runs out (`AGENT_BUDGET_S`), it falls back to scripted, and a code safety net runs after it either way. |
| `JUDGE_MODE` | `heuristic` (default) / `featherless` | `featherless` calls `/v1/classifier`; on error it falls back to heuristic and says so |
| `EMAIL_MODE` | `outbox` (default) / `gmail` | `gmail` sends through SMTP with `GMAIL_USER` + `GMAIL_APP_PASSWORD`; `NOTIFY_TO` redirects all demo mail to a team inbox |

**Bring your own document AI:** `template.EXTRACTOR_ROUTES` routes each document type to an adapter (`backend/app/extractors.py`). Financial statements go through a simulated bank document-AI adapter. Whatever answers must return fields plus verbatim quotes, which code verifies; `DOCAI_CURVEBALL=1` shows an unverifiable field being rejected.

Copy `.env.example` to `.env` to configure.

## Architecture
See `docs/design.md` (principles, module map, API contract). Key guarantees:
- **The ledger is the only truth.** State = `reduce(events)`, each event hashes the previous one, and `GET /api/cases/{id}/verify` checks the chain.
- **Hard rules are code** (`backend/app/rules.py`) and each has a rule ID: HR-01 CUI checksum through HR-08 fiscal certificate.
- **Gate** (`engine.gate`): only state-allowed actions run. The only approve tool is hard-wired to DENY (GATE-02), and duplicate requests are denied (GATE-03).
- **No model overrides a hard rule.** The judge only settles fuzzy matches (name and address variants), and only after the hard facts (postal code, tax ID) already match.
  - It auto-accepts only when the Featherless classifier (≥ 0.9) **and** an independent similarity check (≥ 0.8) agree; otherwise it escalates.
  - **Measured on 150 labelled pairs** (`backend/eval/`): the classifier alone auto-approved 7 wrong matches, for example "Str. Gării" vs "Calea Gării" at p = 1.0. Requiring both gave **0 false approvals** on the tune and test splits, with the same coverage.
- **Code enforces the obligations.** Document expiry, legal clocks, escalations and missing-document requests run in code whatever the model does. A ready file reopens when evidence goes stale.
- **Every agent step is logged** with its reason, tool, input, output and gate verdict, including failed calls.
- **Quotes are verified:** every extracted field carries a verbatim quote. A field whose quote isn't in the document text is dropped and can never serve as evidence.

## Known limitations (demo scope)
- **Identity is simulated.** Roles (client, employee, compliance) and names (analyst, supervisor) come from the request; there is no login. `STAFF_TOKEN` can gate staff-only calls. Production would take identity from the bank's SSO, which is what makes the maker-checker rule binding.
- **Time skip timing.** Follow-ups run once at the end of a skip. Expiry itself is applied when it happens, but the re-request is stamped with the skip's end date. That is fine for the demo's 1/3/7-day buttons; a real deployment runs on real time.
- **Learned check backtest.** It runs on a synthetic labelled set (`backend/eval/address_cases.jsonl`) that includes small-town counterexamples, where the naive rule makes 8 false approvals. It is evidence for the demo, not a substitute for backtesting on the bank's historical rulings.

## Domain evidence
`research/` holds sourced findings: Raiffeisen fines, the AMLR/DORA/AI Act timelines, prior art, and 13 processes where the
same engine applies (`research/07-impact-synthesis.md`).

## Team workflow
See `docs/TASKS.md` for the post-MVP task split.
