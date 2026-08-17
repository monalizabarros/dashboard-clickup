#!/bin/bash
# Agenda o backup.sh para rodar automaticamente TODO DIA às 03:00,
# usando launchd (o agendador nativo do macOS — mais confiável que cron no Mac).
# Roda independente do servidor estar ligado ou não.
#
# Uso: ./install_backup_schedule.sh
# Para desinstalar: launchctl unload ~/Library/LaunchAgents/com.3wings.painelbackup.plist

set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.3wings.painelbackup.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"
LOG_DIR="$PROJECT_DIR/backend/backups"

mkdir -p "$LOG_DIR"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.3wings.painelbackup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$PROJECT_DIR/backup.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>12</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/backup.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/backup-erro.log</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF

# recarrega (unload silencioso ignora erro se ainda não existia)
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "✅ Backup automático agendado: todo dia às 12:00."
echo "   Arquivo: $PLIST_PATH"
echo "   Logs em: $LOG_DIR/backup.log"
echo ""
echo "   Seu Mac precisa estar ligado (pode estar dormindo) nesse horário para rodar."
echo "   Para testar agora, sem esperar até de madrugada: ./backup.sh"
echo "   Para desativar: launchctl unload $PLIST_PATH"
