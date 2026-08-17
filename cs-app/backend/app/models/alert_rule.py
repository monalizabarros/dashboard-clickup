import enum
import uuid

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AlertEventType(str, enum.Enum):
    SEM_CONTATO = "sem_contato"  # RF-139
    QUEDA_UTILIZACAO = "queda_utilizacao"  # RF-140
    MUDANCA_HEALTH_SCORE = "mudanca_health_score"  # RF-141
    SATISFACAO_NEGATIVA = "satisfacao_negativa"  # RF-142
    RENOVACAO_PROXIMA = "renovacao_proxima"  # RF-143 (sem fonte de dado ainda — ver nota no serviço)
    RENOVACAO_RISCO = "renovacao_risco"  # RF-144 (idem)
    IMPLANTACAO_ATRASADA = "implantacao_atrasada"  # RF-145
    RISCO_CRITICO = "risco_critico"  # extensão natural do Bloco 13


def _uuid() -> str:
    return str(uuid.uuid4())


class AlertRule(Base):
    """Regra de alerta configurável (RF-138). `auto_create_task` implementa
    o RF-146 — cria uma tarefa de acompanhamento quando o evento dispara."""

    __tablename__ = "alert_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    event_type: Mapped[AlertEventType] = mapped_column(Enum(AlertEventType), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_create_task: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
