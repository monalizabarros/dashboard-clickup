import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.client_module import ClientModule, UsageLevel
from app.models.health_score import HealthScoreSnapshot
from app.models.onboarding import OnboardingActivity, OnboardingJourney
from app.models.product import Module
from app.models.survey import Survey, SurveyType

router = APIRouter(tags=["reports"])

RESOURCE = "dashboard"


def _csv_response(rows: list[list], header: list[str], filename: str) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/carteira.csv")
def report_portfolio(db: Session = Depends(get_db), _=Depends(require_permission(RESOURCE, "view"))):
    rows = [
        [c.corporate_name, c.trade_name or "", c.cnpj or "", c.segment or "", c.status.value, c.tier.value if c.tier else "", c.owner_user_id or ""]
        for c in db.query(Client).order_by(Client.corporate_name).all()
    ]
    return _csv_response(rows, ["Razão social", "Nome fantasia", "CNPJ", "Segmento", "Status", "Tier", "Responsável (id)"], "carteira.csv")


@router.get("/reports/health-score.csv")
def report_health_score(db: Session = Depends(get_db), _=Depends(require_permission(RESOURCE, "view"))):
    rows = []
    for client in db.query(Client).order_by(Client.corporate_name).all():
        latest = (
            db.query(HealthScoreSnapshot)
            .filter(HealthScoreSnapshot.client_id == client.id)
            .order_by(HealthScoreSnapshot.calculated_at.desc())
            .first()
        )
        rows.append([
            client.trade_name or client.corporate_name,
            latest.score if latest else "",
            latest.classification.value if latest else "",
            latest.calculated_at.isoformat() if latest else "",
        ])
    return _csv_response(rows, ["Cliente", "Score", "Classificação", "Calculado em"], "health-score.csv")


@router.get("/reports/satisfacao.csv")
def report_satisfaction(db: Session = Depends(get_db), _=Depends(require_permission(RESOURCE, "view"))):
    rows = []
    for s, client in db.query(Survey, Client).join(Client, Survey.client_id == Client.id).order_by(Survey.survey_date.desc()).all():
        rows.append([
            client.trade_name or client.corporate_name,
            s.type.value.upper(),
            s.score,
            s.survey_date.isoformat(),
            s.respondent_name or "",
            s.comment or "",
        ])
    return _csv_response(rows, ["Cliente", "Tipo", "Nota", "Data", "Respondente", "Comentário"], "satisfacao.csv")


@router.get("/reports/onboarding.csv")
def report_onboarding(db: Session = Depends(get_db), _=Depends(require_permission(RESOURCE, "view"))):
    rows = []
    for client in db.query(Client).order_by(Client.corporate_name).all():
        journey = db.query(OnboardingJourney).filter(OnboardingJourney.client_id == client.id).first()
        if not journey:
            continue
        activities = db.query(OnboardingActivity).filter(OnboardingActivity.client_id == client.id).all()
        total = len(activities)
        done = sum(1 for a in activities if a.is_completed)
        progress = round((done / total) * 100, 1) if total else 0.0
        rows.append([
            client.trade_name or client.corporate_name,
            journey.started_at.date().isoformat(),
            journey.first_usage_at.isoformat() if journey.first_usage_at else "",
            f"{done}/{total}",
            progress,
        ])
    return _csv_response(rows, ["Cliente", "Início", "Primeira utilização", "Atividades concluídas", "Progresso (%)"], "onboarding.csv")


@router.get("/reports/utilizacao.csv")
def report_utilization(db: Session = Depends(get_db), _=Depends(require_permission(RESOURCE, "view"))):
    rows = []
    for cm, module, client in (
        db.query(ClientModule, Module, Client)
        .join(Module, ClientModule.module_id == Module.id)
        .join(Client, ClientModule.client_id == Client.id)
        .order_by(Client.corporate_name)
        .all()
    ):
        rows.append([
            client.trade_name or client.corporate_name,
            module.name,
            "Sim" if cm.is_implemented else "Não",
            cm.usage_level.value if cm.usage_level != UsageLevel.NAO_AVALIADO else "Não avaliado",
        ])
    return _csv_response(rows, ["Cliente", "Módulo", "Implantado", "Utilização"], "utilizacao.csv")
