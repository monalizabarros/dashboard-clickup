from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.implementation import (
    ImplementationEvent,
    ImplementationMilestone,
    ImplementationSummary,
)
from app.models.user import User
from app.schemas.implementation import (
    EventCreate,
    EventOut,
    ImplementationSummaryOut,
    ImplementationSummaryUpsert,
    MilestoneCreate,
    MilestoneOut,
    MilestoneUpdate,
)
from app.services.audit import log_audit

router = APIRouter(tags=["implementation"])

RESOURCE = "implementation"


def _serialize_summary(s: ImplementationSummary) -> dict:
    return {
        "id": s.id,
        "client_id": s.client_id,
        "status": s.status.value,
        "situation": s.situation.value,
        "expected_deadline": str(s.expected_deadline) if s.expected_deadline else None,
        "external_link": s.external_link,
    }


@router.get("/clients/{client_id}/implementation-summary", response_model=ImplementationSummaryOut)
def get_summary(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    summary = db.query(ImplementationSummary).filter(ImplementationSummary.client_id == client_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Nenhum resumo de implantação registrado ainda.")
    return summary


@router.put("/clients/{client_id}/implementation-summary", response_model=ImplementationSummaryOut)
def upsert_summary(
    client_id: str,
    payload: ImplementationSummaryUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    summary = db.query(ImplementationSummary).filter(ImplementationSummary.client_id == client_id).first()
    action = "update"
    before = _serialize_summary(summary) if summary else None

    if not summary:
        summary = ImplementationSummary(client_id=client_id, **payload.model_dump())
        db.add(summary)
        action = "create"
    else:
        for field, value in payload.model_dump().items():
            setattr(summary, field, value)

    db.commit()
    db.refresh(summary)

    log_audit(
        db,
        actor=current_user,
        action=action,
        resource_type=RESOURCE,
        resource_id=summary.id,
        before=before,
        after=_serialize_summary(summary),
    )
    return summary


# --- Marcos ---


@router.get("/clients/{client_id}/milestones", response_model=list[MilestoneOut])
def list_milestones(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return (
        db.query(ImplementationMilestone)
        .filter(ImplementationMilestone.client_id == client_id)
        .order_by(ImplementationMilestone.order_index)
        .all()
    )


@router.post("/clients/{client_id}/milestones", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
def create_milestone(
    client_id: str,
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    milestone = ImplementationMilestone(client_id=client_id, **payload.model_dump())
    db.add(milestone)
    db.commit()
    db.refresh(milestone)

    log_audit(db, actor=current_user, action="create", resource_type="implementation_milestones", resource_id=milestone.id, after={"label": milestone.label})
    return milestone


@router.patch("/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: str,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "edit")),
):
    milestone = db.get(ImplementationMilestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Marco não encontrado.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, field, value)
    db.commit()
    db.refresh(milestone)
    return milestone


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(
    milestone_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "edit")),
):
    milestone = db.get(ImplementationMilestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Marco não encontrado.")
    db.delete(milestone)
    db.commit()


# --- Riscos, impedimentos, dependências e decisões ---


@router.get("/clients/{client_id}/implementation-events", response_model=list[EventOut])
def list_events(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return (
        db.query(ImplementationEvent)
        .filter(ImplementationEvent.client_id == client_id)
        .order_by(ImplementationEvent.created_at.desc())
        .all()
    )


@router.post("/clients/{client_id}/implementation-events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    client_id: str,
    payload: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    event = ImplementationEvent(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)

    log_audit(db, actor=current_user, action="create", resource_type="implementation_events", resource_id=event.id, after={"type": event.type.value})
    return event


@router.delete("/implementation-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "delete")),
):
    event = db.get(ImplementationEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    db.delete(event)
    db.commit()
