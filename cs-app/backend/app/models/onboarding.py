import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class OnboardingTemplateItem(Base):
    """Item de template de onboarding por produto (RF-078) — catálogo,
    reaproveitado para semear a jornada de cada cliente que contrata o
    produto (RF-077)."""

    __tablename__ = "onboarding_template_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)

    label: Mapped[str] = mapped_column(String(250), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class OnboardingJourney(Base):
    """Jornada de onboarding/adoção do cliente (RF-077, RF-080, RF-082),
    separada da implantação técnica — nasce quando o handoff Projetos→CS é
    aceito (Bloco 8) ou pode ser iniciada manualmente."""

    __tablename__ = "onboarding_journeys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False, unique=True)

    started_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    first_usage_at: Mapped[date | None] = mapped_column(Date, nullable=True)  # RF-082


class OnboardingActivity(Base):
    """Atividade do checklist de onboarding (RF-079, RF-081)."""

    __tablename__ = "onboarding_activities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    label: Mapped[str] = mapped_column(String(250), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class AdoptionMilestone(Base):
    """Marco de adoção atingido pelo cliente (RF-083)."""

    __tablename__ = "adoption_milestones"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    label: Mapped[str] = mapped_column(String(250), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    achieved_at: Mapped[date] = mapped_column(Date, nullable=False)

    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
