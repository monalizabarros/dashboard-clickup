from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.contact import ContactStatus, InfluenceLevel, StakeholderType


class ContactBase(BaseModel):
    name: str
    role_title: str | None = None
    area: str | None = None
    email: str | None = None
    phone: str | None = None
    status: ContactStatus = ContactStatus.ATIVO
    influence_level: InfluenceLevel = InfluenceLevel.MEDIO
    stakeholder_type: StakeholderType = StakeholderType.OUTRO
    is_main_sponsor: bool = False


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: str | None = None
    role_title: str | None = None
    area: str | None = None
    email: str | None = None
    phone: str | None = None
    status: ContactStatus | None = None
    influence_level: InfluenceLevel | None = None
    stakeholder_type: StakeholderType | None = None
    is_main_sponsor: bool | None = None


class ContactOut(ContactBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    created_at: datetime
    updated_at: datetime
