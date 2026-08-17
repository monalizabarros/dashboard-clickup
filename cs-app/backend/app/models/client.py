import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ClientStatus(str, enum.Enum):
    PROSPECT = "prospect"
    EM_ONBOARDING = "em_onboarding"
    ATIVO = "ativo"
    EM_RISCO = "em_risco"
    EM_RECUPERACAO = "em_recuperacao"
    EM_RENOVACAO = "em_renovacao"
    CHURN = "churn"
    ENCERRADO = "encerrado"


class TierLevel(str, enum.Enum):
    PLATINA = "platina"
    OURO = "ouro"
    PRATA = "prata"
    BRONZE = "bronze"


def _uuid() -> str:
    return str(uuid.uuid4())


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)

    corporate_name: Mapped[str] = mapped_column(String(200), nullable=False)  # razão social
    trade_name: Mapped[str | None] = mapped_column(String(200), nullable=True)  # nome fantasia
    cnpj: Mapped[str | None] = mapped_column(String(20), nullable=True, unique=True)
    segment: Mapped[str | None] = mapped_column(String(120), nullable=True)
    economic_group: Mapped[str | None] = mapped_column(String(150), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    relationship_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[ClientStatus] = mapped_column(
        Enum(ClientStatus), nullable=False, default=ClientStatus.PROSPECT
    )
    tier: Mapped[TierLevel | None] = mapped_column(Enum(TierLevel), nullable=True)

    owner_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ClientOwnerHistory(Base):
    """Histórico de troca do responsável de CS pela conta (RF-009)."""

    __tablename__ = "client_owner_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    previous_owner_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    new_owner_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    changed_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    changed_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
