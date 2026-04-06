"""
Household Management Dashboard — Flask web app.

Routes:
  GET /              — Main dashboard with category cards
  GET /documents     — Document browser (all categories or filtered)
  GET /documents/<category> — Documents for a specific category
  GET /chat          — Claude AI assistant with Obsidian + Drive knowledge base
  GET /banking       — Bank accounts, balances, and transaction feed
  GET /api/documents — JSON API for documents
  GET /api/stats     — JSON stats summary
  GET /api/banking   — JSON bank accounts + recent transactions
  POST /api/banking/sync — Trigger bank sync (all or ?bank=monzo)
  POST /api/chat     — Streaming SSE chat endpoint (Claude Opus 4.6)
  POST /api/scan     — Trigger email scan
"""

import json
import os
import re
import sqlite3
from datetime import datetime, timedelta, date
from pathlib import Path

from flask import Flask, jsonify, render_template_string, request, redirect, url_for, Response, stream_with_context

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "household.db"

app = Flask(__name__)


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def query(sql: str, params=()) -> list[dict]:
    conn = get_db()
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def scalar(sql: str, params=()):
    conn = get_db()
    row = conn.execute(sql, params).fetchone()
    conn.close()
    return row[0] if row else None


# ── Data helpers ──────────────────────────────────────────────────────────────

CATEGORIES = [
    {"key": "all",             "label": "All",         "icon": "🏠"},
    {"key": "car",             "label": "Car",         "icon": "🚗"},
    {"key": "car_insurance",   "label": "Insurance",   "icon": "🛡️"},
    {"key": "car_mot",         "label": "MOT",         "icon": "🔧"},
    {"key": "car_service",     "label": "Service",     "icon": "⚙️"},
    {"key": "health",          "label": "Health",      "icon": "🏥"},
    {"key": "finance_bills",   "label": "Bills",       "icon": "💰"},
    {"key": "finance_bank",    "label": "Bank",        "icon": "🏦"},
    {"key": "property_rental", "label": "Rental",      "icon": "🏠"},
    {"key": "holidays",        "label": "Holidays",    "icon": "✈️"},
]

CARD_CATEGORIES = [
    {
        "key": "finance_bills",
        "label": "Finance & Bills",
        "icon": "💰",
        "sub": ["finance_bills", "finance_bank"],
    },
    {
        "key": "car",
        "label": "Car",
        "icon": "🚗",
        "sub": ["car", "car_insurance", "car_mot", "car_service"],
    },
    {
        "key": "health",
        "label": "Health",
        "icon": "🏥",
        "sub": ["health", "health_adam", "health_betty"],
    },
    {
        "key": "property_rental",
        "label": "Property",
        "icon": "🏠",
        "sub": ["property", "property_rental"],
    },
    {
        "key": "holidays",
        "label": "Holidays",
        "icon": "✈️",
        "sub": ["holidays", "holiday"],
    },
]


def _card_data(card: dict) -> dict:
    placeholders = ",".join("?" for _ in card["sub"])
    docs = query(
        f"SELECT * FROM documents WHERE category IN ({placeholders}) ORDER BY date DESC",
        card["sub"],
    )

    doc_count = scalar(
        f"SELECT COUNT(*) FROM documents WHERE category IN ({placeholders})",
        card["sub"],
    )
    drive_count = scalar(
        f"SELECT COUNT(*) FROM documents WHERE category IN ({placeholders}) AND drive_link IS NOT NULL",
        card["sub"],
    )
    pending = [d for d in docs if d.get("status") in ("pending", "due")]
    flags = [d for d in docs if "cancel" in d["description"].lower() or "mcafee" in d["description"].lower()]

    total_amount = sum(d["amount"] for d in pending if d.get("amount")) or 0

    upcoming = [
        d for d in docs
        if d.get("due_date") and d["status"] not in ("paid", "cancelled")
    ]
    upcoming.sort(key=lambda d: d["due_date"])

    return {
        **card,
        "doc_count": doc_count or 0,
        "drive_count": drive_count or 0,
        "docs": docs[:5],
        "pending": pending,
        "flags": flags,
        "upcoming": upcoming[:3],
        "total_pending": total_amount,
    }


def _get_summary_stats() -> dict:
    total = scalar("SELECT COUNT(*) FROM documents") or 0
    with_drive = scalar("SELECT COUNT(*) FROM documents WHERE drive_link IS NOT NULL") or 0
    pending = scalar("SELECT COUNT(*) FROM documents WHERE status='pending'") or 0
    flags = scalar(
        "SELECT COUNT(*) FROM documents WHERE description LIKE '%cancel%' OR description LIKE '%McAfee%'"
    ) or 0

    today = date.today().isoformat()
    due_soon = scalar(
        "SELECT COUNT(*) FROM documents WHERE due_date <= ? AND status NOT IN ('paid','cancelled')",
        (str(date.today() + timedelta(days=7)),),
    ) or 0

    balances = _get_total_balances()
    bank_total = sum(balances.values()) if balances else None

    return {
        "total": total,
        "with_drive": with_drive,
        "pending": pending,
        "flags": flags,
        "due_soon": due_soon,
        "bank_total": bank_total,
    }


# ── Templates ─────────────────────────────────────────────────────────────────

