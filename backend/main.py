from __future__ import annotations
import os
import sqlite3
from dotenv import load_dotenv

load_dotenv()  # lê backend/.env se existir (não sobrescreve variáveis já exportadas no shell)

from fastapi import FastAPI, HTTPException, Query, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional
from pydantic import BaseModel

from clickup_client import ClickUpClient, ClickUpError
import database as db
import snapshots as snap
import backup as backup_mod

app = FastAPI(title="ClickUp Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_COOKIE = "painel_session"

# ---------- Cache das consultas ao ClickUp ----------
# Evita bater na API a cada usuário/carregamento; TTL configurável via env.
import time as _time
from datetime import datetime as _dt

CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "600"))  # 10 min padrão
_cache: dict = {}


def cached(key: str, force: bool, fn):
    """Retorna (dados, cached_at_iso). force=True ignora e renova o cache."""
    now = _time.time()
    if not force and key in _cache:
        ts, data = _cache[key]
        if now - ts < CACHE_TTL:
            return data, _dt.fromtimestamp(ts).isoformat()
    data = fn()
    _cache[key] = (now, data)
    return data, _dt.fromtimestamp(now).isoformat()


# ---------- Autenticação ----------

def current_user(request: Request) -> dict:
    user = db.get_session_user(request.cookies.get(SESSION_COOKIE, ""))
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user


def admin_only(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    return user


class LoginIn(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
def login(payload: LoginIn, response: Response):
    user = db.get_user_by_username(payload.username)
    if not user or not db.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    token = db.create_session(user["id"])
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", max_age=12 * 3600)
    return {"id": user["id"], "username": user["username"], "role": user["role"]}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    db.delete_session(request.cookies.get(SESSION_COOKIE, ""))
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)):
    return {"id": user["id"], "username": user["username"], "role": user["role"]}


# ---------- Usuários (somente admin) ----------

class UserIn(BaseModel):
    username: str
    password: str
    role: str  # 'admin' | 'leitor'


class PasswordIn(BaseModel):
    password: str


@app.get("/api/users")
def api_list_users(user: dict = Depends(current_user)):
    # todos podem listar (necessário para atribuir editores); senhas nunca saem
    return db.list_users()


@app.post("/api/users")
def api_create_user(payload: UserIn, admin: dict = Depends(admin_only)):
    if payload.role not in ("admin", "leitor"):
        raise HTTPException(status_code=422, detail="Papel deve ser 'admin' ou 'leitor'")
    if len(payload.password) < 4:
        raise HTTPException(status_code=422, detail="Senha muito curta (mínimo 4 caracteres)")
    if db.get_user_by_username(payload.username):
        raise HTTPException(status_code=409, detail="Usuário já existe")
    uid = db.create_user(payload.username, payload.password, payload.role)
    return {"id": uid}


