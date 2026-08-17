from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ModuleBase(BaseModel):
    name: str
    description: str | None = None


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ModuleOut(ModuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    created_at: datetime
    updated_at: datetime


class ProductBase(BaseModel):
    name: str
    description: str | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    modules: list[ModuleOut] = []
