from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class DeliveryHandoffBase(BaseModel):
    contracted_scope: str | None = None
    delivered_scope: str | None = None
    pending_items: str | None = None
    customizations: str | None = None
    integrations: str | None = None
    known_limitations: str | None = None
    known_issues: str | None = None

    sponsor_contact_id: str | None = None
    stakeholders_notes: str | None = None
    business_objective: str | None = None
    success_criteria: str | None = None

    go_live_date: date | None = None
    hypercare_start: date | None = None
    hypercare_end: date | None = None
    next_adoption_steps: str | None = None


class DeliveryHandoffCreate(DeliveryHandoffBase):
    pass


class DeliveryHandoffUpdate(DeliveryHandoffBase):
    pass


class DeliveryHandoffOut(DeliveryHandoffBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    accepted_at: datetime | None
    accepted_by_id: str | None
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime
