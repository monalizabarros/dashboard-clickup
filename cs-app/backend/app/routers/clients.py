from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client, ClientOwnerHistory
from app.models.user import User
from app.schemas.client import (
    ClientCreate,
    ClientOut,
    ClientOwnerHistoryOut,
    ClientUpdate,
)
from app.services.audit import log_audit

router = APIRouter(prefix="/clients", tags=["clients"])

RESOURCE = "clients"


def _serialize(client: Client) -> dict:
    return {
        "id": client.id,
        "corporate_name": client.corporate_name,
        "trade_name": client.trade_name,
        "cnpj": client.cnpj,
        "segment": client.segment,
        "economic_group": client.economic_group,
        "location": client.location,
        "relationship_start_date": str(client.relationship_start_date)
        if client.relationship_start_date
        else None,
        "status": client.status.value,
        "owner_user_id": client.owner_user_id,
    }


@router.get("", response_model=list[ClientOut])
def list_clients(
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(Client).order_by(Client.corporate_name).all()


@router.get("/{client_id}", response_model=ClientOut)
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return client


@router.get("/{client_id}/owner-history", response_model=list[ClientOwnerHistoryOut])
def get_client_owner_history(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return (
        db.query(ClientOwnerHistory)
        .filter(ClientOwnerHistory.client_id == client_id)
        .order_by(ClientOwnerHistory.changed_at.desc())
        .all()
    )


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if payload.cnpj and db.query(Client).filter(Client.cnpj == payload.cnpj).first():
        raise HTTPException(status_code=409, detail="Já existe um cliente com este CNPJ.")

    client = Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)

    if client.owner_user_id:
        db.add(
            ClientOwnerHistory(
                client_id=client.id,
                previous_owner_id=None,
                new_owner_id=client.owner_user_id,
                changed_by_id=current_user.id,
            )
        )
        db.commit()

    log_audit(
        db,
        actor=current_user,
        action="create",
        resource_type=RESOURCE,
        resource_id=client.id,
        after=_serialize(client),
    )
    return client


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: str,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    before = _serialize(client)
    previous_owner_id = client.owner_user_id

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(client, field, value)

    owner_changed = "owner_user_id" in data and data["owner_user_id"] != previous_owner_id

    db.commit()
    db.refresh(client)

    if owner_changed:
        db.add(
            ClientOwnerHistory(
                client_id=client.id,
                previous_owner_id=previous_owner_id,
                new_owner_id=client.owner_user_id,
                changed_by_id=current_user.id,
            )
        )
        db.commit()

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type=RESOURCE,
        resource_id=client.id,
        before=before,
        after=_serialize(client),
    )
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    before = _serialize(client)
    db.delete(client)
    db.commit()

    log_audit(
        db,
        actor=current_user,
        action="delete",
        resource_type=RESOURCE,
        resource_id=client_id,
        before=before,
    )
