from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.client import ClientStatus, TierLevel


class ClientBase(BaseModel):
    corporate_name: str
    trade_name: str | None = None
    cnpj: str | None = None
    segment: str | None = None
    economic_group: str | None = None
    location: str | None = None
    relationship_start_date: date | None = None
    status: ClientStatus = ClientStatus.PROSPECT
    tier: TierLevel | None = None
    owner_user_id: str | None = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    corporate_name: str | None = None
    trade_name: str | None = None
    cnpj: str | None = None
    segment: str | None = None
    economic_group: str | None = None
    location: str | None = None
    relationship_start_date: date | None = None
    status: ClientStatus | None = None
    tier: TierLevel | None = None
    owner_user_id: str | None = None


class ClientOut(ClientBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class ClientOwnerHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    previous_owner_id: str | None
    new_owner_id: str | None
    changed_by_id: str | None
    changed_at: datetime


class UserOption(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    role: str
