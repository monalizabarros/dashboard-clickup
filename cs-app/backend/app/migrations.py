"""Migrações leves para SQLite, sem Alembic.

`Base.metadata.create_all` só cria tabelas que ainda não existem — não
adiciona colunas novas a tabelas já existentes. Como o projeto está em fase
de prototipagem rápida (sem Alembic configurado), colunas adicionadas depois
da criação inicial de uma tabela entram aqui como `ALTER TABLE ... ADD
COLUMN`, ignorando o erro se a coluna já existir.
"""

from sqlalchemy import text
from sqlalchemy.engine import Engine

STATEMENTS = [
    "ALTER TABLE tasks ADD COLUMN action_plan_id VARCHAR(36)",
    "ALTER TABLE clients ADD COLUMN tier VARCHAR(20)",
]


def run_light_migrations(engine: Engine) -> None:
    for statement in STATEMENTS:
        try:
            with engine.begin() as conn:
                conn.execute(text(statement))
        except Exception as exc:  # noqa: BLE001
            if "duplicate column" not in str(exc).lower():
                raise