BASE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Household Dashboard</title>
<style>
  :root {
    --bg: #0f172a; --surface: #1e293b; --surface2: #334155;
    --accent: #3b82f6; --accent2: #6366f1; --text: #f1f5f9;
    --text2: #94a3b8; --warn: #f59e0b; --danger: #ef4444;
    --success: #22c55e; --border: #475569;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; min-height: 100vh; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .nav { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 2rem; display: flex; align-items: center; gap: 2rem; height: 56px; }
  .nav-brand { font-size: 1.2rem; font-weight: 700; color: var(--text); }
  .nav a { color: var(--text2); font-size: 0.9rem; padding: 0.4rem 0.8rem; border-radius: 6px; transition: background 0.15s; }
  .nav a:hover, .nav a.active { background: var(--surface2); color: var(--text); text-decoration: none; }
  .main { max-width: 1200px; margin: 0 auto; padding: 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.1rem; margin-bottom: 1rem; color: var(--text2); }
  .stats-bar { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.4rem; flex: 1; min-width: 120px; }
  .stat-val { font-size: 1.8rem; font-weight: 700; }
  .stat-label { font-size: 0.75rem; color: var(--text2); margin-top: 2px; }
  .stat.warn .stat-val { color: var(--warn); }
  .stat.danger .stat-val { color: var(--danger); }
  .stat.success .stat-val { color: var(--success); }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.5rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.4rem; transition: border-color 0.2s; }
  .card:hover { border-color: var(--accent); }
  .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  .card-title { display: flex; align-items: center; gap: 0.5rem; font-size: 1rem; font-weight: 600; }
  .card-icon { font-size: 1.4rem; }
  .badge { background: var(--surface2); border-radius: 20px; padding: 2px 10px; font-size: 0.75rem; color: var(--text2); display: inline-flex; align-items: center; gap: 4px; }
  .badge.warn { background: rgba(245,158,11,0.15); color: var(--warn); }
  .badge.danger { background: rgba(239,68,68,0.15); color: var(--danger); }
  .badge.success { background: rgba(34,197,94,0.15); color: var(--success); }
  .doc-list { list-style: none; }
  .doc-item { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--surface2); font-size: 0.85rem; }
  .doc-item:last-child { border-bottom: none; }
  .doc-desc { color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .doc-meta { color: var(--text2); font-size: 0.75rem; white-space: nowrap; margin-left: 0.5rem; }
  .doc-link { color: var(--accent); font-size: 0.8rem; margin-left: 0.5rem; }
  .flag { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 0.6rem 0.8rem; font-size: 0.82rem; color: #fca5a5; margin-top: 0.8rem; }
  .due-soon { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 0.6rem 0.8rem; font-size: 0.82rem; color: #fcd34d; margin-top: 0.8rem; }
  .card-footer { margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; }
  .btn { background: var(--accent); color: white; border: none; border-radius: 6px; padding: 0.35rem 0.9rem; font-size: 0.8rem; cursor: pointer; text-decoration: none; }
  .btn:hover { background: #2563eb; text-decoration: none; color: white; }
  .section-title { font-size: 1.3rem; font-weight: 700; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 0.6rem 0.8rem; font-size: 0.78rem; color: var(--text2); border-bottom: 1px solid var(--border); }
  td { padding: 0.65rem 0.8rem; font-size: 0.85rem; border-bottom: 1px solid var(--surface2); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--surface2); }
  .table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .filters { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .filter-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text2); border-radius: 20px; padding: 0.3rem 0.9rem; font-size: 0.8rem; cursor: pointer; text-decoration: none; }
  .filter-btn:hover, .filter-btn.active { background: var(--accent); border-color: var(--accent); color: white; text-decoration: none; }
  .status-badge { border-radius: 4px; padding: 1px 7px; font-size: 0.72rem; font-weight: 600; }
  .status-pending { background: rgba(245,158,11,0.2); color: #fcd34d; }
  .status-paid { background: rgba(34,197,94,0.2); color: #86efac; }
  .status-active { background: rgba(59,130,246,0.2); color: #93c5fd; }
  .status-cancelled { background: rgba(148,163,184,0.2); color: #94a3b8; }
  .empty { color: var(--text2); font-size: 0.85rem; padding: 1.5rem; text-align: center; }
</style>
</head>
<body>
<nav class="nav">
  <span class="nav-brand">🏠 Household</span>
  <a href="/" class="{% if page == 'home' %}active{% endif %}">Dashboard</a>
  <a href="/documents" class="{% if page == 'documents' %}active{% endif %}">Documents</a>
  <a href="/banking" class="{% if page == 'banking' %}active{% endif %}">🏦 Banking</a>
  <a href="/chat" class="{% if page == 'chat' %}active{% endif %}">🤖 Ask Claude</a>
</nav>
<div class="main">
  {% block content %}{% endblock %}
</div>
</body>
</html>"""

DASHBOARD_TEMPLATE = BASE_HTML.replace(
    "{% block content %}{% endblock %}",
    """
<h1>Household Dashboard</h1>
<p style="color:var(--text2);margin-bottom:1.5rem;">{{ today }}</p>

<div class="stats-bar">
  <div class="stat"><div class="stat-val">{{ stats.total }}</div><div class="stat-label">Total Documents</div></div>
  <div class="stat success"><div class="stat-val">{{ stats.with_drive }}</div><div class="stat-label">In Google Drive</div></div>
  <div class="stat warn"><div class="stat-val">{{ stats.pending }}</div><div class="stat-label">Pending / Due</div></div>
  <div class="stat {% if stats.due_soon > 0 %}danger{% endif %}"><div class="stat-val">{{ stats.due_soon }}</div><div class="stat-label">Due Within 7 Days</div></div>
  <div class="stat {% if stats.flags > 0 %}danger{% endif %}"><div class="stat-val">{{ stats.flags }}</div><div class="stat-label">Flagged for Review</div></div>
  {% if stats.bank_total is not none %}
  <div class="stat success">
    <div class="stat-val">£{{ "%.0f"|format(stats.bank_total) }}</div>
    <div class="stat-label">Bank Balance <a href="/banking" style="color:var(--text2);font-size:0.7rem;margin-left:4px;">↗</a></div>
  </div>
  {% endif %}
</div>

<div class="cards">
{% for card in cards %}
<div class="card">
  <div class="card-header">
    <div class="card-title">
      <span class="card-icon">{{ card.icon }}</span>
      {{ card.label }}
    </div>
    <div style="display:flex;gap:0.4rem;align-items:center;">
      {% if card.drive_count > 0 %}
      <span class="badge">📎 {{ card.drive_count }}</span>
      {% endif %}
      {% if card.flags %}
      <span class="badge danger">⚠️ {{ card.flags|length }}</span>
      {% endif %}
      {% if card.pending %}
      <span class="badge warn">{{ card.pending|length }} pending</span>
      {% endif %}
    </div>
  </div>

  {% if card.flags %}
  {% for f in card.flags %}
  <div class="flag">⚠️ {{ f.description }}</div>
  {% endfor %}
  {% endif %}

  {% if card.upcoming %}
  {% for d in card.upcoming %}
  <div class="due-soon">
    📅 {{ d.description[:50] }} — due {{ d.due_date }}
    {% if d.amount %}— £{{ "%.2f"|format(d.amount) }}{% endif %}
  </div>
  {% endfor %}
  {% endif %}

  <ul class="doc-list">
  {% for doc in card.docs %}
  <li class="doc-item">
    <span class="doc-desc" title="{{ doc.description }}">{{ doc.description[:55] }}</span>
    {% if doc.amount %}<span class="doc-meta">£{{ "%.2f"|format(doc.amount) }}</span>{% endif %}
    {% if doc.drive_link %}<a class="doc-link" href="{{ doc.drive_link }}" target="_blank">📎</a>{% endif %}
  </li>
  {% endfor %}
  {% if not card.docs %}
  <li class="doc-item"><span class="doc-desc" style="color:var(--text2)">No documents yet</span></li>
  {% endif %}
  </ul>

  <div class="card-footer">
    <span class="doc-meta">{{ card.doc_count }} document{{ 's' if card.doc_count != 1 else '' }}</span>
    <a class="btn" href="/documents/{{ card.key }}">View All</a>
  </div>
</div>
{% endfor %}
</div>
""",
)

DOCUMENTS_TEMPLATE = BASE_HTML.replace(
    "{% block content %}{% endblock %}",
    """
<div class="section-title">📁 Documents{% if active_cat and active_cat != 'all' %} — {{ active_label }}{% endif %}</div>

<div class="filters">
  {% for cat in categories %}
  <a href="/documents{% if cat.key != 'all' %}/{{ cat.key }}{% endif %}"
     class="filter-btn {% if cat.key == (active_cat or 'all') %}active{% endif %}">
    {{ cat.icon }} {{ cat.label }}
  </a>
  {% endfor %}
</div>

<div class="table-wrap">
{% if docs %}
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Description</th>
      <th>Category</th>
      <th>Amount</th>
      <th>Due</th>
      <th>Status</th>
      <th>Drive</th>
    </tr>
  </thead>
  <tbody>
  {% for doc in docs %}
  <tr>
    <td style="color:var(--text2);white-space:nowrap">{{ doc.date }}</td>
    <td>{{ doc.description[:70] }}</td>
    <td style="color:var(--text2)">{{ doc.category.replace('_',' ').title() }}</td>
    <td style="white-space:nowrap">{% if doc.amount %}£{{ "%.2f"|format(doc.amount) }}{% endif %}</td>
    <td style="white-space:nowrap;color:var(--warn)">{{ doc.due_date or '' }}</td>
    <td>
      <span class="status-badge status-{{ doc.status or 'active' }}">{{ doc.status or 'active' }}</span>
    </td>
    <td>
      {% if doc.drive_link %}
      <a href="{{ doc.drive_link }}" target="_blank" title="Open in Google Drive">📎 Open</a>
      {% else %}
      <span style="color:var(--text2)">—</span>
      {% endif %}
    </td>
  </tr>
  {% endfor %}
  </tbody>
</table>
{% else %}
<div class="empty">No documents found for this category.</div>
{% endif %}
</div>
""",
)


# ── Routes ────────────────────────────────────────────────────────────────────

def render(template: str, **kwargs):
    from flask import render_template_string as rts
    return rts(template, **kwargs)


@app.route("/")
def index():
    cards = [_card_data(c) for c in CARD_CATEGORIES]
    stats = _get_summary_stats()
    today = datetime.now().strftime("%A, %-d %B %Y")
    return render(DASHBOARD_TEMPLATE, cards=cards, stats=stats, today=today, page="home")


@app.route("/documents")
@app.route("/documents/<category>")
def documents(category=None):
    if category and category != "all":
        # Include sub-categories
        sub_keys = [category]
        for card in CARD_CATEGORIES:
            if card["key"] == category:
                sub_keys = card["sub"]
                break
        placeholders = ",".join("?" for _ in sub_keys)
        docs = query(
            f"SELECT * FROM documents WHERE category IN ({placeholders}) ORDER BY date DESC",
            sub_keys,
        )
        active_label = next(
            (c["icon"] + " " + c["label"] for c in CATEGORIES if c["key"] == category),
            category.replace("_", " ").title(),
        )
    else:
        docs = query("SELECT * FROM documents ORDER BY date DESC")
        active_label = "All"

    return render(
        DOCUMENTS_TEMPLATE,
        docs=docs,
        categories=CATEGORIES,
        active_cat=category or "all",
        active_label=active_label,
        page="documents",
    )


@app.route("/api/documents")
def api_documents():
    category = request.args.get("category")
    if category:
        docs = query("SELECT * FROM documents WHERE category=? ORDER BY date DESC", (category,))
    else:
        docs = query("SELECT * FROM documents ORDER BY date DESC")
    return jsonify(docs)


@app.route("/api/stats")
def api_stats():
    return jsonify(_get_summary_stats())


@app.route("/api/scan", methods=["POST"])
def api_scan():
    email_addr = os.environ.get("GMAIL_ADDRESS")
    app_pw = os.environ.get("GMAIL_APP_PASSWORD")
    if not email_addr or not app_pw:
        return jsonify({"error": "GMAIL_ADDRESS / GMAIL_APP_PASSWORD not set"}), 400
    try:
        import subprocess
        result = subprocess.Popen(
            ["python", str(BASE_DIR / "scanner.py")],
            env={**os.environ},
        )
        return jsonify({"status": "scan started", "pid": result.pid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Claude AI Knowledge Base ──────────────────────────────────────────────────

OBSIDIAN_VAULT = Path(os.environ.get("OBSIDIAN_VAULT", str(Path.home() / "Obsidian/Household")))

CLAUDE_SYSTEM = """You are a smart household management assistant with full access to the household's financial records, documents, calendar, and notes.

Your knowledge base consists of:
- A structured SQLite database of household documents (bills, payments, car records, health, property)
- Obsidian markdown notes linked to each document, including Google Drive links to the actual files
- Category structure: Finance/Bills, Car (Insurance/MOT/Service), Health, Property/Rental, Holidays

You help with questions like:
- "What bills are coming up this month?"
- "How much did the Hyundai service cost?"
- "Should I cancel McAfee?"
- "What's my total outstanding amount?"
- "When is the next MOT due?"
- "Show me all PayPal payments"

Always cite specific records when you reference data. Use £ for GBP amounts. If a document has a Google Drive link, mention it. Be concise and practical — this is a household assistant, not a formal system.

Today's date: {today}

--- HOUSEHOLD KNOWLEDGE BASE ---

{context}

--- END KNOWLEDGE BASE ---"""


# ── Banking helpers ───────────────────────────────────────────────────────────

def _get_bank_accounts() -> list[dict]:
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM bank_accounts ORDER BY bank, name"
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def _get_bank_transactions(days: int = 30, bank: str = None) -> list[dict]:
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        since = (date.today() - timedelta(days=days)).isoformat()
        if bank:
            rows = conn.execute(
                "SELECT * FROM bank_transactions WHERE bank=? AND date>=? ORDER BY date DESC LIMIT 200",
                (bank, since),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM bank_transactions WHERE date>=? ORDER BY date DESC LIMIT 200",
                (since,),
            ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def _get_total_balances() -> dict:
    """Return {bank: balance} from DB, or {} if table missing."""
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute(
            "SELECT bank, SUM(balance) FROM bank_accounts GROUP BY bank"
        ).fetchall()
        conn.close()
        return {r[0]: r[1] for r in rows}
    except Exception:
        return {}


def _banking_context_block() -> str:
    """Build a banking section for Claude's context."""
    accounts = _get_bank_accounts()
    txns = _get_bank_transactions(days=30)

    if not accounts and not txns:
        return ""

    lines = ["## Live Bank Accounts\n"]
    for a in accounts:
        updated = a.get("balance_updated", "")[:10]
        lines.append(
            f"- {a['bank'].title()} | {a['name']} ({a['type']}) | "
            f"Balance: £{(a['balance'] or 0):.2f} | Updated: {updated}"
        )

    if txns:
        lines.append("\n## Recent Bank Transactions (last 30 days)\n")
        for t in txns[:50]:
            sign = "" if t["amount"] >= 0 else ""
            lines.append(
                f"- [{t['date']}] {t['bank'].title()} | "
                f"{t['description'] or t['merchant_name'] or 'Unknown'} | "
                f"£{t['amount']:.2f} | {t['category']}"
                + (" ✓ matched" if t.get("document_id") else "")
            )

    return "\n".join(lines)


BANKING_TEMPLATE = BASE_HTML.replace(
    "{% block content %}{% endblock %}",
    """
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
  <div class="section-title" style="margin-bottom:0;">🏦 Banking</div>
  <button id="sync-btn" onclick="syncBanks()"
    style="background:var(--accent);color:white;border:none;border-radius:8px;
           padding:0.5rem 1.2rem;font-size:0.85rem;cursor:pointer;">
    ↻ Sync Now
  </button>
</div>
<div id="sync-status" style="display:none;font-size:0.82rem;color:var(--text2);margin-bottom:1rem;"></div>

<!-- Balance cards -->
<div class="stats-bar" style="margin-bottom:2rem;">
{% for acct in accounts %}
<div class="stat {% if acct.balance and acct.balance > 0 %}success{% elif acct.balance and acct.balance < 0 %}danger{% endif %}">
  <div style="font-size:0.7rem;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">
    {{ acct.bank.title() }} · {{ acct.name }}
  </div>
  <div class="stat-val">£{{ "%.2f"|format(acct.balance or 0) }}</div>
  <div class="stat-label">{{ acct.type }} · updated {{ (acct.balance_updated or '')[:10] }}</div>
</div>
{% else %}
<div class="stat">
  <div class="stat-val" style="font-size:1rem;color:var(--text2)">No accounts yet</div>
  <div class="stat-label">Run: python setup_banking.py</div>
</div>
{% endfor %}
</div>

<!-- Bank filter tabs -->
<div class="filters" style="margin-bottom:1.5rem;">
  <a href="/banking" class="filter-btn {% if not active_bank %}active{% endif %}">All Banks</a>
  {% for b in banks %}
  <a href="/banking?bank={{ b }}" class="filter-btn {% if active_bank == b %}active{% endif %}">
    {{ b.title() }}
  </a>
  {% endfor %}
</div>

<!-- Transactions table -->
<div class="table-wrap">
{% if transactions %}
<table>
  <thead>
    <tr>
      <th>Date</th><th>Bank</th><th>Description</th>
      <th>Category</th><th>Amount</th><th>Matched</th>
    </tr>
  </thead>
  <tbody>
  {% for t in transactions %}
  <tr>
    <td style="color:var(--text2);white-space:nowrap">{{ t.date }}</td>
    <td>
      <span class="badge">{{ t.bank.title() }}</span>
    </td>
    <td>{{ (t.description or t.merchant_name or '—')[:60] }}</td>
    <td style="color:var(--text2)">{{ t.category.replace('_',' ').title() if t.category else '—' }}</td>
    <td style="white-space:nowrap;font-weight:600;
               color:{% if t.amount >= 0 %}var(--success){% else %}var(--text){% endif %}">
      {% if t.amount >= 0 %}+{% endif %}£{{ "%.2f"|format(t.amount|abs) }}
    </td>
    <td>
      {% if t.document_id %}
        <span class="status-badge status-paid">✓ matched</span>
      {% else %}
        <span style="color:var(--text2)">—</span>
      {% endif %}
    </td>
  </tr>
  {% endfor %}
  </tbody>
</table>
{% else %}
<div class="empty">
  No transactions yet.<br>
  <span style="font-size:0.8rem;margin-top:0.5rem;display:block;">
    Run <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;">python setup_banking.py</code>
    then click Sync Now above.
  </span>
</div>
{% endif %}
</div>

<script>
async function syncBanks() {
  const btn = document.getElementById('sync-btn');
  const status = document.getElementById('sync-status');
  btn.disabled = true;
  btn.textContent = '↻ Syncing…';
  status.style.display = 'block';
  status.textContent = 'Connecting to banks…';

  const bank = new URLSearchParams(window.location.search).get('bank') || '';
  try {
    const resp = await fetch('/api/banking/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank }),
    });
    const data = await resp.json();
    if (data.results) {
      const parts = data.results.map(r =>
        r.status === 'ok'
          ? `${r.bank}: +${r.new_transactions} txns, ${r.reconciled} matched`
          : `${r.bank}: ${r.error || r.status}`
      );
      status.textContent = parts.join(' · ') + ' — reloading…';
      setTimeout(() => location.reload(), 1200);
    } else {
      status.textContent = data.error || 'Sync failed';
    }
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '↻ Sync Now';
  }
}
</script>
""",
)


# ── Banking routes ────────────────────────────────────────────────────────────

@app.route("/banking")
def banking():
    active_bank = request.args.get("bank")
    accounts = _get_bank_accounts()
    banks = sorted({a["bank"] for a in accounts})
    transactions = _get_bank_transactions(days=60, bank=active_bank or None)
    return render(
        BANKING_TEMPLATE,
        accounts=accounts,
        banks=banks,
        transactions=transactions,
        active_bank=active_bank,
        page="banking",
    )


@app.route("/api/banking")
def api_banking():
    accounts = _get_bank_accounts()
    transactions = _get_bank_transactions(days=30)
    return jsonify({"accounts": accounts, "transactions": transactions})


@app.route("/api/banking/sync", methods=["POST"])
def api_banking_sync():
    data = request.get_json(silent=True) or {}
    bank = (data.get("bank") or "").strip().lower()
    try:
        from banking import sync_bank, sync_all_banks, init_banking_tables
        init_banking_tables()
        if bank:
            result = sync_bank(bank)
            results = [result]
        else:
            results = sync_all_banks()
        return jsonify({"results": results})
    except ImportError as e:
        return jsonify({"error": f"banking module error: {e}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _search_obsidian(keywords: list[str], max_notes: int = 8) -> list[dict]:
    """Find and read Obsidian notes matching any of the keywords."""
    if not OBSIDIAN_VAULT.exists():
        return []

    matches = []
    seen = set()
    keywords_lower = [k.lower() for k in keywords if len(k) > 2]

    for note_path in OBSIDIAN_VAULT.rglob("*.md"):
        if note_path in seen:
            continue
        try:
            content = note_path.read_text(errors="replace")
            content_lower = content.lower()
            score = sum(1 for k in keywords_lower if k in content_lower)
            if score > 0:
                matches.append({"path": note_path, "content": content, "score": score})
                seen.add(note_path)
        except OSError:
            pass

    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:max_notes]


def _extract_keywords(text: str) -> list[str]:
    """Pull meaningful keywords from user query for note search."""
    # Remove common filler words
    stop = {"what", "when", "how", "much", "the", "is", "are", "was", "my",
            "any", "all", "do", "did", "has", "have", "show", "me", "tell",
            "about", "can", "could", "would", "please", "give", "find", "get",
            "for", "and", "or", "in", "on", "at", "to", "of", "a", "an"}
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    return [w for w in words if w not in stop]


def _build_context(user_message: str) -> tuple[str, list[dict]]:
    """
    Build context string from SQLite + Obsidian for a user query.
    Returns (context_text, sources_list).
    """
    context_parts = []
    sources = []

    # ── 1. Full document list from SQLite ─────────────────────────────────────
    all_docs = query(
        "SELECT * FROM documents ORDER BY date DESC LIMIT 100"
    )

    if all_docs:
        context_parts.append("## All Household Records\n")
        for d in all_docs:
            amt = f"£{d['amount']:.2f}" if d.get("amount") else ""
            due = f" | Due: {d['due_date']}" if d.get("due_date") else ""
            drive = f" | 📎 {d['drive_link']}" if d.get("drive_link") else ""
            flag = " ⚠️ FLAGGED FOR REVIEW" if (
                "cancel" in d["description"].lower() or
                "mcafee" in d["description"].lower()
            ) else ""
            context_parts.append(
                f"- [{d['date']}] {d['description']} | {d['category']} | "
                f"{d.get('status','active')} {amt}{due}{drive}{flag}"
            )
        context_parts.append("")

    # ── 2. Pending / upcoming payments ────────────────────────────────────────
    pending = query(
        "SELECT * FROM documents WHERE status IN ('pending','due') ORDER BY due_date ASC"
    )
    if pending:
        context_parts.append("## Pending / Upcoming Payments\n")
        total = sum(d["amount"] for d in pending if d.get("amount"))
        for d in pending:
            amt = f"£{d['amount']:.2f}" if d.get("amount") else ""
            due = f"due {d['due_date']}" if d.get("due_date") else ""
            context_parts.append(f"- {d['description']} {amt} {due}".strip())
        context_parts.append(f"\nTotal pending: £{total:.2f}\n")

    # ── 3. Flagged items ───────────────────────────────────────────────────────
    flagged = query(
        "SELECT * FROM documents WHERE description LIKE '%cancel%' OR description LIKE '%McAfee%'"
    )
    if flagged:
        context_parts.append("## Items Flagged for Review\n")
        for d in flagged:
            amt = f"£{d['amount']:.2f}" if d.get("amount") else ""
            context_parts.append(f"- ⚠️ {d['description']} {amt} (renewed {d['date']})")
        context_parts.append("")

    # ── 4. Relevant Obsidian notes ────────────────────────────────────────────
    keywords = _extract_keywords(user_message)
    # Always include category keywords too
    for cat_kw in ["paypal", "eon", "octopus", "hyundai", "mcafee", "car", "health", "holiday"]:
        if cat_kw in user_message.lower() and cat_kw not in keywords:
            keywords.append(cat_kw)

    notes = _search_obsidian(keywords)
    if notes:
        context_parts.append("## Relevant Obsidian Notes\n")
        for note in notes:
            rel_path = note["path"].relative_to(OBSIDIAN_VAULT) if OBSIDIAN_VAULT.exists() else note["path"]
            context_parts.append(f"### {rel_path}\n{note['content']}\n")
            sources.append({
                "type": "note",
                "path": str(rel_path),
                "name": note["path"].stem,
            })

    # ── 5. Live bank transactions ──────────────────────────────────────────────
    banking_block = _banking_context_block()
    if banking_block:
        context_parts.append(banking_block)

    # ── 6. Drive folder summary ────────────────────────────────────────────────
    drive_folders_file = BASE_DIR / "drive_folders.json"
    if drive_folders_file.exists():
        try:
            folder_ids = json.loads(drive_folders_file.read_text())
            context_parts.append(
                f"## Google Drive\nFolder structure configured with {len(folder_ids)} folders. "
                "Documents with 📎 links above can be opened directly in Drive."
            )
        except Exception:
            pass

    # Add SQLite records as sources
    for d in all_docs[:20]:
        sources.append({
            "type": "record",
            "description": d["description"],
            "date": d["date"],
            "category": d["category"],
            "amount": d.get("amount"),
            "drive_link": d.get("drive_link"),
        })

    return "\n".join(context_parts), sources


def _stream_claude(messages: list[dict]) -> "Generator":
    """
    Stream a Claude response using the Anthropic SDK.
    Yields SSE-formatted strings.
    """
    try:
        import anthropic
    except ImportError:
        yield f"data: {json.dumps({'type': 'error', 'text': 'anthropic package not installed. Run: pip install anthropic'})}\n\n"
        return

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        yield f"data: {json.dumps({'type': 'error', 'text': 'ANTHROPIC_API_KEY environment variable not set.'})}\n\n"
        return

    # Build context from the latest user message
    user_text = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"),
        "",
    )
    context, sources = _build_context(user_text)

    today_str = datetime.now().strftime("%A, %-d %B %Y")
    system_prompt = CLAUDE_SYSTEM.format(today=today_str, context=context)

    # Emit sources before streaming text
    if sources:
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources[:15]})}\n\n"

    client = anthropic.Anthropic(api_key=api_key)

    try:
        # Use adaptive thinking + streaming; cache the system prompt (stable content)
        with client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=messages,
        ) as stream:
            for event in stream:
                # Stream text deltas
                if (
                    hasattr(event, "type")
                    and event.type == "content_block_delta"
                    and hasattr(event, "delta")
                ):
                    delta = event.delta
                    if hasattr(delta, "type") and delta.type == "text_delta":
                        yield f"data: {json.dumps({'type': 'text', 'text': delta.text})}\n\n"

            final = stream.get_final_message()
            usage = final.usage
            yield f"data: {json.dumps({'type': 'done', 'usage': {'input': usage.input_tokens, 'output': usage.output_tokens}})}\n\n"

    except anthropic.AuthenticationError:
        yield f"data: {json.dumps({'type': 'error', 'text': 'Invalid ANTHROPIC_API_KEY.'})}\n\n"
    except anthropic.RateLimitError:
        yield f"data: {json.dumps({'type': 'error', 'text': 'Rate limit reached. Please wait a moment.'})}\n\n"
    except anthropic.APIError as e:
        yield f"data: {json.dumps({'type': 'error', 'text': f'API error: {e}'})}\n\n"


# ── Chat template ─────────────────────────────────────────────────────────────

CHAT_TEMPLATE = BASE_HTML.replace(
    "{% block content %}{% endblock %}",
    """
<div style="display:flex;gap:1.5rem;height:calc(100vh - 56px - 4rem);">

  <!-- Chat panel -->
  <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
    <div class="section-title" style="margin-bottom:1rem;">
      🤖 Claude — Household Assistant
      <span style="font-size:0.75rem;font-weight:400;color:var(--text2);margin-left:0.5rem;">
        Opus 4.6 · Obsidian + Drive knowledge base
      </span>
    </div>

    <!-- Messages -->
    <div id="messages" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:1rem;padding-right:0.5rem;margin-bottom:1rem;">
      <div class="msg assistant" id="welcome">
        <div class="msg-bubble">
          👋 Hi! I have access to all your household records, Obsidian notes, and Google Drive links.
          Ask me anything — bills due, car history, subscriptions to cancel, total spending, anything.
        </div>
      </div>
    </div>

    <!-- Input -->
    <div style="display:flex;gap:0.75rem;align-items:flex-end;">
      <textarea id="input" placeholder="Ask about bills, car, health, holidays…"
        style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:10px;
               color:var(--text);padding:0.75rem 1rem;font-size:0.9rem;font-family:inherit;
               resize:none;min-height:52px;max-height:160px;line-height:1.5;outline:none;"
        rows="1"></textarea>
      <button id="send-btn" onclick="sendMessage()"
        style="background:var(--accent);color:white;border:none;border-radius:10px;
               padding:0.75rem 1.4rem;font-size:0.9rem;cursor:pointer;white-space:nowrap;height:52px;">
        Send
      </button>
    </div>

    <!-- Suggested prompts -->
    <div id="suggestions" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.75rem;">
      <button class="suggest-btn" onclick="suggest('What bills are due this month?')">Bills due</button>
      <button class="suggest-btn" onclick="suggest('What is my total outstanding amount?')">Total owed</button>
      <button class="suggest-btn" onclick="suggest('Should I cancel McAfee?')">McAfee review</button>
      <button class="suggest-btn" onclick="suggest('Tell me about the Hyundai service')">Car history</button>
      <button class="suggest-btn" onclick="suggest('What energy bills do I have?')">Energy bills</button>
    </div>
  </div>

  <!-- Sources panel -->
  <div id="sources-panel" style="width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:0.75rem;">
    <div style="font-size:0.8rem;color:var(--text2);font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">
      Sources used
    </div>
    <div id="sources-list" style="flex:1;overflow-y:auto;">
      <div style="color:var(--text2);font-size:0.8rem;">Sources will appear here after you ask a question.</div>
    </div>
  </div>
</div>

<style>
  .msg { display:flex; flex-direction:column; }
  .msg.user { align-items:flex-end; }
  .msg.assistant { align-items:flex-start; }
  .msg-bubble {
    max-width: 85%;
    padding: 0.8rem 1rem;
    border-radius: 12px;
    font-size: 0.88rem;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .msg.user .msg-bubble {
    background: var(--accent);
    color: white;
    border-bottom-right-radius: 4px;
  }
  .msg.assistant .msg-bubble {
    background: var(--surface);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
  }
  .msg-bubble p { margin: 0.4em 0; }
  .msg-bubble p:first-child { margin-top: 0; }
  .msg-bubble p:last-child { margin-bottom: 0; }
  .msg-bubble strong { color: #e2e8f0; }
  .msg-bubble code {
    background: var(--surface2);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 0.82em;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }
  .msg-bubble ul, .msg-bubble ol { padding-left: 1.3em; }
  .msg-bubble li { margin: 0.2em 0; }
  .msg-bubble h1, .msg-bubble h2, .msg-bubble h3 {
    margin: 0.6em 0 0.3em;
    font-size: 1em;
    color: #e2e8f0;
  }
  .thinking-indicator {
    display: flex;
    gap: 4px;
    padding: 0.8rem 1rem;
    align-items: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    border-bottom-left-radius: 4px;
    font-size: 0.82rem;
    color: var(--text2);
  }
  .dot { width:6px;height:6px;border-radius:50%;background:var(--text2);animation:bounce 1.2s infinite; }
  .dot:nth-child(2){animation-delay:0.2s;}
  .dot:nth-child(3){animation-delay:0.4s;}
  @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
  .suggest-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text2);
    border-radius: 16px;
    padding: 0.3rem 0.85rem;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .suggest-btn:hover { background: var(--surface2); color: var(--text); border-color: var(--accent); }
  .source-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    font-size: 0.78rem;
    margin-bottom: 0.5rem;
  }
  .source-item .source-name { font-weight: 600; color: var(--text); margin-bottom: 2px; }
  .source-item .source-meta { color: var(--text2); }
</style>

<script>
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');
let conversationHistory = [];

// Auto-resize textarea
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
});

// Submit on Enter (Shift+Enter for newline)
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function suggest(text) {
  inputEl.value = text;
  inputEl.style.height = 'auto';
  inputEl.dispatchEvent(new Event('input'));
  sendMessage();
}

function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if (role === 'assistant') {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.textContent = content;
  }
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function renderMarkdown(text) {
  // Basic markdown rendering
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\\s\\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
    .replace(/\\n\\n/g, '</p><p>')
    .replace(/^(?!<[hup])/gm, '')
    .replace(/(.+)/g, (m) => m.startsWith('<') ? m : `<p>${m}</p>`)
    .replace(/<p><\\/p>/g, '');
}

function showSources(sources) {
  const el = document.getElementById('sources-list');
  if (!sources || !sources.length) return;

  const noteCount = sources.filter(s => s.type === 'note').length;
  const recordCount = sources.filter(s => s.type === 'record').length;

  let html = `<div style="font-size:0.75rem;color:var(--text2);margin-bottom:0.6rem;">
    ${noteCount} note${noteCount !== 1 ? 's' : ''} · ${recordCount} records
  </div>`;

  for (const s of sources) {
    if (s.type === 'note') {
      html += `<div class="source-item">
        <div class="source-name">📝 ${s.name}</div>
        <div class="source-meta">${s.path}</div>
      </div>`;
    }
  }

  // Show first 5 records
  const records = sources.filter(s => s.type === 'record').slice(0, 5);
  for (const s of records) {
    const amt = s.amount ? ` · £${s.amount.toFixed(2)}` : '';
    const drive = s.drive_link ? `<a href="${s.drive_link}" target="_blank" style="color:var(--accent)">📎</a>` : '';
    html += `<div class="source-item">
      <div class="source-name">${s.description.substring(0, 45)}</div>
      <div class="source-meta">${s.date} · ${s.category.replace(/_/g,' ')}${amt} ${drive}</div>
    </div>`;
  }

  el.innerHTML = html;
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  // Hide suggestions after first use
  document.getElementById('suggestions').style.display = 'none';

  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendBtn.disabled = true;

  addMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  // Thinking indicator
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'msg assistant';
  thinkingDiv.innerHTML = '<div class="thinking-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span style="margin-left:6px">Claude is thinking…</span></div>';
  messagesEl.appendChild(thinkingDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  let responseText = '';
  let responseBubble = null;

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const evt = JSON.parse(payload);

          if (evt.type === 'sources') {
            showSources(evt.sources);
          } else if (evt.type === 'text') {
            if (!responseBubble) {
              thinkingDiv.remove();
              const msgDiv = document.createElement('div');
              msgDiv.className = 'msg assistant';
              responseBubble = document.createElement('div');
              responseBubble.className = 'msg-bubble';
              msgDiv.appendChild(responseBubble);
              messagesEl.appendChild(msgDiv);
            }
            responseText += evt.text;
            responseBubble.innerHTML = renderMarkdown(responseText);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          } else if (evt.type === 'done') {
            conversationHistory.push({ role: 'assistant', content: responseText });
          } else if (evt.type === 'error') {
            thinkingDiv.remove();
            addMessage('assistant', '⚠️ ' + evt.text);
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    thinkingDiv.remove();
    addMessage('assistant', '⚠️ Connection error: ' + err.message);
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}
</script>
""",
)


# ── Chat routes ───────────────────────────────────────────────────────────────

@app.route("/chat")
def chat():
    return render(CHAT_TEMPLATE, page="chat")


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(silent=True) or {}
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    # Validate roles
    valid = [m for m in messages if m.get("role") in ("user", "assistant") and m.get("content")]
    if not valid:
        return jsonify({"error": "Invalid message format"}), 400

    def generate():
        yield from _stream_claude(valid)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from scanner import init_db

    init_db()
    port = int(os.environ.get("PORT", 5055))
    print(f"Household Dashboard running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
