# OpenLoop security audit

**Date:** 2026-10-29 · **Base:** `main` at `4316c0d` · **Data:** synthetic only

## Summary
- **Scope.**
  - Every backend module in `backend/app/` (API, engine, gate, agent, chat, views, judge, learner, ledger, store, notifier).
  - Both React apps in `web/src/` (bank `/`, portal `/client/`), plus a spot check of the legacy `frontend/`.
  - The full git history (all refs), `requirements.txt` and `web/package.json`.
- **Method.**
  - **Manual review** of the code and of the business rules behind each requirement (R1–R6, SR-01/02, learning loop).
  - **UI sink search:** `dangerouslySetInnerHTML`, `innerHTML`, data-built `href`s, markdown.
  - **History secret scan:** key patterns plus non-empty secret assignments. Values were never printed.
  - **Offline probes:** scripted agent, heuristic judge, outbox email, in-memory database. No paid calls.
- **Not done.**
  - `npm audit`: `web/node_modules` is absent, so nothing was installed.
  - No live Bedrock or Featherless calls, and no browser testing.
- **Proofs.** `backend/tests/test_security_audit.py` holds the proof-of-concept tests.
  - Each `xfail` test asserts the secure behaviour, so it fails today. Its reason names the finding.
  - The 3 plain tests pin strengths.
  - Run: `cd backend && python -m pytest -q tests/test_security_audit.py -rxX`. The full suite gave 135 passed, 13 xfailed at audit time.
  - When a fix lands, its test XPASSes; then remove its marker.
  - **On `theo/logic-fixes`:** 158 passed, 4 xfailed. The xfails left are SEC-12 (`annotate_exception` gate), SEC-14 (fixed in `main.py` on `theo/auth`) and SEC-17 ×2.
- **Headline.**
  - **Login is missing,** and `theo/auth` fixes that (SEC-01, 10, 11, 21).
  - **The client controls the document text,** which the auth branch does not cover.
    - The rules trust client-uploaded issuer documents (SEC-02). A forged trade-register certificate hides a 25 % owner, and the demo file reaches READY_FOR_DECISION with no card.
    - Dates and amounts parsed from that text break HR-03, HR-05 and HR-07 (SEC-03 to SEC-06).
  - **The judge's "0 false approvals"** only holds while Featherless is up (SEC-07).
  - **Update:** `theo/logic-fixes` fixes the document-text findings (SEC-02 to 07, 22 and 23) and hardens SEC-12/13, with no change to the demo. See "Fixed on theo/logic-fixes".

## Findings
Status: **Fixed: theo/auth** = fixed on the auth branch · **Fixed: theo/logic-fixes** = fixed on the business-logic branch (see "Fixed on theo/logic-fixes" below) · **Partly fixed** = the part named is done · **Open** = not covered · **Accepted for demo** = documented trade-off.

| ID | Severity | Title | Location | Impact | Fix | Status |
|---|---|---|---|---|---|---|
| SEC-01 | Critical | No authentication: role, company and case come from the request | `backend/app/main.py:297` (bundle has no role check), `main.py:255`, `main.py:365`, `web/src/client/store.ts:29` | Anyone can read any case's full bank bundle (agent trace, insider cards, staff IDs, analyst notes) and act as any client or analyst. | Session login and one fail-closed policy over `/api`: clients see only their own company, staff roles decide the rest. | Fixed: theo/auth |
| SEC-02 | Critical | Client-uploaded issuer documents are trusted as the trade register and the tax office | `backend/app/engine.py:555` (R2 owners from the uploaded certificate), `engine.py:636` (R5 administrator), `engine.py:670` (R6), `main.py:446` | A client uploads a forged ONRC certificate without Radu Pop. The file reaches READY_FOR_DECISION with every check "Verified", no card and no AMLR clock (PoC). A forged ANAF certificate likewise hides tax debt. Quote verification only proves the quote is in the client's own text. | Take owners, administrator and postal code from the registry API (the mock already returns administrator and postal code, `profiles.py:353`), and fiscal status from ANAF. Treat uploaded issuer documents as "claimed" until a verification code or e-signature is checked. Show the evidence source on each check. | Fixed: theo/logic-fixes |
| SEC-03 | High | ID evidence comes from the request key, not the document; ID validity is never checked | `engine.py:530`, `engine.py:113`, `extract.py:18` | Uploading "scan attached" for `id_card:Elena Munteanu` counts her as identified (HR-05). An ID card expired in 2020 is "Valid" (PoC). | Identify the person only from the extracted, verified `Nume`/`Prenume` fields. Require `valid_until` > now. Quarantine the upload when fields are missing. | Fixed: theo/logic-fixes |
| SEC-04 | High | Issue dates are read from client text, and future dates are accepted | `engine.py:100`, `engine.py:312`, `rules.py:35` | A fiscal certificate dated 01.01.2030 stays SATISFIED 45 days later, which bypasses HR-03 expiry (PoC). | At ingestion, reject an `issued_at` later than the sim clock, or more than N years old. | Fixed: theo/logic-fixes |
| SEC-05 | High | A poison issue date permanently breaks a case | `rules.py:31`, `engine.py:165`, `engine.py:413` (only KeyError, TypeError and ValueError are caught) | One upload with `Data eliberării: 31.12.9999` returns 500 (PoC). Afterwards the client view, the document list, messages, uploads and decisions on that case all 500. The event is in the append-only ledger, so the case stays broken after a restart. | Validate the date range at ingestion (as SEC-04). Make `doc_expired` total. Catch `Exception` in `run_tool` for pipeline steps and raise a card instead. | Fixed: theo/logic-fixes |
| SEC-06 | High | DSCR passes for a loss-making company or when debt lines are missing | `rules.py:73` (the sign is dropped), `extract.py:81` (a missing field reads as 0), `rules.py:60` (division by 0 gives inf) | An EBITDA of "-420.000 RON" passes at 1.4. Removing the existing-debt line turns 0.83 (fail) into 2.08 (pass). Both are PoCs, and HR-07 shows "Verified". | Keep the sign, including accounting parentheses. A missing mandatory amount makes the check NEEDS_REVIEW, never 0. A zero denominator is not a pass. | Fixed: theo/logic-fixes |
| SEC-07 | High | The heuristic judge auto-accepts different street numbers, and a Featherless outage leaves one signal deciding | `judge.py:172`, `judge.py:173`, `judge.py:168` | "nr. 10" vs "nr. 104" and "nr. 1" vs "nr. 2" are auto-accepted as the same address (PoC). In heuristic mode (the default) and on any Featherless error, the "two judges" are the same string score. | Hard rule: every token containing a digit must match exactly before any judge. When the classifier is unavailable, escalate and never auto-accept. | Fixed: theo/logic-fixes (number rule; a Featherless outage still falls back to the similarity check alone) |
| SEC-08 | High | Maker-checker stays non-binding even after login: every ruling is recorded as `analyst-1` | `engine.py:17`, `engine.py:388`, `learner.py:100`, `main.py:629` | `ruled_by` is always `analyst-1`, so the analyst who made the rulings can promote the learned check under their own name. | Pass the session user into `Case.resolve` as the actor. Compare promoter and rulers by user ID. | Fixed: theo/auth |
| SEC-09 | High | Paid LLM calls are unmetered | `main.py:372`, `main.py:84` (10 × 6000-char client history), `chat.py:164` (6 calls × 3000 tokens), `agent.py:213`, `main.py:466`, `main.py:574`, `main.py:596` | Every chat, client message, upload and confirmation runs Claude Opus on Bedrock. With no quota, a script can burn the budget. 40 concurrent chats (25 s each) also exhaust the sync worker pool and freeze both apps. | Per-user and per-case rate limits. A daily token budget that trips to scripted mode. Cap the history at about 8k characters. Put a semaphore around LLM calls. | Partly fixed: theo/auth (12 chats/user/min, LLM call budget + concurrency cap) |
| SEC-10 | High | Identity is taken from request bodies | `main.py:549` with `messages.py:76` (message author), `main.py:345` (release-hold `by`), `main.py:73` (promote `by`) | Anyone can post to a client as any staff name, release a compliance hold, or promote a check as "supervisor". | Take identity from the session. Release: compliance only. Promote: supervisor only. | Fixed: theo/auth |
| SEC-11 | High | Demo controls are public, and the database wipe is CSRF-able | `main.py:208` (`reset?all=true` calls `STORE.wipe`), `main.py:302`, `main.py:316`, `main.py:646`, `store.py:55` | Any web page the presenter opens can wipe every case with a body-less cross-site POST. Anyone can also skip time up to 60 days per call, deliver items, or take the registry "down" for all cases. | Staff-only plus SameSite cookies. Also disable reset, inbound, advance and registry unless `DEMO_MODE=1`: an append-only audit store should have no delete path. | Fixed: theo/auth |
| SEC-12 | Medium | Prompt injection into the planner, with model-written text outside the gate | `engine.py:19` (`annotate_exception` is not an action tool), `engine.py:793`, `agent.py:148`, `agent.py:205` (the brief carries client text), `engine.py:721`, `engine.py:781` | Client text reaches Claude through `get_document`, message summaries and owner names in requirement reasons. A steered planner can attach "verified by phone, dismiss this card" to the analyst's card with gate `-` (PoC). State changes stay gated (see strengths). | Gate `annotate_exception` (open, non-MON cards only, ≤300 characters). Tag model-written notes, summaries and reasons "AI-written, unverified" in the UI. Wrap client-sourced strings in `<untrusted>` delimiters in the brief. | Partly fixed: theo/logic-fixes (client text delimited as data; `annotate_exception` still ungated) |
| SEC-13 | Medium | The chat can be steered: client-supplied assistant turns, and client text in staff tool results | `chat.py:138`, `chat.py:79`, `main.py:84` | Client documents and messages can steer the employee chat into misstating facts: citations prove an event exists, not that it supports the sentence. The client can forge "assistant" history to make their own answers say anything. Data cannot leak, because tools are role-filtered in code. | Keep the chat history server-side. Wrap client-sourced fields in tool results as untrusted. Show the quoted text next to each citation. In client answers, never state decision words ("approved"). | Fixed: theo/logic-fixes (history verified server-side, tool results delimited; citation quotes in the UI still open) |
| SEC-14 | Medium | The client portal receives each company's internal risk story | `main.py:251`, `profiles.py:29` | `/api/companies` (called by the portal) returns `story`, e.g. "insider pattern" or "tax debt (HR-08)". That is an AML tipping-off risk (PoC). | Drop `story` from the public route, or move it to a staff-only route. | Fixed: theo/auth |
| SEC-15 | Medium | High-impact card decisions take one person, including the flagged employee | `engine.py:383`, `engine.py:701` (dismiss cancels the AMLR clock), `sequence.py:66`, `engine.py:359` | One analyst can waive an HR-04 discrepancy and cancel the legal clock, or mark an SR-01 insider card "legitimate", even when the card names them. | Require compliance plus a second person for dismiss, legitimate and acknowledge on HR-04, SR-01 and SR-02. Block the staff ID named on the card. | Open |
| SEC-16 | Medium | Client confirmations are not bound to the client: staff can pre-confirm and suppress SR-01 | `main.py:587`, `sequence.py:32`, `engine.py:340` (the actor is always `case.client`) | An insider who calls `/client-confirm` "yes" before the credit check never triggers the insider card. | The policy must allow `/client-confirm`, `/upload` and client messages only for the client's own session, and never for staff roles. | Fixed: theo/auth |
| SEC-17 | Medium | The ledger proves internal consistency only | `ledger.py:43` (checks the in-memory list), `store.py:12` (no UPDATE/DELETE guard), `main.py:191` (bad chains silently skipped) | Edits to stored rows still "verify" (PoC). Anyone with database write access can rewrite and rehash a whole chain (PoC). A tampered case silently drops out of the queue at restart. | Verify from the store. Anchor each case head hash (or a Merkle root over all cases) every few minutes to an external WORM store, an RFC 3161 timestamp or the bank's SIEM. HMAC events with an HSM key. Add DB triggers that reject UPDATE and DELETE. Alert, don't skip, on a broken chain. | Open |
| SEC-18 | Medium | The global write lock is held across LLM and SMTP calls; ledgers grow without bound | `main.py:41`, `main.py:453`, `notifier.py:98` (15 s SMTP inside the lock), `engine.py:278` (`state()` replays the full ledger) | One slow or abusive case (Bedrock up to 20 s, Gmail up to 15 s per write) stalls writes on every case. Chat turns, messages and rejected 1 MB uploads append forever and slow every later request. | Per-case locks. Plan outside the lock, then apply under it (the gate re-checks state). Send email from an outbox worker. Set per-case quotas, keep document bytes outside the ledger, and cache state per sequence number. | Open |
| SEC-19 | Medium | Credit-bureau consent is recorded, not enforced | `engine.py:131`, `engine.py:213`, `engine.py:787` | A file completes and the bureau query runs without consent, or after a "no"; the client cannot change a "no" later. | Gate the bureau action and `mark_ready_for_decision` on granted consent, and allow withdrawal and renewal. | Accepted for demo |
| SEC-20 | Medium | Client data leaves the EU, and the judge uses a public demo endpoint | `llm.py:19` (us-east-1), `judge.py:62`, `judge.py:74` (the cache persists address pairs into a tracked file) | Document text, names and addresses go to Bedrock in the US, and to Featherless's public demo API when no key is set. | EU or private endpoints under a DPA. Fail closed outside demo mode. Keep the judge cache out of the repo. | Accepted for demo |
| SEC-21 | Medium | No request body cap, no security headers, and a non-constant-time token compare | `main.py:65` (`note` unbounded), `main.py:550` (`refs` dicts unbounded), `main.py:32`, `main.py:368` | Large JSON bodies are read fully into memory. There is no CSP, frame-ancestors or nosniff header. | Body cap, the security headers middleware, and `hmac.compare_digest` (or sessions). | Fixed: theo/auth |
| SEC-22 | Low | Names from client documents flow into emails, labels and the planner | `extract.py:30` (owner name `.+?`), `engine.py:183`, `notifier.py:30` | An "Asociat" line can carry a URL or instructions into bank-branded emails, request labels and the planner brief. Header injection is not possible: To and Subject are fixed, and `EmailMessage` rejects CR/LF. | Validate person names (letters, spaces, hyphen; at most 60 characters) at extraction. | Fixed: theo/logic-fixes |
| SEC-23 | Low | Pipeline tool errors fail open | `engine.py:413`, `engine.py:59`, `engine.py:670` | A fiscal certificate without the obligations line is "Received" by the client and fulfils the request, while R6 waits forever with no card and no re-request (probe). | A missing mandatory field quarantines the upload with a reason and re-requests it. A pipeline tool error raises a card. | Fixed: theo/logic-fixes |
| SEC-24 | Low | `/docs` and `/openapi.json` are public and outside the `/api` middleware | `main.py:29` | The full API map, including demo controls, is public even after the `/api` policy lands. | `FastAPI(docs_url=None, openapi_url=None)` outside dev, or extend the policy to these paths. | Fixed: theo/auth |
| SEC-25 | Low | Dependencies are unpinned, and a third-party micro-package serves as the class helper | `requirements.txt:1` (all `>=`, no hashes, test tools in runtime), `web/package.json:19` (`cn@0.5.0`), `web/package.json:24` (`shadcn` CLI as a runtime dependency) | Builds aren't reproducible, and a compromised or yanked minor release reaches the demo machine. `npm audit` was not run. | `pip-compile --generate-hashes`. Replace `cn` with a local `lib/utils` helper. Move `shadcn` to devDependencies. Run `npm audit --omit=dev` in CI. | Open |
| SEC-26 | Low | The legacy static UI builds HTML with `innerHTML` | `frontend/app.js:449` (and `:483`, `:653`, `:695`, `:718`), `main.py:658` | It is served whenever `web/dist` is missing. Every sink spot-checked uses `esc()`, and tooltips use `textContent`, but one missed `esc()` becomes stored XSS. | Delete `frontend/`, or refuse to start without `web/dist`. | Accepted for demo |
| SEC-27 | Info | No secret found in git history | all refs (`git log -p --all`) | `.env` was never committed; `.env.example` has empty values. No AWS, Bedrock, Anthropic, Google or GitHub key patterns, and no non-empty secret assignments. | Rotate the Bedrock key, Featherless key and Gmail app password after the event anyway: they were shared out of band, and an app password opens the whole mailbox. Use a dedicated sender. Add gitleaks as a pre-commit hook. | Open |

