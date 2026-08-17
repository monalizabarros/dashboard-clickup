from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.interaction import InteractionType


class InteractionBase(BaseModel):
    type: InteractionType
    description: str
    occurred_at: datetime
    attachment_url: str | None = None
    product_id: str | None = None
    module_id: str | None = None
    contact_id: str | None = None


class InteractionCreate(InteractionBase):
    pass


class InteractionOut(InteractionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    created_by_id: str | None
    created_at: datetime
