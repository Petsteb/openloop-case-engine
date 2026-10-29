"""Field extraction with verbatim quotes, plus quote verification.

Scripted mode parses our synthetic "Key: value" documents. An LLM extractor must return the
same shape; `verify_quotes` then proves every quote really appears in the source text.
"""
import re

from .rules import norm_text, parse_amount

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
    "address_proof": {"societate": "company_name", "cui": "cui", "sediu social": "address", "cod poștal": "postal_code"},
    "signatory_mandate": {"societate": "company_name", "cui": "cui", "administrator": "administrator",
                          "împuternicit": "authorized_person"},
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
        if body.strip():
            fields.append({"field": "body", "value": body.strip(), "quote": body.strip()})
    return {"fields": fields, **owners}


def _supports(quote: str, *values) -> bool:
    nq = norm_text(quote)
    return all(norm_text(str(v)) in nq for v in values if str(v).strip())


def verify_quotes(text: str, extraction: dict) -> list[str]:
    """Return the quotes that fail verification (should be empty).

    A quote passes only if it is non-empty, appears verbatim in the document, AND actually contains the
    extracted value (owners: name and share). A real quote paired with a forged value fails too.
    """
    bad = [f["quote"] for f in extraction.get("fields", [])
           if not f.get("quote") or f["quote"] not in text or not _supports(f["quote"], f.get("value", ""))]
    for key in OWNER_KEYS.values():
        bad += [o["quote"] for o in extraction.get(key, [])
                if not o.get("quote") or o["quote"] not in text or not _supports(o["quote"], o["name"], f"{o['pct']:g}")]
    return bad


def scan_injection(text: str) -> list[str]:
    return [l.strip() for l in text.splitlines() if INJECTION_RE.search(l)]


def field(extraction: dict, name: str) -> dict | None:
    return next((f for f in extraction.get("fields", []) if f["field"] == name), None)


def amount(extraction: dict, name: str) -> float | None:
    """The field's amount, or None when the line is missing or unreadable (never 0: SEC-06)."""
    f = field(extraction, name)
    return parse_amount(f["value"]) if f else None
