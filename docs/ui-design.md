# OpenLoop UI v2: design spec

**Audience:** a bank back-office analyst working one SME loan and KYB file, shown on a projector to a bank jury.
**Primary job:** see at a glance where the file stands in time, what needs a human decision, and why the agent did what it did.
**Data:** the same Bundle API as before (`docs/design.md`); only the frontend changes.

## Principles
1. **Time is the subject.** The one bold element is a full-width **timeline rail** (days, documents, deadlines, today). Everything else stays quiet.
2. **Color means a problem.** Neutral is the default. Waiting is *not* alarming, so it gets grey. Only conflicts, reviews and expiry get color.
3. **Human decisions get the most space.** Open exceptions take over the center column.
4. **Documents look like paper.** Quoted evidence is set in a serif on a white "sheet", with its source underneath.
5. **Plain language.** Sentence case everywhere, no ALL-CAPS labels, no "A · B · C" meta strings, no "→" in buttons, and no monospace except real hashes.

## Tokens
| Token | Hex | Use |
|---|---|---|
| `--mist` | `#EDF1EF` | page background |
| `--sheet` | `#FFFFFF` | panels, document excerpts |
| `--ink` | `#17302B` | primary text, brand wordmark |
| `--slate` | `#5E6B66` | secondary text |
| `--rule` | `#D5DDD8` | hairlines, panel borders |
| `--pine` | `#1F5A4A` | primary buttons, verified state, links |
| `--signal` | `#F2B33D` | "today" marker, needs-your-decision highlight (the only warm accent) |
| `--brick` | `#B4432F` | conflict |
| `--amber` | `#B87A12` | needs review (text-safe darker amber) |
| `--plum` | `#7E4A76` | expired |
| `--wait` | `#6B7785` | waiting |

Status words, used everywhere instead of the API codes:

| API code | Word | Color |
|---|---|---|
| SATISFIED | Verified | pine |
| OPEN_WAITING | Waiting | wait |
| CONTRADICTED | Conflict | brick |
| NEEDS_REVIEW | Needs review | amber |
| EXPIRED | Expired | plum |

**Type:** Google Fonts `Hanken Grotesk` (400/500/600/700) for the UI and `Source Serif 4` (400, 400 italic) for document excerpts. Hashes use `ui-monospace` at 11px. Use tabular figures for numbers and dates.
- **Scale:** 12 / 13 / 15 / 18 / 24 / 32.
- **Body text:** 15px, line-height 1.5.
- **Case title:** 24px, weight 600.

**Shape:**
- **Radius:** panels 10px, chips 999px, buttons 8px, paper excerpts 4px. The excerpts are deliberately sharper because they are "paper".
- **Shadows:** at most one, on the decision card only: `0 1px 2px rgba(23,48,43,.06), 0 8px 24px rgba(23,48,43,.08)`.

