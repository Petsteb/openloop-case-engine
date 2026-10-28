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
│ Checklist  ‹ │  Decision card (raised), or waiting summary, │ Ask  Activity  Reasoning │
│ (attention   │  or "File complete"                          │ Ledger                ›  │
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
- **Checklist (attention first):**
  - Open items sorted conflict, then review, then expired, then waiting.
  - Each row has: the ID in mono 11px, the title (600 weight when it needs attention), the status word with its dot, a one-line reason (ellipsis, full text in the title attribute), and the next step.
  - Decisions show a blue "Your decision" marker; waiting items show "Waiting N days".
  - Rows that need attention get a 2px `--attn` bar to their left, outside the column.
  - Verified checks fold into one line, "✓ 4 checks verified", which expands.
  - Clicking a row selects it and the centre shows its detail.
- **Centre:**
  - **Decision card(s)** (reference: `DecisionCard` in the lab):
    - **Card:** radius 20px, a 1px `--line` border, a `--surface` fill with a faint `--attn` radial glow in the top-left, and a 1px attn gradient highlight along the top edge. `--tone` is `--conflict` for high severity and `--review` for medium.
    - **Header strip:** "Needs your decision" (attn dot); a severity outline pill in `--tone`; "AMLR report due in N days" with a clock icon (conflict) while that timer is pending; on the right, `EX-1` in mono and "raised day 3 at 11:21".
    - **Body:**
      - a kicker (`R2` mono chip plus the requirement title);
      - the title in display type, 24–34px, -0.03em, at most 28ch;
      - "why" in `--ink-2`, at most 64ch.
    - **Evidence as document slips:** one per document, on a `--bg` fill with a 14px radius.
      - The caption has a doc icon, the source name and the `doc-N` ID in mono on the right.
      - Each line is Source Serif 16px. Lines that **differ** or are **missing** get a `--tone` tint, a 2px `--tone` bar on the left, `<mark>` on the differing words, and a mono 11px note in `--tone` ("declared as 70%", "not in the declaration").
      - Matching lines stay in `--ink-2`; gap lines are italic muted.
    - **"What already matches":** a row of ✓ facts in muted text, e.g. "Postal code 400127 in both".
    - **Judge confidence:** thin tracks with a dashed threshold tick and the label "Needed to accept automatically: 90%".
    - **Agent note:** an attn-tinted row with "✳ Agent", the text, and the time in mono.
    - **Rule:** a hairline above, the rule ID as a mono chip, and the text muted.
    - **Footer action bar:** a hairline above with a slightly darker fill. The primary button carries a `⏎` hint; the rest are outline pills, then a spacer and an "Open in ledger" text link.
    - The data needs `papers[].lines[] {t, k: same|diff|missing|gap, marks[], note}`. Derive it from the exception snippets: the backend gives the raw lines, and the UI marks a line as diff or missing when the `requirement_id` and the rule tell it which values differ. If that can't be derived, show plain lines.
  - A **`sequence_insider` card** shows the two linked events (summaries with `#seq`) instead of quotes.
  - **Otherwise:** the selected requirement's detail (reason, evidence quotes, rule), or a waiting summary.
  - **When `READY_FOR_DECISION`:** "File complete" in display 36px, plus the summary list.
- **Right panel tabs:** Ask (default), Activity, Reasoning, Ledger, with counts in mono superscript.
  - **Ask (chat):**
    - a role toggle, "Client view" / "Bank employee", which clears history;
    - 3 suggested questions per role as dashed chips;
    - messages: user bubbles in ink fill, answers on `--surface`;
    - citation chips `#42` (switches to the Ledger tab and highlights the event) and `doc-3` (opens a dialog with that document's quotes);
    - an "offline answer" badge when `mode === "offline"`;
    - an input pill with a send button, and a typing indicator while waiting;
    - on a 404 from the endpoint: "Chat is not available on this server yet".
  - **Activity:** the feed grouped by day (time in mono, text, actor). Blocked items in `--conflict`.
  - **Reasoning:** agent steps, newest first. Each shows the reason sentence (15px), then the tool name in mono plus the gate word (Allowed in muted, "Blocked: GATE-01" in conflict with the rule text in a tooltip). "Details" expands the input and output as JSON.
  - **Ledger:** rows with the summary, day/time and short hash `c27e… ← a91f…` in mono, with "Check ledger integrity" at the top.
- **Learning sheet:** opened from the header ("Learning" outline pill with a count badge of proposals).
  - Lists proposals (support count, description, "Run backtest" showing n, auto-resolved %, false approvals and manual-review %).
  - "Promote" takes a reviewer name; a 409 shows "The person who ruled on these cases can't approve the check".
  - Lists promoted checks.
  - Hidden when `/api/learning` returns 404.
- **Demo dock:** presenter controls, kept out of the product UI.
  - A floating pill at the bottom centre: "Next client event", "Skip 1 day / 3 days / a week", "Reset demo" (confirmed with a second click).
  - Toggled with `D`. Visible by default unless the URL hash is `#clean`.

## Behaviour
- On load, `GET /api/cases/demo-1/bundle`. Every POST returns a Bundle; re-render everything from it.
- One request at a time: a busy lock disables actions, buttons show a spinner, and failures show a sonner toast in the interface's voice.
- Toasts confirm human actions: "Discrepancy confirmed. The client was asked for a corrected declaration."
- **Dev server:** Vite proxies `/api` to `http://localhost:8000`.
- **Production:** `npm run build` writes `web/dist`. FastAPI mounting `web/dist` is a 3-line change to `backend/app/main.py`, done by the backend owner at freeze. The UI must not edit backend files.
- **Accessibility:** visible focus (2px attn ring), real buttons, `aria-expanded` and `aria-pressed`, AA contrast in both themes.
