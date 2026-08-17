from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.account_risk import AccountRisk, RiskImpact, RiskProbability, RiskStatus
from app.models.action_plan import ActionPlan, ActionPlanStatus
from app.models.check_in import CheckIn
from app.models.client import Client, ClientStatus
from app.models.client_module import ClientModule, UsageLevel
from app.models.delivery_handoff import DeliveryHandoff
from app.models.health_score import HealthScoreClassification, HealthScoreSnapshot
from app.models.implementation import ImplementationSituation, ImplementationSummary
from app.models.survey import Survey, SurveyType
from app.models.task import Task, TaskStatus
from app.schemas.dashboard import ExecutiveDashboardOut, OperationalDashboardOut
from app.services.check_ins_overview import list_overdue_client_ids

router = APIRouter(tags=["dashboard"])

RESOURCE = "dashboard"


@router.get("/dashboard/executive", response_model=ExecutiveDashboardOut)
def get_executive_dashboard(
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    clients = db.query(Client).all()
    total_clients = len(clients)
    churned = sum(1 for c in clients if c.status == ClientStatus.CHURN)
    in_renewal = sum(1 for c in clients if c.status == ClientStatus.EM_RENOVACAO)

    healthy = attention = at_risk = 0
    for client in clients:
        latest = (
            db.query(HealthScoreSnapshot)
            .filter(HealthScoreSnapshot.client_id == client.id)
            .order_by(HealthScoreSnapshot.calculated_at.desc())
            .first()
        )
        if not latest:
            continue
        if latest.classification == HealthScoreClassification.VERDE:
            healthy += 1
        elif latest.classification == HealthScoreClassification.AMARELO:
            attention += 1
        else:
            at_risk += 1

    nps_scores = [s.score for s in db.query(Survey).filter(Survey.type == SurveyType.NPS).all()]
    avg_nps = None
    if nps_scores:
        promoters = sum(1 for s in nps_scores if s >= 9)
        detractors = sum(1 for s in nps_scores if s <= 6)
        avg_nps = round(((promoters - detractors) / len(nps_scores)) * 100, 1)

    csat_scores = [s.score for s in db.query(Survey).filter(Survey.type == SurveyType.CSAT).all()]
    avg_csat = round(sum(csat_scores) / len(csat_scores), 2) if csat_scores else None

    usage_mapping = {UsageLevel.BAIXA: 30.0, UsageLevel.MEDIA: 65.0, UsageLevel.ALTA: 100.0}
    usage_values = [
        usage_mapping[m.usage_level]
        for m in db.query(ClientModule).filter(ClientModule.usage_level != UsageLevel.NAO_AVALIADO).all()
    ]
    avg_utilization = round(sum(usage_values) / len(usage_values), 1) if usage_values else None

    return ExecutiveDashboardOut(
        total_clients=total_clients,
        healthy_clients=healthy,
        attention_clients=attention,
        at_risk_clients=at_risk,
        churned_clients=churned,
        in_renewal_clients=in_renewal,
        avg_nps=avg_nps,
        avg_csat=avg_csat,
        avg_utilization=avg_utilization,
    )


@router.get("/dashboard/operational", response_model=OperationalDashboardOut)
def get_operational_dashboard(
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    today = date.today()

    open_tasks = db.query(Task).filter(Task.status != TaskStatus.CONCLUIDA).count()
    overdue_tasks = (
        db.query(Task)
        .filter(Task.status != TaskStatus.CONCLUIDA, Task.due_date.isnot(None), Task.due_date < today)
        .count()
    )
    pending_check_ins = db.query(CheckIn).filter(CheckIn.completed_at.is_(None)).count()
    clients_without_contact = len(list_overdue_client_ids(db))

    open_risks = db.query(AccountRisk).filter(
        AccountRisk.status.notin_([RiskStatus.MITIGADO, RiskStatus.ENCERRADO])
    ).count()
    critical_risks = (
        db.query(AccountRisk)
        .filter(
            AccountRisk.impact == RiskImpact.ALTO,
            AccountRisk.probability == RiskProbability.ALTA,
            AccountRisk.status.notin_([RiskStatus.MITIGADO, RiskStatus.ENCERRADO]),
        )
        .count()
    )

    recovery_plan_ids = [r.action_plan_id for r in db.query(AccountRisk).filter(AccountRisk.action_plan_id.isnot(None)).all()]
    recovery_plans_in_progress = 0
    if recovery_plan_ids:
        recovery_plans_in_progress = (
            db.query(ActionPlan)
            .filter(ActionPlan.id.in_(recovery_plan_ids), ActionPlan.status != ActionPlanStatus.CONCLUIDO)
            .count()
        )

    critical_implementations = (
        db.query(ImplementationSummary).filter(ImplementationSummary.situation == ImplementationSituation.ATRASADO).count()
    )

    clients_in_hypercare = (
        db.query(DeliveryHandoff)
        .filter(
            DeliveryHandoff.accepted_at.isnot(None),
            DeliveryHandoff.hypercare_end.isnot(None),
            DeliveryHandoff.hypercare_end >= today,
        )
        .count()
    )

    return OperationalDashboardOut(
        open_tasks=open_tasks,
        overdue_tasks=overdue_tasks,
        pending_check_ins=pending_check_ins,
        clients_without_contact=clients_without_contact,
        open_risks=open_risks,
        critical_risks=critical_risks,
        recovery_plans_in_progress=recovery_plans_in_progress,
        critical_implementations=critical_implementations,
        clients_in_hypercare=clients_in_hypercare,
    )
