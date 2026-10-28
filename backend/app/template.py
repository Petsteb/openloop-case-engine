"""Case template for an SME loan + KYB file: requirements, rules, timers.

A second process (e.g. garnishment orders, DORA incidents) is a second template
with the same shape; the engine, ledger and agent do not change.
"""

CASE_TITLE = "SME loan & KYB — Brutăria Aurora SRL"
CASE_GOAL = "File ready for credit decision (the decision itself stays human)"
CLIENT_COMPANY = "Brutăria Aurora SRL"
PRODUCT = "Working-capital loan, 500,000 RON"
CASE_CUI = "45123879"   # uploads with another company's tax ID are quarantined

DOC_VALIDITY_DAYS = 30        # bank policy for registry / fiscal certificates
UBO_THRESHOLD_PCT = 25        # beneficial-owner threshold (Law 129/2019, AMLR)
DSCR_MIN = 1.2
REMINDER_AFTER_DAYS = 3
AMLR_REPORT_DAYS = 14         # AMLR: report register discrepancies (verify the article number on EUR-Lex)
JUDGE_THRESHOLD = 0.9         # classifier (Featherless) must reach this...
HEURISTIC_THRESHOLD = 0.8     # ...and the independent similarity check this (calibrated: 0 false approvals)

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

# Sequence rules evaluated over the ledger (sequence.py). Times are simulated time.
SEQUENCE_RULES = [
    {"id": "SR-01", "first": "STAFF_CONTACT_CHANGE", "then": "CREDIT_ACTION", "same": ["actor.id", "payload.client_id"],
     "first_actor_type": "employee", "within_hours": 48, "unless": "CLIENT_CONFIRMATION"},
]

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
    "JQ-01": f"Judge: are both addresses the same place? Auto-accept only if the similarity check (p ≥ "
             f"{HEURISTIC_THRESHOLD}) and, when the classifier is used, the classifier (p ≥ {JUDGE_THRESHOLD}) agree.",
    "JQ-02": f"Judge: is the signatory the registered administrator? Auto-accept only if the similarity check (p ≥ "
             f"{HEURISTIC_THRESHOLD}) and, when the classifier is used, the classifier (p ≥ {JUDGE_THRESHOLD}) agree.",
    "SR-01": "An employee changed the client's contact details and then started a credit action for the same client "
             "within 48 hours, without client confirmation.",
    "SR-02": "The client says they did not request a contact change made by bank staff: compliance reviews it before "
             "the file continues.",
    "GATE-01": "Only actions allowed by the current case state may run.",
    "GATE-02": "Credit approval is a human decision — the agent has no such action.",
    "GATE-03": "A document already requested and still pending is not requested again.",
}


def requirements_needing(doc_type: str, active: object = None) -> list[str]:
    """Requirements that use this document type; `active` (a case's reqs) limits it to the case's template."""
    return [r["id"] for r in REQUIREMENTS if doc_type in r["needs"] and (active is None or r["id"] in active)]


# Case templates: the same engine, rules and agent; a template picks which requirements a file must satisfy.
TEMPLATES = {
    "sme_loan": {"id": "sme_loan", "title": "SME loan and KYB check", "goal": CASE_GOAL,
                 "description": "Working-capital loan for a small business: company, owners, office, repayment capacity, "
                                "signatory and taxes are checked before a person makes the credit decision.",
                 "requirements": ["R1", "R2", "R3", "R4", "R5", "R6"]},
    "kyb_review": {"id": "kyb_review", "title": "Annual business review",
                   "goal": "File ready for the yearly compliance sign-off (the sign-off itself stays human)",
                   "description": "Yearly know-your-business refresh of an existing client: the company is active, the "
                                  "owners are declared and identified, and there are no tax debts.",
                   "requirements": ["R1", "R2", "R6"]},
}
# Starting documents, in the order they are requested.
BASE_DOCS = ["application", "financial_statement", "ubo_declaration", "onrc_certificate", "fiscal_certificate"]


def template_docs(template_id: str) -> list[str]:
    reqs = set(TEMPLATES[template_id]["requirements"])
    needs = {d for r in REQUIREMENTS if r["id"] in reqs for d in r["needs"]}
    return [d for d in BASE_DOCS if d in needs]
