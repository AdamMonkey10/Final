"""
Banking OAuth setup wizard — run once per bank to authenticate.

Supports:
  Monzo     — OAuth2 (register at developers.monzo.com)
  Starling  — Personal access token OR OAuth2 (developer.starlingbank.com)
  NatWest   — Open Banking OAuth2 (sandbox: developer.sandbox.natwest.com)

Usage:
    python setup_banking.py
    python setup_banking.py monzo
    python setup_banking.py starling
    python setup_banking.py natwest
"""

import json
import secrets
import sys
import time
import threading
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import requests

BASE_DIR = Path(__file__).parent
CALLBACK_PORT = 8765
CALLBACK_HOST = "localhost"

# Import banking helpers
from banking import (
    BANKS, TOKEN_FILE, CLIENT_FILE,
    save_client_creds, _load_tokens, _save_tokens,
    init_banking_tables,
)


# ── Local OAuth callback server ───────────────────────────────────────────────

class _OAuthCallbackHandler(BaseHTTPRequestHandler):
    """Catches the OAuth redirect and stores the code/error."""

    result = {}  # shared across instances via class variable

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = dict(urllib.parse.parse_qsl(parsed.query))

        if "code" in params:
            _OAuthCallbackHandler.result = {"code": params["code"], "state": params.get("state")}
            body = b"<h2>Authorised! You can close this tab.</h2>"
        elif "error" in params:
            _OAuthCallbackHandler.result = {"error": params["error"]}
            body = b"<h2>Authorisation failed. Check the terminal.</h2>"
        else:
            body = b"<h2>Waiting...</h2>"

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # silence request logs


def _run_callback_server(timeout: int = 120) -> dict:
    """Start local server, wait for OAuth callback, return params dict."""
    _OAuthCallbackHandler.result = {}
    server = HTTPServer((CALLBACK_HOST, CALLBACK_PORT), _OAuthCallbackHandler)
    server.timeout = 2

    start = time.time()
    while time.time() - start < timeout:
        server.handle_request()
        if _OAuthCallbackHandler.result:
            server.server_close()
            return _OAuthCallbackHandler.result

    server.server_close()
    return {"error": "timeout"}


