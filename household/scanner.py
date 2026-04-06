"""
Email scanner for the Household Management System.

- Connects to Gmail via IMAP
- Extracts relevant emails and attachments
- Renames attachments to YYYY-MM-DD_description.pdf
- Uploads to Google Drive
- Stores structured data in SQLite
- Creates/updates Obsidian markdown notes
"""

import email
import imaplib
import json
import os
import re
import sqlite3
from datetime import datetime, date
from email.header import decode_header
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "household.db"
OBSIDIAN_VAULT = Path(os.environ.get("OBSIDIAN_VAULT", str(Path.home() / "Obsidian/Household")))

# ── Database ──────────────────────────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS documents (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            date        TEXT NOT NULL,
            description TEXT NOT NULL,
            category    TEXT NOT NULL,
            amount      REAL,
            currency    TEXT DEFAULT 'GBP',
            due_date    TEXT,
            status      TEXT DEFAULT 'active',
            drive_file_id TEXT,
            drive_link  TEXT,
            obsidian_note TEXT,
            source_email TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS email_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id  TEXT UNIQUE,
            subject     TEXT,
            sender      TEXT,
            received_at TEXT,
            processed   INTEGER DEFAULT 0,
            document_id INTEGER REFERENCES documents(id)
        );
    """)
    conn.commit()
    conn.close()


def get_db():
    return sqlite3.connect(DB_PATH)


def save_document(doc: dict) -> int:
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO documents
            (date, description, category, amount, currency, due_date, status,
             drive_file_id, drive_link, obsidian_note, source_email)
        VALUES
            (:date, :description, :category, :amount, :currency, :due_date, :status,
             :drive_file_id, :drive_link, :obsidian_note, :source_email)
    """, doc)
    doc_id = c.lastrowid
    conn.commit()
    conn.close()
    return doc_id


def update_document_drive(doc_id: int, file_id: str, link: str):
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "UPDATE documents SET drive_file_id=?, drive_link=?, updated_at=datetime('now') WHERE id=?",
        (file_id, link, doc_id),
    )
    conn.commit()
    conn.close()


def update_document_obsidian(doc_id: int, note_path: str):
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "UPDATE documents SET obsidian_note=?, updated_at=datetime('now') WHERE id=?",
        (note_path, doc_id),
    )
    conn.commit()
    conn.close()


def log_email(message_id: str, subject: str, sender: str, received_at: str, doc_id: Optional[int] = None):
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT OR IGNORE INTO email_log (message_id, subject, sender, received_at, processed, document_id)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (message_id, subject, sender, received_at, 1 if doc_id else 0, doc_id))
    conn.commit()
    conn.close()


def is_email_processed(message_id: str) -> bool:
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT processed FROM email_log WHERE message_id=?", (message_id,))
    row = c.fetchone()
    conn.close()
    return bool(row and row[0])


# ── Obsidian ──────────────────────────────────────────────────────────────────

CATEGORY_OBSIDIAN_DIR = {
    "car": "Car",
    "car_insurance": "Car",
    "car_mot": "Car",
    "car_service": "Car",
    "health": "Health",
    "health_adam": "Health",
    "health_betty": "Health",
    "property": "Property",
    "property_rental": "Property",
    "finance": "Finance",
    "finance_bills": "Finance",
    "finance_bank": "Finance",
    "bills": "Finance",
    "bank": "Finance",
    "holidays": "Holidays",
    "holiday": "Holidays",
}

FLAG_ALERTS = {
    "mcafee": "⚠️ Consider cancelling — check if still needed",
    "cancel": "⚠️ Review for cancellation",
}


def _get_obsidian_dir(category: str) -> Path:
    sub = CATEGORY_OBSIDIAN_DIR.get(category.lower(), "General")
    d = OBSIDIAN_VAULT / sub
    d.mkdir(parents=True, exist_ok=True)
    return d


def _flag_note(description: str) -> str:
    desc_lower = description.lower()
    for keyword, alert in FLAG_ALERTS.items():
        if keyword in desc_lower:
            return f"\n> [!warning] {alert}\n"
    return ""


