from __future__ import annotations
import sqlite3
import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta

DB_PATH = os.getenv("DASHBOARD_DB_PATH", "dashboard.db")
SESSION_HOURS = 12


def get_conn():
    # timeout maior: absorve escritas concorrentes (ex: duplo clique) sem estourar "database is locked"
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    # SQLite não aplica ON DELETE CASCADE/SET NULL a menos que isso seja ligado por conexão
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# ---------------- Schema / migração ----------------

def init_db():
    conn = get_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS dashboards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            list_id TEXT NOT NULL,
            config TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin','leitor')),
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL
        )
        """
    )
    # migração: colunas de dono/editores em bancos antigos
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(dashboards)").fetchall()]
    if "created_by" not in cols:
        conn.execute("ALTER TABLE dashboards ADD COLUMN created_by INTEGER")  # NULL = sistema
    if "editors" not in cols:
        conn.execute("ALTER TABLE dashboards ADD COLUMN editors TEXT DEFAULT '[]'")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS collaborators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            clickup_user_id TEXT NOT NULL UNIQUE,
            team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
            hourly_rate REAL NOT NULL DEFAULT 0,
            capacity_hours_day REAL NOT NULL DEFAULT 8,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS time_off (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collaborator_id INTEGER NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
            type TEXT NOT NULL CHECK (type IN ('folga','ferias')),
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL
        )
        """
    )
    n_teams = conn.execute("SELECT COUNT(*) c FROM teams").fetchone()["c"]
    if n_teams == 0:
        conn.executemany(
            "INSERT INTO teams (name) VALUES (?)",
            [("DEV",), ("IA",), ("Projetos",), ("Suporte",), ("Produto",)],
        )

    conn.commit()
    conn.close()


# ---------------- Senhas / usuários ----------------

def _hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 100_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return secrets.compare_digest(_hash_password(password, salt), stored)


def create_user(username: str, password: str, role: str) -> int:
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)",
        (username.strip(), _hash_password(password), role, datetime.utcnow().isoformat()),
    )
    conn.commit()
    uid = cur.lastrowid
    conn.close()
    return uid


def get_user_by_username(username: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username.strip(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user(user_id: int) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_users() -> list[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT id, username, role, created_at FROM users ORDER BY username").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_user(user_id: int) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()


def update_password(user_id: int, new_password: str) -> None:
    conn = get_conn()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (_hash_password(new_password), user_id))
    conn.commit()
    conn.close()


def count_admins() -> int:
    conn = get_conn()
    n = conn.execute("SELECT COUNT(*) c FROM users WHERE role='admin'").fetchone()["c"]
    conn.close()
    return n


def seed_admin():
    """Cria a usuária admin inicial (Monaliza) se não existir nenhum usuário."""
    conn = get_conn()
    n = conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
    conn.close()
    if n == 0:
        create_user("Monaliza", "monaliza", "admin")


# ---------------- Sessões ----------------

def create_session(user_id: int) -> str:
    token = secrets.token_hex(32)
    expires = (datetime.utcnow() + timedelta(hours=SESSION_HOURS)).isoformat()
    conn = get_conn()
    conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)", (token, user_id, expires))
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (datetime.utcnow().isoformat(),))
    conn.commit()
    conn.close()
    return token


