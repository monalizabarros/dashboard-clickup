from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.implementation import (
    ImplementationEventType,
    ImplementationSituation,
    ImplementationStatus,
)


class ImplementationSummaryBase(BaseModel):
    status: ImplementationStatus = ImplementationStatus.NAO_INICIADO
    situation: ImplementationSituation = ImplementationSituation.NO_PRAZO
    expected_deadline: date | None = None
    external_link: str | None = None


class ImplementationSummaryUpsert(ImplementationSummaryBase):
    pass


class ImplementationSummaryOut(ImplementationSummaryBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    created_at: datetime
    updated_at: datetime


class MilestoneCreate(BaseModel):
    label: str
    target_date: date | None = None
    order_index: int = 0


class MilestoneUpdate(BaseModel):
    label: str | None = None
    target_date: date | None = None
    is_completed: bool | None = None
    order_index: int | None = None


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    label: str
    target_date: date | None
    is_completed: bool
    order_index: int


class EventCreate(BaseModel):
    type: ImplementationEventType
    description: str


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    type: ImplementationEventType
    description: str
    created_by_id: str | None
    created_at: datetime
