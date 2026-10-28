# Client portal + document views: design

**Status:** draft for approval, 2026-10-28 23:50. **Builds on:** `docs/design.md` (API v2) and `docs/ui-design.md` (Night ledger tokens).

## Why
OpenLoop has no screen for the customer. The applicant only gets emails, and Raiffeisen's real pain is files waiting on the client. Three things fix that:
- a **client portal** that shows the file from the client's side and lets them act on it;
- a **document viewer** that lets the analyst check the whole source document, not just the snippet on a card;
- a **per-document history** for both roles.

**Demo payoff:** the portal and the bank screen side by side. The client uploads, the bank screen updates by itself, the agent reacts, and the client sees the next request appear.

## Principles
1. **Client-safe by construction.** The portal reads only client endpoints, and the server builds them field by field from an allow-list (`case_views.py`), never by hiding fields in the UI.
2. **One next action.** The top of the portal always answers "what do I need to do now?".
3. **Same truth, two lenses.** Both screens read the same ledger; the client sees outcomes, the bank sees reasons.
4. **Plain language.** No rule IDs, scores or internal words. ON_HOLD, CONTRADICTED and NEEDS_REVIEW all read "Under review by the bank".
5. **Phone-first.** SME owners use their phones (Smart Business is mobile). The portal works at 390 px wide and becomes two columns at ≥ 1024 px.

## Routes
- `/`: the bank (employee) case screen, as built.
- `/client`: the client portal for `demo-1`. There is no login in the demo; a header strip says "Demo: client view of Brutăria Aurora SRL".
- **Two-screen demo:** open `/` and `/client` in two windows side by side.

## Client portal
### Layout
```
Desktop ≥1024px                                         Phone <1024px (stacked in this order)
┌──────────────────────────────────────────────────────┐ ┌──────────────────────────┐
│ Your financing file · Brutăria Aurora SRL   [status] │ │ header + status          │
│ Working-capital loan, 500,000 RON                    │ │ progress                 │
├──────────────────────────────────────────────────────┤ │ what we need from you    │
│ Progress:  ● Documents ── ● Checks ── ○ Bank review ── ○ Decision │ messages     │
├───────────────────────────────┬──────────────────────┤ │ your documents           │
│ What we need from you (n)     │ Ask about your file  │ │ ask about your file      │
│  ┌─────────────────────────┐  │  [chat, client role] │ │ privacy note             │
│  │ Fiscal certificate ANAF │  │  suggested questions │ └──────────────────────────┘
│  │ Why: shows you have no  │  │                      │
│  │ tax debts. Asked day 0, │  ├──────────────────────┤
│  │ reminder sent day 3.    │  │ Messages from the    │
│  │ [Upload file] [Use sample]│ │ bank (emails)        │
│  └─────────────────────────┘  │                      │
│  Confirm: new phone number    │                      │
│  [Yes, I made this change] [No, I didn't]            │
├───────────────────────────────┴──────────────────────┤
│ Your documents: name · received · status chip · history ▸ │
├──────────────────────────────────────────────────────┤
│ Privacy: internal reviews are not shown here. A bank officer makes the credit decision. │
└──────────────────────────────────────────────────────┘
```

### Sections
1. **Header:** "Your financing file", the company name and the requested product, plus one status pill:
   - "We need something from you" (amber), when pending requests > 0;
   - "Under review by the bank" (neutral), when open exceptions exist or the file is ON_HOLD;
   - "Complete: the bank will contact you with the decision" (green), when READY_FOR_DECISION.
2. **Progress (4 steps, derived):**
   - Documents: done when no pending requests;
   - Checks: done when every requirement is verified;
   - Bank review: active when a case is under review, done when READY;
   - Decision: the human decision, never done by the app.
3. **What we need from you:** one card per pending request, newest first.
   - **Label:** the client-friendly document name.
   - **Why:** one sentence from `CLIENT_RULE_TEXT`.
   - **When:** "Asked day N", reminders sent, "next reminder day M".
   - **Buttons:** **Upload file** (`.txt` or `.pdf`, ≤ 1 MB), and **Use sample file** (demo only: uploads the prepared synthetic document for that request).
   - **Upload states:** Uploading… → "Received, we're checking it" → the card disappears, or shows "Not accepted: this document seems to belong to another company. Please upload yours." → after a refresh, an "Expired, please send a new one" card appears when relevant.
4. **Confirmations:** shown when the bank needs the client to confirm something.
   - **Contact change made by staff:** "We updated your phone number to 07•• ••• 958. Did you request this?" with **Yes, I made this change** / **No, I didn't**. "No" opens a fraud-report message ("Our team will contact you").
   - **Credit-bureau consent:** "We need your consent to check your company's credit history" with **I consent** / **Not now**.
5. **Messages from the bank:** the outbox emails, newest first: subject, day, and the body on expand. In Romanian, as sent.
6. **Your documents:** every document the client sent.
   - **Status chip:** Received · Verified · Please send a new one (expired) · Not accepted.
   - **History ▸** expands to: requested (day), received (day), verified / needs replacing (day).
7. **Ask about your file:** the chat with `role: "client"`.
   - **Suggested questions:** "What do you still need from me?", "What happened so far?", "Why isn't my file finished?".
   - **Citations:** chips; `#seq` and `doc-N` open the matching message or document.
