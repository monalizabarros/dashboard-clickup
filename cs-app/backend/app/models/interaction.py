import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InteractionType(str, enum.Enum):
    REUNIAO = "reuniao"
    LIGACAO = "ligacao"
    EMAIL = "email"
    CONTATO = "contato"
    RECLAMACAO = "reclamacao"
    ELOGIO = "elogio"
    DECISAO = "decisao"
    COMPROMISSO = "compromisso"
    FEEDBACK = "feedback"
    INCIDENTE = "incidente"


def _uuid() -> str:
    return str(uuid.uuid4())


class Interaction(Base):
    """Timeline cronológica do cliente (RF-068 a RF-071).

    Vínculos estruturados disponíveis hoje: produto, módulo e stakeholder
    (contato). Vínculo a "Projeto" já existe via link externo em
    ImplementationSummary (Bloco 6); vínculo a Oportunidade/Risco será
    adicionado quando esses modelos existirem (Blocos 16/22).
    """

    __tablename__ = "interactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    type: Mapped[InteractionType] = mapped_column(Enum(InteractionType), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    product_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("products.id"), nullable=True)
    module_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("modules.id"), nullable=True)
    contact_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("contacts.id"), nullable=True)

    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
