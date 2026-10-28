"""Synthetic client companies and their documents. Every company, person and ID here is fictional.

Each profile drives a full document set (Romanian text stand-ins for the real forms) and a scripted inbound
scenario for the demo dock. "aurora" is the original demo case and keeps its hand-written scenario (scenario.py).
Each profile has a `story`: the one problem its file exercises, so every rule path has a reproducible case.
"""
from . import scenario as S
from .rules import CUI_KEY


def _cui(body: str) -> str:
    """A tax ID with a valid control digit (HR-01) for a fictional company."""
    check = sum(int(d) * int(k) for d, k in zip(body.zfill(9), CUI_KEY)) * 10 % 11
    return body + str(0 if check == 10 else check)


def _p(first: str, last: str, cnp: str, pct: float = 0) -> dict:
    return {"first": first, "last": last, "cnp": cnp, "pct": pct}


PROFILES: dict[str, dict] = {
    "aurora": {
        "id": "aurora", "name": "Brutăria Aurora SRL", "legal_name": "BRUTĂRIA AURORA S.R.L.", "cui": "45123879",
        "client_id": "C-1042", "actor_id": "brutaria-aurora", "email": "andrei.munteanu@brutaria-aurora.example",
        "city": "Cluj-Napoca", "county": "Cluj", "caen": "1071 Fabricarea pâinii",
        "product": "Working-capital loan, 500,000 RON", "templates": ["sme_loan"],
        "story": "Undeclared co-owner, address written two ways, certificate expiring mid-file, insider pattern",
    },
    "verde": {
        "id": "verde", "name": "Verde Logistic SRL", "legal_name": "VERDE LOGISTIC S.R.L.", "cui": _cui("4187263"),
        "client_id": "C-2210", "email": "office@verde-logistic.example", "city": "Timișoara", "county": "Timiș",
        "street": "Str. Gheorghe Lazăr nr. 24", "postal_code": "300081", "caen": "4941 Transporturi rutiere de mărfuri",
        "loan": 750_000, "new_service": 300_000, "turnover": 6_400_000, "ebitda": 1_250_000, "existing_service": 400_000,
        "net_profit": 610_000, "admin": _p("CRISTIAN", "VLAD", "180042••••••"),
        "owners": [_p("CRISTIAN", "VLAD", "180042••••••", 60), _p("SIMONA", "VLAD", "285110••••••", 40)],
        "product": "Working-capital loan, 750,000 RON", "templates": ["sme_loan", "kyb_review"],
        "story": "Clean file: every check passes without a human",
    },
    "carpatic": {
        "id": "carpatic", "name": "Carpatic Lemn SRL", "legal_name": "CARPATIC LEMN S.R.L.", "cui": _cui("3926154"),
        "client_id": "C-2311", "email": "contabilitate@carpatic-lemn.example", "city": "Bistrița", "county": "Bistrița-Năsăud",
        "street": "Str. Industriei nr. 9", "postal_code": "420063", "caen": "1610 Tăierea și rindeluirea lemnului",
        "loan": 400_000, "new_service": 150_000, "turnover": 2_900_000, "ebitda": 640_000, "existing_service": 200_000,
        "net_profit": 300_000, "tax_debt": True, "admin": _p("GHEORGHE", "MOLDOVAN", "166072••••••"),
        "owners": [_p("GHEORGHE", "MOLDOVAN", "166072••••••", 100)],
        "product": "Working-capital loan, 400,000 RON", "templates": ["sme_loan", "kyb_review"],
        "story": "Outstanding tax debt on the ANAF certificate (HR-08)",
    },
    "delta": {
        "id": "delta", "name": "Delta Pescăria SRL", "legal_name": "DELTA PESCĂRIA S.R.L.", "cui": _cui("3381927"),
        "client_id": "C-2412", "email": "contact@delta-pescaria.example", "city": "Tulcea", "county": "Tulcea",
        "street": "Str. Isaccei nr. 15", "postal_code": "820025", "caen": "4723 Comerț cu amănuntul al peștelui",
        "loan": 200_000, "new_service": 90_000, "turnover": 980_000, "ebitda": 300_000, "existing_service": 60_000,
        "net_profit": 140_000, "registry_status": "SUSPENDATĂ", "admin": _p("MARIN", "STAN", "171105••••••"),
        "owners": [_p("MARIN", "STAN", "171105••••••", 100)],
        "product": "Working-capital loan, 200,000 RON", "templates": ["sme_loan", "kyb_review"],
        "story": "Company activity suspended in the trade register (HR-02)",
    },
    "nord": {
        "id": "nord", "name": "Nord Construct Instal SRL", "legal_name": "NORD CONSTRUCT INSTAL S.R.L.",
        "cui": _cui("4402718"), "client_id": "C-2513", "email": "office@nordconstruct.example", "city": "Suceava",
        "county": "Suceava", "street": "Bd. George Enescu nr. 31", "postal_code": "720231",
        "caen": "4322 Lucrări de instalații sanitare, de încălzire și de aer condiționat",
        "loan": 600_000, "new_service": 180_000, "turnover": 3_700_000, "ebitda": 520_000, "existing_service": 310_000,
        "net_profit": 120_000, "admin": _p("DORIN", "LUPU", "177091••••••"),
        "owners": [_p("DORIN", "LUPU", "177091••••••", 50), _p("FLORIN", "HUȚANU", "182033••••••", 50)],
        "product": "Working-capital loan, 600,000 RON", "templates": ["sme_loan"],
        "story": "Debt service coverage 1.06, below the 1.2 minimum (HR-07)",
    },
    "medica": {
        "id": "medica", "name": "Medica Plus Clinic SRL", "legal_name": "MEDICA PLUS CLINIC S.R.L.", "cui": _cui("3815562"),
        "client_id": "C-2614", "email": "administrativ@medicaplus.example", "city": "Iași", "county": "Iași",
        "street": "Str. Păcurari nr. 102", "postal_code": "700545", "caen": "8622 Activități de asistență medicală specializată",
        "loan": 350_000, "new_service": 110_000, "turnover": 2_100_000, "ebitda": 480_000, "existing_service": 120_000,
        "net_profit": 260_000, "admin": _p("IOANA", "RUSU", "279061••••••"), "signatory": "Mihai Ciobanu",
        "owners": [_p("IOANA", "RUSU", "279061••••••", 70), _p("MIHAI", "CIOBANU", "181122••••••", 30)],
        "product": "Working-capital loan, 350,000 RON", "templates": ["sme_loan"],
        "story": "Application signed by an associate who is not the administrator: a human decides, then a mandate",
    },
    "solaris": {
        "id": "solaris", "name": "Solaris Agro SRL", "legal_name": "SOLARIS AGRO S.R.L.", "cui": _cui("4129836"),
        "client_id": "C-2715", "email": "solaris.agro@example.ro", "city": "Fetești", "county": "Ialomița",
        "street": "Str. Călărași nr. 8", "postal_code": "925100", "caen": "0111 Cultivarea cerealelor",
        "loan": 300_000, "new_service": 100_000, "turnover": 1_600_000, "ebitda": 410_000, "existing_service": 90_000,
        "net_profit": 230_000, "onrc_age_days": 45, "admin": _p("VASILE", "DUMITRU", "169120••••••"),
        "owners": [_p("VASILE", "DUMITRU", "169120••••••", 100)],
        "product": "Working-capital loan, 300,000 RON", "templates": ["sme_loan", "kyb_review"],
        "story": "Trade register certificate already 45 days old when it arrives (HR-03): a fresh one is requested",
    },
    "atelier": {
        "id": "atelier", "name": "Atelier Croitorie Ana SRL", "legal_name": "ATELIER CROITORIE ANA S.R.L.",
        "cui": _cui("3672041"), "client_id": "C-2816", "email": "ana@atelier-croitorie.example", "city": "Brașov",
        "county": "Brașov", "street": "Str. Mureșenilor nr. 5", "postal_code": "500030",
        "caen": "1413 Fabricarea altor articole de îmbrăcăminte", "admin": _p("ANA", "MARIN", "283014••••••"),
        "owners": [_p("ANA", "MARIN", "283014••••••", 80), _p("LUCIAN", "MARIN", "180519••••••", 20)],
        "product": "Annual business review", "templates": ["kyb_review"],
        "story": "Annual review of an existing client: registry, owners and taxes only",
    },
}


