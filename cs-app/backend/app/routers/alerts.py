from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.alert_rule import AlertRule
from app.models.user import User
from app.schemas.alert import ActiveAlertOut, AlertRuleOut, AlertRuleUpdate
from app.services.alerts import evaluate_active_alerts
from app.services.audit import log_audit

router = APIRouter(tags=["alerts"])

RESOURCE = "alerts"


@router.get("/alert-rules", response_model=list[AlertRuleOut])
def list_alert_rules(
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(AlertRule).all()


@router.patch("/alert-rules/{rule_id}", response_model=AlertRuleOut)
def update_alert_rule(
    rule_id: str,
    payload: AlertRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    rule = db.get(AlertRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Regra de alerta não encontrada.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    log_audit(db, actor=current_user, action="update", resource_type=RESOURCE, resource_id=rule.id, after={"is_active": rule.is_active, "auto_create_task": rule.auto_create_task})
    return rule


@router.get("/alerts/active", response_model=list[ActiveAlertOut])
def get_active_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "view")),
):
    return evaluate_active_alerts(db, actor_id=current_user.id)
