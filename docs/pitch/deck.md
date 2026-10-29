# OpenLoop: pitch deck (content draft)

The built deck is `OpenLoop-deck.pdf` (11 slides, from `build_deck.py`); it supersedes this draft where they differ.

Built around the jury weights:
- agent design 25%;
- completeness and testability 20%;
- originality 15%;
- domain 15%;
- architecture 15%;
- business 10%.

Every number carries its source. The sources are in `research/`, and our own measurements are in the repo.

---

## 1. OpenLoop
**The AI case agent for bank files that stay open for weeks.**
- Raiffeisen track: AI for Operational Efficiency.
- Team: Petru · Teodor.
- Visual: the bank work queue next to the client portal on a phone.

## 2. The problem: back-office work is an open loop
A loan or KYB file isn't one task. It's weeks of waiting and re-checking:
- **Documents arrive over days,** in any order, from several parties.
- **Every document must agree with the others** and with the policy: owners, addresses, signatory, taxes, repayment capacity.
- **Certificates expire while the file waits** (the bank's 30-day rule for the trade-register certificate).
- **Legal clocks tick,** e.g. a beneficial-owner mismatch must be reported within 14 days (AMLR art. 24, from 2027).
- **Exceptions need a person,** and today a person also chases every missing paper.

What it costs:
- **Per review:** one corporate KYC review takes about **$2,598 and 95 days** (2023 vendor survey; research/07).
- **Raiffeisen's own words:** on an earlier remediation it wrote *"procesarea desfăşurându-se manual"* (research/01).

Speaker note: "Every bank has AI that reads a document. Nobody owns the file between documents."

## 3. What goes wrong today: a real case
- **The fines:** ANSPDCP fined Raiffeisen Romania in 2022 and in 2024. In one case an employee **changed clients' phone and email details and then applied for credit products** without consent; in another, **credit-bureau queries were run without signed consent** (research/01).
- **The corrective order:** any staff change to client data must be notified to the client, who must agree to it.
- **The link:** this is a *sequence across time*, invisible to any single-document check. OpenLoop's insider rule (SR-01) catches exactly this sequence, and the client confirms or disputes the change in the portal (SR-02).

## 4. OpenLoop in one picture
- **The ledger:** every file is an **append-only, hash-chained event ledger**. State = replay of events.
- **Code runs the pipeline:** extraction with verbatim quotes, registry lookup, hard rules (HR-01…08), timers, expiry.
- **The agent plans:** Claude (Opus 5.5 on Amazon Bedrock) decides the next steps, behind a **gate**. Only actions the rules allow can run, and *approve credit* is hard-wired to DENY.
- **A judge settles fuzzy matches:** Featherless classifier plus a similarity check. It auto-accepts only when both agree.
- **People decide** on short decision cards. Their rulings become precedents, and later **learned checks**.
- **Two screens on one ledger:** the bank's work queue and case screen, and the client portal (uploads, questions, messages).

## 5. Demo: one file, start to decision (the video)
1. **Day 0:** 4 documents arrive. DSCR 1.4 is verified automatically; the agent asks for the missing papers.
2. **Trade-register certificate:** an **undeclared 25% owner**, so the 14-day legal clock starts and a card opens. The address is written two ways, so the judge is unsure and another card opens.
3. **Client email** "shareholder changed": the agent links it to the card and tries to ask for a new declaration. **The gate says no**, because the analyst hasn't decided yet.
4. **The analyst decides** in two clicks. The corrected documents arrive, the clock is cancelled, and the file is **ready for the credit decision**.
5. **A week later** the certificate expires. The engine (not the agent) **reopens the file**, and the fresh certificate closes it again; the address is resolved by **reusing the analyst's precedent**.
6. **Internal events:** a staff member changes the client's phone, then runs a credit-bureau query. On the portal the client says **"No, I didn't"**. Two cards open, the file goes **on hold** for compliance, and the client sees only "Under review by the bank".

## 6. Agent design (25%): a hybrid by evidence, not by fashion
- **We first let Claude plan everything.** It skipped checks and took 45–60 s per click. Now **code runs the pipeline** and **Claude does the judgment**: next steps, email intent, how to word escalations. Measured live: **3.5–13 s per click, 0 fallbacks.**
- **Tools are scoped:** the planner sees judgment tools only; reads and writes go through the gate; every step is logged with its reason, tool, input, output, gate verdict and author (*pipeline / claude / planner / safety-net*).
- **It fails safe:** Bedrock errors or timeouts fall back to the scripted planner, and a code safety net always runs after Claude.
- **A judge, not a guess:** auto-accept only when the classifier (≥ 0.9) **and** the similarity check (≥ 0.8) agree.
- **Humans stay in the loop:** decision cards show only what differs. Analyst rulings become precedents, and after 3 similar rulings the system **proposes a learned check**. It is backtested, and a *different* person must approve it (maker-checker).
- **Chat with citations:** "Ask the case" answers clients and employees from role-scoped tools, citing ledger events `[#seq]` and documents. The client role cannot reach internal data.

## 7. Proof (20%): tested, calibrated, measured
- **201 backend tests,** offline. They cover the full demo, every rule path, tamper detection, role leaks, the reset race and the database round trip.
- **8 synthetic companies, each built to exercise one rule:** clean file, tax debt, suspended company, DSCR 1.06, signatory ≠ administrator, expired certificate, annual review, plus the demo bakery. A test checks that each ends on its intended outcome.
- **Judge calibration** on 150 labelled address/name pairs: the classifier alone auto-approved **7 wrong matches** (e.g. "Str. Gării" vs "Calea Gării" at p = 1.0); two-judge consensus gave **0**. Chart: `docs/pitch/calibration.png`.
- **Learned check backtest** on 48 cases with small-town counterexamples: the naive rule made 8 false approvals; the refined rule makes 0.
- **Live run** (Claude + Featherless): 3.5–13 s per click, 0 fallbacks, ledger verified.
- **Browser-tested** at 390 px (phone) to 2560 px, both apps, no console errors.

## 8. Architecture (15%): reproducible in one command
- **Stack:** FastAPI + a **SQLite event store** (one append-only table; in production, PostgreSQL **on the bank's own servers**) + React (bank app and client portal).
- **One command, no keys:** `pip install -r requirements.txt && uvicorn …`. Offline mode (scripted planner, heuristic judge) runs the whole demo for free.
- **Bring your own document AI:** extractors are adapters (built-in, or the bank's existing document AI). Whatever answers must return verbatim quotes, and code verifies them.
- **Privacy by construction:** client views are allow-lists; references in messages are relabelled in the reader's words; staff identities never reach the client.
- **Data:** all synthetic. Documents follow the real Romanian forms (ONRC certificat constatator, form 6A for beneficial owners, ANAF fiscal certificate, F20). Tax IDs sit in an unassigned range (research/09).

## 9. Domain (15%): Romanian rules, in code
| Rule | Source |
|---|---|
| **HR-01** | CUI checksum |
| **HR-02** | Company active in the trade register |
| **HR-03** | Certificate under 30 days old |
| **HR-04** | Owners ≥25% match the register (Law 129/2019; AMLR 14-day report) |
| **HR-05** | ID for each owner |
| **HR-06** | Same registered office |
| **HR-07** | DSCR ≥ 1.2 |
| **HR-08** | No tax debts (ANAF) |
| **SR-01** | Staff contact change followed by a credit action within 48 h without client confirmation |
| **SR-02** | Client disputes a staff change |

- **Two templates on the same engine:** *SME loan and KYB check* and *Annual business review* (AMLR periodic refresh). Only the template changes.

## 10. Business case (10%)
- **Volume:** Smart Business has **over 100,000** active SME clients (research/01). From July 2027 the AMLR makes periodic KYB refresh mandatory: every 1 or 5 years by risk (research/07).
- **Where the time goes:** chasing documents, re-checking expired certificates, reconciling owners and addresses. That is exactly the work the agent does between human decisions.
- **What changes:**
  - analysts only see files that need a decision: the work queue is sorted needs-you first;
  - the clean files complete without a human;
  - every action is auditable through the hash-chained ledger.
- **Path to production:**
  1. Shadow mode on annual KYB reviews.
  2. Then SME onboarding.
  3. Then the same engine for garnishments (2.25M ANAF enforcement acts in H1 2025), DORA incident clocks, and complaint deadlines (research/07).
- *Savings are estimates until a shadow-mode pilot measures them.*

## 11. Why it's new (originality)
- **Time is first-class:** the file is a ledger, and rules run over sequences, not single documents (SR-01).
- **An agent that cannot overstep:** a gate between plans and actions, and a credit decision that stays human by design.
- **It learns from people, safely:** rulings, then precedents, then backtested checks with maker-checker approval.
- **One ledger, two audiences:** the bank and the client see the same file, each in their own words.

## 12. Ask
- A 4-week shadow-mode pilot on annual business reviews with one back-office team.
- Plug into the bank's document AI and the ONRC/ANAF data feeds; run on-prem.
- Measure: hours per file, days to complete, re-requests, and audit findings.