8. **Privacy note** (footer): "Internal reviews and staff notes are not shown here. A bank officer makes the credit decision."

### Copy rules
Client strings never contain:
- rule IDs, percentages from reviews, staff IDs, "judge", "discrepancy" or "insider";
- "compliance" or "on hold" (it shows "Under review by the bank" instead).

Use sentence case and second person, and keep each sentence under 20 words.

## Employee additions
1. **Document viewer** (a right-side Sheet), opened from evidence quotes, decision-card snippets, `doc-N` citations, and the Documents tab. It shows:
   - **Header:** document name and type, issued and received dates, a validity chip (Valid until … / Expired …), and the extractor used (`builtin` / `bank_docai`).
   - **Full text:** in the serif "paper" style. Each extracted field's quote is highlighted, green when verified; rejected quotes are listed separately in red: "Rejected: quote not found in document".
   - **Used by:** the requirements that cite this document, with status words.
   - **History:** every ledger event that touched this document (requested, received, extracted, checked, cited on card, expiry set or fired, superseded by a newer version), each with day and `#seq`.
2. **Documents tab:** sits next to Reasoning and Ledger, and lists every case document with type, issued/received day, status (Valid / Expired / Superseded / Quarantined) and which checks use it. Clicking a row opens the viewer.
3. **Preview client view:** a link in the header that opens `/client` in a new window.

## Live updates
Both screens poll `GET /api/cases/{id}/version` every 2.5 s and refetch the bundle (or client view) only when `length` changed. Polling is paused while a request from this tab is in flight.

## API additions (backend)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/cases/{id}/version` | none | `{"length": int, "status": str}` |
| GET | `/api/cases/{id}/documents?role=client\|employee` | none | `[{"id", "type", "label", "name", "issued_day", "received_day", "status": "valid"\|"expired"\|"superseded"\|"quarantined", "status_word", "used_by": [{"id", "title"}]}]`. **Client:** no `used_by`; only its own uploads, which is all documents here. |
| GET | `/api/cases/{id}/documents/{doc_id}?role=...` | none | **Employee:** `{"id", "type", "name", "text", "extractor", "fields": [{"field", "value", "quote", "verified": true}], "rejected": [quote], "used_by": [...], "validity": {"expires_day", "expired"}, "history": [{"seq", "day", "what"}]}`. **Client:** `{"id", "name", "received_day", "status_word", "text", "history": [{"day", "what"}]}`, with client-safe history only. |
| POST | `/api/cases/{id}/upload` | multipart: `file`, `key` (the pending request key, e.g. `fiscal_certificate` or `id_card:Radu Pop`) | Client-view JSON. 422 if `key` is not pending or the file is >1 MB or not .txt/.pdf. A tax ID that doesn't match the case leads to quarantine (`DOCUMENT_QUARANTINED`, nothing extracted), and the client gets a message. |
| GET | `/api/demo/sample-files` | none | `[{"key", "label", "filename"}]`: the synthetic file for each requestable key |
| POST | `/api/cases/{id}/upload-sample` | `{"key"}` | The same as `upload`, using the prepared file (the "Use sample file" button) |
| POST | `/api/cases/{id}/client-confirm` | `{"kind": "contact_change" \| "credit_check_consent", "answer": "yes" \| "no"}` | Client-view JSON. `contact_change` + `yes` emits `CLIENT_CONFIRMATION`, which clears SR-01 when it comes before the credit action. `no` emits `CLIENT_DISPUTE` and raises a high-severity card for the bank. |
| GET | `/api/cases/{id}/client-view` | none | **Exists already.** Adds `confirmations: [{"kind", "text"}]` (pending) and `documents` (the client list above). |

**Upload pipeline:** an uploaded `.txt` in our synthetic format goes through the same `DOCUMENT_RECEIVED` → pipeline → planner path as scenario items, with actor `client` and `source: "upload"`. `.pdf` is accepted and stored, then shown as "Received, waiting for manual reading" unless the stretch item (Claude PDF extraction) lands.

## Out of scope
Authentication, real e-signature, payments, multiple cases or a case list, a mobile app shell, and Romanian/English UI switching (stretch).

## Build plan and estimate (now ≈ 23:50; checkpoint 02:00; freeze 08:00)
| # | Who | Work | Est. |
|---|---|---|---|
| P1 | Backend (Claude, main session) | `version`, `documents` list/detail with history, `upload` + `upload-sample` + sample files, `client-confirm`, wrong-company quarantine, client-view additions; tests | 2–2.5 h |
| P2 | UI session | `/client` portal: sections 1–8 with polling | 2–2.5 h |
| P3 | UI session | Employee document viewer, Documents tab, "Preview client view" link | 1.5 h |
| P4 | ELTheo77 (from ~04:00) | End-to-end tests covering the two-screen flow; optional EN/RO toggle | 1–2 h |

**Cut order if late:**
1. EN/RO toggle;
2. the `.pdf` path (keep `.txt` and the sample upload);
3. client document history;
4. the Documents tab (the viewer still opens from cards);
5. the confirmation "No, I didn't" branch (keep "Yes").