@app.delete("/api/users/{user_id}")
def api_delete_user(user_id: int, admin: dict = Depends(admin_only)):
    target = db.get_user(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if target["id"] == admin["id"]:
        raise HTTPException(status_code=422, detail="Você não pode excluir a si mesma(o)")
    if target["role"] == "admin" and db.count_admins() <= 1:
        raise HTTPException(status_code=422, detail="Não é possível excluir o último admin")
    db.delete_user(user_id)
    return {"ok": True}


@app.post("/api/users/{user_id}/password")
def api_reset_password(user_id: int, payload: PasswordIn, admin: dict = Depends(admin_only)):
    if not db.get_user(user_id):
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if len(payload.password) < 4:
        raise HTTPException(status_code=422, detail="Senha muito curta (mínimo 4 caracteres)")
    db.update_password(user_id, payload.password)
    return {"ok": True}


# ---------- Colaboradores / times / folgas (configuração, somente admin escreve) ----------

class TeamIn(BaseModel):
    name: str


class CollaboratorIn(BaseModel):
    name: str
    clickup_user_id: str
    team_id: int | None = None
    hourly_rate: float = 0
    capacity_hours_day: float = 8


class CollaboratorUpdate(BaseModel):
    team_id: int | None = None
    hourly_rate: float = 0
    capacity_hours_day: float = 8


class TimeOffIn(BaseModel):
    collaborator_id: int
    type: str  # 'folga' | 'ferias'
    start_date: str
    end_date: str


@app.get("/api/collaborators/clickup-members")
def api_clickup_members(team_id: str = Query(...), admin: dict = Depends(admin_only)):
    """Membros do workspace no ClickUp, para o seletor de 'novo colaborador'."""
    client = get_client()
    try:
        members = client.get_team_members(team_id)
    except ClickUpError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return [
        {"id": m.get("id"), "username": m.get("username"), "email": m.get("email")}
        for m in members
        if m.get("id")
    ]


@app.get("/api/teams")
def api_list_teams(user: dict = Depends(current_user)):
    return db.list_teams()


@app.post("/api/teams")
def api_create_team(payload: TeamIn, admin: dict = Depends(admin_only)):
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Nome do time não pode ser vazio")
    try:
        tid = db.create_team(payload.name)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Já existe um time com esse nome")
    return {"id": tid}


@app.get("/api/collaborators")
def api_list_collaborators(user: dict = Depends(current_user)):
    rows = db.list_collaborators()
    if user["role"] != "admin":
        # valor/hora é sensível (revela custo por pessoa) — não sai da API pra quem não é admin
        for r in rows:
            r.pop("hourly_rate", None)
    return rows


@app.post("/api/collaborators")
def api_create_collaborator(payload: CollaboratorIn, admin: dict = Depends(admin_only)):
    try:
        cid = db.create_collaborator(
            payload.name, payload.clickup_user_id, payload.team_id,
            payload.hourly_rate, payload.capacity_hours_day,
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Esse colaborador já está cadastrado")
    return {"id": cid}


@app.put("/api/collaborators/{collab_id}")
def api_update_collaborator(collab_id: int, payload: CollaboratorUpdate, admin: dict = Depends(admin_only)):
    db.update_collaborator(collab_id, payload.team_id, payload.hourly_rate, payload.capacity_hours_day)
    return {"ok": True}


@app.delete("/api/collaborators/{collab_id}")
def api_delete_collaborator(collab_id: int, admin: dict = Depends(admin_only)):
    db.delete_collaborator(collab_id)
    return {"ok": True}


@app.get("/api/time-off")
def api_list_time_off(user: dict = Depends(current_user)):
    return db.list_time_off()


@app.post("/api/time-off")
def api_create_time_off(payload: TimeOffIn, admin: dict = Depends(admin_only)):
    if payload.type not in ("folga", "ferias"):
        raise HTTPException(status_code=422, detail="Tipo deve ser 'folga' ou 'ferias'")
    tid = db.create_time_off(payload.collaborator_id, payload.type, payload.start_date, payload.end_date)
    return {"id": tid}


@app.delete("/api/time-off/{time_off_id}")
def api_delete_time_off(time_off_id: int, admin: dict = Depends(admin_only)):
    db.delete_time_off(time_off_id)
    return {"ok": True}


# ---------- Regras de permissão de visualizações ----------

def can_edit_dashboard(dash: dict, user: dict) -> bool:
    if user["role"] == "admin":
        return True
    if dash.get("created_by") is None:  # painel de fábrica: só admin edita
        return False
    return dash["created_by"] == user["id"] or user["id"] in dash.get("editors", [])


def can_delete_dashboard(dash: dict, user: dict) -> bool:
    if user["role"] == "admin":
        return True
    return dash.get("created_by") == user["id"]


def can_manage_editors(dash: dict, user: dict) -> bool:
    if user["role"] == "admin":
        return True
    return dash.get("created_by") == user["id"]


DEFAULT_DASHBOARD_NAME = "Painel Executivo · Horas"

DEFAULT_DASHBOARD_CONFIG = {
    "listIds": [],  # não fixa listas: usa a seleção atual da árvore
    "period": {"preset": "this_month", "start": "", "end": "",
               "criteria": {"created": True, "closed": True, "hours": True}},
    "widgets": [
        {"title": "Total de horas rastreadas", "chartType": "kpi", "metric": "tt_hours",
         "agg": "sum", "dim1": "smart_categoria", "dim2": "", "dim3": ""},
        {"title": "Distribuição por categoria (Departamento)", "chartType": "pie", "metric": "tt_hours",
         "agg": "sum", "dim1": "smart_categoria", "dim2": "", "dim3": ""},
        {"title": "Horas por produto e categoria", "chartType": "bar", "metric": "tt_hours",
         "agg": "sum", "dim1": "smart_produto", "dim2": "smart_categoria", "dim3": ""},
        {"title": "Suporte por produto e tipo", "chartType": "bar", "metric": "tt_hours",
         "agg": "sum", "dim1": "smart_produto", "dim2": "smart_tipo_suporte", "dim3": ""},
        {"title": "Horas por colaborador", "chartType": "bar", "metric": "tt_hours",
         "agg": "sum", "dim1": "entry_user", "dim2": "", "dim3": ""},
        {"title": "Alocação: colaborador × produto", "chartType": "bar", "metric": "tt_hours",
         "agg": "sum", "dim1": "entry_user", "dim2": "smart_produto", "dim3": ""},
        {"title": "Detalhamento: produto × tipo de suporte × colaborador", "chartType": "table",
         "metric": "tt_hours", "agg": "sum",
         "dim1": "smart_produto", "dim2": "smart_tipo_suporte", "dim3": "entry_user"},
        {"title": "Resumo executivo: destino das horas", "chartType": "table",
         "metric": "tt_hours", "agg": "sum",
         "dim1": "smart_categoria", "dim2": "smart_produto", "dim3": ""},
    ],
}


def seed_default_dashboard():
    existing = db.list_dashboards()
    if any(d["name"] == DEFAULT_DASHBOARD_NAME for d in existing):
        return
    db.save_dashboard(DEFAULT_DASHBOARD_NAME, "", DEFAULT_DASHBOARD_CONFIG)


@app.on_event("startup")
def startup():
    db.init_db()
    db.init_snapshots()
    db.seed_admin()
    seed_default_dashboard()
    if os.getenv("DISABLE_SNAPSHOT_SCHEDULER") != "1":
        snap.start_scheduler()


def get_client() -> ClickUpClient:
    try:
        return ClickUpClient()
    except ClickUpError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Hierarquia (Teams > Spaces > Folders > Lists) ----------

@app.get("/api/hierarchy")
def get_hierarchy(force: bool = Query(False), user: dict = Depends(current_user)):
    client = get_client()
    try:
        def build():
            return _build_hierarchy(client)
        tree, cached_at = cached("hierarchy", force, build)
        return {"teams": tree, "cached_at": cached_at}
    except ClickUpError as e:
        raise HTTPException(status_code=502, detail=str(e))


def _build_hierarchy(client: ClickUpClient) -> list:
    try:
        teams = client.get_teams()
        tree = []
        for team in teams:
            team_node = {"id": team["id"], "name": team["name"], "spaces": []}
            spaces = client.get_spaces(team["id"])
            for space in spaces:
                space_node = {"id": space["id"], "name": space["name"], "folders": [], "lists": []}
                folders = client.get_folders(space["id"])
                for folder in folders:
                    folder_lists = client.get_lists(folder["id"])
                    space_node["folders"].append(
                        {
                            "id": folder["id"],
                            "name": folder["name"],
                            "lists": [{"id": l["id"], "name": l["name"]} for l in folder_lists],
                        }
                    )
                folderless = client.get_folderless_lists(space["id"])
                space_node["lists"] = [{"id": l["id"], "name": l["name"]} for l in folderless]
                team_node["spaces"].append(space_node)
            tree.append(team_node)
        return tree
    except ClickUpError:
        raise


# ---------- Campos disponíveis de uma lista ----------

BUILTIN_FIELDS = [
    {"id": "name", "name": "Nome da task", "type": "text"},
    {"id": "status", "name": "Status", "type": "labels"},
    {"id": "assignees", "name": "Usuário (responsável)", "type": "labels"},
    {"id": "creator", "name": "Criado por", "type": "text"},
    {"id": "priority", "name": "Prioridade", "type": "labels"},
    {"id": "date_created", "name": "Data de criação", "type": "date"},
    {"id": "date_closed", "name": "Data de fechamento", "type": "date"},
    {"id": "due_date", "name": "Data de vencimento", "type": "date"},
    {"id": "time_spent_hours", "name": "Horas registradas (total task)", "type": "number"},
    {"id": "time_estimate_hours", "name": "Horas estimadas", "type": "number"},
    {"id": "tags", "name": "Tags", "type": "labels"},
    {"id": "list_name", "name": "Lista", "type": "labels"},
    {"id": "folder_name", "name": "Pasta (produto)", "type": "labels"},
]


@app.get("/api/fields")
def get_fields(list_ids: str = Query(..., description="IDs de lista separados por vírgula"), force: bool = Query(False), user: dict = Depends(current_user)):
    client = get_client()
    try:
        data, cached_at = cached(f"fields:{list_ids}", force, lambda: _build_fields(client, list_ids))
        return {**data, "cached_at": cached_at}
    except ClickUpError as e:
        raise HTTPException(status_code=502, detail=str(e))


def _build_fields(client: ClickUpClient, list_ids: str) -> dict:
    seen: dict[str, dict] = {}
    if True:
        for list_id in [l.strip() for l in list_ids.split(",") if l.strip()]:
            for f in client.get_list_fields(list_id):
                fid = f"cf_{f['id']}"
                if fid in seen:
                    continue
                seen[fid] = {
                    "id": fid,
                    "name": f["name"],
                    "type": f.get("type", "text"),
                    "custom": True,
                    "options": [o.get("name") for o in f.get("type_config", {}).get("options", [])]
                    if f.get("type") in ("drop_down", "labels")
                    else None,
                }
    return {"builtin": BUILTIN_FIELDS, "custom": list(seen.values())}


# ---------- Tasks achatadas (flattened) para consumo do frontend ----------

def _flatten_task(task: dict) -> dict:
    flat = {
        "id": task.get("id"),
        "name": task.get("name"),
        "status": (task.get("status") or {}).get("status"),
        "assignees": [a.get("username") for a in task.get("assignees", [])] or ["(sem responsável)"],
        "creator": (task.get("creator") or {}).get("username"),
        "priority": (task.get("priority") or {}).get("priority") if task.get("priority") else None,
        "date_created": task.get("date_created"),
        "date_closed": task.get("date_closed"),
        "due_date": task.get("due_date"),
        "tags": [t.get("name") for t in task.get("tags", [])],
        "time_spent_hours": round(int(task.get("time_spent") or 0) / 3_600_000, 2),
        "time_estimate_hours": round(int(task.get("time_estimate") or 0) / 3_600_000, 2),
        "list_id": (task.get("list") or {}).get("id"),
        "list_name": (task.get("list") or {}).get("name"),
        "folder_name": (task.get("folder") or {}).get("name") or "(sem pasta)",
    }
    for cf in task.get("custom_fields", []):
        key = f"cf_{cf['id']}"
        value = cf.get("value")
        # normaliza drop_down / labels para nome legível
        if cf.get("type") in ("drop_down",) and value is not None:
            options = cf.get("type_config", {}).get("options", [])
            match = next((o.get("name") for o in options if o.get("orderindex") == value or o.get("id") == value), None)
            value = match if match is not None else value
        elif cf.get("type") == "labels" and isinstance(value, list):
            options = {o.get("id"): o.get("label") for o in cf.get("type_config", {}).get("options", [])}
            value = [options.get(v, v) for v in value]
        flat[key] = value
        flat[f"{key}__name"] = cf.get("name")
    return flat


@app.get("/api/tasks")
def get_tasks(list_ids: str = Query(..., description="IDs de lista separados por vírgula"), force: bool = Query(False), user: dict = Depends(current_user)):
    client = get_client()
    try:
        tasks, cached_at = cached(f"tasks:{list_ids}", force, lambda: _build_tasks(client, list_ids))
        return {"count": len(tasks), "tasks": tasks, "cached_at": cached_at}
    except ClickUpError as e:
        raise HTTPException(status_code=502, detail=str(e))


def _build_tasks(client: ClickUpClient, list_ids: str) -> list:
    all_tasks: list[dict] = []
    seen_ids: set[str] = set()
    if True:
        for list_id in [l.strip() for l in list_ids.split(",") if l.strip()]:
            for t in client.get_tasks(list_id):
                if t.get("id") in seen_ids:
                    continue  # tasks em múltiplas listas não duplicam
                seen_ids.add(t.get("id"))
                all_tasks.append(_flatten_task(t))
    return all_tasks


@app.get("/api/time_entries")
def get_time_entries(
    team_id: str = Query(...),
    start: int = Query(..., description="Início do período (epoch ms)"),
    end: int = Query(..., description="Fim do período (epoch ms)"),
    list_ids: str = Query("", description="Filtrar por listas (IDs separados por vírgula)"),
    force: bool = Query(False),
    user: dict = Depends(current_user),
):
    """
    Entradas de time tracking de TODOS os colaboradores do workspace no período,
    opcionalmente filtradas pelas listas selecionadas.
    """
    client = get_client()
    # chave arredondada ao dia para o cache funcionar entre requisições
    day = 24 * 3600 * 1000
    key = f"entries:{team_id}:{start // day}:{end // day}"
    try:
        raw, cached_at = cached(key, force, lambda: _fetch_entries(client, team_id, start, end))
    except ClickUpError as e:
        raise HTTPException(status_code=502, detail=str(e))

    wanted_lists = {l.strip() for l in list_ids.split(",") if l.strip()}
    entries = []
    for e in raw:
        duration_ms = int(e.get("duration") or 0)
        if duration_ms <= 0:
            continue  # ignora timers em andamento
        loc = e.get("task_location") or {}
        entry_list_id = str(loc.get("list_id") or "")
        if wanted_lists and entry_list_id not in wanted_lists:
            continue
        task = e.get("task") or {}
        entries.append(
            {
                "task_id": task.get("id"),
                "task_name": task.get("name"),
                "entry_user": (e.get("user") or {}).get("username") or "(desconhecido)",
                "entry_user_id": str((e.get("user") or {}).get("id") or ""),
                "duration_hours": round(duration_ms / 3_600_000, 4),
                "start": e.get("start"),
                "list_id": entry_list_id,
            }
        )
    return {"count": len(entries), "entries": entries, "cached_at": cached_at}


def _fetch_entries(client: ClickUpClient, team_id: str, start: int, end: int) -> list:
    members = client.get_team_members(team_id)
    member_ids = [m.get("id") for m in members if m.get("id")]
    return client.get_time_entries(team_id, start, end, member_ids)


# ---------- Dashboards salvos ----------

class DashboardIn(BaseModel):
    id: Optional[int] = None
    name: str
    list_id: str
    config: dict


class EditorsIn(BaseModel):
    editor_ids: list[int]


def _dash_out(d: dict, user: dict) -> dict:
    return {
        "id": d["id"], "name": d["name"], "list_id": d["list_id"],
        "updated_at": d.get("updated_at"),
        "created_by": d.get("created_by"),
        "creator_name": d.get("creator_name") or ("Sistema" if d.get("created_by") is None else None),
        "editors": d.get("editors", []),
        "can_edit": can_edit_dashboard(d, user),
        "can_delete": can_delete_dashboard(d, user),
        "can_manage_editors": can_manage_editors(d, user),
    }


@app.get("/api/dashboards")
def api_list_dashboards(user: dict = Depends(current_user)):
    return [_dash_out(d, user) for d in db.list_dashboards()]


@app.get("/api/dashboards/{dashboard_id}")
def api_get_dashboard(dashboard_id: int, user: dict = Depends(current_user)):
    d = db.get_dashboard(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    out = _dash_out(d, user)
    out["config"] = d["config"]
    return out


@app.post("/api/dashboards")
def api_save_dashboard(payload: DashboardIn, user: dict = Depends(current_user)):
    if payload.id:
        existing = db.get_dashboard(payload.id)
        if not existing:
            raise HTTPException(status_code=404, detail="Dashboard não encontrado")
        if not can_edit_dashboard(existing, user):
            raise HTTPException(status_code=403, detail="Sem permissão para editar esta visualização")
        new_id = db.save_dashboard(payload.name, payload.list_id, payload.config, payload.id)
    else:
        new_id = db.save_dashboard(payload.name, payload.list_id, payload.config, created_by=user["id"])
    return {"id": new_id}


@app.post("/api/dashboards/{dashboard_id}/duplicate")
def api_duplicate_dashboard(dashboard_id: int, user: dict = Depends(current_user)):
    d = db.get_dashboard(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    new_id = db.save_dashboard(f"{d['name']} (cópia)", d["list_id"], d["config"], created_by=user["id"])
    return {"id": new_id}


@app.put("/api/dashboards/{dashboard_id}/editors")
def api_set_editors(dashboard_id: int, payload: EditorsIn, user: dict = Depends(current_user)):
    d = db.get_dashboard(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    if not can_manage_editors(d, user):
        raise HTTPException(status_code=403, detail="Apenas o criador ou admin pode atribuir editores")
    valid_ids = {u["id"] for u in db.list_users()}
    db.set_editors(dashboard_id, [e for e in payload.editor_ids if e in valid_ids])
    return {"ok": True}


@app.delete("/api/dashboards/{dashboard_id}")
def api_delete_dashboard(dashboard_id: int, user: dict = Depends(current_user)):
    d = db.get_dashboard(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    if not can_delete_dashboard(d, user):
        raise HTTPException(status_code=403, detail="Apenas o criador ou admin pode excluir")
    db.delete_dashboard(dashboard_id)
    return {"ok": True}


# ---------- Snapshots semanais ----------

@app.get("/api/snapshots")
def api_get_snapshots(
    start: str = Query(None, description="Semana inicial YYYY-MM-DD"),
    end: str = Query(None, description="Semana final YYYY-MM-DD"),
    user: dict = Depends(current_user),
):
    return {"rows": db.get_snapshots(start, end), "weeks": db.snapshot_weeks()}


@app.post("/api/snapshots/run")
def api_run_snapshots(admin: dict = Depends(admin_only)):
    """Força a geração/backfill dos snapshots pendentes (admin)."""
    try:
        return snap.run_pending_snapshots()
    except ClickUpError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/snapshots/regenerate")
def api_regenerate_snapshots(admin: dict = Depends(admin_only)):
    """Recalcula TODAS as semanas do histórico (inclusive já existentes) com a regra vigente."""
    try:
        return snap.regenerate_all_weeks()
    except ClickUpError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ---------- Backup do banco (admin) ----------
# O agendamento automático (diário) roda fora do processo web — ver backup.sh /
# install_backup_schedule_mac.sh / install_backup_schedule_linux.sh. Estes endpoints
# só cobrem o botão "Backup agora" da interface e o indicador de status.

@app.get("/api/backup/status")
def api_backup_status(admin: dict = Depends(admin_only)):
    return backup_mod.backup_status()


@app.post("/api/backup/run")
def api_run_backup(admin: dict = Depends(admin_only)):
    try:
        return backup_mod.run_backup()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Frontend estático ----------


FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/login")
    def login_page():
        return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))
