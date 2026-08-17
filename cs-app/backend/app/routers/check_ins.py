from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.check_in import CheckIn
from app.models.client import Client
from app.models.tier_cadence import TierCadence
from app.models.user import User
from app.schemas.check_in import (
    CheckInComplete,
    CheckInCreate,
    CheckInOut,
    OverdueClientOut,
    TierCadenceOut,
    TierCadenceUpdate,
)
from app.services.audit import log_audit
from app.services.check_ins_overview import list_overdue_clients as compute_overdue_clients

router = APIRouter(tags=["check-ins"])

RESOURCE = "check_ins"
DEFAULT_FALLBACK_CADENCE_DAYS = 60  # usado quando o cliente não tem Tier definido


# --- Cadência por Tier (RF-086) ---


@router.get("/tier-cadences", response_model=list[TierCadenceOut])
def list_tier_cadences(
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(TierCadence).all()


@router.patch("/tier-cadences/{tier}", response_model=TierCadenceOut)
def update_tier_cadence(
    tier: str,
    payload: TierCadenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    cadence = db.get(TierCadence, tier)
    if not cadence:
        raise HTTPException(status_code=404, detail="Tier não encontrado.")
    cadence.frequency_days = payload.frequency_days
    db.commit()
    db.refresh(cadence)
    log_audit(db, actor=current_user, action="update", resource_type="tier_cadences", resource_id=tier, after={"frequency_days": cadence.frequency_days})
    return cadence


# --- Check-ins (RF-085, RF-088, RF-089) ---


@router.get("/clients/{client_id}/check-ins", response_model=list[CheckInOut])
def list_check_ins(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(CheckIn).filter(CheckIn.client_id == client_id).order_by(CheckIn.scheduled_at.desc()).all()


@router.post("/clients/{client_id}/check-ins", response_model=CheckInOut, status_code=status.HTTP_201_CREATED)
def schedule_check_in(
    client_id: str,
    payload: CheckInCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    check_in = CheckIn(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(check_in)
    db.commit()
    db.refresh(check_in)

    log_audit(db, actor=current_user, action="create", resource_type=RESOURCE, resource_id=check_in.id, after={"scheduled_at": str(check_in.scheduled_at)})
    return check_in


@router.post("/check-ins/{check_in_id}/complete", response_model=CheckInOut)
def complete_check_in(
    check_in_id: str,
    payload: CheckInComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    check_in = db.get(CheckIn, check_in_id)
    if not check_in:
        raise HTTPException(status_code=404, detail="Check-in não encontrado.")
    if check_in.completed_at:
        raise HTTPException(status_code=400, detail="Este check-in já foi concluído.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(check_in, field, value)
    check_in.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(check_in)

    log_audit(db, actor=current_user, action="update", resource_type=RESOURCE, resource_id=check_in.id, after={"completed_at": check_in.completed_at.isoformat()})

    # RF-089: gera automaticamente a próxima atividade conforme a cadência do Tier.
    client = db.get(Client, check_in.client_id)
    if client:
        cadence_days = DEFAULT_FALLBACK_CADENCE_DAYS
        if client.tier:
            cadence = db.get(TierCadence, client.tier)
            if cadence:
                cadence_days = cadence.frequency_days
        next_check_in = CheckIn(
            client_id=client.id,
            scheduled_at=date.today() + timedelta(days=cadence_days),
            created_by_id=current_user.id,
        )
        db.add(next_check_in)
        db.commit()

    db.refresh(check_in)
    return check_in


@router.delete("/check-ins/{check_in_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_check_in(
    check_in_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    check_in = db.get(CheckIn, check_in_id)
    if not check_in:
        raise HTTPException(status_code=404, detail="Check-in não encontrado.")
    db.delete(check_in)
    db.commit()
    log_audit(db, actor=current_user, action="delete", resource_type=RESOURCE, resource_id=check_in_id)


# --- Clientes sem contato dentro da periodicidade (RF-090) ---


@router.get("/check-ins/overdue-clients", response_model=list[OverdueClientOut])
def get_overdue_clients(
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return compute_overdue_clients(db)
