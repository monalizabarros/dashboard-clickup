import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class SalesHandoff(Base):
    """Handoff Comercial -> Projetos + CS (RF-023 a RF-030).

    Separa deliberadamente os dados de execução (destinados a Projetos) do
    contexto de sucesso (destinado a CS), mantendo-os no mesmo evento de
    handoff mas em campos distintos, conforme a seção 6 dos requisitos.
    """

    __tablename__ = "sales_handoffs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    # --- Dados de execução, para Projetos (RF-024) ---
    contract_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    products_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    modules_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    customizations: Mapped[str | None] = mapped_column(Text, nullable=True)
    integrations: Mapped[str | None] = mapped_column(Text, nullable=True)
    assumptions: Mapped[str | None] = mapped_column(Text, nullable=True)
    dependencies: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Contexto de sucesso, para CS (RF-025) ---
    purchase_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    problem_to_solve: Mapped[str | None] = mapped_column(Text, nullable=True)
    contracting_objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_deadline: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sponsor_contact_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("contacts.id"), nullable=True
    )
    stakeholders_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    success_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    perceived_risks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Metadados do evento de handoff (RF-026, RF-027, RF-029, RF-030) ---
    participants: Mapped[str | None] = mapped_column(Text, nullable=True)
    handoff_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pending_items: Mapped[str | None] = mapped_column(Text, nullable=True)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
