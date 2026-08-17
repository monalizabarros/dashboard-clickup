from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.client_module import ClientModule
from app.models.client_product import ClientProduct
from app.models.product import Module, Product
from app.models.user import User
from app.schemas.client_product import (
    ClientModuleCreate,
    ClientModuleOut,
    ClientModuleUpdate,
    ClientProductCreate,
    ClientProductOut,
    ClientProductUpdate,
)
from app.services.audit import log_audit

router = APIRouter(tags=["client-products"])

RESOURCE = "client_products"


def _serialize_cp(cp: ClientProduct) -> dict:
    return {
        "id": cp.id,
        "client_id": cp.client_id,
        "product_id": cp.product_id,
        "contracted_at": str(cp.contracted_at) if cp.contracted_at else None,
        "status": cp.status.value,
        "owner_user_id": cp.owner_user_id,
    }


def _serialize_cm(cm: ClientModule) -> dict:
    return {
        "id": cm.id,
        "client_id": cm.client_id,
        "module_id": cm.module_id,
        "contracted_at": str(cm.contracted_at) if cm.contracted_at else None,
        "is_implemented": cm.is_implemented,
        "usage_level": cm.usage_level.value,
    }


# --- Produtos contratados por cliente ---


@router.get("/clients/{client_id}/products", response_model=list[ClientProductOut])
def list_client_products(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return db.query(ClientProduct).filter(ClientProduct.client_id == client_id).all()


@router.post("/clients/{client_id}/products", response_model=ClientProductOut, status_code=status.HTTP_201_CREATED)
def create_client_product(
    client_id: str,
    payload: ClientProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    if not db.get(Product, payload.product_id):
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    if (
        db.query(ClientProduct)
        .filter(ClientProduct.client_id == client_id, ClientProduct.product_id == payload.product_id)
        .first()
    ):
        raise HTTPException(status_code=409, detail="Este produto já está contratado por este cliente.")

    cp = ClientProduct(client_id=client_id, **payload.model_dump())
    db.add(cp)
    db.commit()
    db.refresh(cp)

    log_audit(
        db, actor=current_user, action="create", resource_type=RESOURCE, resource_id=cp.id, after=_serialize_cp(cp)
    )
    return cp


@router.patch("/client-products/{client_product_id}", response_model=ClientProductOut)
def update_client_product(
    client_product_id: str,
    payload: ClientProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    cp = db.get(ClientProduct, client_product_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Vínculo cliente-produto não encontrado.")

    before = _serialize_cp(cp)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cp, field, value)
    db.commit()
    db.refresh(cp)

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type=RESOURCE,
        resource_id=cp.id,
        before=before,
        after=_serialize_cp(cp),
    )
    return cp


@router.delete("/client-products/{client_product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_product(
    client_product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    cp = db.get(ClientProduct, client_product_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Vínculo cliente-produto não encontrado.")

    before = _serialize_cp(cp)
    db.delete(cp)
    db.commit()

    log_audit(db, actor=current_user, action="delete", resource_type=RESOURCE, resource_id=client_product_id, before=before)


# --- Módulos contratados por cliente ---


@router.get("/clients/{client_id}/modules", response_model=list[ClientModuleOut])
def list_client_modules(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return db.query(ClientModule).filter(ClientModule.client_id == client_id).all()


@router.post("/clients/{client_id}/modules", response_model=ClientModuleOut, status_code=status.HTTP_201_CREATED)
def create_client_module(
    client_id: str,
    payload: ClientModuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    if not db.get(Module, payload.module_id):
        raise HTTPException(status_code=404, detail="Módulo não encontrado.")
    if (
        db.query(ClientModule)
        .filter(ClientModule.client_id == client_id, ClientModule.module_id == payload.module_id)
        .first()
    ):
        raise HTTPException(status_code=409, detail="Este módulo já está contratado por este cliente.")

    cm = ClientModule(client_id=client_id, **payload.model_dump())
    db.add(cm)
    db.commit()
    db.refresh(cm)

    log_audit(
        db, actor=current_user, action="create", resource_type="client_modules", resource_id=cm.id, after=_serialize_cm(cm)
    )
    return cm


@router.patch("/client-modules/{client_module_id}", response_model=ClientModuleOut)
def update_client_module(
    client_module_id: str,
    payload: ClientModuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    cm = db.get(ClientModule, client_module_id)
    if not cm:
        raise HTTPException(status_code=404, detail="Vínculo cliente-módulo não encontrado.")

    before = _serialize_cm(cm)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cm, field, value)
    db.commit()
    db.refresh(cm)

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type="client_modules",
        resource_id=cm.id,
        before=before,
        after=_serialize_cm(cm),
    )
    return cm


@router.delete("/client-modules/{client_module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_module(
    client_module_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    cm = db.get(ClientModule, client_module_id)
    if not cm:
        raise HTTPException(status_code=404, detail="Vínculo cliente-módulo não encontrado.")

    before = _serialize_cm(cm)
    db.delete(cm)
    db.commit()

    log_audit(
        db, actor=current_user, action="delete", resource_type="client_modules", resource_id=client_module_id, before=before
    )
