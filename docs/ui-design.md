# OpenLoop UI v3: design spec ("Night ledger" + Funnel)

**Audience:** a bank back-office analyst working one SME loan and KYB file, also shown on a projector to a bank jury. The client sees a reduced view through the chat role toggle.

**Primary job:** see at a glance where the file stands in time, what needs a human decision, and why the agent did what it did. The screen holds a lot of information but must never feel cluttered.

**Decided by the team (2026-10-28):**
- palette "Night ledger";
- type pairing Funnel;
- layout: three columns with **collapsible side panels**;
- checklist: **attention first**;
- timeline: **swimlanes** with TradingView-style zoom.

**Visual reference prototypes:**
- **UI lab:** https://claude.ai/artifact/BiX7qVcdboebC2P3Ydykj7. Its source is `C:\Users\petst\AppData\Local\Temp\claude\C--Info-Hackathons-NexxtAI-2026\38a5346a-9645-4285-ab75-f8e552487176\scratchpad\openloop-ui-lab.html`. The timeline zoom, pan and navigator code there is the reference implementation to port.
- **Design directions:** https://claude.ai/artifact/1owMkEscXXGF4oViWZhu3L. Its source is `…\scratchpad\openloop-design-directions.html`, which holds the component specimens.

**Data:** the Bundle API (`docs/design.md`), plus the additions planned in `docs/superpowers/plans/2026-10-28-openloop-final-14h.md`:
- Task 2: `ON_HOLD`, `sequence_insider` exceptions;
- Task 4: `POST /api/cases/{id}/chat`, `CHAT_TURN` events;
- Task 9: `/api/learning*`, `bundle.learning`.

The UI must degrade gracefully while those endpoints don't exist yet: a 404 shows a quiet "not available yet" state, never a crash.

## Principles (the calm patterns)
1. **Colour means a problem.**
   - **Verified** is plain ink with a solid dot. **Waiting** is muted with a hollow dot.
   - **Conflict** (coral), **needs review** (amber) and **expired** (violet) are the only state colours.
   - **Electric blue** (`--attn`) marks the one thing that needs a person: the needs-you dot, "now" on the timeline, the attention bar beside checklist rows, and primary-button hover.
2. **Space and hairlines, not boxes.** Sections are separated by space and one 1px hairline. **The decision card is the only raised surface.** No shadows elsewhere; no borders around every item.
3. **Summary first, detail on demand.**
   - One line per item; reasons, quotes and tool input/output open on click.
   - Rare actions live in a ⌘K command bar (stretch goal) or behind "More".
4. **One focal point per screen.** The decision gets the large display type and the only filled button.
5. **Plain language:**
   - sentence case, no ALL-CAPS labels;
   - no "A · B · C" meta strings;
   - no "→" inside buttons;
   - monospace only for machine data (IDs like `R2`, `EX-1`, `#41`, `doc-5`, hashes, times).

## Tokens
Dark first. Light is the alternative, chosen by `prefers-color-scheme: light` or a theme toggle in the header.

**Contrast audit (2026-10-28):**
- Every text pair passes **WCAG 2.2 AA**: 4.5:1 for text, 3:1 for large text, UI boundaries and the focus ring.
- Every text pair also passes **APCA**: body text Lc ≥ 75; secondary text and status words Lc ≥ 60.
- **Hairlines** are decorative, so the 3:1 requirement doesn't apply. **Input borders** use `--field`, which meets 3:1.
- The audit script is `scratchpad/contrast.mjs`. Rerun it if a token changes.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#141414` | `#E6E6E6` | page |
| `--surface` | `#1C1C1C` | `#F1F1F1` | decision card, popovers, chat bubbles |
| `--surface-2` | `#222222` | `#F7F7F7` | hover fills |
| `--ink` | `#EDEDED` | `#121212` | primary text, verified dot, primary button fill |
| `--ink-2` | `#D0D0D0` | `#333333` | secondary body text (the "why", quotes that match) |
| `--muted` | `#B4B4B4` | `#575757` | labels, meta, waiting; the lowest text level allowed |
| `--line` | `#383838` | `#C4C4C4` | hairlines (decorative) |
| `--line-2` | `#4A4A4A` | `#B3B3B3` | chips, outline pills (the text carries the meaning) |
| `--field` | `#7C7C7C` | `#7A7A7A` | input borders (≥ 3:1) |
| `--accent` / `--accent-ink` | `#EDEDED` / `#141414` | `#121212` / `#F1F1F1` | primary button |
| `--attn` / `--attn-ink` | `#9DBCFF` / `#0A1022` | `#1F4AE0` / `#FFFFFF` | needs you, now, focus ring, AI pill |
| `--conflict` | `#FF9B8A` | `#A82E1C` | conflict, blocked by the gate, AMLR deadline |
| `--review` | `#F4C95D` | `#7A5205` | needs review |
| `--expired` | `#D7B3FF` | `#6A3AAE` | expired, certificate-expiry deadlines |

