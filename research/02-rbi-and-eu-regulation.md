# 02: RBI group pressures and EU/Romanian regulation driving repetitive operational work

**As of 28 Oct 2026.** Scope: (A) problems at Raiffeisen Bank International (RBI) group level, and (B) EU and Romanian rules for 2025–2027 that create repetitive document, data and rules work. Raiffeisen Romania-specific news is in `01-raiffeisen-romania.md` and is only cross-referenced here.

**Confidence tags**
- No tag: at least 2 independent sources, or 1 primary source (regulator, RBI, EU body).
- **[1 source]**: a single secondary source.
- **[inference]**: my reasoning, not a sourced fact.
- **[low confidence]**: weak or aggregator-only evidence.

**Method note:** EUR-Lex was not retrievable from this environment (HTTP 403 / empty pages). Article-level citations for AMLR therefore come from Springlex (which reproduces the OJ text) and the CSSF (Luxembourg supervisor) summary. The EUR-Lex link is given for reference. Re-check exact wording on EUR-Lex before quoting article text to the jury.

---

## 0. Corrections to the brief's assumptions (read first)

| Brief assumption | Status on 28 Oct 2026 | Sources |
|---|---|---|
| "EU AI Act: credit scoring high-risk obligations from Aug 2026" | **Postponed.** The Digital Omnibus on AI, **Regulation (EU) 2026/1744** of 8 Jul 2026, has been in force since 27 Jul 2026. Annex III high-risk systems, which include creditworthiness and credit scoring of natural persons, now apply from **2 Dec 2027**. Annex I (AI embedded in products) applies from 2 Aug 2028. | [AI Act Explorer – Digital Omnibus](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/); [Cuatrecasas (Council approval 29 Jun 2026)](https://www.cuatrecasas.com/en/global/intellectual-property/art/council-eu-approves-digital-omnibus-ai); [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-omnibus-vii-deadline-delay-20260/) |
| "Verification of Payee (Oct 2025)" | **Euro area only.** Romania is a non-euro state, so its deadlines differ (see the bullets below this table). **No source shows VoP being extended to RON transfers.** Romania's existing name-display service (SANB, run by ARB/Transfond) is voluntary. | [ECB IPR page](https://www.ecb.europa.eu/paym/retail/instant_payments/html/instant_payments_regulation.en.html); [Economedia – SANB](https://economedia.ro/proiect-pilot-clientii-bancilor-din-romania-vor-putea-verifica-identitatea-beneficiarului-real-al-platii.html) |
| "PSD3/PSR: status in 2026" | **Political deal 27 Nov 2025; final compromise texts published 23 Apr 2026.** I found no confirmation of publication in the Official Journal. The PSR should apply about 21 months after entry into force, so **realistically 2028**. | [Hogan Lovells](https://www.hoganlovells.com/en/publications/final-texts-for-psd3-and-psr-awaited-as-european-parliament-and-council-of-eu-announce-provisional); [Matheson, 29 Apr 2026](https://www.matheson.com/insights/psd3-and-psr-published-whats-changing-for-eu-payment-services/); [Arthur Cox](https://www.arthurcox.com/insights/psd3-and-psr-final-compromise-texts-published/); [Open Banking Tracker](https://www.openbankingtracker.com/guides/psd3-psr-readiness) [timing: 1 source] |
| "CCD2 applies ~Nov 2026" | **Confirmed: applies 20 Nov 2026, 23 days from today.** The transposition deadline of 20 Nov 2025 was missed widely. **I found no adopted Romanian transposing law**, only drafts. | [Abreu Advogados](https://abreuadvogados.com/en/conhecimento/publicacoes/new-rules-on-consumer-credit-in-the-eu-directive-2023/2225/); [Noerr](https://www.noerr.com/en/insights/act-implementing-the-consumer-credit-directive-2023-passed); [Puterea.ro](https://www.puterea.ro/?p=488492) |
| "AMLA direct supervision from 2028" | **Confirmed, and the process is already running.** National supervisors collected data by 15 Aug 2026. The provisional list of eligible entities was due by **end-Sept 2026**, so that date has passed. The selection itself happens in 2027. | [MNB relaying AMLA, 12 May 2026](https://www.mnb.hu/en/supervision/news/amla-takes-next-step-toward-2027-selection-of-entities-for-direct-supervision) |
| "CSRD ESG data collection from corporate borrowers" | **Narrowed.** Omnibus I, Directive (EU) 2026/470, was published 26 Feb 2026 and applies to companies with more than 1,000 employees and more than €450m turnover. A "value-chain cap" limits what in-scope companies, banks included, can demand from smaller firms. The EBA ESG risk guidelines still apply to banks from 11 Jan 2026. | [CMS](https://cms.law/en/lux/legal-updates/final-adoption-of-omnibus-i-directive-simplifying-csrd-and-csddd); [Latham](https://www.lw.com/esg-resource-hub/EU-Sustainability-Omnibus-Published-in-the-Official-Journal) |

Romania's Instant Payments Regulation deadlines (non-euro state):
- **9 Jan 2027:** receive euro instant payments; price parity.
- **9 Jul 2027:** send euro instant payments; VoP.

---

## 1. Timeline: passed vs. upcoming (as of 28 Oct 2026)

### Already passed (now business-as-usual workload)

| Date | Event | Source |
|---|---|---|
| 17 Jan 2025 | DORA applies, covering ICT incident reporting, register of information (RoI) and third-party risk. | [FMA Austria – DORA incidents](https://www.fma.gv.at/en/dora-ict-related-incidents/) |
| 9 Jan 2025 / 9 Oct 2025 | Euro area under the IPR: receive and price parity in January; send and **VoP** in October. | [ECB](https://www.ecb.europa.eu/paym/retail/instant_payments/html/instant_payments_regulation.en.html) |
| 11 Jan 2026 | EBA Guidelines on management of ESG risks apply (large institutions). | [Ganado via Legal500](https://www.legal500.com/firms/10225-ganado-advocates/c-malta/news-and-developments/guidelines-on-esg-risk-management-emphasize-integration-of-esg-risks-across-the-3-lines-of-defence); [EBA](https://www.eba.europa.eu/node/17625) |
| Feb–Mar 2026 | Second annual DORA register-of-information submission, with reference date 31 Dec 2025. Windows are set nationally. | [CSSF](https://www.cssf.lu/en/2026/02/dora-submission-timeframe-for-register-of-information-edesk-portal-open-as-of-11-february-2026/); [Simmons & Simmons (CBI)](https://www.simmons-simmons.com/en/publications/cmm25gctt002ctmikyc16b70w/irish-firms-submit-roi-to-central-bank-by-31-mar-2026) |
| 26 Feb / 18 Mar 2026 | Omnibus I (CSRD/CSDDD) published in the OJ, then in force. | [CMS](https://cms.law/en/lux/legal-updates/final-adoption-of-omnibus-i-directive-simplifying-csrd-and-csddd) |
| 23 Apr 2026 | **EU 20th Russia sanctions package** (Reg. 2026/506). Twenty more Russian banks are added to the transaction ban, making 70 in total. Third-country banks and payment agents are targeted, and the anti-circumvention tool is used for the first time. | [Matheson](https://www.matheson.com/insights/eus-20th-sanctions-package-against-russia/); [PayTechLaw](https://paytechlaw.com/en/20th-eu-sanctions-package-against-russia/); [JD Supra](https://www.jdsupra.com/legalnews/eu-adopts-20th-sanctions-package-3276894/) |
| 10 Jul 2026 | Deadline for AMLA to submit the final draft CDD RTS to the Commission. **I could not confirm that it was submitted.** | [HSF Kramer](https://www.hsfkramer.com/notes/fsrandcorpcrime/2026-posts/2026-aml-cft-consultations); [A&L Goodbody](https://www.algoodbody.com/insights-publications/amla-consults-on-draft-rts-on-cdd-measures-and-triggers-and-confirms-its-priorities-for-2026-to-2028) |
| 27 Jul 2026 | AI Act Digital Omnibus (Reg. 2026/1744) in force. | [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/) |
| 15 Aug / end-Sep 2026 | AMLA eligibility data collection closes; provisional list of eligible entities due. | [MNB/AMLA](https://www.mnb.hu/en/supervision/news/amla-takes-next-step-toward-2027-selection-of-entities-for-direct-supervision) |
| 17 Sep 2026 | Grizzly Research short report alleges RBI's Russian unit is a sanctions-evasion channel. RBI shares fall up to 9%. | [Reuters via Euronext](https://live.euronext.com/en/financial-news/raiffeisen-shares-slump-after-short-seller-grizzly-spotlights-russia-ties); [Meduza](https://meduza.io/en/news/2026/09/17/shares-in-raiffeisen-bank-international-fell-9-after-a-short-seller-accused-the-lender-of-helping-russia-evade-sanctions-the-bank-called-the-report-misleading-and-factually-wrong) |
| 22 Oct 2026 | Vienna court issues a final verdict allowing RBI to take over Rasperia's assets (Strabag stake). | [Bloomberg](https://www.bloomberg.com/news/articles/2026-10-22/raiffeisen-gets-court-sign-off-for-3-2-billion-russia-windfall); [Briefs](https://www.briefs.co/news/raiffeisen-clears-court-hurdle-toward-3-2-billion-windfall-t/) |

### Upcoming

| Date | Event | Source |
|---|---|---|
| 3 Nov 2026 | RBI Q3 2026 results [1 source] | [MarketScreener calendar](https://www.marketscreener.com/quote/stock/RAIFFEISEN-BANK-INTERNATI-6497717/calendar/) |
| **20 Nov 2026** | **CCD2 applies.** | [Abreu](https://abreuadvogados.com/en/conhecimento/publicacoes/new-rules-on-consumer-credit-in-the-eu-directive-2023/2225/); [Vixio](https://vixio.com/insights/pc-mapping-eu-legislation-directive-eu-20232225-consumer-credit) |
| 2 Dec 2026 | AI Act Art. 50(2) marking deadline for generative systems already on the market. | [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/) |
| Q4 2026 | Garanti BBVA Romania closing is expected. The H1 release said "early October"; **I found no closing announcement.** | [RBI Q1 2026 deck](https://www.rbinternational.com/content/dam/rbi/ho/investors/events-and-presentation/presentation-and-webcast/conference-call-presentations/2026-05-05%20Q1-Investor%20Presentation%20RBI.pdf.coredownload.pdf); [RBI H1 2026 release](https://www.raiffeisen.al/content/dam/rbi/retail/eu/al/about-us/news/2026-07-31%20Press%20Release%20H1.pdf.coredownload.pdf) |
| **9 Jan 2027** | **Romania (non-euro): IPR obligations to receive euro instant transfers and price parity.** | [ECB](https://www.ecb.europa.eu/paym/retail/instant_payments/html/instant_payments_regulation.en.html) |
| 11 Jan 2027 | EBA ESG guidelines apply to small and non-complex institutions. | [Legal500/Ganado](https://www.legal500.com/firms/10225-ganado-advocates/c-malta/news-and-developments/guidelines-on-esg-risk-management-emphasize-integration-of-esg-risks-across-the-3-lines-of-defence) |
| Feb 2027 | RBI Capital Markets Day with the new strategy [1 source, AI-generated summary] | [Quartr Q2 2026](https://quartr.com/events/raiffeisen-bank-international-ag-rbi-q2-2026_F9oKywSd) |
| 19 Mar 2027 | Omnibus I transposition deadline. | [CMS](https://cms.law/en/lux/legal-updates/final-adoption-of-omnibus-i-directive-simplifying-csrd-and-csddd) |
| ~Q1 2027 | Third DORA register-of-information submission (reference date 31 Dec 2026) [inference from the annual cycle]. | – |
| 2027 (whole year) | Garanti BBVA integration: **data migration and rebranding**, about €70m one-off cost. Legal merger expected Q4 2027. | [RBI Q1 2026 deck](https://www.rbinternational.com/content/dam/rbi/ho/investors/events-and-presentation/presentation-and-webcast/conference-call-presentations/2026-05-05%20Q1-Investor%20Presentation%20RBI.pdf.coredownload.pdf) |
| 2027 | AMLA selects up to 40 entities for direct supervision. | [MNB/AMLA](https://www.mnb.hu/en/supervision/news/amla-takes-next-step-toward-2027-selection-of-entities-for-direct-supervision); [Jones Day](https://www.jonesday.com/en/insights/2025/07/direct-supervisory-powers-of-the-new-european-antimoney-laundering-authority) |
| **9 Jul 2027** | **Romania: IPR obligations to send euro instant transfers and to offer VoP.** | [ECB](https://www.ecb.europa.eu/paym/retail/instant_payments/html/instant_payments_regulation.en.html) |
| **10 Jul 2027** | **AMLR (single rulebook) applies; AMLD6 general transposition deadline.** | [CSSF](https://www.cssf.lu/en/2024/06/the-new-aml-cft-regulation-the-sixth-aml-cft-directive-and-the-future-eu-aml-cft-supervisor/); [eucrim](https://eucrim.eu/news/new-anti-money-laundering-directive-amld-6/) |
| **2 Dec 2027** | **AI Act Annex III high-risk obligations, including creditworthiness assessment.** | [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/) |
| 2028 | AMLA direct supervision starts. Expected PSR application. Non-euro instant payments from national-currency accounts outside business hours due 9 Jun 2028. | [MNB/AMLA](https://www.mnb.hu/en/supervision/news/amla-takes-next-step-toward-2027-selection-of-entities-for-direct-supervision); [ECB](https://www.ecb.europa.eu/paym/retail/instant_payments/html/instant_payments_regulation.en.html) |

---

# PART A: RBI GROUP

## A1. Snapshot and leadership

- **Size (31 Mar 2026):** 18.6m customers, about 42,000 employees, about 1,300 branches, and 11 CEE markets served by subsidiary banks. ([RBI factsheet Q1 2026](https://www.rbinternational.com/content/dam/rbi/ho/home/rbi-group/about-us/RBI%20factsheet%20Q1%202026%20de.pdf.coredownload.pdf))
  - Subsidiary-bank markets in the EU: **Austria, Czechia, Slovakia, Hungary, Romania, Croatia.**
  - Non-EU subsidiary-bank markets: Albania, Bosnia and Herzegovina, Kosovo, Serbia, Ukraine, Russia.
- **Headcount:** the Q1 2026 deck shows 42,154 employees, down 0.6% from 42,425. ([Q1 2026 deck](https://www.rbinternational.com/content/dam/rbi/ho/investors/events-and-presentation/presentation-and-webcast/conference-call-presentations/2026-05-05%20Q1-Investor%20Presentation%20RBI.pdf.coredownload.pdf))
- **New CEO:** Michael Höllerer succeeded Johann Strobl on **1 Jul 2026**. The appointment was announced 17 Dec 2025, and Bloomberg framed it as leaving the "Russia dilemma" to the successor. The H1 2026 release, dated 31 Jul 2026, quotes him as CEO. ([RBI ad hoc](https://www.rbinternational.com/en/investors/news/ad-hoc-releases/appointment-ceo.html); [Bloomberg](https://www.bloomberg.com/news/articles/2025-12-17/raiffeisen-taps-ex-finance-chief-as-ceo-amid-russia-dilemma); [H1 2026 release](https://www.raiffeisen.al/content/dam/rbi/retail/eu/al/about-us/news/2026-07-31%20Press%20Release%20H1.pdf.coredownload.pdf))
  - Höllerer: *"In the coming months, we will work intensively on our new strategy, which will have a clear focus on growth and profitability."*
  - New CFO: Kamila Makhmudova. CRO: Hannes Mösenbacher.

## A2. Regulatory and compliance issues

### A2.1 ECB pressure on the Russia business
- **Apr 2024 (RBI ad hoc):** RBI expected an ECB requirement under which Russian **loans to customers fall "significantly by 2026 (up to 65 per cent vs. Q3/2023)", "as would international payments originating from Russia."** ([RBI ad hoc 18 Apr 2024](https://www.rbinternational.com/en/investors/news/ad-hoc-releases/ECB_reduction_RU.html))
- **Jul 2024:** RBI said it was accelerating the Russia wind-down on the ECB's order. ([BNN Bloomberg](https://bnnbloomberg.ca/business/2024/07/30/raiffeisen-says-its-accelerating-russia-wind-down-on-ecb-order))
- **Final ECB decision terms: unverified.** I found only the draft and press reporting on them.
- **Progress per RBI's Q1 2026 deck:** ([Q1 2026 deck](https://www.rbinternational.com/content/dam/rbi/ho/investors/events-and-presentation/presentation-and-webcast/conference-call-presentations/2026-05-05%20Q1-Investor%20Presentation%20RBI.pdf.coredownload.pdf))
  - Russian loans to customers down **78% in RUB terms since Feb 2022**; €2.5bn excluding C-accounts.
  - Deposits down 41%.
  - "Restrictions on outgoing FX payments **fully implemented**."
  - Loans now limited to contractual amortisation, with few exceptions on a "pre-approved list of large and internationally active companies."
  - €1.95bn sits in blocked dividends and coupons in C-accounts.
- **H1 2026:** "Further business reduction in Russia – all restrictions to remain in place." ([H1 2026 release](https://www.eqs-news.com/news/corporate/rbi-semi-annual-financial-report-2026-consolidated-profit-excl-russia-up-25/afc6c8b9-3610-4aed-b26b-ae902ae376aa_en))
- **Why it matters for operations [inference]:** a "pre-approved list" of permitted clients, plus payment restrictions, is rules-based gatekeeping. Every exception needs documented justification. That is a natural fit for a rules agent that flags and explains exceptions.

### A2.2 US scrutiny (OFAC / US Treasury)
- **Jan 2023: OFAC Request for Information.** RBI described it as being about "payments business and related processes" in light of developments in Russia and Ukraine. Press reported questions on Russia, occupied Donbas and Syria, and on specific clients. ([RBI IR release](https://www.rbinternational.com/en/investors/news/ir-releases/ofac.html); [Compliance Week](https://complianceweek.com/regulatory-enforcement/raiffeisen-confirms-ofac-probe-into-russia-ukraine-business/32700.article))
- **May 2024: Treasury warning letter.** Deputy Secretary Adeyemo warned that RBI's US-system access could be restricted over its Russia dealings. ([Reuters explainer via CNBC Africa](https://cnbcafrica.com/wire/638374); [Business Recorder](https://www.brecorder.com/news/amp/40227137))
- **Never acted on:** Reuters in Sept 2026 said the threat was "never carried out." ([Reuters via Euronext](https://live.euronext.com/en/financial-news/raiffeisen-shares-slump-after-short-seller-grizzly-spotlights-russia-ties))

### A2.3 Austrian FMA AML findings (what capability gaps the regulator named)

| Date | Finding | Source |
|---|---|---|
| **30 Mar 2018** | **€2.748m fine**, then the largest in Austrian history. Grounds: "**inadequate checking of the identity of beneficial owners**" and **failure to regularly update documents** needed to understand ownership/control structures of **high-risk customers**. Triggered by the Panama Papers. Reportedly upheld by the Federal Administrative Court (BVwG) [1 source]. | [Kyiv Post](https://www.kyivpost.com/business/raiffeisen-slapped-2-7-million-euro-fine-lack-money-laundering-controls.html); [Leadersnet](https://www.leadersnet.at/news/38506,raiffeisenbank-international-droht-rekordstrafe.html) |
| **Jan–Feb 2024** | FMA administrative proceeding on **know-your-customer obligations** for payments involving **three clients, 2017–2020**. Russia-linked, per Reuters sources (Cyprus Confidential). | [Economedia/Reuters](https://economedia.ro/austria-raiffeisen-bank-investigata-pentru-deficiente-privind-combaterea-spalarii-banilor.html); [ORF](https://orf.at/stories/3349522/); [RBI press release](https://www.rbinternational.com/en/raiffeisen/media-hub/press-releases/2024/fma-administrative-proceeding.html) |
| **28 Jun 2024** | **€2.07m fine.** RBI was "unable to prove the adequacy of the AML/CFT checks" performed by **two correspondent (respondent) banks in third countries**. Unnamed sources say Cuba and Bahrain. RBI appealed to the BVwG; **I found no ruling.** I could not confirm how this fine relates to the Feb 2024 proceeding. | [FMA](https://www.fma.gv.at/en/sanktion-gegen-raiffeisen-bank-international-ag/); [FStech](https://www.fstech.co.uk/fst/Raiffeisen_Bank_Fined_2m_For_Money_Laundering_Lapses.php); [Capital.ro](https://www.capital.ro/amenda-record-in-austria-pentru-raiffeisen-bank-ce-acuzatii-au-fost-aduse-bancii.html) |

### A2.4 Rasperia / Strabag litigation
- **20 Jan 2025:** a Kaliningrad court ordered AO Raiffeisenbank (Russia) to pay about **€2.044bn** to Rasperia, a Deripaska-linked Strabag shareholder. RBI booked a provision. ([RBI ad hoc](https://www.rbinternational.com/en/investors/news/ad-hoc-releases/rasperia-court-decision.html); [Bloomberg Law](https://news.bloomberglaw.com/banking-law/raiffeisen-books-provision-after-2-billion-russian-court-order))
- **24 Apr 2025:** the appeal court upheld the ruling. ([RBI release](https://www.rbinternational.com/en/raiffeisen/media-hub/press-releases/2025/rasperia-second-instance-verdict.html))
- **18 Dec 2025:** "Rasperia II" ruling for **€339m**. ([RBI IR release](https://www.rbinternational.com/en/investors/news/ir-releases/rasperia-2-verdict.html))
- **Oct 2025:** Austria held up the EU's 19th sanctions package to seek a carve-out letting Rasperia's frozen Strabag shares go to RBI as compensation. Other member states resisted, and the carve-out reportedly failed [1 source for "failed": vienna.at]. ([Bloomberg](https://www.bloomberg.com/news/articles/2025-10-08/austria-stalls-russia-sanctions-over-raiffeisen-compensation); [Euronews](https://www.euronews.com/my-europe/2025/10/14/austrian-bank-takes-centre-stage-as-eu-pushes-new-sanctions-on-russia); [Vienna.at](https://www.vienna.at/?p=10044644))
- **22 Oct 2026:** the Vienna Regional Court for Civil Matters issued a **final verdict** allowing RBI to take over Rasperia's assets, about **€3.15–3.2bn**. These include a 24% Strabag stake and frozen dividends. **Unfreezing the sanctioned shares still requires Austrian authorisation.** ([Bloomberg](https://www.bloomberg.com/news/articles/2026-10-22/raiffeisen-gets-court-sign-off-for-3-2-billion-russia-windfall); [Briefs](https://www.briefs.co/news/raiffeisen-clears-court-hurdle-toward-3-2-billion-windfall-t/); [Logos Press](https://logos-pres.md/en/news/a-court-in-vienna-has-ruled-that-e3-15-billion-is-to-be-paid-out-from-russias-frozen-assets/))
- **Relevance:** this is a sanctions-licensing problem. The group must document and justify every movement of frozen assets.

### A2.5 Grizzly Research short report (17 Sep 2026)
- **Allegations:** about **$1.19bn of trade with Russia** routed through the Russian subsidiary, including **$106.75m of goods used in advanced weaponry**. Grizzly also called on regulators to review SWIFT access. ([Liga.net](https://finance.liga.net/en/bank/news/raiffeisen-bank-stock-drops-amid-accusations-of-facilitating-russian-sanctions-evasion); [BankTrack](https://www.banktrack.org/article/calls_for_immediate_investigation_and_precautionary_measures_following_allegations_of_sanctionsevasion_through_raiffeisen_s_russian_branch))
- **RBI's response:** it "categorically denies the allegations". It said the report named companies that were never customers, and that its compliance systems had been repeatedly audited. ([Reuters via Euronext](https://live.euronext.com/en/financial-news/raiffeisen-shares-slump-after-short-seller-grizzly-spotlights-russia-ties); [Global Banking & Finance](https://www.globalbankingandfinance.com/austrias-rbi-grizzly-take-business-contains-wrong-misleading/))
- **Analyst view:** Bloomberg Intelligence said Grizzly may be exaggerating the risk. ([Liga.net](https://finance.liga.net/en/bank/news/raiffeisen-bank-stock-drops-amid-accusations-of-facilitating-russian-sanctions-evasion))
- **No regulatory action** tied to the report had been found as of this research.
- **Relevance [inference]:** the allegation concerns *trade* (goods). The defence, and the daily control, rests on **trade-document screening**: invoices, HS codes and counterparties checked against sanctions lists and high-priority goods lists. This is exactly document-plus-rules work.

### A2.6 Regulator-flagged gaps mapped to 2026–27 obligations and agent tasks

This table is the core "domain understanding" evidence.

| Who flagged it (date) | Capability gap named | Matching 2026–27 obligation | Agent task (demo-able on synthetic data) |
|---|---|---|---|
| FMA, Mar 2018 | Beneficial owner (BO) identity checks; ownership documents for high-risk clients not regularly updated | **AMLR Art. 26(2):** refresh customer information at least every **1 year (higher risk)** or **5 years (others)**. **AMLR (per CSSF summary):** BO threshold **25%**; report **BO-register discrepancies within 14 days**. Applies 10 Jul 2027. | Read a corporate KYC file, rebuild the ownership tree, compare with the register extract, flag a discrepancy or stale document, and draft the discrepancy report. |
| FMA, Jan–Jun 2024 | KYC on specific clients' payments; correspondent banks' AML checks not evidenced | AMLR CDD and EDD (including high-risk third countries, per CSSF summary); AMLA RTS on CDD. Correspondent-banking due diligence is the existing obligation the FMA enforced under the Austrian FM-GwG. ([FMA](https://www.fma.gv.at/en/sanktion-gegen-raiffeisen-bank-international-ag/)) | Correspondent-bank due-diligence questionnaire (Wolfsberg-style) checker: completeness, red flags, missing evidence, then escalate. |
| OFAC RFI 2023; Treasury letter 2024; ECB Russia requirements; Grizzly 2026 | Russia exposure, payment flows, sanctions circumvention | EU 20th package (Apr 2026): 70 banned Russian banks, third-country banks, payment agents. IPR Art. 5d: daily screening of the customer base. | Alert triage: match a payment or trade document against lists, decide true or false positive with written rationale, and route to a human. |
| ECB SREP 2025 (sector-wide) | Operational risk is the weakest SREP area; ICT and third-party gaps; RDARR (risk data) deficiencies | DORA RoI and incident reporting; ECB on-site campaigns; RDARR escalation | Reconcile a contract inventory against the RoI; classify an incident against thresholds; reconcile report data. |

## A3. Strategy: cost, efficiency, AI

### Costs and targets

| Metric | Value | Source |
|---|---|---|
| FY2025 cost/income (excl. Russia) | **53.1%** (2024: 52.5%) | [RBI prelim FY2025](https://www.rbinternational.com/en/raiffeisen/media-hub/press-releases/2026/preliminary-results-2025.html); [OTS](https://www.ots.at/presseaussendung/EQS_20260130_EQS0002/eqs-news-consolidated-profit-excluding-russia-above-14-billion-euros) |
| 2026 guidance, **Jan 2026** | General administrative expenses ~€3.6bn; cost/income ~52.5% | same |
| H1 2026 actual | Consolidated profit €708m (+25%); cost/income **52.2%**; general administrative expenses €1,790m | [EQS H1 2026](https://www.eqs-news.com/news/corporate/rbi-semi-annual-financial-report-2026-consolidated-profit-excl-russia-up-25/afc6c8b9-3610-4aed-b26b-ae902ae376aa_en) |
| 2026 guidance, **Jul 2026** | General administrative expenses **~€3.8bn**; cost/income **~55%** | [H1 2026 release](https://www.raiffeisen.al/content/dam/rbi/retail/eu/al/about-us/news/2026-07-31%20Press%20Release%20H1.pdf.coredownload.pdf) |
| Medium term | Return on equity ≥13%, excluding Russia and **excluding provisions and legal cost for Polish FX loans** | same |

- **The guidance moved from Jan to Jul 2026, but no source explains why.** Do not attribute the change to M&A.
- **Not found (asked for in the brief):**
  - no announced group FTE-reduction programme
  - no published medium-term cost/income target, only RoE ≥13% and the 2026 guidance
  - new targets are deferred to the strategy review and the Feb 2027 Capital Markets Day [1 source: [Quartr](https://quartr.com/events/raiffeisen-bank-international-ag-rbi-q2-2026_F9oKywSd)]
  - headcount is drifting down slightly (42,425 to 42,154 in Q1 2026) with no stated programme
- **Polish FX loans:** RBI excludes their legal cost from its target, a sign of an ongoing mass-litigation load. Sector-wide there were about 120,500 active CHF lawsuits at Polish banks in Q3 2024 [secondary]. ([GGI](https://www.ggi.com/news/litigation-&-disputes/disputes-over-swiss-franc-mortgages))

### M&A creates 2027 operations work
- **Garanti BBVA Romania:** €591m purchase, signed Mar 2026. RBI's deck lays out the plan:
  - **2027 integration: "Data migration and rebranding"**, one-off cost about **€70m, mainly in 2027**
  - legal merger expected Q4 2027
  - about 200,000 new active customers
  - synergies visible from 2028 (about €90m in 2028, rising to €130m in 2030)
  - Sources: [RBI Q1 2026 deck, p.5](https://www.rbinternational.com/content/dam/rbi/ho/investors/events-and-presentation/presentation-and-webcast/conference-call-presentations/2026-05-05%20Q1-Investor%20Presentation%20RBI.pdf.coredownload.pdf); [RBI ad hoc](https://www.rbinternational.com/en/investors/news/ad-hoc-releases/acquisition-romania.html)
  - This fills the gap noted in file 01 §5.8 ("no source describes the integration plan").
- **Addiko:** voluntary tender offer, with about €75m integration cost in 2027–28. ([Q1 2026 deck, p.6](https://www.rbinternational.com/content/dam/rbi/ho/investors/events-and-presentation/presentation-and-webcast/conference-call-presentations/2026-05-05%20Q1-Investor%20Presentation%20RBI.pdf.coredownload.pdf))
- **[inference]** Migrating about 200,000 customers means reconciling balances and products and remediating KYC files under the new owner's standards. This happens in the same year AMLR applies (Jul 2027).

### AI at RBI: what already exists (use it as a fit signal and as a duplication warning)

**RBI's own careers page** ([AI at RBI](https://www.rbinternational.com/en/raiffeisen/career/topics/ai-at-rbi.html)) [primary, self-reported]:
- **160+ AI use cases in production** (risk, credit, marketing, HR, finance, customer-facing)
- **20,000+ RBI GPT users**; RBI GPT has been live since 2023
- **1,700+ AI Pioneers** and **3,500+ Data Science Academy alumni**
- **300+ GitHub Copilot engineers**
- Tools listed: RBI GPT, GitHub Copilot, **Microsoft 365 Copilot, Claude Code**, Mobrix AI, Databricks, Appian, Curie, MAIA
- Governance: the AI Centre of Excellence runs a framework (model validation, continuous risk assessment) aligned with the **EU AI Act**: "explainable, auditable, and compliant"
- AI in Finance Award 2025

Named use cases relevant to our brief:
- **AI Media Monitoring:** overnight multilingual news screening of more than 10,000 corporate and institutional clients. Used by 300+ staff; saves at least **1,000 analyst-days a year**. ([careers page](https://www.rbinternational.com/en/raiffeisen/career/topics/ai-at-rbi.html))
- **ESG Criticality Checks:** an AI assistant reads annual and sustainability reports for ESG compliance in lending decisions, **with a full audit trail**. About **2,500 limit applications a year at Head Office**, roughly 5x that group-wide. Rolled out early 2026. ([careers page](https://www.rbinternational.com/en/raiffeisen/career/topics/ai-at-rbi.html))
- **Risk Assistant (CRO Mösenbacher):** ([IMD, 30 Sep 2026](https://www.imd.org/ibyimd/artificial-intelligence/de-risking-risk-management-with-ai-how-rbi-built-for-quality-and-speed/))
  - drafts corporate credit-rating reports; about 20 analysts previously produced about 8,000 a year by hand
  - drafting time fell from **8h to 3h** (the article also says "more than a day", so the baseline is unclear)
  - about 6,000 reports a year group-wide
  - **extended to automated document verification, fraud detection and KYC**
  - headcount was kept stable, with "humans do the thinking" framing
  - Mösenbacher notes models "like Claude" handle structured data well
- **RBI ChatGPT on Azure OpenAI:** 2,000 users grew to 20,000+. Use cases include **reconciliation reporting support** and answering regulatory questions. ([Microsoft customer story, Jan 2025](https://microsoft.com/en/customers/story/21406-raiffeisen-bank-international-azure)) [vendor-authored]
- **AI Pioneer programme:** 200 staff spending 20% of their time on AI, later "AI Ambassadors" in every department. An AI Committee oversees AI Act compliance. ([MEXC/press interview](https://www.mexc.com/news/225265)) [1 source]
- **Deepfake-voice fraud detection:** in-house AI detects synthetic voices trying to pass biometric checks. ([Börse Express, 5 Jan 2026](https://www.boerse-express.com/news/articles/raiffeisen-bank-aktie-ki-gegen-ki-854503)) [1 source]

**Implications for the team [inference]:**
1. RBI is an *experienced* AI buyer with a governance function, so a demo must show audit trail, human-in-the-loop and explainability, or it looks naïve.
2. **Don't rebuild** ESG document checks or credit-rating report drafting; RBI has them.
3. The **open gaps** where nothing public exists are:
   - AMLR periodic-review and BO-discrepancy handling
   - sanctions/trade alert triage
   - CCD2 file validation
   - garnishment (poprire) analysis
   - DORA contract and register reconciliation
   - **Garanti data-migration reconciliation**

## A4. Operational incidents [low confidence]
- **Outages:** I found no IT outage at RBI in reputable press for 2025–26. Third-party open-banking monitors (Tink via IsDown) logged several 2026 incidents. These are automated estimates.
  - Austria: authentication outage of about 1h on 28 Jul 2026; another on 24 Sep 2026
  - Raiffeisenbank Czech Republic: payment-initiation errors 12–17 Sep 2026 and 24 Sep 2026
  - Sources: [IsDown AT 1](https://isdown.app/status/tink-austria/incidents/629832-raiffeisen-bank-international-outage); [IsDown AT 2](https://isdown.app/status/tink-austria/incidents/659911-raiffeisen-bank-international-outage); [IsDown CZ](https://isdown.app/status/tink-czechia/incidents/653483-raiffeisenbank-major-outage)
- **Fraud pressure:** the clearest signal is RBI's own deepfake-voice detection (A3). Romania-specific fraud is in file 01.
- **Use for the pitch:** DORA requires each such incident to be **classified** against RTS thresholds and, if major, reported within 4h of classification and no later than 24h from awareness (B5). That is a rules job.

---

# PART B: REGULATION CREATING REPETITIVE DOCUMENT, DATA AND RULES WORK

For each rule below: what banks must do repeatedly, dates and status, why it hurts, and how an agent fits.

## B1. EU AML package: AMLR, AMLD6, AMLA (plus Romania)

**Instruments:**
- AMLR: Regulation (EU) 2024/1624 ([EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1624/oj/eng); not retrievable here)
- AMLD6: Directive (EU) 2024/1640
- AMLA Regulation: (EU) 2024/1620. AMLA has applied since 1 Jul 2025 and is seated in Frankfurt.
- Source: [CSSF](https://www.cssf.lu/en/2024/06/the-new-aml-cft-regulation-the-sixth-aml-cft-directive-and-the-future-eu-aml-cft-supervisor/)

**What banks must do repeatedly under the AMLR (applies 10 Jul 2027):**
- **Periodic refresh (Art. 26(2)).** The interval between customer-information updates must be risk-based and must not exceed **1 year for higher-risk** or **5 years for all other** customers. ([Springlex, Art. 26](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-26/))
- **Event-driven refresh (Art. 26(3)).** Update on any change in the customer's relevant circumstances, and whenever the bank must contact the customer about beneficial-owner (BO) information. (same source)
- **BOs** ([CSSF](https://www.cssf.lu/en/2024/06/the-new-aml-cft-regulation-the-sixth-aml-cft-directive-and-the-future-eu-aml-cft-supervisor/)):
  - threshold **25%** (member states may go down to 15%)
  - control by other means is assessed in parallel with ownership
  - senior managing officials are only a fall-back
  - keep records of the identification steps, and a **justification statement** if no BO is found
- **BO-register discrepancies** must be reported **within 14 calendar days**. (CSSF)
- **Screening:** check customers *and BOs* against targeted financial sanctions. For legal entities, include persons holding more than 50% or controlling them. (CSSF)
- **Enhanced due diligence (EDD)** applies to:
  - high-net-worth clients (total wealth above €50m, assets under management above €5m)
  - high-risk third countries
  - cross-border correspondent relationships of crypto-asset service providers (the new point in the CSSF summary)
  - Source: CSSF
- **Other:** CDD extends to **virtual IBANs**; an EU-wide **cash limit of €10,000**. (CSSF)

**AMLD6** ([eucrim](https://eucrim.eu/news/new-anti-money-laundering-directive-amld-6/); [Comsure](https://www.comsuregroup.com/news/18-eu-states-miss-beneficial-ownership-access-deadline-aml-programmes-now-run-on-a-split-map/)):
- The general transposition deadline is 10 Jul 2027.
- Register and BO-access articles have earlier deadlines (2025/2026). Sources conflict on the exact dates, and 18 member states reportedly missed the BO-access deadline.
- Registers must follow up reported discrepancies [1 source for the 30-working-day detail].

**AMLA:**
- Direct supervision of **up to 40** high-risk cross-border groups **from 2028**. Selection takes place in 2027.
- Eligibility: operating in **at least 6 member states**, then selection based on residual-risk scoring.
- These criteria come from law-firm secondary sources: [Jones Day](https://www.jonesday.com/en/insights/2025/07/direct-supervisory-powers-of-the-new-european-antimoney-laundering-authority); [Freshfields](https://www.freshfields.com/en/our-thinking/blogs/risk-and-compliance/will-you-be-directly-supervised-by-amla-draft-rts-on-the-selection-of-obliged-102k383).
- Data collection for eligibility ended 15 Aug 2026; the provisional list was due end-Sept 2026. ([MNB/AMLA](https://www.mnb.hu/en/supervision/news/amla-takes-next-step-toward-2027-selection-of-entities-for-direct-supervision))
- The selection standards were finalised in Jul 2026, pending Commission adoption. ([FinTech Global](https://fintech.global/2026/07/27/amla-finalises-standards-ahead-of-direct-supervision-era/))
- The **CDD RTS** consultation closed 8 May 2026, and the final draft was due to the Commission by 10 Jul 2026. Submission is unconfirmed. ([HSF Kramer](https://www.hsfkramer.com/notes/fsrandcorpcrime/2026-posts/2026-aml-cft-consultations))

**Is RBI likely in AMLA scope? [inference]**
- RBI has subsidiary banks in **6 EU member states** (AT, CZ, SK, HU, RO, HR) per its [Q1 2026 factsheet](https://www.rbinternational.com/content/dam/rbi/ho/home/rbi-group/about-us/RBI%20factsheet%20Q1%202026%20de.pdf.coredownload.pdf). The Addiko deal would add Slovenia. RBI therefore appears to meet the **geographic eligibility** test.
- **Eligibility is not selection.** Selection depends on residual-risk scores, which are not public.
- The Russia history plus two FMA AML fines make RBI a plausible candidate. **No source names RBI as a candidate.**

**Romania:**
- **Law 86/2025** (in force 26 May 2025) amends AML Law 129/2019. ([BPV Grigorescu](https://bpv-grigorescu.com/latest/publications/legal-amendments-on-preventing-and-combating-money-laundering-and-terrorism-financing)) [1 source] Changes include:
  - risk-based KYC refresh of existing higher-risk customers, considering "materiality" (when KYC was last done)
  - collecting legal entities' effective headquarters
  - PEP status lasting up to 2 years after leaving office
  - pre-launch risk assessment of new products and technology
  - records sufficient to **reconstruct** transactions
- **MONEYVAL** adopted its 2nd enhanced follow-up report on Romania at the 26–29 May 2026 plenary. Romania **stays in enhanced follow-up**; "shortcomings persist." ([FATF/MONEYVAL](https://www.fatf-gafi.org/en/publications/Mutualevaluations/romania-fur-2026.html); [Romania Insider](https://www.romania-insider.com/council-europe-romania-anti-money-laundering-measures-2026))
- The ONRC BO-discrepancy reporting procedure in Romania is covered in file 01 §5.3.

**Why it's painful [inference]:**
- Every existing customer must be brought to the new standard on a risk-based clock.
- Corporate files mix registry extracts, shareholder agreements, IDs and trust deeds in several languages.
- BO chains cross borders.
- Discrepancies trigger a 14-day reporting clock.

**Agent fit: very high.** The task is document extraction, a deterministic rulebook (25%/50% thresholds, 1y/5y clocks, EDD triggers) and a clear exception output.

## B2. Sanctions screening and Russia exposure (EU packages and IPR Art. 5d)

- **20th package (23 Apr 2026, Reg. 2026/506)** ([Matheson](https://www.matheson.com/insights/eus-20th-sanctions-package-against-russia/); [PayTechLaw](https://paytechlaw.com/en/20th-eu-sanctions-package-against-russia/)):
  - transaction ban extended to **70** Russian banks
  - third-country banks added (Kyrgyzstan, Laos, Azerbaijan)
  - **ban on transactions with payment agents** facilitating Russia-related transfers
  - first use of the anti-circumvention tool
- **Instant Payments Regulation, Art. 5d:** PSPs offering instant credit transfers must check **at least once per calendar day** whether their payment service users are subject to EU targeted financial sanctions. They must not screen individual instant transfers against EU lists. ([ECB](https://www.ecb.europa.eu/paym/retail/instant_payments/html/instant_payments_regulation.en.html); [Bird & Bird](https://www.twobirds.com/en/insights/2024/global/instant-payments-regulation); [Regulation Tomorrow (DNB)](https://www.regulationtomorrow.com/2025/02/instant-payments-regulation-an-update-from-dnb/))
  - Several sources also say re-screening must happen **immediately** when the lists change [secondary]. ([Hogan Lovells](https://hlc.com/en/publications/the-instant-payment-regulation-and-eu-restricted-party-screening))
  - **I did not confirm the date from which Art. 5d binds non-euro PSPs such as Romania.**
- **Why it's painful:** every new package and list update means re-screening the whole customer base, and false positives pile up. Trade finance additionally needs document-level checks of goods against controlled-goods lists.
- **Agent fit: high** for **alert triage**: compare the hit with customer data, write a rationale, recommend close or escalate. Matching itself is commodity software.

## B3. Instant Payments Regulation and Verification of Payee: Romania's non-euro clock

**Deadlines for non-euro member states** ([ECB IPR page](https://www.ecb.europa.eu/paym/retail/instant_payments/html/instant_payments_regulation.en.html)):

| Obligation | Deadline |
|---|---|
| Receive euro instant transfers | **9 Jan 2027** |
| Price parity | **9 Jan 2027** |
| Send euro instant transfers | **9 Jul 2027** |
| **VoP** | **9 Jul 2027** |
| Instant transfers from national-currency accounts outside business hours | 9 Jun 2028 |
| Payment/e-money institutions | 9 Apr 2027 (receive), 9 Jul 2027 (send) |

**What VoP requires (Art. 5c):**
- Before any euro credit transfer (instant **and** standard), match the IBAN against the payee name.
- Return **"match" / "close match" / "no match" / "other"** (ECB wording).
- The service is free to the payer.
- Sources: ([ECB](https://www.ecb.europa.eu/paym/retail/instant_payments/html/instant_payments_regulation.en.html); [Osborne Clarke](https://www.osborneclarke.com/insights/what-are-key-obligations-and-timelines-eu-instant-payments-regulation))

**Romania:**
- **RON:** no source shows VoP applying to RON. The existing **SANB** name-display service (ARB with Transfond) is optional and limited to participating banks. ([Economedia](https://economedia.ro/proiect-pilot-clientii-bancilor-din-romania-vor-putea-verifica-identitatea-beneficiarului-real-al-platii.html))
- **Late national framework:** Romania was late notifying penalties under the IPR. A Ministry of Finance draft emergency ordinance would make the BNR supervisor, with fines up to 500,000 lei. ([Puterea.ro](https://www.puterea.ro/?p=529223)) [1 source, undated]

**Why it's painful:**
- "Close match" and "no match" results create a new stream of customer queries, overrides and fraud disputes.
- Daily sanctions screening of the full customer base replaces per-transaction screening.

**Agent fit: medium-high** for exception handling: explain a close match, check for an alias or trading name in KYC data, and route a suspected impersonation case. The VoP matching itself is infrastructure.

## B4. PSD3 / PSR: fraud liability (later, but shapes 2027 design)

- **Status:** provisional deal **27 Nov 2025**; final compromise texts **23 Apr 2026**; no OJ publication found. The PSR applies about 21 months after entry into force [1 source]. ([Hogan Lovells](https://www.hoganlovells.com/en/publications/final-texts-for-psd3-and-psr-awaited-as-european-parliament-and-council-of-eu-announce-provisional); [Arthur Cox](https://www.arthurcox.com/insights/psd3-and-psr-final-compromise-texts-published/); [Open Banking Tracker](https://www.openbankingtracker.com/guides/psd3-psr-readiness))
- **Content as reported** ([William Fry](https://www.williamfry.com/knowledge/psr-psd3-eu-payment-services-legislation-is-agreed/); [Finologee](https://finologee.com/psr-what-the-provisional-political-agreement-signals-for-psps/)):
  - The PSP must **refund in full** where a consumer was manipulated by someone **impersonating the PSP**, provided the consumer reported it to the police and the PSP.
  - **Online platforms** become liable to PSPs if they fail to remove reported fraudulent content.
  - PSPs must share fraud information and run IBAN/name checks.
  - Liability falls on PSPs that lack adequate anti-fraud mechanisms.
- **Agent fit [inference]:** later, a refund-claim triage agent (evidence checklist: police report, timing, channel attribution). **Low urgency for a 2026 demo.**

## B5. DORA (applies 17 Jan 2025)

**Recurring tasks:**
- **Incident classification and reporting** ([FMA Austria](https://www.fma.gv.at/en/dora-ict-related-incidents/); [AKD](https://www.akd.eu/insights/dora-update-adoption-of-additional-technical-standards)):
  - classify every ICT incident against RTS criteria (clients affected, duration, data loss, critical functions)
  - **initial report within 4h of classification as major, and no later than 24h after awareness**
  - **intermediate report within 72h**
  - **final report within 1 month**
- **Register of information (RoI):** an annual submission listing all ICT third-party contractual arrangements. The 2026 cycle had reference date 31 Dec 2025, with national windows in Feb–Mar 2026. ([CSSF](https://www.cssf.lu/en/2026/02/dora-submission-timeframe-for-register-of-information-edesk-portal-open-as-of-11-february-2026/))
- **Critical ICT third-party providers:** the ESAs designated **19 providers on 18 Nov 2025** (e.g., AWS, Google Cloud, Microsoft, Oracle, SAP, Deutsche Telekom). The list is updated annually. ([EIOPA/ESAs](https://www.eiopa.europa.eu/european-supervisory-authorities-designate-critical-ict-third-party-providers-under-digital-2025-11-18_en); [Morgan Lewis](https://www.morganlewis.com/de/blogs/sourcingatmorganlewis/2025/11/dora-eu-regulators-announce-list-of-critical-ict-third-party-providers); [PayTechLaw](https://paytechlaw.com/en/esas-publish-list-of-critical-ict-third%E2%80%91party-providers/))
- **Contract reviews:** contracts must contain DORA-mandated clauses (Art. 30). [Regulation text not re-fetched; verify on [EUR-Lex 2022/2554](https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng).]
- **ECB lens:** in the 2025 SREP, operational risk was the weakest category (ICT governance, cyber, third-party). The ECB plans **on-site campaigns on cybersecurity and third-party risk management** and escalation on **RDARR** risk-data deficiencies under the 2026–28 priorities. ([ECB Supervision blog, 22 Jan 2026](https://www.bankingsupervision.europa.eu/press/blog/2026/html/ssm.blog20260122~7fdd534c3c.en.html); [KPMG](https://kpmg.com/xx/en/our-insights/risk-and-regulation/osis-update-for-2026.html); [A&O Shearman](https://finreg.aoshearman.com/ecb-srep-review-findings-and-supervisory-priorities-for-20262028))

**Agent fit: medium-high.**
- Clause-by-clause contract check against the Art. 30 checklist.
- Reconcile the contract repository against the RoI (missing LEIs, wrong criticality flags).
- First-pass incident classification with a human sign-off.

## B6. EU AI Act: a constraint on *our* design as well as a pressure

- **Status:** Annex III high-risk, including **creditworthiness and credit scoring of natural persons** (Annex III 5(b)), applies from **2 Dec 2027** via Reg. 2026/1744. AI used *only* to detect financial fraud is carved out. ([AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/); [Knowlee/secondary](https://www.knowlee.ai/blog/ai-act-financial-services-compliance))
- **Deployer duties for high-risk systems (Art. 26)** ([Art. 26](https://artificialintelligenceact.eu/article/26/); [VDE](https://www.vde.com/topics-en/artificial-intelligence/blog/obligation-deployers)):
  - assign **human oversight** to competent, trained people with authority
  - **keep the system's logs for at least 6 months**
  - inform affected persons
- **Art. 86:** a right to an explanation of individual decisions. ([AI Act Blog – EBA mapping](https://www.aiactblog.nl/en/posts/eba-ai-act-mapping-financiele-sector))
- **AI literacy (Art. 4):** softened by the Omnibus to "take measures to support" literacy. ([AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/))
- **Art. 6(3) derogation.** An Annex III system is **not** high-risk if it poses no significant risk of harm and meets one of four conditions. It is "always" high-risk if it **profiles natural persons**. ([Art. 6](https://artificialintelligenceact.eu/article/6/)) The four conditions:
  - (a) it performs a narrow procedural task
  - (b) it improves the result of a previously completed human activity
  - (c) it detects deviations from prior decision patterns, with human review
  - (d) it performs a **preparatory task** to an Annex III assessment
- **Human oversight does not exempt a system.** Art. 26 oversight is an *obligation of* high-risk systems, not a way out of that status. A system that scores or ranks consumers' creditworthiness is high-risk from 2 Dec 2027 even if a human signs off.
- **Design implications for the hackathon agent [inference]:**
  1. Scope the agent as a **document-completeness and prohibited-data checker** for credit files. This is arguably a narrow procedural or preparatory task under Art. 6(3)(a)/(d). **Do not** let it score, rank or profile applicants. AML/KYC, sanctions, garnishment and DORA use cases are not listed in Annex III 5(b) at all.
  2. Write an **immutable decision log** (inputs, rules fired, model output, reviewer, timestamp) with at least 6 months retention.
  3. Show **rule-level explanations** for every flag.
  4. Use an explicit **human approve/override** step. This matches RBI's own "explainable, auditable" AI governance (A3).

## B7. Consumer Credit Directive 2 (CCD2), applying 20 Nov 2026

- **Scope:** ([Abreu](https://abreuadvogados.com/en/conhecimento/publicacoes/new-rules-on-consumer-credit-in-the-eu-directive-2023/2225/))
  - credits up to **€100,000** (previously €75,000)
  - **small loans under €200** now in scope
  - **interest-free BNPL** now in scope
- **Creditworthiness assessment (Art. 18)** ([Dudkowiak](https://www.dudkowiak.com/gdpr-in-poland/gdpr-and-the-eu-consumer-credit-directive-ccd2/); [Schoenherr/Mondaq](https://mondaq.com/austria/consumer-credit/1500374/consumer-credit-directive-ii-consumer-credit-legislation-for-the-digital-age)):
  - mandatory before every credit
  - based on necessary and proportionate information on income, expenses and financial circumstances
  - **no GDPR special-category data**, and **no data from social networks**
  - where processing is automated, the consumer can **request human intervention, an explanation, to state their view, and a review**
- **Status:**
  - The 20 Nov 2025 transposition deadline was widely missed. Germany passed its act on 17 Apr 2026. ([Noerr](https://www.noerr.com/en/insights/act-implementing-the-consumer-credit-directive-2023-passed))
  - The Commission reportedly sent formal notices to 23 member states on 30 Jan 2026 [1 source]. ([wiki.private.law](https://wiki.private.law/en/ccd2-bnpl-eu))
  - **Romania:** a Ministry of Economy draft to replace OUG 50/2010 went to consultation in May 2025 ([Puterea.ro](https://www.puterea.ro/?p=488492)), and an ANPC draft also exists ([ANPC draft](https://anpc.ro/wp-content/uploads/2025/05/OUG-CREDIT.docx)). File 01 reports a Feb 2026 draft and an infringement procedure. **Adoption is unconfirmed.**
- **Agent fit: high.** "Validate an application against requirements" is literally this:
  - checklist of required evidence
  - prohibited-data detector (flag special-category or social-media data in the file)
  - affordability-rule checks
  - pre-contract information completeness
  - routing of human-intervention requests
- Keep the agent a **validator**, not a scorer (see B6).

## B8. CSRD / Omnibus I, EBA ESG guidelines, Taxonomy

- **Omnibus I** (Directive (EU) 2026/470; OJ 26 Feb 2026; in force 18 Mar 2026; transposition by 19 Mar 2027) ([CMS](https://cms.law/en/lux/legal-updates/final-adoption-of-omnibus-i-directive-simplifying-csrd-and-csddd); [Latham](https://www.lw.com/esg-resource-hub/EU-Sustainability-Omnibus-Published-in-the-Official-Journal)):
  - CSRD scope cut to **more than 1,000 employees and more than €450m turnover**
  - **value-chain cap**: in-scope companies and banks may not demand sustainability information beyond the voluntary SME standard (VSME) from firms with fewer than 1,000 employees. Sources differ on the precise legal status. ([EC Q&A on VSME](https://finance.ec.europa.eu/publications/questions-and-answers-recommendation-voluntary-sustainability-reporting-standard-small-and-medium_en))
- **EBA Guidelines on ESG risk management** (EBA/GL/2025/01) ([EBA](https://www.eba.europa.eu/node/17625); [Legal500/Ganado](https://www.legal500.com/firms/10225-ganado-advocates/c-malta/news-and-developments/guidelines-on-esg-risk-management-emphasize-integration-of-esg-risks-across-the-3-lines-of-defence)):
  - apply from **11 Jan 2026** (small and non-complex institutions: 11 Jan 2027)
  - require ESG risk identification, ESG data management and transition plans
  - France's ACPR complies with a **reservation on counterparty data collection** where Omnibus I no longer obliges counterparties to publish. ([ACPR notice](https://acpr.banque-france.fr/system/files/2025-06/20250626_Avis_conformite_ACPR_EBA_GL_ESG_v2.pdf))
- **Taxonomy / Green Asset Ratio:** not researched in depth in this pass.
- **Pain [inference]:** banks still need borrower ESG data for risk management but can demand less of it from smaller borrowers. They must work with whatever is in annual reports and VSME-style reports.
- **Agent fit: medium.** RBI has already deployed **ESG Criticality Checks** (A3), so only extend that work, e.g., a VSME-report completeness checker for SME borrowers. Don't duplicate it.

## B9. Romania-specific items (beyond file 01)

- **ANAF electronic garnishment (e-popriri):** in place since **23 Jun 2017**. ([Profit.ro](https://profit.ro/taxe-si-consultanta/anaf-a-implementat-poprirea-electronica-17051180); [Fiscalitatea](https://www.fiscalitatea.ro/anaf-va-transmite-din-22-iunie-doar-online-popririle-pe-conturi-17441/))
  - The **Economic and Social Council (CES) opinion of 30 Dec 2025** on draft law b674/2025 (amending the Fiscal Procedure Code) describes the live process. ([CES opinion PDF](https://www.ces.ro/newlib/PDF/avize/2026/2.21-b674-Aviz-CES-30.12.2025.pdf)) [primary]
  - **Day 1:** the garnishment is established and accounts are blocked "with or without balance, not knowing the balance or nature of sums".
  - **Day 2:** banks communicate payable amounts.
  - **Day 3:** payment.
  - **Day 4:** release at all other banks.
  - **After blocking, banks "analyse the account turnover and the nature of sums credited"** under **art. 236(4) Fiscal Procedure Code with art. 729 Civil Procedure Code** to release **legally unseizable amounts** to the debtor.
  - CES rejected the draft because banks have "invested massively" in e-popriri, and changes would bring operational and legal risk.
  - **This is a textbook rules agent:** classify each incoming credit (salary, pension, social benefit, child allowance, and so on), apply the seizable-portion rules, and flag uncertain items. File 01 §5.1 has the volumes (more than 1.1m lifting decisions) and warns that the threshold values must be checked in the codes.
- **ANAF central account register: data quality.** ANAF reported recurring errors in banks' submissions and is standardising the format. ([Profit.ro, 5 Nov 2025](https://profit.ro/taxe-si-consultanta/anaf-schimba-modul-in-care-bancile-transmit-date-despre-clienti-si-conturi-bancile-au-raportat-conturi-fara-beneficiar-real-sau-conturi-cu-titulari-fara-cnp-22225882)) [1 source] The error categories:
  1. account holders without a CNP (personal identification number)
  2. accounts without a beneficial owner
  3. beneficial owner recorded as a legal person
  4. non-resident beneficial owners without a NIF (tax ID)
  5. resident beneficial owners without a CNP
  6. date of birth equal to the account-opening date
  - These are ready-made reconciliation rules for a demo.
- **RO e-Factura:** Law 88/2026 approved OUG 128/2024; the transmission deadline is 5 working days. ([Capital.ro](https://www.capital.ro/anaf-actualizeaza-regulile-pentru-e-factura-firmele-trebuie-sa-verifice-noile-obligatii-si-sanctiunile-aplicabile.html)) [1 source]
  - **Direct burden on banks' own operations: not found.**
  - **[inference]:** for lending and factoring, e-Factura XML gives a machine-verifiable source for checking invoices submitted as collateral or for drawdowns.
- **BNR 2025–26 regulations:** **none identified** in this pass (searches returned mostly National Bank of Moldova documents). Check bnr.ro directly.
- **DORA, Romanian implementing measures** (national competent-authority procedures, BNR reporting channel): **not found.** DORA is a directly applicable regulation, so the core duties apply regardless.
- **IPR penalties:** draft ordinance with the BNR as supervisor (see B3).

---

## C. Agent design constraints drawn from the rules (use in the pitch)

1. **Human-in-the-loop by design.** AI Act Art. 26 oversight and CCD2 Art. 18 human-intervention rights both require it. Keep the agent a recommender with explicit approve/override. For credit, limit it to preparatory and procedural checks (Art. 6(3)), never scoring or profiling. A human sign-off alone does **not** take a scoring system out of high-risk scope. ([Art. 26](https://artificialintelligenceact.eu/article/26/); [Art. 6](https://artificialintelligenceact.eu/article/6/); [Dudkowiak](https://www.dudkowiak.com/gdpr-in-poland/gdpr-and-the-eu-consumer-credit-directive-ccd2/))
2. **Logging and retention of at least 6 months** for every decision (AI Act Art. 26). AMLR record-keeping and Romania's Law 86/2025 "reconstructable" transactions point the same way.
3. **Rule-level explainability.** Every flag cites the rule (e.g., "AMLR Art. 26(2): last refresh 2021-03 > 1 year for high-risk").
4. **Data minimisation.** Never ingest special-category or social-media data for credit (CCD2 Art. 18).
5. **No transaction-level EU-sanctions blocking for instant payments.** Screen customers daily instead (IPR Art. 5d).
6. **Synthetic data only** (hackathon rule). This also sidesteps GDPR in the demo.

---

## Top 8 regulatory/compliance pressures ranked by (urgency in 2026–2027 × fit for a document+rules AI agent)

Each pressure is ranked on three discriminators:
- (a) does the deadline land between Nov 2026 and Dec 2027 for a non-euro, Romanian entity?
- (b) is the work repetitive document-plus-rules checking with a clear exception outcome?
- (c) has a regulator already flagged RBI on it?

1. **AMLR periodic CDD refresh and beneficial-owner discrepancy handling (applies 10 Jul 2027).**
   - The AMLR caps refresh intervals at 1 year (high risk) and 5 years (others), sets the BO test at 25% ownership or control, and requires BO-register discrepancies to be reported within 14 days.
   - The FMA fined RBI in 2018 precisely for weak BO checks and stale ownership documents on high-risk clients.
   - About 200k Garanti BBVA customers migrate in 2027, in the same window.
   - Sources: [Springlex Art. 26](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-26/); [CSSF](https://www.cssf.lu/en/2024/06/the-new-aml-cft-regulation-the-sixth-aml-cft-directive-and-the-future-eu-aml-cft-supervisor/); [Kyiv Post on FMA 2018](https://www.kyivpost.com/business/raiffeisen-slapped-2-7-million-euro-fine-lack-money-laundering-controls.html); [RBI Q1 2026 deck](https://www.rbinternational.com/content/dam/rbi/ho/investors/events-and-presentation/presentation-and-webcast/conference-call-presentations/2026-05-05%20Q1-Investor%20Presentation%20RBI.pdf.coredownload.pdf)

2. **Sanctions and Russia-exposure alert triage, including trade-document checks (urgent now).**
   - The 20th package (Apr 2026) bans 70 Russian banks plus payment agents and third-country banks.
   - The Grizzly report (Sept 2026) alleges $1.19bn of trade routed through RBI's Russian unit. RBI has faced OFAC questions (2023) and a Treasury warning (2024).
   - An agent that triages hits and writes auditable rationales attacks RBI's highest-salience risk.
   - Sources: [Matheson](https://www.matheson.com/insights/eus-20th-sanctions-package-against-russia/); [Reuters via Euronext](https://live.euronext.com/en/financial-news/raiffeisen-shares-slump-after-short-seller-grizzly-spotlights-russia-ties); [RBI on OFAC](https://www.rbinternational.com/en/investors/news/ir-releases/ofac.html)

3. **CCD2 credit-file validation (applies 20 Nov 2026, in 23 days).**
   - Every consumer credit, now including BNPL and loans under €200, needs a documented creditworthiness assessment free of special-category and social-media data.
   - Consumers get a right to human review of automated decisions. This is a direct "validate application against requirements" demo.
   - Build it as a completeness and prohibited-data **validator**, which is arguably preparatory under AI Act Art. 6(3). A **scorer** would be high-risk from Dec 2027.
   - Romania's transposition is still unconfirmed, which adds legal uncertainty.
   - Sources: [Abreu](https://abreuadvogados.com/en/conhecimento/publicacoes/new-rules-on-consumer-credit-in-the-eu-directive-2023/2225/); [Dudkowiak](https://www.dudkowiak.com/gdpr-in-poland/gdpr-and-the-eu-consumer-credit-directive-ccd2/); [Puterea.ro](https://www.puterea.ro/?p=488492)

4. **Instant Payments Regulation for a non-euro bank: VoP exceptions and daily sanctions screening (9 Jan 2027 and 9 Jul 2027).**
   - Raiffeisen Romania must receive euro instant transfers from 9 Jan 2027, then send them and offer VoP from 9 Jul 2027.
   - Customers must be screened at least daily rather than transaction by transaction.
   - Close-match and no-match results, and impersonation disputes, become a new exception queue.
   - Sources: [ECB IPR](https://www.ecb.europa.eu/paym/retail/instant_payments/html/instant_payments_regulation.en.html); [Bird & Bird](https://www.twobirds.com/en/insights/2024/global/instant-payments-regulation)

5. **Romanian e-popriri: unseizable-amount analysis (ongoing daily, law change proposed Dec 2025).**
   - After ANAF garnishes, banks must analyse each credit to the account under Fiscal Procedure Code art. 236(4) and Civil Procedure Code art. 729 to release unseizable sums, on a 4-day cycle.
   - The work is high-volume and rule-based, with a clear exception flag.
   - Sources: [CES opinion 30 Dec 2025](https://www.ces.ro/newlib/PDF/avize/2026/2.21-b674-Aviz-CES-30.12.2025.pdf); file 01 §5.1

6. **DORA third-party and incident operations (in force; ECB on-site campaigns 2026–28).**
   - Annual register-of-information reconciliation against the contract base, and contract-clause review.
   - First-pass classification of each ICT incident against RTS thresholds on 4h/24h/72h/1-month clocks.
   - Operational risk was the ECB's weakest SREP area in 2025.
   - Sources: [FMA DORA](https://www.fma.gv.at/en/dora-ict-related-incidents/); [CSSF RoI](https://www.cssf.lu/en/2026/02/dora-submission-timeframe-for-register-of-information-edesk-portal-open-as-of-11-february-2026/); [ECB blog](https://www.bankingsupervision.europa.eu/press/blog/2026/html/ssm.blog20260122~7fdd534c3c.en.html)

7. **Supervisory data quality and reconciliation (AMLA selection data 2026–27, ECB RDARR, ANAF account register).**
   - AMLA collected entity data in Aug–Sept 2026 to pick its 2028 direct-supervision list. RBI meets the six-member-state footprint test [inference].
   - The ECB is escalating persistent risk-data deficiencies.
   - ANAF has published six recurring error types in banks' account reporting, such as accounts without a beneficial owner or holders without a CNP.
   - All three are "reconcile records and identify discrepancies" work.
   - Sources: [MNB/AMLA](https://www.mnb.hu/en/supervision/news/amla-takes-next-step-toward-2027-selection-of-entities-for-direct-supervision); [KPMG](https://kpmg.com/xx/en/our-insights/risk-and-regulation/osis-update-for-2026.html); [Profit.ro](https://profit.ro/taxe-si-consultanta/anaf-schimba-modul-in-care-bancile-transmit-date-despre-clienti-si-conturi-bancile-au-raportat-conturi-fara-beneficiar-real-sau-conturi-cu-titulari-fara-cnp-22225882)

8. **Borrower ESG data under the EBA ESG guidelines and Omnibus I (applies from 11 Jan 2026; Omnibus transposed by 19 Mar 2027).**
   - Banks must integrate ESG risk into credit decisions while Omnibus I caps what they can demand from borrowers with fewer than 1,000 employees.
   - That pushes work toward extracting data from whatever the borrower already publishes.
   - Ranked last because RBI already runs AI ESG Criticality Checks with an audit trail, so a team should only extend them, e.g., VSME-report completeness for SMEs.
   - Sources: [EBA](https://www.eba.europa.eu/node/17625); [CMS](https://cms.law/en/lux/legal-updates/final-adoption-of-omnibus-i-directive-simplifying-csrd-and-csddd); [RBI AI page](https://www.rbinternational.com/en/raiffeisen/career/topics/ai-at-rbi.html)

*Deliberately excluded from the top 8:*
- **EU AI Act (Annex III now Dec 2027):** treated as a **design constraint** (section C), not a target.
- **PSD3/PSR:** not yet in the OJ; applies about 2028.
