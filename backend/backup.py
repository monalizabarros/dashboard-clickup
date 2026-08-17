"""
Backup do dashboard.db, disparável pela interface (botão "Backup agora").
Usa sqlite3.backup(), o mesmo mecanismo seguro do comando .backup do CLI —
funciona com o banco em uso, sem travar nem corromper.

O backup agendado automático (diário, independente do servidor estar ligado)
é feito por backup.sh + launchd — ver install_backup_schedule.sh.
"""
from __future__ import annotations
import os
import sqlite3
import shutil
from datetime import datetime

import database as db
import gdrive_upload as gdrive

LOCAL_DIR = os.path.join(os.path.dirname(db.DB_PATH) or ".", "backups") if os.path.dirname(db.DB_PATH) else "backups"
KEEP_LOCAL = 30
KEEP_DRIVE = 30


def _prune(directory: str, keep: int):
    if not os.path.isdir(directory):
        return
    files = sorted(
        (f for f in os.listdir(directory) if f.startswith("dashboard-") and f.endswith(".db")),
        key=lambda f: os.path.getmtime(os.path.join(directory, f)),
        reverse=True,
    )
    for old in files[keep:]:
        os.remove(os.path.join(directory, old))


def run_backup() -> dict:
    os.makedirs(LOCAL_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d_%H%M%S_%f")
    dest_path = os.path.join(LOCAL_DIR, f"dashboard-{ts}.db")

    src = sqlite3.connect(db.DB_PATH)
    dst = sqlite3.connect(dest_path)
    with dst:
        src.backup(dst)
    dst.close()
    src.close()

    _prune(LOCAL_DIR, KEEP_LOCAL)

    result = {
        "file": os.path.basename(dest_path),
        "local_dir": os.path.abspath(LOCAL_DIR),
        "gdrive_copied": False,
        "gdrive_error": None,
        "gdrive_method": None,
        "timestamp": ts,
    }

    # Método preferido: upload direto via API (funciona sem nenhum app instalado,
    # e funciona igual num servidor sem interface gráfica).
    if gdrive.is_configured():
        result["gdrive_method"] = "api"
        try:
            gdrive.upload_file(dest_path, os.getenv("GDRIVE_FOLDER_ID"))
            gdrive.prune_drive(os.getenv("GDRIVE_FOLDER_ID"), KEEP_DRIVE)
            result["gdrive_copied"] = True
        except Exception as e:
            result["gdrive_error"] = str(e)
        return result

    # Alternativa: pasta local sincronizada pelo Google Drive Desktop (se configurada).
    gdrive_dir = os.getenv("GDRIVE_BACKUP_DIR")
    if gdrive_dir:
        result["gdrive_method"] = "folder_sync"
        if os.path.isdir(gdrive_dir):
            shutil.copy(dest_path, gdrive_dir)
            _prune(gdrive_dir, KEEP_DRIVE)
            result["gdrive_copied"] = True
        else:
            result["gdrive_error"] = f"Pasta configurada não existe: {gdrive_dir}"

    return result


def backup_status() -> dict:
    """Info do último backup local e no Drive, para exibir na interface."""
    def latest_local(directory):
        if not directory or not os.path.isdir(directory):
            return None
        files = [f for f in os.listdir(directory) if f.startswith("dashboard-") and f.endswith(".db")]
        if not files:
            return None
        newest = max(files, key=lambda f: os.path.getmtime(os.path.join(directory, f)))
        mtime = os.path.getmtime(os.path.join(directory, newest))
        return {"file": newest, "when": datetime.fromtimestamp(mtime).isoformat()}

    local = latest_local(LOCAL_DIR)

    if gdrive.is_configured():
        try:
            files = gdrive.list_backup_files(os.getenv("GDRIVE_FOLDER_ID"))
            gdrive_latest = (
                {"file": files[0]["name"], "when": files[0]["createdTime"]} if files else None
            )
            return {"local": local, "gdrive": gdrive_latest, "gdrive_configured": True, "gdrive_method": "api"}
        except Exception as e:
            return {"local": local, "gdrive": None, "gdrive_configured": True, "gdrive_method": "api", "gdrive_error": str(e)}

    gdrive_dir = os.getenv("GDRIVE_BACKUP_DIR")
    if gdrive_dir:
        return {
            "local": local,
            "gdrive": latest_local(gdrive_dir),
            "gdrive_configured": True,
            "gdrive_method": "folder_sync",
        }

    return {"local": local, "gdrive": None, "gdrive_configured": False, "gdrive_method": None}
