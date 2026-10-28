# 04 — Retail & customer-facing open-loop processes (breadth scan)

Researched 2026-10-28 under time pressure: about 40 tool calls, 1–2 sources per item.
Conventions: **[1 source]** means only one source was found. **(inference)** marks my own reasoning. "Not found" means I searched and found nothing usable.
Engine states used in the "Fit" lines: **satisfied / open-waiting / contradicted / expired**, plus legal **timers**.

---

## Cross-process anchor: CSALB request typology (Romanian banking ADR)

The CSALB Q3-2025 report lists the retail case types consumers escalate against banks. The list confirms that several of the processes below produce disputes in Romania. It includes rescheduling/refinancing, ROBOR→IRCC switching, "angajament de plată", acceleration ("declararea scadenței anticipate"), bancassurance policy problems, **enforcement suspension**, **refunds of garnished sums ("restituiri de sume poprite")**, **mortgage release ("radierea ipotecii")**, **fraud on banking channels**, wrong-recipient transfers and Credit Bureau deletions. CSALB itself closes a request if the consumer does not reply within 90 days.
Source: https://csalb.ro/wp-content/uploads/2025/10/Raport-CSALB_T3-2025_RO_29.10.2025.pdf (read in full via pdftotext)

---

## 1. Mortgage origination incl. Noua Casă (FNGCIMM-guaranteed)