def _name(p: dict) -> str:
    return f"{p['first'].title()} {p['last'].title()}"


def _ron(v: float) -> str:
    return f"{v:,.0f}".replace(",", ".") + " RON"


def _address(c: dict) -> str:
    return f"{c['street']}, {c['city']}, Județ {c['county']}"


def application(c: dict) -> str:
    return f"""CERERE DE FINANȚARE — IMM
Solicitant: {c['legal_name']}
CUI: {c['cui']}
Cod CAEN principal: {c['caen']}
Sediu social: {c['street']}, {c['city']}, jud. {c['county']}
Cod poștal: {c['postal_code']}
Produs solicitat: Credit capital de lucru
Suma solicitată: {_ron(c['loan'])}
Perioada: 36 luni
Rată anuală estimată credit nou: {_ron(c['new_service'])}
Persoană de contact: {c['email']}
Reprezentant legal / semnatar: {c.get('signatory') or _name(c['admin'])}
Data cererii: {{issued}}"""


def financials(c: dict) -> str:
    return f"""SITUAȚII FINANCIARE ANUALE 2025 — EXTRAS (formular F10/F20)
Entitate: {c['legal_name']}
CUI: {c['cui']}
Cifra de afaceri netă: {_ron(c['turnover'])}
EBITDA: {_ron(c['ebitda'])}
Serviciul anual al datoriei existente: {_ron(c['existing_service'])}
Profit net: {_ron(c['net_profit'])}
Număr mediu de salariați: {max(3, int(c['turnover'] // 250_000))}"""


