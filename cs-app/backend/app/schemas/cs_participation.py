from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.cs_participation import ImplementationPhase


class PhaseParticipationUpsert(BaseModel):
    phase: ImplementationPhase
    participated: bool = False
    participation_date: date | None = None
    notes: str | None = None


class PhaseParticipationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    phase: ImplementationPhase
    participated: bool
    participation_date: date | None
    notes: str | None
    updated_at: datetime
