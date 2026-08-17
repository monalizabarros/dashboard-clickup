#!/usr/bin/env python3
"""
Chamado pelo backup.sh depois de criar o backup local: envia o arquivo pro
Google Drive via API (se GDRIVE_CREDENTIALS_PATH e GDRIVE_FOLDER_ID estiverem
configurados no .env). Sem essas variáveis, não faz nada (silenciosamente).
"""
from __future__ import annotations
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

import gdrive_upload as gdrive


def main():
    if len(sys.argv) < 2:
        print("uso: upload_cli.py <caminho_do_arquivo>")
        sys.exit(1)
    path = sys.argv[1]

    if not gdrive.is_configured():
        print("ℹ️  GDRIVE_CREDENTIALS_PATH/GDRIVE_FOLDER_ID não configurados — pulando envio ao Drive.")
        return

    folder_id = os.getenv("GDRIVE_FOLDER_ID")
    keep = int(os.getenv("GDRIVE_KEEP", "30"))
    try:
        f = gdrive.upload_file(path, folder_id)
        print(f"☁️  Enviado ao Google Drive: {f['name']}")
        removed = gdrive.prune_drive(folder_id, keep)
        if removed:
            print(f"🧹 Rotação no Drive: {removed} backup(s) antigo(s) removido(s).")
    except Exception as e:
        print(f"⚠️  Falha ao enviar pro Drive (o backup local foi criado normalmente): {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