## Fix first (no auth needed, small diffs)
1. **SEC-04/05, about 10 min.** Reject issue dates that are in the future or outside 2000–2100 at ingestion (`engine.receive_upload`).
2. **SEC-06, about 15 min.** Make `parse_amount` keep the sign; a missing amount makes R4 NEEDS_REVIEW.
3. **SEC-07, about 15 min.** Address numbers must match exactly; a heuristic-only result never auto-accepts.
4. **SEC-03, about 15 min.** The ID card must contain the person's name and an unexpired validity date.
5. **SEC-14 and SEC-12, about 10 min.** Drop `story` from `/api/companies`; add `annotate_exception` to `ACTION_TOOLS` with an open-card rule.
6. **SEC-02, about 30 min in the mock.** Compare R5 and the R3 postal code against the registry result; add owners to the mock registry and use them in R2.

Items 1–4 and 6 are done on `theo/logic-fixes`, and SEC-14 on `theo/auth`. The `annotate_exception` gate (item 5, SEC-12) is still open, because that branch left the gate unchanged on purpose.

## Fixed on theo/logic-fixes
Each fix has passing tests in `backend/tests/test_security_audit.py`.

**The demo is unchanged.** Before and after the fixes, an offline replay (scripted agent, heuristic judge) produced identical ledgers: same event types, summaries, requirement reasons, evidence, card snippets, agent steps and emails. The replay covered:
- the README demo script, including the wrong-company upload, consent, dispute and insider card;
- every other company's demo dock;
- a portal-only completion with sample files for each company and template.

