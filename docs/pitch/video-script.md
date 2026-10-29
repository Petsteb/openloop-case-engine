# OpenLoop: 3-minute video script (v2, split screen)

**Frame:** a dark background. The bank analyst's PC is on the left (the bank app, 1440×900, about two-thirds of the width). The client's phone is on the right (the portal at 390×844 in a phone frame).

**Story:** one real case, end to end: Brutăria Aurora, a bakery, applies for a 500,000 RON working-capital loan. A new Aurora loan case runs the same scripted events as demo-1, so every step is real app behaviour.

**Timing:** follows the organizers' structure: 0:00–0:20 problem, 0:20–2:00 demo, 2:00–2:40 how it works, 2:40–3:00 value, limitation, next step.

**Overlays (added in editing):**
- **Agent working:** a robot badge above the bank screen, and the bank screen's border glows blue while the agent works. Like Claude in Chrome's glow.
- **Handed to a person:** the glow turns amber when the agent hands a decision to a person.
- **Arrow:** an animated arrow phone → PC when a file is sent, and PC → phone when the bank asks for something.
- **Clock:** a stopwatch shows how long the agent took (real, measured).
- **Calendar:** a page flip for simulated days.
- **Fast-forward:** a ⏩ 4× badge whenever footage is sped up.

| Time | Left: bank PC | Right: client phone | Overlay | Voice-over |
|---|---|---|---|---|
| **0:00–0:20** | Work queue, 8 files | Portal home, "My cases" | Title: "OpenLoop: the AI case agent for bank back-office files" | "A business loan file isn't one task. It stays open for weeks: documents arrive in any order, certificates expire, and someone keeps chasing paper. OpenLoop is an AI agent that owns the file between the human decisions." |
| **0:20–0:35** | A new case appears in the queue | **Start a new application** → Working-capital loan | Arrow phone → PC; robot badge; blue glow | "The client opens a loan application on their phone. The agent creates the file and asks for exactly the documents this kind of loan needs." |
| **0:35–0:50** | Checklist rows turn green; the extracted fields show their quotes | Upload the application pack (sample files) | Arrow phone → PC; glow; stopwatch "≈ 4 s" | "The client sends the application pack. In seconds the agent reads every field, with a quote from the document, checks the bank's rules, and verifies the repayment capacity." |
| **0:50–1:00** | The agent asks for the missing ID and the certificates | "Pending" shows what is still needed | Arrow PC → phone | "What's missing is requested in plain words: on the phone, and by e-mail." |
| **1:00–1:05** | Clock jumps 3 days; reminder sent | The reminder arrives | Calendar flips 3 days | "Three days pass. The reminder goes out on its own." |
| **1:05–1:25** | Two decision cards: the address is written two ways, and the trade register shows a 25% owner the client never declared. A legal 14-day clock starts | Client sends the trade register certificate; the case reads "Under review" | Glow turns amber: "Handed to a person" | "Now there's a conflict. The registered office is written two ways, and the trade register shows an owner who isn't declared. The agent doesn't guess: it hands both to a person, and starts the 14-day legal clock." |
| **1:25–1:35** | Analyst clicks **Same address**, then **Confirm discrepancy**; the agent requests a new owner declaration | The request appears on the phone | Arrow PC → phone | "Two clicks. The analyst's ruling is stored as a precedent, so the agent learns it." |
| **1:35–1:45** | Analyst writes in Chat: "The register shows Radu Pop with 25%; please send an updated declaration." | Chat dot; client opens Chat, then asks **Ask AI**: "How long will my case take?" | | "The analyst explains in the chat. The client asks the assistant about the timeline and gets an answer from the file itself." |
| **1:45–1:55** | Corrected declaration verified; legal clock cancelled. A week later the certificate expires; the case reopens; the fresh certificate passes, and the address question is answered by the earlier ruling, with no new card | Client uploads the corrected files | ⏩ 4×; calendar "1 week"; glow blue | "The corrected files pass instantly. A week later a certificate expires; the agent reopens the file by itself. The fresh one passes, and the address question is answered from the analyst's earlier ruling." |
| **1:55–2:00** | Bell: "File complete: the credit decision is yours". The reviewer opens the Ledger and clicks **Check ledger** → verified | "Bank review" step | Green border | "The file is complete. The reviewer gets the ping, checks the tamper-evident ledger, and the credit decision stays theirs: the agent cannot approve credit, by design." |
| **2:00–2:40** | Architecture slide (deck slide 4) | | | "Claude Opus on Amazon Bedrock plans each step. Deterministic code does the rest: it extracts fields with exact quotes, and enforces sixteen rules from the Romanian trade register, tax certificate and anti-money-laundering law through a gate the agent can't bypass. Fuzzy questions go to two judges, a Featherless classifier and a similarity check, which must agree. Calibrated on 150 labelled pairs, that's zero false approvals. Every step goes into a hash-chained ledger, and analyst rulings become checks only after a supervisor approves them." |
| **2:40–3:00** | Numbers slide | | | "In this file a person made two decisions; the agent did everything else in seconds, for about 26 cents in model calls. Industry surveys put a corporate KYC review at 95 days. The data here is synthetic, and the registry and e-mail are simulated: connecting the real ONRC and ANAF services is our next step. OpenLoop: the agent runs the file; people make the decisions." |

## Honest labels (shown on screen, small, bottom left)
- "Synthetic data. Registry and e-mail simulated." Show from 0:20 to 2:00.
- "Simulated time" on every calendar jump; "⏩ sped up" on every fast-forward.
- "Industry survey (Fenergo, 2023), vendor figure" under the 95 days.

## Numbers used, with sources
- **≈ 4 s per document batch:** measure it in the recording with the stopwatch. Don't quote 4 s unless the take shows it.
- **≈ $0.26 per file:** model calls at Anthropic list prices, from `docs/pitch/performance.md`.
- **0 false approvals on 150 pairs:** `backend/eval/calibration.json`.
- **16 rules:** HR-01..09, JQ-01..02, SR-01..02, GATE-01..03 (`backend/app/template.py`).
- **95 days per corporate KYC review:** Fenergo 2023 survey, a vendor claim (`research/09-problem-validation-and-bank-deployments.md`).

## How to record
1. **Bank screen:** the bank app signed in as Ana Pop (analyst), on case `#/case/<new id>`, with the demo dock hidden (press D, or open the URL with `#clean`).
2. **Phone screen:** the portal in a 390×844 window, signed in as andrei.munteanu@brutaria-aurora.example.
3. **Driving the story:** use the phone's Upload / Use sample file. The dock's "Next client event" (bank side) sends the scripted e-mails, and "3 days" / "A week" move the clock.
4. **Before recording:** check that no password, 2FA code or key is visible. Turn notifications off.
5. **Two captures:** record the two windows separately at full quality, then lay them side by side and add the overlays.
