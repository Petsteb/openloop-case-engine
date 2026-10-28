"""Synthetic demo case: a fictional bakery applies for an SME working-capital loan.

All companies, people and IDs are fictional. Documents are Romanian text stand-ins for PDFs.
`{issued}` is replaced with the delivery date; a fixed `issued_offset_days` pins an older issue date.
"""
from datetime import datetime, timedelta, timezone

CASE_START = datetime(2026, 10, 28, 9, 0, tzinfo=timezone.utc)

# Layouts follow the real forms (research/09-document-templates.md): the ONRC certificat constatator, ONRC form 6A
# (beneficial owners), the ANAF fiscal certificate, the F10/F20 statements and a bank's SME application. The
# "Key: value" lines the extractor reads are kept verbatim; the rest is context a real document carries.
COUNTY_CODES = {"Bistrița-Năsăud": 6, "Brașov": 8, "Cluj": 12, "Iași": 22, "Ialomița": 21, "Suceava": 33, "Timiș": 35,
                "Tulcea": 36}


def onrc_number(year: int, serial: int, county: str) -> str:
    """New 14-character trade-register number: J + year + 6-digit serial + county + check digit (sum of digits mod 10,
    the letter counted as ord(letter) % 10). Serials at the top of the range keep them clear of real companies."""
    body = f"J{year}{serial:06d}{COUNTY_CODES[county]:02d}"
    return body + str((ord("J") % 10 + sum(int(ch) for ch in body[1:])) % 10)


AURORA_J = onrc_number(2019, 990123, "Cluj")

APPLICATION = f"""CERERE DE FINANȚARE — IMM (credit pentru capital de lucru)
Date generale despre solicitant
Solicitant: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Număr de ordine în registrul comerțului: {AURORA_J}
Sediu social: Str. Fagului nr. 7, bl. A2, Cluj-Napoca, jud. Cluj
Cod poștal: 400127
Activitatea principală: 1071 Fabricarea pâinii; fabricarea prăjiturilor și a produselor proaspete de patiserie
Cifra de afaceri (ultimul an încheiat): 3.150.000 RON
Telefon / e-mail: 07•• ••• 112 / andrei.munteanu@brutaria-aurora.example
Finanțarea solicitată
Produs solicitat: Credit capital de lucru
Suma solicitată: 500.000 RON
Perioada: 36 luni
Scopul finanțării: stocuri de materii prime pentru sezonul de iarnă
Garanții propuse: ipotecă mobiliară asupra stocurilor și creanțelor; fideiusiunea administratorului
Rată anuală estimată credit nou: 120.000 RON
Aspecte legale: litigii NU · popriri sau executare silită NU · insolvență NU
Declar că am luat la cunoștință consultarea Centralei Riscului de Credit (CRC) și a Centralei Incidentelor de Plăți.
Reprezentant legal / semnatar: Andrei Munteanu
Data cererii: {{issued}}"""

FINANCIALS = f"""SITUAȚII FINANCIARE ANUALE 2025 — EXTRAS (formularele 10 și 20, depuse la ANAF)
Județul: Cluj · Număr din registrul comerțului: {AURORA_J}
Entitate: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Activitatea preponderentă: Fabricarea pâinii (cod CAEN 1071) · Forma de proprietate: 35
Contul de profit și pierdere (F20)
rd. 01 Cifra de afaceri netă: 3.150.000 RON
rd. 28 Cheltuieli de exploatare privind amortizarea: 95.000 RON
rd. 55 Profitul din exploatare: 325.000 RON
rd. 68 Cheltuieli privind dobânzile: 60.000 RON
rd. 76 Profitul brut: 265.000 RON
rd. 78 Impozitul pe profit: 55.000 RON
rd. 83 Profit net: 210.000 RON
Indicatori din balanța de verificare la 31.12.2025 (anexă)
EBITDA: 420.000 RON
Serviciul anual al datoriei existente: 180.000 RON
Număr mediu de salariați: 12
Întocmit: expert contabil (CECCAR) · Administrator: Andrei Munteanu"""

