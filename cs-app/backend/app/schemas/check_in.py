from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.client import TierLevel


class CheckInCreate(BaseModel):
    scheduled_at: date


class CheckInComplete(BaseModel):
    client_perception: str | None = None
    problems: str | None = None
    opportunities: str | None = None
    feedback: str | None = None
    decisions: str | None = None
    commitments: str | None = None
    next_steps: str | None = None


class CheckInOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    scheduled_at: date
    completed_at: datetime | None
    client_perception: str | None
    problems: str | None
    opportunities: str | None
    feedback: str | None
    decisions: str | None
    commitments: str | None
    next_steps: str | None
    created_by_id: str | None
    created_at: datetime


class TierCadenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tier: TierLevel
    frequency_days: int


class TierCadenceUpdate(BaseModel):
    frequency_days: int


class OverdueClientOut(BaseModel):
    client_id: str
    client_name: str
    tier: TierLevel | None
    last_check_in_at: date | None
    cadence_days: int | None
    days_since_last_contact: int | None
