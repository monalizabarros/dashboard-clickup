from sqlalchemy import Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.client import TierLevel


class TierCadence(Base):
    """Cadência de check-in configurável por Tier de cliente (RF-086)."""

    __tablename__ = "tier_cadences"

    tier: Mapped[TierLevel] = mapped_column(Enum(TierLevel), primary_key=True)
    frequency_days: Mapped[int] = mapped_column(Integer, nullable=False)