- **SEC-04/05, issue dates.**
  - **Ingestion:** an upload's issue date must be a real date between 1990 and the case clock. Otherwise the upload is quarantined: it shows "Not accepted", the request stays pending, and a Romanian email says the date is invalid.
  - **Expiry maths can't crash:** `doc_is_valid` and `doc_expires_at` never raise, and a date in the future never counts as valid.
  - **Tool errors:** `run_tool` catches any exception as a failed step. If a `check_requirement` can't run, its requirement becomes NEEDS_REVIEW, never SATISFIED, and the safety net opens a card. A failed check never cancels the AMLR clock.
- **SEC-06, DSCR.**
  - `parse_amount` keeps a minus sign and accounting parentheses.
  - A missing or unreadable amount is `None`, never 0.
  - R4 becomes NEEDS_REVIEW, with the card "DSCR cannot be computed" (HR-07), when an input is missing or debt service isn't positive. A zero denominator never passes.
- **SEC-07, street numbers.** `judge.numbers_match` is a hard rule before any score: every token with a digit must match exactly, and postal codes must match when both strings have one.
  - The probabilities are unchanged, so `eval/calibration.json` still holds.
  - Replaying the 150 pairs offline gives the same 62 auto-accepts and 0 false approvals.
- **SEC-03, ID cards.**
  - HR-05 identifies the person printed on the card (`Nume`/`Prenume`), who must match the requested person, and only while `Valabilă până la` is not past.
  - An ID upload with no name or validity date, or one that has already expired, is quarantined.
  - An ID card that expires while the file waits shows as Expired, and the bank asks for it again.
