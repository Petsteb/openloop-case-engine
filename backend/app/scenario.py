"""Synthetic demo case: a fictional bakery applies for an SME working-capital loan.

All companies, people and IDs are fictional. Documents are Romanian text stand-ins for PDFs.
`{issued}` is replaced with the delivery date; a fixed `issued_offset_days` pins an older issue date.
"""
from datetime import datetime, timedelta, timezone

CASE_START = datetime(2026, 10, 28, 9, 0, tzinfo=timezone.utc)

APPLICATION = """CERERE DE FINANȚARE — IMM
Solicitant: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Sediu social: Str. Fagului nr. 7, bl. A2, Cluj-Napoca, jud. Cluj
Cod poștal: 400127
Produs solicitat: Credit capital de lucru
Suma solicitată: 500.000 RON
Rată anuală estimată credit nou: 120.000 RON
Reprezentant legal / semnatar: Andrei Munteanu
Data cererii: {issued}"""

FINANCIALS = """SITUAȚII FINANCIARE ANUALE 2025 — EXTRAS
Entitate: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Cifra de afaceri netă: 3.150.000 RON
EBITDA: 420.000 RON
Serviciul anual al datoriei existente: 180.000 RON
Profit net: 210.000 RON"""

UBO_V1 = """DECLARAȚIE PRIVIND BENEFICIARUL REAL
Societate: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Beneficiar real: Andrei Munteanu — 70%
Beneficiar real: Elena Munteanu — 30%
Data declarației: 15.09.2026"""

UBO_V2 = """DECLARAȚIE PRIVIND BENEFICIARUL REAL (actualizată)
Societate: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Beneficiar real: Andrei Munteanu — 45%
Beneficiar real: Elena Munteanu — 30%
Beneficiar real: Radu Pop — 25%
Data declarației: {issued}"""

ID_TEMPLATE = """CARTE DE IDENTITATE (copie)
Nume: {last}
Prenume: {first}
CNP: {cnp_masked}
Valabilă până la: {valid_until}"""

ONRC = """CERTIFICAT CONSTATATOR — Oficiul Național al Registrului Comerțului
Denumire: BRUTĂRIA AURORA S.R.L.
Cod unic de înregistrare: 94123877
Stare firmă: ACTIVĂ
Sediul social: Calea Fagului nr. 7, Cluj-Napoca, Județ Cluj
Cod poștal: 400127
Administrator: MUNTEANU ANDREI
Asociat: MUNTEANU ANDREI — 45%
Asociat: MUNTEANU ELENA — 30%
Asociat: POP RADU — 25%
Data eliberării: {issued}"""

FISCAL = """CERTIFICAT DE ATESTARE FISCALĂ — ANAF
Contribuabil: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Obligații fiscale restante: NU
Data eliberării: {issued}"""

EMAIL_OWNERSHIP = """De la: andrei.munteanu@brutaria-aurora.example
Subiect: Modificare acționariat
Bună ziua, vă informăm că domnul Radu Pop a devenit asociat (25%) luna aceasta.
Vă trimitem în zilele următoare declarația de beneficiar real actualizată și actul lui de identitate."""


STAFF = {"type": "employee", "id": "E-0317"}


def _id(first: str, last: str, cnp: str) -> dict:
    return {"type": "id_card", "name": f"Identity card — {first.title()} {last.title()}", "person": f"{first.title()} {last.title()}",
            "text": ID_TEMPLATE.format(first=first, last=last, cnp_masked=cnp, valid_until="12.03.2031")}


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
WRONG_COMPANY_ONRC = """CERTIFICAT CONSTATATOR — Oficiul Național al Registrului Comerțului
Denumire: PANIFICAȚIA DOINA S.R.L.
Cod unic de înregistrare: 93052816
Stare firmă: ACTIVĂ
Sediul social: Str. Morii nr. 12, Turda, Județ Cluj
Cod poștal: 401061
Administrator: IONESCU DOINA
Asociat: IONESCU DOINA — 100%
Data eliberării: {issued}"""

ADDRESS_PROOF = """CONTRACT DE COMODAT — SEDIU SOCIAL (extras)
Societate: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Sediu social: Str. Fagului nr. 7, bl. A2, Cluj-Napoca, jud. Cluj
Cod poștal: 400127
Data: {issued}"""

MANDATE = """ÎMPUTERNICIRE
Societate: BRUTĂRIA AURORA S.R.L.
CUI: 94123877
Administrator: MUNTEANU ANDREI
Împuternicit: MUNTEANU ANDREI
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
    **{f"id_card:{name}": (f"ci_{last.lower()}_{first.lower()}.txt",
                           ID_TEMPLATE.format(first=first, last=last, cnp_masked=cnp, valid_until="12.03.2031"))
       for name, (first, last, cnp) in _ID_PEOPLE.items()},
}
WRONG_COMPANY = ("certificat_constatator_ALTA_FIRMA.txt", WRONG_COMPANY_ONRC)


def sample_file(key: str, variant: str = "ok") -> tuple[str, str] | None:
    """(filename, text) of the prepared upload for a request key; `wrong_company` gives another firm's ONRC certificate."""
    if variant == "wrong_company":
        return WRONG_COMPANY
    doc_type, _, person = key.partition(":")
    if doc_type == "id_card":
        match = next((k for k in SAMPLES if k.startswith("id_card:") and
                      sorted(k[8:].lower().split()) == sorted(person.lower().split())), None)
        return SAMPLES.get(match) if match else None
    return SAMPLES.get(key)