def create_obsidian_note(doc: dict, drive_link: Optional[str] = None) -> Path:
    """
    Create or update an Obsidian markdown note for a document.
    Returns the path to the note.
    """
    category = doc.get("category", "general")
    note_dir = _get_obsidian_dir(category)

    safe_desc = re.sub(r"[^\w\s-]", "", doc["description"]).strip().replace(" ", "_")
    note_filename = f"{doc['date']}_{safe_desc}.md"
    note_path = note_dir / note_filename

    amount_str = ""
    if doc.get("amount"):
        currency = doc.get("currency", "GBP")
        symbol = "£" if currency == "GBP" else currency
        amount_str = f"{symbol}{doc['amount']:.2f}"

    due_str = f"\nDue: {doc['due_date']}" if doc.get("due_date") else ""
    drive_str = f"\n[📎 View Document]({drive_link})" if drive_link else ""
    flag_str = _flag_note(doc["description"])
    status_str = doc.get("status", "active")

    tags = [category.replace("_", "/")]
    if doc.get("due_date"):
        tags.append("has-due-date")
    if "cancel" in doc["description"].lower() or "mcafee" in doc["description"].lower():
        tags.append("review-cancel")

    tags_yaml = "\n".join(f"  - {t}" for t in tags)

    note_content = f"""---
date: {doc['date']}
category: {category}
amount: {amount_str}
status: {status_str}
tags:
{tags_yaml}
---

# {doc['description']}
{flag_str}
**Date:** {doc['date']}
**Category:** {category.replace('_', ' ').title()}{due_str}
{"**Amount:** " + amount_str if amount_str else ""}
**Status:** {status_str}
{drive_str}

## Notes

{doc.get('notes', '_No additional notes._')}
"""

    note_path.write_text(note_content.strip())
    return note_path


# ── Email Parsing ─────────────────────────────────────────────────────────────

def _decode_header_str(value: str) -> str:
    parts = decode_header(value)
    decoded = []
    for part, enc in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _parse_amount(text: str) -> Optional[float]:
    match = re.search(r"[£$€]?\s*([\d,]+\.?\d*)", text.replace(",", ""))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


def _classify_email(subject: str, sender: str, body: str) -> dict:
    """
    Classify an email into a category and extract structured data.
    Returns a partial document dict.
    """
    subject_lower = subject.lower()
    body_lower = body.lower()
    combined = subject_lower + " " + body_lower

    result = {
        "category": "finance_bills",
        "status": "active",
        "notes": "",
        "flag_cancel": False,
    }

    if any(k in combined for k in ["car", "vehicle", "mot", "service", "hyundai", "insurance", "yy24jsv"]):
        if "mot" in combined:
            result["category"] = "car_mot"
        elif "service" in combined or "service centre" in combined:
            result["category"] = "car_service"
        elif "insurance" in combined:
            result["category"] = "car_insurance"
        else:
            result["category"] = "car"
    elif any(k in combined for k in ["health", "gp", "nhs", "prescription", "pharmacy"]):
        if "betty" in combined:
            result["category"] = "health_betty"
        else:
            result["category"] = "health_adam"
    elif any(k in combined for k in ["rental", "landlord", "tenant", "rent"]):
        result["category"] = "property_rental"
    elif any(k in combined for k in ["holiday", "travel", "flight", "hotel", "booking.com", "airbnb"]):
        result["category"] = "holidays"
    elif any(k in combined for k in ["paypal", "e.on", "eon", "octopus", "energy", "electric", "gas",
                                      "broadband", "bt ", "virgin", "sky", "council tax", "water",
                                      "mcafee", "antivirus", "bank", "barclays", "lloyds", "halifax"]):
        result["category"] = "finance_bills"

    if "mcafee" in combined or "cancel" in combined:
        result["flag_cancel"] = True

    return result


# ── Gmail IMAP ────────────────────────────────────────────────────────────────

