from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.contact import Contact
from app.models.user import User
from app.schemas.contact import ContactCreate, ContactOut, ContactUpdate
from app.services.audit import log_audit

router = APIRouter(tags=["contacts"])

RESOURCE = "contacts"


def _serialize(contact: Contact) -> dict:
    return {
        "id": contact.id,
        "client_id": contact.client_id,
        "name": contact.name,
        "role_title": contact.role_title,
        "area": contact.area,
        "email": contact.email,
        "phone": contact.phone,
        "status": contact.status.value,
        "influence_level": contact.influence_level.value,
        "stakeholder_type": contact.stakeholder_type.value,
        "is_main_sponsor": contact.is_main_sponsor,
    }


def _unset_other_sponsors(db: Session, client_id: str, keep_contact_id: str | None):
    others = (
        db.query(Contact)
        .filter(Contact.client_id == client_id, Contact.is_main_sponsor.is_(True))
        .all()
    )
    for other in others:
        if other.id != keep_contact_id:
            other.is_main_sponsor = False


@router.get("/clients/{client_id}/contacts", response_model=list[ContactOut])
def list_contacts(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return db.query(Contact).filter(Contact.client_id == client_id).order_by(Contact.name).all()


@router.post("/clients/{client_id}/contacts", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
def create_contact(
    client_id: str,
    payload: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    contact = Contact(client_id=client_id, **payload.model_dump())
    db.add(contact)
    db.flush()

    if contact.is_main_sponsor:
        _unset_other_sponsors(db, client_id, keep_contact_id=contact.id)

    db.commit()
    db.refresh(contact)

    log_audit(
        db,
        actor=current_user,
        action="create",
        resource_type=RESOURCE,
        resource_id=contact.id,
        after=_serialize(contact),
    )
    return contact


@router.patch("/contacts/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: str,
    payload: ContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    contact = db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado.")

    before = _serialize(contact)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(contact, field, value)

    if data.get("is_main_sponsor") is True:
        _unset_other_sponsors(db, contact.client_id, keep_contact_id=contact.id)

    db.commit()
    db.refresh(contact)

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type=RESOURCE,
        resource_id=contact.id,
        before=before,
        after=_serialize(contact),
    )
    return contact


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    contact = db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado.")

    before = _serialize(contact)
    db.delete(contact)
    db.commit()

    log_audit(
        db,
        actor=current_user,
        action="delete",
        resource_type=RESOURCE,
        resource_id=contact_id,
        before=before,
    )
