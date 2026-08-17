from pydantic import BaseModel, ConfigDict

from app.models.user import RoleName


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: RoleName
    resource: str
    can_view: bool
    can_create: bool
    can_edit: bool
    can_delete: bool
    restricted_fields: list[str]


class PermissionUpdate(BaseModel):
    can_view: bool | None = None
    can_create: bool | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    restricted_fields: list[str] | None = None
