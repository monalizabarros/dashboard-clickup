from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.action_plan import ActionPlanStatus


class ActionPlanCreate(BaseModel):
    title: str
    description: str | None = None
    status: ActionPlanStatus = ActionPlanStatus.ABERTO


class ActionPlanUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: ActionPlanStatus | None = None


class ActionPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    title: str
    description: str | None
    status: ActionPlanStatus
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime
