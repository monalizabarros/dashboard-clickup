from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.product import Module, Product
from app.models.user import User
from app.schemas.product import (
    ModuleCreate,
    ModuleOut,
    ModuleUpdate,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from app.services.audit import log_audit

router = APIRouter(tags=["products"])

RESOURCE = "products"


def _serialize_product(product: Product) -> dict:
    return {"id": product.id, "name": product.name, "description": product.description}


def _serialize_module(module: Module) -> dict:
    return {
        "id": module.id,
        "product_id": module.product_id,
        "name": module.name,
        "description": module.description,
    }


@router.get("/products", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(Product).order_by(Product.name).all()


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if db.query(Product).filter(Product.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Já existe um produto com este nome.")

    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)

    log_audit(
        db,
        actor=current_user,
        action="create",
        resource_type=RESOURCE,
        resource_id=product.id,
        after=_serialize_product(product),
    )
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    before = _serialize_product(product)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type=RESOURCE,
        resource_id=product.id,
        before=before,
        after=_serialize_product(product),
    )
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    before = _serialize_product(product)
    db.delete(product)
    db.commit()

    log_audit(
        db,
        actor=current_user,
        action="delete",
        resource_type=RESOURCE,
        resource_id=product_id,
        before=before,
    )


@router.post("/products/{product_id}/modules", response_model=ModuleOut, status_code=status.HTTP_201_CREATED)
def create_module(
    product_id: str,
    payload: ModuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Product, product_id):
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    module = Module(product_id=product_id, **payload.model_dump())
    db.add(module)
    db.commit()
    db.refresh(module)

    log_audit(
        db,
        actor=current_user,
        action="create",
        resource_type="modules",
        resource_id=module.id,
        after=_serialize_module(module),
    )
    return module


@router.patch("/modules/{module_id}", response_model=ModuleOut)
def update_module(
    module_id: str,
    payload: ModuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Módulo não encontrado.")

    before = _serialize_module(module)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(module, field, value)
    db.commit()
    db.refresh(module)

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type="modules",
        resource_id=module.id,
        before=before,
        after=_serialize_module(module),
    )
    return module


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Módulo não encontrado.")

    before = _serialize_module(module)
    db.delete(module)
    db.commit()

    log_audit(
        db,
        actor=current_user,
        action="delete",
        resource_type="modules",
        resource_id=module_id,
        before=before,
    )
