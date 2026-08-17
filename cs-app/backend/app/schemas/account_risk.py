from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.account_risk import RiskCategory, RiskImpact, RiskProbability, RiskStatus


class RiskBase(BaseModel):
    category: RiskCategory
    description: str
    impact: RiskImpact
    probability: RiskProbability
    responsible_user_id: str | None = None
    due_date: date | None = None
    status: RiskStatus = RiskStatus.ABERTO


class RiskCreate(RiskBase):
    pass


class RiskUpdate(BaseModel):
    category: RiskCategory | None = None
    description: str | None = None
    impact: RiskImpact | None = None
    probability: RiskProbability | None = None
    responsible_user_id: str | None = None
    due_date: date | None = None
    status: RiskStatus | None = None


class RiskOut(RiskBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    action_plan_id: str | None
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


class RiskWithClientOut(RiskOut):
    client_name: str
    is_critical: bool


class EvidenceCreate(BaseModel):
    description: str
    attachment_url: str | None = None


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    risk_id: str
    description: str
    attachment_url: str | None
    created_by_id: str | None
    created_at: datetime
