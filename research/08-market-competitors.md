# 08 — Market competitors: is OpenLoop already on the market?

*Research date: 2026-10-28. This was a fast pass of about 30 tool calls before tomorrow's demo.*

**Tags used in this file:**
- **[vendor claim]**: the vendor's own marketing.
- **[1 source]**: only one source found.
- **(inference)**: my own reasoning.
- **"Not found"** means not found in public material in this pass. It does not mean the feature or deployment is absent.

**Caveats:**
- Several primary pages returned 403: the Pega Business Wire release, the RBI jobs page and the FICO mirror. Where that happened I cite trade-press re-posts or search-result listings.
- Startup rows reuse the sources already verified in `03-prior-art-ai-agents-banking.md`.

---

## (a) Comparison table

**Key:**
- ✓ = clearly does it
- partial = a weaker or adjacent version
- ✗ = evidence that it is absent (rarely used: missing from a press release is not evidence)
- unknown = no evidence either way

**OpenLoop's 8 features (the column numbers):**
1. **Ledger:** append-only, hash-chained event ledger; state is recomputed from events
2. **Hard rules:** hard rules in code, with rule IDs
3. **Time-aware rules:** document expiry that reopens the file, legal deadline clocks
4. **Fuzzy judge:** a calibrated fuzzy name-matching judge, gated behind the hard facts
5. **Agent:** an agent behind a state gate; credit approval is always denied
6. **Triage card:** a triage card for humans
7. **Learning:** analyst rulings become precedents, then checks
8. **Templates:** generic process templates

