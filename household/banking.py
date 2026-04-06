"""
Banking integration: Monzo, Starling Bank, NatWest (Open Banking).

Handles OAuth2 tokens, transaction sync, and DB persistence.
Transactions are stored in bank_accounts + bank_transactions tables
and reconciled against existing documents.
"""

import json
import sqlite3
import time
import urllib.parse
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import Optional

import requests

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "household.db"
TOKEN_FILE = BASE_DIR / "banking_tokens.json"
CLIENT_FILE = BASE_DIR / "banking_clients.json"

# ── API constants ─────────────────────────────────────────────────────────────

MONZO = {
    "name": "monzo",
    "label": "Monzo",
    "base_url": "https://api.monzo.com",
    "auth_url": "https://auth.monzo.com/",
    "token_url": "https://api.monzo.com/oauth2/token",
    "redirect_uri": "http://localhost:8765/oauth/callback/monzo",
}

STARLING = {
    "name": "starling",
    "label": "Starling Bank",
    "base_url": "https://api.starlingbank.com",
    "auth_url": "https://oauth.starlingbank.com",
    "token_url": "https://api.starlingbank.com/oauth/access-token",
    "redirect_uri": "http://localhost:8765/oauth/callback/starling",
}

NATWEST = {
    "name": "natwest",
    "label": "NatWest (Open Banking)",
    # Sandbox — swap for production after TPP registration
    "base_url": "https://ob.sandbox.natwest.com/open-banking/v3.1",
    "auth_url": "https://ob.sandbox.natwest.com/oauth/authorize",
    "token_url": "https://ob.sandbox.natwest.com/oauth/token",
    "redirect_uri": "http://localhost:8765/oauth/callback/natwest",
    "sandbox": True,
}

BANKS = {"monzo": MONZO, "starling": STARLING, "natwest": NATWEST}

# Maps bank-specific categories to household categories
MONZO_CATEGORY_MAP = {
    "bills": "finance_bills",
    "expenses": "finance_bills",
    "general": "finance_bills",
    "transport": "car",
    "holidays": "holidays",
    "personal_care": "health",
    "family": "health",
    "savings": "finance_bank",
}

STARLING_CATEGORY_MAP = {
    "BILLS_AND_SERVICES": "finance_bills",
    "EXPENSES": "finance_bills",
    "GENERAL": "finance_bills",
    "HEALTH": "health",
    "HOLIDAYS": "holidays",
    "HOME": "property_rental",
    "INSURANCE": "car_insurance",
    "SAVING": "finance_bank",
    "TRANSPORT": "car",
}

NATWEST_TRANSACTION_CODE_MAP = {
    "BillPayment": "finance_bills",
    "DirectDebit": "finance_bills",
    "StandingOrder": "finance_bills",
    "Credit": "finance_bank",
    "Debit": "finance_bills",
}


# ── Token store ───────────────────────────────────────────────────────────────

def _load_tokens() -> dict:
    if TOKEN_FILE.exists():
        return json.loads(TOKEN_FILE.read_text())
    return {}


def _save_tokens(tokens: dict) -> None:
    TOKEN_FILE.write_text(json.dumps(tokens, indent=2))


def _get_token(bank: str) -> Optional[dict]:
    return _load_tokens().get(bank)


def _set_token(bank: str, token_data: dict) -> None:
    tokens = _load_tokens()
    tokens[bank] = token_data
    _save_tokens(tokens)


def _load_clients() -> dict:
    if CLIENT_FILE.exists():
        return json.loads(CLIENT_FILE.read_text())
    return {}


def _get_client_creds(bank: str) -> Optional[dict]:
    return _load_clients().get(bank)


def save_client_creds(bank: str, client_id: str, client_secret: str) -> None:
    clients = _load_clients()
    clients[bank] = {"client_id": client_id, "client_secret": client_secret}
    CLIENT_FILE.write_text(json.dumps(clients, indent=2))
    print(f"  ✓ Credentials saved for {bank}")


# ── Database ──────────────────────────────────────────────────────────────────

