# 06 — Internal compliance, regulatory and operations open-loop processes

Research date: 2026-10-28. Scope: long-running internal processes at a Romanian bank (Raiffeisen Bank Romania, RBRO) that fit the "open-loop case engine": a goal plus a checklist of requirements, inputs from several parties arriving over days or weeks, legal timers, hard rules in code, fuzzy matching, and human triage.

Conventions: every claim has a URL. **[1 source]** means a single source. **(inference)** means our own reasoning, not a sourced fact. "Not found" means this ~40-call sweep turned up nothing; it does not mean the data doesn't exist.

Key caveat: Romania is **not** in the ECB's SSM. BNR supervises Raiffeisen Bank Romania directly. ECB findings reach RBRO only through RBI group policies (inference).

---

## 1. AML investigations: alert → case → RFI to client → STR to ONPCSB

- **What it is:** a monitoring alert becomes a case. The analyst asks the client for information or documents (source of funds, contracts, invoices), the client replies over days or weeks, and the case ends with a close or an STR to ONPCSB, the Romanian FIU.
- **Why it's an open loop:** the request for information (RFI) to the client is a classic waiting state: documents arrive late or incomplete, or contradict the declared profile. Pre-execution STRs also run on hard clocks.
- **Rules and deadlines:**
  - ONPCSB can suspend a reported transaction for **48 hours**. The Prosecutor's Office (PICCJ) can extend the suspension by **72 hours** at ONPCSB's request. Source: [ONPCSB Activity Report 2024](https://onpcsb.ro/uploads/articole/attachments/683845a507468535597673.pdf).
  - Reporting deadline: if a transaction could not be postponed, ONPCSB must be informed no later than **24 hours** after it was carried out. Source: [fiscalitatea.ro](https://www.fiscalitatea.ro/obligatii-si-sanctiuni-noi-referitoare-la-prevenirea-si-combaterea-spalarii-banilor-20091/) **[1 source, secondary]**.
  - Cash transactions of at least EUR 10,000 are also reportable (same source).
  - AMLR (Reg. 2024/1624) applies from **10 July 2027**. Source: [Art. 90 text via springlex](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-90/) **[1 source]**.
- **Volume, cost and fine evidence:**
  - In 2024 ONPCSB registered **22,470 STRs and ex officio referrals**, up from 15,368 in 2021 and 16,065 in 2022. The report contradicts itself on growth: the text says both +5.48% and +5.62%, and the chart shows 22,500. Source: [ONPCSB 2024](https://onpcsb.ro/uploads/articole/attachments/683845a507468535597673.pdf).
  - **68.55%** of STRs came from credit institutions, which is roughly 15,400 bank STRs (inference: share × total).
  - **2,476** STRs arrived before the transaction was executed. In 891 of these the bank had already blocked the transaction, and 1,585 needed an ONPCSB decision. ONPCSB ordered 28 suspensions of 48h, and the prosecutor extended 6 of them. Same source.
  - BNR, 2022: about **30 AML sanctions** on banks, mostly warnings. Fines: OTP Bank **500,000 lei** (11 breaches, including failure to identify the beneficial owner and missing transaction monitoring), Banca Transilvania and Patria Bank 50,000 lei each. Sources: [Economedia](https://economedia.ro/otp-bank-amenda-record-de-la-bnr-pentru-incalcarea-legislatiei-privind-spalarea-banilor-banca-implicata-anul-trecut-intr-o-ancheta-diicot-privind-spalarea-a-70-de-milioane-de-lei.html), [puterea.ro](https://www.puterea.ro/?p=216656).
  - Industry: rule-based transaction monitoring produces **90–95% false positives**, and each alert takes 20–90 minutes of analyst time. Source: [particula.tech](https://particula.tech/blog/aml-alert-triage-ai-false-positives) **[1 source, vendor blog]**.
- **Raiffeisen evidence:** the Austrian FMA fined **RBI EUR 2.07m** (announced 28 June 2024) because RBI could not prove adequate AML/CFT checks on two third-country correspondent respondents. RBI appealed to the BVwG on 25 July 2024. Source: [FMA](https://www.fma.gv.at/en/sanktion-gegen-raiffeisen-bank-international-ag/). No BNR AML sanction on RBRO was found.
- **Existing automation:** crowded market. NICE Actimize, SAS, Quantexa and Hawk cover alerting and case management (see [NICE Actimize report](https://www.niceactimize.com/Documents/aml_ai_in_aml_insights_report.pdf)). The less-served part is the **RFI-to-client document loop** and STR narrative assembly (inference).
- **Fit for our engine: 4/5.** The RFI sub-loop is a clean checklist with waiting states and expiry. Full alert scoring is commoditised, so we should not compete there.
- **Demo-ability: 4/5.**

## 2. Requests from authorities: ANAF garnishments, bailiffs, police, prosecutors, courts

- **What it is:** authorities send banks orders to set up a garnishment (*poprire*), suspend it, continue it, or lift it, and ask for client information or statements. The bank must match each order to the right client and accounts, apply it, answer, and track it until it is lifted.
- **Why it's an open loop:** one debt can generate a chain of acts over weeks: set-up, suspension, continuation, lifting. Each must be reconciled against account balances and against later acts from the same or another authority.
- **Volume evidence (Romania, primary):** in H1 2025 ANAF sent **2,250,489 enforcement acts** to credit institutions through e-Popriri. Source: [ANAF activity report H1 2025](https://static.anaf.ro/static/10/Anaf/Informatii_R/18.08.2025%20-%20Raport%20de%20activitateANAF_2025S1_V7.pdf). The acts break down as:
  - **1,079,509** garnishment set-ups on bank accounts
  - **1,125,352** lifting decisions
  - **26,631** suspensions
  - **18,997** continuations

  Bank-account garnishments brought in **2.92bn lei** in H1 2025 (+22.89%), per the same report. Do not use the separate figure of 581,804: it covers garnishment of amounts owed by third parties, not bank accounts.
- **Exception class (cross-party contradiction):** several banks garnished the same tax debt at once, which caused overpayments that ANAF then had to refund. Since 1 Oct 2023 ANAF has required banks to report seizable amounts daily, and again each time money arrives in the account. Source: [Profit.ro, 2 May 2023](https://www.profit.ro/taxe-si-consultanta/confirmare-bancile-vor-obligate-comunice-anaf-informatii-sumele-conturile-celor-popriti-astfel-incat-fie-evitate-platile-excesive-catre-fisc-pana-acum-bcr-acceptat-colaboreze-21112323) **[1 source]**.
- **Unstructured channel:** garnishments from bailiffs (*executori judecătorești*) and town halls reach at least one bank by e-mail, one e-mail per garnishment. Source: [Revolut RO garnishment info](https://www.revolut.com/ro-RO/legal/informatii-popriri/) **[1 source]**.
- **Police, prosecutor (DIICOT/DNA) and court request volumes:** not found.
- **Raiffeisen evidence:** not found.
- **Existing automation:** the ANAF channel is already electronic: e-Popriri since 2017, with daily reporting since Oct 2023. Bailiff, court and prosecutor requests arrive as unstructured PDF or e-mail and are the less-automated part (inference).
- **Fit for our engine: 4/5.** It is a state machine per debt and per authority, and conflicting acts are exactly our "contradicted" state. The ANAF channel itself is mostly automated.
- **Demo-ability: 4/5.**

## 3. DORA: major ICT incident reporting clocks, register of information, contract remediation

- **Incident reporting clocks** (primary: [ESAs 2025 report on major ICT incidents, JC 2026 16](https://www.esma.europa.eu/sites/default/files/2026-06/JC_2026_16_ESAs_2025_report_on_major_ICT-related_incidents.pdf), citing RTS 2025/301 and ITS 2025/302):
  - Initial notification: within **4h of classifying the incident as major**, and no later than **24h after becoming aware** of it.
  - Intermediate report: within **72h of the initial notification**.
  - Final report: **1 month after the (latest) intermediate report**.
  - Weekend or holiday relief (submit by noon of the next working day) does **not** apply to credit institutions' initial or intermediate reports. Source: [Art. 5 RTS 2025/301 via Advisera](https://advisera.com/cdr-2025-301/time-limits-for-the-initial-notification-and-for-the-intermediate-and-final-reports/) **[1 source, secondary]**.
- **Volume:** EU financial entities reported **3,383 major incidents in 2025**, and more than 60% came from the credit sector (0.57 per credit institution). About a third originated from third-party failures, and about a third had cross-border impact. The ESAs note "divergent reporting practices" and say incident reports were not yet under full automated data-quality rules. Same ESAs report.
- **Register of information:**
  - All financial entities must keep a register of their ICT third-party contracts. Competent authorities had to send the registers to the ESAs by **30 Apr 2025**.
  - The 2024 dry run (not first-year supervisory findings): only **6.5%** of registers passed all 116 data-quality checks, and **86%** of errors were missing mandatory fields. Sources: [European Pensions](https://www.europeanpensions.net/ep/Just-6-5pc-of-DORA-dry-run-registers-passed-all-data-quality-checks-ESAs.php), [Finadium](https://finadium.com/?p=146610).
  - The first list of critical ICT third-party providers (CTPPs) was published on **18 Nov 2025**, based on the registers. Source: [ESMA](https://www.esma.europa.eu/press-news/esma-news/european-supervisory-authorities-designate-critical-ict-third-party-providers). The number of CTPPs was not found in this sweep.
  - First-year (2025) supervisory findings on register quality: not found.
- **Contract remediation (DORA Art. 30):** lawyers call vendor renegotiation "very challenging" and a "battle of the forms". Source: [WatersTechnology](https://waterstechnology.com/node/7952216) **[1 source]**.
- **Romania and BNR specifics:** not found.
- **Raiffeisen evidence:** not found.
- **Existing automation:** GRC and ITSM tools (ServiceNow IRM, Archer and similar) handle incident workflow and registers. Producing the multi-clock report with evidence from several teams and vendors is still manual (inference).
- **Fit for our engine: 5/5 for incident clocks** (hard legal timers, evidence arriving from IT, the vendor and the business, and possible reclassification). **4/5 for register and contract remediation** (a checklist per contract, waiting on vendor replies).
- **Demo-ability: 5/5.** A visible countdown, with one incident firing both a DORA clock and the GDPR 72h clock (see §9).

## 4. Outsourcing and vendor onboarding, due diligence, periodic reviews

- **Rules:** EBA/GL/2019/02 applies. Source: [EBA GL text](https://www.eba.europa.eu/sites/default/files/document_library//EBA%20GL%202019%2002%20-%20CT%20GLs%20on%20outsourcing%20arrangements.pdf), summarised by [Addleshaw Goddard](https://www.addleshawgoddard.com/en/insights/insights-briefings/2019/financial-regulation/eba-guidelines-on-outsourcing-arrangements/). Key requirements:
  - a register of **all** outsourcing arrangements, not only critical ones
  - informing the supervisor in good time before outsourcing a critical or important function
  - exit strategies
  - audit and access rights for the institution and the supervisor
  - prior notice of sub-outsourcing

  For ICT services, DORA now overlaps (see §3).
- **Duration and pain:**
  - KPMG's 2026 global TPRM survey (financial services, 851 respondents) puts onboarding typically at **0–60 days**. Source: [KPMG](https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2026/global-tprm-survey_financial_services.pdf) **[1 source, not opened in full]**.
  - Ncontracts' 2025 survey names collecting and reviewing vendor documents as the main due-diligence bottleneck. Source: [CUInsight](https://www.cuinsight.com/press-release/ncontracts-releases-2025-third-party-risk-management-survey-trends-insights-for-financial-institutions/) **[1 source]**.
- **Fines:** none found.
- **Raiffeisen evidence:** none found.
- **Existing automation:** commoditised. Aravo, Prevalent, OneTrust, ServiceNow VRM, Ncontracts and others sell TPRM platforms.
- **Fit for our engine: 4/5.** It is a document checklist waiting on the vendor, with an expiry on each certificate (ISO, SOC2, insurance). The product category is crowded, though.
- **Demo-ability: 4/5.**

## 5. Joiner-mover-leaver, access recertification, and regulator staff registers (ASF)

- **Raiffeisen-specific evidence (strongest item in this file):**
  - [ASF Decision no. 1168 of 26.11.2024](https://www.asfromania.ro/uploads/articole/attachments/67482756896ef352823949.pdf) sanctioned Raiffeisen Bank S.A., acting as a credit-institution intermediary, with a **warning**. Breach: Art. 6(1) of ASF Reg. 14/2018 (issued under Law 126/2018).
  - The bank's 2024 internal audit found **5 employees with user access to the fund-distribution application** (subscriptions and redemptions of Raiffeisen Asset Management funds) who had **not been notified to ASF**.
  - 3 of them carried out **15–20 operations each** between **Feb 2023 and Jun 2024**. The bank checked against its internal register on **14.03.2024**, notified the 3 to ASF on **11.06.2024**, and deactivated the other 2.
  - ASF noted that the bank sends "a very large number of notifications/authorisations": **1,025 in 2022, 725 in 2023, and 330 in H1 2024**.
  - ASF also noted a prior warning to the bank, acting as depositary (Decision 161/17.02.2023).
  - The control ran from 26.08 to 04.10.2024.
- **Why it's an open loop:** two ledgers must agree: identity and access management (access granted) and the regulator register (person notified to ASF). Every joiner or mover with a regulated role opens a case: notify ASF before the person acts, wait for confirmation, grant access. A mismatch is a "contradicted" requirement.
- **Wider evidence:**
  - The ECB says some banks "continue to report gaps" in basic cyber hygiene, including **identity and access management**. Source: [ECB Supervision Newsletter, Nov 2023](https://www.bankingsupervision.europa.eu/press/publications/newsletter/2023/html/ssm.nl231115.en.html) **[1 source]**.
  - The same newsletter reports 22 cyber on-site inspections in 2020–23, with deficiencies "more severe and widespread than expected".
- **Existing automation:** IGA tools (SailPoint, Saviynt, Microsoft Entra) automate joiner-mover-leaver and recertification. None that we found reconcile access against **regulator staff registers** (ASF, BNR fit-and-proper) (inference).
- **Fit for our engine: 5/5.** Events from HR, IAM and the ASF register meet in a deterministic check: "has access AND not notified" means contradicted, fire an exception. A repeated human fix compiles into a reusable rule.
- **Demo-ability: 5/5.** It replays a real Raiffeisen finding.

## 6. Internal audit and regulatory findings remediation tracking (ECB, BNR)

- **What it is:** each finding gets an action plan, an owner, a deadline and evidence of closure. Audit then validates the closure, and the supervisor follows up.
- **Evidence:**
  - ECB supervisory priorities 2026–28: RDARR progress "remains slow", and SREP 2025 showed "persistent deficiencies … with no improvement" on the relevant sub-score.
  - The ECB promises "a clearly defined remediation and escalation process", targeted on-site inspections, and "binding measures to ensure timely remediation of the material findings".
  - Source: [ECB SSM priorities 2026–28](https://www.bankingsupervision.europa.eu/framework/priorities/html/ssm.supervisory_priorities202511.en.html).
  - Consultancy commentary agrees that tighter remediation deadlines and faster escalation are expected. Source: [PwC Legal](https://legal.pwc.de/en/news/articles/ecb-ssm-publishes-its-annual-work-programme-2026).
- **Raiffeisen evidence:**
  - RBI is ECB-supervised. The ECB pressed RBI to cut Russian exposure, and RBI cut Russian loans and deposits by about a quarter. Source: [BNN Bloomberg, 2024](https://bnnbloomberg.ca/business/2024/10/29/raiffeisen-slashes-russia-loans-deposits-due-to-ecb-pressure). That is a group-level remediation-with-deadlines example.
  - The ASF decision in §5 shows RBRO "assumed internal implementation deadlines" for remediation.
  - Any cascade of ECB findings to RBRO is (inference).
- **Volume or count of open findings:** not found.
- **Existing automation:** GRC suites (Archer, ServiceNow, MetricStream, AuditBoard) track action plans. Judging the **evidence of closure** (does the uploaded document actually close the finding?) is manual (inference).
- **Fit for our engine: 4/5.** Each finding is a goal with requirements and deadlines, and the evidence arrives from many owners.
- **Demo-ability: 3/5.** The data is internal and hard to mock convincingly.

## 7. Regulatory reporting data corrections and resubmissions

- **ECB RDARR / BCBS 239:**
  - The ECB published its RDARR Guide in May 2024 and said in March 2024 that adequate RDARR capabilities "are still the exception".
  - Root causes it cites: governance shortcomings, fragmented IT, and a high level of manual aggregation.
  - Sources: [Forvis Mazars](https://www.forvismazars.com/group/en/insights/latest-insights/pressure-on-eu-banks-risk-data), [ECB priorities](https://www.bankingsupervision.europa.eu/framework/priorities/html/ssm.supervisory_priorities202511.en.html).
- **ANAF account-reporting errors by banks:** not found in this sweep.
- **Related:** the e-Popriri overpayment issue in §2 is a reconciliation and data-correction problem between banks and ANAF.
- **Raiffeisen evidence:** not found.
- **Existing automation:** regulatory reporting engines (Wolters Kluwer OneSumX, Regnology/BearingPoint Abacus) are commoditised. Tracking a correction case across data owners is less so (inference).
- **Fit for our engine: 3/5.** These are mostly data-pipeline problems, not document-and-reply loops.
- **Demo-ability: 2/5.**

## 8. Policy and procedure lifecycle: annual review, attestation, regulatory change implementation

- **Regulatory change hooks:**
  - **CCD2** (Directive 2023/2225) applies from **20 Nov 2026**, about 3 weeks from today, when the 2008 CCD is repealed. Source: [Vixio](https://vixio.com/insights/pc-mapping-eu-legislation-directive-eu-20232225-consumer-credit).
  - **Romania missed the 20 Nov 2025 transposition deadline**, and the Commission opened infringement proceedings. A Ministry of Economy draft law was put to public debate. Sources: [Profit.ro](https://profit.ro/perspective/comisia-europeana-lanseaza-o-procedura-de-infringement-impotriva-romaniei-pentru-contractele-de-credit-de-consum-22328772), [puterea.ro](https://www.puterea.ro/?p=488492). Whether it has been adopted as of today is unconfirmed.
  - **AMLR** applies from 10 July 2027 (see §1).
- **Why it's an open loop:** each regulatory change becomes a gap analysis, then policy, procedure, IT, training and attestation, each with an owner and a deadline. Late national law means the requirements keep shifting.
- **Pain, cost or fine evidence specific to policy attestation:** not found.
- **Raiffeisen evidence:** not found.
- **Existing automation:** regulatory change management tools (CUBE, Wolters Kluwer, Ascent) are commoditised for horizon scanning. The last step, "did every procedure actually change", is less automated (inference).
- **Fit for our engine: 3/5.**
- **Demo-ability: 3/5.** CCD2's timeliness makes a good narrative hook, but the data is soft.

## 9. GDPR breach notification (72h) and ANSPDCP fines on Romanian banks

- **Rule:** notify the supervisory authority without undue delay and **within 72 hours** of becoming aware of a breach (GDPR Art. 33(1)). Source: [EUR-Lex GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- **ANSPDCP fines on banks:**
  - **UniCredit Bank (investigation completed May 2026):** EUR 12,000 in total, of which **EUR 2,000 for breaching Art. 33(1)** by not notifying within the legal deadline. The rest was for Art. 32. Mortgage clients' names, addresses and property values were disclosed. Sources: [Economica.net](https://www.economica.net/anspdcp-a-amendat-recent-o-banca-importanta-din-romania-pentru-divulgarea-datelor-unor-clienti-la-cat-s-a-ridicat-sanctiunea_946919.html), [Enforcement Tracker ETid-3184](https://www.enforcementtracker.com/ETid-3184).
  - **Raiffeisen Bank Romania (2022):** fines of **EUR 28,000** (138,572 lei) plus 2 warnings, under Art. 32 and Art. 25. The bank had notified **17 incidents** affecting **at least 169 people**. The incidents included documents sent to the wrong e-mail address, one client's documents attached to another client's complaint reply, credit-bureau and ANAF queries run without signed consent for a broker's prescoring, and suspected internal fraud. Source: [Profit.ro, 18 Nov 2022](https://profit.ro/stiri/raiffeisen-bank-romania-a-fost-amendata-cu-28-000-euro-pentru-mai-multe-incidente-privind-securitatea-datelor-clientilor-20923023) **[1 source]**.
  - **ING Bank Romania branch:** EUR 20,000. Source: [Profit.ro](https://profit.ro/stiri/ing-bank-romania-a-fost-sanctionata-cu-20-000-de-euro-20927473) **[1 source, date not confirmed]**.
- **Existing automation:** privacy tools (OneTrust, Radar) run 72h breach workflows; this is commoditised.
- **Fit for our engine: 3/5** on its own, because the clock is short and single-party. **4/5 when combined with DORA §3**: one incident triggers several clocks.
- **Demo-ability: 4/5.**

## 10. Other internal open loops with evidence

- **Whistleblowing reports:**
  - EU Directive 2019/1937 Art. 9 requires acknowledgement **within 7 days** and feedback **within 3 months**. Source: [EUR-Lex](https://eur-lex.europa.eu/eli/dir/2019/1937/oj) **[1 source, not re-verified in this sweep]**. Romania transposed it with Law 361/2022.
  - Volume evidence: not found.
  - Fit 3/5.
- **ONPCSB requests to banks (Art. 33 of Law 129/2019):** ONPCSB asks credit institutions for additional information when answering partner FIUs and Europol. Source: [ONPCSB 2024](https://onpcsb.ro/uploads/articole/attachments/683845a507468535597673.pdf). Volume: not found.

---

## Top 5 internal processes by (evidence of pain × fit)

Scored on three things: Raiffeisen- or RBI-specific evidence; multi-party inputs arriving over days or weeks with legal timers; and how far incumbents already automate it.

| # | Process | Strongest evidence | Pain | Fit | Demo |
|---|---|---|---|---|---|
| 1 | **Regulated-staff register vs. access (ASF notifications + joiner-mover-leaver)** | ASF Decision 1168/26.11.2024: 3 unnotified Raiffeisen staff did 15–20 fund operations each over Feb 2023–Jun 2024. The bank files about 1,000 ASF notifications a year (1,025 in 2022). [ASF](https://www.asfromania.ro/uploads/articole/attachments/67482756896ef352823949.pdf) | High (Raiffeisen-specific) | 5 | 5 |
| 2 | **DORA major-incident clocks (+ GDPR 72h)** | 3,383 major ICT incidents in the EU in 2025, more than 60% in banks. Clocks: 4h / 24h / 72h / 1 month, with no weekend relief for credit institutions. [ESAs JC 2026 16](https://www.esma.europa.eu/sites/default/files/2026-06/JC_2026_16_ESAs_2025_report_on_major_ICT-related_incidents.pdf) | High | 5 | 5 |
| 3 | **Authority garnishments and requests (popriri: set → suspend → continue → lift)** | 2,250,489 ANAF enforcement acts to Romanian banks in H1 2025 alone, plus a known multi-bank overpayment exception. [ANAF H1 2025](https://static.anaf.ro/static/10/Anaf/Informatii_R/18.08.2025%20-%20Raport%20de%20activitateANAF_2025S1_V7.pdf) | High volume; ANAF part partly automated | 4 | 4 |
| 4 | **AML RFI-to-client → STR sub-loop** | 22,470 STRs and referrals in 2024, 68.55% from banks; 48h suspension window. RBI was fined EUR 2.07m by the FMA in 2024. [ONPCSB 2024](https://onpcsb.ro/uploads/articole/attachments/683845a507468535597673.pdf) | High, but the vendor market is crowded | 4 | 4 |
| 5 | **DORA register of information / ICT contract remediation + outsourcing due diligence** | Only 6.5% of dry-run registers passed all 116 checks; 86% of errors were missing mandatory data. [European Pensions](https://www.europeanpensions.net/ep/Just-6-5pc-of-DORA-dry-run-registers-passed-all-data-quality-checks-ESAs.php) | Medium-high | 4 | 4 |

Runners-up: findings remediation (§6; strong ECB language, but soft data and a weak demo), and the CCD2 regulatory-change rollout (§8; timely, since it applies 20 Nov 2026 and Romania is under infringement, but no pain metrics).
