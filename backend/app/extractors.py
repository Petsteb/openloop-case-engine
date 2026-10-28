"""Document extractors: bring your own document AI.

Code always calls an extractor for every incoming document (it is never optional for the agent).
Each document type is routed to an adapter: our built-in parser, or the bank's existing document AI
(RBI Risk Assistant document checks, Raiffeisen Romania's SME document reading, an Appian flow...).
Whatever answers must return our contract, fields plus verbatim quotes, and the engine then verifies
every quote against the document text, so even the bank's own AI is checked.
"""
import os

from . import template as T
from .extract import extract_scripted


def builtin(doc_type: str, text: str) -> dict:
    return extract_scripted(doc_type, text)


def bank_docai(doc_type: str, text: str) -> dict:
    """Simulated adapter for the bank's existing document AI (its real interface is not public).

    With DOCAI_CURVEBALL=1 it also returns one field whose quote is not in the document,
    so the demo can show code rejecting an unverifiable extraction.
    """
    out = extract_scripted(doc_type, text)
    if os.environ.get("DOCAI_CURVEBALL") == "1" and doc_type == "financial_statement":
        out["fields"].append({"field": "net_debt", "value": "95.000 RON", "quote": "Datorie netă: 95.000 RON"})
    return out


ADAPTERS = {"builtin": builtin, "bank_docai": bank_docai}


def route(doc_type: str) -> str:
    return T.EXTRACTOR_ROUTES.get(doc_type, T.EXTRACTOR_ROUTES["*"])


def extract(doc_type: str, text: str) -> tuple[dict, str]:
    name = route(doc_type)
    return ADAPTERS[name](doc_type, text), name
