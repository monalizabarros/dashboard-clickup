from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.action_plan import ActionPlan
from app.models.client import Client
from app.models.user import User
from app.schemas.action_plan import ActionPlanCreate, ActionPlanOut, ActionPlanUpdate
from app.services.audit import log_audit

router = APIRouter(tags=["action-plans"])

RESOURCE = "action_plans"


@router.get("/clients/{client_id}/action-plans", response_model=list[ActionPlanOut])
def list_action_plans(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(ActionPlan).filter(ActionPlan.client_id == client_id).order_by(ActionPlan.created_at.desc()).all()


@router.post("/clients/{client_id}/action-plans", response_model=ActionPlanOut, status_code=status.HTTP_201_CREATED)
def create_action_plan(
    client_id: str,
    payload: ActionPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    plan = ActionPlan(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)

    log_audit(db, actor=current_user, action="create", resource_type=RESOURCE, resource_id=plan.id, after={"title": plan.title})
    return plan


@router.patch("/action-plans/{plan_id}", response_model=ActionPlanOut)
def update_action_plan(
    plan_id: str,
    payload: ActionPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    plan = db.get(ActionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano de ação não encontrado.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)

    log_audit(db, actor=current_user, action="update", resource_type=RESOURCE, resource_id=plan.id)
    return plan


@router.delete("/action-plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    plan = db.get(ActionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano de ação não encontrado.")
    db.delete(plan)
    db.commit()
    log_audit(db, actor=current_user, action="delete", resource_type=RESOURCE, resource_id=plan_id)
