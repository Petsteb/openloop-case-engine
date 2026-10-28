# 05: Corporate, SME and trade open-loop processes

*Researched 2026-10-28. This was a fast breadth pass of about 50 tool calls. Each claim has its URL inline.*

**Labels used throughout**
- **[1 source]:** only one source supports the claim.
- **(inference):** my reasoning, not a sourced fact.
- **"vendor":** a figure from a vendor-sponsored survey or a vendor marketing claim.
- **"not found":** I searched and found nothing. It does not mean the thing doesn't exist.

**Scoring used on every card**
- **Fit** (1–5): how naturally the process maps onto our engine (goal + checklist, ledger, deterministic requirement states, timers, fuzzy matcher, triage card, compiled checks).
- **Demo** (1–5): how easy it is to show convincingly on synthetic data by tomorrow.

---

## 1. Corporate/SME KYB onboarding and periodic KYC refresh

**What it is**
- Identify and verify a legal entity, its directors and its UBOs, and collect the constitutive documents.
- Repeat the process periodically, and also when a triggering event happens.

**Why it's an open loop**
- Documents come in over days or weeks from several parties: the client, ONRC extracts, UBO declarations, signatories' IDs.
- Some documents expire while the bank waits for others. Romanian banks usually want a **certificat constatator issued no more than 30 days earlier**. There is no legal validity period; this is bank practice.
  - Sources: [StartupCafe](https://startupcafe.ro/p-certificatul-constatator-actul-pe-care-banca-primaria-si-finantatorul-ti-l-cer-in-acelasi-an-ce-contine-si-cum-il-obtii-104392); [Financiarul](https://financiarul.ro/companii/certificatul-constatator-prea-vechi-poate-amana-actele-firmei/).
  - Banca Transilvania accepts an ONRC extract issued within 30 days for a newly set-up company ([BT FAQ](https://intreb.bancatransilvania.ro/it/en/ce-acte-sunt-necesare-la-deschiderea-unui-cont-pentru-o-societate/)).
- Some banks ask for a certificate under 15 days old for credit ([StartupCafe](https://startupcafe.ro/p-certificatul-constatator-actul-pe-care-banca-primaria-si-finantatorul-ti-l-cer-in-acelasi-an-ce-contine-si-cum-il-obtii-104392)) [1 source].
- This maps directly onto our **expired** requirement state.

**Rules and deadlines**
- **AMLR (Reg. 2024/1624), Art. 26(2), from 10 Jul 2027:** customer information must be updated at least every **1 year for higher-risk customers** and every **5 years for all others** ([Springlex Art. 26](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-26/)).
- **Art. 26(3), event triggers:**
  - a change in the customer's relevant circumstances
  - a legal obligation to contact the customer in that calendar year
  - the bank becoming aware of a relevant fact
- AMLA has issued draft guidelines on ongoing monitoring under Art. 26(5) ([CMS](https://cms.law/en/aut/legal-updates/amla-publishes-draft-guidelines-on-ongoing-monitoring-under-article-26-5-amlr)).
- **AMLR Art. 24, UBO discrepancy reporting** ([Springlex Art. 24](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-24/)):
  - The bank must report a discrepancy against the central register "within **14 calendar days** of their detection".
  - For typos, transliteration differences or minor inaccuracies, the bank may ask the customer first.
  - If the customer doesn't correct it within 14 days, the bank must report.
  - The minor-discrepancy route is not available in higher-risk cases.
  - This is a textbook **timer + fuzzy-match + exception** loop.
- The UBO threshold becomes "25% or more" under AMLR Art. 52 ([theKYB](https://thekyb.com/blog/7-things-that-change-about-beneficial-ownership-verification-under-amlr/)) [1 source, vendor blog].
- **Romania, Law 129/2019** ([ONRC notice 2020](https://www.onrc.ro/documente/presa/2020/20.02.2020/Informare%20ONRC_Legea%20129_RBR.docx); [StartupCafe](https://www.startupcafe.ro/taxe/registrul-comertului-registru-beneficiari-reali-firme-termene-amenzi.htm)):
  - Companies must file a UBO declaration with ONRC **within 15 days of any change**.
  - An annual declaration was also required in the original regime. It may since have been amended (unverified).
  - ONRC keeps the central UBO register.
  - Credit institutions can access the register ([StartupCafe](https://www.startupcafe.ro/taxe/registrul-comertului-registru-beneficiari-reali-firme-termene-amenzi.htm)).

**Volume, duration, cost and exception evidence (all vendor-sponsored Fenergo surveys)**
- **$2,598 average cost per corporate KYC review in 2023**, up 17% year on year. 21% of corporate and institutional banks spend over $3,000 per review ([Corporate Compliance Insights](https://www.corporatecomplianceinsights.com/kyc-review-cost-survey-2023/)).
- **95 days on average to complete a KYC review in 2023**, up from 84 days in 2022 ([Fenergo blog](https://www.fenergo.com/blogs/kyc-compliance-for-banks-addressing-the-cost); [CCI](https://www.corporatecomplianceinsights.com/kyc-review-cost-survey-2023/)).
- **70% of firms lost clients to inefficient onboarding** in the past year (2025 survey, 600 firms), up from 67% in 2024 and 48% in 2023. Average onboarding abandonment is 10% ([FinTech Global](https://fintech.global/2025/10/08/70-of-banks-lose-clients-due-to-slow-onboarding/); [Fenergo newsroom](https://resources.fenergo.com/newsroom/global-financial-institutions-struggle-with-rising-client-losses-and-compliance-costs-as-ai-adoption-increases-fenergo)).
- UK corporate banks are the slowest to onboard, often over 6 weeks ([WealthBriefing](https://www.wealthbriefing.com/html/article.php/more-financial-institutions-suffer-onboarding-abandonment)) [1 source].
- "Only ~33% of periodic KYC reviews fully automated" appears in one secondary summary ([risk-academy](https://risk-academy.ru/?p=61690)) [1 source, weak].
- **Time stuck waiting on client documents: no percentage found.** No source gives a client-outreach non-response rate.

**Raiffeisen-specific evidence** ([RBRO Q2 2026 results](https://bvb.ro/infocont/infocont26/RBRO27A_20260730173229_RBRO-Financial-Results-2026-Q2-ENG.pdf)) [1 source]
- In H1 2026 the Entrepreneurs (SME) Division won **+70% more new customers** than a year earlier.
- **70% of entrepreneurs open the SME account package via digital flows** (website or tablet).
- Smart Business passed 100,000 active customers.
- (inference) The other ~30% of openings go through assisted channels, and digital KYB still needs back-office checks. This is not an exception rate.
- Garanti BBVA migration in 2027 (§8) falls in the same year AMLR applies (inference; see also file 02).

**Existing automation:** heavily vendor-served. Fenergo, Moody's/Bureau van Dijk and KYB API vendors cover data collection and screening. (inference) The **multi-week waiting, expiring and contradicting document loop** and the 14-day discrepancy clock are less well served than data retrieval.

**Fit 5:** this is our demo case; it has every requirement state, including expired documents and the 14-day UBO-discrepancy timer. **Demo 5.**

---

## 2. Credit covenant and post-disbursement monitoring

**What it is**
- After a loan is disbursed, the borrower must keep delivering:
  - periodic financial statements
  - compliance certificates
  - insurance evidence
- The bank tests financial covenants and flags breaches.

**Why it's an open loop**
- Deliverables recur on fixed calendars for years.
- They arrive late, partially, or contradicting earlier data.
- A breach starts a waiver or renegotiation sub-loop.

**Rules and deadlines** (set by contract, not regulation)
- A typical clause: monthly statements **within 30 days** after month end, with a compliance certificate signed by a financial officer ([Law Insider clause samples](https://www.lawinsider.com/clause/financial-statements-reports-certificates)).
- Extensions for late statements and certificates are formally documented as amendments or consents ([KB Home amendment](https://contracts.justia.com/companies/kb-home-746/contract/837147)).
- EBA GL/2020/06 (loan origination and monitoring) requires ongoing monitoring of borrowers ([Simmons & Simmons](https://www.simmons-simmons.com/en/publications/cldk754x6008stsmsc2otqxkx/eba-guidelines-on-loan-origination-and-monitoring)).

**Evidence**
- **More than a quarter of US listed firms violate a financial covenant** at some point (SEC filings, 1996–2005) ([Roberts & Sufi, JF 2009](https://finance.wharton.upenn.edu/~mrrobert/resources/Publications/ControlRightsCapitalStructureJF2009.pdf)).
- **About one-third of loans breached a covenant per year** in the 2008–09 crisis, from supervisory loan data ([Chodorow-Reich preprint](https://chodorowreich.scholars.harvard.edu/resource/download-preprint)) [1 source].
- Many banks still use paper and spreadsheets for covenant compliance ([TCS white paper](https://www.tcs.com/what-we-do/industries/banking/white-paper/covenant-management-commercial-banking); [Evalueserve case](https://www.evalueserve.com/case-study/global-bank-automates-covenant-monitoring-using-ai/)). Both are qualitative vendor material.
- **How often deliverables are late or missing: not found.** I searched twice and no survey exists in the open web.

**Raiffeisen-specific evidence**
- Company lending portfolio **+12% year on year** at June 2026, driven by the corporate segment; NPE ratio 1.49% ([RBRO Q2 2026](https://bvb.ro/infocont/infocont26/RBRO27A_20260730173229_RBRO-Financial-Results-2026-Q2-ENG.pdf)).
- (inference) A growing book means a growing deliverables calendar.
- Covenant process detail: not found.

**Existing automation**
- Vendors exist: Moody's Automated Covenants ([Moody's](https://www.moodys.com/web/en/us/campaigns/automated-covenants.html)), Evalueserve, Baker Hill, Botminds.
- (inference) Mid-market CEE banks still rely mostly on manual tracking. This is unverified for Romania.

**Fit 5:** each deliverable is a requirement with a due date (timer). A covenant test is hard code. A restated figure is a contradiction. A waiver is a human resolution. **Demo 4.**

---

## 3. Conditions precedent (CP) checklists before disbursement

**What it is:** the list of documents, opinions, security perfection steps and fees that must be satisfied before first or further drawdowns. It covers corporate, syndicated, project finance and real-estate development loans.

**Why it's an open loop**
- Items come from the borrower, lawyers, notaries, registries, insurers and valuers over weeks.
- The lender's lawyers keep a CP checklist "to track the status of each relevant condition precedent" ([Lexis UK](https://www.lexisnexis.com/en-gb/legal/guidance/conditions-precedent-phase-in-loan-transactions)).
- CPs are often listed separately so that "lawyers, borrowers and lenders can monitor the process" ([Mondaq](https://www.mondaq.com/financial-services/1148234/conditions-precedent-in-finance-agreements)).
- Missing items cause delayed disbursement (same source).
- Development and project finance add per-drawdown CPs, such as construction milestones (inference).

**Rules:** contractual (LMA-style), plus security perfection in registries (see §5).

**Evidence**
- Durations, delay rates and costs: **not found.**
- The only number found is a 2–6 day gap from final conditions to funding at one US mortgage broker. It is irrelevant to corporate lending, so I don't use it.

**Raiffeisen-specific evidence:** not found.

**Existing automation**
- Legatics automates the CP workstream for law firms ([Legal IT Insider](https://legaltechnology.com/2017/11/09/startup-corner-legatics-in-focus)).
- Oracle's corporate lending suite has a "Drawdown Condition Precedent" configuration ([Oracle docs](https://docs.oracle.com/en/industries/financial-services/banking-corporate-lending-management/14.7.0.0.0/confi/drawdownconditionprecedent.html)).
- Tracking is partly commoditised. Document-level verification against the checklist is not (inference).

**Fit 5:** this is literally a goal plus a checklist with multi-party inputs. **Demo 4.** The evidence of pain is thin.

---

## 4. Trade finance: letters of credit, bank guarantees, collections

**What it is**
- **LCs (UCP 600):** banks examine presented documents against the credit and pay or refuse.
- **Demand guarantees (URDG 758):** the bank examines a beneficiary's demand.
- **Documentary collections:** the bank releases documents against payment or acceptance.

**Why it's an open loop**
- An LC lives for months. The cycle runs: issuance, then amendments, then one or more presentations, then a discrepancy notice, then the applicant's waiver or a re-presentation, then payment.
- A guarantee lives for years. Claims and extend-or-pay demands arrive unpredictably.

**Rules and deadlines**
- **UCP 600 Art. 14(b):** each bank has **a maximum of 5 banking days** after the day of presentation to examine documents. It replaced UCP 500's "reasonable time, up to 7 days". A late refusal is invalid. Sources: [ICC DCI on UCP 600 issues](https://library.iccwbo.org/content/tfb/dcinsight/DCI_Vol16n1_IssuesInUCP600.htm); [ICC Opinion TA916rev](https://library.iccwbo.org/content/tfb/OPINIONS/TA916rev.htm). Both were read via search snippets only.
- **URDG 758 Art. 20(a):** the guarantor examines a demand **within 5 business days**. The rejection notice must list all discrepancies ([Reed Smith](https://reedsmith.com/en/perspectives/2010/07/urdg-758--a-facelift-for-the-demand-guarantee-rule); [TFG on URDG](https://www.tradefinanceglobal.com/posts/practical-application-urdg-international-trade/)).

**Evidence**
- **65–80% of documentary credits are affected by discrepancies on first presentation** (ICC Banking Commission TAB-3 briefing, June 2022) ([TFG summary](https://www.tradefinanceglobal.com/posts/icc-briefing-addresses-the-topic-of-reducing-discrepancy-rates/); [ICC PDF](https://library.iccwbo.org//content//tfb//BRIEFINGS//20220627_TA_Briefing_No3_reducing_discrepancy_rates.pdf)).
- The most common discrepancies are timing (expiry, shipment, presentation periods), followed by poorly prepared documents. No cost or delay figures are given.
- ICC Trade Register 2025:
  - Import-LC default rates sit near the 7-year average.
  - Performance-guarantee defaults edged up, including in Europe.
  - Tariffs are expected to contract trade.
  - Source: [ICC commentary PDF](https://iccwbo.org/wp-content/uploads/sites/3/2025/10/ICC-Market-Commentary_Trade-Register-2025.pdf).

**Raiffeisen-specific evidence**
- RBI chose **Surecomp RIVO** to digitise guarantees and LC operations ([FinTech Futures](https://www.fintechfutures.com/baas/raiffeisen-bank-international-opts-for-surecomp-s-collaborative-trade-finance-platform)) [1 source, date unverified; page returned 403]. Romanian use is not confirmed.
- An earlier iGTB trade platform went live at **Austrian** Raiffeisen Landesbanken in 2019, not Romania ([TFG](https://www.tradefinanceglobal.com/posts/raiffeisenbank-implements-digital-trade-finance-platform/)).
- Raiffeisen Romania trade finance volumes: **not found.**

**Existing automation: commoditised for document checking.**
- Traydstream is used by Citi (2023) ([Citi PR](https://www.citigroup.com/global/news/press-release/2023/citi-collaborates-with-traydstream-to-streamline-document-services-for-faster-and-more-effective-client-solutions)) and Deutsche Bank ([FinTech Futures](https://www.fintechfutures.com/partnerships/deutsche-bank-to-automate-trade-document-checking-with-traydstream-partnership)).
- Surecomp + Traydstream claim "hours to minutes" and 60–70% cost cuts ([The Paypers](https://thepaypers.com/fraud-and-fincrime/news/surecomp-partners-traydstream)) (vendor).
- Covantis QuickDocs serves commodity trade ([Food Logistics](https://www.foodlogistics.com/software-technology/ai-ar/news/22950977/covantis-covantis-launches-aipowered-tool-to-check-shipping-documents-eliminating-errors-and-reducing-working-capital-cost)).
- Cleareye.ai and Conpend are named in low-quality blogs only; not verified.
- The ICC Digital Standards Initiative is a standards body, not an AI vendor. I did not research it further.

**Fit 3:** the single-presentation check is a closed, commoditised 5-day loop. The **discrepancy → applicant waiver → re-presentation** loop and guarantee claim and extend-or-pay handling fit better. **Demo 3.**

---

## 5. Collateral management: revaluation, insurance, perfection

**What it is:** keeping collateral eligible and enforceable. That means periodic valuation, assigned insurance policies that stay in force, and registered security interests that remain valid.

**Why it's an open loop:** each collateral item carries recurring expiry dates (valuation, insurance, registry notice). Renewal evidence comes from third parties: valuers, insurers, registries.

**Rules and deadlines**
- **CRR Art. 208(3)(a):** commercial property value must be monitored **at least once a year**, or it stops being eligible collateral ([EBA Q&A 2020_5470](https://eba.europa.eu/single-rule-book-qa/qna/view/publicId/2020_5470)).
- **The 3-year interval for residential property is unverified.** I recall it but did not confirm it.
- **Art. 208(3)(b):** for loans over **EUR 3m or 5% of own funds**, a valuer must review the valuation **at least every three years** ([PRA Q&A, text extracted](https://www.bankofengland.co.uk/-/media/boe/files/prudential-regulation/publication/2020/qanda-crr-requirements-property-valuations.pdf)).
- CRR3 may have changed details (unverified).
- **EBA GL/2020/06:** monitoring frequency is risk-based, with more frequent monitoring for properties under development and high-LTV loans, plus revaluation triggers ([Simmons & Simmons](https://www.simmons-simmons.com/en/publications/cldk754x6008stsmsc2otqxkx/eba-guidelines-on-loan-origination-and-monitoring)).
- **Romania, movable security:** AEGRM has been **superseded by RNPM**, the Registrul Național de Publicitate Mobiliară (MJ Order 1808/C/2014 forms) ([legeaz.net](https://legeaz.net/monitorul-oficial-428-2014/ordinul-mj-1808-c-2014/anexa-37-formular-de-aviz-de-reactivare-a-avizului-de-ipoteca-initialspan)).
  - A mortgage notice is valid **5 years** and can be extended by an extension notice ([Anexa 16 form](https://e-juridic.manager.ro/articole/formular-de-aviz-de-prelungire-a-avizului-de-ipoteca-initial-anexa-nr-16-rnpm-25706.html); [avocatnet forum](https://www.avocatnet.ro/t10497/aegrm.html)).
  - (inference) Priority is lost if the notice is not extended.
- **Carte funciară** (immovable property land book) process detail: not found.

**Evidence**
- Rules only. **No measured lapse or expiry rates found.**
- Insurance-tracking vendors say untracked expiries leave the lender bearing the loss ([Bryt](https://www.brytsoftware.com/why-manufacturing-lenders-need-automated-insurance-expiration-tracking/); [Colorado Bankers Assoc.](https://colorado-banker.thenewslinkgroup.org/how-lenders-are-risking-major-losses-on-untracked-collateral/)). This is vendor material and mostly about auto loans.

**Raiffeisen-specific evidence:** not found.

**Existing automation:** collateral modules exist in core lending suites, and insurance-tracking SaaS is mostly US auto lending (inference).

**Fit 4:** strong timers and third-party evidence, but less multi-party document judgement. **Demo 4.**

---

## 6. State-guaranteed and EU-funded SME lending programmes (Romania)

**What it is:** loans backed by FNGCIMM (IMM Invest, IMM Plus), BID (the state Investment and Development Bank, PNRR-created), EIF/InvestEU, or FGCR (agriculture) guarantees. Each programme brings:
- eligibility documentation at origination
- reporting during the loan's life
- a guarantee claim with supporting documents on default

**Why it's an open loop**
- **Origination:** an eligibility checklist with programme-specific documents. FNGCIMM documents go through an online platform with a **10-working-day** review once the file is complete ([FNGCIMM presentation, May 2025](https://www.bursa.ro/_pdf/evenimente/piata_financiar_bancara_2025/prezentari/Catalin_Leonte.pdf)).
- **Claims:** claims are their own multi-week loop, because guarantors check the bank's own compliance.

**Rules and deadlines**
- **FNGCIMM IMM Plus:** typically **80% FNGCIMM guarantee + 20% other** ([FNGCIMM 2025](https://www.bursa.ro/_pdf/evenimente/piata_financiar_bancara_2025/prezentari/Catalin_Leonte.pdf)).
- **Claim rules from analogous FNGCIMM programmes** (not IMM Plus-specific):
  - Under Prima Casa norms (HG 717/2009), a guarantee is payable **only if the bank sends the payment claim within the guarantee's validity, with the contract's listed supporting documents** ([notari.pro Art. 14](https://notari.pro/hg-717-2009/art-14)).
  - FNGCIMM pays within a **maximum of 90 days** of a complete claim ([Economica, Start Up Nation](https://www.economica.net/primele-doua-garantii-in-programul-start-up-nation-au-fost-acordate_143841.html/amp)) [1 source].
  - A claim withdrawal cutoff falls on the **85th day of arrears** ([HG 190/2015](https://legeaz.net/monitorul-oficial-198-2015/hg-190-2015-modificarea)) [1 source].
- **Contradiction evidence:** in a 2014 Bucharest Court of Appeal case, FNGCIMM **rejected a claim for documents it had accepted when it issued the guarantee** ([legeaz.net](https://legeaz.net/spete-contencios-curtea-de-apel-bucuresti-2014/anulare-act-administrativ-sentinta-19-12-2014-ytq)) [1 source].
- **Bank reporting obligations under PNRR/BID/InvestEU contracts: not found.**

**Volume evidence**
- FNGCIMM issued about **500m lei** of guarantees in H1 2026 ([Economedia](https://economedia.ro/fondul-national-de-garantare-a-creditelor-pentru-imm-uri-a-acordat-garantii-de-aproximativ-500-milioane-lei-in-primul-semestru-din-2026.html)).
- InvestEU with PNRR funding reached **2,000+ Romanian SMEs, about €610m since 2023**, from a €672m envelope ([Romania Insider, Jul 2025](https://www.romania-insider.com/romanian-smes-investeu-pnrr-july-2025)).

**Raiffeisen-specific evidence (strong)**
- **Raiffeisen–BID guarantee convention, 16 Dec 2025** ([Revista Biz](https://www.revistabiz.ro/raiffeisen-bank-romania-isi-extinde-capacitatea-de-finantare-a-imm-urilor-cu-1-miliard-de-lei/)) [1 source]:
  - **710m lei guarantee ceiling**, supporting over **1bn lei** of SME loans
  - coverage **up to 70%**, or 80% for women-led firms, start-ups and innovative firms
  - guarantees up to 10 years
  - **last grant date 31 Dec 2027**
  - real-estate development and grain trading are excluded
- **EIF Oct 2023:** an InvestEU + RRF package of about €1bn across 5 Romanian banks, including Raiffeisen ([EIF press](https://www.eif.org/press/all/romania-eif-and-leading-romanian-banks-join-forces-to-empower-smes-for-sustainable-growth)). Raiffeisen's share was reported as **€400m in two schemes** (Sustainability and Competitiveness) ([ZF English](https://www.zfenglish.com/banks-insurance/european-investment-fund-and-raiffeisen-bank-romania-sign-agreement-22169018)) [1 source].
- **IMM Invest:** Raiffeisen granted **2,333 loans worth €592m in 2022** ([Economica](https://www.economica.net/raiffeisen-bank-a-acordat-anul-trecut-2-333-de-credite-in-valoare-de-592-de-milioane-de-euro-in-cadrul-programului-garantat-de-stat-imm-invest_646532.html)) [1 source].
- Raiffeisen is among the banks with FNGCIMM IMM Plus conventions ([StartupCafe](https://www.startupcafe.ro/finantari/imm-plus-2024-termen-banci-participe-program-finantare-firme-romanesti.htm)) [1 source, from a search snippet].
- 2023 EIB/EIF synthetic securitisation of an SME/midcap portfolio ([EIB](https://www.eib.org/en/press/all/2023-004-raiffeisen-bank-s-a-partners-with-eib-group-by-way-of-synthetic-securitisation-in-order-to-support-increased-access-to-finance-of-sme-and-midcaps-companies-from-romania)).

**Existing automation:** not found. Each programme has its own rulebook, so (inference) it is unlikely any vendor has packaged them.

**Fit 5:**
- Several programmes run in parallel, each with its own eligibility rules (good for compiled checks).
- Document-heavy claims have hard deadlines.
- Guarantor-vs-bank contradictions map to the **contradicted** state.

**Demo 4.**

---

## 7. Corporate restructuring, workout and insolvency (Legea 85/2014)

**What it is:** when a borrower enters insolvency, the bank must:
- detect the opening, which is published in the BPI (Buletinul Procedurilor de Insolvență)
- file a claim declaration with supporting documents before the deadline
- then follow creditor meetings, the creditor table, contestations and a reorganisation plan or liquidation over months or years

**Why it's an open loop:** an external event (a BPI publication) starts a hard timer. Supporting documents then come from the loan file, the collateral file and accounting. The procedure produces further notices for years.

**Rules and deadlines**
- The claims deadline is **at most 45 days from the opening of the procedure** (Law 85/2014, Art. 100(1)(b)) ([legeaz.net case](https://legeaz.net/spete-drept-comercial/faliment-legea-85-1571-2017); [law text, avocatnet](https://www.avocatnet.ro/articol_37739/Legea-nr-85-2014-procedurile-de-prevenire-a-insolventei-si-de-insolventa.html)).
- **Case law under the predecessor Law 85/2006, 2009–2013** ([legeaz.net 765/2013](https://legeaz.net/spete-drept-comercial/procedura-insolventei-decaderea-din-dreptul-765-2013); [legeaz.net 299/2012](https://legeaz.net/spete-drept-comercial/lipsa-publicarii-in-bpi-a-299-2012)), read via search snippets:
  - Publication in the BPI counts as valid notice to creditors.
  - **A bank's failure to check the BPI was not accepted as grounds to restore a missed deadline.**
  - A late claim is forfeited (decădere).

**Volume evidence**
- **7,553 companies and PFAs entered insolvency in 2025**, up 3.84% on 2024 ([Newsweek RO / ONRC](https://newsweek.ro/economie/onrc-7553-de-firme-si-pfa-au-intrat-in-insolventa-in-2025-in-crestere-cu-384-fata-de-2024)).
- H1 2026 was **up more than 12%** year on year ([Economica](https://www.economica.net/onrc-anunta-ca-a-crescut-cu-peste-12-numarul-de-firme-si-pfa-uri-care-au-intrat-in-insolventa-in-primele-sase-luni-din-2026_962422.html)).
- Jan–Aug 2026 reached **4,782**, against 4,561 a year earlier ([Newsweek RO](https://newsweek.ro/economie/risc-major-mediu-privat-peste-4700-companii-pfa-incapacitate-plata-2026)).
- Large-company insolvencies in 2025 were at a **7-year high** ([Coface study PDF](https://www.agendaconstructiilor.ro/docs/2026/ro_studiul-insolventelor-coface-2025.pdf)).

**Raiffeisen-specific evidence:** not found. NPE is low at 1.49% ([RBRO Q2 2026](https://bvb.ro/infocont/infocont26/RBRO27A_20260730173229_RBRO-Financial-Results-2026-Q2-ENG.pdf)). (inference) Insolvency of borrowers' clients and suppliers still affects SME exposures.

**Existing automation:** commercial BPI and company-monitoring alert services exist in Romania (inference). I did not research or verify them, and none link alerts to claim preparation.

**Fit 4:** event-in, timer, document assembly, then a long follow-up loop. It extends naturally from KYB monitoring, since the same entity's ONRC and BPI data apply. **Demo 4.**

---

## 8. Bank-to-bank migration: Raiffeisen's acquisition of Garanti BBVA Romania

File 02 already covers the RBI deck facts:
- **about €70m one-off integration cost, mainly in 2027**: "data migration and rebranding"
- legal merger expected Q4 2027
- about 200k active customers
- Source: [RBI Q1 2026 deck](https://www.rbinternational.com/content/dam/rbi/ho/investors/events-and-presentation/presentation-and-webcast/conference-call-presentations/2026-05-05%20Q1-Investor%20Presentation%20RBI.pdf.coredownload.pdf)

**New facts**
- The **Competition Council approved the deal on 20 Oct 2026** ([Romania Insider](https://www.romania-insider.com/romanias-competition-council-approves-raiffeisens-acquisition-garanti)). Closing is expected in **Q4 2026** ([BBVA](https://www.bbva.com/en/economy-and-finance/garanti-bbva-reaches-agreement-to-sell-its-romanian-unit/)).
- The scope includes **Garanti Bank and the leasing unit Motoractive IFN** ([Raiffeisen BVB release](https://bvb.ro/infocont/infocont26/RBRO26_20260327235513_Comunicat-Acord-Achizitie-Garanti-BBVA-Romania-EN.pdf)).
- The two entities run separately until integration. Integration happens "in clearly defined stages" and is expected to finish in **H2 2027**. Garanti offers products for **Retail, SME and Corporate** (same release).
- Customer migration starts in early 2027 and includes replacing POS terminals and cards ([Cotidianul](https://www.cotidianul.ro/?p=1020692)) [1 source].
- **Corporate/SME migration scope (client counts, KYC remediation plan): not found.**

**Why it's an open loop (inference)**
- Each migrated corporate client file becomes a case: map products, re-validate KYC to Raiffeisen standards, and re-perfect collateral and guarantees in the new bank's name.
- Leasing contracts at Motoractive have their own documents.
- All of this lands in the same year AMLR applies.

**Fit 3:** one-off batch remediation, but every client file is our KYB/refresh case. **Demo 3.** It is a strong *narrative* hook for the judges.

---

## Other corporate open-loop processes noted (not researched in depth)
- **UBO discrepancy handling** (AMLR Art. 24, 14-day clock): covered in §1. It could be demoed as a standalone mini-loop.
- **Guarantee claims and extend-or-pay** under URDG: covered in §4.
- **Leasing contract lifecycle** (Motoractive): not researched.

---

## Top 5 corporate processes by (evidence of pain × fit)

Pain (1–5) reflects the strength and Raiffeisen relevance of the measured pain. Fit is from the cards. Ties are broken by Demo.

| # | Process | Pain | Fit | Score | Strongest number (source) |
|---|---|---|---|---|---|
| 1 | **KYB onboarding + periodic refresh** | 5 | 5 | 25 | $2,598 per corporate KYC review and 95 days on average (vendor) ([CCI/Fenergo](https://www.corporatecomplianceinsights.com/kyc-review-cost-survey-2023/)); AMLR caps of 1y/5y and a 14-day UBO-discrepancy clock from Jul 2027 ([Art. 26](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-26/), [Art. 24](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-24/)) |
| 2 | **State/EU-guaranteed SME loans** (FNGCIMM, BID, InvestEU) | 4 | 5 | 20 | Raiffeisen–BID: 710m lei guarantee ceiling, >1bn lei of loans, last grant date 31 Dec 2027 ([Revista Biz](https://www.revistabiz.ro/raiffeisen-bank-romania-isi-extinde-capacitatea-de-finantare-a-imm-urilor-cu-1-miliard-de-lei/)); 2,333 IMM Invest loans in 2022 ([Economica](https://www.economica.net/raiffeisen-bank-a-acordat-anul-trecut-2-333-de-credite-in-valoare-de-592-de-milioane-de-euro-in-cadrul-programului-garantat-de-stat-imm-invest_646532.html)) |
| 3 | **Insolvency claim monitoring** (BPI → 45-day claim) | 4 | 4 | 16 | 7,553 insolvencies in 2025 ([Newsweek/ONRC](https://newsweek.ro/economie/onrc-7553-de-firme-si-pfa-au-intrat-in-insolventa-in-2025-in-crestere-cu-384-fata-de-2024)), +12% in H1 2026 ([Economica](https://www.economica.net/onrc-anunta-ca-a-crescut-cu-peste-12-numarul-de-firme-si-pfa-uri-care-au-intrat-in-insolventa-in-primele-sase-luni-din-2026_962422.html)); 45-day claim bar |
| 4 | **Covenant / post-disbursement monitoring** | 3 | 5 | 15 (Demo 4) | More than 25% of listed firms violate a covenant ([Roberts & Sufi 2009](https://finance.wharton.upenn.edu/~mrrobert/resources/Publications/ControlRightsCapitalStructureJF2009.pdf)); no lateness data |
| 5 | **LC discrepancies + guarantee claims** | 5 | 3 | 15 (Demo 3) | 65–80% of LCs discrepant on first presentation ([ICC TAB-3 via TFG](https://www.tradefinanceglobal.com/posts/icc-briefing-addresses-the-topic-of-reducing-discrepancy-rates/)); document checking is commoditised (Traydstream, Surecomp) |

**Below the cut**
- **CP checklists** (10): best fit, no pain data.
- **Garanti migration** (9): strong narrative, no corporate scope data.
- **Collateral** (8): rules only, no lapse data.
