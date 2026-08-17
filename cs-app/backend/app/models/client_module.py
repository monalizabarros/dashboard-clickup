import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UsageLevel(str, enum.Enum):
    NAO_AVALIADO = "nao_avaliado"
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"


def _uuid() -> str:
    return str(uuid.uuid4())


class ClientModule(Base):
    """Módulo contratado por um cliente, com status de implantação e
    utilização (RF-017, RF-022). A utilização é manual nesta fase — a
    alimentação automática por analytics de produto é Bloco 15/V3."""

    __tablename__ = "client_modules"
    __table_args__ = (UniqueConstraint("client_id", "module_id", name="uq_client_module"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)
    module_id: Mapped[str] = mapped_column(String(36), ForeignKey("modules.id"), nullable=False)

    contracted_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_implemented: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    usage_level: Mapped[UsageLevel] = mapped_column(
        Enum(UsageLevel), nullable=False, default=UsageLevel.NAO_AVALIADO
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