def ubo_declaration(c: dict) -> str:
    lines = [f"Beneficiar real: {_name(o)} — {o['pct']:g}%" for o in c["owners"] if o["pct"] >= 25]
    return ("DECLARAȚIE PRIVIND BENEFICIARUL REAL (Legea nr. 129/2019, art. 56)\n"
            f"Societate: {c['legal_name']}\nCUI: {c['cui']}\n" + "\n".join(lines)
            + "\nModalitatea de exercitare a controlului: deținere de părți sociale\nData declarației: {issued}")


def id_card(o: dict) -> str:
    return S.ID_TEMPLATE.format(first=o["first"], last=o["last"], cnp_masked=o["cnp"], valid_until="12.03.2031")


def onrc(c: dict) -> str:
    owners = "\n".join(f"Asociat: {o['last']} {o['first']} — {o['pct']:g}%" for o in c["owners"])
    return f"""CERTIFICAT CONSTATATOR — Oficiul Național al Registrului Comerțului
Denumire: {c['legal_name']}
Cod unic de înregistrare: {c['cui']}
Stare firmă: {c.get('registry_status', 'ACTIVĂ')}
Sediul social: {_address(c)}
Cod poștal: {c['postal_code']}
Activitate principală: {c['caen']}
Administrator: {c['admin']['last']} {c['admin']['first']}
{owners}
Data eliberării: {{issued}}"""


def fiscal(c: dict) -> str:
    return f"""CERTIFICAT DE ATESTARE FISCALĂ — ANAF
Contribuabil: {c['legal_name']}
CUI: {c['cui']}
Domiciliul fiscal: {_address(c)}
Obligații fiscale restante: {'DA — 38.410 RON (impozit pe profit, contribuții)' if c.get('tax_debt') else 'NU'}
Data eliberării: {{issued}}"""


def address_proof(c: dict) -> str:
    return f"""CONTRACT DE ÎNCHIRIERE — SEDIU SOCIAL (extras)
Societate: {c['legal_name']}
CUI: {c['cui']}
Sediu social: {c['street']}, {c['city']}, jud. {c['county']}
Cod poștal: {c['postal_code']}
Data: {{issued}}"""


def mandate(c: dict) -> str:
    return f"""ÎMPUTERNICIRE
Societate: {c['legal_name']}
CUI: {c['cui']}
Administrator: {c['admin']['last']} {c['admin']['first']}
Împuternicit: {c.get('signatory') or _name(c['admin'])}
Obiect: semnarea cererii de finanțare și a documentelor aferente
Data: {{issued}}"""


def _id_doc(o: dict) -> dict:
    return {"type": "id_card", "name": f"Identity card — {_name(o)}", "person": _name(o), "text": id_card(o)}