## Layout (1440×900 target, must not break at 1280; stacks below 1100)
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ OpenLoop  │ Brutăria Aurora SRL                                   Agent: scripted  Judge: heuristic │
│           │ SME working-capital loan and KYB check                Check ledger   Reset demo        │
│           │ 2 decisions need you                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ TIMELINE RAIL                                                                              │
│ Day 0   1   2  [3 Today]  4   5   6   7   8   9  10  11  12  13  14  15  16  17          │
│  ●●●●        ●       │                ⚑ Certificate expires        ⚑ AMLR report due      │
│ ─────────────────────┼────────────────────────────────────────────────────  [Skip 1 day] │
│  past (tinted)       │ future (plain)                               [Skip 3 days][Skip a week]│
├────────────────────┬───────────────────────────────────────────┬─────────────────────────┤
│ Checklist          │ CENTER (focus)                            │ Activity                │
│ ✓ Company active   │ If open exceptions: decision cards        │ [Agent reasoning|Ledger]│
│ ✕ Beneficial owners│  (largest, one after another)            │ reason sentence (15px)  │
│ ? Registered office│ else if READY_FOR_DECISION: completion    │ tool name, Allowed/Blocked│
│ ✓ Debt coverage    │ else: selected requirement detail +       │ Details ▸ (input/output)│
│ ◷ Signatory        │  evidence on paper excerpts               │ ...                     │
│ ◷ Tax certificate  │                                           │                         │
│ ─────────────      │                                           │                         │
│ 48 tool calls,     │                                           │                         │
│ 7 auto-verified,   │                                           │                         │
│ 2 sent to you,     │                                           │                         │
│ 1 blocked          │                                           │                         │
│ ─────────────      │                                           │                         │
│ Simulate the client│                                           │                         │
│ [Send: Day 0 pack] │                                           │                         │
│ [Send: Trade reg…] │                                           │                         │
└────────────────────┴───────────────────────────────────────────┴─────────────────────────┘
```
- **Columns:** left 300px, right 400px, center flexible. Each column scrolls independently below the fixed header and rail. Content is left-aligned.
- **Header status line**, computed:
  - `status == READY_FOR_DECISION` → "File complete. The credit decision is yours."
  - open exceptions > 0 → "N decision(s) need you"
  - otherwise → "Waiting on the client for: …", built from Waiting requirements' reasons, kept short.

## Components
**Timeline rail** (the signature element, about 110px tall):
- **Axis:** Day 0 to `max(today + 7, latest pending timer due + 2)` days, one tick per day, labels every day (12px slate). Past days get a faint ink tint; future days are plain.
- **Today marker:** a 2px `--signal` vertical line with a pill label "Today, day N".
- **Above the axis (things that happened), plotted at their `sim_time`:**
  - documents received (`events` of type DOCUMENT_RECEIVED): small pine dots, stacked when several share a time;
  - analyst decisions (EXCEPTION_RESOLVED by an analyst): ink diamonds;
  - blocked actions (trace gate starting "DENY"): small brick ticks.
- **Below the axis (things that will happen):** pending timers (`timers` with status PENDING) as flags at `due`, each labelled with its plain label. AMLR deadlines are drawn in brick. Fired or cancelled timers are greyed and struck through, small.
- **Hover/focus:** any mark shows a tooltip with the event summary.
- **Skip buttons** sit at the right end of the rail: secondary style, pine outline.
- **Motion:** the only orchestrated motion. On a time skip, the today marker slides to its new position (400ms ease-out), and newly fired timers briefly pulse once. Respect `prefers-reduced-motion`.

**Checklist (left):**
- **Rows, not cards:** status glyph (✓ / ✕ / ? / ◷ / ⌛) in its color, title (15px 500), then a one-line reason (13px slate, truncated with ellipsis, full text in `title`).
- **Interaction:** clicking a row selects it and shows its detail in the center when no decision is pending. The selected row gets a 3px left bar in `--ink`.
- **Activity summary:** one plain sentence built from `metrics`, e.g. "48 tool calls. 7 checks verified automatically, 2 sent to you, 1 action blocked."
- **"Simulate the client":** the demo controls. One button per undelivered scenario item ("Send: <label>"); delivered items become plain grey text with a check. A quiet caption: "Demo controls. In production these arrive by email and upload."

**Decision card (center, when exceptions are OPEN):** the main human interaction.
1. **Top line:** severity as a word chip ("High" in brick, "Medium" in amber) and the requirement title.
2. **Title:** 24px, from the exception.
3. **"Why it stopped":** the summary, 15px.
4. **Rule:** a quiet box with the rule ID and rule text, 13px.
5. **Evidence:** the two snippets side by side as paper excerpts: white sheet, 1px rule border, 4px radius, serif 16px quote. The source label underneath is 12px slate ("From: Trade register certificate"). Keep line breaks (`white-space: pre-wrap`).
6. **Judge (if present):** two horizontal bars with labels "Same place" / "Different place" (map the label keys: same_address→Same place, different_address→Different place, same_person→Same person, different_person→Different person) and percentages. A dashed marker at `threshold` labelled "Needed to accept automatically: 90%". Below that, a slate line: "Judge: heuristic" (from `judge.source`).
7. **Notes (if any):** "Agent note: …" in italic slate.
8. **Actions:** the first action is primary (pine fill, white text), the others secondary. Use the labels from the API, tidied: drop any "→" and keep the sentence.
9. **Highlight:** a 4px left edge in `--signal` and the only shadow in the app.
- **Resolved exceptions:** collapsed under "Resolved (N)" below the open cards, each showing one line with the resolution.

**Requirement detail (center, when nothing is pending):**
- title, status word chip, full reason, rule chips (rule ID plus text on hover);
- evidence quotes as paper excerpts, each with its source document name (look up `documents[].name` by `doc_id` when `label` is missing);
- "Last updated day N".

**Completion state (center, READY_FOR_DECISION):** a calm sheet.
- **Headline:** "File complete", 32px.
- **Body:** "All 6 checks are verified. The agent has stopped here because the credit decision belongs to a person."
- **Summary list:** each requirement with its reason.
- **Ledger:** a line with the ledger check result and its button.

**Activity (right):** two tabs, "Agent reasoning" (default) and "Ledger".
- **Agent reasoning:** newest first. For each step:
  - the reason sentence (15px ink), then a meta row with the tool name in plain 13px slate (`check_requirement` becomes "check requirement") and the gate word: "Allowed" in pine, "Blocked: <rule>" in brick (tooltip shows the blocked text from `output.blocked`), or nothing for read-only tools.
  - "Details" disclosure showing input and output as pretty JSON (monospace allowed here, 12px).
  - Blocked steps get a faint brick background tint.
  - Group consecutive steps from the same `sim_time` under a small day heading ("Day 3").
- **Ledger:** newest first, compact rows: plain event summary, day, and the short hash linked to the short previous hash (`c27e… ← a91f…` in ui-monospace 11px). At the top, the integrity check button with its result: "Chain intact, 135 events" in pine, or "Chain broken at event #k" in brick.

## Behaviour (unchanged from v1)
- On load, `GET /api/cases/demo-1/bundle`, falling back to `POST /api/demo/reset` on 404.
- Every POST returns a Bundle; re-render everything.
- Keep the busy lock, button loading states, error toasts, and the `?mock=1` mode with `mock-bundle.json`.
- Reset needs a confirm. Use an inline second click: "Reset demo" becomes "Click again to reset".
- After resolving the last open exception, the center returns to requirement detail (or completion).
- **Accessibility:** visible keyboard focus (2px pine outline with offset), buttons are real `<button>`s, contrast is AA.
