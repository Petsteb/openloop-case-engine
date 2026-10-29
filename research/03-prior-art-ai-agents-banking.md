# 03: Prior art in AI agents for banking operations (2024–2026)

Research date: 2026-10-28. Prepared for the NEXXT AI Hackathon 2026, "AI for Operational Efficiency" track (Raiffeisen Bank Romania).

## How to read this file

**Status labels**
- **DEPLOYED**: the system is in production according to the bank's own primary disclosure (press release, investor deck, annual report, newsroom) or to on-record statements by named bank executives to the press. JPMorgan is the case that relies on executive statements to CNBC. These are self-reported. None has been independently audited.
- **ANNOUNCED / PILOT**: the system is planned, in development, a pilot, or covered only by an MoU or partnership announcement.

**Source tags**
- **[2 sources]**: two independent sources agree.
- **[1 source]**: only one source was found.
- **[vendor claim]**: the figure comes from the company selling the product.
- **[snippet only]**: the page blocked fetching (HTTP 403), so the claim rests on the search-engine excerpt.
- **[conflicting]**: sources disagree.
- **Untagged figures:** any number without a tag counts as **[1 source]**, usually the bank's or vendor's own disclosure. This applies, for example, to:
  - HSBC's 85% access and 15% coding gain
  - DBS's 2,000+ models and 430+ use cases
  - RBI's 160+ use cases, 300+ daily users and about 2,500 ESG checks
  - Santander's 100k AML alerts and 10M calls / 100k hours
  - BT's 1.3M users
  - BBVA's 20k custom GPTs
  - Citi's 166–182k with access
  - Taktile's $54M Series B
  - Goldman's 6 months of embedded engineers

**Event name:** No public source uses the name "VibeHack" for this event. The official name is **NEXXT AI Hackathon 2026**, part of NEXXT AI Summit, 28–29 Oct 2026, FACE Bucharest, organised by UNCHAIN Media with Raiffeisen Bank Romania. Sources: https://www.revistabiz.ro/summit-la-bucuresti-pentru-dezvoltarea-solutiilor-ai-pentru-probleme-reale-de-business/.

---

## TL;DR

1. **The obvious ideas are taken.** Internal GPTs, policy Q&A bots, document OCR/extraction, KYC onboarding agents, AML alert triage with SAR drafting, sanctions false-positive reduction, and reconciliation-exception agents already ship from big banks and from funded vendors.
   - SmartStream made "Smart Agents" for reconciliation exceptions generally available in June 2026.
   - BNY runs about 140 "digital employees".
   - Santander has 280+ process-automation agents in production.
2. **Converting regulation to code exists as a category.** Norm Ai, ISDA Digital Regulatory Reporting, and AWS Automated Reasoning checks all do it. AWS builds a formal policy from an uploaded document and can generate test Q&A from it.
3. **Every vendor tells the same trust story:** explainable, audit trail, human-in-the-loop. Saying "our agent is explainable" will not stand out. Showing it with tests, replay, and evidence could.
4. **The regulatory situation helps a governance-first design.**
   - US SR 26-2 (April 2026) replaced SR 11-7 and explicitly excludes generative and agentic AI from scope.
   - EU AI Act high-risk obligations (including creditworthiness) were pushed back to 2 Dec 2027.
   - The EBA sees no need for new guidelines.
   - BaFin says there is "no AI bonus" under DORA.

   The result is a governance vacuum for agents, where risk teams still need evidence.
5. **Raiffeisen frames AI as preparing decisions, not taking them.** In Aug 2026, Raiffeisen Romania's CEO said AI "can prepare a decision, it should not have the last word".

---

## 1. Big-bank deployments in back-office and operations (2024–2026)

### 1a. DEPLOYED (bank's own disclosure)

