"""Case template for an SME loan + KYB file: requirements, rules, timers.

A second process (e.g. garnishment orders, DORA incidents) is a second template
with the same shape; the engine, ledger and agent do not change.
"""

CASE_TITLE = "SME loan & KYB — Brutăria Aurora SRL"
CASE_GOAL = "File ready for credit decision (the decision itself stays human)"

DOC_VALIDITY_DAYS = 30        # bank policy for registry / fiscal certificates
UBO_THRESHOLD_PCT = 25        # beneficial-owner threshold (Law 129/2019, AMLR)
DSCR_MIN = 1.2
REMINDER_AFTER_DAYS = 3
AMLR_REPORT_DAYS = 14         # AMLR: report register discrepancies (verify the article number on EUR-Lex)
JUDGE_THRESHOLD = 0.9         # auto-accept fuzzy matches only at or above this

DOC_LABELS = {
    "application": "Loan application",
    "financial_statement": "Financial statements 2025",
    "ubo_declaration": "UBO declaration",
    "id_card": "Identity card",
    "onrc_certificate": "Trade register certificate (ONRC)",
    "fiscal_certificate": "Fiscal certificate (ANAF)",
    "email": "Client email",
    "address_proof": "Proof of registered office",
    "signatory_mandate": "Signatory mandate",
}

# Documents whose validity window is enforced (HR-03).
EXPIRING_DOCS = {"onrc_certificate", "fiscal_certificate"}

# Which document AI reads which document type ("bring your own document AI"); see extractors.py.
EXTRACTOR_ROUTES = {"financial_statement": "bank_docai", "*": "builtin"}

REQUIREMENTS = [
    {"id": "R1", "title": "Company active in trade register",
     "needs": ["onrc_certificate"], "rule_ids": ["HR-01", "HR-02", "HR-03"]},
    {"id": "R2", "title": "Beneficial owners declared & identified",
     "needs": ["onrc_certificate", "ubo_declaration", "id_card"], "rule_ids": ["HR-04", "HR-05"]},
    {"id": "R3", "title": "Registered office consistent across documents",
     "needs": ["onrc_certificate", "application"], "rule_ids": ["HR-06", "JQ-01"]},
    {"id": "R4", "title": "Debt service coverage ≥ 1.2",
     "needs": ["application", "financial_statement"], "rule_ids": ["HR-07"]},
    {"id": "R5", "title": "Application signed by legal representative",
     "needs": ["onrc_certificate", "application"], "rule_ids": ["JQ-02"]},
    {"id": "R6", "title": "No outstanding tax debts",
     "needs": ["fiscal_certificate"], "rule_ids": ["HR-08", "HR-03"]},
]

RULES = {
    "HR-01": "Company tax ID (CUI) must pass the official checksum.",
    "HR-02": "Company must be ACTIVE in the trade register (ONRC lookup).",
    "HR-03": f"Registry and fiscal certificates are valid for {DOC_VALIDITY_DAYS} days from issue (bank policy).",
    "HR-04": f"Every person owning ≥{UBO_THRESHOLD_PCT}% in the trade register must appear, with the same share, "
             f"in the UBO declaration (Law 129/2019; AMLR: report register discrepancies within {AMLR_REPORT_DAYS} days).",
    "HR-05": "Every beneficial owner must have an identity document on file.",
    "HR-06": "Registered-office postal code must match across documents.",
    "HR-07": f"DSCR = EBITDA / (existing + new annual debt service) must be ≥ {DSCR_MIN}.",
    "HR-08": "Fiscal certificate must show no outstanding tax obligations.",
    "JQ-01": f"Judge: are both addresses the same place? Auto-accept only if p ≥ {JUDGE_THRESHOLD}.",
    "JQ-02": f"Judge: is the signatory the registered administrator? Auto-accept only if p ≥ {JUDGE_THRESHOLD}.",
    "GATE-01": "Only actions allowed by the current case state may run.",
    "GATE-02": "Credit approval is a human decision — the agent has no such action.",
    "GATE-03": "A document already requested and still pending is not requested again.",
}


def requirements_needing(doc_type: str) -> list[str]:
    return [r["id"] for r in REQUIREMENTS if doc_type in r["needs"]]