def init_banking_tables() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS bank_accounts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            bank            TEXT NOT NULL,
            account_id      TEXT NOT NULL,
            name            TEXT,
            type            TEXT,
            currency        TEXT DEFAULT 'GBP',
            balance         REAL,
            balance_updated TEXT,
            UNIQUE(bank, account_id)
        );

        CREATE TABLE IF NOT EXISTS bank_transactions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            bank            TEXT NOT NULL,
            account_id      TEXT NOT NULL,
            transaction_id  TEXT NOT NULL,
            date            TEXT NOT NULL,
            amount          REAL NOT NULL,
            currency        TEXT DEFAULT 'GBP',
            description     TEXT,
            merchant_name   TEXT,
            category        TEXT,
            notes           TEXT,
            document_id     INTEGER REFERENCES documents(id),
            raw_data        TEXT,
            created_at      TEXT DEFAULT (datetime('now')),
            UNIQUE(bank, transaction_id)
        );
    """)
    conn.commit()
    conn.close()


def _upsert_account(bank: str, account_id: str, name: str, acct_type: str,
                    currency: str, balance: float) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO bank_accounts (bank, account_id, name, type, currency, balance, balance_updated)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(bank, account_id) DO UPDATE SET
            name=excluded.name, balance=excluded.balance,
            balance_updated=datetime('now')
    """, (bank, account_id, name, acct_type, currency, balance))
    conn.commit()
    conn.close()