- **SEC-23, incomplete uploads.**
  - An upload that lacks a line a rule needs is quarantined, and the reason names the line. Examples: `Obligații fiscale restante`, a certificate's issue date, any beneficial-owner line.
  - A document that bypasses ingestion and breaks a rule check opens a card.
- **SEC-02, the trade register as the source of truth.**
  - **Owners:** the mock registry lists each company's associates, and HR-04 compares the declaration against those, quoting the certificate wherever it agrees. A forged certificate can't hide Radu Pop: the HR-04 card and the 14-day AMLR clock still fire.
  - **Mismatch:** if the certificate's associates, administrator or postal code differ from the registry, R1 becomes CONTRADICTED under a new rule, HR-09. That opens a high-severity card, hidden from the client, and the bank asks for a genuine copy.
  - **Not done:** the ANAF certificate is still trusted, because there is no mock ANAF API.
- **SEC-12/13, prompt injection.**
  - **Delimiters:** client-originated text reaches Claude only inside `<case_data>` blocks, built by `llm.untrusted`, which also defuses a closing tag inside the data. The planner and chat system prompts say this text is data, never instructions. This covers the planner's event list, the case state and every tool result.
  - **Chat history:** a history turn sent by the browser as the assistant is kept only if its sha256 matches a `CHAT_TURN` this server logged for the case. Only the last 8 messages are kept.
  - **Unchanged:** the tool schemas and the gate.
