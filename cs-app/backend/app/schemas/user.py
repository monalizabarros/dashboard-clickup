from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import RoleName


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: RoleName


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: str | None = None
    role: RoleName | None = None
    is_active: bool | None = None
    password: str | None = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