_UBO_HEADER = f"""MINISTERUL JUSTIȚIEI · OFICIUL NAȚIONAL AL REGISTRULUI COMERȚULUI
Oficiul Registrului Comerțului de pe lângă Tribunalul Cluj
Formular nr. 6A — declarație pe proprie răspundere, sub semnătură privată
DECLARAȚIE PRIVIND BENEFICIARUL REAL{{note}}
Societate: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Număr de ordine în registrul comerțului: {AURORA_J} · EUID: ROONRC.{AURORA_J}
Subsemnatul Andrei Munteanu, în calitate de reprezentant legal, declar pe propria răspundere, în conformitate cu art. 56
din Legea nr. 129/2019 și cunoscând dispozițiile art. 326 Cod penal, că beneficiarii reali sunt:"""
_UBO_FOOTER = """Temei: art. 4 alin. (2) lit. a) pct. 1 din Legea nr. 129/2019 (deținere de părți sociale)
Persoană desemnată pentru comunicări: Andrei Munteanu"""


def _bo(name: str, pct: int, cnp: str) -> str:
    return f"""Beneficiar real: {name} — {pct}%
  CNP: {cnp} · cetățenie română · domiciliul în Cluj-Napoca, jud. Cluj
  Descriere: deține {pct}% din părțile sociale și drepturile de vot"""


UBO_V1 = (_UBO_HEADER.replace("{note}", " (înmatriculare)") + "\n" + _bo("Andrei Munteanu", 70, "185031••••••") + "\n"
          + _bo("Elena Munteanu", 30, "288070••••••") + "\n" + _UBO_FOOTER + "\nData declarației: 15.09.2026")

UBO_V2 = (_UBO_HEADER.replace("{note}", " (actualizată — modificare)") + "\n" + _bo("Andrei Munteanu", 45, "185031••••••")
          + "\n" + _bo("Elena Munteanu", 30, "288070••••••") + "\n" + _bo("Radu Pop", 25, "179112••••••") + "\n"
          + _UBO_FOOTER + "\nData declarației: {issued}")


def id_text(first: str, last: str, cnp_masked: str, valid_until: str = "12.03.2031") -> str:
    """Copy of a Romanian identity card. The series "ZZ" is not used by any county (fictional on purpose)."""
    number = sum(ord(ch) for ch in first + last) * 977 % 900000 + 100000
    return f"""ROMÂNIA · CARTE DE IDENTITATE (copie)
Seria ZZ nr. {number}
Nume: {last}
Prenume: {first}
CNP: {cnp_masked}
Cetățenie: Română
Emisă de: SPCLEP (fictiv)
Valabilă până la: {valid_until}
IDROU{last}<<{first}<<<<<<<<<<<<<<<<<<<<<<<"""


ONRC = f"""MINISTERUL JUSTIȚIEI · OFICIUL NAȚIONAL AL REGISTRULUI COMERȚULUI
Oficiul Registrului Comerțului de pe lângă Tribunalul Cluj
CERTIFICAT CONSTATATOR (de bază)
Oficiul Național al Registrului Comerțului certifică informațiile referitoare la BRUTĂRIA AURORA S.R.L.
INFORMAȚII DE IDENTIFICARE
Denumire: BRUTĂRIA AURORA S.R.L.
Număr de ordine în registrul comerțului: {AURORA_J}
Identificator unic la nivel european (EUID): ROONRC.{AURORA_J}
Cod unic de înregistrare: 94123877
Forma de organizare: societate cu răspundere limitată · durată nelimitată
Stare firmă: ACTIVĂ
SEDIU SOCIAL
Sediul social: Calea Fagului nr. 7, Cluj-Napoca, Județ Cluj
Cod poștal: 400127
Act sediu: contract de comodat nr. 14/02.03.2019, valabil până la 01.03.2029
CAPITAL SOCIAL: 200 RON, integral vărsat · 20 părți sociale a câte 10 RON
ASOCIAȚI PERSOANE FIZICE
Asociat: MUNTEANU ANDREI — 45%
  cetățenie română · aport la capital 90 RON · cota de participare la beneficii și pierderi 45%
Asociat: MUNTEANU ELENA — 30%
  cetățenie română · aport la capital 60 RON · cota de participare la beneficii și pierderi 30%
Asociat: POP RADU — 25%
  cetățenie română · aport la capital 50 RON · cota de participare la beneficii și pierderi 25%
PERSOANE ÎMPUTERNICITE
Administrator: MUNTEANU ANDREI
  puteri depline · reprezentare individuală · mandat pe durată nelimitată
ACTIVITATEA PRINCIPALĂ (CAEN Rev. 2): 1071 Fabricarea pâinii; fabricarea prăjiturilor și a produselor proaspete de patiserie
FAPTE (art. 21 lit. e-h din Legea nr. 26/1990): nu există înregistrări · insolvență: nu · dizolvare: nu
SITUAȚIA FINANCIARĂ PE ANUL 2025: cifra de afaceri 3.150.000 RON · profit net 210.000 RON · 12 salariați
Informațiile au la bază înregistrările existente în registrul comerțului la data eliberării.
Data eliberării: {{issued}}"""

