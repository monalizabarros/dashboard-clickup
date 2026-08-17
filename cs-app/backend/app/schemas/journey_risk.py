from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.journey_risk import JourneyRiskCategory


class JourneyRiskCreate(BaseModel):
    category: JourneyRiskCategory
    description: str


class JourneyRiskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    category: JourneyRiskCategory
    description: str
    created_by_id: str | None
    created_at: datetime


class ObjectiveCreate(BaseModel):
    description: str


class ObjectiveUpdate(BaseModel):
    description: str | None = None
    is_achieved: bool | None = None
    achieved_at: date | None = None


class ObjectiveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    description: str
    is_achieved: bool
    achieved_at: date | None
    created_by_id: str | None
    created_at: datetime
