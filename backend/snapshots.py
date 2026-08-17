"""
Snapshots semanais de horas rastreadas.

Toda semana fechada (segunda 00:00 → domingo 23:59) vira registros imutáveis
no SQLite, agregados por: produto, categoria (dev/suporte), tipo de suporte,
tipo de registro e colaborador. Isso preserva a "verdade histórica" mesmo que
tasks sejam alteradas ou excluídas no ClickUp depois.

A categoria segue a regra vigente do painel: campo "Tipo de suporte"
preenchido → Suporte; vazio → Desenvolvimento.
"""
from __future__ import annotations
import os
import re
import time
import threading
import traceback
from datetime import datetime, timedelta

from clickup_client import ClickUpClient, ClickUpError
import database as db

BACKFILL_WEEKS = int(os.getenv("SNAPSHOT_BACKFILL_WEEKS", "26"))  # ~6 meses
CHECK_INTERVAL_HOURS = 6

_PRODUTO_RX = [re.compile(r"^produtos?$", re.I), re.compile(r"produto", re.I)]
_TIPO_SUP_RX = [re.compile(r"tipo\s*(de)?\s*suporte", re.I), re.compile(r"suporte", re.I)]
_TIPO_REG_RX = [re.compile(r"tipo\s*(de)?\s*registro", re.I), re.compile(r"registro", re.I)]
_DEPARTAMENTO_RX = [re.compile(r"^departamentos?$", re.I), re.compile(r"departamento", re.I)]

# Mesma regra usada no frontend (app.js: DEPARTAMENTO_MAP) — manter sincronizada.
DEPARTAMENTO_MAP = {
    "projetos": "Projetos", "ux": "Projetos", "ia": "Projetos",
    "suporte": "Suporte",
    "produto": "Produto",
    "geral": "Geral", "diretoria": "Geral",
}


def _map_departamento_categoria(valor: str | None) -> str:
    if not valor:
        return "(vazio)"
    return DEPARTAMENTO_MAP.get(valor.strip().lower(), valor)


def _field_value(custom_fields: list[dict], regexes) -> str | None:
    """Encontra um campo customizado pelo nome e devolve o valor legível."""
    for rx in regexes:
        for cf in custom_fields:
            if not rx.search(cf.get("name") or ""):
                continue
            value = cf.get("value")
            if value is None or value == "" or value == []:
                return None
            options = cf.get("type_config", {}).get("options", [])
            if cf.get("type") == "drop_down":
                match = next(
                    (o.get("name") for o in options if o.get("orderindex") == value or o.get("id") == value),
                    None,
                )
                return match if match is not None else str(value)
            if cf.get("type") == "labels" and isinstance(value, list):
                names = {o.get("id"): o.get("label") for o in options}
                return ", ".join(str(names.get(v, v)) for v in value)
            return str(value)
    return None


def _week_bounds(week_start: datetime) -> tuple[int, int]:
    start_ms = int(week_start.timestamp() * 1000)
    end_ms = int((week_start + timedelta(days=7)).timestamp() * 1000) - 1
    return start_ms, end_ms


def _last_monday(ref: datetime) -> datetime:
    d = ref.replace(hour=0, minute=0, second=0, microsecond=0)
    return d - timedelta(days=d.weekday())


def completed_weeks(n: int) -> list[str]:
    """Últimas n semanas FECHADAS (a atual, em andamento, fica de fora)."""
    current_monday = _last_monday(datetime.now())
    return [
        (current_monday - timedelta(weeks=i)).strftime("%Y-%m-%d")
        for i in range(1, n + 1)
    ]


def build_week_snapshot(client: ClickUpClient, team_id: str, week_start_str: str) -> list[dict]:
    """Agrega as horas de uma semana em linhas de snapshot."""
    week_start = datetime.strptime(week_start_str, "%Y-%m-%d")
    start_ms, end_ms = _week_bounds(week_start)

    members = client.get_team_members(team_id)
    member_ids = [m.get("id") for m in members if m.get("id")]
    entries = client.get_time_entries(team_id, start_ms, end_ms, member_ids)

    # busca cada task envolvida (uma vez) para ler os campos customizados
    task_cache: dict[str, dict | None] = {}

    def get_task(task_id: str) -> dict | None:
        if task_id not in task_cache:
            try:
                task_cache[task_id] = client._get(f"/task/{task_id}")
            except ClickUpError:
                task_cache[task_id] = None
        return task_cache[task_id]

    agg: dict[tuple, float] = {}
    for e in entries:
        duration_ms = int(e.get("duration") or 0)
        if duration_ms <= 0:
            continue
        colaborador = (e.get("user") or {}).get("username") or "(desconhecido)"
        task_id = (e.get("task") or {}).get("id")
        produto = tipo_sup = tipo_reg = departamento = None
        if task_id:
            task = get_task(task_id)
            if task:
                cfs = task.get("custom_fields", [])
                produto = _field_value(cfs, _PRODUTO_RX)
                tipo_sup = _field_value(cfs, _TIPO_SUP_RX)
                tipo_reg = _field_value(cfs, _TIPO_REG_RX)
                departamento = _field_value(cfs, _DEPARTAMENTO_RX)
        categoria = _map_departamento_categoria(departamento)
        key = (
            produto or "(sem produto)",
            categoria,
            tipo_sup or "(n/a)",
            tipo_reg or "(sem tipo de registro)",
            colaborador,
        )
        agg[key] = agg.get(key, 0.0) + duration_ms / 3_600_000

    return [
        {
            "week_start": week_start_str,
            "produto": k[0],
            "categoria": k[1],
            "tipo_suporte": k[2],
            "tipo_registro": k[3],
            "colaborador": k[4],
            "horas": round(v, 2),
        }
        for k, v in agg.items()
    ]


def run_pending_snapshots(force_weeks: list[str] | None = None) -> dict:
    """Gera snapshots das semanas fechadas que ainda não existem no banco."""
    client = ClickUpClient()
    teams = client.get_teams()
    if not teams:
        return {"generated": [], "error": "nenhum workspace encontrado"}
    team_id = teams[0]["id"]

    existing = set(db.snapshot_weeks())
    targets = force_weeks if force_weeks else [w for w in completed_weeks(BACKFILL_WEEKS) if w not in existing]

    generated = []
    for week in sorted(targets):
        rows = build_week_snapshot(client, team_id, week)
        db.replace_week_snapshot(week, rows)
        generated.append({"week": week, "rows": len(rows)})
    return {"generated": generated}


def regenerate_all_weeks() -> dict:
    """
    Recalcula TODAS as semanas do período de backfill, inclusive as já existentes.
    Use após mudar uma regra de classificação (ex: mapeamento de Categoria) para que
    o histórico reflita a regra vigente em vez da regra que estava ativa quando cada
    semana foi originalmente gravada.
    """
    weeks = completed_weeks(BACKFILL_WEEKS)
    return run_pending_snapshots(force_weeks=weeks)


def start_scheduler():
    """Thread em background: verifica semanas pendentes a cada 6h."""
    def loop():
        time.sleep(20)  # espera o servidor estabilizar
        while True:
            try:
                result = run_pending_snapshots()
                if result.get("generated"):
                    print(f"[snapshots] gerados: {result['generated']}")
            except Exception:
                print("[snapshots] erro no job:")
                traceback.print_exc()
            time.sleep(CHECK_INTERVAL_HOURS * 3600)

    t = threading.Thread(target=loop, daemon=True)
    t.start()
