from sqlalchemy.orm import Session

from app.models.account_risk import AccountRisk, RiskImpact, RiskProbability, RiskStatus
from app.models.alert_rule import AlertEventType, AlertRule
from app.models.client import Client
from app.models.client_module import ClientModule, UsageLevel
from app.models.health_score import HealthScoreClassification, HealthScoreSnapshot
from app.models.implementation import ImplementationSituation, ImplementationSummary
from app.models.survey import Survey, SurveyType
from app.models.task import Task, TaskPriority, TaskStatus
from app.services.check_ins_overview import list_overdue_clients
from app.services.health_score import get_deterioration_reasons


def _client_name(client: Client) -> str:
    return client.trade_name or client.corporate_name


def _evaluate_sem_contato(db: Session) -> list[dict]:
    return [
        {
            "event_type": AlertEventType.SEM_CONTATO,
            "client_id": r["client_id"],
            "client_name": r["client_name"],
            "message": f"Sem contato há {r['days_since_last_contact']} dia(s) (cadência: {r['cadence_days']} dias)."
            if r["days_since_last_contact"] is not None
            else "Nenhum check-in registrado ainda.",
            "severity": "alta",
        }
        for r in list_overdue_clients(db)
    ]


def _evaluate_queda_utilizacao(db: Session) -> list[dict]:
    """Aproximação: como o sistema ainda não guarda histórico de utilização
    (viria da integração de analytics do Bloco 15/V3, RF-152), usamos
    utilização atual baixa como proxy de queda."""
    results = []
    for client in db.query(Client).all():
        modules = (
            db.query(ClientModule)
            .filter(ClientModule.client_id == client.id, ClientModule.usage_level != UsageLevel.NAO_AVALIADO)
            .all()
        )
        if not modules:
            continue
        low = sum(1 for m in modules if m.usage_level == UsageLevel.BAIXA)
        if low / len(modules) >= 0.5:
            results.append(
                {
                    "event_type": AlertEventType.QUEDA_UTILIZACAO,
                    "client_id": client.id,
                    "client_name": _client_name(client),
                    "message": f"{low} de {len(modules)} módulo(s) com utilização baixa.",
                    "severity": "media",
                }
            )
    return results


def _evaluate_mudanca_health_score(db: Session) -> list[dict]:
    results = []
    for client in db.query(Client).all():
        latest = (
            db.query(HealthScoreSnapshot)
            .filter(HealthScoreSnapshot.client_id == client.id)
            .order_by(HealthScoreSnapshot.calculated_at.desc())
            .first()
        )
        if not latest:
            continue
        reasons = get_deterioration_reasons(db, client.id)
        if latest.classification == HealthScoreClassification.VERMELHO or any(r["drop"] >= 20 for r in reasons):
            worst = max(reasons, key=lambda r: r["drop"], default=None)
            message = (
                f"Health Score crítico ({latest.score})."
                if latest.classification == HealthScoreClassification.VERMELHO
                else f"Queda de {worst['drop']} pontos em '{worst['label']}'."
            )
            results.append(
                {
                    "event_type": AlertEventType.MUDANCA_HEALTH_SCORE,
                    "client_id": client.id,
                    "client_name": _client_name(client),
                    "message": message,
                    "severity": "alta",
                }
            )
    return results


def _evaluate_satisfacao_negativa(db: Session) -> list[dict]:
    results = []
    for survey in db.query(Survey).order_by(Survey.survey_date.desc()).all():
        negative = survey.score <= 6 if survey.type == SurveyType.NPS else survey.score <= 2
        if not negative:
            continue
        client = db.get(Client, survey.client_id)
        if not client:
            continue
        results.append(
            {
                "event_type": AlertEventType.SATISFACAO_NEGATIVA,
                "client_id": client.id,
                "client_name": _client_name(client),
                "message": f"Resposta {survey.type.value.upper()} {survey.score} em {survey.survey_date}.",
                "severity": "alta",
            }
        )
    return results


def _evaluate_implantacao_atrasada(db: Session) -> list[dict]:
    results = []
    query = db.query(ImplementationSummary).filter(ImplementationSummary.situation == ImplementationSituation.ATRASADO)
    for summary in query.all():
        client = db.get(Client, summary.client_id)
        if not client:
            continue
        results.append(
            {
                "event_type": AlertEventType.IMPLANTACAO_ATRASADA,
                "client_id": client.id,
                "client_name": _client_name(client),
                "message": "Implantação está atrasada.",
                "severity": "alta",
            }
        )
    return results


def _evaluate_risco_critico(db: Session) -> list[dict]:
    results = []
    for risk, client in db.query(AccountRisk, Client).join(Client, AccountRisk.client_id == Client.id).all():
        if (
            risk.impact == RiskImpact.ALTO
            and risk.probability == RiskProbability.ALTA
            and risk.status not in (RiskStatus.MITIGADO, RiskStatus.ENCERRADO)
        ):
            results.append(
                {
                    "event_type": AlertEventType.RISCO_CRITICO,
                    "client_id": client.id,
                    "client_name": _client_name(client),
                    "message": f"Risco crítico em aberto: {risk.description}",
                    "severity": "alta",
                }
            )
    return results


EVALUATORS = {
    AlertEventType.SEM_CONTATO: _evaluate_sem_contato,
    AlertEventType.QUEDA_UTILIZACAO: _evaluate_queda_utilizacao,
    AlertEventType.MUDANCA_HEALTH_SCORE: _evaluate_mudanca_health_score,
    AlertEventType.SATISFACAO_NEGATIVA: _evaluate_satisfacao_negativa,
    AlertEventType.IMPLANTACAO_ATRASADA: _evaluate_implantacao_atrasada,
    AlertEventType.RISCO_CRITICO: _evaluate_risco_critico,
    # RENOVACAO_PROXIMA e RENOVACAO_RISCO ficam sem avaliador: não há data de
    # renovação de contrato no sistema ainda (Bloco de Renovação não construído).
}


def evaluate_active_alerts(db: Session, actor_id: str | None = None) -> list[dict]:
    rules = {r.event_type: r for r in db.query(AlertRule).all()}
    alerts: list[dict] = []

    for event_type, evaluator in EVALUATORS.items():
        rule = rules.get(event_type)
        if not rule or not rule.is_active:
            continue
        for alert in evaluator(db):
            alerts.append(alert)
            if rule.auto_create_task:
                _ensure_task(db, alert, actor_id)

    return alerts


def _ensure_task(db: Session, alert: dict, actor_id: str | None) -> None:
    origin = f"alerta_{alert['event_type'].value}"
    existing = (
        db.query(Task)
        .filter(Task.client_id == alert["client_id"], Task.origin == origin, Task.status != TaskStatus.CONCLUIDA)
        .first()
    )
    if existing:
        return
    task = Task(
        client_id=alert["client_id"],
        title=f"[Alerta] {alert['message']}",
        description=alert["message"],
        priority=TaskPriority.ALTA,
        origin=origin,
        created_by_id=actor_id,
    )
    db.add(task)
    db.commit()
