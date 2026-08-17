from pydantic import BaseModel, ConfigDict

from app.models.alert_rule import AlertEventType


class AlertRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_type: AlertEventType
    name: str
    is_active: bool
    auto_create_task: bool


class AlertRuleUpdate(BaseModel):
    is_active: bool | None = None
    auto_create_task: bool | None = None


class ActiveAlertOut(BaseModel):
    event_type: AlertEventType
    client_id: str
    client_name: str
    message: str
    severity: str
