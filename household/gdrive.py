"""
Google Drive helper for the Household Management System.
Manages folder structure, uploads, and file retrieval.
"""

import json
import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseUpload
import io

SCOPES = ["https://www.googleapis.com/auth/drive"]

BASE_DIR = Path(__file__).parent
CREDENTIALS_FILE = BASE_DIR / "credentials.json"
TOKEN_FILE = BASE_DIR / "token.json"
DRIVE_FOLDERS_FILE = BASE_DIR / "drive_folders.json"

# Folder structure: category -> subfolder name in Drive
FOLDER_STRUCTURE = {
    "root": "🏠 Household",
    "children": {
        "car": {
            "name": "🚗 Car",
            "children": {
                "car_insurance": "Insurance",
                "car_mot": "MOT",
                "car_service": "Service",
            },
        },
        "health": {
            "name": "🏥 Health",
            "children": {
                "health_adam": "Adam",
                "health_betty": "Betty",
            },
        },
        "property": {
            "name": "🏠 Property",
            "children": {
                "property_rental": "Rental",
            },
        },
        "finance": {
            "name": "💰 Finance",
            "children": {
                "finance_bills": "Bills",
                "finance_bank": "Bank",
            },
        },
        "holidays": {
            "name": "✈️ Holidays",
            "children": {},
        },
    },
}

# Maps category keys used throughout the app to Drive folder keys
CATEGORY_MAP = {
    "car": "car",
    "car_insurance": "car_insurance",
    "car_mot": "car_mot",
    "car_service": "car_service",
    "health": "health",
    "health_adam": "health_adam",
    "health_betty": "health_betty",
    "property": "property",
    "property_rental": "property_rental",
    "finance": "finance",
    "finance_bills": "finance_bills",
    "finance_bank": "finance_bank",
    "bills": "finance_bills",
    "bank": "finance_bank",
    "holidays": "holidays",
    "holiday": "holidays",
}


def _load_token() -> Credentials | None:
    if TOKEN_FILE.exists():
        return Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    return None


def _save_token(creds: Credentials) -> None:
    TOKEN_FILE.write_text(creds.to_json())


def get_drive_service():
    """Authenticate and return a Drive API service object."""
    creds = _load_token()

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        _save_token(creds)
    elif not creds or not creds.valid:
        if not CREDENTIALS_FILE.exists():
            raise FileNotFoundError(
                f"OAuth credentials not found at {CREDENTIALS_FILE}.\n"
                "Run setup_drive.py first to authenticate."
            )
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(port=0)
        _save_token(creds)

    return build("drive", "v3", credentials=creds)


def _load_folder_cache() -> dict:
    if DRIVE_FOLDERS_FILE.exists():
        return json.loads(DRIVE_FOLDERS_FILE.read_text())
    return {}


def _save_folder_cache(cache: dict) -> None:
    DRIVE_FOLDERS_FILE.write_text(json.dumps(cache, indent=2))


def _find_or_create_folder(service, name: str, parent_id: str | None = None) -> str:
    """Find a folder by name under parent, or create it. Returns folder ID."""
    query = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_id:
        query += f" and '{parent_id}' in parents"

    results = service.files().list(q=query, fields="files(id, name)").execute()
    files = results.get("files", [])

    if files:
        return files[0]["id"]

    metadata = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_id:
        metadata["parents"] = [parent_id]

    folder = service.files().create(body=metadata, fields="id").execute()
    return folder["id"]


