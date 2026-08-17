from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, has_permission
from app.models.checklist_item import ChecklistItem
from app.models.user import User
from app.schemas.sales_handoff import ChecklistItemOut, ChecklistItemUpdate

router = APIRouter(tags=["checklist-items"])

OWNER_TYPE_TO_RESOURCE = {
    "sales_handoff": "sales_handoffs",
    "delivery_handoff": "delivery_handoffs",
}


def _resource_for(item: ChecklistItem) -> str:
    resource = OWNER_TYPE_TO_RESOURCE.get(item.owner_type)
    if not resource:
        raise HTTPException(status_code=500, detail=f"owner_type desconhecido: {item.owner_type}")
    return resource


@router.patch("/checklist-items/{item_id}", response_model=ChecklistItemOut)
def update_checklist_item(
    item_id: str,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.get(ChecklistItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item de checklist não encontrado.")
    if not has_permission(db, current_user, _resource_for(item), "edit"):
        raise HTTPException(status_code=403, detail="Seu perfil não tem permissão de 'edit' neste checklist.")

    data = payload.model_dump(exclude_unset=True)
    if "is_done" in data:
        if data["is_done"]:
            item.done_at = datetime.now(timezone.utc)
            item.done_by_id = current_user.id
        else:
            item.done_at = None
            item.done_by_id = None
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/checklist-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.get(ChecklistItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item de checklist não encontrado.")
    if not has_permission(db, current_user, _resource_for(item), "edit"):
        raise HTTPException(status_code=403, detail="Seu perfil não tem permissão de 'edit' neste checklist.")
    db.delete(item)
    db.commit()
