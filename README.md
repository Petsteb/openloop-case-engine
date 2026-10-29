# OpenLoop: an AI case agent for bank back-office files

**NEXXT AI Hackathon 2026 · Raiffeisen Bank · AI for Operational Efficiency · Team 16 KratosMessi**

*The agent runs the file; people make the decisions.*

| | |
|---|---|
| **Live demo** | https://openloop-production.up.railway.app: on the login page, pick an account in the **demo authenticator**, type the password `demo`, then the code it shows |
| **3-minute video** | https://drive.google.com/file/d/1TldtOLnffvt6xbBnOqmZmpFhg4NNvPxL/view (also [`docs/pitch/OpenLoop-demo.mp4`](docs/pitch/OpenLoop-demo.mp4)) |
| **Deck** | [`docs/pitch/OpenLoop-deck.pdf`](docs/pitch/OpenLoop-deck.pdf), 11 slides |
| **Tests** | 201 backend tests: `cd backend && python -m pytest -q`; browser tests in `backend/tests/e2e/` |
| **Data** | all synthetic: 8 fictional companies, documents modelled on the real Romanian forms |

## What it is, and for whom
A business-loan or annual KYB review file isn't one task. It stays open for weeks: documents arrive in any order and must agree with each other and with the policy, certificates expire, legal clocks run, and someone keeps chasing paper. **OpenLoop is an AI case agent for the bank's back-office analysts and their SME clients.** It owns the file between the human decisions: it asks for what's missing, checks every document, reminds the client, reopens the file when evidence goes stale, and hands a person only the decisions that need one.

## One workflow, input to outcome
1. **Input.** The client opens a case on the portal (phone or desktop) and uploads documents. E-mails, staff actions and the passing of time are events too.
2. **Rules and checks.** Code extracts every field with an exact quote and enforces 16 rules: trade register, ANAF tax certificate, beneficial owners (Law 129/2019, AMLR), repayment capacity, signatory, and sequence rules. Claude (Opus 5.5 on Amazon Bedrock) plans the next step behind a **gate**; only actions the rules allow can run.
3. **Outcome or exception.** Clean documents pass in seconds. A wrong file is rejected with the reason. A conflict opens a **decision card** for a person (and, for an undeclared owner, the 14-day AMLR clock). Fuzzy matches need two judges to agree: a Featherless classifier and a similarity check.
4. **Human review.** The analyst decides in a click. Rulings become precedents, then learned checks once a supervisor approves (maker-checker). When the file is complete, the reviewer checks the hash-chained ledger. The credit decision stays human: the agent has no tool that approves credit.

## Demo script (5 minutes, live site)
1. Sign in as **Ana Pop (Analyst)** with the demo authenticator (password `demo`; every account is in [`docs/auth.md`](docs/auth.md)): the work queue lists 8 synthetic files.
2. Open **Brutăria Aurora** (demo-1) and play the story with the toolbar at the bottom: **Next client event**, **3 days**, **A week**. The site is shared, so **Reset demo** restores it.
3. Decide the cards (**Same address**, **Confirm discrepancy**), then open the right panel (`]`) → **Ledger** → **Check ledger**.
4. **Preview client view** shows the same file as the client sees it, on a phone too; **Ask AI** answers from the file with citations.
5. Each other file shows one rule: Verde (no human needed), Carpatic (tax debt), Delta (suspended), Nord (DSCR 1.06), Medica (signatory ≠ administrator), Solaris (old certificate), Atelier (annual review).

## Where to look, by judging criterion
| Criterion | Evidence |
|---|---|
| Agent design and orchestration | the hybrid planner and its fallbacks (`backend/app/agent.py`), the gate (`backend/app/engine.py`), two-judge consensus (`backend/app/judge.py`), learning with maker-checker (`backend/app/learner.py`) |
| Functional completeness and testability | the live site; 201 tests (`backend/tests/`); judge calibration on 150 labelled pairs, 0 false approvals (`backend/eval/`) |
| Architecture and reproducibility | [`docs/design.md`](docs/design.md); one command to run offline (below); `Dockerfile` and the Railway deploy |
| Problem research and domain | [`research/`](research/) (sourced); the forms in `research/09-document-templates.md`; the rules in `backend/app/template.py` |
| Originality | time as a first-class ledger; rules over sequences of events (SR-01); an agent that cannot overstep; learning only through a supervisor |

## Limits, plainly
- Synthetic data only; the trade register, ANAF and e-mail are simulated.
- PDFs are stored but not read (no OCR yet): they wait for a person.
- Credit-bureau consent is recorded, not enforced.
- Our own security audit has 2 Medium findings open ([`docs/security-audit.md`](docs/security-audit.md)).
- Templates are code; an admin template editor isn't built.

More detail under "Known limitations" below.

## Run it (one command, no API keys)
```bash
pip install -r requirements.txt
cd web && npm ci && npm run build && cd ..   # React UI; without it the older static UI in frontend/ is served
python -m uvicorn app.main:app --app-dir backend --port 8000
# bank app: http://localhost:8000    client portal: http://localhost:8000/client/    sign-in: /login/
# sign in with the "Demo authenticator" on the login page (password demo + the live code); OPENLOOP_AUTH=off skips login
# every demo account and what its case shows: docs/auth.md
# reset every demo file: curl -X POST "localhost:8000/api/demo/reset?all=true"
```
Tests: `cd backend && python -m pytest -q` (rules, ledger tamper detection, and the full demo scenario end to end).

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
- **Login and access control are real but demo-seeded** (`docs/auth.md`):
  - users sign in with a password plus a TOTP code, or with Google plus the code;
  - one fail-closed policy covers every `/api` route: clients reach only their own company, staff act within their role, and identity comes from the session;
  - with `DEMO_LOGINS=1` the login page shows the synthetic accounts' live codes, so anyone can sign in as any demo account. The deployed site keeps it on for the judges; production sets `DEMO_LOGINS=0` and connects the bank's SSO through the same OIDC check.
- **Credit-bureau consent is recorded, not enforced.** An SME loan file can reach "complete" before the client consents, so that a presenter who skips the click doesn't break the demo. Production would gate the bureau check on it.
- **Rate limits are per process.** Login lockouts, the chat limit and the model-call budget (`llm.Budget`) live in memory. More than one process would need a shared store.
- **Time skip timing.** Follow-ups run once at the end of a skip. Expiry itself is applied when it happens, but the re-request is stamped with the skip's end date. That is fine for the demo's 1/3/7-day buttons; a real deployment runs on real time.
- **Learned check backtest.** It runs on a synthetic labelled set (`backend/eval/address_cases.jsonl`) that includes small-town counterexamples, where the naive rule makes 8 false approvals. It is evidence for the demo, not a substitute for backtesting on the bank's historical rulings.

## Domain evidence
`research/` holds sourced findings: Raiffeisen fines, the AMLR/DORA/AI Act timelines, prior art, and 13 processes where the
same engine applies (`research/07-impact-synthesis.md`).
