"""
Household Management Dashboard — Flask web app.

Routes:
  GET /              — Main dashboard with category cards
  GET /documents     — Document browser (all categories or filtered)
  GET /documents/<category> — Documents for a specific category
  GET /api/documents — JSON API for documents
  GET /api/stats     — JSON stats summary
  POST /api/scan     — Trigger email scan
"""

import os
import sqlite3
from datetime import datetime, timedelta, date
from pathlib import Path

from flask import Flask, jsonify, render_template_string, request, redirect, url_for

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

    return {
        "total": total,
        "with_drive": with_drive,
        "pending": pending,
        "flags": flags,
        "due_soon": due_soon,
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


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from scanner import init_db

    init_db()
    port = int(os.environ.get("PORT", 5055))
    print(f"Household Dashboard running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
