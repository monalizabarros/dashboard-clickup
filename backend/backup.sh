#!/bin/bash
# Backup do banco do Painel de Acompanhamento (dashboard.db).
# Usa o comando nativo do SQLite (.backup) — seguro mesmo com o banco em uso.
# Roda sozinho, não depende do servidor (uvicorn) estar no ar.
#
# Uso manual:   ./backup.sh
# Uso agendado: instalado via install_backup_schedule.sh (launchd, roda 1x/dia)

set -e
cd "$(dirname "$0")/backend"

DB="dashboard.db"
LOCAL_DIR="backups"
KEEP_LOCAL=30   # quantas cópias locais manter
KEEP_DRIVE=30   # quantas cópias manter na pasta do Drive

if [ ! -f "$DB" ]; then
  echo "⚠️  $DB não encontrado em $(pwd) — nada para fazer backup ainda (rode o app pelo menos uma vez)."
  exit 0
fi

mkdir -p "$LOCAL_DIR"
TS=$(date +%Y-%m-%d_%H%M%S)_$RANDOM
DEST="$LOCAL_DIR/dashboard-$TS.db"

# .backup é atômico e seguro mesmo com o servidor escrevendo no banco ao mesmo tempo
sqlite3 "$DB" ".backup '$DEST'"
echo "✅ Backup local criado: $DEST"

# rotação: mantém só as N cópias mais recentes
ls -1t "$LOCAL_DIR"/dashboard-*.db 2>/dev/null | tail -n +$((KEEP_LOCAL + 1)) | xargs -r rm --
echo "🧹 Rotação local: mantendo as últimas $KEEP_LOCAL cópias."

# envio pro Google Drive: via API (preferido) ou pasta sincronizada (alternativa)
if [ -f venv/bin/python3 ]; then
  PY="venv/bin/python3"
else
  PY="python3"
fi

if [ -f .env ]; then
  GDRIVE_OAUTH_CLIENT_SECRET=$(grep -E '^GDRIVE_OAUTH_CLIENT_SECRET=' .env | tail -1 | cut -d'=' -f2-)
  GDRIVE_FOLDER_ID=$(grep -E '^GDRIVE_FOLDER_ID=' .env | tail -1 | cut -d'=' -f2-)
  GDRIVE_BACKUP_DIR=$(grep -E '^GDRIVE_BACKUP_DIR=' .env | tail -1 | cut -d'=' -f2-)
fi

if [ -n "$GDRIVE_OAUTH_CLIENT_SECRET" ] && [ -n "$GDRIVE_FOLDER_ID" ]; then
  "$PY" upload_cli.py "$DEST"
elif [ -n "$GDRIVE_BACKUP_DIR" ]; then
  if [ -d "$GDRIVE_BACKUP_DIR" ]; then
    cp "$DEST" "$GDRIVE_BACKUP_DIR/"
    ls -1t "$GDRIVE_BACKUP_DIR"/dashboard-*.db 2>/dev/null | tail -n +$((KEEP_DRIVE + 1)) | xargs -r rm --
    echo "☁️  Copiado para o Google Drive (pasta sincronizada): $GDRIVE_BACKUP_DIR"
  else
    echo "⚠️  GDRIVE_BACKUP_DIR configurado mas a pasta não existe: $GDRIVE_BACKUP_DIR"
  fi
else
  echo "ℹ️  Backup na nuvem não configurado no backend/.env — ficou só local."
fi
