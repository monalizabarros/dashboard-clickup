import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class IndicatorSource(str, enum.Enum):
    AUTO = "auto"
    MANUAL = "manual"


class HealthScoreClassification(str, enum.Enum):
    VERDE = "verde"
    AMARELO = "amarelo"
    VERMELHO = "vermelho"


def _uuid() -> str:
    return str(uuid.uuid4())


class HealthScoreIndicator(Base):
    """Catálogo de indicadores usados no cálculo do Health Score, com peso
    configurável (RF-092, RF-093). Indicadores 'auto' são calculados a
    partir de dados já existentes no sistema; 'manual' dependem de um valor
    informado pelo CS até que a integração real exista (RF-098)."""

    __tablename__ = "health_score_indicators"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    key: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(150), nullable=False)
    weight: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    source: Mapped[IndicatorSource] = mapped_column(Enum(IndicatorSource), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class HealthScoreManualValue(Base):
    """Valor manual mais recente de um indicador 'manual' para um cliente."""

    __tablename__ = "health_score_manual_values"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)
    indicator_key: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)

    updated_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class HealthScoreSnapshot(Base):
    """Histórico do Health Score calculado (RF-095), com os componentes que
    formaram a pontuação (RF-096) guardados como JSON."""

    __tablename__ = "health_score_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    score: Mapped[float] = mapped_column(Float, nullable=False)
    classification: Mapped[HealthScoreClassification] = mapped_column(
        Enum(HealthScoreClassification), nullable=False
    )
    components: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    calculated_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