**Other modern-standard requirements:**
- **Target size** (WCAG 2.2, 2.5.8): click targets are at least 24×24 CSS px; inline citation chips inside sentences are exempt. Rail buttons are 30px; timeline marker hit areas have a 13px radius.
- **Focus** (WCAG 2.4.11 and 2.4.13): a visible 2px `--attn` ring with a 2px offset on every interactive element.
- **Colour is never the only signal** (1.4.1): every state has a word and an icon or dot, and differences in documents are also annotated in text.
- **Motion:** `prefers-reduced-motion` turns off every transition and the typing animation.

**shadcn mapping:**
- `--background` = bg, `--foreground` = ink, `--card` / `--popover` = surface;
- `--muted-foreground` = muted, `--border` / `--input` = line;
- `--primary` = accent, `--primary-foreground` = accent-ink;
- `--ring` = attn, `--destructive` = conflict.

Keep the custom tokens above as well.

**Type** is bundled via `@fontsource` so it works offline; check each package with `npm view` first.
- **Funnel Display** (400, 500): display. Used for the case name, decision titles, big numerals and group names.
- **Funnel Sans** (400, 500, 600): UI and body, 15px with line-height 1.55.
- **Source Serif 4** (400): document quotes ("paper").
- **Geist Mono** (400, 500): IDs, hashes, times, axis labels.

**Scale:** 11 / 12 / 13 / 15 / 18 / 22 / 30 / 44. Display headings use `letter-spacing: -0.02em` to `-0.03em`. Use tabular numbers.

**Shape:**
- radius 999px for pills, buttons and segmented controls;
- 18px for the decision card;
- 0 for sections, which are hairlines only.

**Motion:**
- **Buttons:** the fill grows as a circle from the point where the cursor entered, 450ms ease-out. The primary button fills with `--attn`.
- **Panels:** collapse with a 350ms grid transition.
- **Timeline:** "now" slides on a time skip.
- **Nothing else moves.** Respect `prefers-reduced-motion`.