def connect_gmail(email_address: str, app_password: str) -> imaplib.IMAP4_SSL:
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(email_address, app_password)
    return mail


def fetch_emails(mail: imaplib.IMAP4_SSL, folder: str = "INBOX", limit: int = 50) -> list:
    mail.select(folder)
    _, data = mail.search(None, "ALL")
    msg_ids = data[0].split()[-limit:]

    messages = []
    for num in reversed(msg_ids):
        _, msg_data = mail.fetch(num, "(RFC822)")
        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)
        messages.append(msg)

    return messages


def _extract_body(msg) -> str:
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    body += part.get_payload(decode=True).decode("utf-8", errors="replace")
                except Exception:
                    pass
    else:
        try:
            body = msg.get_payload(decode=True).decode("utf-8", errors="replace")
        except Exception:
            pass
    return body


def _extract_attachments(msg) -> list[dict]:
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            content_disp = str(part.get("Content-Disposition", ""))
            if "attachment" in content_disp:
                filename = part.get_filename()
                if filename:
                    filename = _decode_header_str(filename)
                    data = part.get_payload(decode=True)
                    mime = part.get_content_type()
                    if data:
                        attachments.append({"filename": filename, "data": data, "mime": mime})
    return attachments


def _standardise_filename(original: str, doc_date: str, description: str) -> str:
    ext = Path(original).suffix.lower() or ".pdf"
    safe_desc = re.sub(r"[^\w\s-]", "", description).strip().replace(" ", "_").lower()
    safe_desc = re.sub(r"_+", "_", safe_desc)[:50]
    return f"{doc_date}_{safe_desc}{ext}"


# ── Main Processing ───────────────────────────────────────────────────────────

def process_email(msg, drive_service=None) -> Optional[dict]:
    """
    Process a single email message.
    Returns the saved document dict or None if skipped.
    """
    message_id = msg.get("Message-ID", "")
    if message_id and is_email_processed(message_id):
        return None

    subject = _decode_header_str(msg.get("Subject", ""))
    sender = msg.get("From", "")
    date_str = msg.get("Date", "")

    try:
        parsed_date = email.utils.parsedate_to_datetime(date_str)
        doc_date = parsed_date.strftime("%Y-%m-%d")
    except Exception:
        doc_date = date.today().isoformat()

    body = _extract_body(msg)
    classification = _classify_email(subject, sender, body)

    amount = _parse_amount(subject) or _parse_amount(body[:500])

    doc = {
        "date": doc_date,
        "description": subject or "Unknown",
        "category": classification["category"],
        "amount": amount,
        "currency": "GBP",
        "due_date": None,
        "status": "active",
        "drive_file_id": None,
        "drive_link": None,
        "obsidian_note": None,
        "source_email": sender,
        "notes": body[:500] if body else "",
    }

    # Handle attachments
    attachments = _extract_attachments(msg)
    last_drive_result = None

    for attachment in attachments:
        std_name = _standardise_filename(attachment["filename"], doc_date, subject)
        try:
            from gdrive import upload_document
            result = upload_document(
                file_data=attachment["data"],
                filename=std_name,
                category=doc["category"],
                mime_type=attachment["mime"],
                service=drive_service,
            )
            last_drive_result = result
            print(f"  Uploaded: {std_name} → {result['web_link']}")
        except Exception as e:
            print(f"  Upload failed for {std_name}: {e}")

    if last_drive_result:
        doc["drive_file_id"] = last_drive_result["file_id"]
        doc["drive_link"] = last_drive_result["web_link"]

    doc_id = save_document(doc)

    note_path = create_obsidian_note(doc, drive_link=doc.get("drive_link"))
    update_document_obsidian(doc_id, str(note_path))
    doc["obsidian_note"] = str(note_path)

    if last_drive_result:
        update_document_drive(doc_id, last_drive_result["file_id"], last_drive_result["web_link"])

    log_email(message_id, subject, sender, date_str, doc_id)

    print(f"  ✓ Saved: [{doc['category']}] {subject[:60]} → note: {note_path.name}")
    return doc