FISCAL = f"""MINISTERUL FINANȚELOR · AGENȚIA NAȚIONALĂ DE ADMINISTRARE FISCALĂ
Direcția Generală Regională a Finanțelor Publice Cluj-Napoca
CERTIFICAT DE ATESTARE FISCALĂ pentru persoane juridice
Contribuabil: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Număr de ordine în registrul comerțului: {AURORA_J}
Domiciliul fiscal: Calea Fagului nr. 7, Cluj-Napoca, Județ Cluj
Perioada de utilizare: 30 de zile de la data eliberării
Secțiunea A — obligații fiscale restante la data eliberării
Obligații fiscale restante: NU
Secțiunea D — alte mențiuni: nu este cazul
Data eliberării: {{issued}}
Conducătorul organului fiscal emitent (semnătură electronică)"""

EMAIL_OWNERSHIP = """De la: andrei.munteanu@brutaria-aurora.example
Subiect: Modificare acționariat
Bună ziua, vă informăm că domnul Radu Pop a devenit asociat (25%) luna aceasta.
Vă trimitem în zilele următoare declarația de beneficiar real actualizată și actul lui de identitate."""


STAFF = {"type": "employee", "id": "E-0317"}


def _id(first: str, last: str, cnp: str) -> dict:
    return {"type": "id_card", "name": f"Identity card — {first.title()} {last.title()}", "person": f"{first.title()} {last.title()}",
            "text": id_text(first, last, cnp)}


# Scripted inbound items the presenter delivers during the demo (in any order).
SCENARIO = [
    {"id": "day0-pack", "label": "Day 0 · Client uploads application pack (4 docs)", "docs": [
        {"type": "application", "name": "Loan application", "text": APPLICATION},
        {"type": "financial_statement", "name": "Financial statements 2025", "text": FINANCIALS, "issued_offset_days": -60},
        {"type": "ubo_declaration", "name": "UBO declaration (Sep 2026)", "text": UBO_V1, "issued_offset_days": -43},
        _id("ANDREI", "MUNTEANU", "185031••••••"),
    ]},
    {"id": "onrc-cert", "label": "Trade register certificate arrives (issued 07 Oct)", "docs": [
        {"type": "onrc_certificate", "name": "Trade register certificate", "text": ONRC, "issued_offset_days": -21},
    ]},
    {"id": "client-email", "label": "Client email: “shareholder changed”", "docs": [
        {"type": "email", "name": "Email: Modificare acționariat", "text": EMAIL_OWNERSHIP},
    ]},
    {"id": "updated-docs", "label": "Updated UBO declaration + 2 IDs + fiscal certificate", "docs": [
        {"type": "ubo_declaration", "name": "UBO declaration (updated)", "text": UBO_V2},
        _id("ELENA", "MUNTEANU", "288070••••••"),
        _id("RADU", "POP", "179112••••••"),
        {"type": "fiscal_certificate", "name": "Fiscal certificate", "text": FISCAL},
    ]},
    {"id": "fresh-onrc", "label": "Fresh trade register certificate", "docs": [
        {"type": "onrc_certificate", "name": "Trade register certificate (fresh)", "text": ONRC},
    ]},
    # Internal bank events (not from the client): the insider pattern behind the real ANSPDCP 2024 fine (SR-01).
    {"id": "staff-phone-change", "label": "Internal: employee E-0317 changes the client's phone", "events": [
        {"type": "STAFF_CONTACT_CHANGE", "actor": STAFF,
         "payload": {"client_id": "C-1042", "field": "phone", "old": "07•• ••• 112", "new": "07•• ••• 958"}},
    ]},
    {"id": "staff-credit-check", "label": "Internal: same employee runs a credit bureau check", "events": [
        {"type": "CREDIT_ACTION", "actor": STAFF, "payload": {"client_id": "C-1042", "action": "credit_bureau_query"}},
    ]},
]