## Layout (≥1280 CSS px, including 150% display scaling at about 1333 px; must never overflow horizontally)

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ OpenLoop   Brutăria Aurora SRL (display 44px)                    4/6        3     14  │
│            SME working-capital loan and KYB check                verified   day   days│
│            ● 2 decisions need you                                                to AMLR│
├───────────────────────────────────────────────────────────────────────────────────────┤
│ Swimlanes timeline: Client / Agent / Analyst / Deadlines, overview strip, range       │
│ presets, zoom ± and Now (production view, no demo buttons)                             │
├──────────────┬─────────────────────────────────────────────┬──────────────────────────┤
│ Checklist  ‹ │  Decision card (raised), or waiting summary, │ Ask Activity Reasoning   │
│ (attention   │  or "File complete"                          │ Ledger Email Docs     ›  │
│  first)      │                                              │ (tab content)            │
└──────────────┴─────────────────────────────────────────────┴──────────────────────────┘
```
- **Columns:** `grid-template-columns: var(--lw, 290px) minmax(0, 1fr) var(--rw, 340px)`, gap 36px, every column `min-width: 0`.
- **Collapsible side panels:**
  - Each side panel header has a hide button (‹ on the left panel, › on the right). Keyboard shortcuts: `[` toggles left, `]` toggles right, ignored while typing in an input.
  - A collapsed panel becomes a **44px rail**: a pill-shaped vertical button with a chevron and a vertical label.
    - **Checklist rail:** 6 status dots in attention order (hollow for waiting) and an `--attn` count badge of problems.
    - **Right rail:** the time of the latest event, plus a blue dot if a chat answer arrived while it was collapsed.
  - Clicking the rail reopens the panel. The open/closed state persists in `localStorage` with try/catch.
- **Below 1180px:** the right panel moves below. **Below 820px:** single column, and rails turn horizontal.

## Components
- **Header:**
  - case name in display type;
  - status line with a dot: `needs` = attn dot with a soft ring; `done` = ink dot; `wait` = hollow;
  - big numerals: checks verified, day of the case, and days to the AMLR report (only while that timer is pending, numeral in `--conflict`);
  - mode badges (agent: scripted/bedrock; judge) in muted 12px;
  - "Check ledger" outline pill showing "Chain intact, N events" after a check;
  - "Preview client view" (see below);
  - theme toggle.
- **Timeline (swimlanes):** port from the lab.
  - **Lanes:** Client (documents as filled ink dots, emails as hollow dots), Agent (muted squares), Analyst (attn diamonds), Deadlines (flags: legal in conflict, expiry in expired, reminders muted; done ones struck through).
  - **Interaction:**
    - wheel zooms around the cursor;
    - drag pans; Shift+wheel or a horizontal swipe also pans;
    - double-click shows the whole case;
    - `+`, `-` and the arrow keys work when the timeline is focused.
  - **Controls:**
    - range presets: 1 day, 1 week, 2 weeks, whole case;
    - Now and zoom ±;
    - an overview strip with a draggable and resizable window;
    - a crosshair with a date pill;
    - close events cluster into a count bubble;
    - clicking a marker shows details under the timeline.
  - **Data:** comes from `bundle.events` (map event types to lanes and kinds) and `bundle.timers`. `AGENT_STEP` events only appear when "Every agent step" is on (an option in a ⋯ menu).
    - `CHAT_TURN`, `EMAIL_SENT`, `EMAIL_FAILED`, `CHECK_PROMOTED`, `STAFF_CONTACT_CHANGE`, `CREDIT_ACTION` and `CLIENT_CONFIRMATION` never go on the rail; they stay in the Ledger tab. An employee's insider actions are not analyst work.
    - A compliance release is a staff marker on the Analyst lane.
- **Checklist (attention first):**
  - Open items sorted conflict, then review, then expired, then waiting.
  - Each row has: the ID in mono 11px, the title (600 weight when it needs attention), the status word with its dot, a one-line reason (ellipsis, full text in the title attribute), and the next step.
  - Decisions show a blue "Your decision" marker; waiting items show "Waiting N days".
  - Rows that need attention get a 2px `--attn` bar to their left, outside the column.
  - Verified checks fold into one line, "✓ 4 checks verified", which expands.
  - Clicking a row selects it and the centre shows its detail.
- **Centre:**
  - **Decision card(s)** (reference: `DecisionCard` in the lab):
    - **Card:** flat, modelled on the panels in Linear and Vercel's Geist. Elevation is one lightness step (`--surface` on `--bg`), a 1px `--line` border and a 12px radius. **No gradients, glows or shadows anywhere.** `--tone` is `--conflict` for high severity and `--review` for medium.
    - **Header row** (hairline below): "Needs your decision" (attn dot), a severity outline pill in `--tone`, and `EX-1` in mono on the right.
    - **Body:**
      - the title in display type, 24–32px, -0.03em, at most 28ch;
      - "why" in `--ink-2`, using the full panel width with no character cap; it only wraps when the panel is narrow;
      - **meta properties**, Linear-style: a grid of muted 12px labels over 13px values. They are Check (`R2` plus title), Rule (`HR-04`), Deadline ("AMLR report in 14 days" in conflict, only while that timer is pending) and Raised (day and time).
    - **Comparison, "on file" vs "new":** always two slips, the **on-file document on the left** and the **newly received document on the right**, separated by a dashed vertical rule with a small mono "vs". They stack on narrow screens.
      - Each slip: radius 8px, a `--bg` fill, 1px `--line`. The **new** slip's border is `--attn` mixed at 55% with `--line`.
      - Caption row:
        - an age pill: "New" filled with attn, or "On file" as an outline;
        - the document name and the `doc-N` ID in mono;
        - underneath, the source type and timing in muted text: "Official register (ONRC), received day 3 at 11:20", or "Signed by the client, on file since 15 Sep 2026".
      - Lines in Source Serif 16px:
        - lines that **differ** or are **missing** get a 2px `--tone` bar on the left (no background tint), `<mark>` on the differing words, and a mono 11px note in `--tone` ("declared as 70%", "not in the declaration");
        - matching lines stay in `--ink-2`; gap lines are italic muted.
      - The data needs `role` (`onfile`/`new`) per document. Derive it from received times: the document that triggered the check is "new"; the older document it's compared with is "on file".
    - **Only differences by default.** Matching lines (e.g. "Elena Munteanu 30%" in both) and the "what already matches" ✓ facts ("Postal code 400127 in both") are hidden behind a "Show what already matches" text toggle (`aria-expanded`), so the panel shows only what needs a decision.
    - **Judge confidence:** thin tracks with a dashed threshold tick and the label "Needed to accept automatically: 90%".
      - The classifier's tick uses `judge.threshold` and sits only on its "same" row. With `judge.second_opinion` (v2), a second track "Similarity check" carries its own tick at `second_opinion.threshold`.
      - Under the tracks: the verdict ("Not accepted automatically." from `judge.auto_accept`; a card only exists when auto-accept failed), then "Auto-accept needs both bars past their marks".
      - `judge.source` is shown in mono beside the heading, in `--review` when it reports a failure ("heuristic (featherless failed: …)").
    - **Agent note:** a flat `--surface-2` row with a 1px border and an 8px radius, "✳ Agent" in attn, the text, and the time in mono.
    - **Rule:** the rule ID as a mono chip, with the rule text muted.
    - **Footer action bar:** a hairline above, no fill. The primary button carries a `⏎` hint; the rest are outline pills, then a spacer and an "Open in ledger" text link.
    - The data needs `papers[].lines[] {t, k: same|diff|missing|gap, marks[], note}`. Derive it from the exception snippets: the backend gives the raw lines, and the UI marks a line as diff or missing when the `requirement_id` and the rule tell it which values differ. If that can't be derived, show plain lines.
  - A **`sequence_insider` card** shows the two linked events instead of quotes: "First" and "Then" on one thin rail, ordered by `first_seq` / `then_seq`, each with its `#seq` chip and time. Between them sits the gap in `--tone` mono ("At the same time, with no client confirmation in between").
  - A **`client_dispute` card** (a staff contact change, then the client answered "No, I didn't" in the portal) uses the same rail.
    - The gap reads "…, the client said they did not make this change", and the Check reads `MON` "Client contact details".
    - It reuses rule `SR-01`, so the hold banner tells it apart by `kind`: it says the client disputed a staff change instead of naming the insider pattern.
  - **When `ON_HOLD`:** a hold banner owns the centre, above every other branch (a selected row or an open card never hides it). It is the same flat card in the conflict tone, with:
    - "On hold — escalated to compliance" and a one-line why (agent paused, insider pattern SR-01);
    - escalated day/time, the rule and the linked events;
    - "Release hold", which opens an optional one-line note plus "Confirm release" / "Cancel". This posts `release-hold` with `by: "compliance-1"`, and a 409 shows a toast.
  - While on hold, the checklist's empty line reads "On hold with compliance…", never "Nothing needs attention".
  - **Otherwise:** the selected requirement's detail (reason, evidence quotes, rule), or a waiting summary.
  - **When `READY_FOR_DECISION`:** "File complete" in display 36px, plus the summary list.
