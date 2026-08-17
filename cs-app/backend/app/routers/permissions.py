from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models.permission import Permission
from app.models.user import RoleName, User
from app.schemas.permission import PermissionOut, PermissionUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("", response_model=list[PermissionOut])
def list_permissions(
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleName.ADMINISTRADOR)),
):
    return db.query(Permission).order_by(Permission.role, Permission.resource).all()


@router.patch("/{permission_id}", response_model=PermissionOut)
def update_permission(
    permission_id: str,
    payload: PermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.ADMINISTRADOR)),
):
    permission = db.get(Permission, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permissão não encontrada.")

    before = {
        "can_view": permission.can_view,
        "can_create": permission.can_create,
        "can_edit": permission.can_edit,
        "can_delete": permission.can_delete,
        "restricted_fields": permission.restricted_fields,
    }

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(permission, field, value)
    db.commit()
    db.refresh(permission)

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type="permissions",
        resource_id=permission.id,
        before=before,
        after={
            "can_view": permission.can_view,
            "can_create": permission.can_create,
            "can_edit": permission.can_edit,
            "can_delete": permission.can_delete,
            "restricted_fields": permission.restricted_fields,
        },
    )
    return permission
