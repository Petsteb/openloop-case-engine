"""Hard rules: pure, deterministic functions. No model is involved here."""
import re
import unicodedata
from datetime import datetime, timedelta

from .template import DOC_VALIDITY_DAYS, DSCR_MIN, UBO_THRESHOLD_PCT

CUI_KEY = "753217532"


def cui_checksum_valid(cui: str) -> bool:
    """Romanian CUI control digit: key 753217532 over the zero-padded body, (sum*10) % 11, 10 -> 0."""
    digits = re.sub(r"\D", "", cui or "")
    if not 2 <= len(digits) <= 10:
        return False
    body, control = digits[:-1].zfill(9), int(digits[-1])
    check = sum(int(d) * int(k) for d, k in zip(body, CUI_KEY)) * 10 % 11
    return (0 if check == 10 else check) == control


def norm_text(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()


def same_name_exact(a: str, b: str) -> bool:
    """Same tokens regardless of order/case/diacritics ("POP RADU" == "Radu Pop")."""
    return sorted(norm_text(a).split()) == sorted(norm_text(b).split())


def doc_expires_at(issued_at: datetime) -> datetime:
    try:
        return issued_at + timedelta(days=DOC_VALIDITY_DAYS)
    except OverflowError:  # SEC-05: an impossible date (31.12.9999) buys no validity and never crashes the case
        return issued_at


def doc_is_valid(issued_at: datetime, now: datetime) -> bool:
    """Valid from the issue day for DOC_VALIDITY_DAYS. A document dated after today is not valid (SEC-04)."""
    return issued_at.date() <= now.date() and now < doc_expires_at(issued_at)


def ubo_check(register_owners: list[dict], declared_owners: list[dict]) -> dict:
    """Compare owners >= threshold in the register with the UBO declaration (HR-04)."""
    ubos = [o for o in register_owners if o["pct"] >= UBO_THRESHOLD_PCT]
    missing, pct_mismatch = [], []
    for o in ubos:
        match = next((d for d in declared_owners if same_name_exact(o["name"], d["name"])), None)
        if match is None:
            missing.append(o)
        elif abs(match["pct"] - o["pct"]) > 0.01:
            pct_mismatch.append({"name": o["name"], "register_pct": o["pct"], "declared_pct": match["pct"]})
    return {"ok": not missing and not pct_mismatch, "ubos": ubos, "missing": missing, "pct_mismatch": pct_mismatch}


def owners_without_id(ubos: list[dict], id_names: list[str]) -> list[str]:
    return [o["name"] for o in ubos if not any(same_name_exact(o["name"], n) for n in id_names)]


def postal_match(a: str, b: str) -> bool:
    return bool(a) and re.sub(r"\D", "", a) == re.sub(r"\D", "", b or "")


def dscr(ebitda: float, existing_service: float, new_service: float) -> float:
    total = existing_service + new_service
    return round(ebitda / total, 2) if total else float("inf")


def dscr_ok(value: float) -> bool:
    return value >= DSCR_MIN


def fiscal_clean(obligations: str) -> bool:
    return norm_text(obligations) == "nu"


def parse_amount(s: str) -> float:
    """'420.000 RON' -> 420000.0 (Romanian thousands separator)."""
    digits = re.sub(r"[^\d,]", "", s or "").replace(",", ".")
    return float(digits) if digits else 0.0
