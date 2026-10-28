# 09: Problem validation and existing bank deployments

Research date: 2026-10-28. Written under time pressure (~30 tool calls), the evening before the demo.

**Tags:** "[1 source]" means one source only; "[vendor claim]" means the figure comes from someone selling a product; "(inference)" is my own reasoning, not a sourced fact. "[from 0X]" means the item and its sources are already in an earlier file in this folder, so I'm not repeating the full source list. Items without a tag have at least two sources, or one primary source from a regulator or court.

**What's new here vs files 01–07:** files 01 and 02 already list the Raiffeisen Romania fines and the RBI FMA fines, and 03 already lists bank AI deployments. This file puts those items next to new enforcement cases (FCA, BaFin, FinCEN, Dutch prosecutors, AFM, EBA) and maps each one to an OpenLoop feature.

---

## Q1. Do these problems really happen?

### (a) Stale or expired KYC files and refresh backlogs

| Case | What the regulator found | Why it matters for OpenLoop | Source |
|---|---|---|---|
| **RBI (sponsor's parent), FMA Austria, 30 Mar 2018: €2.748m** | Inadequate checks on beneficial owners, and a **failure to regularly update the documents** needed to understand the ownership and control structures of **high-risk customers**. | This is the "document expires, the file reopens" scenario, and it happened at the sponsor's own group. | https://www.kyivpost.com/business/raiffeisen-slapped-2-7-million-euro-fine-lack-money-laundering-controls.html ; https://www.leadersnet.at/news/38506,raiffeisenbank-international-droht-rekordstrafe.html [from 02] |
| **Commerzbank London, FCA, 17 Jun 2020: £37,805,400** (it would have been £54m without the settlement discount) | **1,772 clients were overdue for updated due diligence** on 1 Mar 2017. A "material number" of overdue clients **kept transacting through an exceptions process** that was "not adequately controlled or overseen". By the end of 2016 that process had become "out of control". Breach period: Oct 2012 to Sep 2017. | Shows a refresh backlog together with activity allowed while the KYC file was stale. That is both a stale-file problem and a sequence problem. | FCA press release: https://www.fca.org.uk/news/press-releases/fca-fines-commerzbank-london-37805400-over-anti-money-laundering-failures . **[conflicting]** law-firm summaries give 2,226 overdue by Feb 2017 (e.g. https://www.penningtonslaw.com/insights/commerzbank-fined-for-anti-money-laundering-failures/). Use the FCA's 1,772. |
| **ING NL, Dutch Public Prosecution Service, 4 Sep 2018: €775m** (fine of €675m plus €100m disgorgement) | Structural breach of the Dutch AML law, 2010–2016. The findings include **missing or incomplete due-diligence files, wrong risk classifications and no periodic review process**. | Missing or outdated customer files at scale. | https://www.prosecutionservice.nl/latest/news/2018/09/04/ing-pays-775-million-due-to-serious-shortcomings-in-money-laundering-prevention ; https://www.dutchnews.nl/news/2018/09/ing-lax-on-money-laundering-agrees-e775m-out-of-court-settlement/ (file-level detail [1 source]) |
| **EBA EuReCA (EU AML weakness database)** | June 2023: **more than half of submissions relate to CDD deficiencies**, "particularly weak ongoing monitoring of business relationships". Early 2024: material weaknesses "mainly concern deficiencies in CDD measures". | At EU level, ongoing CDD (keeping files current) is the most common AML weakness supervisors report. | https://www.eba.europa.eu/sites/default/files/document_library/Publications/Other%20publications/2023/1056253/EuReCA%20Factsheet%20%2031%2005%202023.pdf ; https://www.moneylaundering.com/wp-content/uploads/2024/05/EBA.PressRelease.EuReCa.050224.pdf |
| **Romania, general** | Banks automatically restrict accounts when the KYC update deadline passes. For companies, they ask for a **recent ONRC (trade register) certificate**, the shareholder structure and the administrator's documents. | The local version of the problem: files expire, and clients are blocked rather than chased. | https://www.capital.ro/multi-romani-risca-sa-ramana-fara-acces-la-banii-din-cont-banca-trimite-notificari-verificarile-pe-care-clientii-trebuie-sa-le-faca.html [1 source, from 01] |

**How big are refresh backlogs?** These figures are weak and all come from vendors:
- In 2023 a corporate KYC review took **95 days** on average, up from 84 days in 2022. It cost **$2,500–3,500** at two-thirds of banks. A high-risk client can take **up to 240 days**. [vendor claim, Fenergo survey] https://www.fenergo.com/blogs/the-state-of-kyc-digitalization-progress-and-challenges-ahead
- "60–70% of your customer book is due for periodic review at any given time", and KYC staffing fell 14% in one year. [vendor claim, no survey cited] https://www.edgeverve.com/ai-next/events/queue-is-growing-faster/
- I found **no independent survey** giving a backlog percentage.

**Why perpetual KYC is becoming standard:**
- AMLR (Reg. (EU) 2024/1624, https://eur-lex.europa.eu/eli/reg/2024/1624/oj/eng) applies from 10 Jul 2027.
  - **Refresh periods:** Art. 26(2) requires a risk-based refresh at least every 1 year for higher-risk customers and every 5 years for all others. Art. 26(3) adds a refresh on any change in the customer's circumstances. https://www.springlex.eu/en/packages/aml/amlr-regulation/article-26/ [1 source, secondary text of the article]
  - **Discrepancy reports:** differences between the BO register and what the bank holds must be reported **within 14 calendar days**. https://www.cssf.lu/en/2024/06/the-new-aml-cft-regulation-the-sixth-aml-cft-directive-and-the-future-eu-aml-cft-supervisor/ [1 source]
  - **The article number for the 14-day rule is NOT verified.** File 07 says "Art. 24", but CSSF gives no article. Check EUR-Lex before saying "Art. 24" on stage, including whether the rule sits in the AMLR or in AMLD6 (Directive (EU) 2024/1640).
- KYC360 notes that neither the FCA nor the FATF prescribes "event-driven KYC". The practical model is a hybrid: scheduled reviews stay as a backstop, and event triggers prompt reviews in between. https://kyc360.com/knowledge-hub/resources/event-driven-kyc-monitoring-vs-periodic-review [1 source]
- RBI's own KYC job ads describe one team covering onboarding, periodic reviews and offboarding of corporate clients. https://jobs.rbinternational.com/job/Wien-Professional-KYC-Officer-%28fmx%29-Wien-1030/1360187757/ [1 source]

### (b) Missed deadlines in case handling

| Case | Deadline missed | Fine | Source |
|---|---|---|---|
| **N26, BaFin, May 2024** | Suspicious-activity reports were filed **systematically late throughout 2022**. German law requires them "immediately". | **€9.2m.** This was N26's second such fine: in 2021 it paid €4.25m for about 50 late reports from 2019–2020. | https://www.fintechfutures.com/regulatory-actions/n26-fined-9-2m-by-bafin-over-late-submission-of-suspected-money-laundering-reports-in-2022 ; https://fintech.global/2024/05/23/n26-fined-e9-2m-by-bafin-for-late-money-laundering-reports/ ; N26's statement: https://n26.com/en-at/press/press-release/position-on-the-upcoming-publication-of-a-fine-issued-to-n26-by-the-bafin |
| **TD Bank, FinCEN plus OCC, Oct 2024** | "Failed to timely file SARs" on a substantial part of the suspicious activity. About **$1.5bn of suspicious transactions had no SAR**. FinCEN linked this to **backlogs from insufficient staffing**. | **$1.3bn from FinCEN (a record)** and $450m from the OCC, about $3bn in total across agencies, plus a 4-year monitorship. | https://fincen.gov/news/news-releases/fincen-assesses-record-13-billion-penalty-against-td-bank ; https://lowenstein.com/media/f4xhk5li/20241014-aml-td-bank-to-pay-historic-3-billion-over-aml-compliance-violations.pdf |
| **bunq, AFM (NL), mid-2026** | Late answers to fraud complaints in **7 cases from 2023–24**. The PSD2 rule is a substantive answer within **15 business days**. | **€170k.** | https://www.amlintelligence.com/2026/06/latest-bunq-fined-e170k-over-slow-response-to-fraud-complaints/ ; https://paymentexpert.com/2026/06/09/bunq-dutch-afm-fine-online-fraud/ |
| **RBS/NatWest, FSA, 2011** (old, but gives a sense of scale) | **62% of complaint files sampled did not meet timeliness and disclosure requirements.** | £2.8m. | https://www.risk.net/risk-management/operational-risk/1938855/rbs-natwest-slapped-with-ps28m-fine-over-poor-complaints-handling ; https://mondovisione.com/media-and-resources/news/uks-financial-services-authority-fines-rbs-and-natwest-28m-for-poor-complaint-ha-2011124/ |
| **OTP, MNB (Hungary), 2024–2026** | Resolutions ordering the bank to answer complaints within the legal deadline. One in 2026 included a HUF 350k fine. | Small. | https://otpbank.hu/static/portal/sw/file/MNB_hatarozat_H_FK_I_B_2_20240105_ENG.pdf ; https://www.otpbank.hu/static/portal/sw/file/MNB-hatarozat-H-FK-I-B-20-20260122-ENG.pdf [primary, hosted by the bank] |
| **Raiffeisen Romania, ASF, 26 Nov 2024** | 5 staff had user rights in the fund-distribution application but had **not been notified to ASF**. Three of them carried out 15–20 operations. The bank's internal check relied on a list dated 14 Mar 2024. | Warning. | https://asfromania.ro/uploads/articole/attachments/67482756896ef352823949.pdf [from 01] |

**Beneficial-owner discrepancy reporting:**
- I found **no fines for late discrepancy reports** anywhere.
- The UK duty has existed since 10 Jan 2020 (https://www.gov.uk/government/news/new-reporting-requirement-for-obliged-entities-comes-into-force). One undated commentary says reports covered only about 0.1% of registered firms [1 source].
- The AMLR 14-day clock starts 10 Jul 2027.
- For the pitch, present this as **upcoming exposure, not a history of fines** (inference).

**DORA incident reporting:**
- The ESAs' first report (3 Jun 2026) counts **3,383 major ICT incidents in 2025**. It notes that "divergent reporting practices across sectors and jurisdictions are still observed". https://www.esma.europa.eu/press-news/esma-news/esas-publish-first-report-dora-major-ict-related-incidents
- I found **no public late-reporting finding or fine yet.** The DORA clocks are 4h initial, 72h intermediate and 1 month final. https://www.pillsburylaw.com/en/news-and-insights/dora-incident-reporting-esa-2025.html

### (c) Sequence failures (actions before consent, or insider misuse visible only from event order)

| Case | Order of events that went wrong | Source |
|---|---|---|
| **Raiffeisen Romania, ANSPDCP, Nov 2022: 138,572 lei** | **Credit bureau (Biroul de Credit) queries without the applicant's signed consent.** A client's **phone number was replaced with an employee's** and a fictitious email was added. A processor approved **loans nobody had requested**. Bank systems ran "prescoring" for an external broker. At least 169 people were affected. | https://profit.ro/stiri/raiffeisen-bank-romania-a-fost-amendata-cu-28-000-euro-pentru-mai-multe-incidente-privind-securitatea-datelor-clientilor-20923023 [1 source for the incident details, from 01] |
| **Raiffeisen Romania, ANSPDCP, Nov 2024: 99,466 lei** | Between **2015 and Mar 2023** one employee **changed clients' phone and email details, then opened accounts and deposits, applied for credit, issued payment orders and used 3 debit cards**, all without consent. Another employee used a *withdrawn* loan application to withdraw and transfer money. **Corrective order:** "a documented plan with periodic testing and evaluation of all actions that add or update clients' personal data". Any change made by staff must be notified to the client and agreed. | https://e-juridic.manager.ro/articole/clienti-cu-bani-retrasi-din-conturi-si-credite-nesolicitate-banca-din-romania-buna-de-plata-dupa-multiple-incalcari-gdpr-29973.html ; https://www.wall-street.ro/articol/Finante-Banci/312096/raiffeisen-bank-este-amendata-cu-20-000-de-euro-pentru-ca-niste-angajati-au-folosit-datele-clientilor.html [from 01] |
| **Other Romanian banks, ANSPDCP** | **BRD** (23,000 lei) sent negative data to the credit bureau **without informing the person first**. **ING** (20,000 lei) reported to the credit bureau outside the legal time window. **BCR** (€2,000) used a person's data without consent in an enforcement procedure. | https://financiarul.ro/actuale/brd-ing-si-otp-bank-amendate-pentru-nerespectarea-legii-prelucrarii-datelor/ [1 source] ; https://profit.ro/must-read/bcr-amendata-pentru-ca-ar-fi-utilizat-fara-acord-datele-unei-persoane-fizice-intr-o-executare-silita-pentru-debite-despre-care-nu-avea-cunostinta-20205936 [1 source] (dates not checked, likely pre-2020) |
| **Starling Bank, FCA, Sep 2024: £28.96m** | Starling agreed in Sep 2021 to restrict onboarding of high-risk customers. It then **onboarded 54,000+ high-risk customers in breach of that restriction** (Sep 2021 to Nov 2023). Separately, its sanctions screening had checked against only a partial list since 2017. | https://www.hsfkramer.com/notes/fsrandcorpcrime/2024-posts/fca-fines-starling-bank-%C2%A329m-for-failures-in-financial-crime-controls ; https://www.kslaw.com/insights/articles/fca-fines-starling-bank-over-financial-sanctions-screening-failures |
| **Commerzbank London** (see (a)) | Overdue-KYC clients **kept transacting** through an uncontrolled exceptions process. | FCA link above |

**Inference:** the 2024 Raiffeisen case ran for **8 years** before it was found. A rule over the event log that flags "an employee changed the client's contact data, then the same employee started a product or credit application" would have caught it on the first occurrence. That rule matches OpenLoop's demo scenario, and ANSPDCP's corrective order (test and evaluate every staff action that updates client data) describes what the event log does.

### (d) Files stalled waiting on client documents, and abandonment

- **Retail and digital onboarding:**
  - **68% of European consumers abandoned** a financial-services onboarding in Signicat's 2022 survey of 7,600 consumers. The rate was 63% in 2020 and 40% in 2016. On average people abandon after 18 min 53 s. [vendor claim]
  - A model commissioned by Signicat (P.A.ID Strategies, using the 2020 data) puts lost revenue at **€5.7bn a year**. [vendor claim]
  - Sources: https://www.signicat.com/press-releases/the-battle-to-onboard-2022 ; https://thefintechtimes.com/68-of-european-consumers-abandon-financial-applications-during-onboarding-finds-signicat/
  - Caveat: these are *session* abandonments. They are not files left stuck for weeks waiting on documents (inference).
- **Corporate KYC:** about 95 days per review (2023) and up to 240 days for high-risk clients. [vendor claim] (Fenergo link in (a))
- **RBI:** a LexisNexis case study says RBI "faced challenges with their customer onboarding process" and slow manual research. https://risk.lexisnexis.com/global/en/insights-resources/case-study/raiffeisen-bank [vendor claim]
- **Gap:** I found **no public figure** for how long Romanian SME onboarding or loan files sit waiting on client documents, or what share are dropped. Ask the Raiffeisen mentors for internal numbers, or present this as a hypothesis.

### (e) Not being able to show what was known and done, cited in enforcement

- **RBI, FMA, 28 Jun 2024: €2.07m.** RBI was "**unable to prove** the adequacy of the AML/CFT checks" carried out by two correspondent (respondent) banks in third countries. This is a burden-of-proof finding: the fine is about missing evidence. https://www.fma.gv.at/en/sanktion-gegen-raiffeisen-bank-international-ag/ [from 02]
- **Commerzbank London (FCA 2020):** the exceptions process was "not adequately controlled or overseen". Nobody could show who allowed overdue clients to keep transacting, or why. (FCA link above)
- **Raiffeisen Romania, ANSPDCP 2024:** the corrective order requires a documented, tested record of every staff action that adds or updates client data. In effect, the authority ordered an audit trail. (sources in (c))
- **Raiffeisen Romania, ASF 2024:** the bank's own check of who held system access relied on a months-old list. Two records disagreed and nobody noticed. (ASF PDF above)
- **Gap:** I found no notice that says, in those words, "the bank could not reconstruct the case timeline". The closest are "unable to prove" (FMA) and "not adequately controlled or overseen" (FCA). (inference)

---

## Q2. Does any bank already do this?

| Bank | What it does | Status | Overlap with OpenLoop | Not shown publicly | Source |
|---|---|---|---|---|---|
| **ING** | Agentic AI for customer due diligence (CDD), transaction monitoring and mortgages. About 70–80 of roughly 100 CDD questions can be answered from data the bank already holds, so it asks the client less. Extracting data for CDD is "human in the loop". | "Early production or in train" | Fills the KYC file from existing data; keeps a human in the loop | Case timeline, legal clocks, sequence checks | https://www.computerweekly.com/news/366626743/ING-Bank-transforming-operations-through-agentic-AI [1 source, snippet only: fetch returned 403]; https://evidentinsights.com/insights/articles/ing-genai-in-wholesale-banking [1 source]. The claim that "ING moved to event-driven KYC" appears only in vendor blogs (https://www.fluxforce.ai/for/hofaml-perpetual-kyc ; https://www.silenteight.com/blog/ing-standard-chartered-and-hsbc-are-making-perpetual-kyc-work-thanks-to-better-data) [vendor claim, unverified] |
| **RBI (sponsor group)** | **Risk Assistant** drafts corporate credit-rating reports (8h down to 3h, about 6,000 a year) and has been **extended to automated document verification, fraud detection and KYC**. ESG checks run with a full audit trail. Appian is listed among RBI's tools, but **I found no evidence that RBI uses Appian for KYC**. LexisNexis Bankers Almanac is used for counterparty KYC. | Deployed (self-reported) | Document verification and KYC help; audit-trail mindset | Multi-week case tracking, document-expiry reopening, BO 14-day clock, insider-sequence detection | IMD: https://www.imd.org/ibyimd/artificial-intelligence/de-risking-risk-management-with-ai-how-rbi-built-for-quality-and-speed/ [1 source, from 02]; https://www.rbinternational.com/en/raiffeisen/career/topics/ai-at-rbi.html ; LexisNexis link above [vendor claim] |
| **Raiffeisen Romania** | Fully online account opening in Smart Mobile with video identification (accredited by ADR, Romania's digitalisation authority). Smart Mobile reportedly supports the periodic update of ID data. | Deployed | Digital collection of client data | No agent; no case-level tracking found | https://www.revistabiz.ro/raiffeisen-bank-a-obtinut-acreditarea-de-la-autoritatea-pentru-digitalizarea-romaniei-pentru-identificare-video/ [1 source]; https://financialintelligence.ro/inrolarea-clientilor-raiffeisen-bank-100-online-in-aplicatia-smart-mobile/ [1 source, undated] |
| **Santander** | 280+ "process automation agents" in credit, fraud, KYC and operations. | Deployed (self-reported) | KYC and credit operations agents | No detail on legal clocks or case memory | [from 03] https://www.santander.com/en/stories/santander-turns-its-ai-first-strategy-into-measurable-impact-and-extends-ai-access-to-all-185000-employees |
| **BNY** | About 140 "digital employees", each with its own identity, access rights and workflows. They work on payment validation, reconciliation and anomaly detection. Humans review their output. | Deployed | Agent as an accountable actor; human review | Not KYC or lending cases | [from 03] https://www.axios.com/2025/10/17/ai-wall-street-digital-workers |
| **Goldman Sachs** | Claude-based agents for **client vetting and onboarding** and for trade accounting. | In development (Feb 2026) | Onboarding agent | Not launched | [from 03] https://www.cnbc.com/2026/02/06/anthropic-goldman-sachs-ai-model-accounting.html |
| **JPMorgan** | LLM Suite deployed to about 250k staff. Autonomous agents that run for hours are planned for 2026. | Portal deployed; agents planned | The long-running agent idea | No KYC case agent found | [from 03] https://www.cnbc.com/2026/06/09/jpmorgan-chase-ai-agents.html |
| **HSBC** | 600+ AI use cases. An agentic financial-crime partnership with Google Cloud was announced in Jun 2026. The perpetual-KYC claim appears only in a vendor blog. | Announced; pKYC unverified | Financial-crime monitoring | No case timeline or deadline tracking found | [from 03] https://www.hsbc.com/-/files/hsbc/media/media-release/2026/260616-hsbc-and-google-cloud-ai-strategic-partnership.pdf?download=1 ; Silent Eight blog [vendor claim] |
| **Commonwealth Bank** | A fraud agent writes fraud rules, and **analysts approve each rule before it goes live**. | Deployed | Human approval of agent output, close to "rulings become reusable rules" | Not case management | [from 03] https://www.commbank.com.au/articles/newsroom/2026/04/ai-agent-spots-fraud-in-real-time.html |
| **DBS** | CSO Assistant; "Joy", an agentic assistant for 350k corporate clients. | Deployed | Corporate-client agent | Not case or deadline tracking | [from 03] https://www.edb.gov.sg/en/news-and-insights/dbs-rolls-out-agentic-ai-350000-corporate-clients |
| **BBVA** | ChatGPT Enterprise with 20k+ custom GPTs. | Deployed | Generic | Not case agents | [from 03] https://openai.com/index/bbva-2025 ; https://www.bbva.com/en/innovation/bbva-expands-its-agreement-with-openai-to-11000-chatgpt-licences-for-the-banks-employees/ |
| **UniCredit** | 10-year MoU with Google Cloud. **No KYC or case agent found** (I searched). | MoU | None | n/a | [from 03] https://www.unicreditgroup.eu/en/press-media/press-releases/2025/may/unicredit-partners-with-google-cloud-to-accelerate-digital-trans.html |
| **Erste / BCR** | Job ads mention RAG and agentic systems. BCR has named no agent. | No public deployment | None | n/a | [from 03] https://www.karriere.at/jobs/7893061 [1 source, job ad] ; https://www.wall-street.ro/articol/banking/ai-in-bancile-romanesti-ce-fac-bt-bcr-cec-ing-si-raiffeisen.html |
| **Banca Transilvania** | DAVID, an operations-helpdesk agent built by Druid. It handles interest calculations, reports, client notifications and verification checks. | Deployed (undated) [vendor claim] | Some ops checks | Not long-running cases | [from 03] https://www.druidai.com/case-studies/banca-transilvania-banking-helpdesk-support-ai-agent |

**Vendors that sell parts of this to banks** (all [vendor claim]):
- **Appian Connected KYC** tracks document status and sends KYC cases to manual review based on rules. https://docs.appian.com/suite/help/24.1/kyc-23.3.1.6/appian-connected-kyc-home.html
- **WorkFusion "Kayla"** coordinates periodic and event-driven KYC reviews. https://doc.workfusion.com/digital-workers/kayla/dwk/2.0/dwk-overview
- **Fenergo** offers "agentic periodic review" aimed at clearing review backlogs. https://resources.fenergo.com/whitepapers/agentic-periodic-review-whitepaper
- **Sutherland** reports a multi-agent KYC refresh at an *unnamed* offshore bank, with 60–70% less manual effort and reviews finished 50% faster. https://www.sutherlandglobal.com/insights/case-study/agentic-ai-kyc-refresh-70-percent-less-effort-50-percent-faster-reviews
- **Kyndryl and Incore Bank (Switzerland)**: a proof of concept for agentic KYC (Sep 2026). [from 03] https://fintech.global/2026/09/07/incore-bank-trials-gemini-powered-kyc-with-kyndryl/

---

## Final verdict

### Real problem? **Yes. The evidence is strong for (a), (b), (c) and (e), and medium-to-weak for (d).**
- **(a) Stale files:**
  - Regulators have fined banks specifically for failing to keep KYC documents current: RBI (FMA 2018), Commerzbank (1,772 overdue, FCA 2020) and ING (no periodic review, 2018).
  - The EBA says CDD and ongoing monitoring make up more than half of the AML weaknesses supervisors report.
  - Strength: **strong** (primary regulator sources, including the sponsor's own group).
- **(b) Missed deadlines:**
  - Late SAR filing has been fined repeatedly: N26 €9.2m (BaFin), TD Bank $1.3bn (FinCEN).
  - Late complaint answers: bunq (AFM).
  - Strength: **strong for SARs and complaints.**
  - **No fines yet** for late BO discrepancy reports or late DORA incident reports. Those clocks are new. Present them as upcoming exposure.
- **(c) Sequence failures:**
  - The best evidence is local and comes from the sponsor itself:
    - Raiffeisen Romania was fined by ANSPDCP in 2022 for credit bureau queries without consent and for an employee's phone number replacing a client's.
    - In 2024 it was fined again for an employee who, over 8 years, changed contact details and then opened products and loans.
  - These are almost exactly OpenLoop's demo scenarios.
  - Strength: **strong, but the incident details rest on single press sources** (Profit.ro, e-juridic, Wall-Street.ro).
- **(d) Stalled files:**
  - Abandonment (68%) and corporate review length (95 days) come from vendor surveys.
  - There is **no public Romanian figure** for SME or loan files stuck waiting on documents.
  - Strength: **medium to weak.**
- **(e) Audit trail:**
  - The FMA fined RBI in 2024 because it was "unable to prove" the adequacy of its checks.
  - The FCA said Commerzbank's exceptions process was "not adequately controlled or overseen".
  - ANSPDCP ordered Raiffeisen Romania to keep a tested record of every staff action that updates client data.
  - Strength: **medium**, because no notice uses the exact words "could not reconstruct the timeline".

### Already done by banks? **Partly. The parts are common; the combination has not been published.**
- **Already common** (do not pitch these as new):
  - document extraction and verification (RBI Risk Assistant, ING);
  - filling the KYC file from data the bank already holds (ING);
  - onboarding and KYC agents (Santander, Goldman in development);
  - human-in-the-loop review (all of them);
  - agents with their own identity (BNY).
  - CLM vendors such as Appian, Fenergo and WorkFusion already track document status and trigger event-driven reviews.
- **Not found at any bank, publicly** (these are OpenLoop's differentiators, inference):
  1. A **tamper-evident event timeline for each case** that is *queried by rules about event order*, for example "credit bureau query before consent" or "staff changed the client's contact data, then the same staff member opened a loan". Pitch it as the control ANSPDCP ordered Raiffeisen Romania to build.
  2. A **watcher for legal and document clocks on a long-running case**: the AMLR 14-day BO discrepancy report, ONRC certificate expiry that reopens the file, and reminders to the client.
  3. **Analyst rulings reused as precedents** for the next similar case. CBA's analyst-approved fraud rules are the nearest example.
- **Caveat (inference):** banks rarely publish internal compliance tooling. "Not found publicly" does not mean "nobody does it". Big CLM platforms (Fenergo, Appian) could add (2). Point (1), sequence rules over a unified event log tied to Romanian enforcement cases, is the strongest defensible edge.

### Single-source items to double-check before quoting on stage
- The ING "70–80 of ~100 questions" figure (Computer Weekly snippet only).
- RBI Risk Assistant's "extended to KYC" (IMD only).
- The details of the 2022 ANSPDCP Raiffeisen case (Profit.ro only).
- All Signicat and Fenergo figures (vendor claims).
- The article number for the AMLR 14-day BO discrepancy rule. The 14 days come from CSSF; "Art. 24" is not verified. Check EUR-Lex.
- RBI Risk Assistant "8h to 3h": the IMD article also says "more than a day", so the baseline is unclear.
- ING 2018: the file-level findings (missing files, no periodic review) may come from ING's own internal inquiry as reported, not from the prosecutors' findings.
