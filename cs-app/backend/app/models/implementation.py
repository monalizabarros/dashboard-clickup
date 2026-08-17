import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ImplementationStatus(str, enum.Enum):
    NAO_INICIADO = "nao_iniciado"
    PLANEJADO = "planejado"
    EM_IMPLANTACAO = "em_implantacao"
    PRE_GO_LIVE = "pre_go_live"
    GO_LIVE = "go_live"
    HYPERCARE = "hypercare"
    CONCLUIDO = "concluido"


class ImplementationSituation(str, enum.Enum):
    NO_PRAZO = "no_prazo"
    EM_ATENCAO = "em_atencao"
    ATRASADO = "atrasado"


class ImplementationEventType(str, enum.Enum):
    RISCO = "risco"
    IMPEDIMENTO = "impedimento"
    DEPENDENCIA = "dependencia"
    DECISAO = "decisao"


def _uuid() -> str:
    return str(uuid.uuid4())


class ImplementationSummary(Base):
    """Visão macro da implantação, mantida por Projetos/CS (RF-031 a RF-035, RF-037).

    Deliberadamente NÃO contém cronograma técnico detalhado, tarefas de
    desenvolvimento/parametrização ou alocação de recursos (RF-038) — isso
    permanece no sistema de Projetos, acessível via `external_link`.
    """

    __tablename__ = "implementation_summaries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clients.id"), nullable=False, unique=True
    )

    status: Mapped[ImplementationStatus] = mapped_column(
        Enum(ImplementationStatus), nullable=False, default=ImplementationStatus.NAO_INICIADO
    )
    situation: Mapped[ImplementationSituation] = mapped_column(
        Enum(ImplementationSituation), nullable=False, default=ImplementationSituation.NO_PRAZO
    )
    expected_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    external_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ImplementationMilestone(Base):
    """Principais marcos da implantação (RF-033) — alto nível, não é
    cronograma técnico (RF-038)."""

    __tablename__ = "implementation_milestones"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    label: Mapped[str] = mapped_column(String(200), nullable=False)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class ImplementationEvent(Base):
    """Riscos, impedimentos, dependências e decisões da implantação com
    impacto na jornada do cliente (RF-036, RF-039)."""

    __tablename__ = "implementation_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    type: Mapped[ImplementationEventType] = mapped_column(Enum(ImplementationEventType), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
