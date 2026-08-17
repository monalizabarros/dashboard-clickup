from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.client_module import UsageLevel
from app.models.client_product import ProductStatus


class ClientProductBase(BaseModel):
    product_id: str
    contracted_at: date | None = None
    status: ProductStatus = ProductStatus.NAO_INICIADO
    owner_user_id: str | None = None


class ClientProductCreate(ClientProductBase):
    pass


class ClientProductUpdate(BaseModel):
    contracted_at: date | None = None
    status: ProductStatus | None = None
    owner_user_id: str | None = None


class ClientProductOut(ClientProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    created_at: datetime
    updated_at: datetime


class ClientModuleBase(BaseModel):
    module_id: str
    contracted_at: date | None = None
    is_implemented: bool = False
    usage_level: UsageLevel = UsageLevel.NAO_AVALIADO


class ClientModuleCreate(ClientModuleBase):
    pass


class ClientModuleUpdate(BaseModel):
    contracted_at: date | None = None
    is_implemented: bool | None = None
    usage_level: UsageLevel | None = None


class ClientModuleOut(ClientModuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    created_at: datetime
    updated_at: datetime
