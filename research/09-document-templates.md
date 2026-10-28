# 08: Document templates for synthetic KYB and SME working-capital loan files

*Researched 2026-10-29 by a research agent (web search plus direct download and text extraction of ONRC, ANAF, Ministry of Finance and bank PDFs). Every factual claim carries its URL inline. Anything uncertain is marked.*

**Labels used throughout (same convention as file 05)**
- **[1 source]:** only one source supports the claim.
- **unverified:** the claim comes from a search-result summary, a secondary site, my own memory, or a page I could not fetch. Treat it as a hypothesis.
- **(inference):** my own reasoning, not a sourced fact.
- **not found:** I searched and found nothing. It does not mean the thing does not exist.
- **specimen:** a real, public ONRC or ANAF document used only as evidence of format. No identifier, name or address from any specimen appears in this file.

**Note on file numbering:** a different file named `08-market-competitors.md` already exists in this folder. This file was written to the exact path requested and no other file was modified.

---

## 0. TL;DR for the generator author

1. **Three ONRC documents are different things, and clients mix them up.** (a) Certificat de înregistrare (short, 9 fields). (b) Full certificat constatator (the one with associates, administrators, CAEN, status). (c) The "Annex 5" certificat constatator issued from a declaration on own responsibility (no associates, no administrators). Section 6 separates them.
2. **ONRC registration numbers have two live formats.** Old: `J35/1234/2017`. New: 14 characters `J` + year + 6-digit order number + 2-digit county code + 1 check digit. Both can appear for the same company, and the EUID is `ROONRC.` + the number. Details in 1.2.
3. **CUI check digit:** weights `7 5 3 2 1 7 5 3 2`, sum, times 10, mod 11, 10 becomes 0 (1.1). **ONRC number check digit:** sum of the digits (letter replaced by its ASCII code mod 10), mod 10 (1.2). I confirmed the second rule against three ONRC-issued specimens. The first rule I could not confirm against ANAF (its web service reset my connection).
4. **CNP:** `S AA LL ZZ JJ NNN C`, 13 digits. Do not print full CNPs. Use a masked form such as `1 800314 35 XXX C` (1.3).
5. **ID card series:** 2 letters + 6 digits ([official annex](https://media.hotnews.ro/media_server1/document-2021-03-10-24656651-0-forma-continut-carte-identitate.pdf)). The card has no postal code. The new electronic card does not print the address [1 source](https://en.wikipedia.org/wiki/Romanian_identity_card).
6. **The UBO declaration form has no percentage field.** The ownership share can only go in the free-text "Descriere" (section 4). That is the natural place to plant a discrepancy.
7. **Certificat constatator age:** banks commonly want it no older than 30 days (UniCredit states it in writing, section 9). Some want 15. The ANAF fiscal certificate has a 30-day usage period for legal entities ([ANAF](https://static.anaf.ro/static/10/Anaf/legislatie/referat_ordin_caf_06112019.pdf)).
8. **Abbreviated micro-entity F20 has no separate interest or depreciation line.** Interest is inside "Alte cheltuieli" (rd. 07) and depreciation inside "Ajustări de valoare" (rd. 06). A microentity file cannot give EBITDA or interest for DSCR without a trial balance (section 3). Emit a trial balance for every company; banks ask for one anyway.
9. **Principal repayment is not in the F20 at all.** The DSCR debt-service derivation is an inference (section 3).
10. **Synthetic identifiers:** CUIs in the 9xxxxxxx band, J-number order numbers at the top of the range, masked CNPs, fictional names carrying a "Demo/Test/Exemplu" token (1.8). I could not verify that the CUIs are unassigned.
11. **CAEN:** Rev.3 has been in force since 1 Jan 2025. Store Rev.2 and Rev.3 codes for each company (1.7).
12. **Eight profiles are in section 11**, one clean and seven with a planted problem, mixing five large cities and three small towns.

---

## 1. Value formats shared by all documents

### 1.1 CUI / CIF (tax identification number)

| Rule | Detail | Source |
|---|---|---|
| Length and form | 2 to 10 digits, no leading zero. May be prefixed `RO` when the entity is VAT-registered. CUI is for entities that must register with the trade register. CIF is the same number for entities that do not. | [python-stdnum `ro/cui.py`](https://raw.githubusercontent.com/arthurdejong/python-stdnum/master/stdnum/ro/cui.py) |
| Check digit | Take all digits except the last. Left-pad to 9 digits. Multiply position by position with `7 5 3 2 1 7 5 3 2` (this is the key 753217532). Sum, multiply by 10, take mod 11. If the result is 10, the check digit is 0. Compare with the last digit. | same |
| Confirmed against ANAF? | **No.** I tried the ANAF public VAT web service, [v9 endpoint listed on ANAF](https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/servicii_sincron.html) (per search summary, unverified). The connection was reset, so I could not test the algorithm or check that my CUIs are unassigned. | my attempt |

```python
def cui_check(body):            # body = all digits except the last
    w = (7, 5, 3, 2, 1, 7, 5, 3, 2)
    return str(10 * sum(a * int(b) for a, b in zip(w, body.zfill(9))) % 11 % 10)
```

### 1.2 ONRC registration number ("număr de ordine în registrul comerțului") and EUID

| Item | Old format | New format |
|---|---|---|
| Shape | `J35/1234/2017`: letter, county number, serial (max 5 digits), year ([stdnum](https://raw.githubusercontent.com/arthurdejong/python-stdnum/master/stdnum/ro/onrc.py)) | `YAAAAXXXXXXJJC`, 14 characters ([Fiscalitatea](https://www.fiscalitatea.ro/onrc-informatii-privind-noul-format-a-numarului-de-ordine-din-registrul-comertului-23681/), [Contabilul](https://contabilul.manager.ro/a/28861/atentie-iata-noul-format-al-numarului-de-ordine-din-registrul-comertului.html)) |
| Letter | `J` legal entities, `F` PFA / II / IF, `C` cooperatives | same |
| Year, order number | year of registration; serial | `AAAA` year; `XXXXXX` order number padded to 6 digits, counted separately per register type |
| County `JJ` | county in the number | `00` for professionals registered after **26.07.2024**. Earlier ones carry the code of the county of their last headquarters. |
| Check digit `C` | none | algorithm in the next row |
| When it applies | until 2024 | New ONRC IT system went live on 26.07.2024. Numbers assigned before that date are converted only when the company files a mention changing name, registered office, main activity or legal form (Fiscalitatea link above). |

- **Check digit (new format):** replace the letter by `ord(letter) % 10`, sum all digits except the last one, take mod 10 ([stdnum `onrc.py`](https://raw.githubusercontent.com/arthurdejong/python-stdnum/master/stdnum/ro/onrc.py)). **I tested this rule on three ONRC-issued specimen numbers from public PDFs, and all three passed**, so it matches ONRC output and not only the library. Specimens: [one](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/CUI-Anexa/Certificat-Sucursala-Caracal.pdf), [two](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/CUI-Anexa/Certificat-Sucursala-Dacia-Constanta.pdf), [three](https://www.unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/CUI-Anexa/Certificat-Constatator-Constanta2.pdf).
- **County codes in the J-number (inference):** they appear to be the same alphabetical numbers as the CNP county codes (see 1.3). This rests on three specimens: Constanța 13 and Olt 28 in the specimens linked above, and Bucharest 40, which the library's county list gives and which I did not see printed on a specimen I fetched myself. Valid old-format counties in the library are 1 to 40, 51 and 52 ([stdnum](https://raw.githubusercontent.com/arthurdejong/python-stdnum/master/stdnum/ro/onrc.py)).
- **Do not attribute the new format to Law 265/2022.** My two sources tie it to the new IT system of 26.07.2024. Law 265/2022 entered into force on 26.11.2022 ([ONRC notice](https://www.onrc.ro/documente/Comunicat%20_Legea%20265.doc), via fetched summary), and its Order 5307/C/2022 sets the EUID structure and certificate formats and repeals Orders 3117/C/2004, 1355/C/2009 and 1876/C/2017 ([order text](https://www.onrc.ro/documente/legislatie/ORDIN%20nr.%205307%20_%202022.docx)). The order text I extracted does not show the EUID structure itself (Article 6 came out empty).
- **EUID in the specimens:** the literal prefix `ROONRC.` followed by the registration number. For a new-format number the EUID uses the 14-character string. For an old-format number the specimen EUID writes the county with a leading zero (`J09/…`) while the number field writes `J9/…`. This is primary evidence for an **identifier-variant case**: one company, several string forms. Issuing a new certificate with the EUID is optional ([ONRC](https://onrc.ro/index.php/ro/mentiuni/persoane-juridice/alocarea-identificatorului-unic-la-nivel-european-euid)), so old documents without it stay valid.

```python
def onrc_check(num14):          # num14 includes a placeholder last char
    s = str(ord(num14[0]) % 10) + num14[1:]
    return str(sum(int(c) for c in s[:-1]) % 10)
```

### 1.3 CNP (Cod Numeric Personal): structure only

Structure `S AA LL ZZ JJ NNN C`, 13 digits ([cnp-spec](https://github.com/vimishor/cnp-spec/blob/master/spec.md), [python-stdnum `ro/cnp.py`](https://raw.githubusercontent.com/arthurdejong/python-stdnum/master/stdnum/ro/cnp.py)).

| Part | Meaning | Source |
|---|---|---|
| `S` | 1 male / 2 female born 1900–1999; 3 / 4 born 1800–1899; 5 / 6 born 2000–2099; 7 / 8 resident foreigner (male / female). The spec defines 1–8 only; a `9` is **unverified**. | cnp-spec |
| `AA LL ZZ` | last two digits of birth year, month, day | cnp-spec |
| `JJ` | county code: 01 Alba … 39 Vrancea in alphabetical order, 40 București, 41–46 București sectors 1–6, 47–48 abolished sectors, 51 Călărași, 52 Giurgiu. A code `70` also appears in the table as a county-independent code ([ro.wikipedia](https://ro.wikipedia.org/wiki/Cod_numeric_personal_(Rom%C3%A2nia))); meaning of use unverified. | cnp-spec, ro.wikipedia |
| `NNN` | sequence number 001–999 separating people with the same sex, county and birth date | cnp-spec |
| `C` | multiply the first 12 digits by `2 7 9 1 4 6 3 5 8 2 7 9` (key 279146358279), sum, mod 11. If 10, then 1. | cnp-spec, stdnum |

- **Generator rule (inference):** never emit a full CNP. If a field must be checksum-valid, use `NNN = 000`, which the spec's 001–999 range suggests is never assigned to a real person. I did not test whether common validators accept it; check with the team's validator.
- The ID-card MRZ carries the CNP without the digits that encode the birth date ([official annex](https://media.hotnews.ro/media_server1/document-2021-03-10-24656651-0-forma-continut-carte-identitate.pdf)).

### 1.4 Romanian address format and postal codes

- **Field order used on ONRC forms:** `localitatea, str., nr., bl., scara (sc.), etaj, ap., județ/sector, țara` ([BO form](https://onrc.ro/templates/site/formulare/Declaratie%20privind%20beneficiarii%20reali%20-%20semnatura%20privata-nr.6A.pdf); [model articles of association in Order 5307/C/2022](https://www.onrc.ro/documente/legislatie/ORDIN%20nr.%205307%20_%202022.docx)).
- **ONRC-issued documents do not format addresses uniformly** (observed in the specimens linked in 1.2): county first in some (`Jud. X, Municipiul Y, Strada …`) and last in others (`…, Județ X`); "Bl." in some, "Bloc" in others; street names in capitals; a street type word followed by a name that starts with another street type word (`Strada CALEA …`); a registered-office text sometimes ends with a free-text qualifier in brackets. This is the basis for the address-variant problem (section 10).
- **Street-type words seen in ONRC-issued specimens:** "Strada", "Calea", "B-dul" (and "Bulevardul" in full form is a likely variant, unverified). Generator variants to emit: `Str.` / `Strada`, `Bd.` / `B-dul` / `Bulevardul`, `Calea`, `Șos.` / `Șoseaua` (the last is unverified), with `nr.` / `Nr.` / `numărul`, `bl.` / `Bl.` / `Bloc`, `sc.` / `Scara`, `ap.` / `Apartament`.
- **Postal code rules** ([Wikipedia](https://en.wikipedia.org/wiki/Postal_codes_in_Romania), 1 source):
  - Six digits since 1 May 2003. First two digits identify the county or, for Bucharest, the sector (`01xxxx` to `06xxxx`). Examples: `03xxxx` Bucharest sector 3, `30xxxx` Timiș, `40xxxx` Cluj, `70xxxx` Iași, `72xxxx` Suceava, `10xxxx` Prahova, `80xxxx` Galați, `90xxxx` Constanța.
  - The remaining four digits, by size: `0xxx` to `4xxx` for larger cities and Bucharest sectors, where a code identifies a street address or a small group of addresses; `5xxx` to `6xxx` for smaller cities, where **one code ending in `00` covers the whole city**; `7xxx` for villages, one code each.
  - "Larger" means a population over 50,000 per the same page.
  - Poșta Română runs the official lookup ([link given on the Wikipedia page](https://www.posta-romana.ro/cauta-cod-postal.html)). A 2022 plan to replace geographic codes with personal codes is reported ([Playtech](https://playtech.ro/2022/se-schimba-codurile-postale-in-romania-cel-mai-nou-proiect-revolutionar-initiat-de-posta-romana/)); I did not find that it was implemented.
  - **Generator rule (inference):** for big-city addresses emit a structure-valid code (`county prefix` + `0xxx`–`4xxx`). For small towns emit `county prefix` + `5xxx`/`6xxx` ending in `00`. Mark them synthetic; they may not match real streets.
- The ID card does not print a postal code (field list in section 5).

### 1.5 Diacritics

The ONRC order text and the ONRC certificate specimen I extracted both use the old **cedilla** letters (ş, ţ) in running text ([order](https://www.onrc.ro/documente/legislatie/ORDIN%20nr.%205307%20_%202022.docx), [specimen docx](https://infotva.manager.ro/dbimg/files/CCFIL-Certificat%20constatator%20de%20baza-v14.docx)). The modern standard uses comma-below (ș, ț) (my general knowledge, unverified here). Emit both spellings, and also the no-diacritics form, as variants for the fuzzy matcher.

### 1.6 Local-currency and date conventions

The ONRC specimens show capital in `RON`, dates as `dd.mm.yyyy`, and the financial-statement forms use "lei" ([specimen](https://infotva.manager.ro/dbimg/files/CCFIL-Certificat%20constatator%20de%20baza-v14.docx), [OMF 1194/2025](https://startupcafe.ro/wp-content/uploads/2025/08/OMF1194_mo730_05082025.pdf)).

### 1.7 CAEN (activity classification)

- **CAEN Rev.3** entered into force on 1 Jan 2025 under INS Order 377/17.04.2024. ONRC says the update window is 18 months from 25 March 2025, during which both versions are accepted ([ONRC CAEN page](https://onrc.ro/index.php/ro/caen)). That window ended about 25 Sep 2026 per ONRC; one article says it was extended to 25 March 2027 ([Contabilul](https://contabilul.manager.ro/a/30288/guvernul-a-prelungit-termenul-pentru-trecerea-la-caen-rev-3-pana-la-25-martie-2027.html)): **unverified, conflicting.**
- ONRC publishes a correspondence table ([xlsx, Sep 2026](https://onrc.ro/documente/anunturi/Tabel-Corespondenta-CAEN-Rev.2-CAEN-Rev.3_septembrie-2026.xlsx)). The Rev.2 to Rev.3 pairs in section 11 come from it.
- Whether a given 2026 certificate shows Rev.2 or Rev.3 codes is not stated on the ONRC page. **Generator rule:** emit both codes, and make a mismatch between documents a legitimate test case.

### 1.8 Synthetic-data safety rules (all inference unless linked)

- **Names:** every company name and person carries an obvious token ("Demo", "Test", "Exemplu", or surnames ending in "-escu" that are invented such as "Exemplescu"). No real company or person was reused.
- **CUIs:** 8-digit numbers starting with `9`, check digit valid. I believe current allocation is below that band, but **this is unverified**, and the ANAF check failed. Before the demo, run each generated CUI through ANAF's public VAT service and regenerate any that return found.
- **J-numbers:** order numbers chosen at the top of the range (5-digit serial of 90000 or higher for converted old-style numbers; 6-digit serial of 900000 or higher for post-26.07.2024 numbers), because no county-year plausibly reaches those. Inference.
- **CNPs:** masked, never complete (1.3).
- **ID series/numbers:** see section 5.
- **Specimens:** the public ONRC/UniCredit PDFs are linked as format evidence only. Do not copy their identifiers, addresses or signatory names into the data.

---

## 2. Loan application (cerere de finanțare / cerere de credit IMM)

**What exists publicly.** I found no public Romanian corporate "cerere de credit" with a "scopul creditului / garanții propuse" block ("not found"). The closest real artefact is Raiffeisen's business credit-line request, form `F1 – cod 1.2.2.02-7, ed.4/0` ([PDF](https://www.raiffeisen.ro/content/dam/rbi/retail/eu/ro/documents/pj/Cerere-acordare-limita-de-credit-si-emitere-card-Visa-Business.pdf)). **It is a Visa Business card credit-line application, not a term-loan form**, so use it as a layout template and add loan fields by design (inference). Banca Transilvania's IMM Invest form could not be fetched (the file returned HTML), so it is not used.

**Real labels from the Raiffeisen form, in order** (text extracted from the PDF; diacritics restored by me):

| Real label | Example synthetic value | Notes |
|---|---|---|
| Titlu: "Cerere privind acordarea/redimensionarea Liniei de credit și emiterea Cardului Visa Business Raiffeisen Bank" | (adapt to "Cerere de finanțare capital de lucru") | card product specific |
| **Date generale despre solicitant** (se completează datele Persoanei Juridice) | | |
| Denumirea societății | Banat Cargo Demo S.R.L. | |
| CUI | 98735747 | 1.1 |
| Data înființării | 12.04.2017 | |
| Adresa | Timișoara, Str. … | must be cross-checked against the ONRC certificate |
| Activitatea principală desfășurată | Transporturi rutiere de mărfuri | cross-check against CAEN |
| Cifra de afaceri (la ultimul an încheiat) | 6.400.000 lei | cross-check against F20 rd. 01 |
| Telefon fix / Telefon mobil / E-mail | fictional | |
| reprezentată prin: 1. … în calitate de …; 2. … în calitate de … | "Radu Demovici, administrator" | cross-check against the certificate's administrator and powers |
| **Solicităm:** acordarea unei Linii de credit … cu o limită de credit în valoare de ___ RON / majorarea / diminuarea | 900.000 RON | Raiffeisen's overdraft rules: minimum 7.000, maximum 35% of turnover, 12 months, extendable ([Raiffeisen](https://www.raiffeisen.ro/ro/imm/produse-si-servicii/finantare/linie-de-credit.html)) |
| Rambursare: debitarea contului IBAN `RO __ RZBR ______` cu 10% / 100% din Soldul final | IBAN of a fictional account | IBAN has the bank code `RZBR` for this bank in the form. Do not invent real-looking account numbers under a real bank code (inference). |
| **Asociați/administratori:** Nume/Prenume · Procent · CUI/CNP · Telefon mobil · Telefon fix | table of 1–3 rows | **natural cross-check: share % here vs ONRC certificate vs UBO declaration** |
| **Informații despre grup** (dacă este cazul): Nume (denumire și formă juridică) · Structura acționariat · Telefon fix · Procent · Cifra de afaceri (ultimul bilanț anual) · Motivul asocierii în grup | empty for most profiles | group-of-connected-clients concept, useful for P8 |
| **Aspecte legale** (DA/NU, SUMA): Litigii inițiate împotriva societății, asociaților sau administratorilor · Popriri, proceduri de executare silită · Faliment · Concordat preventiv/Mandat ad-hoc · Altele | DA/NU + amount | tie to tax-debt profile (P2) |
| Declarations a–m (read terms; CRC BNR consultation; CIP consultation; accuracy under penalty; bank may grant a lower limit or refuse) | signed | bank may consult the Central Credit Register |
| Card-user block: Nume și prenume · Funcția · CNP · B.I./C.I. seria/număr · Eliberat de · La data de · Data nașterii · Locul nașterii · Adresa · Numele mamei înainte de căsătorie · politically-exposed-person tick (Legea 656/2002, art. 3) | skip for a loan | useful for the signatory block |

**Fields to add by design (inference, no public form found):** requested amount and currency, tenor, purpose, proposed collateral, date and place, signatory name, capacity and signature, attachments checklist.

**IMM declaration side-document.** State-guaranteed IMM programs also need a declaration of SME status (autonomous, partner or linked enterprise; headcount, turnover). The Banca Transilvania template has Section A for partner enterprises and Section B for linked enterprises ([BT annex 1b](https://www.bancatransilvania.ro/files/app/media/Index/Companii/Ajutor-minimis/Plata-ajutor-stat/Declaratie-incadrare-intreprindere-mica-si-mijlocie.pdf), via search summary, unverified). FNGCIMM says financial data in the IMM declaration go in thousands of lei or euros at the BNR rate for the year of the approved statements ([FNGCIMM IMM Invest 2022](https://www.fngcimm.ro/attachment/Ag0cJ_IMM%20INVEST%202022%202.pdf), via search summary; the PDF itself was image-only).

---

## 3. Annual financial statements (situații financiare anuale: F10 and F20)

**Legal basis.** OMFP 1802/2014 (accounting rules), with the 2025 year-end filing aspects in **OMF 2.036/23.12.2025** ([ANAF code table](https://static.anaf.ro/static/10/Anaf/Declaratii_R/situatiifinanciare/2025/1002_5_2025.html), 1 source). Size thresholds for micro, small, medium and large were updated by Order 107/2025 for 2024 statements (per a search summary of a [Forvis Mazars note](https://www.forvismazars.com/ro/en/content/download/1232558/file/2838637); **unverified, thresholds not read**).

**Caveat on the row numbers below.** I could not get the annual form text. The labels and row numbers come from the **30 June 2025 half-year reporting order, OMF 1194/2025** ([Monitorul Oficial 730/05.08.2025](https://startupcafe.ro/wp-content/uploads/2025/08/OMF1194_mo730_05082025.pdf)), which reproduces forms of the same name. **Rows are as in the half-year form; the annual rows are unverified.** The annual set for a microentity is F10, abbreviated F20, F30 "Date informative" and F40 "Situația activelor imobilizate" (per [Contabilul](https://contabilul.manager.ro/a/18263/microintreprindere-si-impozit-de-1-ce-situatii-financiare-se-depuns.html), search summary, unverified).

### 3.1 Header block of F10 (and the other forms)

| Real label (from OMF 1194/2025) | Example synthetic value | Notes |
|---|---|---|
| Județul | Timiș | |
| Entitatea | Banat Cargo Demo S.R.L. | |
| Adresa: localitatea, sectorul, str., nr., bl., sc., ap. | Timișoara, Str. … | |
| Telefon, fax | fictional | |
| Număr din registrul comerțului | `J35/91204/2017` or the 14-character form | old/new variant case |
| Forma de proprietate | `35` (the order's code list shows "35 Societăți cu răspundere limitată" under "30 PROPRIETATE INDIVIDUALĂ — PRIVATĂ") | code list read from a column-layout PDF extraction, so verify the code against the order before relying on it ([OMF 1194/2025](https://startupcafe.ro/wp-content/uploads/2025/08/OMF1194_mo730_05082025.pdf)) |
| Activitatea preponderentă (denumire clasă CAEN) · Cod clasă CAEN | Transporturi rutiere de mărfuri · 4941 | |
| Activitatea preponderentă efectiv desfășurată (denumire clasă CAEN) · Cod clasă CAEN | same | |
| Cod unic de înregistrare | 98735747 | |
| Cod LEI | usually empty | |

### 3.2 F10 "Situația activelor, datoriilor și capitalurilor proprii" (cod 10), labels only

Columns: `Denumirea elementului | Nr. rd. | Sold la 01.01.XXXX | Sold la 31.12.XXXX`. Sections in order: **A. ACTIVE IMOBILIZATE** (I. Imobilizări necorporale, II. Imobilizări corporale, III. Imobilizări financiare, ACTIVE IMOBILIZATE – TOTAL); **B. ACTIVE CIRCULANTE** (I. Stocuri, II. Creanțe, III. Investiții pe termen scurt, IV. Casa și conturi la bănci, ACTIVE CIRCULANTE – TOTAL); **C. CHELTUIELI ÎN AVANS**; **D. DATORII: sumele care trebuie plătite într-o perioadă de până la un an**; **E. ACTIVE CIRCULANTE NETE / DATORII CURENTE NETE**; **F. TOTAL ACTIVE MINUS DATORII CURENTE**; **G. DATORII: sumele care trebuie plătite într-o perioadă mai mare de un an**; **H. PROVIZIOANE**; **I. VENITURI ÎN AVANS**; then capital and reserves ending in **CAPITALURI PROPRII – TOTAL** ([OMF 1194/2025](https://startupcafe.ro/wp-content/uploads/2025/08/OMF1194_mo730_05082025.pdf)). The form also lists the account (ct.) formulas for each line, which a trial-balance-based generator can reuse.

### 3.3 F20 "Contul de profit și pierdere" (cod 20)

Full form for small, medium and large entities (rows as in the half-year form, unverified for annual):

| Row label | rd. | Use for the credit file |
|---|---|---|
| 1. Cifra de afaceri netă | 01 | turnover; cross-check with the loan application and the certificate's financial block |
| VENITURI DIN EXPLOATARE – TOTAL | 16 | |
| 9. Cheltuieli cu personalul | 24 | |
| 10.a) Ajustări de valoare privind imobilizările corporale și necorporale; a.1) Cheltuieli de exploatare privind amortizarea | 27; 28 | depreciation |
| CHELTUIELI DE EXPLOATARE – TOTAL | 54 | |
| PROFITUL SAU PIERDEREA DIN EXPLOATARE (profit / pierdere) | 55 / 56 | operating result |
| 14. Venituri din dobânzi | 59 | |
| 18. Cheltuieli privind dobânzile (ct. 666) | 68 | interest expense |
| CHELTUIELI FINANCIARE – TOTAL | 71 | |
| VENITURI TOTALE (rd. 16 + 64) | 74 | |
| CHELTUIELI TOTALE (rd. 54 + 71) | 75 | |
| PROFITUL SAU PIERDEREA BRUTĂ (profit / pierdere) | 76 / 77 | |
| 20. Impozitul pe profit | 78 | |
| PROFITUL SAU PIERDEREA NETĂ A PERIOADEI DE RAPORTARE (profit / pierdere) | 83 / 84 | |

Abbreviated form for **microentities** ("Contul prescurtat de profit și pierdere"): rd. 01 Cifra de afaceri netă, 03 Alte venituri, 04 Costul materiilor prime și al consumabilelor, 05 Cheltuieli cu personalul, **06 Ajustări de valoare**, **07 Alte cheltuieli** (the account list includes ct. 666, interest), 10 Impozite, 11 Venituri din impozitul pe profit…, 12 Profit net, 13 Pierdere netă ([same source](https://startupcafe.ro/wp-content/uploads/2025/08/OMF1194_mo730_05082025.pdf)). The ct. 681 (amortization) account sits inside rd. 06 together with other value adjustments.

**Consequence for DSCR (inference, based on the form layouts above):**
- Full F20: EBITDA is derivable from rd. 55 plus depreciation (rd. 28 and related lines). Interest is rd. 68.
- Micro F20: neither interest nor depreciation is isolated. The generator must also emit a **trial balance (balanța de verificare)**. Banks require it anyway (Raiffeisen: [latest trial balance](https://www.raiffeisen.ro/ro/imm/produse-si-servicii/finantare/linie-de-credit.html); UniCredit: [trial balance for each annual statement plus the last closed month](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/DocumenteSME/Documentatie-solicitare-credit-SRL-sau-SA-Micro.pdf)).
- **Principal repayment is not in the F20 or the F10 flow.** It must come from the loan schedule or from the long-term debt accounts. Any "debt service" figure is therefore a derived value (inference).

### 3.4 F30 and F40; filing evidence

- F30 "Date informative" exists in the set (micro and others) and has rows on overdue payments ("plăți restante") ([OMF 1194/2025](https://startupcafe.ro/wp-content/uploads/2025/08/OMF1194_mo730_05082025.pdf)). It is also where the "number of employees" style data lives (unverified row detail).
- **UniCredit's conditions for statements not generated from the ANAF site** are a ready-made list of file defects: filing stamp with date and number, or ANAF filing receipt; each form signed by the administrator; each form signed at "Întocmit"; each form carrying "VALIDAT"; complete set F10, F20, F30 and F40 ([UniCredit](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/DocumenteSME/Documentatie-solicitare-credit-SRL-sau-SA-Micro.pdf)). Footer of each form: representative name, capacity, signature, and professional-body registration number for the accountant ([OMF 1194/2025](https://startupcafe.ro/wp-content/uploads/2025/08/OMF1194_mo730_05082025.pdf)).

---

## 4. Beneficial owner declaration (declarația privind beneficiarul real)

**Authority and basis.** Filed with ONRC (the trade register) under **Law 129/2019, art. 56** (para. 14 added by Law 315/2021), as amended by **OUG 123/2022** ([ONRC page](https://onrc.ro/index.php/ro/mentiuni/persoane-juridice/inregistrarea-datelor-din-declaratia-privind-beneficiarul-real)). Two form models: **no. 6** (declaration made before the ORC director) and **no. 6A** (declaration under private signature, "formular editabil") ([Fiscalitatea, 21 Jul 2021](https://www.fiscalitatea.ro/onrc-anunta-ca-au-fost-elaborate-noi-modele-de-declaratii-privind-beneficiarii-reali-21240/)).

**Mismatch to know about:** the ONRC page and file names call them forms 6 and 6A, but the printed header of the downloaded PDFs reads **"Formular nr.3"** (form 6) and **"Formular nr.3a"** (form 6A) ([form 6A PDF](https://onrc.ro/templates/site/formulare/Declaratie%20privind%20beneficiarii%20reali%20-%20semnatura%20privata-nr.6A.pdf), [form 6 PDF](https://onrc.ro/templates/site/formulare/Declaratie%20privind%20beneficiarii%20reaii-orct-nr.6.pdf)). The ONRC completion guide linked from the page returned a one-page "Document în lucru" placeholder, so it adds nothing.

**Real field list of form 6A (text extracted from the official PDF; diacritics restored by me):**

| Section / label | Example synthetic value | Notes |
|---|---|---|
| Header: MINISTERUL JUSTIȚIEI · OFICIUL NAȚIONAL AL REGISTRULUI COMERȚULUI · OFICIUL REGISTRULUI COMERȚULUI DE PE LÂNGĂ TRIBUNALUL ______ | ORC pe lângă Tribunalul Timiș | |
| **II. DECLARAȚIE PRIVIND BENEFICIARII REALI**, tick one: înmatriculare · modificare · eroare materială · anual (persoane prevăzute la art. 56 alin. (13)) · art. 56 alin. (14) (firme înmatriculate înainte de intrarea în vigoare a legii) · regii autonome / societăți deținute integral sau majoritar de stat (art. II OUG 123/2022) | "modificare" | |
| **III.** (Nr. înregistrare) ___ · (Data) ___ | filled by ORC | |
| **IV. Subsemnatul(a)** Nume, Prenume, posesor al actului de identitate ___, seria ___, nr. ___, CNP ___, în calitate de reprezentant legal al ___, având număr de ordine în registrul comerțului ___, CUI ___, EUID ___, declar pe proprie răspundere, în conformitate cu art. 56 din Legea 129/2019, cunoscând dispozițiile art. 326 Cod penal, că beneficiarul/beneficiarii real/i … precum și modalitatea de exercitare a controlului sunt: | administrator Radu Demovici, ID series `ZQ` + 6 digits, CNP masked, CUI, J-number, EUID | the declarant is the legal representative |
| **Per beneficial owner (up to 3 blocks on the form):** Nume · Prenume · Data nașterii · locul nașterii (localitate) (județ/sector/țară) · CNP · act identitate · seria · nr. · cetățenie · domiciliu/reședința: țara · localitatea · str. · nr. · bloc · scara · etaj · ap. · județ/sector | | foreign citizens give the locality and country of birth (footnote on the form) |
| Basis, tick one per owner: art. 4 alin. (2) lit. a) pct. 1 · lit. a) pct. 2 · lit. d) pct. 1 · pct. 2 · pct. 3 · pct. 4 din Legea 129/2019 | lit. a) pct. 1 | I could not read the meaning of each tick; pct. 1 is the 25%-ownership criterion per secondary sources (below). Others unverified. |
| **Descriere:** ______ (free text) | "Deține 51% din părțile sociale" | **the only place for the percentage** |
| **V.** Declaration and ID copy filed by: reprezentantul legal, or **împuternicit**: Nume, Prenume, act identitate, seria, nr., CNP, **conform ______ nr. ___ din ___** | mandate reference | evidence that a mandate reference is part of the form |
| **VI. Persoana desemnată pentru comunicări:** Nume, Prenume; e-mail; telefon | | |
| **VII.** data-protection acknowledgement; Nume și prenume; Data; Semnătura | | |
| **VIII.** (form 6 only) "Prezenta declarație a fost dată în fața mea ___, director/înlocuitor al directorului ORC pe lângă Tribunalul ___" | | |

**Key facts for the data design**
- **There is no field for ownership percentage.** The form records who is a beneficial owner, how control is exercised (via the tick and the "Descriere"), and identity data. A discrepancy against the ONRC certificate's share table therefore shows up as a *person missing* or a *person present with an unverifiable description*, not as a numeric mismatch on the form itself (inference from the form).
- **Threshold:** secondary sources describe the Law 129/2019 criterion as "at least 25% plus one share" or "over 25%" ([Fiscalitatea](https://www.fiscalitatea.ro/legea-1292019-ce-inseamna-beneficiar-real-si-care-sunt-obligatiile-declarative-aferente-23866/)). AMLR Art. 52 moves to "25% or more" from 10 Jul 2027 ([file 05](05-corporate-trade-open-loop-processes.md), citing [theKYB](https://thekyb.com/blog/7-things-that-change-about-beneficial-ownership-verification-under-amlr/), vendor blog). **A holder at exactly 25.0% is therefore a genuine boundary test case.** The consolidated legal text was not checked (unverified).
- **Attachments to the filing:** the declaration (original); a copy of the applicant's ID; if applicable, a special power of attorney in authentic form, a lawyer's power of attorney or a delegation (original) ([ONRC page](https://onrc.ro/index.php/ro/mentiuni/persoane-juridice/inregistrarea-datelor-din-declaratia-privind-beneficiarul-real)).
- **When filed:** at registration and after each change. Annually, within 15 days of approving the annual statements, for companies with legal-entity shareholders or with a seat in a non-cooperative or high-risk jurisdiction (same ONRC page).
- **Filing methods:** counter, post or courier, or electronic with a qualified electronic signature (same page).
- **Banks do not rely on the register alone:** they run their own ownership analysis and ask for documents for each ownership level ([Profit.ro](https://profit.ro/legal/provocarile-deschiderii-de-conturi-bancare-si-actualizarii-datelor-la-banca-identificarea-beneficiarului-real-21867317)).

---

## 5. Romanian identity card (cartea de identitate) for each beneficial owner (25% or more)

**Basis for the physical card format.** Annex 2, "Forma și conținutul cărții de identitate" ([PDF](https://media.hotnews.ro/media_server1/document-2021-03-10-24656651-0-forma-continut-carte-identitate.pdf); the act number was not visible in the extract, unverified).

| Label (as listed in the annex) | Example synthetic value | Notes |
|---|---|---|
| denumirea statului; denumirea documentului | ROMÂNIA / CARTE DE IDENTITATE | |
| **seria, compusă din două litere, și numărul, compus din 6 cifre** | `ZQ 123456`-style (invented series) | real series are tied to issuing counties (e.g. DP, DR, DT, RD, RR, RT, RX, RK for Bucharest; KX, CJ Cluj; MX, MZ, IZ Iași; [Wikipedia](https://en.wikipedia.org/wiki/Romanian_identity_card)). Use a series that is not a known county series, and mark it fictional (inference). |
| denumirea structurii emitente (e.g. a "SPCLEP …"), initiale județ, cod structură | SPCLEP-style text | older-card wording per Wikipedia (1 source) |
| termenul de valabilitate | dd.mm.yyyy | |
| fotografia titularului | placeholder image | |
| codul numeric personal | masked CNP | 1.3 |
| numele de familie și prenumele | | |
| cetățenia | română | |
| locul nașterii | | |
| sexul | M / F | |
| domiciliul | on the older card | **not printed on the new ID-1 electronic card (signature instead) [1 source](https://en.wikipedia.org/wiki/Romanian_identity_card)** |
| MRZ (two machine-readable lines) | | contains document type, issuing country, name, series and number, citizenship, date of birth, sex, validity, and the CNP minus the birth-date digits ([annex](https://media.hotnews.ro/media_server1/document-2021-03-10-24656651-0-forma-continut-carte-identitate.pdf)) |

- **Validity by age, older ID-2 card [1 source]:** 4 years for ages 14–17, 7 for 18–24, 10 for 25–54, no expiry from 55 (with a travel restriction after 3 Aug 2031). The electronic ID-1 card rolled out nationwide from 20 Mar to 20 Jun 2025 and is valid 10 years per Wikipedia; sources on bracket details are not fully consistent ([Wikipedia](https://en.wikipedia.org/wiki/Romanian_identity_card)). PRADO also lists tiers ([PRADO](https://www.consilium.europa.eu/prado/en/ROU-BO-05002/index.html), not read in detail, unverified).
- I did not find the format of the CAN printed on the electronic card ("not found"); a local document confirms the series, expiry date and CAN appear on its front ([Iași directorate PDF](https://www.djep-iasi.ro/wp-content/uploads/2025/08/GENERALITATI-CEI.pdf), via search summary, unverified).
- **Implication for proof of address (inference):** a new electronic card cannot prove the domicile of a beneficial owner, so a second document is needed.

---

## 6. ONRC documents (three different things)

### 6.1 Certificat de înregistrare (registration certificate)

Format approved by Order 5307/C/2022, Annex 3 ([order](https://www.onrc.ro/documente/legislatie/ORDIN%20nr.%205307%20_%202022.docx), annex is an image I viewed). It has **no associates, no administrators and no status.**

| Label | Example synthetic value | Notes |
|---|---|---|
| ROMÂNIA · MINISTERUL JUSTIȚIEI | | header |
| OFICIUL NAȚIONAL AL REGISTRULUI COMERȚULUI · OFICIUL REGISTRULUI COMERȚULUI DE PE LÂNGĂ TRIBUNALUL ____ | | |
| Cod de securitate | | |
| Sigiliul electronic calificat (pentru certificatul emis în format electronic) | | |
| **CERTIFICAT DE ÎNREGISTRARE** | | |
| Firma/Sucursala | Banat Cargo Demo S.R.L. | |
| Sediul | | |
| Activitatea principală (descriere, clasa CAEN) | | |
| Cod unic de înregistrare ____ din data de ____ | 98735747 | |
| Identificator unic la nivel european (EUID) | `ROONRC.` + number | |
| Nr. de ordine în registrul comerțului | | |
| Data eliberării · Director · Seria ___ Nr. ___ | | certificate series and number |

### 6.2 Full certificat constatator (the document banks mean)

**Issuing authority:** ONRC and the territorial ORCs. Online through the InfoCert service, by e-mail, fax, post or at the counter. Fee **30 lei** per Ministry of Justice Order 380/C/2024. Two variants on the page: "I. CERTIFICAT CONSTATATOR" and "II. CERTIFICAT CONSTATATOR PENTRU CASA DE ASIGURĂRI DE SĂNĂTATE" ([ONRC](https://onrc.ro/index.php/ro/informatii/certificate-constatatoare)). A trade site also lists four sub-models: basic/extended, IMM funds, insolvency, information supply ([Infotva](https://infotva.manager.ro/articole/formulare-si-declaratii/certificat-constatator-obtinere-model-23430.html), secondary). There is **no legal validity period** on the ONRC page; the 30-day or 15-day limit is bank or authority practice ([StartupCafe](https://startupcafe.ro/p-certificatul-constatator-actul-pe-care-banca-primaria-si-finantatorul-ti-l-cer-in-acelasi-an-ce-contine-si-cum-il-obtii-104392)).

**ONRC's own content list:** denumirea (firma); număr de ordine în registrul comerțului; codul unic de înregistrare; identificator unic la nivel european; formă juridică; durată de funcționare; **starea firmei**; activitate principală; capital social; **administratori**; **asociați/acționari**; activitate secundară; activități autorizate; directori/reprezentanți pentru sucursale/subunități/sedii secundare; cenzori; **informații (5 indicatori) din situațiile financiare anuale disponibile**; alte informații după caz ([ONRC](https://onrc.ro/index.php/ro/informatii/certificate-constatatoare)). The exact five indicators are **not found** on an official page.

**Real label structure, taken from the ONRC "basic" model specimen** ([docx](https://infotva.manager.ro/dbimg/files/CCFIL-Certificat%20constatator%20de%20baza-v14.docx), labelled "Specimen"). **This is an older template: it cites Legea 26/1990 and a 2012 financial-year block, so the structure is unverified for post-2024 certificates.** Order of sections as in the specimen:

| Section / label | Example synthetic value | Notes |
|---|---|---|
| Header: MINISTERUL JUSTIȚIEI / OFICIUL NAȚIONAL AL REGISTRULUI COMERȚULUI; issuing-office address, phone, fax, e-mail, Cod de Identificare Fiscală | | |
| Nr.: …./………. · **CERTIFICAT CONSTATATOR** | Nr. 55412/10.10.2026 | |
| "…Oficiul Național al Registrului Comerțului certifică informațiile referitoare la <NUME FIRMĂ>" | | |
| **INFORMAȚII DE IDENTIFICARE:** Număr de ordine în Registrul Comerțului, atribuit în data de … · Identificator Unic la Nivel European (EUID) · Cod unic de înregistrare · Certificat de înregistrare: …, emis pe data de … și eliberat la data … · Adresa sediu social · Contacte sediu social · Contacte firma · Actul de înmatriculare și autorizare · **Stare firmă** · Forma de organizare · Tip societate · Mod de administrare · Data ultimei înregistrări în registrul comerțului · Durată | Stare firmă: value list **unverified** (see section 10) | |
| **SEDIU SOCIAL / PROFESIONAL:** Act sediu (act, nr., din data) · Data de început a valabilității pentru dovada de sediu · **Data expirării dovezii de sediu** · Durata sediului | lease or similar act with an expiry date | proof-of-seat evidence (section 8) |
| **CAPITAL SOCIAL:** Capital social subscris … RON, integral vărsat · Structura capitalului · Echivalent USD / EUR · Participare străină · Număr acțiuni/părți sociale · Valoarea unei acțiuni/părți sociale | 200 RON, 10 părți sociale of 20 RON | |
| **ASOCIAȚI/ACȚIONARI PERSOANE FIZICE:** <Nume> · Calitate · Cetățenie · Stare civilă · Data și locul nașterii · Sex · **Aport la capital** · Aport vărsat total · Aport vărsat în RON · Nr. de acțiuni/părți sociale · **Cota de participare la beneficii și pierderi** · then sub-blocks Condamnări, Instituire curatelă/Punere sub interdicție, Divorț/partaj, Convenție matrimonială | Aport 120 RON; cotă 60% | **the share table to cross-check against the UBO form and the application** |
| **ASOCIAȚI/ACȚIONARI PERSOANE JURIDICE:** <Denumire> · Calitate · Naționalitate · Sediu · Act de înființare · CUI · Aport la capital · … · Cota de participare la beneficii și pierderi · Reprezentat de … | | needed if a shareholder is a company (UBO chain) |
| **PERSOANE ÎMPUTERNICITE (persoane fizice / juridice):** <Nume> · Calitate · Funcție · Cetățenie · Sex · Data și locul nașterii · **Puteri** · **Atribuții de reprezentare** · Garanție · Data numirii · Data numirii în funcție · Data ultimei prelungiri · **Data expirării mandatului** · Durată mandat · Data depunere specimen semnătură · Temei legal · Condamnări … | | **administrators appear under this block** (inference: the specimen has no block named "Administratori"; the ONRC content list does name "administratori") |
| Administratori judiciari / lichidatori; Curator / curator special; Cenzori / auditori | | |
| **Activitatea principală:** Domeniul de activitate principal conform codificării (Ordin 337/2007) Rev. Caen (…) · COD CAEN – Denumire CAEN · Text suplimentar | 4941 / 4941 | CAEN Rev.2 in the specimen |
| FILIALE / SUCURSALE / SUBUNITĂȚI; SEDII SECUNDARE / PUNCTE DE LUCRU (Denumire, Adresă, Act sediu, dovadă sediu valabilă de la / expiră la) | | |
| SEDII ȘI/SAU ACTIVITĂȚI AUTORIZATE CONFORM ART. 15 DIN L359/2004 (Tip model declarație; Data certificatului constatator) | | |
| CONCORDAT PREVENTIV | | |
| **FAPTE AFLATE SUB INCIDENȚA ART. 21 LIT. e-h) din L26/1990:** Urmărire penală · Dosar penal · Condamnare penală a firmei · **Dizolvare firmă** · **Lichidare firmă** · **Insolvență** (Tip, Act de procedură, Nr., Dosar, Aflat pe rolul, Descrierea actului) | | where distress events show up |
| ALTE MENȚIUNI (Tip menționare, Descriere) | | |
| **SITUAȚIA FINANCIARĂ PE ANUL XXXX:** Cifra de afaceri · Active imobilizate – Total · Profit brut · Profit net · Pierderi brut · Pierderi net · Nr. mediu de salariați · **Plăți restante – total** · Obligații restante față de alți creditori · **Impozite și taxe neplătite la termenul stabilit, la bugetul statului** · … la bugetele locale | | the specimen lists more than five lines, while ONRC's current page says "5 indicatori" |
| Footer: "S-a eliberat prezentul certificat constatator solicitantului ____, spre a-i servi la ____" · "Informațiile … au la bază înregistrările existente până la data de ____" · electronic signature · "Verificare document" in InfoCert | | issue date, "valid as of" date |

### 6.3 The "Annex 5" certificat constatator (declaration-based): **not** the document banks want

Order 5307/C/2022, Annex 5 approves a different document, also titled "CERTIFICAT CONSTATATOR", issued under art. 122 para. (7) and (9) of Law 265/2022 on the basis of a **declaration on own responsibility that the firm meets operating conditions** ([order](https://www.onrc.ro/documente/legislatie/ORDIN%20nr.%205307%20_%202022.docx)). Its fields: Firma/Sucursala; Sediul social/profesional; Cod unic de înregistrare din data; Număr de ordine în registrul comerțului din data; EUID; the attestation text with a CAEN class and activity name at the registered office, secondary offices and third parties; **"Valabilitate: până la modificarea condițiilor de funcționare sau activităților"**; Director. It has **no associates, administrators, status, capital or financial block.** The public sample PDFs a bank has published under a "CUI-Anexa" folder are of this type (examples in 1.2). A client uploading this instead of the full certificate is a realistic wrong-document-type case (inference from the structure difference).

---

## 7. ANAF fiscal certificate (certificat de atestare fiscală)

**Issuer and basis.** The competent central tax body issues it under the procedure approved by **ANAF President's Order 3654/2015**, amended in 2019 (Order 3008/2019, Monitorul Oficial 945/26.11.2019) ([ANAF referat 2019](https://static.anaf.ro/static/10/Anaf/legislatie/referat_ordin_caf_06112019.pdf); the order number 3008/2019 comes from [Infotva](https://infotva.manager.ro/articole/infotva/certificat-de-atestare-fiscala-cum-il-obtii-online-model-si-acte-necesare-pentru-eliberare-22067.html), secondary). Later amendments to the procedure may exist (unverified).

**What the ANAF referat (primary) confirms**
- **30-day usage period** for legal entities (90 days for individuals not doing independent economic activity) ([referat](https://static.anaf.ro/static/10/Anaf/legislatie/referat_ordin_caf_06112019.pdf)).
- **Section A lists overdue tax obligations.** Items that are *not* counted as overdue there include: obligations under approved payment facilities still within their deadlines; claims not admitted in insolvency; claims not accepted in a confirmed reorganisation plan; and contested obligations that are secured by guarantee (same referat).
- The certificate also carries relevant mentions, including the situations under art. 157(3) and art. 194(1) of the Fiscal Procedure Code (same referat). The certificate can be sent through SPV, through PatrimVen, and **through a system made available to credit institutions in the private space of the ANAF portal** (same referat).
- ANAF can correct a material error by a separate correction act (same referat).

**Field labels of the actual model: not obtained.** The Annex 2 model could not be fetched. A search summary says the pre-2015 framework had sections A "Obligații de plată", B "Sume de rambursat/restituit", C eligibility information for non-reimbursable funds and D "Alte mențiuni", and that fiscalitatea.ro says the certificate must show the registration number, issue date, period of use and the name of the head of the issuing body ([Fiscalitatea](https://www.fiscalitatea.ro/documentar-fiscal-procedura-obtinerii-certificatului-de-atestare-fiscala-3879/)). **All of this is unverified for the current model.** The table below is a design for the generator, not a copy of the form.

| Field (design, labels unverified) | Example synthetic value | Notes |
|---|---|---|
| Număr de înregistrare / Data eliberării | `12345/2026-10-20` style | |
| Denumire contribuabil · CUI · Domiciliu fiscal | Someș Construct Test S.R.L. · 92761445 · … | |
| Perioadă de utilizare | 30 zile | referat |
| **Secțiunea A: obligații fiscale restante la data de …** | clean: "nu înregistrează"; tax-debt profile: list of overdue amounts | A is "overdue obligations" per the referat |
| Secțiunea D / Alte mențiuni | e.g. payment facility in progress | referat mentions art. 157(3), 194(1) |
| Conducătorul organului fiscal emitent | fictional name | |

**How it is obtained.** On request, online through SPV or at the counter. A search-summary guide lists company supporting documents: request form, CUI copy, ID of the representative, mandate, and signed trial balance ([Infotva](https://infotva.manager.ro/articole/infotva/certificat-de-atestare-fiscala-cum-il-obtii-online-model-si-acte-necesare-pentru-eliberare-22067.html), [Playtech](https://playtech.ro/2025/cum-obtii-certificatul-de-atestare-fiscala-in-2025-la-ce-foloseste/), secondary). **Do not use "20 days"** for the certificate. A 20-day validity appears only for the contracting-authority document in the 2019 comparison ([Contabilul](https://contabilul.manager.ro/a/24516/modificarile-aduse-de-noua-procedura-de-eliberare-a-certificatului-de-atestare-fiscala-analiza-comparativa.html)).

---

## 8. Proof of registered office, signatory mandate, shareholder decision

**Proof of registered office.** The ONRC certificate records it as an act: "Act sediu: <act>, nr. … din data …", plus "Data de început a valabilității pentru dovada de sediu", "Data expirării dovezii de sediu" and "Durata sediului" ([specimen](https://infotva.manager.ro/dbimg/files/CCFIL-Certificat%20constatator%20de%20baza-v14.docx)). **Which act types are accepted (lease, free-use loan, ownership extract) is not in my sources (unverified, general knowledge only).** Design: generate an "Act sediu" with a number, date and expiry, and make the expiry a test variable.

| Label (as on the ONRC certificate specimen) | Example synthetic value | Notes |
|---|---|---|
| SEDIU SOCIAL / PROFESIONAL: Adresa sediu social | Timișoara, Str. … nr. 14, bl. A2, sc. 1, et. 3, ap. 12, județ Timiș | must match the application, the F10 header and the UBO form address variants (section 10) |
| Act sediu: <act>, nr. … din data … | "contract de închiriere nr. 118" (act type unverified) | |
| Data de început a valabilității pentru dovada de sediu | 2024-03-01 | |
| Data expirării dovezii de sediu | 2027-02-28 (or a past date for the expired variant) | an expired date is a test case |
| Durata sediului | "determinată" / "nedeterminată" (value list unverified) | |

Source for the labels: [specimen](https://infotva.manager.ro/dbimg/files/CCFIL-Certificat%20constatator%20de%20baza-v14.docx). The values are invented.

**Signatory mandate (împuternicire).** No official bank mandate template found ("not found"). What the sources show:
- ONRC form 6A has an "împuternicit" block with "conform ______ nr. ___ din ___" ([form](https://onrc.ro/templates/site/formulare/Declaratie%20privind%20beneficiarii%20reali%20-%20semnatura%20privata-nr.6A.pdf)).
- ONRC accepts a special power of attorney in authentic form, a lawyer's power of attorney, or a delegation for filing the UBO declaration ([ONRC](https://onrc.ro/index.php/ro/mentiuni/persoane-juridice/inregistrarea-datelor-din-declaratia-privind-beneficiarul-real)).
- **UniCredit asks for the general-meeting decision (Hotărârea AGA) of the borrower/guarantor when one or more of all the legal representatives are designated to sign** ([UniCredit checklist](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/DocumenteSME/Documentatie-solicitare-credit-SRL-sau-SA-Micro.pdf)).
- The certificate's "Puteri" and "Atribuții de reprezentare" fields show what each administrator may do (6.2).
- A tax-certificate request by a delegate needs a mandate and the delegate's ID ([Infotva](https://infotva.manager.ro/articole/infotva/certificat-de-atestare-fiscala-cum-il-obtii-online-model-si-acte-necesare-pentru-eliberare-22067.html), secondary).

**Design of the mandate (inference, no official form):**

| Field (design, labels are mine) | Example synthetic value | Notes |
|---|---|---|
| Mandant: denumire, CUI, număr de ordine în registrul comerțului, sediu, reprezentat prin | Metalurgica Siret Test S.R.L., 91374629, J2020097015178, Tecuci …, Alina Demoiu (administrator) | must match the ONRC certificate (inference) |
| Mandatar: nume, prenume, CNP (masked), act de identitate seria/nr., calitatea în societate | Cătălin Testinescu, `1 XXXXXX 17 XXX C`, ID series invented, "director comercial" | the person who signs the loan application |
| Obiectul mandatului | "operațiuni curente cu banca" (for the P7 defect) or "semnarea cererii de finanțare și a contractului de credit" (for a correct file) | scope is the variable |
| Limite (sumă maximă) | 150.000 RON | vary |
| Valabilitate: de la / până la | 2026-08-02 / 2027-08-01 (or already expired) | validity is a test variable |
| Locul și data | Tecuci, 2026-08-02 | |
| Semnături; formă (sub semnătură privată / autentic) | signed by the administrator | whether it must be notarised is not established in my sources (unverified) |

Related document, "Hotărârea AGA" (general-meeting decision), is requested by UniCredit when designated signers are not all the legal representatives (see above). Its fields are not published; design it with: company data, meeting date, quorum and majority, the named signatory, scope, signatures of the associates (inference). The generator should vary validity (expired mandate) and scope (does not cover loan contracts).

---

## 9. Bank checklists

### 9.1 Working-capital or SME loan: what banks publish

| Bank | Product | Documents listed | Source | Status |
|---|---|---|---|---|
| **Raiffeisen** | Overdraft IMM (credit line) | Latest annual balance sheet and latest trial balance. Eligibility: turnover up to 34.3 million lei and at least one closed financial year. Limit 7,000 to 35% of turnover. Repayment 12 months, renewable in 12-month steps. | [Raiffeisen page](https://www.raiffeisen.ro/ro/imm/produse-si-servicii/finantare/linie-de-credit.html) | fetched, verified |
| **Raiffeisen** | IMM Invest Plus (state-guaranteed) | Apply on imminvest.ro, with the SME and de minimis declarations; each bank sets its own file requirements. | [Raiffeisen IMM Invest page](https://www.raiffeisen.ro/ro/imm/produse-si-servicii/finantare/credite-imm-invest.html), search summary | unverified (page not fetched) |
| **UniCredit** | Credit for SRL/SA micro | **For the request:** last two annual statements (F10, F20, F30, F40; not needed if generated from ANAF with signed consent) and, if turnover exceeds 1 million EUR, a half-year balance; trial balances for each statement plus last closed month; proof of settling CRC/CIP arrears if any; documents specific to credit type and purpose; collateral documents. **For signing:** AGA decision, RECOM online (generated by the bank, not older than 30 calendar days) **or** original certificat constatator (not older than 30 calendar days before signing), fiscal certificate if applicable, supporting documents, operating authorisations. | [UniCredit PDF](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/DocumenteSME/Documentatie-solicitare-credit-SRL-sau-SA-Micro.pdf) | fetched, verified |
| **BCR** | IMM Invest Plus (2023 guide) | "Only 6 documents": (1) financial statements for the last two closed fiscal years; (2) declaration on eligibility conditions of the program; (3) declaration on SME category; (4) fiscal attestation certificate, in validity; (5) administrators' fiscal record and criminal record, valid at the guarantee request date, without entries; (6) consent for Credit Risk Centre consultation for firms and majority shareholders. Also "no overdue tax obligations" (any must be paid from the first tranche). | [BCR guide](https://cdn0.erstegroup.com/content/dam/ro/bcr/www_bcr_ro/Business/ghiduri-practice/2023/BCR-ghid-IMM-Invest-2023.pdf) | fetched, verified |
| **BCR** | Credit on delivery documents | Signed credit request; financial statements (balance sheet, P&L, trial balances), possibly auditor report; cash-flow forecast and budget; Central Credit Register consent; **fiscal attestation certificate at first request and at least once a year**; commercial contracts; delivery documents; receivables assignment; collateral contract; other documents. | [BCR page](https://www.bcr.ro/ro/business/general/finantare/finantarea-activitatii-curente/credit-pe-documente-de-livrare) | fetched, verified |
| **ING** | Term credit (investment) | Trial balances for the last two annual statements; latest completed quarterly trial balance (plus same month of the previous year if seasonal); declaration on activity and intra-group relations; consent for CRC check on the company; consent for CRC check on a legal-entity majority shareholder over 50% (otherwise each legal-entity shareholder over 25%); consent for Credit Bureau check on an individual majority shareholder over 25%; collateral documents. | [ING page](https://ing.ro/imm/solutii-de-finantare/credit-de-investitii) | fetched, verified |
| **ING** | Credit ING Util | Reported as needing few documents beyond the administrators' IDs, with automated checks. | [ING page](https://ing.ro/imm/solutii-de-finantare/credit-ing-util), search summary | unverified |
| **Banca Transilvania** | Investment credit / FEI-guaranteed | Reported: last two annual statements with trial balances, latest quarterly trial balance, fiscal attestation certificate, company decision to take the credit, collateral documents. | [BT page](https://www.bancatransilvania.ro/en/companii/finantare/credite/credit-de-investitii), search summary | **unverified: BT pages returned 403 or redirected to a promotional page** |
| **BRD** | Credit for unnominated needs (IMM) | **Not found.** The page says no supporting documents are needed for use of funds and lists limits (20,000 to 400,000 RON without property collateral, up to 36 months; up to 5 million RON with a mortgage). It gives no document checklist. | [BRD page](https://www.brd.ro/creditul-pentru-nevoi-nenominalizate-imm) | fetched; checklist not found |

### 9.2 Periodic KYB or KYC review of a business client

| Source | What it says | Status |
|---|---|---|
| UniCredit signing set (9.1) | RECOM or certificat constatator within 30 calendar days, AGA decision for designated signers, fiscal certificate | verified |
| BCR (9.1) | fiscal attestation certificate at least annually | verified |
| Profit.ro (BO practice) | Banks need extracts from central registers, an updated constitutive act, auditor/lawyer/notary declarations, audited annual reports; documents generally no older than 6 months; BNR Regulation 2/2019 sets minimum BO data (relationship, name, date and place of birth, CNP or equivalent, residence, citizenship, activity, PEP status) | [Profit.ro](https://profit.ro/legal/provocarile-deschiderii-de-conturi-bancare-si-actualizarii-datelor-la-banca-identificarea-beneficiarului-real-21867317) (practitioner commentary) |
| Banca Transilvania data update for legal entities | Reported: updated constitutive act, documents naming who may operate accounts, IDs of representatives and beneficial owners, signed form | [BT PDF](https://www.bancatransilvania.ro/files/app/media/idea-bank/Persoane-juridice/Actualizarea-datelor-la-BT.pdf), search summary, **unverified (403)** |
| Banca Transilvania account opening | ONRC extract within 30 days for a company opening an account | [BT FAQ](https://intreb.bancatransilvania.ro/it/en/ce-acte-sunt-necesare-la-deschiderea-unui-cont-pentru-o-societate/), cited in [file 05](05-corporate-trade-open-loop-processes.md); not re-fetched, page now redirects |
| AMLR Art. 26 | Update customer information at least every 1 year for higher-risk and every 5 years for others, from 10 Jul 2027, plus event triggers | [Springlex](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-26/), via file 05 |
| Update cycle length under current Romanian practice | Not given in the sources I could read | not found ([Hotnews, ING-sponsored](https://hotnews.ro/cunoasterea-clientelei-episodul-1-de-ce-trebuie-sa-ne-actualizam-datele-la-banci-si-ct-de-des-trebuie-sa-facem-asta-232467)) |

**Working KYB bundle for the demo (inference, synthesised from the lists above):** full certificat constatator (≤ 30 days), UBO declaration, ID of each owner at 25% or more and of the signatory, last annual statements F10/F20/F30 plus trial balance, fiscal attestation certificate (≤ 30 days), proof of registered office, mandate or AGA decision if the signer is not the administrator, loan application, consents (CRC / credit bureau).

---

## 10. Real-life problems a back office handles

| Problem | How it shows up in the documents | Evidence |
|---|---|---|
| **Expired certificate** | Certificat constatator older than 30 days (some banks 15). Fiscal certificate older than its 30-day usage period. BO documents older than 6 months. Expired ID. Expired proof-of-seat date. Expired mandate. | [StartupCafe](https://startupcafe.ro/p-certificatul-constatator-actul-pe-care-banca-primaria-si-finantatorul-ti-l-cer-in-acelasi-an-ce-contine-si-cum-il-obtii-104392), [UniCredit](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/DocumenteSME/Documentatie-solicitare-credit-SRL-sau-SA-Micro.pdf), [ANAF referat](https://static.anaf.ro/static/10/Anaf/legislatie/referat_ordin_caf_06112019.pdf), [Profit.ro](https://profit.ro/legal/provocarile-deschiderii-de-conturi-bancare-si-actualizarii-datelor-la-banca-identificarea-beneficiarului-real-21867317), [Financiarul](https://financiarul.ro/companii/certificatul-constatator-prea-vechi-poate-amana-actele-firmei/) |
| **Tax debts** | Section A of the fiscal certificate lists overdue obligations. The ONRC certificate's financial block has "Impozite și taxe neplătite…". IMM Invest requires no overdue tax obligations, or paying them from the first tranche. | [ANAF referat](https://static.anaf.ro/static/10/Anaf/legislatie/referat_ordin_caf_06112019.pdf), [specimen](https://infotva.manager.ro/dbimg/files/CCFIL-Certificat%20constatator%20de%20baza-v14.docx), [BCR guide](https://cdn0.erstegroup.com/content/dam/ro/bcr/www_bcr_ro/Business/ghiduri-practice/2023/BCR-ghid-IMM-Invest-2023.pdf) |
| **Inactive (fiscally) company** | Declared inactive by ANAF under art. 92 of the Fiscal Procedure Code. Procedure approved by ANAF Order 3846/2015; the register of inactive/reactivated taxpayers is public. Inactive taxpayers lose the right to deduct expenses, with further VAT effects. New inactivity grounds from 1 Jan 2026 are reported. | [Fiscalitatea](https://www.fiscalitatea.ro/proceduri-declarare-contribuabili-inactivi-ce-prevederi-instituie-opanaf-38462015-13583/), [Contzilla](https://www.contzilla.ro/registrul-contribuabililor/), [Economedia](https://economedia.ro/anaf-pregateste-noi-reguli-pentru-declararea-firmelor-inactive-fiscal-companiile-fara-cont-bancar-in-romania-sau-care-nu-depun-bilantul-risca-sa-fie-trecute-in-registrul-de-inactivi.html) (**search summaries; exact current wording unverified**) |
| **Suspended or distressed at ONRC** | Temporary suspension can be registered for up to 3 years, then the firm must resume or be struck off. The certificate has sections for dissolution, liquidation and insolvency. The exact "Stare firmă" strings are **not found** in my sources. | [Alfasign](https://alfasign.ro/radiere-firma-fara-activitate/) (blog, unverified), [specimen](https://infotva.manager.ro/dbimg/files/CCFIL-Certificat%20constatator%20de%20baza-v14.docx) |
| **UBO discrepancy vs the register** | Banks cannot rely only on the beneficial-owner register and must analyse ownership themselves. Under AMLR Art. 24 a discrepancy is reported within 14 calendar days of detection, with a customer-first path for minor errors. The UBO form has no % field. A holder at the 25% boundary may be missing. | [Profit.ro](https://profit.ro/legal/provocarile-deschiderii-de-conturi-bancare-si-actualizarii-datelor-la-banca-identificarea-beneficiarului-real-21867317), [Springlex Art. 24](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-24/) (via file 05), [form 6A](https://onrc.ro/templates/site/formulare/Declaratie%20privind%20beneficiarii%20reali%20-%20semnatura%20privata-nr.6A.pdf) |
| **Address variants** | County-first or county-last; "Bl." or "Bloc"; capitals; street-type duplication; cedilla vs comma-below diacritics; the ID card has no postal code and the new electronic card no domicile; the certificate carries a seat-proof expiry. | observed in [ONRC-issued specimens](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/CUI-Anexa/Certificat-Sucursala-Caracal.pdf), [ID annex](https://media.hotnews.ro/media_server1/document-2021-03-10-24656651-0-forma-continut-carte-identitate.pdf), [Wikipedia](https://en.wikipedia.org/wiki/Romanian_identity_card) |
| **Signatory is not the administrator** | Loan application signed by a person who is neither administrator nor named in the powers section. Bank asks for the AGA decision, or a mandate. | [UniCredit](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/DocumenteSME/Documentatie-solicitare-credit-SRL-sau-SA-Micro.pdf), [form 6A](https://onrc.ro/templates/site/formulare/Declaratie%20privind%20beneficiarii%20reali%20-%20semnatura%20privata-nr.6A.pdf) |
| **Document for the wrong company** | CUI, name or order number does not match; name resemblance between related companies; `RO` prefix on the CUI; old-style and new-style J-numbers and the EUID written differently for the same company. | inference, plus identifier formats in [stdnum](https://raw.githubusercontent.com/arthurdejong/python-stdnum/master/stdnum/ro/cui.py) and the ONRC specimens in 1.2 |
| **Wrong document type** | Annex-5 declaration-based certificate or the registration certificate submitted instead of the full certificat constatator. A basic version may be refused where an extended one is required. | [Order 5307/C/2022](https://www.onrc.ro/documente/legislatie/ORDIN%20nr.%205307%20_%202022.docx), [StartupCafe](https://startupcafe.ro/p-certificatul-constatator-actul-pe-care-banca-primaria-si-finantatorul-ti-l-cer-in-acelasi-an-ce-contine-si-cum-il-obtii-104392) |
| **Incomplete or unsigned financial statements** | Missing F30 or F40, no "VALIDAT", no filing proof, unsigned forms. | [UniCredit](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/DocumenteSME/Documentatie-solicitare-credit-SRL-sau-SA-Micro.pdf) |
| **Too young or too large** | No closed financial year (Raiffeisen needs at least one). Turnover above 34.3 million lei. | [Raiffeisen](https://www.raiffeisen.ro/ro/imm/produse-si-servicii/finantare/linie-de-credit.html) |
| **CAEN Rev.2 vs Rev.3 mismatch** | Application, certificate and F10 show different CAEN revisions. | [ONRC CAEN page](https://onrc.ro/index.php/ro/caen) |
| **Inconsistent bank practice** | The same situation is read differently by different banks and employees. | [Profit.ro](https://profit.ro/legal/provocarile-deschiderii-de-conturi-bancare-si-actualizarii-datelor-la-banca-identificarea-beneficiarului-real-21867317) |

---

## 11. Eight synthetic company profiles

**Conventions.** All entities and persons are invented. "As of" date for the scenario: **2026-10-29**. CUIs are in the unverified 9xxxxxxx band (1.8). J-numbers use high serials (1.8) and carry valid check digits (tested with the rule in 1.2). Postal codes are structure-valid but illustrative, not checked against Poșta Română (1.4). CNPs, IDs and IBANs are not given. Financial figures are invented to produce varied DSCR values and are not sourced. "Full F20" means the non-micro form with rows 01–84; "micro F20" means the abbreviated form (section 3). Which entities are micro in 2026 depends on thresholds I did not verify, so treat this assignment as a design choice.

| # | Company (S.R.L.) | CAEN Rev.2 → Rev.3 | City, county | Postal code (illustr.) | CUI | Reg. number (new / old) | Associates (share) | Administrator | Planted problem |
|---|---|---|---|---|---|---|---|---|---|
| P1 | Banat Cargo Demo S.R.L. | 4941 Transporturi rutiere de mărfuri → 4941 Transporturi rutiere de mărfuri | **Timișoara**, Timiș | 300212 (street-level) | 98735747 | J2017091204358 / J35/91204/2017 | Radu Demovici 60%, Elena Testescu 40% | Radu Demovici | **Clean file** |
| P2 | Someș Construct Test S.R.L. | 4120 Lucrări de construcţii a clădirilor rezidenţiale şi nerezidenţiale → 4100 Lucrări de construcţii ale clădirilor rezidenţiale şi nerezidenţiale | **Cluj-Napoca**, Cluj | 400123 (street-level) | 92761445 | J2019093517124 / J12/93517/2019 | Vlad Exemplaru 40%, Corina Fictivescu 32%, Tudor Testoiu 28% | Vlad Exemplaru | **Tax debt** |
| P3 | Panificația Moldova Demo S.R.L. | 1071 Fabricarea pâinii; fabricarea prăjiturilor şi a produselor proaspete de patiserie → 1071 (same denomination) | **Fălticeni** (small town), Suceava | 725200 (one code for the town) | 92638249 | J2014092880334 / J33/92880/2014 | Gheorghe Testeanu 100% (sole associate) | Gheorghe Testeanu | **Inactive company** |
| P4 | Iași Soft Exemplu S.R.L. | 6201 Activităţi de realizare a soft-ului la comandă (software orientat client) → 6210 Activităţi de realizare a softului la comandă (software orientat client) | **Iași**, Iași | 700456 (street-level) | 95913157 | J2021094106223 / J22/94106/2021 | Ana Exemplan 51%, Mihai Demonescu 26%, Cristina Fictivoiu 23% | Ana Exemplan | **UBO discrepancy** |
| P5 | Prahova Gustări Test S.R.L. | 5610 Restaurante → 5611 Restaurante | **Câmpina** (small town), Prahova | 105600 (one code for the town) | 94376330 | J2016095333297 / J29/95333/2016 | Paul Testaru 70%, Ioana Demoranu 30% | Ioana Demoranu | **Expired certificate** |
| P6 | Piața Verde Demo S.R.L. | 4631 Comerţ cu ridicata al fructelor şi legumelor → 4631 (same denomination) | **București, sector 3** | 030516 (street-level) | 98811240 | J2018096742407 / J40/96742/2018 | Sorin Exempleanu 50%, Laura Fictiva 50% | both, jointly (see note) | **Address variants** |
| P7 | Metalurgica Siret Test S.R.L. | 2511 Fabricarea de construcţii metalice şi părţi componente ale structurilor metalice → 2511 (same denomination) | **Tecuci** (small town), Galați | 805300 (one code for the town) | 91374629 | J2020097015178 / J17/97015/2020 | Dan Testilă 55%, Alina Demoiu 45% | Alina Demoiu | **Signatory is not the administrator** |
| P8 | Marea Neagră Retail Demo S.R.L. | 4711 Comerţ cu amănuntul în magazine nespecializate, cu vânzare predominantă de produse alimentare, băuturi şi tutun → 4711 Comerţ cu amănuntul nespecializat, cu vânzare predominantă de produse alimentare, băuturi şi tutun | **Constanța**, Constanța | 900345 (street-level) | 92869790 | J2024900137002 / none (registered after 26.07.2024, county `00`) | Bogdan Exemplescu 100% | Bogdan Exemplescu | **Document for the wrong company** |

CAEN codes and denominations are pasted exactly from the [ONRC Rev.2 to Rev.3 table](https://onrc.ro/documente/anunturi/Tabel-Corespondenta-CAEN-Rev.2-CAEN-Rev.3_septembrie-2026.xlsx), which writes ş and ţ with cedilla (note 4120 maps to 4100, 5610 to 5611, 6201 to 6210). Reuse the strings as they are, because the matcher will compare them. Big cities: Timișoara, Cluj-Napoca, Iași, București S3, Constanța. Small towns: Fălticeni, Câmpina, Tecuci. The size rule behind the postal codes is in 1.4.

### Details per profile

**P1, clean (Timișoara).** Turnover 6.4 M RON, EBITDA 1.1 M, existing debt service 0.62 M, requested 900,000 RON (35% of turnover would be 2.24 M). Full F20. Certificat constatator issued 2026-10-14, fiscal certificate 2026-10-15, UBO declaration (form 6A, "modificare") dated 2026-10-12. Every cross-check passes. Use as the baseline, and show old-style J-number on the application, new-style on the certificate, and the EUID in the 14-character form (identifier-variant normalisation, not an error).

**P2, tax debt (Cluj-Napoca).** This profile isolates one problem: overdue tax. Turnover 9.8 M, EBITDA 0.95 M, debt service 0.80 M. Fiscal certificate dated 2026-10-20 (inside its 30-day period) whose Section A lists overdue obligations (invented: about 38,400 RON of contributions and VAT). Overdue tax is not the same as enforcement, so the application's "Popriri, proceduri de executare silită: NU" is not by itself a contradiction. To make the application conflict with the fiscal data, the generator would have to add an enforcement step to the certificate's mentions section; the exact wording of that mention is unverified, so keep it a design choice. Expected outcome: flag the tax debt and require it to be cleared or paid from the first tranche (the BCR IMM Invest rule in section 10). All three associates are above 25% and all three appear on the UBO form, so there is no UBO issue. All other documents are consistent and fresh. Full F20.

**P3, inactive company (Fălticeni).** Chosen variant: **ANAF "inactiv fiscal" (art. 92 Fiscal Procedure Code)**, not ONRC suspension. The certificat constatator shows an operating firm, but the public inactive-taxpayers register flags it, so the file passes ONRC checks and fails the ANAF check. Turnover 1.9 M, EBITDA 0.21 M. **Micro F20 plus trial balance.** The alternative (ONRC temporary suspension, up to 3 years) is documented only in a blog and the exact status strings are unverified, so do not use it as the primary case.

**P4, UBO discrepancy (Iași).** The single planted error is one missing beneficial owner. ONRC certificate: Ana Exemplan 51% (also the administrator), Mihai Demonescu 26%, Cristina Fictivoiu 23%. The UBO declaration lists **only Ana**, with basis tick "art. 4 alin. (2) lit. a) pct. 1" and Descriere "51% din părțile sociale". Mihai's 26% is above the 25% threshold under either reading (over 25% or 25% or more), so omitting him is an unambiguous error. Cristina's 23% is below the threshold, so leaving her off the declaration is correct and is not an error. The UBO form's only place for a percentage is "Descriere", so the demo must read free text to compare against the certificate. The application's "Asociați/administratori / Procent" table (50 / 25 / 25) can be kept consistent with the certificate (51 / 26 / 23) to avoid a second, ambiguous issue; if you want a rounding-style variant, mark it as a separate test. Micro F20 plus trial balance. Turnover 3.1 M, EBITDA 0.82 M, debt service 0.15 M.

**P5, expired certificate (Câmpina).** Certificat constatator issued 2026-09-10 (49 days old at 2026-10-29; limit 30 days at UniCredit, 15 at some banks). Fiscal certificate issued 2026-09-14 (45 days; usage period 30 days). Everything else is consistent. Turnover 2.4 M, EBITDA 0.33 M, debt service 0.21 M. Micro F20 plus trial balance. Expected action: request refreshed certificates; do not approve.

**P6, address variants (București, sector 3).** Four spellings of the same registered office across the application, ONRC certificate, proof of seat and the F10 header: county first or last; "Bd." vs "Bulevardul"; "Bl." vs "Bloc"; cedilla vs comma-below diacritics; missing sector; capitals; one document with the old postal code. **Same entity, same CUI.** The correct answer is "match", with the variants logged. Note on powers: both associates are administrators and the specimen's "Puteri" field says whether they sign jointly or separately; make the value "împreună", so the application with one signature triggers a second flag. Full F20. Turnover 12.6 M, EBITDA 0.9 M, debt service 0.55 M.

**P7, signatory is not the administrator (Tecuci).** The administrator is Alina Demoiu (45% associate). The loan application is signed by Cătălin Testinescu, "director comercial", who is not in the certificate's powers section, with an împuternicire dated 2026-08-02 whose scope covers "operațiuni curente" but not credit contracts. No AGA decision is attached (UniCredit asks for one when designated signers are not all representatives). The UBO declaration was filed through an "împuternicit" with a mandate reference. Full F20. Turnover 5.2 M, EBITDA 0.7 M, debt service 0.4 M.

**P8, wrong-company document (Constanța).** Registered after 26.07.2024 so the number is in the new format with county `00` and no old-format form. The fiscal certificate and the F10 in the file belong to a **sister company** with a similar name, "Marea Neagră Retail Demo Holding S.R.L." (CUI 97660794, another invented value in the same band), while the application, ONRC certificate and ID belong to P8. The document names are one word apart and both are valid CUIs. Application shows an empty "Informații despre grup" even though a group exists (sister company shares the sole associate). Full F20. Turnover 8.1 M, EBITDA 0.6 M, debt service 0.35 M.

**Optional extra variants (build them as separate test files, not inside the eight profiles, so each profile keeps one clear expected outcome)**
- **Annex-5 vs full certificate** (section 6.3): a copy of P5 or P1 with the Annex-5 certificate uploaded instead of the full certificat constatator.
- **New electronic ID card** for one beneficial owner in a copy of P1, so no domicile is printed (section 5).
- **Seat-proof expiry** in a copy of P1: the certificate's "Data expirării dovezii de sediu" is in the past.
- **CAEN Rev.2 on the application, Rev.3 on the certificate** in a copy of P1.
- **Exactly 25.0% holder** in a copy of P1 (for example 75 / 25): the legal reading ("over 25%" vs "25% or more", section 4) decides the expected outcome, so mark the expected result as "ask the analyst".
- **Payment facility in progress** in a copy of P2: the overdue amounts fall under the referat's exclusions for approved payment facilities (section 7), so Section A would not list them.

---

## 12. Sources

**ONRC and Ministry of Justice**
- [Order 5307/C/2022 (docx)](https://www.onrc.ro/documente/legislatie/ORDIN%20nr.%205307%20_%202022.docx): formats of act, application, registration certificate, Annex 5 certificat constatator, EUID.
- [ONRC info notice on Law 265/2022](https://www.onrc.ro/documente/Comunicat%20_Legea%20265.doc)
- [ONRC: certificate constatator page](https://onrc.ro/index.php/ro/informatii/certificate-constatatoare)
- [ONRC: EUID page](https://onrc.ro/index.php/ro/mentiuni/persoane-juridice/alocarea-identificatorului-unic-la-nivel-european-euid)
- [ONRC: beneficial owner declaration page](https://onrc.ro/index.php/ro/mentiuni/persoane-juridice/inregistrarea-datelor-din-declaratia-privind-beneficiarul-real)
- [Form 6A PDF](https://onrc.ro/templates/site/formulare/Declaratie%20privind%20beneficiarii%20reali%20-%20semnatura%20privata-nr.6A.pdf), [form 6 PDF](https://onrc.ro/templates/site/formulare/Declaratie%20privind%20beneficiarii%20reaii-orct-nr.6.pdf)
- [ONRC: CAEN Rev.3](https://onrc.ro/index.php/ro/caen), [Rev.2 to Rev.3 table](https://onrc.ro/documente/anunturi/Tabel-Corespondenta-CAEN-Rev.2-CAEN-Rev.3_septembrie-2026.xlsx)
- [Certificat constatator basic model (specimen, via Infotva)](https://infotva.manager.ro/dbimg/files/CCFIL-Certificat%20constatator%20de%20baza-v14.docx), [Infotva model article](https://infotva.manager.ro/articole/formulare-si-declaratii/certificat-constatator-obtinere-model-23430.html)
- ONRC-issued public specimens (format evidence only): [Caracal](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/CUI-Anexa/Certificat-Sucursala-Caracal.pdf), [Constanța 1](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/CUI-Anexa/Certificat-Sucursala-Dacia-Constanta.pdf), [Constanța 2](https://www.unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/CUI-Anexa/Certificat-Constatator-Constanta2.pdf), [Brăila](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/CUI-Anexa/CertificatConstatatorAutorizare-Sucursala-Braila.pdf)
- [Fiscalitatea: new BO models, 21 Jul 2021](https://www.fiscalitatea.ro/onrc-anunta-ca-au-fost-elaborate-noi-modele-de-declaratii-privind-beneficiarii-reali-21240/)
- [Fiscalitatea: new order-number format](https://www.fiscalitatea.ro/onrc-informatii-privind-noul-format-a-numarului-de-ordine-din-registrul-comertului-23681/), [Contabilul: same](https://contabilul.manager.ro/a/28861/atentie-iata-noul-format-al-numarului-de-ordine-din-registrul-comertului.html)

**ANAF and Ministry of Finance**
- [ANAF referat on the fiscal certificate procedure, 2019](https://static.anaf.ro/static/10/Anaf/legislatie/referat_ordin_caf_06112019.pdf)
- [OMF 1194/2025 (MO 730/05.08.2025): form layouts F10, F20, F30](https://startupcafe.ro/wp-content/uploads/2025/08/OMF1194_mo730_05082025.pdf)
- [ANAF code table citing OMF 2036/23.12.2025](https://static.anaf.ro/static/10/Anaf/Declaratii_R/situatiifinanciare/2025/1002_5_2025.html)
- [ANAF web-service page (v9 endpoint)](https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/servicii_sincron.html)
- [Fiscalitatea: inactive taxpayers procedure](https://www.fiscalitatea.ro/proceduri-declarare-contribuabili-inactivi-ce-prevederi-instituie-opanaf-38462015-13583/), [Contzilla: register of inactive taxpayers](https://www.contzilla.ro/registrul-contribuabililor/)
- [Infotva: fiscal certificate, model and documents](https://infotva.manager.ro/articole/infotva/certificat-de-atestare-fiscala-cum-il-obtii-online-model-si-acte-necesare-pentru-eliberare-22067.html), [Contabilul: 2019 procedure comparison](https://contabilul.manager.ro/a/24516/modificarile-aduse-de-noua-procedura-de-eliberare-a-certificatului-de-atestare-fiscala-analiza-comparativa.html), [Fiscalitatea: documentar](https://www.fiscalitatea.ro/documentar-fiscal-procedura-obtinerii-certificatului-de-atestare-fiscala-3879/), [Playtech 2025](https://playtech.ro/2025/cum-obtii-certificatul-de-atestare-fiscala-in-2025-la-ce-foloseste/)

**Identifier formats**
- [python-stdnum: CUI](https://raw.githubusercontent.com/arthurdejong/python-stdnum/master/stdnum/ro/cui.py), [ONRC number](https://raw.githubusercontent.com/arthurdejong/python-stdnum/master/stdnum/ro/onrc.py), [CNP](https://raw.githubusercontent.com/arthurdejong/python-stdnum/master/stdnum/ro/cnp.py)
- [cnp-spec](https://github.com/vimishor/cnp-spec/blob/master/spec.md), [ro.wikipedia CNP](https://ro.wikipedia.org/wiki/Cod_numeric_personal_(Rom%C3%A2nia))
- [Annex 2, form and content of the ID card](https://media.hotnews.ro/media_server1/document-2021-03-10-24656651-0-forma-continut-carte-identitate.pdf), [Wikipedia: Romanian identity card](https://en.wikipedia.org/wiki/Romanian_identity_card), [Iași CEI note](https://www.djep-iasi.ro/wp-content/uploads/2025/08/GENERALITATI-CEI.pdf), [PRADO](https://www.consilium.europa.eu/prado/en/ROU-BO-05002/index.html)
- [Wikipedia: postal codes in Romania](https://en.wikipedia.org/wiki/Postal_codes_in_Romania), [Poșta Română lookup](https://www.posta-romana.ro/cauta-cod-postal.html)

**Bank pages**
- [Raiffeisen overdraft IMM](https://www.raiffeisen.ro/ro/imm/produse-si-servicii/finantare/linie-de-credit.html), [Raiffeisen IMM Invest Plus](https://www.raiffeisen.ro/ro/imm/produse-si-servicii/finantare/credite-imm-invest.html), [Raiffeisen form F1 (Visa Business credit line)](https://www.raiffeisen.ro/content/dam/rbi/retail/eu/ro/documents/pj/Cerere-acordare-limita-de-credit-si-emitere-card-Visa-Business.pdf)
- [UniCredit SRL/SA micro checklist](https://unicredit.ro/content/dam/cee2020-pws-ro/DocumentePDF/DocumenteSME/Documentatie-solicitare-credit-SRL-sau-SA-Micro.pdf)
- [BCR IMM Invest guide 2023](https://cdn0.erstegroup.com/content/dam/ro/bcr/www_bcr_ro/Business/ghiduri-practice/2023/BCR-ghid-IMM-Invest-2023.pdf), [BCR credit on delivery documents](https://www.bcr.ro/ro/business/general/finantare/finantarea-activitatii-curente/credit-pe-documente-de-livrare)
- [ING term credit](https://ing.ro/imm/solutii-de-finantare/credit-de-investitii), [ING Credit Util](https://ing.ro/imm/solutii-de-finantare/credit-ing-util)
- [BRD credit for unnominated needs](https://www.brd.ro/creditul-pentru-nevoi-nenominalizate-imm)
- Banca Transilvania (not fetched): [investment credit](https://www.bancatransilvania.ro/en/companii/finantare/credite/credit-de-investitii), [data update PDF](https://www.bancatransilvania.ro/files/app/media/idea-bank/Persoane-juridice/Actualizarea-datelor-la-BT.pdf), [IMM declaration annex 1b](https://www.bancatransilvania.ro/files/app/media/Index/Companii/Ajutor-minimis/Plata-ajutor-stat/Declaratie-incadrare-intreprindere-mica-si-mijlocie.pdf), [FAQ](https://intreb.bancatransilvania.ro/it/en/ce-acte-sunt-necesare-la-deschiderea-unui-cont-pentru-o-societate/)
- [FNGCIMM IMM Invest 2022 guide](https://www.fngcimm.ro/attachment/Ag0cJ_IMM%20INVEST%202022%202.pdf) (image-only PDF)

**Commentary and regulation**
- [Profit.ro: beneficial owner identification at banks](https://profit.ro/legal/provocarile-deschiderii-de-conturi-bancare-si-actualizarii-datelor-la-banca-identificarea-beneficiarului-real-21867317)
- [Hotnews (ING-sponsored): KYC data updates](https://hotnews.ro/cunoasterea-clientelei-episodul-1-de-ce-trebuie-sa-ne-actualizam-datele-la-banci-si-ct-de-des-trebuie-sa-facem-asta-232467)
- [Fiscalitatea: Law 129/2019 BO definition](https://www.fiscalitatea.ro/legea-1292019-ce-inseamna-beneficiar-real-si-care-sunt-obligatiile-declarative-aferente-23866/)
- [StartupCafe: certificat constatator](https://startupcafe.ro/p-certificatul-constatator-actul-pe-care-banca-primaria-si-finantatorul-ti-l-cer-in-acelasi-an-ce-contine-si-cum-il-obtii-104392), [Financiarul](https://financiarul.ro/companii/certificatul-constatator-prea-vechi-poate-amana-actele-firmei/)
- [Springlex AMLR Art. 24](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-24/), [Art. 26](https://www.springlex.eu/en/packages/aml/amlr-regulation/article-26/), [theKYB on the 25% threshold](https://thekyb.com/blog/7-things-that-change-about-beneficial-ownership-verification-under-amlr/)
- [Alfasign: suspension and striking off](https://alfasign.ro/radiere-firma-fara-activitate/), [Economedia: inactive-taxpayer changes](https://economedia.ro/anaf-pregateste-noi-reguli-pentru-declararea-firmelor-inactive-fiscal-companiile-fara-cont-bancar-in-romania-sau-care-nu-depun-bilantul-risca-sa-fie-trecute-in-registrul-de-inactivi.html), [Contabilul: CAEN deadline](https://contabilul.manager.ro/a/30288/guvernul-a-prelungit-termenul-pentru-trecerea-la-caen-rev-3-pana-la-25-martie-2027.html), [Forvis Mazars note](https://www.forvismazars.com/ro/en/content/download/1232558/file/2838637), [Contabilul: micro-entity statements](https://contabilul.manager.ro/a/18263/microintreprindere-si-impozit-de-1-ce-situatii-financiare-se-depuns.html), [Playtech: postal codes plan](https://playtech.ro/2022/se-schimba-codurile-postale-in-romania-cel-mai-nou-proiect-revolutionar-initiat-de-posta-romana/)

---

## 13. Open points and things I could not verify

1. **CUI algorithm vs ANAF, and CUI availability.** ANAF's web service reset my connection. The generated 9xxxxxxx CUIs are unchecked against the register. Run the check from a Romanian IP or a different network before the demo.
2. **Annual F10/F20 row numbers.** I have only the half-year form (OMF 1194/2025). The annual order is OMF 2036/23.12.2025, whose text I did not read. The size thresholds for micro, small, medium and large (Order 107/2025) were not read.
3. **Current full certificat constatator layout.** The only specimen I could get is an older template (cites Legea 26/1990, 2012 financial block). The "Stare firmă" value list and the five financial indicators are not found.
4. **ANAF certificat de atestare fiscală model (Annex 2).** Field labels not obtained. Only the referat's content points are primary.
5. **Banca Transilvania and Raiffeisen IMM Invest Plus page.** Not fetched (403, redirect, or not opened). BRD checklist not found.
6. **Meaning of each tick box on the UBO form** other than lit. a) pct. 1, and whether the "over 25%" or "25% or more" wording is current.
7. **ID card details:** act number of the annex, CAN format, final validity brackets of the electronic card.
8. **CAEN transition deadline:** 25 Sep 2026 (ONRC) vs 25 Mar 2027 (one article).
9. **Order 5307/C/2022, Article 6** (EUID structure) came out empty in the extraction. The EUID structure here is inferred from specimens.