def _insert_transaction(bank: str, account_id: str, txn_id: str, txn_date: str,
                         amount: float, currency: str, description: str,
                         merchant_name: Optional[str], category: Optional[str],
                         notes: Optional[str], raw: dict) -> bool:
    """Insert a transaction. Returns True if new, False if duplicate."""
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("""
            INSERT INTO bank_transactions
                (bank, account_id, transaction_id, date, amount, currency,
                 description, merchant_name, category, notes, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (bank, account_id, txn_id, txn_date, amount, currency,
              description, merchant_name, category, notes, json.dumps(raw)))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def get_accounts() -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM bank_accounts ORDER BY bank, name"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_transactions(bank: Optional[str] = None, days: int = 30,
                     limit: int = 200) -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    since = (date.today() - timedelta(days=days)).isoformat()
    if bank:
        rows = conn.execute(
            "SELECT * FROM bank_transactions WHERE bank=? AND date>=? ORDER BY date DESC LIMIT ?",
            (bank, since, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM bank_transactions WHERE date>=? ORDER BY date DESC LIMIT ?",
            (since, limit),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Token refresh helpers ─────────────────────────────────────────────────────

def _is_token_expired(token_data: dict) -> bool:
    expires_at = token_data.get("expires_at", 0)
    return time.time() >= expires_at - 60  # 60s buffer


def _refresh_token(bank_cfg: dict, token_data: dict) -> Optional[dict]:
    """Attempt to refresh an OAuth token. Returns updated token data or None."""
    creds = _get_client_creds(bank_cfg["name"])
    if not creds:
        return None

    refresh_token = token_data.get("refresh_token")
    if not refresh_token:
        return None

    resp = requests.post(
        bank_cfg["token_url"],
        data={
            "grant_type": "refresh_token",
            "client_id": creds["client_id"],
            "client_secret": creds["client_secret"],
            "refresh_token": refresh_token,
        },
        timeout=15,
    )
    if resp.status_code != 200:
        print(f"  Token refresh failed for {bank_cfg['label']}: {resp.status_code}")
        return None

    new_data = resp.json()
    updated = {
        **token_data,
        "access_token": new_data["access_token"],
        "expires_at": time.time() + new_data.get("expires_in", 3600),
    }
    if "refresh_token" in new_data:
        updated["refresh_token"] = new_data["refresh_token"]

    _set_token(bank_cfg["name"], updated)
    return updated


def _get_access_token(bank_name: str) -> Optional[str]:
    """Return a valid access token, refreshing if needed."""
    bank_cfg = BANKS.get(bank_name)
    if not bank_cfg:
        return None

    token_data = _get_token(bank_name)
    if not token_data:
        return None

    # Personal access tokens (no expiry field) — use as-is
    if "expires_at" not in token_data:
        return token_data.get("access_token")

    if _is_token_expired(token_data):
        refreshed = _refresh_token(bank_cfg, token_data)
        if refreshed:
            return refreshed["access_token"]
        print(f"  ⚠️  {bank_cfg['label']} token expired and refresh failed.")
        return None

    return token_data["access_token"]


# ── Monzo client ──────────────────────────────────────────────────────────────

class MonzoClient:
    BASE = "https://api.monzo.com"

    def __init__(self):
        self.token = _get_access_token("monzo")
        if not self.token:
            raise RuntimeError("Monzo not authenticated. Run setup_banking.py first.")

    def _get(self, path: str, params: dict = None) -> dict:
        resp = requests.get(
            self.BASE + path,
            params=params,
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def get_accounts(self) -> list[dict]:
        data = self._get("/accounts")
        return data.get("accounts", [])

    def get_balance(self, account_id: str) -> dict:
        return self._get("/balance", {"account_id": account_id})

    def get_transactions(self, account_id: str, since_days: int = 30) -> list[dict]:
        since = (datetime.utcnow() - timedelta(days=since_days)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        data = self._get("/transactions", {
            "account_id": account_id,
            "expand[]": "merchant",
            "since": since,
            "limit": 100,
        })
        return data.get("transactions", [])

    def sync(self, since_days: int = 30) -> int:
        new_count = 0
        accounts = self.get_accounts()
        for acct in accounts:
            if acct.get("closed"):
                continue

            balance_data = self.get_balance(acct["id"])
            balance_gbp = balance_data.get("balance", 0) / 100

            _upsert_account(
                bank="monzo",
                account_id=acct["id"],
                name=acct.get("description", "Monzo Account"),
                acct_type=acct.get("type", "uk_retail"),
                currency=acct.get("currency", "GBP"),
                balance=balance_gbp,
            )

            txns = self.get_transactions(acct["id"], since_days)
            for t in txns:
                if not t.get("amount"):
                    continue

                amount_gbp = t["amount"] / 100  # pence → GBP (negative = spent)
                merchant = t.get("merchant") or {}
                merchant_name = merchant.get("name") if isinstance(merchant, dict) else None
                description = t.get("description", "") or merchant_name or ""
                raw_category = t.get("category", "general")
                category = MONZO_CATEGORY_MAP.get(raw_category, "finance_bills")

                txn_date = t["created"][:10]

                added = _insert_transaction(
                    bank="monzo",
                    account_id=acct["id"],
                    txn_id=t["id"],
                    txn_date=txn_date,
                    amount=amount_gbp,
                    currency=t.get("currency", "GBP"),
                    description=description,
                    merchant_name=merchant_name,
                    category=category,
                    notes=t.get("notes"),
                    raw=t,
                )
                if added:
                    new_count += 1

        return new_count


# ── Starling client ───────────────────────────────────────────────────────────

class StarlingClient:
    BASE = "https://api.starlingbank.com"

    def __init__(self):
        self.token = _get_access_token("starling")
        if not self.token:
            raise RuntimeError("Starling not authenticated. Run setup_banking.py first.")

    def _get(self, path: str, params: dict = None) -> dict:
        resp = requests.get(
            self.BASE + path,
            params=params,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def get_accounts(self) -> list[dict]:
        data = self._get("/api/v2/accounts")
        return data.get("accounts", [])

    def get_balance(self, account_uid: str) -> dict:
        return self._get(f"/api/v2/accounts/{account_uid}/balance")

    def get_transactions(self, account_uid: str, category_uid: str,
                         since_days: int = 30) -> list[dict]:
        since = (datetime.utcnow() - timedelta(days=since_days)).strftime(
            "%Y-%m-%dT%H:%M:%S.000Z"
        )
        until = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
        data = self._get(
            f"/api/v2/feed/account/{account_uid}/settled-transactions",
            params={
                "minTransactionTimestamp": since,
                "maxTransactionTimestamp": until,
            },
        )
        return data.get("feedItems", [])

    def sync(self, since_days: int = 30) -> int:
        new_count = 0
        accounts = self.get_accounts()
        for acct in accounts:
            uid = acct["accountUid"]
            cat_uid = acct.get("defaultCategory", "")

            balance_data = self.get_balance(uid)
            effective = balance_data.get("effectiveBalance", {})
            balance_gbp = effective.get("minorUnits", 0) / 100

            _upsert_account(
                bank="starling",
                account_id=uid,
                name=acct.get("name", "Starling Account"),
                acct_type=acct.get("accountType", "PRIMARY"),
                currency=acct.get("currency", "GBP"),
                balance=balance_gbp,
            )

            feed_items = self.get_transactions(uid, cat_uid, since_days)
            for item in feed_items:
                if item.get("status") not in ("SETTLED", "PENDING"):
                    continue

                minor = item.get("amount", {}).get("minorUnits", 0)
                direction = item.get("direction", "OUT")
                amount_gbp = (minor / 100) * (-1 if direction == "OUT" else 1)
                currency = item.get("amount", {}).get("currency", "GBP")

                raw_cat = item.get("spendingCategory", "GENERAL")
                category = STARLING_CATEGORY_MAP.get(raw_cat, "finance_bills")

                txn_date = item.get("transactionTime", "")[:10]
                description = item.get("reference", "") or item.get("counterPartyName", "")
                merchant_name = item.get("counterPartyName")

                added = _insert_transaction(
                    bank="starling",
                    account_id=uid,
                    txn_id=item["feedItemUid"],
                    txn_date=txn_date,
                    amount=amount_gbp,
                    currency=currency,
                    description=description,
                    merchant_name=merchant_name,
                    category=category,
                    notes=None,
                    raw=item,
                )
                if added:
                    new_count += 1

        return new_count


# ── NatWest Open Banking client ───────────────────────────────────────────────

class NatWestClient:
    """
    NatWest via UK Open Banking standard (AISP).

    Sandbox:  ob.sandbox.natwest.com  — register at developer.sandbox.natwest.com
    Production: requires FCA TPP registration + eIDAS certificate (MTLS)

    For production access:
      1. Register as AISP at the FCA (register.fca.org.uk)
      2. Obtain an eIDAS certificate (QWAC/QSealC)
      3. Register via Open Banking directory (openbanking.org.uk)
      4. Replace base_url, auth_url, token_url with production values
    """

    SANDBOX_BASE = "https://ob.sandbox.natwest.com"
    OB_PATH = "/open-banking/v3.1/aisp"

    def __init__(self):
        self.token = _get_access_token("natwest")
        if not self.token:
            raise RuntimeError("NatWest not authenticated. Run setup_banking.py first.")

    def _get(self, path: str, params: dict = None) -> dict:
        resp = requests.get(
            self.SANDBOX_BASE + self.OB_PATH + path,
            params=params,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/json; charset=utf-8",
                "x-fapi-financial-id": "0015800001041RHAAY",
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def get_accounts(self) -> list[dict]:
        data = self._get("/accounts")
        return data.get("Data", {}).get("Account", [])

    def get_balance(self, account_id: str) -> dict:
        data = self._get(f"/accounts/{account_id}/balances")
        balances = data.get("Data", {}).get("Balance", [])
        return balances[0] if balances else {}

    def get_transactions(self, account_id: str, since_days: int = 30) -> list[dict]:
        since = (datetime.utcnow() - timedelta(days=since_days)).strftime(
            "%Y-%m-%dT%H:%M:%S+00:00"
        )
        data = self._get(f"/accounts/{account_id}/transactions", {
            "fromBookingDateTime": since,
        })
        return data.get("Data", {}).get("Transaction", [])

    def sync(self, since_days: int = 30) -> int:
        new_count = 0
        accounts = self.get_accounts()
        for acct in accounts:
            acct_id = acct["AccountId"]
            nickname = (
                acct.get("Nickname")
                or acct.get("Description")
                or f"NatWest {acct_id[-4:]}"
            )
            acct_type = acct.get("AccountSubType", "CurrentAccount")

            balance_data = self.get_balance(acct_id)
            balance_gbp = float(
                balance_data.get("Amount", {}).get("Amount", 0)
            )
            currency = balance_data.get("Amount", {}).get("Currency", "GBP")

            _upsert_account(
                bank="natwest",
                account_id=acct_id,
                name=nickname,
                acct_type=acct_type,
                currency=currency,
                balance=balance_gbp,
            )

            txns = self.get_transactions(acct_id, since_days)
            for t in txns:
                amount_str = t.get("Amount", {}).get("Amount", "0")
                amount = float(amount_str)
                indicator = t.get("CreditDebitIndicator", "Debit")
                if indicator == "Debit":
                    amount = -amount

                txn_id = t.get("TransactionId") or t.get("TransactionReference", "")
                txn_date = (t.get("BookingDateTime") or "")[:10]
                description = t.get("TransactionInformation", "")
                currency = t.get("Amount", {}).get("Currency", "GBP")

                code = t.get("BankTransactionCode", {}).get("Code", "Debit")
                category = NATWEST_TRANSACTION_CODE_MAP.get(code, "finance_bills")

                added = _insert_transaction(
                    bank="natwest",
                    account_id=acct_id,
                    txn_id=txn_id,
                    txn_date=txn_date,
                    amount=amount,
                    currency=currency,
                    description=description,
                    merchant_name=None,
                    category=category,
                    notes=None,
                    raw=t,
                )
                if added:
                    new_count += 1

        return new_count


# ── Reconciliation ────────────────────────────────────────────────────────────

def reconcile_transactions(tolerance_gbp: float = 0.02) -> int:
    """
    Match bank transactions against documents and update their status to 'paid'.
    Uses fuzzy matching on merchant name + amount.
    Returns number of documents updated.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Get unreconciled transactions
    txns = conn.execute("""
        SELECT * FROM bank_transactions
        WHERE document_id IS NULL AND amount < 0
        ORDER BY date DESC LIMIT 200
    """).fetchall()

    # Get pending/active documents
    docs = conn.execute("""
        SELECT * FROM documents
        WHERE status IN ('pending', 'active')
        AND amount IS NOT NULL
    """).fetchall()

    updated = 0

    for txn in txns:
        txn_amount = abs(txn["amount"])
        txn_desc = (txn["description"] or "").lower()
        txn_merchant = (txn["merchant_name"] or "").lower()

        for doc in docs:
            doc_amount = doc["amount"]
            if abs(txn_amount - doc_amount) > tolerance_gbp:
                continue

            doc_desc = doc["description"].lower()

            # Check if key words overlap between transaction and document
            txn_words = set(txn_desc.split() + txn_merchant.split())
            doc_words = set(doc_desc.split())
            overlap = txn_words & doc_words - {"the", "a", "and", "or", "in", "for"}

            # Also check common short names
            name_checks = [
                ("octopus", "octopus"),
                ("eon", "e.on"),
                ("paypal", "paypal"),
                ("mcafee", "mcafee"),
                ("hyundai", "hyundai"),
                ("starling", "starling"),
                ("monzo", "monzo"),
            ]
            matched_name = any(
                k in txn_desc or k in txn_merchant
                for k, v in name_checks
                if v in doc_desc
            )

            if len(overlap) >= 1 or matched_name:
                conn.execute("""
                    UPDATE bank_transactions SET document_id=? WHERE id=?
                """, (doc["id"], txn["id"]))
                conn.execute("""
                    UPDATE documents SET status='paid', updated_at=datetime('now') WHERE id=?
                """, (doc["id"],))
                updated += 1
                break

    conn.commit()
    conn.close()
    return updated


# ── Top-level sync ────────────────────────────────────────────────────────────

BANK_CLIENTS = {
    "monzo": MonzoClient,
    "starling": StarlingClient,
    "natwest": NatWestClient,
}


def sync_bank(bank_name: str, since_days: int = 30) -> dict:
    """Sync a single bank. Returns result summary dict."""
    cls = BANK_CLIENTS.get(bank_name)
    if not cls:
        return {"error": f"Unknown bank: {bank_name}"}

    try:
        client = cls()
        new_txns = client.sync(since_days)
        reconciled = reconcile_transactions()
        return {
            "bank": bank_name,
            "new_transactions": new_txns,
            "reconciled": reconciled,
            "status": "ok",
        }
    except RuntimeError as e:
        return {"bank": bank_name, "status": "not_configured", "error": str(e)}
    except requests.HTTPError as e:
        return {"bank": bank_name, "status": "error", "error": f"HTTP {e.response.status_code}"}
    except Exception as e:
        return {"bank": bank_name, "status": "error", "error": str(e)}


def sync_all_banks(since_days: int = 30) -> list[dict]:
    """Sync all configured banks. Returns list of result summaries."""
    init_banking_tables()
    results = []
    tokens = _load_tokens()

    for bank_name in BANK_CLIENTS:
        if bank_name not in tokens:
            print(f"  Skipping {bank_name} (not configured)")
            continue
        print(f"  Syncing {BANKS[bank_name]['label']}...")
        result = sync_bank(bank_name, since_days)
        results.append(result)
        if result["status"] == "ok":
            print(f"    +{result['new_transactions']} transactions, "
                  f"{result['reconciled']} reconciled")
        else:
            print(f"    {result.get('error', 'unknown error')}")

    return results


def get_total_balance() -> dict[str, float]:
    """Return current balance per bank from the DB."""
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT bank, SUM(balance) as total FROM bank_accounts GROUP BY bank"
    ).fetchall()
    conn.close()
    return {row[0]: row[1] for row in rows}


if __name__ == "__main__":
    import sys
    init_banking_tables()
    results = sync_all_banks()
    if not results:
        print("No banks configured. Run: python setup_banking.py")