def materialise(item: dict, now: datetime) -> list[dict]:
    """Turn a scenario item into concrete documents with issue dates."""
    out = []
    for d in item["docs"]:
        issued = CASE_START + timedelta(days=d["issued_offset_days"]) if "issued_offset_days" in d else now
        out.append({**{k: v for k, v in d.items() if k != "issued_offset_days"},
                    "text": d["text"].replace("{issued}", issued.strftime("%d.%m.%Y")),
                    "issued_at": issued.isoformat()})
    return out


# ----------------------------------------------------------------------------- sample files for the client portal
_DOINA_J = onrc_number(2016, 991844, "Cluj")
WRONG_COMPANY_ONRC = f"""MINISTERUL JUSTIȚIEI · OFICIUL NAȚIONAL AL REGISTRULUI COMERȚULUI
Oficiul Registrului Comerțului de pe lângă Tribunalul Cluj
CERTIFICAT CONSTATATOR (de bază)
INFORMAȚII DE IDENTIFICARE
Denumire: PANIFICAȚIA DOINA S.R.L.
Număr de ordine în registrul comerțului: {_DOINA_J}
Identificator unic la nivel european (EUID): ROONRC.{_DOINA_J}
Cod unic de înregistrare: 93052816
Stare firmă: ACTIVĂ
Sediul social: Str. Morii nr. 12, Turda, Județ Cluj
Cod poștal: 401061
ASOCIAȚI PERSOANE FIZICE
Asociat: IONESCU DOINA — 100%
PERSOANE ÎMPUTERNICITE
Administrator: IONESCU DOINA
Data eliberării: {{issued}}"""

ADDRESS_PROOF = """CONTRACT DE COMODAT — SEDIU SOCIAL (extras)
Comodant: Munteanu Andrei (proprietar) · Comodatar: BRUTĂRIA AURORA S.R.L.
Societate: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Sediu social: Str. Fagului nr. 7, bl. A2, Cluj-Napoca, jud. Cluj
Cod poștal: 400127
Durata: 10 ani, cu începere de la 02.03.2019
Data: {issued}"""

MANDATE = """ÎMPUTERNICIRE (procură specială sub semnătură privată)
Societate: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Administrator: MUNTEANU ANDREI
Împuternicit: MUNTEANU ANDREI
Obiect: semnarea cererii de finanțare și a documentelor aferente
Data: {issued}"""

_ID_PEOPLE = {"Andrei Munteanu": ("ANDREI", "MUNTEANU", "185031••••••"), "Elena Munteanu": ("ELENA", "MUNTEANU", "288070••••••"),
              "Radu Pop": ("RADU", "POP", "179112••••••")}
SAMPLES = {  # request key -> (filename, text template)
    "application": ("cerere_finantare.txt", APPLICATION),
    "financial_statement": ("situatii_financiare_2025.txt", FINANCIALS),
    "ubo_declaration": ("declaratie_beneficiar_real.txt", UBO_V2),
    "onrc_certificate": ("certificat_constatator_onrc.txt", ONRC),
    "fiscal_certificate": ("certificat_atestare_fiscala.txt", FISCAL),
    "address_proof": ("dovada_sediu.txt", ADDRESS_PROOF),
    "signatory_mandate": ("imputernicire.txt", MANDATE),
    **{f"id_card:{name}": (f"ci_{last.lower()}_{first.lower()}.txt", id_text(first, last, cnp))
       for name, (first, last, cnp) in _ID_PEOPLE.items()},
}
WRONG_COMPANY = ("certificat_constatator_ALTA_FIRMA.txt", WRONG_COMPANY_ONRC)