- **What:** application → pre-approval → valuation → legal opinion → FNGCIMM guarantee request (Noua Casă) → notarial sale and mortgage contract → land-registry (CF) registration → property insurance (PAD + optional) → disbursement. Construction loans add tranche releases after stage inspections.
- **Why it's an open loop:** 6–8 parties (client, seller, evaluator, notary, OCPI/ANCPI, FNGCIMM, insurer, builder) send documents over weeks to months. Several documents have **validity windows** that can lapse while the case waits for something else.
- **Rules/deadlines:**
  - CF extract must be issued **≤15 days before the guarantee request** (HotNews, Feb 2022, https://hotnews.ro/?p=145656). A search summary of **OMF 6531/2024** gives **≤30 days before registration with FNGCIMM** (https://static.anaf.ro/static/10/Anaf/legislatie/OMF_6531_2024.pdf, not opened). **The two conflict; check the current FNGCIMM norms.**
  - Credit/guarantee promise valid **max 18 months**. Energy certificate must be class **A/B/C**. FNGCIMM must answer a mortgage-release approval request within **30 days**. (HotNews 2022, same URL) [1 source]
  - Noua Casă 2025: **500m lei** guarantee ceiling, **min 5% down payment**, **13 banks incl. Raiffeisen** (https://agerpres.ro/2025/04/22/programul-noua-casa-2025-a-devenit-operational--1442092; https://www.digi24.ro/stiri/economie/programul-noua-casa-2025-a-devenit-operational-bancile-care-s-au-inscris-in-program-3208675).
  - Construction loans: tranches are released only after a bank-appointed evaluator verifies each stage (foundation, structure, finishing) (https://www.bzi.ro/tot-ce-trebuie-sa-stii-despre-un-credit-ipotecar-pentru-o-constructie-de-casa-iata-cum-se-obtine-si-ce-presupune-tot-procesul-5467317). The law does not specify the contents of the acceptance report (proces-verbal de recepție), so each bank sets its own requirements (older wall-street.ro piece: https://www.wall-street.ro/articol/Turism/5917/s-a-blocat-intabularea.html) [1 source].
- **Where it gets stuck:** FNGCIMM "invalidates" files mostly for **missing, expired or illegible documents** or **wrong data entered in the application** (HotNews 2022) [1 source]. That is exactly the expired and contradicted pattern.
- **Volume/duration:**
  - Prima Casă/Noua Casă: **334,048 guarantees, 31.6bn lei, 2009–Dec 2024** (Agerpres, 22 Apr 2025, verified: https://agerpres.ro/2025/04/22/programul-noua-casa-2025-a-devenit-operational--1442092) [1 source].
  - Duration: pre-approval is fast. The property stage averages **1–2 months, up to 3** at ING; BCR cites 5 working days in eligible cases (https://www.cotidianul.ro/?p=1008017) [1 source].
- **Raiffeisen-specific (dated):**
  - Pre-approval on the spot or ≤24h, **valid 45 days**, with online application (Cotidianul, above). The app offers digital pre-approval (https://www.wall-street.ro/articol/banking/raiffeisen-bank-introduce-preaprobarea-financiara-digitala-pentru-ipotecare).
  - **Aug 2021:** "Raiffeisen Bank a terminat plafonul la Noua Casă". Pre-approval was then valid 90 days (https://www.revistabiz.ro/raiffeisen-bank-a-atins-plafonul-la-noua-casa-asa-ca-lanseaza-un-credit-pentru-locuinte-cu-dobanda-fixa-de-45-pe-an/).
  - Noua Casă 2025 participant (Agerpres, above).
- **Existing automation:** loan-origination platforms exist (inference, not researched). The FNGCIMM web app, notary and OCPI steps are Romania-specific and mostly manual hand-offs (inference).
- **Fit: 5.** All four states plus timers. A CF extract older than 15 or 30 days goes to **expired**. A seller or owner name on the CF that differs from the contract goes to **contradicted** (fuzzy-match job). Waiting on the evaluator, notary or FNGCIMM is **open-waiting**. The 18-month promise is a **timer**.
- **Demo-ability: 5.** It is close to the KYB demo and needs the same document-validity machinery.

---

## 2. Deceased customer / succession

- **What:** death notification → block accounts and cards → identify products (accounts, deposits, loans, insurance) → wait for the notary's **certificat de moștenitor** (or a final court decision) → verify heirs' IDs and shares → pay out or transfer. Loans of the deceased go to heirs or insurance.
- **Why it's an open loop:** the succession procedure takes **weeks to months**. Heirs, notary, insurer (credit life) and sometimes courts all contribute documents. Several heirs each need separate verification.
- **Rules:** the bank cannot release funds without the **certificat de moștenitor or a final court ruling**, even if relatives prove kinship. After the certificate arrives, banks typically process in **1–5 working days** (https://www.infocontact.ro/cum-inchizi-contul-bancar-al-unei-persoane-decedate-in-2026-acte-necesare-recuperarea-banilor-si-certificatul-de-mostenitor/; https://financer.ro/banii-tai/acte-necesare-acces-cont-bancar-persoana-decedata/). The 1–5 days figure is [1 source].
- **Volume (inference):** Romania records about **19k deaths/month**: 18,993 in Apr 2024 (https://www.mediafax.ro/?p=22402019) and 19,534 in May 2024 (https://profit.ro/stiri/social/spor-negativ-al-populatiei-romaniei-21662455). That is roughly 225–235k a year **(inference)**. Raiffeisen has about 2.33M clients across all segments, companies included (https://www.wall-street.ro/articol/banking/raiffeisen-bank-romania-urca-profitul-la-175-miliarde-lei-in-2025.html). Naively that suggests **up to about 20–30k deceased-customer cases a year (inference, upper bound; overstated because the client count includes companies)**.
- **Customer-harm evidence (UK only):**
  - Which? (2021): banks release £5k–£50k without probate. Executor satisfaction was lowest at Barclays (58%) and HSBC (67%) (https://www.which.co.uk/news/2021/02/banks-failing-bereaved-families-as-coronavirus-hits-services/).
  - UK FOS decisions on bereavement delays at HSBC, Lloyds and NS&I (e.g. https://www.financial-ombudsman.org.uk/decision/DRN-5036495.pdf).
  - Romanian complaint statistics: **not found**.
- **Raiffeisen-specific:** Raiffeisen Romania procedure: **not found**. The RBI group's Hungarian unit has a dedicated deceased-customer notification process and privacy notice (https://www.raiffeisen.hu/documents/d/english/elhunyt_ugyfelek_bejelentesehez_kapcsolodo_adatkezelesi_tajekoztato).
- **Existing automation:** Romanian cross-bank death-notification service: not found.
- **Fit: 5 on structure, weak on evidence.** Multi-heir **open-waiting**. Heir name variants vs the certificate vs ID cards go to **contradicted** and need fuzzy matching. Insurance claim timers. Loan maturity continues during the wait.
- **Demo-ability: 4.** It is emotionally strong, but you need synthetic notary documents.

---

## 3. Card disputes, chargebacks & fraud/scam refund claims

- **What:** the cardholder disputes → issuer chargeback → merchant representment → pre-arbitration → arbitration. Separately, unauthorised or scam-payment claims are investigated (authorisation, SCA logs, police report, gross negligence) and refunded or rejected.
- **Rules/deadlines:**
  - **PSD2 Art 73:** refund an unauthorised transaction "immediately, and in any event no later than by the **end of the following business day**" (https://www.legislation.gov.uk/eudr/2015/2366/article/73). The Romanian transposition (Law 209/2019) text was not checked.
  - Report unauthorised operations within **13 months** of the debit (older OUG 113/2009 framework: https://legeaz.net/dictionar-juridic/operatiune-de-plata) [1 source].
  - Chargebacks: the **120-day** cardholder window is consistent across sources. Representment, pre-arbitration and arbitration windows (**9–45 days**) conflict across vendor blogs (e.g. https://chargebackhelp.com/2026-chargeback-time-limits-explained/). Use the network rulebooks instead.
  - **EU PSR provisional deal (27 Nov 2025):** the PSP must refund **bank-impersonation fraud** when the customer has reported to police and informed the PSP. Payee name/IBAN verification. Platforms liable to PSPs (https://www.taylorwessing.com/zh-hant/insights-and-events/insights/2025/11/eu-lawmakers-strike-a-deal-on-payments-reforms). Not yet in force.
- **Volume/cost:**
  - EEA payment fraud **€4.2bn in 2024** (EBA/ECB 2025 report: https://www.ecb.europa.eu/press/intro/publications/pdf/ecb.ebaecb202512.en.pdf).
  - Romania DNSC: fraud and attempted-fraud incidents **2,061 (2024) → 3,937 (2025)**; phishing **+70.6% to 4,975** (https://www.stiripesurse.ro/account-compromise-incidents-up-353-in-2025-phishing-incidents-rise-706-says-romanian-national-cybersecurity-directorate_3912298) [1 source].
  - GASA: average loss per Romanian victim **$512 (2024)** (https://www.mobilissimo.ro/stiri-diverse/fraudele-online-in-2024-cat-a-pierdut-in-medie-un-roman-si-care-sunt-cele-mai-frecvente-scheme) [1 source].
  - UK model: **89% (£243m)** of APP-scam losses reimbursed, 7 Oct 2024–31 Dec 2025. About **306k claims in 2025**, **83% closed within 5 business days** (https://www.psr.org.uk/information-for-consumers/app-scams-reimbursement-dashboard/).
  - Cost per chargeback is about **$128** (Mastercard figure as cited by a vendor; vendor-sourced: https://www.chargeflow.io/blog/cost-of-manual-vs-automated-chargeback-processing).
- **Raiffeisen-specific:** not found.
- **Existing automation:** **commoditised for card chargebacks**. FIS Dispute Management runs the whole representment → pre-arb → arbitration lifecycle (https://www.fisglobal.com/-/media/fisglobal/files/PDF/product-sheet/Infosheet_Dispute-Management.pdf), and the networks have their own platforms. The UK built a central claims system for APP-fraud reimbursement claims (Pay.UK RCMS: https://www.wearepay.uk/wp-content/uploads/2025/08/Pay.UK-APPR-RCMS-Product-Outline.pdf). **Scam-claim adjudication in the EU (PSR impersonation rule) has no off-the-shelf equivalent yet (inference).**
- **Fit: 4.** It is strong on the scam-claim side: a D+1 **timer**, evidence **open-waiting** (police report, customer statement), and **contradicted** when the customer says "I didn't authorise" but the SCA log shows app approval. Card chargebacks themselves are commoditised.
- **Demo-ability: 4.**

---

## 4. Customer complaints with legal deadlines (BNR/ANPC/CSALB)

- **Rules (different clocks per product, which is itself an argument for the engine):**
  - Payment services, PSD2 Art 101: reply within **15 business days**. In exceptional cases a holding reply, with the final reply in **≤35 business days** (https://www.legislation.gov.uk/eudr/2015/2366/article/101). Romanian transposition text not checked.
  - Consumer credit, OUG 50/2010 art 42: answer within **30 days** of registration (https://notari.pro/oug-50-2010-contractele-de-credit/art-42-informatii-si-drepturi-privind-contractele-de-credit).
  - Older BNR Reg. 9 (payment disputes): **30 days**, then escalation (https://infotva.manager.ro/articole/legislatie/regulamentul-bnr-nr-9-privind-procedura-de-solutionare-diferende-servicii-de-plata-dintre-utilizatori-si-prestatori-5886.html). Current status unverified.
- **Volume:**
  - CSALB **2024: 3,568 requests (2,644 against banks)**; banks accepted **1,077** negotiations (https://agerpres.ro/economic/2025/02/13/csalb-a-primit-18-300-de-cereri-de-solutionare-in-perioada-2016---2024-beneficiile-obtinute---14-3-m--1422200).
  - **2025: 2,866 (2,210 banks)**. **96% settled, average 13 days** (https://spotmedia.ro/stiri/economie/96-dintre-negocierile-din-2025-s-au-incheiat-cu-impacarea-partilor-intr-un-timp-mediu-de-doar-13-zile).
  - **9M-2025: 1,620 bank requests + 740 non-compliant (incomplete) requests** (CSALB T3-2025 report). The incomplete requests are evidence of a document-completeness problem.
  - **9M-2026: 2,287 bank requests vs 1,620 a year earlier (+41%)** [1 source; CSALB press release 20.10.2026 via search summary: https://alba24.ro/wp-content/uploads/2026/10/Crestere-cereri_Comunicat-de-presa-CSALB_20.10.2026.pdf].
  - ANPC said it receives "up to 100 complaints/day against banks" (undated, older: https://www.profit.ro/profitul-tau/servicii-financiare/banci/anpc-primeste-si-cate-100-de-reclamatii-pe-zi-de-la-clienti-impotriva-bancilor-14467702).
  - BNR annual petition statistics: not found.
- **Raiffeisen-specific:**
  - ANPC fined Raiffeisen **100,000 lei for not applying a court decision; about 14,000 clients affected** (date not confirmed: https://profit.ro/povesti-cu-profit/financiar/banci/ultima-ora-anpc-amendat-raiffeisen-bank-100-000-lei-pus-aplicare-decizie-instantei-circa-14-000-clienti-ar-afectati-practica-comerciala-declarata-incorecta-multe-instante-reactia-bancii-20382977).
  - ANPC fined 19 banks over instalment calculation; Raiffeisen won at first instance (https://profit.ro/povesti-cu-profit/financiar/banci/raiffeisen-bank-castiga-pe-fond-procesul-cu-anpc-privind-ratele-la-credite-21598838).
  - Raiffeisen complaint counts: **not found**. The 2024 sustainability report exists, but the data sits behind a sign-in (https://www.sustainabilityreports.com/raiffeisen-bank-s-a).
- **Existing automation:** CRM complaint modules are widespread (inference). The hard part is gathering evidence across core, card, CRM and call recordings against the right clock (inference).
- **Fit: 4.** Per-product **timers** (15/35 business days vs 30 days). Evidence **open-waiting** across internal systems. **Contradicted** when bank records conflict with the customer's claim. Repeat resolutions can be compiled into checks.
- **Demo-ability: 4.**

---

## 5. Restructuring/hardship → collections → enforcement → debt sale; personal insolvency

- **Restructuring/hardship:** the CSALB typology lists rescheduling, refinancing, renegotiation ("impreviziune"), ROBOR→IRCC, payment commitments and acceleration (CSALB T3-2025). These cases need income proof and hardship documents from the customer, so the case waits on the customer.
- **Dare în plată (Law 77/2016, transfer of the property in lieu of payment):** the creditor may contest the debtor's notice within **10 days**, and enforcement can be suspended meanwhile (jurisprudence: https://legeaz.net/spete-civil-2/contestatie-creditor-lg-77-2016-4802-2016). Bill texts mention a meeting **30–90 days** after notice (https://senat.ro/legis/PDF/2023/23L174FG.PDF). Adoption is unverified.
- **Enforcement/debt sale:**
  - ZF **estimate** of about 2,000 enforced home sales/month (undated estimate: https://www.zf.ro/banci-si-asigurari/bancile-executa-silit-2-000-de-locuinte-pe-luna-10755243).
  - KRUK Romania book value **>€400m**, buying at **up to 60%** of face value, NPL ratio **2.5% in early 2025** (https://www.zf.ro/zf-live/zf-live-monica-gratiela-cabat-kruk-romania-piata-credite-22943235) [1 source].
  - APS buying a €147m portfolio (https://profit.ro/stiri/recuperatorul-de-credite-aps-cumpara-un-nou-portofoliu-masiv-in-romania-20720011).
- **Personal insolvency (Law 151/2015):**
  - **641 requests from Jan 2018 to Sep 2024; 28 court-approved** (https://spotmedia.ro/stiri/social/tot-mai-multi-romani-isi-declara-insolventa-personala-cazuri-de-datorii-pana-la-500-000-de-euro-cine-poate-apela-la-aceasta-procedura).
  - 226 dossiers in 2025 vs 143 in 2023 (https://www.avocatnet.ro/t82352/faliment-personal-2026.html) [1 source].
  - Rules: debts must exceed assets by 15 minimum gross salaries (60,750 lei in 2025). Plan ≤5 years +12 months. Insolvency presumed after 90 days unpaid (spotmedia).
  - Creditor claim deadlines: **not found**.
  - **Volume is very low, so pain is low.**
- **Raiffeisen-specific:** not found.
- **Existing automation:** collections platforms are mature (inference). The documentary hardship assessment is less so (inference).
- **Fit: 4 for hardship/restructuring and dare în plată, 2 for insolvency.** Hardship files wait on income documents (**open-waiting**); stale payslips go to **expired**; the 10-day contest **timer** applies.
- **Demo-ability: 3.**

---

## 6. Garnishment (poprire) lifecycle per customer — strongest primary-source number

- **What:** an order arrives (ANAF via e-Popriri, or bailiffs/local tax offices) → block available funds → apply protected-income rules each time income lands → transfer to the creditor → partial releases or suspensions → lifting decision. One customer often has several creditors at several banks.
- **Volume (primary source):** ANAF S1-2025 activity report. Via **e-Popriri**, ANAF communicated **2,250,489 enforcement acts** to credit institutions:
  - **1,079,509 garnishment-establishment notices**
  - **1,125,352 lifting decisions** (this count includes some communicated by end-2024)
  - **26,631 suspension notices** (temporary, full or partial)
  - **18,997 continuation notices**

  In addition, **581,804** garnishment notices on sums owed to debtors by third parties were issued in H1 2025. Collections from bank-account garnishments were **+22.89% y/y**. Source: https://static.anaf.ro/static/10/Anaf/Informatii_R/18.08.2025%20-%20Raport%20de%20activitateANAF_2025S1_V7.pdf (read via pdftotext).
- **Rules:**
  - OPANAF 626/2023 obliges all banks to report available amounts via e-Popriri, to prevent over-collection when the debtor has accounts at several banks (https://economedia.ro/?p=124129; https://static.anaf.ro/static/10/Anaf/legislatie/OPANAF_626_2023.pdf).
  - Protected income: only the part above **½ of the minimum net salary** can be garnished; multiple garnishments are capped at **50%** of net monthly income [1 source: https://www.bzi.ro/poprire-pensie-2025-cum-pot-ramane-pensionarii-fara-bani-5224750].
  - A bill to protect balances **≤3,000 lei** is pending, status unknown (https://playtech.ro/2025/proiect-de-lege-in-parlament-suma-minima-de-3-000-de-lei-nu-va-mai-putea-fi-poprita-din-conturile-bancare/).
  - Garnishments from bailiffs and local authorities arrive outside e-Popriri, often on paper **(inference)**.
  - Statutory deadline for the bank to lift: **not found**.
- **Customer harm:** CSALB lists "refunds of garnished sums" as a dispute type (CSALB T3-2025). Over-collection across banks motivated the OPANAF 626/2023 order.
- **Raiffeisen-specific:** not found. Banks publish e-Popriri protocols, e.g. Intesa (https://www.intesasanpaolobank.ro/document/documents/ISPROMANIA/Protocoale-ANAF/protocol-ANAF-poprirea-electronica.pdf).
- **Existing automation:** the ANAF side is electronic. On the bank side, the per-customer lifecycle is likely partly manual: multiple creditors, monthly protected-income releases, paper bailiff orders and matching lifting decisions to the right order **(inference)**.
- **Fit: 5.** Multi-party **open-waiting**. A lifting decision that arrives for one order while another order is still active, or a bailiff order whose debtor name or CNP is slightly off, goes to **contradicted**, which needs the fuzzy matcher. Protected-income limits are **hard rules in code**. Recurring partial releases fire as **timers**.
- **Demo-ability: 4.** Synthetic ANAF and bailiff orders are easy to fake.

---

## 7. Payment account switching (Law 258/2017) & account closure

- **Rules:** Law 258/2017, in force since 27 Jan 2018. The new bank forwards the authorisation within **2 working days**; the old bank provides information within **5 working days**; transfer **≥13 working days** after authorisation. Free of charge, same currency only (BCR guide: https://cdn0.erstegroup.com/content/dam/ro/bcr/www_bcr_ro/Persoane-fizice/Documente-importante/Ghid_Mobilitatea_Conturilor.pdf; Eximbank: https://www.eximbank.ro/wp-content/uploads/2022/11/Ghid-cu-privire-la-serviciul-de-schimbare-a-conturilor-de-plati.pdf).
- **Volume:** EU-wide about **2.5M switches in 2023, 17.6M since 2016**. Uptake is low in some member states and **no revision of the directive is planned** (Commission 2nd Art-27 PAD report, Sept 2025: https://www.regulationtomorrow.com/2025/09/commission-issues-second-report-based-on-article-27-pad/). Romania-specific volume: **not found**.
- **Account closure:** not researched or found this session. Do not assume it is covered.
- **Raiffeisen-specific:** not found.
- **Fit: 3.** It is bounded, deterministic, with few exceptions; timers only.
- **Demo-ability: 3.** Low pain.

---

## 8. GDPR data-subject access requests (DSAR)

- **Rules:** reply within **one month, extendable by two further months** (GDPR Art 12(3); https://eur-lex.europa.eu/eli/reg/2016/679/oj, statutory text, not fetched this session).
- **EU evidence:** EDPB CEF 2024 report (Jan 2025) covered 30 DPAs and **1,185 controllers**. It found 7 challenges, including **no documented internal procedures**, barriers to making requests, and overly broad use of exemptions (https://www.edpb.europa.eu/news/cef-2024-edpb-identifies-challenges-to-the-full-implementation-of-the-right-of-access_en).
- **Romania:**
  - The DSAR-relevant case: ANSPDCP fined **Libra Internet Bank €11k** because it **could not prove it had replied** to a client's request (https://profit.ro/stiri/libra-bank-amendata-pentru-ca-ar-fi-trimis-un-raspuns-incomplet-la-o-solicitarea-unui-client-21122294).
  - **Raiffeisen fines, which concern security and data misuse, not DSAR:**
    - €150k reduced to €15k in court (2019, employee misuse; https://www.profit.ro/povesti-cu-profit/financiar/banci/raiffeisen-bank-obtine-in-instanta-in-urma-unei-decizii-definitive-reducerea-de-10-ori-a-unei-amenzi-de-150-000-euro-pe-subiectul-gdpr-20721151)
    - €20k (employees used client data: https://www.wall-street.ro/articol/Finante-Banci/312096/raiffeisen-bank-este-amendata-cu-20-000-de-euro-pentru-ca-niste-angajati-au-folosit-datele-clientilor.html)
    - €28k in 3 fines (documents emailed to the wrong recipient: https://profit.ro/stiri/raiffeisen-bank-romania-a-fost-amendata-cu-28-000-euro-pentru-mai-multe-incidente-privind-securitatea-datelor-clientilor-20923023)
- **Existing automation:** DSAR tooling is a commoditised vendor category (OneTrust and similar; inference, not researched).
- **Fit: 3.** It has a **timer** and multi-system collection (**open-waiting** per system), but few external parties. The engine's ledger gives "proof of reply", which is exactly what Libra lacked.
- **Demo-ability: 3.**

---

## 9. Collateral release (radiere ipotecă), early repayment, powers of attorney

- **Radiere:**
  - Mortgage release goes through a notary, then OCPI/ANCPI. Under most contracts the borrower pays the notary and ANCPI fees (commentary: https://avocatcivil.net/ncc-actualizat-comentat/art-2419) [1 source].
  - ING now lets clients close a mortgage in the app; the bank coordinates the release and emails confirmation once the declaration is authenticated and filed with OCPI (https://www.wall-street.ro/articol/banking/clientii-ing-isi-pot-inchide-creditul-ipotecar-direct-din-aplicatia-bancara.html).
  - For Noua Casă, FNGCIMM must also approve, within **30 days** (HotNews 2022).
  - "Radierea ipotecii" appears as a CSALB dispute type (CSALB T3-2025).
  - Release-duration statistics: not found.
- **Early repayment:** not researched in depth (not found this session).
- **Powers of attorney (procură):** checking against the notaries' national register of powers of attorney (RNNP): **not found** in search. That the UNNPR runs such a register is general knowledge, unverified.
- **Raiffeisen-specific:** not found.
- **Fit: 4 for radiere.** The case waits on the notary and OCPI (**open-waiting**) and on FNGCIMM for Noua Casă (**timer**). It closes only when a fresh CF extract shows the mortgage struck off (**satisfied by evidence, not by assertion**).
- **Demo-ability: 4.** A short loop that reuses the CF-extract parser from #1.

---

## Other retail open loops with evidence

- **Credit Bureau record deletion/dispute requests:** CSALB received **803 (9M-2024) → 500 (9M-2025)** such requests. Most are closed because special legislation applies (CSALB T3-2025). **Fit 3, demo 2.**
- **CSALB/ADR case handling itself (bank side):** a request becomes a dossier, then a conciliator proposal; the consumer's request is closed after 90 days of silence. Banks resolved **176** requests directly after CSALB was notified (9M-2025) (CSALB T3-2025). This could be modelled as a sub-flow of #4. **Fit 4.**

---

## Top 5 retail processes by (evidence of pain × fit)

| # | Process | Strongest number (source) | Pain | Fit | Engine states exercised |
|---|---|---|---|---|---|
| 1 | **Garnishment (poprire) lifecycle** | **1,079,509 establishment notices + 1,125,352 lifting decisions** sent to all banks via e-Popriri, ANAF only (S1-2025 report; lifting count spans end-2024 to 2025; one debtor gets a notice at each bank, so this is not a count of customers) | 5 | 5 | multi-creditor open-waiting, contradicted (lift vs active order, name/CNP variants), hard-coded protected-income rules, recurring timers |
| 2 | **Fraud/scam refund claims (+ card disputes)** | EEA payment fraud **€4.2bn in 2024** (EBA/ECB); fraud cyber-incidents reported to DNSC (Romania's national cybersecurity directorate; not bank claims) **2,061 → 3,937** in 2024 → 2025; EU PSR impersonation-refund rule agreed Nov 2025 | 5 | 4 | D+1 timer (PSD2 Art 73), open-waiting (police report), contradicted (claim vs SCA log). Card chargebacks are commoditised, so pitch the scam-claim side. |
| 3 | **Complaints & ADR (CSALB)** | **3,568 CSALB requests in 2024** (2,644 vs banks); bank requests **+41%** in 9M-2026 (2,287 vs 1,620); 740 incomplete requests in 9M-2025 | 4 | 4 | per-product timers (15/35 business days vs 30 days), evidence open-waiting, contradicted |
| 4 | **Mortgage origination / Noua Casă** | **334,048** state-guaranteed home loans 2009–2024 (Agerpres) [1 source]; FNGCIMM invalidates files for expired, missing or illegible documents | 4 | 5 | **expired** (CF extract 15/30-day validity), contradicted (CF owner vs contract), waiting on evaluator/notary/FNGCIMM, 18-month promise timer |
| 5 | **Deceased customer / succession** (ranked **on fit, not evidence**) | about 19k deaths/month in Romania (INS via press); up to about 20–30k Raiffeisen-customer deaths/year **(inference, upper bound)**; no release without a certificat de moștenitor | 3 | 5 | multi-heir waiting, fuzzy name matching across certificate and IDs, insurance timers |

Runners-up: mortgage release (radiere; fit 4, no volume data), hardship/restructuring (fit 4, CSALB typology only). Bottom: account switching and personal insolvency (very low volume or low pain).
