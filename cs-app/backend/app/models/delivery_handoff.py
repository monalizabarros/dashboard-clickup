import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class DeliveryHandoff(Base):
    """Handoff Projetos -> CS (RF-048 a RF-063).

    Transferência formal da conta, da fase de implantação para a operação
    recorrente de CS. O aceite formal (RF-062) dispara automaticamente a
    mudança do estágio da conta (RF-063) — ver `complete_delivery_handoff`
    em app/routers/delivery_handoffs.py.
    """

    __tablename__ = "delivery_handoffs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    contracted_scope: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-049
    delivered_scope: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-050
    pending_items: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-051
    customizations: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-052
    integrations: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-053
    known_limitations: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-054
    known_issues: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-055

    sponsor_contact_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("contacts.id"), nullable=True
    )  # RF-056
    stakeholders_notes: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-056
    business_objective: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-057
    success_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-058

    go_live_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # RF-059
    hypercare_start: Mapped[date | None] = mapped_column(Date, nullable=True)  # RF-060
    hypercare_end: Mapped[date | None] = mapped_column(Date, nullable=True)  # RF-060
    next_adoption_steps: Mapped[str | None] = mapped_column(Text, nullable=True)  # RF-061

    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # RF-062
    accepted_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
