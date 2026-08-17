from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class SalesHandoffBase(BaseModel):
    contract_reference: str | None = None
    scope: str | None = None
    products_summary: str | None = None
    modules_summary: str | None = None
    customizations: str | None = None
    integrations: str | None = None
    assumptions: str | None = None
    dependencies: str | None = None

    purchase_reason: str | None = None
    problem_to_solve: str | None = None
    contracting_objective: str | None = None
    expected_result: str | None = None
    expected_deadline: str | None = None
    sponsor_contact_id: str | None = None
    stakeholders_notes: str | None = None
    success_criteria: str | None = None
    perceived_risks: str | None = None

    participants: str | None = None
    handoff_date: date | None = None
    pending_items: str | None = None


class SalesHandoffCreate(SalesHandoffBase):
    pass


class SalesHandoffUpdate(BaseModel):
    contract_reference: str | None = None
    scope: str | None = None
    products_summary: str | None = None
    modules_summary: str | None = None
    customizations: str | None = None
    integrations: str | None = None
    assumptions: str | None = None
    dependencies: str | None = None

    purchase_reason: str | None = None
    problem_to_solve: str | None = None
    contracting_objective: str | None = None
    expected_result: str | None = None
    expected_deadline: str | None = None
    sponsor_contact_id: str | None = None
    stakeholders_notes: str | None = None
    success_criteria: str | None = None
    perceived_risks: str | None = None

    participants: str | None = None
    handoff_date: date | None = None
    pending_items: str | None = None


class SalesHandoffOut(SalesHandoffBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    completed_at: datetime | None
    completed_by_id: str | None
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


class ChecklistItemCreate(BaseModel):
    label: str
    order_index: int = 0


class ChecklistItemUpdate(BaseModel):
    label: str | None = None
    is_done: bool | None = None
    order_index: int | None = None


class ChecklistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_type: str
    owner_id: str
    label: str
    is_done: bool
    done_at: datetime | None
    done_by_id: str | None
    order_index: int
