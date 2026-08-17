from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.cs_participation import CSPhaseParticipation
from app.models.journey_risk import JourneyRisk, PostGoLiveObjective
from app.models.user import User
from app.schemas.cs_participation import PhaseParticipationOut, PhaseParticipationUpsert
from app.schemas.journey_risk import (
    JourneyRiskCreate,
    JourneyRiskOut,
    ObjectiveCreate,
    ObjectiveOut,
    ObjectiveUpdate,
)
from app.services.audit import log_audit

router = APIRouter(tags=["cs-participation"])

RESOURCE = "cs_participation"


# --- Participação por fase (RF-040 a RF-044) ---


@router.get("/clients/{client_id}/phase-participation", response_model=list[PhaseParticipationOut])
def list_phase_participation(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(CSPhaseParticipation).filter(CSPhaseParticipation.client_id == client_id).all()


@router.put("/clients/{client_id}/phase-participation", response_model=PhaseParticipationOut)
def upsert_phase_participation(
    client_id: str,
    payload: PhaseParticipationUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    record = (
        db.query(CSPhaseParticipation)
        .filter(CSPhaseParticipation.client_id == client_id, CSPhaseParticipation.phase == payload.phase)
        .first()
    )
    if not record:
        record = CSPhaseParticipation(client_id=client_id, **payload.model_dump())
        db.add(record)
    else:
        for field, value in payload.model_dump().items():
            setattr(record, field, value)

    db.commit()
    db.refresh(record)

    log_audit(
        db,
        actor=current_user,
        action="update",
        resource_type=RESOURCE,
        resource_id=record.id,
        after={"phase": record.phase.value, "participated": record.participated},
    )
    return record


# --- Riscos de jornada (RF-045) ---


@router.get("/clients/{client_id}/journey-risks", response_model=list[JourneyRiskOut])
def list_journey_risks(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return (
        db.query(JourneyRisk)
        .filter(JourneyRisk.client_id == client_id)
        .order_by(JourneyRisk.created_at.desc())
        .all()
    )


@router.post("/clients/{client_id}/journey-risks", response_model=JourneyRiskOut, status_code=status.HTTP_201_CREATED)
def create_journey_risk(
    client_id: str,
    payload: JourneyRiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    risk = JourneyRisk(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(risk)
    db.commit()
    db.refresh(risk)

    log_audit(db, actor=current_user, action="create", resource_type="journey_risks", resource_id=risk.id, after={"category": risk.category.value})
    return risk


@router.delete("/journey-risks/{risk_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journey_risk(
    risk_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "delete")),
):
    risk = db.get(JourneyRisk, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="Risco não encontrado.")
    db.delete(risk)
    db.commit()


# --- Objetivos pós-go-live (RF-046) ---


@router.get("/clients/{client_id}/objectives", response_model=list[ObjectiveOut])
def list_objectives(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return (
        db.query(PostGoLiveObjective)
        .filter(PostGoLiveObjective.client_id == client_id)
        .order_by(PostGoLiveObjective.created_at)
        .all()
    )


@router.post("/clients/{client_id}/objectives", response_model=ObjectiveOut, status_code=status.HTTP_201_CREATED)
def create_objective(
    client_id: str,
    payload: ObjectiveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    objective = PostGoLiveObjective(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(objective)
    db.commit()
    db.refresh(objective)

    log_audit(db, actor=current_user, action="create", resource_type="post_go_live_objectives", resource_id=objective.id)
    return objective


@router.patch("/objectives/{objective_id}", response_model=ObjectiveOut)
def update_objective(
    objective_id: str,
    payload: ObjectiveUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "edit")),
):
    objective = db.get(PostGoLiveObjective, objective_id)
    if not objective:
        raise HTTPException(status_code=404, detail="Objetivo não encontrado.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(objective, field, value)
    db.commit()
    db.refresh(objective)
    return objective


@router.delete("/objectives/{objective_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_objective(
    objective_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "delete")),
):
    objective = db.get(PostGoLiveObjective, objective_id)
    if not objective:
        raise HTTPException(status_code=404, detail="Objetivo não encontrado.")
    db.delete(objective)
    db.commit()
