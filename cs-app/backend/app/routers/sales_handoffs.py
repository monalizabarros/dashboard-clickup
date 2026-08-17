from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.checklist_item import ChecklistItem
from app.models.client import Client
from app.models.sales_handoff import SalesHandoff
from app.models.user import User
from app.schemas.sales_handoff import (
    ChecklistItemCreate,
    ChecklistItemOut,
    SalesHandoffCreate,
    SalesHandoffOut,
    SalesHandoffUpdate,
)
from app.services.audit import log_audit

router = APIRouter(tags=["sales-handoffs"])

RESOURCE = "sales_handoffs"
OWNER_TYPE = "sales_handoff"


def _serialize(h: SalesHandoff) -> dict:
    return {
        "id": h.id,
        "client_id": h.client_id,
        "contract_reference": h.contract_reference,
        "scope": h.scope,
        "handoff_date": str(h.handoff_date) if h.handoff_date else None,
        "pending_items": h.pending_items,
        "completed_at": h.completed_at.isoformat() if h.completed_at else None,
        "completed_by_id": h.completed_by_id,
    }


@router.get("/clients/{client_id}/sales-handoffs", response_model=list[SalesHandoffOut])
def list_sales_handoffs(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return (
        db.query(SalesHandoff)
        .filter(SalesHandoff.client_id == client_id)
        .order_by(SalesHandoff.created_at.desc())
        .all()
    )


@router.post("/clients/{client_id}/sales-handoffs", response_model=SalesHandoffOut, status_code=status.HTTP_201_CREATED)
def create_sales_handoff(
    client_id: str,
    payload: SalesHandoffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    handoff = SalesHandoff(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(handoff)
    db.commit()
    db.refresh(handoff)

    log_audit(
        db,
        actor=current_user,
        action="create",
        resource_type=RESOURCE,
        resource_id=handoff.id,
        after=_serialize(handoff),
    )
    return handoff


@router.patch("/sales-handoffs/{handoff_id}", response_model=SalesHandoffOut)
def update_sales_handoff(
    handoff_id: str,
    payload: SalesHandoffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    handoff = db.get(SalesHandoff, handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff não encontrado.")

    before = _serialize(handoff)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(handoff, field, value)
    db.commit()
    db.refresh(handoff)

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type=RESOURCE,
        resource_id=handoff.id,
        before=before,
        after=_serialize(handoff),
    )
    return handoff


@router.post("/sales-handoffs/{handoff_id}/complete", response_model=SalesHandoffOut)
def complete_sales_handoff(
    handoff_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    handoff = db.get(SalesHandoff, handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff não encontrado.")
    if handoff.completed_at:
        raise HTTPException(status_code=400, detail="Este handoff já foi concluído.")

    before = _serialize(handoff)
    handoff.completed_at = datetime.now(timezone.utc)
    handoff.completed_by_id = current_user.id
    db.commit()
    db.refresh(handoff)

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type=RESOURCE,
        resource_id=handoff.id,
        before=before,
        after=_serialize(handoff),
    )
    return handoff


@router.delete("/sales-handoffs/{handoff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_handoff(
    handoff_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    handoff = db.get(SalesHandoff, handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff não encontrado.")

    before = _serialize(handoff)
    db.delete(handoff)
    db.commit()

    log_audit(db, actor=current_user, action="delete", resource_type=RESOURCE, resource_id=handoff_id, before=before)


# --- Checklist (RF-028) ---


@router.get("/sales-handoffs/{handoff_id}/checklist", response_model=list[ChecklistItemOut])
def list_checklist(
    handoff_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    if not db.get(SalesHandoff, handoff_id):
        raise HTTPException(status_code=404, detail="Handoff não encontrado.")
    return (
        db.query(ChecklistItem)
        .filter(ChecklistItem.owner_type == OWNER_TYPE, ChecklistItem.owner_id == handoff_id)
        .order_by(ChecklistItem.order_index)
        .all()
    )


@router.post("/sales-handoffs/{handoff_id}/checklist", response_model=ChecklistItemOut, status_code=status.HTTP_201_CREATED)
def create_checklist_item(
    handoff_id: str,
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    if not db.get(SalesHandoff, handoff_id):
        raise HTTPException(status_code=404, detail="Handoff não encontrado.")

    item = ChecklistItem(owner_type=OWNER_TYPE, owner_id=handoff_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)

    log_audit(db, actor=current_user, action="create", resource_type="checklist_items", resource_id=item.id, after={"label": item.label})
    return item