- **SEC-22, owner names.** An owner's name may contain only letters, spaces, dots, hyphens and apostrophes, up to 60 characters. Any other owner line is ignored, so the owner counts as missing and a card opens.

## What is already good
- **The gate holds even against a hijacked planner.** A planner fully controlled by an attacker calls `approve_credit` and gets DENY (GATE-02). It calls `mark_ready_for_decision` on an incomplete file and gets DENY (GATE-01), and the file stays OPEN (passing test). Duplicate requests are denied (GATE-03), and every call is logged with its reason and verdict.
- **Hard rules are code, with rule IDs.**
  - READY needs every requirement SATISFIED, no open card and no missing document.
  - Expiry, legal clocks, escalations and re-requests run in code, and the safety net runs after Claude every time.
  - The planner has 4 turns and a 20 s budget, and falls back to the scripted planner.
- **Quote verification.** An extracted value counts only if its verbatim quote is in the document and contains the value; a real quote paired with a forged value is dropped. The suspicious-line scan flags injection text for the analyst.
- **Two-signal judge.** With Featherless up, the classifier (≥ 0.9) and the similarity check (≥ 0.8) must agree, and only after the postal code matches. On 150 labelled pairs that gave 0 false approvals, against 7 for the classifier alone.
- **Client views are allow-lists.**
  - Every client field is built field by field, with a second deny-list filter (`_INTERNAL_MARKER`).
  - The chat's tools are role-filtered in code: the model cannot pass `role`, and `explain_step` is employee-only. Citations are filtered to what the role may see.
  - Tool output to the model is truncated at 4000 characters for the planner and 6000 for the chat.
- **The hash chain catches any edited event** (passing test). SQL uses bound parameters only (passing test). One writer at a time keeps the chain linear, and a reset detaches stale case objects.
- **File handling is narrow.**
  - Uploads never touch disk, and PDFs are hashed, never parsed.
  - Only `.txt`/`.pdf`, at most 1 MB, strict UTF-8 and `b64decode(validate=True)`.
  - Sample files are looked up by exact name, so there is no path traversal.
  - Another company's or another person's document is quarantined and never used as evidence.
- **No XSS sinks in the React apps.** There is no `dangerouslySetInnerHTML` and no markdown renderer. Every `href` is a constant or an `encodeURIComponent`'d case ID, and document text renders as text nodes.
- **Email is safe by construction.** Mail is built from fixed Romanian templates that never mention internal reviews. To and Subject are fixed, so there is no header injection. Demo addresses are `.example`, or redirected to `NOTIFY_TO`.
- **No secrets in history**, and the tests blank every API key before `.env` loads.
