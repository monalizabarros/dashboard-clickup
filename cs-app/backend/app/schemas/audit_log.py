from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str | None
    user_email: str | None
    action: str
    resource_type: str
    resource_id: str | None
    before: dict | None
    after: dict | None
    created_at: datetime
