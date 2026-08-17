#!/bin/bash
# Agenda o backup.sh para rodar automaticamente TODO DIA às 03:00, via cron.
# Use esta versão em servidor Linux (produção). No Mac local, use
# install_backup_schedule_mac.sh (launchd) em vez deste.
#
# Uso: ./install_backup_schedule_linux.sh
# Para desinstalar: crontab -e   (e apague a linha marcada abaixo)

set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MARKER="# painel-backup (3wings)"
CRON_LINE="0 3 * * * /bin/bash $PROJECT_DIR/backup.sh >> $PROJECT_DIR/backend/backups/backup.log 2>&1 $MARKER"

mkdir -p "$PROJECT_DIR/backend/backups"

# remove uma entrada antiga marcada (se existir) e adiciona a nova, sem duplicar
( crontab -l 2>/dev/null | grep -v "$MARKER" ; echo "$CRON_LINE" ) | crontab -

echo "✅ Backup automático agendado via cron: todo dia às 03:00."
echo "   Logs em: $PROJECT_DIR/backend/backups/backup.log"
echo ""
echo "   Conferir: crontab -l"
echo "   Para testar agora, sem esperar: $PROJECT_DIR/backup.sh"
echo "   Para desativar: crontab -e   (apague a linha com '$MARKER')"
