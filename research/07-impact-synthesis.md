# Impact synthesis: where the open-loop case engine applies

The details and sources for every number are in files 04 (retail), 05 (corporate and trade) and 06 (internal compliance and ops). Figures marked [1 source] or "vendor" are weaker evidence.

## One engine, many case types
Every process below has the same shape. A case has a goal and a checklist of requirements. Documents and replies arrive over days or weeks from several parties. Hard rules and legal clocks apply. Exceptions need a human. Only the template changes from process to process: requirements, rules, timers and allowed actions.

| # | Process | Area | Strongest number | Clock or rule that fits the engine |
|---|---|---|---|---|
| 1 | Corporate/SME onboarding and periodic refresh (KYB), **the demo** | Corporate | $2,598 and 95 days per corporate KYC review, 2023 (vendor survey) | AMLR from 10 Jul 2027: refresh every 1 or 5 years by risk (Art. 26); report a beneficial-owner mismatch within 14 days (Art. 24); trade-register certificate usually no older than 30 days (bank practice, not law [1 source]) |
| 2 | Tax garnishment orders (popriri): set, suspend, continue, lift | Retail/Ops | 2.25M enforcement acts sent by the tax authority (ANAF) in H1 2025 (1.08M orders, 1.13M lifts) | Protected-income limits; several creditors at once; monthly releases |
| 3 | Fraud and scam refund claims | Retail | €4.2bn payment fraud in the EEA in 2024 (EBA/ECB) | PSD2: refund unauthorised transactions by the end of the next business day; scams the customer authorised (impersonation fraud) get refunds only under the new EU rules agreed in Nov 2025, not PSD2 |
| 4 | Complaints and banking mediation (CSALB) | Retail | 2,644 mediation requests against banks in 2024; +41% in 2026 [1 source] | Legal answer deadlines: 15/35 business days (payments), 30 days (credit) |
| 5 | Mortgage origination / Noua Casă | Retail | 334k state home-loan guarantees since 2009; rejected mainly for missing or expired documents | Land-registry extract validity (15 vs 30 days, verify) |
| 6 | State/EU-guaranteed SME loans (FNGCIMM, BID, InvestEU) | Corporate | Raiffeisen BID convention: 710m lei ceiling, >1bn lei of loans, until 31 Dec 2027 [1 source] | Eligibility documents; guarantee claims |
| 7 | Insolvency creditor claims | Corporate | 7,553 company and sole-trader insolvencies in 2025 | Law 85/2014: claim filed within 45 days |
| 8 | Letter-of-credit discrepancy loop | Trade | 65–80% of documentary credits have discrepancies on first presentation (ICC) | Waiver and re-presentation loop (document checking itself is commoditised) |
| 9 | ASF staff register vs system access | Internal | Raiffeisen warned Nov 2024: 5 unnotified staff, discovery-to-notification took 89 days | Reconcile two records; "contradicted" state |
| 10 | DORA major-incident reporting | Internal | 3,383 major ICT incidents in EU finance in 2025, >60% at banks | 4h initial, 72h intermediate, 1-month final |
| 11 | AML: request info from client, then report a suspicious transaction | Internal | 22,470 suspicious-transaction reports in Romania in 2024, 68.55% from banks | 48h suspension window |
| 12 | DORA register of ICT suppliers | Internal | Only 6.5% of registers passed all data checks in the 2024 trial run | Missing mandatory fields |
| 13 | Deceased customer / succession | Retail | About 19k deaths a month in Romania | Notary heir certificate; heir name variants |

## Checks that repeat across processes
Fixes learned in one process transfer to others:
- **Document expired while the case waits:** trade-register certificate, land-registry extract, guarantee documents.
- **Name, address or ID variants:** beneficial owners, debtors, heirs, staff registers.
- **Two records disagree:** register vs internal data, an access list vs ASF notifications, a lift order vs an active order.
- **Legal clocks:** 14 days, 45 days, 4h/72h, next business day, 15/35/30 days.
