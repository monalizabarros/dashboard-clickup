from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.onboarding import (
    AdoptionMilestone,
    OnboardingActivity,
    OnboardingJourney,
    OnboardingTemplateItem,
)
from app.models.product import Product
from app.models.user import User
from app.schemas.onboarding import (
    AdoptionMilestoneCreate,
    AdoptionMilestoneOut,
    OnboardingActivityCreate,
    OnboardingActivityOut,
    OnboardingActivityUpdate,
    OnboardingJourneyOut,
    OnboardingTemplateItemCreate,
    OnboardingTemplateItemOut,
)
from app.services.audit import log_audit
from app.services.onboarding import start_onboarding_journey

router = APIRouter(tags=["onboarding"])

TEMPLATE_RESOURCE = "products"
ONBOARDING_RESOURCE = "onboarding"


# --- Templates de onboarding por produto (RF-078) ---


@router.get("/products/{product_id}/onboarding-template", response_model=list[OnboardingTemplateItemOut])
def list_template_items(
    product_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(TEMPLATE_RESOURCE, "view")),
):
    return (
        db.query(OnboardingTemplateItem)
        .filter(OnboardingTemplateItem.product_id == product_id)
        .order_by(OnboardingTemplateItem.order_index)
        .all()
    )


@router.post("/products/{product_id}/onboarding-template", response_model=OnboardingTemplateItemOut, status_code=status.HTTP_201_CREATED)
def create_template_item(
    product_id: str,
    payload: OnboardingTemplateItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(TEMPLATE_RESOURCE, "edit")),
):
    if not db.get(Product, product_id):
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    item = OnboardingTemplateItem(product_id=product_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    log_audit(db, actor=current_user, action="create", resource_type="onboarding_template_items", resource_id=item.id, after={"label": item.label})
    return item


@router.delete("/onboarding-template-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template_item(
    item_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(TEMPLATE_RESOURCE, "edit")),
):
    item = db.get(OnboardingTemplateItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item de template não encontrado.")
    db.delete(item)
    db.commit()


# --- Jornada do cliente (RF-077, RF-079 a RF-082) ---


class OnboardingStateOut(BaseModel):
    journey: OnboardingJourneyOut | None
    activities: list[OnboardingActivityOut]
    progress_percent: float


@router.get("/clients/{client_id}/onboarding", response_model=OnboardingStateOut)
def get_onboarding_state(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(ONBOARDING_RESOURCE, "view")),
):
    journey = db.query(OnboardingJourney).filter(OnboardingJourney.client_id == client_id).first()
    activities = (
        db.query(OnboardingActivity)
        .filter(OnboardingActivity.client_id == client_id)
        .order_by(OnboardingActivity.order_index)
        .all()
    )
    total = len(activities)
    done = sum(1 for a in activities if a.is_completed)
    progress = round((done / total) * 100, 1) if total else 0.0

    return OnboardingStateOut(journey=journey, activities=activities, progress_percent=progress)


@router.post("/clients/{client_id}/onboarding/start", response_model=OnboardingJourneyOut)
def start_onboarding(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(ONBOARDING_RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    journey = start_onboarding_journey(db, client_id)
    log_audit(db, actor=current_user, action="create", resource_type="onboarding_journeys", resource_id=journey.id)
    return journey


class FirstUsagePayload(BaseModel):
    first_usage_date: date


@router.post("/clients/{client_id}/onboarding/first-usage", response_model=OnboardingJourneyOut)
def register_first_usage(
    client_id: str,
    payload: FirstUsagePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(ONBOARDING_RESOURCE, "edit")),
):
    journey = db.query(OnboardingJourney).filter(OnboardingJourney.client_id == client_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="Jornada de onboarding ainda não iniciada.")
    journey.first_usage_at = payload.first_usage_date
    db.commit()
    db.refresh(journey)
    log_audit(db, actor=current_user, action="update", resource_type="onboarding_journeys", resource_id=journey.id, after={"first_usage_at": str(journey.first_usage_at)})
    return journey


@router.post("/clients/{client_id}/onboarding/activities", response_model=OnboardingActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(
    client_id: str,
    payload: OnboardingActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(ONBOARDING_RESOURCE, "edit")),
):
    activity = OnboardingActivity(client_id=client_id, **payload.model_dump())
    db.add(activity)
    db.commit()
    db.refresh(activity)
    log_audit(db, actor=current_user, action="create", resource_type="onboarding_activities", resource_id=activity.id, after={"label": activity.label})
    return activity


@router.patch("/onboarding-activities/{activity_id}", response_model=OnboardingActivityOut)
def update_activity(
    activity_id: str,
    payload: OnboardingActivityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(ONBOARDING_RESOURCE, "edit")),
):
    activity = db.get(OnboardingActivity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")

    data = payload.model_dump(exclude_unset=True)
    if "is_completed" in data:
        activity.completed_at = datetime.now(timezone.utc) if data["is_completed"] else None
    for field, value in data.items():
        setattr(activity, field, value)
    db.commit()
    db.refresh(activity)
    log_audit(db, actor=current_user, action="update", resource_type="onboarding_activities", resource_id=activity.id)
    return activity


# --- Marcos de adoção (RF-083) ---


@router.get("/clients/{client_id}/adoption-milestones", response_model=list[AdoptionMilestoneOut])
def list_adoption_milestones(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(ONBOARDING_RESOURCE, "view")),
):
    return (
        db.query(AdoptionMilestone)
        .filter(AdoptionMilestone.client_id == client_id)
        .order_by(AdoptionMilestone.achieved_at.desc())
        .all()
    )


@router.post("/clients/{client_id}/adoption-milestones", response_model=AdoptionMilestoneOut, status_code=status.HTTP_201_CREATED)
def create_adoption_milestone(
    client_id: str,
    payload: AdoptionMilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(ONBOARDING_RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    milestone = AdoptionMilestone(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    log_audit(db, actor=current_user, action="create", resource_type="adoption_milestones", resource_id=milestone.id, after={"label": milestone.label})
    return milestone


@router.delete("/adoption-milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_adoption_milestone(
    milestone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(ONBOARDING_RESOURCE, "delete")),
):
    milestone = db.get(AdoptionMilestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Marco não encontrado.")
    db.delete(milestone)
    db.commit()