def _exchange_code(token_url: str, client_id: str, client_secret: str,
                   redirect_uri: str, code: str) -> dict:
    resp = requests.post(
        token_url,
        data={
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "code": code,
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def _standard_oauth_flow(bank_name: str) -> bool:
    """Generic OAuth2 authorization code flow. Returns True on success."""
    cfg = BANKS[bank_name]
    clients = json.loads(CLIENT_FILE.read_text()) if CLIENT_FILE.exists() else {}
    creds = clients.get(bank_name, {})

    if not creds.get("client_id"):
        print(f"\n  Client credentials needed for {cfg['label']}.")
        creds["client_id"] = input("  Client ID:     ").strip()
        creds["client_secret"] = input("  Client Secret: ").strip()
        save_client_creds(bank_name, creds["client_id"], creds["client_secret"])

    state = secrets.token_urlsafe(16)
    auth_params = {
        "client_id": creds["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "response_type": "code",
        "state": state,
    }
    auth_url = cfg["auth_url"] + "?" + urllib.parse.urlencode(auth_params)

    print(f"\n  Opening browser for {cfg['label']} authorisation...")
    print(f"  URL: {auth_url}\n")
    webbrowser.open(auth_url)

    print(f"  Waiting for callback on http://{CALLBACK_HOST}:{CALLBACK_PORT} ...")
    result = _run_callback_server(timeout=180)

    if "error" in result:
        print(f"  ✗ Auth failed: {result['error']}")
        return False
    if result.get("state") != state:
        print("  ✗ State mismatch — possible CSRF. Aborting.")
        return False

    print("  Exchanging code for tokens...")
    try:
        token_data = _exchange_code(
            cfg["token_url"],
            creds["client_id"],
            creds["client_secret"],
            cfg["redirect_uri"],
            result["code"],
        )
    except Exception as e:
        print(f"  ✗ Token exchange failed: {e}")
        return False

    tokens = _load_tokens()
    tokens[bank_name] = {
        "access_token": token_data["access_token"],
        "refresh_token": token_data.get("refresh_token"),
        "expires_at": time.time() + token_data.get("expires_in", 3600),
        "token_type": token_data.get("token_type", "Bearer"),
    }
    _save_tokens(tokens)
    print(f"  ✓ {cfg['label']} connected and tokens saved.")
    return True


# ── Bank-specific setup ───────────────────────────────────────────────────────

def setup_monzo() -> bool:
    print("""
╔══════════════════════════════════════════════════════╗
║              Monzo API Setup                         ║
╚══════════════════════════════════════════════════════╝

Steps to get your credentials:
  1. Go to  https://developers.monzo.com
  2. Sign in with your Monzo account
  3. Create a new OAuth client:
       Name:         Household Manager
       Redirect URI: http://localhost:8765/oauth/callback/monzo
       Confidential: Yes
  4. Copy the Client ID and Client Secret below.

⚠️  After authorising, Monzo will send a push notification
    to your phone — tap "Allow" to complete authentication.
""")
    return _standard_oauth_flow("monzo")


def setup_starling() -> bool:
    print("""
╔══════════════════════════════════════════════════════╗
║           Starling Bank Setup                        ║
╚══════════════════════════════════════════════════════╝

Two options — choose whichever is easier:

  [1] Personal Access Token  (quickest — no OAuth needed)
      • Go to https://developer.starlingbank.com/personal/token
      • Create token with scopes:
          account:read  balance:read  feed:read  savings-goal:read
      • Paste it below.

  [2] OAuth2 (for full integration)
      • Go to https://developer.starlingbank.com/application/list
      • Create an application with:
          Redirect URI: http://localhost:8765/oauth/callback/starling
      • Requires Starling developer approval (~24h).
""")
    choice = input("  Choose [1] or [2]: ").strip()

    if choice == "1":
        token = input("  Personal Access Token: ").strip()
        if not token:
            print("  ✗ No token entered.")
            return False
        tokens = _load_tokens()
        tokens["starling"] = {"access_token": token}  # no expiry for PATs
        _save_tokens(tokens)
        print("  ✓ Starling personal access token saved.")
        return True
    else:
        return _standard_oauth_flow("starling")


def setup_natwest() -> bool:
    print("""
╔══════════════════════════════════════════════════════╗
║         NatWest Open Banking Setup                   ║
╚══════════════════════════════════════════════════════╝

NatWest uses the UK Open Banking standard (AISP).

  SANDBOX (development/testing):
  ─────────────────────────────
  • Register at https://developer.sandbox.natwest.com
  • Create an application — get Client ID + Secret
  • No FCA registration needed for sandbox

  PRODUCTION (real account data):
  ────────────────────────────────
  • Register as AISP with the FCA:
      https://register.fca.org.uk
  • Enrol in Open Banking Directory:
      https://directory.openbanking.org.uk
  • Obtain QWAC/QSealC eIDAS certificates
  • Contact NatWest Open Banking team to onboard
  • Note: production requires Mutual TLS (mTLS)
    — this setup uses sandbox (standard TLS only)

Using: SANDBOX mode
""")
    confirm = input("  Set up NatWest sandbox? [y/N]: ").strip().lower()
    if confirm != "y":
        print("  Skipped.")
        return False
    return _standard_oauth_flow("natwest")


SETUP_FUNCTIONS = {
    "monzo":   setup_monzo,
    "starling": setup_starling,
    "natwest": setup_natwest,
}


# ── Verification ──────────────────────────────────────────────────────────────

def verify_connection(bank_name: str) -> bool:
    """Quick connectivity test — fetch accounts for the given bank."""
    from banking import MonzoClient, StarlingClient, NatWestClient
    clients = {"monzo": MonzoClient, "starling": StarlingClient, "natwest": NatWestClient}
    cls = clients.get(bank_name)
    if not cls:
        return False
    try:
        client = cls()
        if bank_name == "monzo":
            accounts = client.get_accounts()
        elif bank_name == "starling":
            accounts = client.get_accounts()
        elif bank_name == "natwest":
            accounts = client.get_accounts()
        print(f"  ✓ Connected — {len(accounts)} account(s) found.")
        return True
    except Exception as e:
        print(f"  ✗ Connection test failed: {e}")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    init_banking_tables()

    banks_to_setup = []

    if len(sys.argv) > 1:
        requested = sys.argv[1].lower()
        if requested in SETUP_FUNCTIONS:
            banks_to_setup = [requested]
        else:
            print(f"Unknown bank '{requested}'. Options: monzo, starling, natwest")
            sys.exit(1)
    else:
        print("""
╔══════════════════════════════════════════════════════╗
║       Household Banking Setup                        ║
╚══════════════════════════════════════════════════════╝

Connect your bank accounts to the household dashboard.
Real-time transactions will sync into your knowledge base
and Claude can answer questions about your spending.

Available banks:
  [1] Monzo
  [2] Starling Bank
  [3] NatWest (Open Banking sandbox)
  [4] All of the above
  [q] Quit
""")
        choice = input("  Select [1/2/3/4/q]: ").strip().lower()
        if choice == "q":
            sys.exit(0)
        elif choice == "1":
            banks_to_setup = ["monzo"]
        elif choice == "2":
            banks_to_setup = ["starling"]
        elif choice == "3":
            banks_to_setup = ["natwest"]
        elif choice == "4":
            banks_to_setup = ["monzo", "starling", "natwest"]
        else:
            print("Invalid choice.")
            sys.exit(1)

    print()
    successes = []
    for bank in banks_to_setup:
        ok = SETUP_FUNCTIONS[bank]()
        if ok:
            successes.append(bank)
            print(f"\n  Testing {BANKS[bank]['label']} connection...")
            verify_connection(bank)
        print()

    print("═" * 54)
    if successes:
        print(f"✓  Set up: {', '.join(BANKS[b]['label'] for b in successes)}")
        print()
        print("Next steps:")
        print("  Sync transactions now:")
        print("    python banking.py")
        print()
        print("  Start the dashboard:")
        print("    python dashboard.py")
        print()
        print("  The dashboard will show live balances and Claude")
        print("  will have full context of your transactions.")
    else:
        print("No banks were configured.")
    print("═" * 54)


if __name__ == "__main__":
    main()
