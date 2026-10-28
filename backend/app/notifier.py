"""Client notifications: one email per step, built from client-safe ledger events only.

Pluggable senders (EMAIL_MODE): `outbox` (default: recorded and shown in the UI, nothing leaves the machine)
or `gmail` (SMTP with an app password). A bank would plug its own gateway or Microsoft Graph here.
Emails never mention internal reviews, risk flags or analyst notes (AML tipping-off), and every email is
written to the ledger as EMAIL_SENT / EMAIL_FAILED for the audit trail.
"""
import hashlib
import os
import smtplib
from email.message import EmailMessage

ENGINE = {"type": "system", "id": "notifier"}
CLIENT_NAME = "Brutăria Aurora S.R.L."
CLIENT_ADDRESS = "andrei.munteanu@brutaria-aurora.example"  # fictional; NOTIFY_TO redirects demo mail to a team inbox
NOTIFIABLE = {"DOCUMENT_REQUESTED", "REMINDER_SENT", "CASE_STATUS"}
RO_LABELS = {
    "application": "Cererea de finanțare",
    "financial_statement": "Situațiile financiare anuale",
    "ubo_declaration": "Declarația privind beneficiarul real (actualizată)",
    "id_card": "Copia actului de identitate",
    "onrc_certificate": "Certificatul constatator ONRC (emis în ultimele 30 de zile)",
    "fiscal_certificate": "Certificatul de atestare fiscală ANAF",
    "address_proof": "Dovada sediului social",
    "signatory_mandate": "Mandatul semnatarului",
}


def ro_label(key: str) -> str:
    doc_type, _, person = key.partition(":")
    return RO_LABELS.get(doc_type, doc_type) + (f" — {person}" if person else "")


def _already_covered(events: list[dict]) -> int:
    covered = [s for e in events if e["type"] in ("EMAIL_SENT", "EMAIL_FAILED") for s in e["payload"].get("covers", [])]
    return max(covered, default=0)


def compose(events: list[dict]) -> dict | None:
    """Pure: the email for client-notifiable events not yet covered, or None."""
    after = _already_covered(events)
    todo = [e for e in events if e["seq"] > after and e["type"] in NOTIFIABLE]
    asks = [ro_label(e["payload"]["key"]) for e in todo if e["type"] == "DOCUMENT_REQUESTED"]
    reminders = [ro_label(e["payload"]["key"]) for e in todo if e["type"] == "REMINDER_SENT"]
    ready = any(e["type"] == "CASE_STATUS" and e["payload"]["status"] == "READY_FOR_DECISION" for e in todo)
    if not (asks or reminders or ready):
        return None
    lines = ["Bună ziua,", ""]
    if asks:
        lines += ["Pentru a continua analiza dosarului de finanțare, vă rugăm să ne trimiteți:"] + [f"  • {a}" for a in asks] + [""]
    if reminders:
        lines += ["Vă reamintim că așteptăm încă:"] + [f"  • {r}" for r in reminders] + [""]
    if ready:
        lines += ["Dosarul dumneavoastră este complet. Un consultant al băncii vă va contacta cu decizia de creditare.", ""]
    lines += ["Puteți răspunde la acest email sau încărca documentele în aplicația Smart Business.", "",
              "Echipa IMM", "(mesaj generat automat; demo OpenLoop, date fictive)"]
    subject = ("Dosar complet: decizia urmează" if ready and not (asks or reminders)
               else "Reamintire: documente necesare" if reminders and not asks
               else "Documente necesare pentru dosarul de finanțare")
    return {"subject": f"{subject} · {CLIENT_NAME}", "body": "\n".join(lines),
            "covers": [e["seq"] for e in todo]}


def _send_gmail(to: str, subject: str, body: str) -> str:
    user, password = os.environ.get("GMAIL_USER", ""), os.environ.get("GMAIL_APP_PASSWORD", "")
    if not (user and password):
        raise RuntimeError("GMAIL_USER / GMAIL_APP_PASSWORD not set")
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = user, to, subject
    msg.set_content(body)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as smtp:
        smtp.login(user, password)
        smtp.send_message(msg)
    return msg.get("Message-ID") or ""


def flush(case) -> dict | None:
    """Compose and deliver at most one email for the newest client-notifiable events; never raises."""
    mail = compose(case.ledger.events)
    if mail is None:
        return None
    mode = os.environ.get("EMAIL_MODE", "outbox")
    to = os.environ.get("NOTIFY_TO") or CLIENT_ADDRESS
    payload = {**mail, "to": to, "mode": mode, "sha256": hashlib.sha256(mail["body"].encode()).hexdigest()}
    try:
        if mode == "gmail":
            payload["message_id"] = _send_gmail(to, mail["subject"], mail["body"])
        return case.emit("EMAIL_SENT", ENGINE, payload,
                         f"Email {'sent' if mode == 'gmail' else 'queued in outbox'} to client: {mail['subject']}")
    except Exception as exc:  # a mail outage must never break the case
        payload["error"] = f"{type(exc).__name__}: {exc}"[:300]
        return case.emit("EMAIL_FAILED", ENGINE, payload, f"Email to client failed: {type(exc).__name__}")
