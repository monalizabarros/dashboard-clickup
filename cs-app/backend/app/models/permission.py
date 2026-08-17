import uuid

from sqlalchemy import JSON, Boolean, Enum, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import RoleName


def _uuid() -> str:
    return str(uuid.uuid4())


class Permission(Base):
    """Matriz de permissão view/create/edit/delete por perfil x recurso (RF-003).

    `restricted_fields` guarda nomes de campos que devem ser ocultados desse
    recurso para esse perfil (RF-004), mesmo quando `can_view` é verdadeiro.
    """

    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("role", "resource", name="uq_permission_role_resource"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    role: Mapped[RoleName] = mapped_column(Enum(RoleName), nullable=False)
    resource: Mapped[str] = mapped_column(String(100), nullable=False)

    can_view: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_create: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    restricted_fields: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
