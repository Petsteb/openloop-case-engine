# OpenLoop: 3-minute video script

**Setup**
- **Screens:** the bank app on the left (1440×900), the client portal on a phone-sized window on the right.
- **Offline mode is enough** (`AGENT_MODE=scripted JUDGE_MODE=heuristic`). For the live take, run `AGENT_MODE=bedrock JUDGE_MODE=featherless` and warm the judge cache once.
- **Reset before recording:** `POST /api/demo/reset?all=true`, then open `/#/case/demo-1` and `/client/#/case/demo-1`.
- **Voice:** calm and concrete. Total target 2:55.

| Time | Screen | Voice-over |
|---|---|---|
| **0:00–0:15** | The work queue (`/#/`), 8 files, needs-you first | "A business loan or KYB file isn't one task. It stays open for weeks: documents arrive in any order, certificates expire, legal clocks run, and someone keeps chasing paper. OpenLoop is an AI case agent that owns the file between the human decisions." |
| **0:15–0:30** | Point at rows: Verde *Ready*, Carpatic *tax debt*, Delta *suspended* | "Here the agent has already done the routine work. This file completed with no human at all; these need a decision, and each card says exactly why: a tax debt, a suspended company." |
| **0:30–0:45** | Open Brutăria Aurora (demo-1). Click **Next client event** | "Our demo client, a bakery, sends its application pack. Code extracts every field with a verbatim quote, checks the rules, and the agent asks for what's missing. The repayment capacity is verified automatically." |
| **0:45–1:05** | **3 days** → portal: **I consent**, then **Try a wrong file** → "Not accepted" | "Reminders go out on their own. On the client's phone, a document from another company is rejected immediately, and the client is told why in plain words. The bank sees the exact reason." |
| **1:05–1:30** | **Next client event** ×2 → two cards; point at "the gate denied" in the Reasoning tab | "The trade register shows a 25% owner the client never declared. The agent starts the 14-day legal clock and opens a card. The client then emails 'the shareholder changed'; the agent links it, tries to ask for a new declaration, and our gate blocks it, because a person hasn't decided yet." |
| **1:30–1:50** | Click **Same address**, **Confirm discrepancy**, then **Next client event** → *File complete* | "Two clicks from the analyst. The corrected documents arrive, the legal clock is cancelled, and the file is ready for the credit decision. That decision stays human: the agent cannot approve credit, by design." |
| **1:50–2:05** | **A week** → *expired, reopened* → **Next client event** → *complete* | "A week later the certificate expires. The engine reopens the file by itself. With the fresh certificate, the address question is answered by reusing the analyst's earlier ruling, with no new card." |
| **2:05–2:30** | **Next internal event** → portal **No, I didn't** → **Next internal event** → **Put on hold** | "Now the case behind a real fine: an employee changes the client's phone, then runs a credit-bureau check. The client says on the portal they never asked for it. Two cards, the file goes on hold for compliance, and the client only sees 'under review'." |
| **2:30–2:45** | Messages tab with a `#doc` chip; **Check ledger** → verified | "Bank and client talk in one thread that can point to any document or event. Every step, every email and every chat answer is in a hash-chained ledger, and anyone can verify it." |
| **2:45–2:55** | The architecture slide, or the calibration chart | "Claude plans; code enforces; people decide. 132 tests, a judge calibrated to zero false approvals, eight synthetic companies, one engine, ready for annual reviews, garnishments and DORA deadlines. OpenLoop." |

**Fallbacks while recording**
- **If a live call is slow,** cut to the offline take; it's the same UI and the same steps.
- **If anything goes wrong,** "Reset demo" in the toolbar restarts demo-1 in a second.
- **Prefer reading answers off the screen** over typing; the case-aware suggestion chips on the Ask tab are ready-made questions.
