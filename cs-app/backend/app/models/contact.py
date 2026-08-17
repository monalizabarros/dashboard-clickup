import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ContactStatus(str, enum.Enum):
    ATIVO = "ativo"
    INATIVO = "inativo"


class InfluenceLevel(str, enum.Enum):
    BAIXO = "baixo"
    MEDIO = "medio"
    ALTO = "alto"


class StakeholderType(str, enum.Enum):
    SPONSOR = "sponsor"
    DECISOR = "decisor"
    USUARIO = "usuario"
    INFLUENCIADOR = "influenciador"
    TI = "ti"
    ADMINISTRATIVO = "administrativo"
    FINANCEIRO = "financeiro"
    OUTRO = "outro"


def _uuid() -> str:
    return str(uuid.uuid4())


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    role_title: Mapped[str | None] = mapped_column(String(120), nullable=True)  # cargo
    area: Mapped[str | None] = mapped_column(String(120), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)

    status: Mapped[ContactStatus] = mapped_column(
        Enum(ContactStatus), nullable=False, default=ContactStatus.ATIVO
    )
    influence_level: Mapped[InfluenceLevel] = mapped_column(
        Enum(InfluenceLevel), nullable=False, default=InfluenceLevel.MEDIO
    )
    stakeholder_type: Mapped[StakeholderType] = mapped_column(
        Enum(StakeholderType), nullable=False, default=StakeholderType.OUTRO
    )
    is_main_sponsor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
