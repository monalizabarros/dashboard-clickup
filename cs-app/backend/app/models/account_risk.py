import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RiskCategory(str, enum.Enum):
    ADOCAO = "adocao"
    RELACIONAMENTO = "relacionamento"
    PRODUTO = "produto"
    SUPORTE = "suporte"
    IMPLANTACAO = "implantacao"
    FINANCEIRO = "financeiro"
    RENOVACAO = "renovacao"
    CONCORRENCIA = "concorrencia"


class RiskImpact(str, enum.Enum):
    BAIXO = "baixo"
    MEDIO = "medio"
    ALTO = "alto"


class RiskProbability(str, enum.Enum):
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"


class RiskStatus(str, enum.Enum):
    ABERTO = "aberto"
    EM_ANDAMENTO = "em_andamento"
    MITIGADO = "mitigado"
    ENCERRADO = "encerrado"


def _uuid() -> str:
    return str(uuid.uuid4())


class AccountRisk(Base):
    """Risco de conta por categoria (RF-099, RF-100). Crítico = impacto alto
    + probabilidade alta (RF-101, calculado, não armazenado). O plano de
    recuperação (RF-102) reaproveita o ActionPlan do Bloco 10 em vez de um
    modelo novo — `action_plan_id` aponta pra ele quando criado."""

    __tablename__ = "account_risks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    category: Mapped[RiskCategory] = mapped_column(Enum(RiskCategory), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    impact: Mapped[RiskImpact] = mapped_column(Enum(RiskImpact), nullable=False)
    probability: Mapped[RiskProbability] = mapped_column(Enum(RiskProbability), nullable=False)
    responsible_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[RiskStatus] = mapped_column(Enum(RiskStatus), nullable=False, default=RiskStatus.ABERTO)
    action_plan_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("action_plans.id"), nullable=True)

    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class RiskEvidence(Base):
    """Ações e evidências vinculadas ao risco (RF-103)."""

    __tablename__ = "risk_evidences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    risk_id: Mapped[str] = mapped_column(String(36), ForeignKey("account_risks.id"), nullable=False)

    description: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