| Bank | What / process | Reported results | Sources & tags |
|---|---|---|---|
| **BNY** | Eliza platform. "Digital employees" are agents with their own identity, access controls, and dedicated workflows. They work on payment validation, reconciliation, anomaly detection, and finding and fixing code vulnerabilities. Humans review their output. | About 140 digital employees and about 220 enterprise AI solutions in production. About 50% of staff are daily AI users. The count was ">100" in Oct 2025 and "134" in a CNBC-sourced report. | Q1 2026 deck: https://www.bny.com/assets/corporate/documents/pdf/investor-relations/earnings/quarterly-update-presentation-1q-2026.pdf ; Axios: https://www.axios.com/2025/10/17/ai-wall-street-digital-workers ; OpenAI case: https://openai.com/index/bny/ ; Forrester: https://www.forrester.com/blogs/bny-built-its-digital-workforce-backward-and-its-working/ ; Microsoft WorkLab: https://www.microsoft.com/en-us/worklab/the-making-of-a-frontier-firm-how-ai-is-redesigning-work-at-bny. Tags: [2 sources] for 100+ digital employees; [conflicting] on exact count (100 / 134 / 140, which reflects growth over time). Deck figures come from a search extract. |
| **JPMorgan Chase** | LLM Suite, an internal multi-model portal using OpenAI and Anthropic models, refreshed about every 8 weeks. Status rests on the CDAO's on-record statements and demo for CNBC. **The portal is deployed. Agents running back-office processes are a stated plan (see 1b), not a deployed fact.** | About 250k employees have access (CNBC, Sep 2025). Another report says 200k users within 8 months. Operations headcount is expected to fall at least 10% over 5 years. Dimon spoke of "huge redeployment" in Feb 2026. | CNBC: https://www.cnbc.com/2025/09/30/jpmorgan-chase-fully-ai-connected-megabank.html [snippet only] ; https://www.artificialintelligence-news.com/news/jpmorgan-chase-ai-strategy-2025/ ; https://connect.cefpro.com/article/view/inside-jpmorgan-llm-suite-as-ai-agents-spread-across-the-bank ; Dimon: https://www.cnbc.com/2026/02/24/jpm-ceo-jamie-dimon-ai-reshaping-workforce-redeployment.html. Tags: 200k vs 250k is [conflicting] (users vs access). The -10% ops figure is [1 source, secondary, attribution conflicting]. The "450+ use cases in production" figure is [secondary only]. |
| **JPMorgan COiN** (baseline, **2017, outside the 2024–26 window**) | ML extraction of about 150 attributes from commercial credit agreements. | 360,000 lawyer and loan-officer hours per year. Both reports trace back to Bloomberg. | https://www.abajournal.com/news/article/jpmorgan_chase_uses_tech_to_save_360000_hours_of_annual_work_by_lawyers_and ; https://www.globallegalpost.com/news/jpmorgan-deploys-software-to-reduce-legal-contract-work-41154328. Shows that contract extraction has been solved for about 9 years. |
| **Santander** | 280+ "process automation agents" in production across credit, fraud, KYC, and operations. Multi-provider (OpenAI, Anthropic, Google). At Openbank, AI processes about 100k AML alerts a year. | Speech analytics on 10M calls freed 100k+ hours (2024). The UK call-deflection figures are *targets*. | https://www.santander.com/en/stories/santander-turns-its-ai-first-strategy-into-measurable-impact-and-extends-ai-access-to-all-185000-employees ; https://www.beri.net/article/santander-ai-185000-employees-billion-roi-playbook. Tag: [2 sources] for 280 agents (the second is secondary). |
| **Commonwealth Bank (CBA)** | A Fraud Detection Agent scans payments data and generates code for new fraud rules. **The fraud analytics team reviews and approves each rule before it goes live.** Separately, Apate.ai "scam-baiting" bots keep scammers busy. | The agent helped update or create about three-quarters of card fraud rules (about 3,000 rules in total). Fraud losses fell more than 20% in H1 FY26 vs H1 FY25, attributed to fraud tech broadly. Apate bots: 350k+ conversations. | https://www.commbank.com.au/articles/newsroom/2026/04/ai-agent-spots-fraud-in-real-time.html ; https://www.cyberdaily.au/security/13511-cba-launches-new-scam-finding-ai-agent ; Apate: https://www.retailbankerinternational.com/news/commbank-apate-ai-scams-ai/. Tags: rules figure [2 sources]. The -20% figure is [1 source, bank]. 350k is [1 source, vendor LinkedIn]. An older "-50% scam losses" claim conflicts with these and is unverified. |
| **DBS** | 2,000+ models and 430+ AI use cases. The CSO Assistant (customer-service officers) handles transcription, summaries, and post-call notes. DBS Joy, an agentic assistant, went to 350k corporate clients on 28 Jul 2026. | About SGD 1bn of "economic value" from AI and data in 2025 (SGD 750m in 2024). CSO Assistant cut handling time by up to 20%. | https://www.dbs.com/annualreports/2025/ceo-reflections.html ; https://www.forrester.com/blogs/dbs-banks-billion-dollar-ai-dream-realized ; Joy: https://www.edb.gov.sg/en/news-and-insights/dbs-rolls-out-agentic-ai-350000-corporate-clients. Tags: SGD 1bn [2 sources, self-reported, covers all AI and analytics]. The -20% handling time is [1 source]. |
| **BBVA** | ChatGPT Enterprise rolled out bank-wide. 20k+ custom GPTs built. | About 3 h saved per employee per week (OpenAI). BBVA's own figure is 2.8 h. Weekly or daily active use above 80%. | https://openai.com/index/bbva-2025 ; https://www.bbva.com/en/innovation/bbva-expands-its-agreement-with-openai-to-11000-chatgpt-licences-for-the-banks-employees/ ; https://www.bloomberg.com/news/articles/2025-12-12/bbva-rolls-out-chatgpt-to-almost-all-employees-in-openai-deal. Tag: [2 sources, both self-reported]. |
| **Citi** | Citi Assist, a policies-and-procedures navigator. Citi Stylus Workspaces, built on Gemini and Claude. Rolled out to Romanian staff in Jul 2025. | About 166–182k colleagues have access. | https://www.citigroup.com/global/news/press-release/2025/citi-unveils-citi-stylus-workspaces-agentic-ai-turbocharging-productivity ; https://www.businessforum.ro/economy/20250730/citi-romania-rolls-out-genai-tools-for-local-employees-2121/amp. The *agentic* layer is a pilot (see 1b). |
| **HSBC** | 600+ AI use cases in fraud, cyber, transaction monitoring, customer service, and risk. An internal "AI decision assistant" cut admin and meeting-prep time from hours to minutes. | 85% of staff have GenAI access. Coding is 15% faster. | https://www.hsbc.com/who-we-are/hsbc-and-digital/hsbc-and-ai/transforming-hsbc-with-ai ; https://technode.global/2026/06/24/hsbc-google-cloud-sign-ai-partnership-eyeing-100m-return-per-use-case/. Tag: 600 vs "100+ GenAI use cases" is [conflicting]: the counts cover different scopes. |
| **Raiffeisen Bank International (RBI, parent of RBRO)** | "RBI GPT", an internal assistant on Azure OpenAI. Microsoft names "line leveling in reconciliation reporting" as one of its most common uses. AI Media Monitoring is used daily by 300+ staff. ESG Criticality Checks cover about 2,500 limit applications a year. "AI Hub" offers agentic pipelines. | 20,000+ RBI GPT users. 160+ AI use cases live. Stated rule: "every AI solution must be explainable, auditable, and compliant". | https://www.rbinternational.com/en/raiffeisen/career/topics/ai-at-rbi.html ; https://microsoft.com/en/customers/story/21406-raiffeisen-bank-international-azure (30 Jan 2025). Tag: 20k users [2 sources: RBI and Microsoft]. **This matters directly: the sponsor's group already has a reconciliation-reporting GenAI use case and an explainability mandate.** |

### 1b. ANNOUNCED / PILOT / IN DEVELOPMENT

| Bank | What | Status | Sources |
|---|---|---|---|
| **Goldman Sachs** | Claude-based agents for **trade and transaction accounting** and **client vetting and onboarding**. Anthropic engineers were embedded for 6 months. CIO Argenti: "early stages", launching "soon", job losses "premature". | In development (Feb 2026). No launch confirmed by Oct 2026 in our search. | https://www.cnbc.com/2026/02/06/anthropic-goldman-sachs-ai-model-accounting.html ; https://www.artificialintelligence-news.com/news/goldman-sachs-tests-autonomous-ai-agents-for-process-heavy-work/. The "Opus 4.6" model detail is [secondary only] and was dropped. |
| **Citi** | Agentic Stylus Workspaces. | Pilot with about 5,000 staff (Sep 2025). | https://theregister.com/2025/09/24/citi_pilots_agentic_ai ; https://www.bankingdive.com/news/citi-agentic-AI-tools-stylus-workspaces/760868/ |
| **JPMorgan** | Autonomous agents that run for hours. | Planned for 2026. | https://www.cnbc.com/2026/06/09/jpmorgan-chase-ai-agents.html |
| **HSBC × Google Cloud** | 200+ new use cases over 2 years. Agentic AI for financial crime across about 1bn transactions a month. Target: intervene 2× faster, with >$100m per initiative. | Announced Jun 2026. | https://www.hsbc.com/-/files/hsbc/media/media-release/2026/260616-hsbc-and-google-cloud-ai-strategic-partnership.pdf?download=1 ; https://technode.global/2026/06/24/hsbc-google-cloud-sign-ai-partnership-eyeing-100m-return-per-use-case/ |
| **ING** | Agentic AI for transaction monitoring, customer due diligence (CDD), and mortgages, described as "early production or in train". An executive estimated that 70–80 of the roughly 100 CDD questions could be answered from data already held. CDD would drop from days or weeks to seconds. | Early production / pilot. | https://www.computerweekly.com/news/366626743/ING-Bank-transforming-operations-through-agentic-AI [snippet only, 1 source] |
| **Morgan Stanley** | AskResearchGPT (Oct 2024, front office). Plans to open its wealth platforms to external AI agents. | Front office. Agent access announced Jun 2026. | https://www.morganstanley.com/press-releases/morgan-stanley-research-announces-askresearchgpt ; https://www.cnbc.com/2026/06/03/ai-agents-morgan-stanley-wealth-management-funnel.html |
| **UniCredit** | 10-year Google Cloud MoU (Vertex AI / Gemini) for "internal efficiency" and financial crime. | MoU only. No specific agentic back-office deployment found. | https://www.unicreditgroup.eu/en/press-media/press-releases/2025/may/unicredit-partners-with-google-cloud-to-accelerate-digital-trans.html |
| **Erste Group (BCR parent)** | Job ads mention ChatGPT Enterprise, the Microsoft Copilot ecosystem, and a team building RAG and agentic systems. | No primary disclosure of agents found. | https://www.karriere.at/jobs/7893061 [1 source, job ad] |
| **Kyndryl × Incore Bank (CH)** | Gemini-based agentic KYC with embedded human oversight. | PoC, Sep 2026. | https://fintech.global/2026/09/07/incore-bank-trials-gemini-powered-kyc-with-kyndryl/ |