| Product | 1 Ledger | 2 Hard rules | 3 Time-aware | 4 Fuzzy judge | 5 Gated agent | 6 Triage card | 7 Learning | 8 Templates | Sources |
|---|---|---|---|---|---|---|---|---|---|
| **Pega CLM / Case Mgmt (agentic, Dec 2025)** | partial: case audit history; tamper evidence unknown (inference) | ✓ (inference: rules-engine platform; CLM covers "regulatory requirements") | partial: periodic and event-driven reviews, perpetual-KYC triggers [vendor claim]; SLA clocks (inference) | partial: "agentic screening" and "real-time entity verification" (Moody's partnership) [vendor claim] | partial: agents inside case flows; an "Agentic AI Coach" picks the fastest path and reduces document requests [vendor claim] | partial (inference) | unknown | ✓ (generic case-management platform) | [destinationCRM](https://www.destinationcrm.com/Articles/CRM-News/CRM-Across-the-Wire/Pega-Launches-Agentic-Compliance-Solution-with-Enhanced-Pega-CLM-172866.aspx); [Pega CLM brochure Nov-25](https://www.pega.com/system/files/resources/pdf/pega-client-lifecycle-management-nov25.pdf); [Pega+Moody's](https://www.businesswire.com/news/home/20251202755165/en/Pega-and-Moodys-Collaborate-to-Streamline-Customer-Lifecycle-Management-and-KYC-Processes-for-Financial-Services); [Pega Academy](https://academy.pega.com/node/95516) |
| **Fenergo CLM + Fen-AI / KYRA agents (Jul 2026)** | partial: "governed, immutable evidence trail" [vendor claim] | partial (inference: policy-driven KYC) | partial: periodic review, refresh, perpetual KYC with Moody's [vendor claim]; SLA timers not mentioned | partial: screening agent; Moody's entity verification (600M companies) | partial: actions stay inside a "governed control boundary"; 6 automation agents; A2A framework [vendor claim] | partial: "humans stay focused on judgement, exceptions and oversight" [vendor claim] | unknown (not mentioned) | partial: whole CLM lifecycle from onboarding to offboarding, but KYC/CLM only | [Fenergo release](https://www.fenergo.com/newsroom/fenergo-launches-fen-ai-governed-ai-for-the-regulated-client-lifecycle); [FinTech Global](https://fintech.global/2026/07/29/fenergo-bets-on-governed-ai-to-fix-compliance-at-scale/); [KYC agents page](https://www.fenergo.com/lp/know-your-customer); [Fenergo+Moody's pKYC](https://www.fenergo.com/newsroom/fenergo-and-moodys-partner-to-accelerate-perpetual-kyc) |
| **Appian (Case Mgmt Studio, Agent Studio GA Nov 2025, Connected KYC)** | partial: process audit (inference) | ✓ (inference: decision rules native to BPM) | unknown | unknown | partial: "agents embedded into process … governance and auditability" [vendor claim] | partial: AI summarises and searches cases [vendor claim] | unknown | ✓ | [Appian Nov 2025](https://www.aap.com.au/aapreleases/cision20251112ae21992); [Appian Apr 2025](https://www.aap.com.au/aapreleases/cision20250429ae74440); [Case Mgmt Studio](https://kyodonewsprwire.jp/release/202403067586); [Docs 26.6 (Connected KYC)](https://docs.appian.com/suite/help/26.6/) |
| **UiPath Maestro Case (Jun 2026) + WorkFusion agents** | unknown | partial: BPMN templates | unknown | partial: WorkFusion sanctions and adverse-media agents | partial: "governed orchestration" of agents, robots and people [vendor claim] | partial: exception-heavy cases go to humans [vendor claim] | unknown | ✓: Claims, Loans, Disputes, Investigations; AML/KYC/onboarding cases; 30 BPMN templates | [Business Wire Jun 2026](https://www.businesswire.com/news/home/20260616259667/en/); [Maestro Case page](https://www.uipath.com/product/maestro/case-management); [IT Brief](https://itbrief.co.uk/story/uipath-launches-maestro-case-for-complex-workflows); [Diginomica (WorkFusion)](https://diginomica.com/uipath-acquires-workfusion-and-takes-aim-financial-crime-compliance-detail-matters) |
| **ServiceNow Financial Services Operations** | partial: one case record tracks documents, decisions and communications [1 source] | unknown | partial (inference: the platform has SLA engines; no FSO source fetched) | unknown | partial: "pre-configured agents" for retail and commercial banking [vendor claim] | unknown | unknown | ✓ (case platform) | [FSO banking](https://www.servicenow.com/products/financial-services-operations/banking.html); [FSO community: onboarding/KYC](https://www.servicenow.com/community/fso-articles/unlocking-efficiency-transform-onboarding-and-kyc-in-banking/tac-p/3502696) |
| **Salesforce FSC + Agentforce for FS** | unknown | partial: compares uploaded documents against KYC/KYB data | unknown | partial: document-vs-data comparison | partial: agent Topics and Actions; "controls for approvals, disclosures, audit trails" [secondary] | unknown | unknown | partial: onboarding sample app | [Commercial banking page](https://www.salesforce.com/financial-services/banking-software/commercial?d=pb); [Trailhead onboarding](https://trailhead.salesforce.com/es-MX/content/learn/modules/customer-onboarding-in-financial-services-cloud/get-started-with-customer-onboarding); [KMWorld](https://www.kmworld.com/Articles/News/News/Salesforces-Agentforce-for-Financial-Services-can-automate-front-office-tasks-and-reduce-administrative-overhead-without-coding-169629.aspx) |
| **nCino (Agentic OS, Banking Advisor, Analyst Digital Partner)** | unknown | partial (inference: loan-origination checklists; not verified in this pass) | unknown (covenant tracking not verified) | unknown | partial: Agentic OS "deploys and monitors agents"; "auditable, explainable" [vendor claim] | unknown | unknown | partial: lending-centric | [FinTech Global Apr 2026](https://fintech.global/2026/04/16/ncino-unveils-ai-credit-analyst-agent-to-transform-commercial-lending/); [ConnectOne Jul 2026](https://www.ncino.com/news/connectone-bank-commercial-lending-ncino-agentic-operating-system) |
| **Temenos (TCF 2026 agents)** | unknown | unknown | unknown | partial: financial-crime AI (fewer false positives) | partial: agents across core, digital and financial-crime products [vendor claim] | unknown | unknown | partial: composable lending | [IBSi](https://ibsintelligence.com/ibsi-news/temenos-launches-embedded-ai-capabilities-for-banking/); [FinTech Futures](https://www.fintechfutures.com/core-banking-technology/temenos-outlines-embedded-ai-and-progressive-modernisation-focus-at-tcf-2026) |
| **Moody's (KYC/Maxsight, Agentic Solutions, Automated Covenants)** | unknown | unknown | partial: trigger-based perpetual KYC; automated covenant monitoring [vendor claim] | partial: entity verification and ownership data | partial: agents for KYC screening and credit; offered in Claude via MCP [vendor claim] | unknown | unknown | ✗ (data and agents, not a case engine) | [Moody's agentic blog](https://www.moodys.com/web/en/us/creditview/blog/agentic-solutions-announcement.html); [Q1-26 remarks](https://s203.q4cdn.com/694693571/files/doc_financials/2026/q1/1Q26-Prepared-Remarks-vFinal.pdf); [pKYC](https://ibsintelligence.com/ibsi_prime_news/perpetual-kyc-is-the-future-of-compliance-according-to-moodys); [Automated Covenants](https://www.moodys.com/web/en/us/campaigns/automated-covenants.html) |
| **Encompass (EC360, MCP server 2026)** | partial: "audit trails" [1 source] | unknown | partial: real-time screening (pKYC positioning) | partial: corporate digital identity and UBO data | partial: feeds AI agents via MCP | unknown | unknown | ✗ | [Encompass MCP one-pager](https://www.encompasscorporation.com/wp-content/uploads/2026/05/MCP-1pager.pdf) |
| **Taktile** (decisioning; $110M Series C, Jun 2026) | unknown | ✓: "AI agents, rules, relevant context, and human oversight" [vendor claim] | unknown | unknown | ✓ (closest to our gate pitch) [vendor claim] | partial | unknown | partial: credit and KYB flows | [FinTech Futures](https://www.fintechfutures.com/venture-capital-funding/taktile-110m-series-c-goldman-sachs); [Taktile KYB](https://taktile.com/articles/ai-for-kyb-complexity) |
| **Parcha** (KYB agents, Agent Hub) | unknown | partial: 12+ configurable agents | unknown | partial | partial | unknown | unknown | ✗ (KYB only) | [Finovate](https://finovate.com/videos/finovatespring-2025-parcha/) |
| **Arva AI** (YC, KYB agents) | unknown | partial | unknown | partial | partial: automates low and medium-risk KYB reviews [vendor claim] | unknown | unknown | ✗ | [YC](https://ycombinator.com/companies/arva-ai) |
| **Sardine** (fraud + KYC agents) | partial: "clear audit trails" [vendor claim] | unknown | unknown | partial: KYC agent auto-resolves 88% [vendor claim, 1 source] | partial | unknown | unknown | ✗ | [FinTech Futures](https://www.fintechfutures.com/venture-capital-funding/fraud-prevention-platform-sardine-secures-70m-series-c-invests-in-agentic-ai) |
| **Hummingbird / Bretton AI / Lucinity** (AML investigation agents) | unknown | unknown | unknown | unknown | partial: the AI prepares, a human approves [vendor claim] | partial: investigator workspace | unknown | ✗ (financial crime only) | [Hummingbird](https://www.businesswire.com/news/home/20260609061381/en/Hummingbird-Expands-Orchestration-Platform-for-Financial-Crime-Compliance-With-New-AI-Agents-to-Streamline-Research-and-Casework); [Bretton](https://www.bretton.com/blog/greenlite-ai-raises-15-million-series-a); [Lucinity](https://lucinity.com/blog/lucinity-recognized-in-2025-gartner-r-market-guide-for-anti-money-laundering) |
| **Norm Ai** (regulations into code, compliance agents) | unknown | partial: policy-as-code | unknown | unknown | partial | unknown | partial (inference: policy becomes reusable checks) | ✗ | [SiliconANGLE](https://siliconangle.com/2025/03/11/ai-agent-powered-compliance-automation-startup-norm-ai-raises-48m/) |
| **SmartStream Smart Agents** (reconciliation exceptions, GA Jun 2026) | partial: "full audit trail" [vendor claim] | unknown | unknown | unknown | partial: "centralised governance" [vendor claim] | partial | partial: "learning from exceptions" [vendor claim, 1 source] | ✗ (reconciliation) | [Financial IT](https://financialit.net/news/artificial-intelligence/smartstream-introduces-agentic-ai-smart-agents-investigations-and) |
| **Ocrolus** (lending document AI) | unknown | partial: document checks; mortgage conditioning QC | unknown | unknown | unknown | unknown | unknown | ✗ | [Ocrolus](https://www.ocrolus.com/mortgage-ai-for-lenders/) |
| **Automation Anywhere** (onboarding agent) | unknown | unknown | unknown | unknown | partial: "AI agent solution for customer onboarding" (title only) [1 source] | unknown | unknown | unknown | [AA PDF](https://www.automationanywhere.com/sites/default/files/internal-assets/ai-agent-solution-for-customer-onboarding_en.pdf) |

**Not covered in this pass (no cells filled):**
- IBM
- Pega GenAI Blueprint (specifics)
- Finastra, Abrigo, Baker Hill and Moody's CreditLens
- Instabase, Hyperscience and Eigen
- ComplyAdvantage, Quantexa and Napier

Baker Hill and Moody's are noted as covenant vendors in file 05 ([Moody's Automated Covenants](https://www.moodys.com/web/en/us/campaigns/automated-covenants.html)). Quantexa appears as an AML case-management vendor in file 06.

---

## (b) Already commoditised in the market

Most of the feature list on its own is already sold by someone:

- **Case lifecycle with templates:** Pega, Appian, ServiceNow and UiPath Maestro Case all sell long-running, exception-heavy cases as a generic engine. UiPath ships Claims, Loans, Disputes and Investigations templates and names "AML, KYC, and customer onboarding cases at banking scale" ([UiPath](https://www.uipath.com/product/maestro/case-management)). **Feature 8 is table stakes.**
- **AI agents inside a governed workflow:** in 12 months every incumbent shipped one:
  - Pega agentic CLM (Dec 2025)
  - Appian Agent Studio (GA Nov 2025)
  - UiPath Maestro Case (Jun 2026)
  - Fenergo Fen-AI/KYRA (Jul 2026)
  - nCino Agentic OS
  - Temenos (TCF 2026)
  - Salesforce Agentforce for FS
  - ServiceNow FSO agents

  All of them use the words "governed", "auditable" and "explainable" (sources in the table). **An "agent with guardrails" is not a differentiator by itself.**
- **Rules + AI + human oversight hybrid:** this is literally Taktile's pitch ([FinTech Futures](https://www.fintechfutures.com/venture-capital-funding/taktile-110m-series-c-goldman-sachs)) and Arya.ai's KYB framing ([Arya.ai](https://arya.ai/blog/ai-agents-corporate-kyb-onboarding)).
- **KYB data, screening, entity and UBO verification, pKYC triggers:** these are commodity data products, sold by Moody's, Encompass, Fenergo+Moody's and Pega+Moody's. Do not demo the registry lookup as innovation.
- **Immutable audit trail:** Fenergo, Sardine and SmartStream all claim one [vendor claim]. Calling it "tamper-evident" will not impress a jury unless you show verification live.
- **Document processing and checklists, DSCR, covenant tracking:** this is standard loan-origination and document-AI territory (nCino, Ocrolus, Moody's Automated Covenants, Baker Hill per file 05).
- **Human exception queues:** every product above has one.

**Blunt summary:** A jury member who knows Pega, Appian or Fenergo will see features 1, 2, 5, 6 and 8 as "we already have this in our BPM" (inference).

---

## (c) Where OpenLoop is genuinely different (if anywhere)

**No single feature is new.** What follows was **not found in public vendor material** in this pass. That is not proof of absence, and any incumbent could add these as a feature, so none of them is a moat.

1. **Rulings become checks (feature 7).**
   - I found no vendor describing this loop: analyst override → reusable precedent → candidate check → backtest on history → promotion by a second person.
   - The closest are SmartStream's "learning from exceptions" [vendor claim, 1 source] and generic "agents learn from each verified decision" blog copy ([Beam AI](https://beam.ai/agentic-insights/ai-agents-banking-2026-beyond-chatbots)).
   - **This is the strongest angle. Only precedent reuse is built today; the rest is planned.** Say so on stage.
2. **Regulation-specific time semantics as first-class objects.**
   - Vendors talk about "periodic and event-driven reviews" and pKYC triggers.
   - I found no vendor modelling the **AMLR 14-day UBO-discrepancy clock** (applies Jul 2027, see file 05 / [Art. 24](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-24/)), or document expiry that **automatically reopens** a case, as explicit rule-ID'd timers.
3. **Mechanism, not marketing, for governance.**
   - Incumbents say "immutable" and "governed boundary" [vendor claim] without publishing how.
   - OpenLoop can **show** three things live (inference: a demo-able difference):
     - the hash chain verifying;
     - state replayed from events ("what did we know on day X");
     - the gate refusing a credit-approval action, with the refusal logged.
4. **Order of authority:** the fuzzy match can only auto-accept after the hard facts match. This is a concrete, testable policy, compared with the vague "human-in-the-loop" elsewhere (inference).
5. **The local wedge (sourced, plus inference).**
   - RBRO's digital SME onboarding launched for **single-shareholder SMEs** first ([ALTEN](https://altenromania.ro/?p=2110); [Revista Biz](https://www.revistabiz.ro/raiffeisen-bank-continua-investitiile-in-digitalizare-imm-urile-din-romania-pot-deschide-conturi-bancare-100-online/)).
   - Multi-owner KYB plus loan files with expiring documents are plausibly still the slow, manual, long-running ones (inference). That is exactly OpenLoop's case type.

**The angle that can stand out:** do not pitch "a case platform with AI agents." Pitch **a thin, verifiable control-and-learning layer** that sits on the bank's existing BPM (Appian at RBI) and makes three things provable:
- what the agent may do;
- when the law's clocks run;
- how analyst judgment turns into tested rules.

---

## (d) What Raiffeisen / RBI already uses

**Raiffeisen Bank Romania (RBRO):**
- **FICO Origination Manager** for all new retail account opening across digital and branch channels. This was announced **May 2018**, is retail rather than SME, and may be stale ([FICO](https://investors.fico.com/news-releases/news-release-details/raiffeisen-bank-will-accelerate-digital-transformation-fico); [Retail Banker Intl](https://www.retailbankerinternational.com/news/raiffeisen-bank-chooses-fico-customer-onboarding-solution/)).
- **100% digital SME onboarding:**
  - Co-built with **ALTEN Romania**.
  - Under 30 minutes.
  - Launched late 2024 for single-shareholder SMEs, then opened up in Feb 2025.
  - Sources: [ALTEN](https://altenromania.ro/?p=2110) and [Revista Biz](https://www.revistabiz.ro/raiffeisen-bank-continua-investitiile-in-digitalizare-imm-urile-din-romania-pot-deschide-conturi-bancare-100-online/).
  - In H1 2026, new customers onboarded through the digital channel doubled year on year ([RBRO H1-2026 results](https://bvb.ro/infocont/infocont26/RBRO27A_20260730173229_RBRO-Financial-Results-2026-Q2-ENG.pdf)) [1 source, via search summary].
- **Confidas** (Romanian company-check platform) for SME clients. This overlaps our registry and tax-ID rules ([Wall-Street.ro](https://www.wall-street.ro/articol/Finante-Banci/257199/parteneriat-intre-startup-ul-romanesc-confidas-si-raiffeisen-bank-romania.html)).
- **Keez** online accounting for SMEs ([Revista Biz](https://www.revistabiz.ro/raiffeisen-bank-parteneriat-cu-fintech-ul-keez/)).

**RBI group (Vienna):**
- **Appian** is in RBI's listed tool stack, alongside RBI GPT, M365 Copilot, Claude Code, Databricks and others ([AI at RBI](https://www.rbinternational.com/en/raiffeisen/career/topics/ai-at-rbi.html); file 02).
- RBI is hiring Appian developers to build **"customer lifecycle management solutions"** [1 source: job listing via search snippet; the RBI page returned 403] ([devjobs.at](https://en.devjobs.at/job/057b2a7fd762540dc4f270e748a8afc7); [RBI jobs](https://jobs.rbinternational.com/job-offer.html?yid=9967)).
  - (inference) RBI's CLM and KYC workflow is likely being built in-house on Appian, not bought from Fenergo or Pega.
- **ASEE Digital Origination** for SME lending, described as "in production across six markets" of the group. The fetched page did not name the markets, so **whether Romania is one of them is unknown** ([ASEE case study](https://digitalbanking.asee.io/case-study/); [ASEE blog](https://digitalbanking.asee.io/?p=8192)).
- **Risk Assistant:**
  - Drafts credit-rating reports.
  - Has been extended to document verification, fraud detection and KYC.
  - RBI's ESG check is described "with a full audit trail."
  - Sources: [IMD](https://www.imd.org/ibyimd/artificial-intelligence/de-risking-risk-management-with-ai-how-rbi-built-for-quality-and-speed/) and [AI at RBI](https://www.rbinternational.com/en/raiffeisen/career/topics/ai-at-rbi.html).
- **Not found:** no public evidence of **Pega, Fenergo, nCino, UiPath or Salesforce** at RBI or RBRO. This is "not found", not "not used." File 01 also found no UiPath at RBRO.

**Other Raiffeisen-branded banks (NOT RBI group; do not cite them as RBI):**
- Raiffeisen Switzerland uses Avaloq and Backbase ([Retail Banker Intl](https://www.retailbankerinternational.com/features/avaloq-raiffeisen-partnership/); [Backbase](https://www.backbase.com/blog/business/how-raiffeisen-built-a-digital-factory-for-banking-innovation)).
- A Luxembourg Raiffeisen bank and nCino surfaced in search, but no primary URL was captured. Treat it as unverified.

---

## (e) How to position this to a bank jury without overclaiming

- **Say:** "OpenLoop is a control-and-learning layer for long-running files. It can sit next to the Appian and origination stack you already run. We are not replacing a CLM."
- **Don't say "first" or "nobody does this."** Say: "Vendors announce governed agents. We show the governance working: verify the chain, replay the case, watch the gate refuse credit approval."
- **Lead with the AMLR 14-day clock and documents that expire and reopen the file**, on a multi-owner SME (the case your digital flow did not start with). Then show one analyst ruling being reused on the next case.
- **Present "credit approval always denied" as a design choice.**
  - Do not present it as an AI Act requirement.
  - Annex III 5(b) covers credit scoring of *natural persons* and applies from 2 Dec 2027 (file 02).
  - SME credit may fall outside it (inference).
- **Be explicit about what is built and what is roadmap.**
  - Built today: precedent reuse.
  - Roadmap: backtesting and four-eyes promotion of checks.
  - Quote vendor numbers only as [vendor claim].