- **Right panel tabs:** Ask (default), Activity, Reasoning, Ledger, Email, Docs. Counts are in mono superscript, except on Ask and Docs.
  - All six must fit on one line in the default 340px panel, at 1333 and 1440 px, with no horizontal scrolling. Labels are 12px, never smaller.
  - The list is start-aligned with `space-between` and a 4px minimum gap. Shadcn's centring clips the first tab on overflow.
  - Measured at worst-case counts (Ledger 112, Activity 54), the six tabs need 286 of the 300px, so a three-digit Activity count still fits.
  - **Ask (chat):**
    - a role toggle, "Client view" / "Bank employee", which clears history;
    - 3 suggested questions per role as dashed chips;
    - messages: user bubbles in ink fill, answers on `--surface`;
    - citation chips `#42` (switches to the Ledger tab and highlights the event) and `doc-3` (opens the document viewer);
    - an "offline answer" badge when `mode === "offline"`;
    - an input pill with a send button, and a typing indicator while waiting;
    - on a 404 from the endpoint: "Chat is not available on this server yet".
  - **Activity:** the feed grouped by day (time in mono, text, actor). Blocked items in `--conflict`.
  - **Email:** `bundle.outbox`, newest first as sent, grouped by day.
    - Each row shows the subject (verbatim Romanian; a click opens the body in `pre-wrap`), "To" with the address in mono, and a mode tag ("Outbox, not sent" or "Gmail").
    - A failed row adds "Failed" in `--conflict` plus the error text.
  - **Reasoning:** agent steps, newest first. Each shows the reason sentence (15px), then a mono `by` tag (code, Claude, planner, safety net; nothing when null), then the tool name in mono plus the gate word (Allowed in muted, "Blocked: GATE-01" in conflict with the rule text in a tooltip). "Details" expands the input and output as JSON.
  - **Ledger:** rows with the summary, day/time and short hash `c27e… ← a91f…` in mono, with "Check ledger integrity" at the top.
  - **Docs:** every document in the case, newest first, from `GET /documents?role=employee`. The server defaults to the client view, so `role=employee` is required.
    - A summary line first ("11 documents, 2 superseded.").
    - **One button row per document:**
      - the `doc-N` id in mono, the name, and the status word with its dot;
      - under them, the type (only when the name doesn't already say it) and the dates ("Issued 7 Oct 2026, received day 0, 28 Oct");
      - then "Used by R3 R5" (ids in mono, title and status in the tooltip) or "Not used by a check".
    - **Status colours:**
      - Valid: plain ink, solid dot;
      - Superseded: muted, hollow dot, and the name is muted too;
      - Expired: `--expired`;
      - Quarantined: `--conflict`;
      - "Needs manual reading" (`unreadable`, a PDF): `--review`.
    - Clicking a row opens the viewer.
    - The list is fetched in App, not in the tab, and refetched when the ledger grows, so opening the tab never flips statuses.
    - On 404/405/501 the list is derived from `bundle.documents`: a newer document of the same kind supersedes, and certificates expire 30 days after issue.
- **Document viewer:** a right-side sheet. It opens from:
  - evidence quotes in the requirement detail;
  - the `doc-N` chip on each decision-card slip;
  - `doc-N` chat citations;
  - the Docs tab;
  - `doc-N` links in the viewer's own history ("Superseded by doc-11").
  - **Look:** flat, on `--bg`, 600px wide, with hairline sections. Sheets dim the page with a flat overlay (no blur), so the card behind stays readable.
  - **Header:**
    - the `doc-N` chip, the type and the status word, then the name in display type;
    - a property grid: Issued, Received (exact time from the bundle), Validity and "Extracted by";
    - Validity is an outline pill: "Valid until 6 Nov" in ink, "Expired 6 Nov" in `--expired`, or "No expiry date";
    - "Extracted by" shows `builtin` / `bank_docai` in mono, with its plain name in the tooltip;
    - case days before day 0 show as a date with the year ("7 Oct 2026").
  - **Document:** the full text as a serif slip (16px Source Serif on `--surface`, 1px line, 8px radius).
    - Each extracted field's quote is marked with an ink tint; hovering shows the field and value.
    - Marks use the server's exact `start`/`end` offsets, trusted only when `text.slice(start, end) === quote`; otherwise the quote is searched for.
    - An unverified field is marked in `--review` with a wavy underline.
    - `injection_lines` are struck through in a `--conflict` tint.
    - A quarantined document gets a `--conflict` bar note with `quarantine_reason`; an unreadable one gets a `--review` note.
  - **Extracted fields:** a fold listing each field's name and value. It is closed by default, because the marks already show every quote, and opens by itself when a field is unverified or there is no full text.
  - **Not used as evidence** (shown only when there is something):
    - each rejected quote in serif with a 2px `--conflict` bar and the mono note "Rejected: quote not found in document";
    - each injection line with "Ignored instruction in document".
  - **Used by:** one button row per check (mono id, title, status word from the live bundle). Clicking closes the sheet and selects that check in the centre.
  - **History:** the day in mono, what happened, and a `#seq` chip.
    - The chip closes the sheet and opens the Ledger tab with that event highlighted.
    - Arrows in server text become words ("Used as evidence: R1 now verified").
  - **Data:** `GET /documents/{id}?role=employee`, refetched when the ledger grows. The previous answer stays on screen while it refetches.
  - **Fallback** on 404/405/501 or an unknown id: the view is built from the bundle.
    - Quotes come from requirement evidence and card snippets; values and the extractor from the `extract_fields` trace step; history from ledger events that name the document.
    - The text section then says "The full text is not available on this server".
    - An id that isn't in the case reads "This document is not in this case".
  - **Dev fixtures:** `?mock` on the dev server adds, from `web/src/lib/mock-docs.ts`:
    - a rejected quote and an injection line on the financial statements;
    - a quarantined upload (`doc-90`) and an unreadable PDF (`doc-91`).
    - They load only through a dynamic import behind `import.meta.env.DEV`, so production builds don't contain them.
- **Preview client view:** a quiet outline pill in the header tools (`btn quiet sm`, with an external-link icon). It opens `/client/` (trailing slash) with `target="_blank" rel="noopener"`, for the two-window demo.
- **Learning sheet:** opened from the header ("Learning" outline pill with a count badge of proposals).
  - Lists proposals (support count, description, "Run backtest" showing n, auto-resolved %, false approvals and manual-review %).
  - "Promote" takes a reviewer name; a 409 shows "The person who ruled on these cases can't approve the check".
  - Lists promoted checks.
  - Hidden when `/api/learning` returns 404.
- **Demo dock:** presenter controls, kept out of the product UI.
  - A floating pill at the bottom centre: "Next client event", "Skip 1 day / 3 days / a week", "Reset demo" (confirmed with a second click).
  - Bank-internal items (`scenario[].internal`) follow the client items in the ⋯ menu. Each drops the "Internal: " prefix and carries an "Internal" tag. When the next item is internal, the button reads "Next internal event".
  - Toggled with `D`. Visible by default unless the URL hash is `#clean`.

## Behaviour
- On load, `GET /api/cases/demo-1/bundle`. Every POST returns a Bundle; re-render everything from it.
- One request at a time: a busy lock disables actions, buttons show a spinner, and failures show a sonner toast in the interface's voice.
- **Live updates** (`hooks/useCase.ts`): another window (the client portal, a second bank screen) can change the case.
  - Poll `GET /api/cases/demo-1/version` every 2.5 s. Refetch the bundle only when `length` differs from the events on screen (`!==`, because a reset shortens the ledger).
  - The poll is one `setTimeout` chain, so ticks never overlap, and it never toasts.
  - It pauses while this tab is hidden or has any request in flight. A counter in `lib/api.ts` covers actions, chat, learning and documents.
  - A generation counter drops a poll answer that lands after a newer bundle from an action.
  - **Fallback:** when `/version` answers 404/405/501, refetch the bundle every 5 s instead, and ask for `/version` again every 30 s. A refetched bundle replaces the state only if events, status or sim time changed.
  - **No fighting the UI:** components keep their own state across a new bundle (chat draft and message-list scroll, selection, timeline view, open sheet). The chat scrolls only its own message list; the Ledger scrolls only when a `#seq` is opened.
- Toasts confirm human actions: "Discrepancy confirmed. The client was asked for a corrected declaration."
- **Dev server:** Vite proxies `/api` to `http://localhost:8000`.
- **Production:** `npm run build` writes `web/dist`. FastAPI mounting `web/dist` is a 3-line change to `backend/app/main.py`, done by the backend owner at freeze. The UI must not edit backend files.
- **Accessibility:** visible focus (2px attn ring), real buttons, `aria-expanded` and `aria-pressed`, AA contrast in both themes.

## Client portal (/client)
P2's notes on the client portal will be added here.