### 1c. Romanian banks

- **Raiffeisen Bank România**
  - Uses AI to automate repetitive activities, speed up access to information, and support decisions.
  - Launched ERIC, an "AI Business Coach" for entrepreneurs.
  - CEO Zdenek Romanek (15 Aug 2026): GenAI helps with "internal knowledge assistance, document management, support for service teams". **"AI poate pregăti acea decizie. Nu ar trebui să aibă ultimul cuvânt."** ("AI can prepare that decision. It should not have the last word.") He also called for clear governance and explainable recommendations.
  - Sources: https://spotmedia.ro/stiri/economie/zdenek-romanek-ceo-raiffeisen-bank-ai-poate-pregati-o-decizie-bancara-dar-nu-ar-trebui-sa-aiba-ultimul-cuvant ; https://www.wall-street.ro/articol/banking/ai-in-bancile-romanesti-ce-fac-bt-bcr-cec-ing-si-raiffeisen.html (29 Sep 2026).
- **Banca Transilvania (BT)**
  - DAVID, an AI agent built by the Romanian vendor Druid, serves the **operations helpdesk**. It handles interest-rate calculations, report generation, client notifications, and verification checks. The case study has no date and no metrics: https://www.druidai.com/case-studies/banca-transilvania-banking-helpdesk-support-ai-agent
  - Microsoft 365 Copilot and GitHub Copilot since Mar 2024: https://news.microsoft.com/ro-ro/2024/03/14/banca-transilvania-integreaza-microsoft-365-copilot-si-github-copilot-asistenti-ai-pentru-accelerarea-de-noi-obiceiuri-in-munca-de-zi-cu-zi-a-angajatilor/
  - 1.3M people used BT Group's external AI channels in 2025: https://www.bancatransilvania.ro/news/en/milestones/peste-13-milioane-de-persoane-au-folosit-in-2025-solutiile-de-inteligenta-artificiala-ale-grupului-bt
  - First agent-initiated payment, with Visa, in Jul 2026 (pilot): https://startupcafe.ro/comert-agentic-in-timp-real-banca-transilvania-a-finalizat-cu-succes-prima-plata-initiata-prin-intermediul-unui-agent-ai-cu-visa-102744
- **BCR**
  - Its AI work extends an automation programme started 10+ years ago.
  - Humans keep decisions "where the decision touches someone's life".
  - No named agent found.
  - Source: https://www.wall-street.ro/articol/banking/ai-in-bancile-romanesti-ce-fac-bt-bcr-cec-ing-si-raiffeisen.html
- **ING Bank România**
  - AI and ML are used in internal processes and software development, rolled out gradually "based on results and data-protection and risk requirements". Same wall-street.ro source.
  - ING Romania teams won the "AI for Productivity" category at ING's CTO Global Hackathon 2026 (see §4).
- **CEC Bank**: "Decisions, responsibility and critical thinking remain essentially the domain of people." Same wall-street.ro source.
- **Regional context (Visa study, 325 decision makers):** In CEE, 54% of banks use AI in transactions and about 70% cite lower operating costs as a key driver. Same wall-street.ro source [1 source].

### 1d. What has become commoditised

