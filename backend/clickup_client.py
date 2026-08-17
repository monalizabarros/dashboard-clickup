"""
Cliente da API do ClickUp.
Documentação: https://developer.clickup.com/reference
"""
from __future__ import annotations
import os
import time
import httpx
from typing import Any

CLICKUP_BASE_URL = os.getenv("CLICKUP_BASE_URL", "https://api.clickup.com/api/v2")


class ClickUpError(Exception):
    pass


class ClickUpClient:
    def __init__(self, api_token: str | None = None):
        self.api_token = api_token or os.getenv("CLICKUP_API_TOKEN")
        if not self.api_token:
            raise ClickUpError("CLICKUP_API_TOKEN não configurado")
        self.headers = {"Authorization": self.api_token}

    def _get(self, path: str, params: dict | None = None) -> dict:
        url = f"{CLICKUP_BASE_URL}{path}"
        for attempt in range(3):
            resp = httpx.get(url, headers=self.headers, params=params, timeout=30)
            if resp.status_code == 429:
                # rate limit do ClickUp: espera e tenta de novo
                time.sleep(int(resp.headers.get("Retry-After", "5")))
                continue
            if resp.status_code >= 400:
                raise ClickUpError(f"Erro ClickUp {resp.status_code}: {resp.text}")
            return resp.json()
        raise ClickUpError("Rate limit excedido após 3 tentativas")

    def get_teams(self) -> list[dict]:
        return self._get("/team").get("teams", [])

    def get_spaces(self, team_id: str) -> list[dict]:
        return self._get(f"/team/{team_id}/space").get("spaces", [])

    def get_folders(self, space_id: str) -> list[dict]:
        return self._get(f"/space/{space_id}/folder").get("folders", [])

    def get_lists(self, folder_id: str) -> list[dict]:
        return self._get(f"/folder/{folder_id}/list").get("lists", [])

    def get_folderless_lists(self, space_id: str) -> list[dict]:
        return self._get(f"/space/{space_id}/list").get("lists", [])

    def get_list_fields(self, list_id: str) -> list[dict]:
        return self._get(f"/list/{list_id}/field").get("fields", [])

    def get_tasks(self, list_id: str, include_closed: bool = True) -> list[dict]:
        """Busca todas as tasks de uma lista, com paginação e campos customizados."""
        all_tasks = []
        page = 0
        while True:
            params = {
                "page": page,
                "include_closed": str(include_closed).lower(),
                "subtasks": "true",
            }
            data = self._get(f"/list/{list_id}/task", params=params)
            tasks = data.get("tasks", [])
            all_tasks.extend(tasks)
            if data.get("last_page", True) or not tasks:
                break
            page += 1
        return all_tasks

    def get_task_time_tracked(self, task_id: str) -> list[dict]:
        """Retorna entradas de tempo registradas em uma task (em ms)."""
        data = self._get(f"/task/{task_id}/time")
        return data.get("data", [])

    def get_team_members(self, team_id: str) -> list[dict]:
        """Membros do workspace (para buscar time entries de todos)."""
        teams = self.get_teams()
        for team in teams:
            if str(team.get("id")) == str(team_id):
                return [m.get("user", {}) for m in team.get("members", [])]
        return []

    def get_time_entries(
        self,
        team_id: str,
        start_ms: int,
        end_ms: int,
        assignee_ids: list[int] | None = None,
    ) -> list[dict]:
        """
        Entradas de tempo do workspace no período.
        IMPORTANTE: por padrão a API retorna só as entradas do dono do token;
        para trazer de todos os colaboradores, passar assignee com todos os IDs.
        """
        params: dict = {"start_date": start_ms, "end_date": end_ms}
        if assignee_ids:
            params["assignee"] = ",".join(str(a) for a in assignee_ids)
        data = self._get(f"/team/{team_id}/time_entries", params=params)
        return data.get("data", [])