def get_session_user(token: str) -> dict | None:
    if not token:
        return None
    conn = get_conn()
    row = conn.execute(
        """SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = ? AND s.expires_at > ?""",
        (token, datetime.utcnow().isoformat()),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_session(token: str) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()


# ---------------- Dashboards ----------------

def save_dashboard(
    name: str,
    list_id: str,
    config: dict,
    dashboard_id: int | None = None,
    created_by: int | None = None,
) -> int:
    conn = get_conn()
    now = datetime.utcnow().isoformat()
    config_json = json.dumps(config, ensure_ascii=False)
    if dashboard_id:
        conn.execute(
            "UPDATE dashboards SET name=?, list_id=?, config=?, updated_at=? WHERE id=?",
            (name, list_id, config_json, now, dashboard_id),
        )
        new_id = dashboard_id
    else:
        cur = conn.execute(
            "INSERT INTO dashboards (name, list_id, config, created_at, updated_at, created_by, editors) VALUES (?,?,?,?,?,?,'[]')",
            (name, list_id, config_json, now, now, created_by),
        )
        new_id = cur.lastrowid
    conn.commit()
    conn.close()
    return new_id


def list_dashboards() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT d.id, d.name, d.list_id, d.updated_at, d.created_by, d.editors,
                  u.username AS creator_name
           FROM dashboards d LEFT JOIN users u ON u.id = d.created_by
           ORDER BY d.updated_at DESC"""
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["editors"] = json.loads(d.get("editors") or "[]")
        out.append(d)
    return out


def get_dashboard(dashboard_id: int) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM dashboards WHERE id=?", (dashboard_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["config"] = json.loads(d["config"])
    d["editors"] = json.loads(d.get("editors") or "[]")
    return d


def set_editors(dashboard_id: int, editor_ids: list[int]) -> None:
    conn = get_conn()
    conn.execute(
        "UPDATE dashboards SET editors=? WHERE id=?",
        (json.dumps(sorted(set(int(e) for e in editor_ids))), dashboard_id),
    )
    conn.commit()
    conn.close()


def delete_dashboard(dashboard_id: int) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM dashboards WHERE id=?", (dashboard_id,))
    conn.commit()
    conn.close()


# ---------------- Snapshots semanais ----------------

def init_snapshots():
    conn = get_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_start TEXT NOT NULL,
            produto TEXT NOT NULL,
            categoria TEXT NOT NULL,
            tipo_suporte TEXT NOT NULL,
            tipo_registro TEXT NOT NULL,
            colaborador TEXT NOT NULL,
            horas REAL NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_snapshots_week ON snapshots(week_start)")
    conn.commit()
    conn.close()


def snapshot_weeks() -> list[str]:
    conn = get_conn()
    rows = conn.execute("SELECT DISTINCT week_start FROM snapshots ORDER BY week_start").fetchall()
    conn.close()
    return [r["week_start"] for r in rows]


def replace_week_snapshot(week_start: str, rows: list[dict]) -> None:
    conn = get_conn()
    now = datetime.utcnow().isoformat()
    conn.execute("DELETE FROM snapshots WHERE week_start = ?", (week_start,))
    conn.executemany(
        """INSERT INTO snapshots (week_start, produto, categoria, tipo_suporte, tipo_registro, colaborador, horas, created_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        [
            (r["week_start"], r["produto"], r["categoria"], r["tipo_suporte"],
             r["tipo_registro"], r["colaborador"], r["horas"], now)
            for r in rows
        ],
    )
    conn.commit()
    conn.close()


def get_snapshots(start: str | None = None, end: str | None = None) -> list[dict]:
    conn = get_conn()
    query = "SELECT week_start, produto, categoria, tipo_suporte, tipo_registro, colaborador, horas FROM snapshots"
    clauses, params = [], []
    if start:
        clauses.append("week_start >= ?"); params.append(start)
    if end:
        clauses.append("week_start <= ?"); params.append(end)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY week_start"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------------- Times / colaboradores / folgas ----------------

def list_teams() -> list[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM teams ORDER BY name COLLATE NOCASE").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_team(name: str) -> int:
    conn = get_conn()
    cur = conn.execute("INSERT INTO teams (name) VALUES (?)", (name.strip(),))
    conn.commit()
    tid = cur.lastrowid
    conn.close()
    return tid


def list_collaborators() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT c.*, t.name AS team_name
        FROM collaborators c
        LEFT JOIN teams t ON t.id = c.team_id
        ORDER BY c.name COLLATE NOCASE
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_collaborator(name: str, clickup_user_id: str, team_id: int | None,
                         hourly_rate: float, capacity_hours_day: float) -> int:
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO collaborators (name, clickup_user_id, team_id, hourly_rate, capacity_hours_day, created_at)
           VALUES (?,?,?,?,?,?)""",
        (name.strip(), str(clickup_user_id), team_id, hourly_rate, capacity_hours_day, datetime.utcnow().isoformat()),
    )
    conn.commit()
    cid = cur.lastrowid
    conn.close()
    return cid


def update_collaborator(collab_id: int, team_id: int | None, hourly_rate: float, capacity_hours_day: float) -> None:
    conn = get_conn()
    conn.execute(
        "UPDATE collaborators SET team_id = ?, hourly_rate = ?, capacity_hours_day = ? WHERE id = ?",
        (team_id, hourly_rate, capacity_hours_day, collab_id),
    )
    conn.commit()
    conn.close()


def delete_collaborator(collab_id: int) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM collaborators WHERE id = ?", (collab_id,))
    conn.commit()
    conn.close()


def list_time_off() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT time_off.*, c.name AS collaborator_name
        FROM time_off
        JOIN collaborators c ON c.id = time_off.collaborator_id
        ORDER BY start_date DESC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_time_off(collaborator_id: int, off_type: str, start_date: str, end_date: str) -> int:
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO time_off (collaborator_id, type, start_date, end_date) VALUES (?,?,?,?)",
        (collaborator_id, off_type, start_date, end_date),
    )
    conn.commit()
    tid = cur.lastrowid
    conn.close()
    return tid


def delete_time_off(time_off_id: int) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM time_off WHERE id = ?", (time_off_id,))
    conn.commit()
    conn.close()
