"""
One-time Google Drive setup script.

Run this once to:
1. Authenticate with Google OAuth2 (opens a browser window)
2. Create the full folder structure under My Drive/🏠 Household/
3. Save credentials to household/token.json
4. Save folder IDs to household/drive_folders.json
5. Print all folder IDs for verification

Usage:
    python setup_drive.py

Prerequisites:
    1. Go to https://console.cloud.google.com/
    2. Create a project and enable the Google Drive API
    3. Create OAuth 2.0 credentials (Desktop app)
    4. Download as 'credentials.json' and place it in the household/ directory
    5. Run: pip install -r requirements.txt
"""

import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
CREDENTIALS_FILE = BASE_DIR / "credentials.json"
TOKEN_FILE = BASE_DIR / "token.json"
DRIVE_FOLDERS_FILE = BASE_DIR / "drive_folders.json"


def main():
    print("=" * 60)
    print("Household Management — Google Drive Setup")
    print("=" * 60)

    # Check for credentials.json
    if not CREDENTIALS_FILE.exists():
        print("\n❌  credentials.json not found.")
        print("\nTo create it:")
        print("  1. Go to https://console.cloud.google.com/")
        print("  2. Create a new project (or select an existing one)")
        print("  3. Enable the Google Drive API:")
        print("       APIs & Services → Enable APIs → search 'Google Drive API'")
        print("  4. Create OAuth 2.0 credentials:")
        print("       APIs & Services → Credentials → Create Credentials → OAuth client ID")
        print("       Application type: Desktop app")
        print("  5. Download the JSON file and rename it to: credentials.json")
        print(f"  6. Place it in: {CREDENTIALS_FILE}")
        sys.exit(1)

    # Delete existing token so we get a fresh auth
    if TOKEN_FILE.exists():
        print(f"\nRemoving existing token: {TOKEN_FILE}")
        TOKEN_FILE.unlink()

    # Delete existing folder cache to force re-creation
    if DRIVE_FOLDERS_FILE.exists():
        print(f"Removing existing folder cache: {DRIVE_FOLDERS_FILE}")
        DRIVE_FOLDERS_FILE.unlink()

    print("\nOpening browser for Google authentication...")
    print("(If the browser doesn't open, check the terminal for a URL to visit manually)\n")

    try:
        from gdrive import get_drive_service, ensure_folder_structure
    except ImportError:
        print("❌  Google API libraries not installed.")
        print("Run: pip install -r requirements.txt")
        sys.exit(1)

    try:
        service = get_drive_service()
        print("✓  Authentication successful.\n")
    except Exception as e:
        print(f"❌  Authentication failed: {e}")
        sys.exit(1)

    print("Creating folder structure in Google Drive...")
    print()

    try:
        folder_ids = ensure_folder_structure(service)
    except Exception as e:
        print(f"❌  Folder creation failed: {e}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("✓  Setup complete!")
    print("=" * 60)
    print(f"\nCredentials saved to:  {TOKEN_FILE}")
    print(f"Folder IDs saved to:   {DRIVE_FOLDERS_FILE}")

    print("\nFolder ID Summary:")
    print("-" * 40)
    for key, fid in folder_ids.items():
        label = key.replace("_", " ").title()
        print(f"  {label:<25} {fid}")

    print("\nNext steps:")
    print("  1. Run the pre-population script:")
    print("       python scanner.py --prepopulate")
    print("  2. Start the dashboard:")
    print("       python dashboard.py")
    print("  3. (Optional) Set up Gmail scanning:")
    print("       export GMAIL_ADDRESS=your@gmail.com")
    print("       export GMAIL_APP_PASSWORD=your_app_password")
    print("       python scanner.py")
    print()


if __name__ == "__main__":
    main()