# ── Pre-populate known emails ─────────────────────────────────────────────────

KNOWN_EMAILS = [
    {
        "date": "2025-04-13",
        "description": "PayPal Pay in 3 — Payment due £43.62",
        "category": "finance_bills",
        "amount": 43.62,
        "currency": "GBP",
        "due_date": "2025-04-13",
        "status": "pending",
        "notes": "PayPal Pay in 3 instalment. Ensure funds are available.",
    },
    {
        "date": "2025-04-12",
        "description": "PayPal Pay in 3 — Payment due £163.06",
        "category": "finance_bills",
        "amount": 163.06,
        "currency": "GBP",
        "due_date": "2025-04-12",
        "status": "pending",
        "notes": "PayPal Pay in 3 instalment. Ensure funds are available.",
    },
    {
        "date": "2025-04-10",
        "description": "E.ON Next Betty Direct Debit £153.69",
        "category": "finance_bills",
        "amount": 153.69,
        "currency": "GBP",
        "due_date": "2025-04-10",
        "status": "pending",
        "notes": "E.ON Next energy direct debit for Betty.",
    },
    {
        "date": "2025-04-07",
        "description": "Octopus Energy £210.00 payment taken",
        "category": "finance_bills",
        "amount": 210.00,
        "currency": "GBP",
        "due_date": "2025-04-07",
        "status": "paid",
        "notes": "Octopus Energy direct debit collected 7 April.",
    },
    {
        "date": "2025-03-27",
        "description": "Hyundai Service — YY24JSV — £280.57",
        "category": "car_service",
        "amount": 280.57,
        "currency": "GBP",
        "due_date": None,
        "status": "paid",
        "notes": "Hyundai service completed 27 March. Vehicle: YY24JSV.",
    },
    {
        "date": "2025-03-22",
        "description": "McAfee Renewal £79.99 — Review to Cancel",
        "category": "finance_bills",
        "amount": 79.99,
        "currency": "GBP",
        "due_date": None,
        "status": "active",
        "notes": "McAfee auto-renewed 22 March. Consider cancelling — check if protection is still required.",
    },
]


def prepopulate_known_emails():
    """Insert the pre-known emails into the database and create Obsidian notes."""
    init_db()
    print("Pre-populating known emails...")

    for entry in KNOWN_EMAILS:
        doc = {
            **entry,
            "drive_file_id": None,
            "drive_link": None,
            "obsidian_note": None,
            "source_email": "pre-populated",
        }

        doc_id = save_document(doc)
        note_path = create_obsidian_note(doc)
        update_document_obsidian(doc_id, str(note_path))

        print(f"  ✓ {doc['description']} → {note_path.name}")

    print(f"Done. {len(KNOWN_EMAILS)} entries created.")


# ── Entry Point ───────────────────────────────────────────────────────────────

def scan_gmail(email_address: str, app_password: str, limit: int = 100):
    """Connect to Gmail and process recent emails."""
    init_db()
    print(f"Connecting to Gmail as {email_address}...")

    drive_service = None
    try:
        from gdrive import get_drive_service, ensure_folder_structure
        drive_service = get_drive_service()
        ensure_folder_structure(drive_service)
    except Exception as e:
        print(f"  Drive unavailable ({e}), continuing without upload.")

    mail = connect_gmail(email_address, app_password)
    messages = fetch_emails(mail, limit=limit)
    mail.logout()

    print(f"Fetched {len(messages)} emails. Processing...")
    processed = 0
    for msg in messages:
        result = process_email(msg, drive_service=drive_service)
        if result:
            processed += 1

    print(f"\nDone. Processed {processed} new emails.")


if __name__ == "__main__":
    import sys

    if "--prepopulate" in sys.argv:
        prepopulate_known_emails()
    else:
        email_addr = os.environ.get("GMAIL_ADDRESS")
        app_pw = os.environ.get("GMAIL_APP_PASSWORD")
        if not email_addr or not app_pw:
            print("Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD environment variables.")
            sys.exit(1)
        scan_gmail(email_addr, app_pw)
