from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission, require_roles
from app.models.checklist_item import ChecklistItem
from app.models.client import Client, ClientStatus
from app.models.delivery_handoff import DeliveryHandoff
from app.models.user import RoleName, User
from app.schemas.delivery_handoff import (
    DeliveryHandoffCreate,
    DeliveryHandoffOut,
    DeliveryHandoffUpdate,
)
from app.schemas.sales_handoff import ChecklistItemCreate, ChecklistItemOut
from app.services.audit import log_audit
from app.services.onboarding import start_onboarding_journey

router = APIRouter(tags=["delivery-handoffs"])

RESOURCE = "delivery_handoffs"
OWNER_TYPE = "delivery_handoff"


def _serialize(h: DeliveryHandoff) -> dict:
    return {
        "id": h.id,
        "client_id": h.client_id,
        "go_live_date": str(h.go_live_date) if h.go_live_date else None,
        "pending_items": h.pending_items,
        "accepted_at": h.accepted_at.isoformat() if h.accepted_at else None,
        "accepted_by_id": h.accepted_by_id,
    }


@router.get("/clients/{client_id}/delivery-handoffs", response_model=list[DeliveryHandoffOut])
def list_delivery_handoffs(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return (
        db.query(DeliveryHandoff)
        .filter(DeliveryHandoff.client_id == client_id)
        .order_by(DeliveryHandoff.created_at.desc())
        .all()
    )


@router.post("/clients/{client_id}/delivery-handoffs", response_model=DeliveryHandoffOut, status_code=status.HTTP_201_CREATED)
def create_delivery_handoff(
    client_id: str,
    payload: DeliveryHandoffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    handoff = DeliveryHandoff(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(handoff)
    db.commit()
    db.refresh(handoff)

    log_audit(db, actor=current_user, action="create", resource_type=RESOURCE, resource_id=handoff.id, after=_serialize(handoff))
    return handoff


@router.patch("/delivery-handoffs/{handoff_id}", response_model=DeliveryHandoffOut)
def update_delivery_handoff(
    handoff_id: str,
    payload: DeliveryHandoffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    handoff = db.get(DeliveryHandoff, handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff não encontrado.")
    if handoff.accepted_at:
        raise HTTPException(status_code=400, detail="Este handoff já foi aceito e não pode mais ser editado.")

    before = _serialize(handoff)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(handoff, field, value)
    db.commit()
    db.refresh(handoff)

    log_audit(db, actor=current_user, action="update", resource_type=RESOURCE, resource_id=handoff.id, before=before, after=_serialize(handoff))
    return handoff


@router.post("/delivery-handoffs/{handoff_id}/accept", response_model=DeliveryHandoffOut)
def accept_delivery_handoff(
    handoff_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.CS, RoleName.GESTOR_CS)),
):
    """Aceite formal do handoff por CS (RF-062). Ao aceitar, o estágio da
    conta muda automaticamente para operação recorrente (RF-063)."""
    handoff = db.get(DeliveryHandoff, handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff não encontrado.")
    if handoff.accepted_at:
        raise HTTPException(status_code=400, detail="Este handoff já foi aceito.")

    before = _serialize(handoff)
    handoff.accepted_at = datetime.now(timezone.utc)
    handoff.accepted_by_id = current_user.id
    db.commit()
    db.refresh(handoff)

    log_audit(db, actor=current_user, action="update", resource_type=RESOURCE, resource_id=handoff.id, before=before, after=_serialize(handoff))

    client = db.get(Client, handoff.client_id)
    if client and client.status != ClientStatus.ATIVO:
        client_before = {"status": client.status.value}
        client.status = ClientStatus.ATIVO
        db.commit()
        log_audit(
            db,
            actor=current_user,
            action="update",
            resource_type="clients",
            resource_id=client.id,
            before=client_before,
            after={"status": client.status.value},
        )

    # RF-077: a jornada de onboarding/adoção de CS nasce aqui, separada da
    # implantação técnica que Projetos acabou de encerrar.
    start_onboarding_journey(db, handoff.client_id)

    db.refresh(handoff)
    return handoff


# --- Checklist (RF-048) ---


@router.get("/delivery-handoffs/{handoff_id}/checklist", response_model=list[ChecklistItemOut])
def list_checklist(
    handoff_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    if not db.get(DeliveryHandoff, handoff_id):
        raise HTTPException(status_code=404, detail="Handoff não encontrado.")
    return (
        db.query(ChecklistItem)
        .filter(ChecklistItem.owner_type == OWNER_TYPE, ChecklistItem.owner_id == handoff_id)
        .order_by(ChecklistItem.order_index)
        .all()
    )


@router.post("/delivery-handoffs/{handoff_id}/checklist", response_model=ChecklistItemOut, status_code=status.HTTP_201_CREATED)
def create_checklist_item(
    handoff_id: str,
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    if not db.get(DeliveryHandoff, handoff_id):
        raise HTTPException(status_code=404, detail="Handoff não encontrado.")

    item = ChecklistItem(owner_type=OWNER_TYPE, owner_id=handoff_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)

    log_audit(db, actor=current_user, action="create", resource_type="checklist_items", resource_id=item.id, after={"label": item.label})
    return item
