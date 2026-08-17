from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.interaction import Interaction
from app.models.user import User
from app.schemas.interaction import InteractionCreate, InteractionOut
from app.services.audit import log_audit

router = APIRouter(tags=["interactions"])

RESOURCE = "interactions"


@router.get("/clients/{client_id}/interactions", response_model=list[InteractionOut])
def list_interactions(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return (
        db.query(Interaction)
        .filter(Interaction.client_id == client_id)
        .order_by(Interaction.occurred_at.desc())
        .all()
    )


@router.post("/clients/{client_id}/interactions", response_model=InteractionOut, status_code=status.HTTP_201_CREATED)
def create_interaction(
    client_id: str,
    payload: InteractionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    interaction = Interaction(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(interaction)
    db.commit()
    db.refresh(interaction)

    log_audit(db, actor=current_user, action="create", resource_type=RESOURCE, resource_id=interaction.id, after={"type": interaction.type.value})
    return interaction


@router.delete("/interactions/{interaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interaction(
    interaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    interaction = db.get(Interaction, interaction_id)
    if not interaction:
        raise HTTPException(status_code=404, detail="Interação não encontrada.")
    db.delete(interaction)
    db.commit()
    log_audit(db, actor=current_user, action="delete", resource_type=RESOURCE, resource_id=interaction_id)
