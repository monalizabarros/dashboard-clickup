#!/usr/bin/env python3
"""
Rode este script UMA VEZ para autorizar o painel a enviar backups pra sua
conta pessoal do Google Drive. Abre uma janela do navegador para você fazer
login e aceitar a permissão — depois disso, o token fica salvo e os próximos
backups não precisam mais de navegador nenhum.

Uso:
  cd backend
  source venv/bin/activate
  python3 gdrive_auth_setup.py
"""
from __future__ import annotations
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

from gdrive_upload import SCOPES, _token_path


def main():
    client_secret = os.getenv("GDRIVE_OAUTH_CLIENT_SECRET")
    if not client_secret or not os.path.isfile(client_secret):
        print(f"❌ GDRIVE_OAUTH_CLIENT_SECRET não configurado ou arquivo não existe: {client_secret!r}")
        print("   Confira o backend/.env — veja docs/BACKUP_GOOGLE_DRIVE.md para o passo a passo.")
        sys.exit(1)

    from google_auth_oauthlib.flow import InstalledAppFlow

    print("Abrindo o navegador para você autorizar o acesso ao Google Drive...")
    print("(faça login com a conta onde quer guardar os backups e aceite a permissão)")

    flow = InstalledAppFlow.from_client_secrets_file(client_secret, SCOPES)
    creds = flow.run_local_server(port=0)

    token_path = _token_path()
    with open(token_path, "w") as f:
        f.write(creds.to_json())

    print(f"\n✅ Autorizado! Token salvo em: {token_path}")
    print("   A partir de agora, ./backup.sh e o botão 'Backup agora' funcionam sozinhos,")
    print("   sem precisar abrir o navegador de novo (a menos que a autorização seja revogada).")


if __name__ == "__main__":
    main()
