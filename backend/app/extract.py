"""Field extraction with verbatim quotes, plus quote verification.

Scripted mode parses our synthetic "Key: value" documents. An LLM extractor must return the
same shape; `verify_quotes` then proves every quote really appears in the source text.
"""
import re

from .rules import parse_amount

# document type -> {line key (lowercase, Romanian) -> field name}
FIELD_MAP = {
    "application": {"solicitant": "company_name", "cui": "cui", "sediu social": "address", "cod poștal": "postal_code",
                    "suma solicitată": "loan_amount", "rată anuală estimată credit nou": "new_annual_debt_service",
                    "reprezentant legal / semnatar": "signatory"},
    "financial_statement": {"entitate": "company_name", "cui": "cui", "ebitda": "ebitda",
                            "serviciul anual al datoriei existente": "existing_annual_debt_service"},
    "ubo_declaration": {"societate": "company_name", "cui": "cui"},
    "id_card": {"nume": "last_name", "prenume": "first_name", "valabilă până la": "valid_until"},
    "onrc_certificate": {"denumire": "company_name", "cod unic de înregistrare": "cui", "stare firmă": "status",
                         "sediul social": "address", "cod poștal": "postal_code", "administrator": "administrator",
                         "data eliberării": "issued"},
    "fiscal_certificate": {"contribuabil": "company_name", "cui": "cui",
                           "obligații fiscale restante": "outstanding_obligations", "data eliberării": "issued"},
    "email": {"de la": "from", "subiect": "subject"},
}
OWNER_KEYS = {"beneficiar real": "declared_owners", "asociat": "register_owners"}
OWNER_RE = re.compile(r"^(?P<name>.+?)\s+—\s+(?P<pct>\d+(?:[.,]\d+)?)%$")
INJECTION_RE = re.compile(r"(ignore (all |previous )?(rules|instructions)|ignoră regulile|system:|approve (the )?(file|loan))", re.I)


def extract_scripted(doc_type: str, text: str) -> dict:
    fields, owners = [], {}
    mapping = FIELD_MAP.get(doc_type, {})
    for line in text.splitlines():
        if ":" not in line:
            continue
        key, value = (p.strip() for p in line.split(":", 1))
        k = key.lower()
        if k in OWNER_KEYS and (m := OWNER_RE.match(value)):
            owners.setdefault(OWNER_KEYS[k], []).append(
                {"name": m["name"], "pct": float(m["pct"].replace(",", ".")), "quote": line})
        elif k in mapping:
            fields.append({"field": mapping[k], "value": value, "quote": line})
    if doc_type == "email":
        body = "\n".join(l for l in text.splitlines() if ":" not in l.split(" ")[0])
        fields.append({"field": "body", "value": body.strip(), "quote": body.strip().splitlines()[0] if body.strip() else ""})
    return {"fields": fields, **owners}


def verify_quotes(text: str, extraction: dict) -> list[str]:
    """Return the quotes that do NOT appear verbatim in the document (should be empty)."""
    quotes = [f["quote"] for f in extraction.get("fields", [])]
    for key in OWNER_KEYS.values():
        quotes += [o["quote"] for o in extraction.get(key, [])]
    return [q for q in quotes if q and q not in text]


def scan_injection(text: str) -> list[str]:
    return [l.strip() for l in text.splitlines() if INJECTION_RE.search(l)]


def field(extraction: dict, name: str) -> dict | None:
    return next((f for f in extraction.get("fields", []) if f["field"] == name), None)


def amount(extraction: dict, name: str) -> float:
    f = field(extraction, name)
    return parse_amount(f["value"]) if f else 0.0
