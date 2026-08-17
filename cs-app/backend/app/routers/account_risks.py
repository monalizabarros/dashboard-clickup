from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.account_risk import (
    AccountRisk,
    RiskEvidence,
    RiskImpact,
    RiskProbability,
    RiskStatus,
)
from app.models.action_plan import ActionPlan
from app.models.client import Client
from app.models.user import User
from app.schemas.account_risk import (
    EvidenceCreate,
    EvidenceOut,
    RiskCreate,
    RiskOut,
    RiskUpdate,
    RiskWithClientOut,
)
from app.schemas.action_plan import ActionPlanOut
from app.services.audit import log_audit

router = APIRouter(tags=["risks"])

RESOURCE = "risks"


def _is_critical(risk: AccountRisk) -> bool:
    return risk.impact == RiskImpact.ALTO and risk.probability == RiskProbability.ALTA and risk.status not in (
        RiskStatus.MITIGADO,
        RiskStatus.ENCERRADO,
    )


def _serialize(risk: AccountRisk) -> dict:
    return {
        "id": risk.id,
        "client_id": risk.client_id,
        "category": risk.category.value,
        "impact": risk.impact.value,
        "probability": risk.probability.value,
        "status": risk.status.value,
    }


@router.get("/clients/{client_id}/risks", response_model=list[RiskOut])
def list_risks(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(AccountRisk).filter(AccountRisk.client_id == client_id).order_by(AccountRisk.created_at.desc()).all()


@router.post("/clients/{client_id}/risks", response_model=RiskOut, status_code=status.HTTP_201_CREATED)
def create_risk(
    client_id: str,
    payload: RiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    risk = AccountRisk(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(risk)
    db.commit()
    db.refresh(risk)

    log_audit(db, actor=current_user, action="create", resource_type=RESOURCE, resource_id=risk.id, after=_serialize(risk))
    return risk


@router.patch("/risks/{risk_id}", response_model=RiskOut)
def update_risk(
    risk_id: str,
    payload: RiskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    risk = db.get(AccountRisk, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="Risco não encontrado.")

    before = _serialize(risk)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(risk, field, value)
    db.commit()
    db.refresh(risk)

    log_audit(db, actor=current_user, action="update", resource_type=RESOURCE, resource_id=risk.id, before=before, after=_serialize(risk))
    return risk


@router.delete("/risks/{risk_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_risk(
    risk_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    risk = db.get(AccountRisk, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="Risco não encontrado.")
    db.delete(risk)
    db.commit()
    log_audit(db, actor=current_user, action="delete", resource_type=RESOURCE, resource_id=risk_id)


# --- Plano de recuperação (RF-102) ---


@router.post("/risks/{risk_id}/recovery-plan", response_model=ActionPlanOut, status_code=status.HTTP_201_CREATED)
def create_recovery_plan(
    risk_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    risk = db.get(AccountRisk, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="Risco não encontrado.")
    if risk.action_plan_id:
        raise HTTPException(status_code=400, detail="Este risco já tem um plano de recuperação vinculado.")

    plan = ActionPlan(
        client_id=risk.client_id,
        title=f"Customer Recovery Plan — {risk.category.value}",
        description=risk.description,
        created_by_id=current_user.id,
    )
    db.add(plan)
    db.flush()
    risk.action_plan_id = plan.id
    db.commit()
    db.refresh(plan)

    log_audit(db, actor=current_user, action="create", resource_type="action_plans", resource_id=plan.id, after={"title": plan.title, "risk_id": risk.id})
    return plan


# --- Evidências (RF-103) ---


@router.get("/risks/{risk_id}/evidence", response_model=list[EvidenceOut])
def list_evidence(
    risk_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(RiskEvidence).filter(RiskEvidence.risk_id == risk_id).order_by(RiskEvidence.created_at.desc()).all()


@router.post("/risks/{risk_id}/evidence", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
def create_evidence(
    risk_id: str,
    payload: EvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    if not db.get(AccountRisk, risk_id):
        raise HTTPException(status_code=404, detail="Risco não encontrado.")

    evidence = RiskEvidence(risk_id=risk_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    log_audit(db, actor=current_user, action="create", resource_type="risk_evidences", resource_id=evidence.id)
    return evidence


@router.delete("/risk-evidence/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "edit")),
):
    evidence = db.get(RiskEvidence, evidence_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidência não encontrada.")
    db.delete(evidence)
    db.commit()


# --- Riscos críticos (RF-101) ---


@router.get("/risks/critical", response_model=list[RiskWithClientOut])
def list_critical_risks(
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    results = []
    for risk, client in db.query(AccountRisk, Client).join(Client, AccountRisk.client_id == Client.id).all():
        if not _is_critical(risk):
            continue
        data = RiskOut.model_validate(risk).model_dump()
        data["client_name"] = client.trade_name or client.corporate_name
        data["is_critical"] = True
        results.append(data)
    return results
