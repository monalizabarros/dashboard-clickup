from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class OnboardingTemplateItemCreate(BaseModel):
    label: str
    order_index: int = 0


class OnboardingTemplateItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    label: str
    order_index: int


class OnboardingActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    label: str
    due_date: date | None
    is_completed: bool
    completed_at: datetime | None
    order_index: int


class OnboardingActivityCreate(BaseModel):
    label: str
    due_date: date | None = None
    order_index: int = 0


class OnboardingActivityUpdate(BaseModel):
    label: str | None = None
    due_date: date | None = None
    is_completed: bool | None = None


class OnboardingJourneyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    started_at: datetime
    first_usage_at: date | None


class AdoptionMilestoneCreate(BaseModel):
    label: str
    notes: str | None = None
    achieved_at: date


class AdoptionMilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    label: str
    notes: str | None
    achieved_at: date
    created_by_id: str | None
    created_at: datetime
