import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ImplementationPhase(str, enum.Enum):
    HANDOFF = "handoff"
    KICKOFF = "kickoff"
    PRE_GO_LIVE = "pre_go_live"
    GO_LIVE = "go_live"
    HYPERCARE = "hypercare"


def _uuid() -> str:
    return str(uuid.uuid4())


class CSPhaseParticipation(Base):
    """Participação do CS nas fases da implantação (RF-040 a RF-044)."""

    __tablename__ = "cs_phase_participations"
    __table_args__ = (UniqueConstraint("client_id", "phase", name="uq_cs_participation_client_phase"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)
    phase: Mapped[ImplementationPhase] = mapped_column(Enum(ImplementationPhase), nullable=False)

    participated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    participation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
