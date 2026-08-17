import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SurveyType(str, enum.Enum):
    NPS = "nps"
    CSAT = "csat"


def _uuid() -> str:
    return str(uuid.uuid4())


class Survey(Base):
    """Resposta de pesquisa de satisfação NPS ou CSAT (RF-104 a RF-107).

    NPS usa escala 0-10 (RF-108: detrator = nota <= 6). CSAT usa escala 1-5
    (RF-108: negativo = nota <= 2).
    """

    __tablename__ = "surveys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    type: Mapped[SurveyType] = mapped_column(Enum(SurveyType), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    survey_date: Mapped[date] = mapped_column(Date, nullable=False)

    respondent_contact_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("contacts.id"), nullable=True)
    respondent_name: Mapped[str | None] = mapped_column(String(150), nullable=True)

    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
