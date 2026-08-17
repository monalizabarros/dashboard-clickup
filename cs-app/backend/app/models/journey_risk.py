import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class JourneyRiskCategory(str, enum.Enum):
    EXPECTATIVA = "expectativa"
    RELACIONAMENTO = "relacionamento"
    ADOCAO = "adocao"
    SATISFACAO = "satisfacao"
    RESULTADO_ESPERADO = "resultado_esperado"


def _uuid() -> str:
    return str(uuid.uuid4())


class JourneyRisk(Base):
    """Riscos da jornada do cliente identificados pelo CS durante a
    implantação (RF-045)."""

    __tablename__ = "journey_risks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    category: Mapped[JourneyRiskCategory] = mapped_column(Enum(JourneyRiskCategory), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class PostGoLiveObjective(Base):
    """Objetivos e critérios de sucesso a avaliar após o go-live (RF-046)."""

    __tablename__ = "post_go_live_objectives"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_achieved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    achieved_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