def scenario_for(profile_id: str, template: str) -> list[dict]:
    """The demo dock's inbound items for this company and template."""
    if profile_id == "aurora" and template == "sme_loan":
        return S.SCENARIO
    c = PROFILES[profile_id]
    ids = [_id_doc(o) for o in c["owners"] if o["pct"] >= 25]
    pack = ([{"type": "application", "name": "Loan application", "text": application(c)},
             {"type": "financial_statement", "name": "Financial statements 2025", "text": financials(c),
              "issued_offset_days": -60}] if template == "sme_loan" else [])
    pack += [{"type": "ubo_declaration", "name": "UBO declaration", "text": ubo_declaration(c)}, *ids]
    onrc_doc = {"type": "onrc_certificate", "name": "Trade register certificate", "text": onrc(c)}
    if c.get("onrc_age_days"):
        onrc_doc["issued_offset_days"] = -c["onrc_age_days"]
    items = [{"id": "day0-pack", "label": f"Client uploads the {'application' if template == 'sme_loan' else 'review'} pack "
                                          f"({len(pack)} docs)", "docs": pack},
             {"id": "onrc-cert", "label": "Trade register certificate arrives", "docs": [onrc_doc]},
             {"id": "fiscal-cert", "label": "Fiscal certificate arrives",
              "docs": [{"type": "fiscal_certificate", "name": "Fiscal certificate", "text": fiscal(c)}]}]
    if c.get("onrc_age_days"):
        items.append({"id": "fresh-onrc", "label": "Fresh trade register certificate", "docs": [
            {"type": "onrc_certificate", "name": "Trade register certificate (fresh)", "text": onrc(c)}]})
    if c.get("signatory") and template == "sme_loan":
        items.append({"id": "mandate", "label": "Signatory mandate arrives", "docs": [
            {"type": "signatory_mandate", "name": "Signatory mandate", "text": mandate(c)}]})
    return items


def samples_for(profile_id: str) -> dict[str, tuple[str, str]]:
    """Request key -> (filename, text template) for the portal's 'Use sample file'."""
    if profile_id == "aurora":
        return S.SAMPLES
    c = PROFILES[profile_id]
    slug = profile_id
    out = {}
    if "sme_loan" in c["templates"]:  # loan documents only exist for companies that apply for a loan
        out |= {"application": (f"cerere_finantare_{slug}.txt", application(c)),
                "financial_statement": (f"situatii_financiare_2025_{slug}.txt", financials(c)),
                "signatory_mandate": (f"imputernicire_{slug}.txt", mandate(c))}
    out |= {"ubo_declaration": (f"declaratie_beneficiar_real_{slug}.txt", ubo_declaration(c)),
            "onrc_certificate": (f"certificat_constatator_{slug}.txt", onrc(c)),
            "fiscal_certificate": (f"certificat_atestare_fiscala_{slug}.txt", fiscal(c)),
            "address_proof": (f"dovada_sediu_{slug}.txt", address_proof(c))}
    for o in c["owners"]:
        out[f"id_card:{_name(o)}"] = (f"ci_{o['last'].lower()}_{o['first'].lower()}.txt", id_card(o))
    return out


def snapshot(profile_id: str) -> dict:
    """What the ledger records about the client when a case opens (the ledger stays self-describing)."""
    c = PROFILES[profile_id]
    return {k: c[k] for k in ("id", "name", "legal_name", "cui", "client_id", "email", "city", "county", "product")} | {
        "actor_id": c.get("actor_id", profile_id),
        "people": ([_name(o) for o in c["owners"]] + [_name(c["admin"])] if "owners" in c
                   else ["Andrei Munteanu", "Elena Munteanu", "Radu Pop"])}


def profile_of(events: list[dict]) -> dict:
    """The client profile recorded in the case's CASE_OPENED event (older ledgers: the demo bakery)."""
    opened = next((e for e in events if e["type"] == "CASE_OPENED"), None)
    return ((opened or {}).get("payload") or {}).get("profile") or snapshot("aurora")


def template_of(events: list[dict]) -> str:
    opened = next((e for e in events if e["type"] == "CASE_OPENED"), None)
    t = ((opened or {}).get("payload") or {}).get("template", "sme_loan")
    return "sme_loan" if t == "kyb_sme_v1" else t


def registry_entries() -> dict[str, dict]:
    """The mock trade register knows every synthetic company."""
    out = {}
    for c in PROFILES.values():
        admin = f"{c['admin']['last']} {c['admin']['first']}" if "admin" in c else "MUNTEANU ANDREI"
        out[c["cui"]] = {"cui": c["cui"], "name": c["legal_name"], "status": c.get("registry_status", "ACTIVĂ"),
                         "postal_code": c.get("postal_code", "400127"), "administrator": admin}
    return out