These patterns recur at three or more banks or vendors:
- Internal chat/GPT portals (JPM, Citi, BBVA, RBI, BT).
- Policy and procedure Q&A with RAG (Citi Assist, RBI GPT, BT DAVID, Erste's RAG team).
- Document OCR plus field extraction. COiN has done it since 2017. Gartner's first IDP Magic Quadrant (Sep 2025) counts 100+ vendors and says breadth "hinders vendor differentiation": https://www.gartner.com/en/documents/6912666 ; https://www.abbyy.com/company/news/abbyy-leader-gartner-magic-quadrant-idp-2025/
- KYC onboarding (Santander, ING, Goldman, Parcha, Sardine).
- AML alert triage with SAR drafting (see §2).
- Reconciliation-break investigation (BNY, SmartStream, RBI).
- Fraud-rule generation (CBA).

---

## 2. Startups and vendors building agentic AI for bank operations and compliance

| Company | Wedge | Funding / status | Claimed results | What they say is hard | Sources |
|---|---|---|---|---|---|
| **Parcha** | KYC/KYB and onboarding compliance agents. "Agent Hub" (Jul 2025) ships 12+ preconfigured agents that compliance teams can configure and test themselves. | $5M seed (2023, Kindred and Initialized). | 10× faster onboarding, -75% cost, -90% false positives [vendor claim] | Deployment speed: weeks of integration vs minutes of agent configuration. | https://finovate.com/videos/finovatespring-2025-parcha/ ; https://claude.com/it/customers/parcha ; https://www.vcbacked.co/company/parcha-ai |
| **Norm Ai** | Turns regulations and corporate policies into code. "Compliance agents" check products, contracts, and marketing. | Seed $11.1M (Jan 2024). Series A $27M (Jul 2024; Citi Ventures, Blackstone, and others). $48M (Mar 2025, $87M total). About $120M in 2026 [conflicting on date and lead]. | — | Reportedly building "supervisory agents that monitor other AI agents" [1 source, blog]. | https://www.finextra.com/newsarticle/44388/us-regtech-norm-ai-raises-27-million ; https://norm.ai/post/norm-ai-raises-27-million-series-a ; https://siliconangle.com/2025/03/11/ai-agent-powered-compliance-automation-startup-norm-ai-raises-48m/ ; https://cryptobriefing.com/norm-ai-raises-120m-automate-legal-services/ ; https://ai2.work/blog/norm-ai-s-120m-round-turns-compliance-into-an-agent-workload |
| **Greenlite AI → Bretton AI** | AML/KYC investigation agents: alert triage, customer risk scoring, and investigation reports. | $15M Series A (May 2025, Greylock). Rebranded to Bretton AI, with a reported $75M Series B [1 source]. | One client cut alert handling by 90% [vendor claim] | **"Trust Infrastructure"**: US supervisory guidance (OCC 2011-12, NYDFS Part 504) built into each agent, plus support for model validation. "Explainable, regulator-aligned." | https://fintech.global/2025/05/22/regtech-innovator-greenlite-ai-secures-15m-to-scale-trusted-ai-compliance-agents/ ; https://www.americanbanker.com/news/greenlite-ai-raises-15m-for-financial-crime-ai-assistant ; https://www.bretton.com/blog/greenlite-ai-raises-15-million-series-a |
| **Hummingbird** | Financial-crime case management. AI agents draft SAR/STR narratives for 60+ FIUs. "Automations" is a no-code builder with a human in the loop. New Research and Review agents (Jun 2026) query internal data. | Established vendor. | — | Agents usually stop at external sources. Theirs query internal transaction history and prior cases. AI prepares the filing and a human approves it. | https://www.hummingbird.co/resources/meet-ai-agents-and-ai-assistant ; https://www.businesswire.com/news/home/20260609061381/en/Hummingbird-Expands-Orchestration-Platform-for-Financial-Crime-Compliance-With-New-AI-Agents-to-Streamline-Research-and-Casework |
| **Sardine** | Fraud and compliance. Agents for sanctions screening and for KYC onboarding edge cases. | $70M Series C (Feb 2025, Activant, $145M total). | KYC agent auto-resolves 88% [vendor claim, 1 source] | "All agent decisions are fully explainable, with clear audit trails." | https://www.fintechfutures.com/venture-capital-funding/fraud-prevention-platform-sardine-secures-70m-series-c-invests-in-agentic-ai ; https://sardine.ai/blog/series-c-announcement |
| **Lucinity** | "Luci" AML investigation agent (Azure OpenAI) for narratives and public-source searches. | Named in Gartner's 2025 AML Market Guide. | — | Investigator burnout, and following regulatory and enterprise report guidelines. | https://lucinity.com/blog/lucinity-recognized-in-2025-gartner-r-market-guide-for-anti-money-laundering |
| **WorkFusion (acquired by UiPath)** | Named "AI Digital Workers": Evelyn (sanctions and adverse media), Tara (transaction screening), Evan (AML transaction-monitoring investigations). | 60+ FS customers, including 3 of the top 5 US banks [CEO claim]. | Cuts sanctions false positives by >80% [vendor claim] | — | https://fintech.global/2025/06/18/automating-aml-compliance-meet-workfusions-evan/ ; https://diginomica.com/uipath-acquires-workfusion-and-takes-aim-financial-crime-compliance-detail-matters |
| **Taktile** | Decisioning platform combining "AI agents, rules, relevant context, and human oversight". Credit-underwriting agents handle document intake, financial spreading, and credit memos. | $54M Series B (2025, Balderton). $110M Series C (Jun 2026, Goldman Sachs Alternatives). | Banks process 5× more SMB loans with no extra headcount [vendor claim, 1 source] | The hybrid of deterministic rules, agents, and human oversight is the pitch itself. | https://www.fintechfutures.com/venture-capital-funding/taktile-110m-series-c-goldman-sachs ; https://thenextweb.com/news/taktile-110m-goldman-sachs-series-c |
| **Ocrolus** | Document automation for lending: bank statements, pay stubs, W-2s. Inspect QC added mortgage conditioning (Jul 2025). | Mature vendor. | — | — | https://www.ocrolus.com/mortgage-ai-for-lenders/ ; https://www.inman.com/tag/ocrolus/ |
| **SmartStream** | **"Smart Agents" for reconciliation exceptions.** They investigate, act, and close breaks (cash, settlement, post-trade) "under centralised governance and with a full audit trail". | Preview Dec 2025. **GA Jun 2026.** | Investigation time down 97%, from 14 min to 30 s per exception [vendor pilot claim] | Learning from exceptions, embedded controls. | https://financialit.net/news/artificial-intelligence/smartstream-introduces-agentic-ai-smart-agents-investigations-and ; https://smart.stream/wp-content/uploads/smartstream-resources/2026-06-12-ASTimes-issue-392-Smart-Agents.pdf |
| **Rexi** | AI-native payment reconciliation across Stripe, Adyen, and banks. | $1.2M pre-seed [conflicting date: Jul 2025 vs Mar 2026]. | — | — | https://www.startupresearcher.com/news/rexi-raises-1-2m-to-automate-financial-reconciliation-with-ai ; https://www.briter.co/companies/rexi |
| **CUBE** (acquired **Kodex AI** and Acin, 2025) | Regulatory change management. RegPlatform agents (Priorities, Analysis, and Enforcements Coworkers) score incoming regulatory changes for relevance. | Established. | — | Implementing a regulatory change takes **more than a year on average**, and 21% of firms rate their own approach as ineffective (CUBE Cost of Compliance 2025). | https://fintech.global/2026/09/02/cube-turns-regulatory-overload-into-an-ai-advantage/ ; https://www.wealthbriefing.com/html/printarticle.php?id=206127 ; https://www.processexcellencenetwork.com/change-management/news/automation-reshapes-regulatory-change-management-processes |
| **Corlytics** | Regulatory change: impact assessments, gap analyses, and "change packages" with an audit trail. Its IBM OpenPages integration maps extracted obligations to policies and controls. | Established. | — | — | https://www.corlytics.com/?p=14067 |
| **Inscribe** | Document-fraud detection (fraud side). | — | See §3 for statistics. | — | https://www.inscribe.ai/reports/2026-document-fraud-report |
| **Druid** (Romanian) | Conversational and agent platform. Built BT's DAVID operations-helpdesk agent. | — | — | — | https://www.druidai.com/case-studies/banca-transilvania-banking-helpdesk-support-ai-agent |

**Common thread in what vendors say is hard:** explainability, audit trails, human-in-the-loop approval, regulator alignment, and handling edge cases or exceptions. Greenlite, Sardine, Hummingbird, Taktile, and SmartStream all market it, so it no longer differentiates as a *claim*. What none of the vendor material we found offers is a **demonstrable** form of it: a test suite, a replay, or a per-run evidence pack a reviewer can check.

---

## 3. Failure modes, and what risk and compliance teams need before trusting an agent

### 3a. Evidence on failure and trust

- **Gartner (25 Jun 2025):**
  - More than 40% of agentic AI projects will be cancelled by the end of 2027, because of cost, unclear value, or **inadequate risk controls**.
  - "Agent washing" is widespread: only about 130 of thousands of "agentic" vendors are genuine.
  - Source: https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027 ; https://www.scmp.com/tech/tech-trends/article/3316025/over-40-agentic-ai-projects-forecast-be-scrapped-2027-due-lack-value [2 sources]
- **Vixio, "State of AI Trust in Regulatory Compliance 2026":**
  - Hallucination is the top worry, cited by **59%**.
  - Trust rests on four foundations: **verified data, direct sourcing, human review, audit trail**.
  - Source: https://fintech.global/?p=255019 [1 source]
  - A related stat says only 19% of regulated firms can prove how AI-assisted decisions were made. Its origin is unclear: https://securitybrief.asia/tag/explainable-ai?page=3 [1 source, origin unverified]
- **Wolters Kluwer Q1 2026 (148 institutions):**
  - 31.8% have AI/ML in production.
  - Only 12.2% have a well-defined, resourced strategy.
  - **Explainability and transparency is the second regulatory concern (28.4%)**, after bias.
  - Source: https://wolterskluwer.com/en/news/survey-indicates-financial-institutions-that-align-with-regulators-are-able-to-adopt-ai-successfully [1 source]
- **BoE/FCA survey (Nov 2024):**
  - 75% of firms use AI.
  - About 55% of use cases involve some automated decision-making, and 24% are semi-autonomous with human oversight for critical or ambiguous cases.
  - 46% of firms have only "partial understanding" of the AI they use.
  - Third-party concentration is rising.
  - Source: https://fintech.global/2024/11/29/bank-of-england-reports-major-ai-growth-in-financial-sector/ ; https://www.financialinstitutionsnews.com/2024/11/21/boe-and-fca-report-on-third-survey-of-ai-in-financial-services/amp/ [2 sources]
- **Romanian banks' public line:** humans make the final decision on anything that affects a person. This is the stated position of Raiffeisen, BCR, CEC, and BT (see §1c).
- **Prompt injection through documents**
  - Hidden white text in résumés manipulating AI screeners is well documented. CVE-2025-32711 (Microsoft 365 Copilot) and CVE-2025-53773 (GitHub Copilot) were indirect-injection flaws.
  - Sources: https://en.wikipedia.org/wiki/Prompt_injection ; https://promptfoo.dev/lm-security-db/vuln/resume-embedded-instruction-hijack-7a4768bd/
  - We found **no confirmed incident** of an invoice or bank document causing a financial action through injection. Such scenarios are described as plausible, not reported.
- **AI-generated document fraud**
  - Inscribe 2025: bank statements were **59%** of fraudulent documents detected, payslips 11.7%, utility bills 10.2%.
  - Inscribe 2026: **5×** increase in AI-generated fraud (Apr–Dec 2025). Editable bank-statement templates sell for under $10.
  - Sumsub measures something different: AI-assisted forgeries went from about 0% to about 2% of fake documents in 2025.
  - Sources: https://www.inscribe.ai/reports/2025-document-fraud-report ; https://www.inscribe.ai/reports/2026-document-fraud-report ; https://www.cbnews.fr/etudes/les-fraudes-ia-sont-hausse-sumsub. Tag: [vendor reports, different metrics]

### 3b. Regulatory landscape as of Oct 2026

- **US: SR 26-2 / OCC Bulletin 2026-13 (17 Apr 2026)** replaced SR 11-7 with a risk-based approach.
  - It **explicitly excludes generative and agentic AI** from scope.
  - The agencies plan an RFI on AI and model risk.
  - Examiners are still expected to apply risk-management principles.
  - Sources: https://www.orrick.com/en/Insights/2026/04/Agencies-Overhaul-Model-Risk-Management-Guidance-for-Banks-Heres-What-Changed ; https://www.pwc.com/us/en/industries/financial-services/library/our-take/model-risk-guidance-private-fund-reporting-apr-24-2026.html ; https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2026/model-risk-management-revised-interagency-guidance-reg-alert.pdf [2+ sources; agency primary text not opened]
- **US Treasury FS AI RMF (19 Feb 2026)**: voluntary, adapts NIST AI RMF, about 230 control objectives [1 source on the count].
  - Sources: https://www.independentbanker.org/w/treasury-releases-two-ai-resources ; https://babl.ai/u-s-treasury-unveils-ai-lexicon-and-risk-framework-to-guide-financial-sector-adoption/
- **EU AI Act**
  - Creditworthiness assessment of natural persons is an Annex III high-risk use.
  - The **Digital Omnibus on AI** moved Annex III high-risk obligations from 2 Aug 2026 to **2 Dec 2027**. It is a delay, not a rollback.
  - Sources: https://bratby.law/digital-omnibus-ai-high-risk-delay/ ; https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-high-risk-deadline-omnibus-20260/ ; https://secureprivacy.ai/blog/eu-ai-act-digital-omnibus-the-new-high-risk-ai-deadlines-after-council-approval
  - Tag: [law-firm and blog sources. The cited regulation number (EU) 2026/1744 and the 27 Jul 2026 entry into force were not checked against the Official Journal.]
  - *Inference (not a sourced legal opinion):* back-office reconciliation and triage are generally not Annex III uses. Validating credit applications from natural persons may be.
- **EBA (21 Nov 2025)** mapped the AI Act against CRR/CRD, DORA, and PSD2.
  - It found no significant contradictions and **no immediate need for new guidelines**.
  - DORA largely covers the AI Act's cybersecurity requirements.
  - Sources: https://www.eba.europa.eu/sites/default/files/2025-11/d8b999ce-a1d9-4964-9606-971bbc2aaf89/AI%20Act%20implications%20for%20the%20EU%20banking%20sector.pdf ; https://finreg.aoshearman.com/eba-letter-on-outcome-of-ebas-eu-ai-act-mapping-exercise-against-eu-banking-and-payments-regulation [2 sources]
- **BaFin (18 Dec 2025)** issued non-binding guidance on ICT risks of AI under DORA.
  - AI is ordinary ICT, with **"no AI bonus"**.
  - It flags prompt injection, data poisoning, and model inversion.
  - Testing LLMs is harder because third-party models are updated frequently.
  - The management body stays accountable.
  - Sources: https://www.jonesday.com/en/insights/2026/01/bafins-expectations-for-ict-risk-management-and-the-use-of-ai ; https://www.regulationtomorrow.com/2025/12/bafin-issues-guidance-on-ict-risks-associated-with-the-use-of-ai/ [2 sources]
- **FINOS AI Governance Framework v2.0 (Nov 2025)** adds an agentic risk catalogue:
  - Risks include agent action authorisation bypass, tool-chain manipulation and injection, and MCP server supply-chain compromise.
  - Mitigations include least-privilege agent authority and MCP server governance.
  - The total count is [conflicting]: 25 per Tetrate, 46 per FINOS.
  - Sources: https://www.finos.org/blog/finos-ai-governance-framework-v2.0-addressing-agentic-ai-risks-in-a-rapidly-evolving-landscape ; https://www.fsb.org/uploads/FINOS.pdf ; https://www.finos.org/press/tetrate-expands-finos-ai-governance-framework-to-cover-agentic-ai-risks-bolstering-enterprise-defenses-against-agent-hacking

**Conclusion:** No agent-specific rulebook exists for EU or US banks yet. Risk teams fall back on DORA ICT risk, general model-risk principles, and the four-eyes principle. An agent that **produces its own control evidence** fits that gap.

### 3c. Design patterns that address these needs, with real precedents

| Need | Pattern | Who already does it |
|---|---|---|
| Deterministic, repeatable decisions | The LLM only extracts and interprets. Decisions come from a deterministic rule engine or decision table, so the same input always gives the same result. | Taktile ("agents + rules + human oversight"). An "LLM compiles regulations into decision tables, runtime stays deterministic" pattern: https://itnext.io/compiled-ai-transforming-loan-regulations-into-decision-tables-4332f1dc8354. AWS Automated Reasoning checks: https://aws.amazon.com/blogs/aws/minimize-ai-hallucinations-and-deliver-up-to-99-verification-accuracy-with-automated-reasoning-checks-now-available/ |
| Cite the source clause | Every rule carries the source document and span ID. Every decision cites the rule and clause. | P2T DSL (provenance, citation, and span IDs per rule): https://arxiv.org/html/2512.04408v1. Vixio's "direct sourcing" requirement. |
| Confidence thresholds and exceptions | Auto-resolve above a threshold. Route edge cases to a human with a reason. | Sardine KYC agent (auto-resolution rate plus edge-case routing). SmartStream. |
| Four-eyes / maker-checker | The agent proposes and a separate checker (agent or human) approves. The producer never approves its own output. | CBA (analysts approve agent-written fraud rules). Hummingbird (human approves SAR). https://en.wikipedia.org/wiki/Maker-checker ; https://arxiv.org/pdf/2607.00038 (maker/checker split for agent loops) |
| Least privilege and agent identity | Each agent gets an identity, scoped tool permissions, and dedicated workflows. | BNY "digital employees" (identity and access controls). FINOS MI-18 least-privilege agent authority. |
| Audit trail | An immutable decision record per case: inputs, tool calls, rule version, outcome, approver. | SmartStream ("full audit trail"), Sardine, Corlytics change packages. |
| Testability | Generate benign and adversarial tests from the rulebook, and run consistency checks. | P2T (optional generation of benign and adversarial examples plus contradiction checks). AWS AR natural-language test Q&A generation (Nov 2025): https://aws.amazon.com/about-aws/whats-new/2025/11/automated-reasoning-checks-include-natural-language |
| Injection resistance | Treat document text as data, never as instructions. Use content filters. Red-team before go-live. | BaFin guidance. FINOS RI-25. AWS notes that AR checks do not stop prompt injection and must be combined with content filters. |

---

## 4. Past Romanian (and Raiffeisen-group) bank hackathons

### NEXXT AI Hackathon 2025 (2nd edition; UNCHAIN Media with Raiffeisen Bank România)

- **Entries:** 69 teams and 32 individuals registered. 13 teams were invited and 7 reached the final. Mentors came from Raiffeisen.
- **Results:**

| Place | Team | Project |
|---|---|---|
| **1st (€3,000)** | Sulfus | **SmartBranch**: AI predictions and virtual consulting to expand and optimise branch networks |
| **2nd (€1,000)** | Fynalyze | **Deepfake Detection**: detects synthetic images and audio during onboarding |
| Finalist | fotbaliștii123 | **Rafi**: financial recommendations plus fast credit approval without a branch visit |
| Finalist | Promptina | **FraudForecaster**: a suite of AI agents for fraud, phishing, and data leaks |
| Finalist | OnlyBugs | **ARCA**: agentic natural-language Q&A on ATMs (cash stock, forecasts, incidents) |
| Finalist | Skepya | **FinAi**: voice and text personalised assistant |
| Finalist | ATM | **ShyAI**: adaptive or masking AI interface |

- **Sources:** https://start-up.ro/castigatorii-nexxt-ai-hackathon-2025-hackathonul-despre-viitorul-inteligentei-artificiale-in-banking ; https://startupcafe.ro/solutii-castigatoare-hackathon-solutii-inteligenta-artificiala-89179 ; https://www.forbes.ro/peste-250-de-tineri-inovatori-au-participat-la-nexxt-ai-hackathon-2025-competitia-care-modeleaza-viitorul-inteligentei-artificiale-in-banking-473234 [3 sources]
- **What the jury rewarded (inference):** Both winners map directly onto jurors' portfolios. The branch network is an operations topic (COO). Onboarding fraud is a risk topic (CRO). Customer-facing assistants did not place. No published jury rationale was found.

### NEXXT AI Hackathon 2024 (1st edition)

Held 9–10 Nov 2024 at Politehnica Bucharest. Winners not found. Source: https://startupcafe.ro/inscrieri-eveniment-noi-tehnologii-transformare-sector-financiar-politehnica-29007

### NEXXT AI Hackathon 2026 (this event)

- **Tracks:** AI for Scaling and Growth, **AI for Operational Efficiency** ("smarter processes and less repetitive work"), and Embodied AI.
- **Format:** 24 h, €8,000 in prizes [LinkedIn post, 1 source].
- **Raiffeisen's stated framing:** "applied education", implementing AI responsibly, building governance, and delivering measurable results.
- **Sources:** https://www.revistabiz.ro/summit-la-bucuresti-pentru-dezvoltarea-solutiilor-ai-pentru-probleme-reale-de-business/

### ING CTO Global Hackathon 2026 (Feb 2026)

- 360 teams from 12 countries. Two Romanian teams won the **"AI for Productivity"** category.
- **SINtax** (ING Bank RO): an API tool for exploring a complex database with dynamic entity relationships.
- **Hackcelerators** (ING Hubs RO): **AI-native incident management**. It reads logs, finds the root cause, and generates a fix *with tests*, all under engineer supervision. Claimed to cut hours of work to minutes.
- Source: https://hotnews.ro/romania-de-doua-ori-castigatoare-la-cto-global-hackathon-2026-ing-hubs-si-ing-bank-romania-au-urcat-pe-podium-2190861 (sponsored article) [1 source]

### Other events

- **Veridion "Hacking Big Numbers" 2024:** Banca Transilvania set an **AML detection** challenge on real transaction data. Winner: team CUDA (€1,500). https://veridion.com/hackingbignumbers [1 source]
- **Hack the Future, Cluj (BT partner):** a cybersecurity theme. Winners: Black Ice, 3bytes, GhostSec. Year unclear. https://startupcafe.ro/trei-echipe-tineri-premiate-hackathon-cluj-napoca-sprijin-banca-transilvania-87402
- **Raiffeisen group, elsewhere:**
  - **Bosnia, May 2026:** AI Hackathon on UX, smart data analysis, and new digital functions. https://www.raiffeisenbank.ba/en/about-us/media/Novosti/ai-solutions-that-change-banking-the-winners-of-the-raiffeisen-ai-hackathon-are-known%20.html
  - **Upper Austria, May 2025:** 3.5-day AI challenge; the winning project was titled "KI Peer-Group". https://www.raiffeisen.at/ooe/rlb/de/meine-bank/hackathon/hackathon-2025.html ; https://www.raiffeisen.at/ooe/almtal/de/meine-bank/presse/pressearchiv-2025/gewinnerprojekt--ki-peer-group--sichert-tickets-.html (title only, not opened)
  - **Romania, Raiffeisen × UBB Think Tank Lab:** won by "Pay2Play", an AI expense-management and financial-advice app. https://www.revistabiz.ro/raiffeisen-bank-si-universitatea-babes-bolyai-anunta-castigatorii-programului-think-tank-lab/

**Ideas to avoid because they were recent finalists or winners in this ecosystem:**
- branch or ATM network analytics
- deepfake or KYC liveness detection
- multi-agent fraud or phishing suites
- customer chat or voice assistants
- credit pre-approval apps
- AML transaction detection
- expense/advice apps
- IT incident-management agents

---

## 5. Inventive angles: real examples found

| Angle | Real examples found | Assessment |
|---|---|---|
| **Agents that write their own test cases from a rulebook** | **P2T** ("Executable Governance for AI", arXiv 2512.04408, Dec 2025, open source): policy prose becomes JSON rules with provenance spans, plus optional benign and adversarial example generation and contradiction checks. https://arxiv.org/html/2512.04408v1. **AWS Automated Reasoning checks**: builds a formal policy from an uploaded document; GA Aug 2025; natural-language test Q&A generation added Nov 2025. https://aws.amazon.com/about-aws/whats-new/2025/08/automated-reasoning-checks-amazon-bedrock-guardrails ; https://aws.amazon.com/about-aws/whats-new/2025/11/automated-reasoning-checks-include-natural-language. ING Hackcelerators generated fixes with tests, but for IT incidents. | The capability exists in general form. **Not found:** a version applied to a *bank operating procedure* where the generated test suite is the acceptance gate for the ops agent. |
| **Regulation PDF → executable rules** | **Norm Ai** (commercial). **ISDA Digital Regulatory Reporting**: industry-agreed rule interpretations as executable code on the CDM; JSCC went live in Jul 2025; Gentek AI was picked in 2026 to build a traceability tool. https://isda.org/isda-digital-regulatory-reporting ; https://mondovisione.com/news/isda-selects-gentek-ai-to-develop-drr-traceability-tool-2026330/. **Compliance-to-Code** (arXiv 2505.19804) finds LLMs **still struggle significantly** with regulation-to-code: https://arxiv.org/abs/2505.19804v3. Cao & Feinstein on Basel III (arXiv 2405.06808): https://ideas.repec.org/p/arx/papers/2405.06808.html. Prose2Policy turns natural-language access policies into Rego (arXiv 2603.15799): https://arxiv.org/pdf/2603.15799. | **Taken as a category.** It only differentiates through scope (internal procedures, not regulation) and through verification (tests and human sign-off on the compiled rules). |
| **"Regulation diff" (what changed, which procedures break)** | **CUBE** RegPlatform agents score relevance of changes. **Corlytics**: impact assessments, gap analysis, and obligation-to-policy/control mapping through IBM OpenPages. Links in §2. | Change detection and mapping are **taken**. **Not found:** replaying cases through old vs new rules to show *which outcomes flip and why*. |
| **Red-team agents generating adversarial documents** | The fraud side is well documented (Inscribe stats, $10 statement templates). Prompt-injection CVEs exist. Generic LLM red-teaming tools exist, for example promptfoo's vulnerability DB (https://promptfoo.dev/lm-security-db/vuln/resume-embedded-instruction-hijack-7a4768bd/). | **Not found:** a bank-side tool that generates forged or injected *banking* documents to stress-test the bank's *own* operations agent and measure its exception catch-rate. |
| **Simulation of exceptions / synthetic data** | **IBM AMLSim** (Apache 2.0): https://github.com/IBM/AMLSim. **AMLworld** (IBM / ETH, arXiv 2306.16424): https://arxiv.org/pdf/2306.16424. **AMLGentex** (arXiv 2506.13989; input from Swedbank and Handelsbanken AML experts): https://arxiv.org/pdf/2506.13989v2 | These are for AML *transactions*. **Not found:** LLM-generated *operational* exceptions such as reconciliation breaks or application-document mismatches. This also fits the brief's "synthetic data only" rule. |
| **Voice-of-operator feedback loops** | **Evidence is thin.** Closest examples: CBA analysts review and approve agent-written fraud rules; SmartStream says its agents "learn from exceptions"; Hummingbird's human-in-loop automation recipes. | **Not found** for ops procedures: a loop where operator overrides become proposed rule amendments, go through four-eyes approval, and are regression-tested. |
| **Agents supervising agents** | Norm Ai is reportedly building "supervisory agents" [1 source, blog]. Open-source "MakerChecker" gateway: https://www.everydev.ai/tools/makerchecker | Emerging. Maker-checker between agents is a credible, demonstrable pattern. |

---

### Open questions / not researched
- Romanian-specific rule sources (BNR regulations, Law 129/2019 on AML, the RO e-Factura/SAF-T data formats) as local "domain understanding" material. Not covered here.
- Whether the 2026 NEXXT jury matches the 2025 one.
- Status of the Goldman agents after Feb 2026, and the full text of the ING Computer Weekly article (blocked).

---

## Already commoditised — avoid as the core idea

1. **Internal GPT/copilot portals** for summarising, drafting, and search. Examples: JPM LLM Suite, Citi Stylus, BBVA ChatGPT Enterprise, RBI GPT (20k users), BT M365 Copilot. https://www.cnbc.com/2025/09/30/jpmorgan-chase-fully-ai-connected-megabank.html ; https://openai.com/index/bbva-2025 ; https://microsoft.com/en/customers/story/21406-raiffeisen-bank-international-azure
2. **Policy/procedure Q&A with RAG.** Examples: Citi Assist, RBI GPT regulatory Q&A, BT's DAVID helpdesk agent, Erste's RAG team. https://www.citigroup.com/global/news/press-release/2025/citi-unveils-citi-stylus-workspaces-agentic-ai-turbocharging-productivity ; https://www.druidai.com/case-studies/banca-transilvania-banking-helpdesk-support-ai-agent
3. **Document OCR and field extraction (IDP)**: 100+ vendors in Gartner's first IDP Magic Quadrant, and JPM COiN since 2017. https://www.gartner.com/en/documents/6912666 ; https://www.abajournal.com/news/article/jpmorgan_chase_uses_tech_to_save_360000_hours_of_annual_work_by_lawyers_and
4. **KYC/KYB onboarding agents.** Examples: Parcha, Sardine, Santander, ING CDD, Goldman (in development), Kyndryl/Incore. https://finovate.com/videos/finovatespring-2025-parcha/ ; https://sardine.ai/blog/series-c-announcement ; https://www.cnbc.com/2026/02/06/anthropic-goldman-sachs-ai-model-accounting.html
5. **AML alert triage and SAR/STR narrative drafting.** Examples: Greenlite/Bretton, Hummingbird, Lucinity, WorkFusion Evan, Santander Openbank. https://fintech.global/2025/05/22/regtech-innovator-greenlite-ai-secures-15m-to-scale-trusted-ai-compliance-agents/ ; https://www.hummingbird.co/resources/meet-ai-agents-and-ai-assistant
6. **Sanctions and adverse-media false-positive reduction** (WorkFusion Evelyn). https://fintech.global/2025/06/18/automating-aml-compliance-meet-workfusions-evan/
7. **Reconciliation-break investigation agents.** SmartStream Smart Agents went GA in Jun 2026. BNY digital employees do reconciliation. RBI GPT does reconciliation reporting. https://smart.stream/wp-content/uploads/smartstream-resources/2026-06-12-ASTimes-issue-392-Smart-Agents.pdf ; https://www.axios.com/2025/10/17/ai-wall-street-digital-workers
8. **Credit underwriting agents** for document intake, spreading, and credit memos (Taktile). https://www.fintechfutures.com/venture-capital-funding/taktile-110m-series-c-goldman-sachs
9. **Fraud-rule generation and fraud-agent suites** (CBA). This was also a NEXXT 2025 finalist idea (FraudForecaster). https://www.commbank.com.au/articles/newsroom/2026/04/ai-agent-spots-fraud-in-real-time.html
10. **Deepfake and KYC liveness detection.** This took NEXXT 2025 2nd place. https://start-up.ro/castigatorii-nexxt-ai-hackathon-2025-hackathonul-despre-viitorul-inteligentei-artificiale-in-banking
11. **Customer-facing chat and voice assistants** (BT Chat BT, DBS digibot and Joy, several NEXXT 2025 finalists). https://www.edb.gov.sg/en/news-and-insights/dbs-rolls-out-agentic-ai-350000-corporate-clients
12. **Generic regulation-to-code** (Norm Ai, ISDA DRR, AWS Automated Reasoning). https://siliconangle.com/2025/03/11/ai-agent-powered-compliance-automation-startup-norm-ai-raises-48m/ ; https://isda.org/isda-digital-regulatory-reporting ; https://aws.amazon.com/about-aws/whats-new/2025/08/automated-reasoning-checks-amazon-bedrock-guardrails
13. **Regulatory horizon scanning and change-to-policy mapping** (CUBE / Kodex, Corlytics). https://fintech.global/2026/09/02/cube-turns-regulatory-overload-into-an-ai-advantage/
14. **IT incident-management agents.** ING Hackcelerators won the 2026 ING CTO hackathon with one. https://hotnews.ro/romania-de-doua-ori-castigatoare-la-cto-global-hackathon-2026-ing-hubs-si-ing-bank-romania-au-urcat-pe-podium-2190861

## Underserved gaps a hackathon team could credibly own

"Not found" means not found in our 2024–2026 search. It does not prove the idea is absent from the market. Each gap sits *between* existing products rather than inside one.

1. **Compile the bank's own operating procedure into a deterministic, tested runtime.**
   - **The idea:** The LLM works only at compile time and for extracting fields from documents. The procedure (for example, an internal SOP for validating a loan or account application) becomes a versioned rule set where every rule cites its clause. The agent generates its own benign and adversarial test suite from the procedure. A human signs off on the compiled rules before go-live. At runtime the engine is deterministic and replayable, and every decision cites its clause.
   - **Why it's open:** Generic tools exist (Norm, AWS AR, P2T) but target regulation or guardrails, not an ops procedure where the test suite is the acceptance gate.
   - **Evidence:**
     - LLMs still struggle with regulation-to-code (https://arxiv.org/abs/2505.19804v3), so compile-time human sign-off is justified.
     - Hallucination is the top worry at 59%, and direct sourcing plus audit trail are required (https://fintech.global/?p=255019).
     - P2T shows provenance spans are feasible (https://arxiv.org/html/2512.04408v1).
     - Raiffeisen's CEO: AI "prepares, not decides" (https://spotmedia.ro/stiri/economie/zdenek-romanek-ceo-raiffeisen-bank-ai-poate-pregati-o-decizie-bancara-dar-nu-ar-trebui-sa-aiba-ultimul-cuvant).
     - RBI: "explainable, auditable, and compliant" (https://www.rbinternational.com/en/raiffeisen/career/topics/ai-at-rbi.html).
2. **Rule-change impact replay ("procedure v2: what flips?").**
   - **The idea:** When a procedure or regulation changes, diff the compiled rule sets. Replay historical or synthetic cases through v1 and v2. List every case whose outcome changes, with the clause responsible, and route the list to four-eyes approval.
   - **Why it's open:** CUBE and Corlytics do relevance scoring and obligation mapping. We found no case replay.
   - **Evidence:** Implementing a regulatory change takes more than a year on average, and 21% of firms rate their own approach as ineffective (https://www.processexcellencenetwork.com/change-management/news/automation-reshapes-regulatory-change-management-processes ; https://fintech.global/2026/09/02/cube-turns-regulatory-overload-into-an-ai-advantage/).
3. **Agents that produce their own control evidence for the EU/US agent-governance vacuum.**
   - **The idea:** Each run emits an evidence pack: agent identity and permissions used, tool calls, rule version, confidence, maker and checker, and human approval. It is mapped to DORA ICT-risk and FINOS agentic-risk controls.
   - **Why it's open:** Vendors claim "audit trails" generically. We found none positioning the run's evidence pack as the product for a risk reviewer.
   - **Evidence:**
     - SR 26-2 excludes GenAI and agentic AI (https://www.orrick.com/en/Insights/2026/04/Agencies-Overhaul-Model-Risk-Management-Guidance-for-Banks-Heres-What-Changed).
     - AI Act high-risk obligations delayed to Dec 2027 (https://bratby.law/digital-omnibus-ai-high-risk-delay/).
     - EBA: no new guidelines (https://finreg.aoshearman.com/eba-letter-on-outcome-of-ebas-eu-ai-act-mapping-exercise-against-eu-banking-and-payments-regulation).
     - BaFin: "no AI bonus" (https://www.jonesday.com/en/insights/2026/01/bafins-expectations-for-ict-risk-management-and-the-use-of-ai).
     - FINOS agentic risks (https://www.finos.org/blog/finos-ai-governance-framework-v2.0-addressing-agentic-ai-risks-in-a-rapidly-evolving-landscape).
     - Only 19% of firms can prove how AI decisions were made [origin unverified] (https://securitybrief.asia/tag/explainable-ai?page=3).
4. **Red-teaming the bank's own operations agent with adversarial synthetic documents.**
   - **The idea:** A generator agent creates forged statements, mismatched IDs and dates, and documents with hidden-text injections. It scores the ops agent's exception catch-rate before go-live and after every rule change.
   - **Why it's open:** Fraud vendors *detect* forgeries. We found nothing that *stress-tests a bank's internal agent* with banking-specific adversarial suites.
   - **Evidence:**
     - Bank statements are 59% of fraudulent documents; AI-generated fraud rose 5× (https://www.inscribe.ai/reports/2025-document-fraud-report ; https://www.inscribe.ai/reports/2026-document-fraud-report).
     - BaFin flags prompt injection (https://www.regulationtomorrow.com/2025/12/bafin-issues-guidance-on-ict-risks-associated-with-the-use-of-ai/).
     - Document-borne injection is real (https://en.wikipedia.org/wiki/Prompt_injection).
5. **A generator for synthetic operational exceptions.**
   - **The idea:** Produce labelled reconciliation breaks and application mismatches from the rulebook. This works around the brief's "synthetic data only" constraint and gives the demo test fixtures.
   - **Why it's open:** AMLSim and AMLworld cover AML transactions only. We found no LLM-generated *ops* exceptions.
   - **Sources:** https://github.com/IBM/AMLSim ; https://arxiv.org/pdf/2306.16424
6. **Operator feedback turned into governed rule amendments.**
   - **The idea:** Operator overrides become proposed rule edits. They go through maker-checker approval and regression testing against the existing suite.
   - **Why it's open:** CBA proves the pattern for fraud rules (the agent proposes, analysts approve). We did not find it for ops procedures. The evidence here is thin.
   - **Source:** https://www.commbank.com.au/articles/newsroom/2026/04/ai-agent-spots-fraud-in-real-time.html

*Inference, not sourced:* gaps 1–5 combine into one demo. A procedure is compiled to rules, an adversarial and exception suite is generated, the agent processes cases, risky ones go to a checker, and a rule change is replayed. That fits the jury weighting: agent design and orchestration at 25%, testability at 20%, and architecture and reproducibility at 15%.
