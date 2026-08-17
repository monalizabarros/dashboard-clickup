from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.permission import Permission
from app.models.user import RoleName, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_error
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_error
    return user


def require_roles(*roles: RoleName):
    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == RoleName.ADMINISTRADOR:
            return current_user
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seu perfil não tem acesso a este recurso.",
            )
        return current_user

    return _dependency


def has_permission(db: Session, user: User, resource: str, action: str) -> bool:
    """action: 'view' | 'create' | 'edit' | 'delete'"""
    if user.role == RoleName.ADMINISTRADOR:
        return True
    permission = (
        db.query(Permission)
        .filter(Permission.role == user.role, Permission.resource == resource)
        .first()
    )
    return bool(permission and getattr(permission, f"can_{action}", False))


def require_permission(resource: str, action: str):
    """action: 'view' | 'create' | 'edit' | 'delete'"""

    def _dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not has_permission(db, current_user, resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Seu perfil não tem permissão de '{action}' em '{resource}'.",
            )
        return current_user

    return _dependency