def ensure_folder_structure(service=None) -> dict:
    """
    Create the full folder structure in Google Drive if it doesn't exist.
    Returns a dict mapping category keys to folder IDs.
    """
    cache = _load_folder_cache()
    if cache:
        return cache

    if service is None:
        service = get_drive_service()

    folder_ids = {}

    root_name = FOLDER_STRUCTURE["root"]
    root_id = _find_or_create_folder(service, root_name)
    folder_ids["root"] = root_id
    print(f"  Root folder '{root_name}': {root_id}")

    for key, section in FOLDER_STRUCTURE["children"].items():
        section_id = _find_or_create_folder(service, section["name"], root_id)
        folder_ids[key] = section_id
        print(f"  Section '{section['name']}': {section_id}")

        for sub_key, sub_name in section.get("children", {}).items():
            sub_id = _find_or_create_folder(service, sub_name, section_id)
            folder_ids[sub_key] = sub_id
            print(f"    Subfolder '{sub_name}': {sub_id}")

    _save_folder_cache(folder_ids)
    return folder_ids


def _resolve_folder_id(category: str, folder_ids: dict) -> str:
    """Map a category string to a Drive folder ID."""
    key = CATEGORY_MAP.get(category.lower(), "root")
    folder_id = folder_ids.get(key) or folder_ids.get("root")
    if not folder_id:
        raise ValueError(f"No Drive folder found for category '{category}'")
    return folder_id


def upload_document(
    file_data: bytes,
    filename: str,
    category: str,
    mime_type: str = "application/pdf",
    service=None,
) -> dict:
    """
    Upload a document to the correct Google Drive subfolder.

    Args:
        file_data: Raw bytes of the file.
        filename: Target filename (e.g. '2024-03-27_hyundai_service.pdf').
        category: Category key (e.g. 'car_service', 'finance_bills').
        mime_type: MIME type of the file.
        service: Optional pre-built Drive service (to avoid repeated auth).

    Returns:
        dict with 'file_id', 'filename', 'web_link', 'category'.
    """
    if service is None:
        service = get_drive_service()

    folder_ids = ensure_folder_structure(service)
    folder_id = _resolve_folder_id(category, folder_ids)

    file_metadata = {
        "name": filename,
        "parents": [folder_id],
    }

    media = MediaIoBaseUpload(io.BytesIO(file_data), mimetype=mime_type, resumable=True)

    uploaded = (
        service.files()
        .create(body=file_metadata, media_body=media, fields="id, webViewLink, name")
        .execute()
    )

    # Make file readable by anyone with the link
    service.permissions().create(
        fileId=uploaded["id"],
        body={"type": "anyone", "role": "reader"},
    ).execute()

    return {
        "file_id": uploaded["id"],
        "filename": uploaded["name"],
        "web_link": uploaded.get("webViewLink", ""),
        "category": category,
    }


def get_document_link(file_id: str, service=None) -> str:
    """Return the shareable web view link for a Drive file."""
    if service is None:
        service = get_drive_service()

    try:
        file = service.files().get(fileId=file_id, fields="webViewLink").execute()
        return file.get("webViewLink", "")
    except HttpError as e:
        print(f"Error fetching link for file {file_id}: {e}")
        return ""


def list_documents(category: str, service=None) -> list[dict]:
    """
    List files in a Drive category folder.

    Returns list of dicts with 'file_id', 'filename', 'web_link', 'modified_time'.
    """
    if service is None:
        service = get_drive_service()

    folder_ids = ensure_folder_structure(service)
    folder_id = _resolve_folder_id(category, folder_ids)

    query = f"'{folder_id}' in parents and trashed=false"
    results = (
        service.files()
        .list(
            q=query,
            fields="files(id, name, webViewLink, modifiedTime, size)",
            orderBy="modifiedTime desc",
        )
        .execute()
    )

    documents = []
    for f in results.get("files", []):
        documents.append(
            {
                "file_id": f["id"],
                "filename": f["name"],
                "web_link": f.get("webViewLink", ""),
                "modified_time": f.get("modifiedTime", ""),
                "size": f.get("size", 0),
            }
        )

    return documents


def delete_document(file_id: str, service=None) -> bool:
    """Delete a file from Google Drive. Returns True on success."""
    if service is None:
        service = get_drive_service()

    try:
        service.files().delete(fileId=file_id).execute()
        return True
    except HttpError as e:
        print(f"Error deleting file {file_id}: {e}")
        return False
