"""
Upload de backups para o Google Drive, via API, autenticado com uma CONTA
PESSOAL (OAuth) — não uma conta de serviço.

Por quê: contas de serviço não têm cota de armazenamento própria em contas
Google gratuitas/pessoais (só em Google Workspace pago), então elas não
conseguem criar arquivos novos mesmo com a pasta compartilhada como Editor
(erro "storageQuotaExceeded"). A autenticação via conta pessoal usa a cota
normal da sua conta.

Fluxo:
  1. Uma vez, rode `python3 gdrive_auth_setup.py` — abre o navegador, você
     autoriza, e um arquivo de token (refresh token) é salvo.
  2. Dali em diante, os uploads renovam esse token sozinhos, sem precisar
     abrir o navegador de novo.

Configuração (ver docs/BACKUP_GOOGLE_DRIVE.md):
  GDRIVE_OAUTH_CLIENT_SECRET = caminho do client_secret.json (OAuth Client ID, tipo "App para computador")
  GDRIVE_OAUTH_TOKEN_PATH    = caminho onde o token fica salvo (padrão: gdrive-token.json ao lado do client secret)
  GDRIVE_FOLDER_ID           = ID da pasta no Drive (na sua própria conta — não precisa compartilhar com ninguém)
"""
from __future__ import annotations
import os

SCOPES = ["https://www.googleapis.com/auth/drive"]


def _token_path() -> str:
    explicit = os.getenv("GDRIVE_OAUTH_TOKEN_PATH")
    if explicit:
        return explicit
    client_secret = os.getenv("GDRIVE_OAUTH_CLIENT_SECRET", "")
    base_dir = os.path.dirname(client_secret) or "."
    return os.path.join(base_dir, "gdrive-token.json")


def is_configured() -> bool:
    return bool(os.getenv("GDRIVE_OAUTH_CLIENT_SECRET") and os.getenv("GDRIVE_FOLDER_ID"))


def is_authorized() -> bool:
    """True se já existe um token salvo (passo único feito via gdrive_auth_setup.py)."""
    return os.path.isfile(_token_path())


def _get_credentials():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    token_path = _token_path()
    if not os.path.isfile(token_path):
        raise RuntimeError(
            "Google Drive ainda não autorizado. Rode uma vez no terminal: "
            "python3 gdrive_auth_setup.py (dentro da pasta backend, com a venv ativa)."
        )

    creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(token_path, "w") as f:
            f.write(creds.to_json())
    if not creds or not creds.valid:
        raise RuntimeError(
            "Autorização do Google Drive expirou ou é inválida. Rode de novo: "
            "python3 gdrive_auth_setup.py"
        )
    return creds


def _get_service():
    from googleapiclient.discovery import build

    creds = _get_credentials()
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def upload_file(local_path: str, folder_id: str) -> dict:
    from googleapiclient.http import MediaFileUpload

    service = _get_service()
    metadata = {"name": os.path.basename(local_path), "parents": [folder_id]}
    media = MediaFileUpload(local_path, mimetype="application/octet-stream", resumable=False)
    return (
        service.files()
        .create(body=metadata, media_body=media, fields="id,name,createdTime")
        .execute()
    )


def list_backup_files(folder_id: str) -> list[dict]:
    service = _get_service()
    files: list[dict] = []
    page_token = None
    while True:
        resp = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed = false and name contains 'dashboard-'",
                fields="nextPageToken, files(id, name, createdTime)",
                orderBy="createdTime desc",
                pageToken=page_token,
                pageSize=100,
            )
            .execute()
        )
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def prune_drive(folder_id: str, keep: int) -> int:
    """Apaga os backups mais antigos no Drive, mantendo só os `keep` mais recentes."""
    service = _get_service()
    files = list_backup_files(folder_id)
    removed = 0
    for f in files[keep:]:
        service.files().delete(fileId=f["id"]).execute()
        removed += 1
    return removed
