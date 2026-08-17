import os

from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.migrations import run_light_migrations
from app.models.alert_rule import AlertEventType, AlertRule
from app.models.client import TierLevel
from app.models.health_score import HealthScoreIndicator, IndicatorSource
from app.models.permission import Permission
from app.models.tier_cadence import TierCadence
from app.models.user import RoleName, User

DEFAULT_ALERT_RULES = [
    {"event_type": AlertEventType.SEM_CONTATO, "name": "Cliente sem contato dentro da cadência", "is_active": True, "auto_create_task": False},
    {"event_type": AlertEventType.QUEDA_UTILIZACAO, "name": "Queda de utilização dos módulos", "is_active": True, "auto_create_task": False},
    {"event_type": AlertEventType.MUDANCA_HEALTH_SCORE, "name": "Mudança relevante no Health Score", "is_active": True, "auto_create_task": False},
    {"event_type": AlertEventType.SATISFACAO_NEGATIVA, "name": "Resposta NPS/CSAT negativa", "is_active": True, "auto_create_task": True},
    {"event_type": AlertEventType.RENOVACAO_PROXIMA, "name": "Renovação próxima", "is_active": False, "auto_create_task": False},
    {"event_type": AlertEventType.RENOVACAO_RISCO, "name": "Renovação próxima combinada com risco", "is_active": False, "auto_create_task": False},
    {"event_type": AlertEventType.IMPLANTACAO_ATRASADA, "name": "Implantação atrasada com impacto no cliente", "is_active": True, "auto_create_task": False},
    {"event_type": AlertEventType.RISCO_CRITICO, "name": "Risco crítico em aberto", "is_active": True, "auto_create_task": True},
]

DEFAULT_HEALTH_SCORE_INDICATORS = [
    {"key": "implantacao", "label": "Situação da implantação", "weight": 20, "source": IndicatorSource.AUTO},
    {"key": "adocao", "label": "Progresso de onboarding", "weight": 20, "source": IndicatorSource.AUTO},
    {"key": "relacionamento", "label": "Recência de contato (check-in)", "weight": 20, "source": IndicatorSource.AUTO},
    {"key": "utilizacao", "label": "Utilização dos módulos", "weight": 15, "source": IndicatorSource.AUTO},
    {"key": "suporte", "label": "Indicadores de suporte", "weight": 10, "source": IndicatorSource.MANUAL},
    {"key": "satisfacao", "label": "Satisfação (NPS/CSAT)", "weight": 15, "source": IndicatorSource.AUTO},
]

DEFAULT_TIER_CADENCE_DAYS: dict[TierLevel, int] = {
    TierLevel.PLATINA: 30,
    TierLevel.OURO: 45,
    TierLevel.PRATA: 60,
    TierLevel.BRONZE: 90,
}

DEFAULT_ADMIN_EMAIL = os.getenv("CS_ADMIN_EMAIL", "admin@3wings.com.br")
DEFAULT_ADMIN_PASSWORD = os.getenv("CS_ADMIN_PASSWORD", "trocar123")
DEFAULT_ADMIN_NAME = os.getenv("CS_ADMIN_NAME", "Administrador")

# Matriz de permissão padrão por recurso. Administrador sempre tem acesso
# total (bypass em app/deps.py), por isso não precisa de linha aqui.
DEFAULT_PERMISSIONS: dict[str, dict[RoleName, dict[str, bool]]] = {
    # Bloco 1
    "users": {
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.CS: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PROJETOS: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 2
    "clients": {
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.CS: {"can_view": True, "can_create": False, "can_edit": True, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": True, "can_create": True, "can_edit": False, "can_delete": False},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 3
    "contacts": {
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": True, "can_create": True, "can_edit": False, "can_delete": False},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 4
    "products": {
        RoleName.PRODUTO: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.CS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
    },
    "client_products": {
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": True, "can_create": True, "can_edit": False, "can_delete": False},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 5
    "sales_handoffs": {
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.COMERCIAL: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": True, "can_delete": False},
        RoleName.CS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 6
    "implementation": {
        RoleName.PROJETOS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 7
    "cs_participation": {
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    "tasks": {
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 8
    "delivery_handoffs": {
        RoleName.PROJETOS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False},
        RoleName.CS: {"can_view": True, "can_create": False, "can_edit": True, "can_delete": False},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 9
    "interactions": {
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.COMERCIAL: {"can_view": True, "can_create": True, "can_edit": False, "can_delete": False},
        RoleName.PROJETOS: {"can_view": True, "can_create": True, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": True, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 10
    "action_plans": {
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    "onboarding": {
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 11
    "check_ins": {
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 12
    "health_score_config": {
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.CS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    "health_score": {
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 13
    "risks": {
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 14
    "surveys": {
        RoleName.CS: {"can_view": True, "can_create": True, "can_edit": False, "can_delete": False},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": True, "can_edit": False, "can_delete": True},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": True, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
    },
    # Bloco 15
    "dashboard": {
        RoleName.CS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTOR_CS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
    },
    "alerts": {
        RoleName.GESTOR_CS: {"can_view": True, "can_create": False, "can_edit": True, "can_delete": False},
        RoleName.CS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PROJETOS: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.SUPORTE: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.COMERCIAL: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.PRODUTO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
        RoleName.GESTAO: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False},
    },
}


def run():
    Base.metadata.create_all(bind=engine)
    run_light_migrations(engine)
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == DEFAULT_ADMIN_EMAIL).first():
            admin = User(
                name=DEFAULT_ADMIN_NAME,
                email=DEFAULT_ADMIN_EMAIL,
                role=RoleName.ADMINISTRADOR,
                hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
            )
            db.add(admin)
            print(f"Usuário administrador criado: {DEFAULT_ADMIN_EMAIL} / {DEFAULT_ADMIN_PASSWORD}")
        else:
            print(f"Usuário administrador já existe: {DEFAULT_ADMIN_EMAIL}")

        for resource, role_matrix in DEFAULT_PERMISSIONS.items():
            for role, perms in role_matrix.items():
                existing = (
                    db.query(Permission)
                    .filter(Permission.role == role, Permission.resource == resource)
                    .first()
                )
                if existing:
                    continue
                db.add(Permission(role=role, resource=resource, **perms))

        for tier, days in DEFAULT_TIER_CADENCE_DAYS.items():
            if not db.get(TierCadence, tier):
                db.add(TierCadence(tier=tier, frequency_days=days))

        for indicator_data in DEFAULT_HEALTH_SCORE_INDICATORS:
            if not db.query(HealthScoreIndicator).filter(HealthScoreIndicator.key == indicator_data["key"]).first():
                db.add(HealthScoreIndicator(**indicator_data))

        for rule_data in DEFAULT_ALERT_RULES:
            if not db.query(AlertRule).filter(AlertRule.event_type == rule_data["event_type"]).first():
                db.add(AlertRule(**rule_data))

        db.commit()
        print("Matriz de permissões padrão aplicada.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
