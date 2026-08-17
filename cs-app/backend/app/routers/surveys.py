from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.survey import Survey, SurveyType
from app.models.task import Task, TaskPriority
from app.models.user import User
from app.schemas.survey import SurveyCreate, SurveyOut, SurveySummaryOut
from app.services.audit import log_audit

router = APIRouter(tags=["surveys"])

RESOURCE = "surveys"


def _is_negative(survey: Survey) -> bool:
    if survey.type == SurveyType.NPS:
        return survey.score <= 6
    return survey.score <= 2  # CSAT em escala 1-5


@router.get("/clients/{client_id}/surveys", response_model=list[SurveyOut])
def list_surveys(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(Survey).filter(Survey.client_id == client_id).order_by(Survey.survey_date.desc()).all()


@router.get("/clients/{client_id}/surveys/summary", response_model=SurveySummaryOut)
def get_summary(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    surveys = db.query(Survey).filter(Survey.client_id == client_id).all()
    nps_scores = [s.score for s in surveys if s.type == SurveyType.NPS]
    csat_scores = [s.score for s in surveys if s.type == SurveyType.CSAT]

    nps_score = None
    if nps_scores:
        promoters = sum(1 for s in nps_scores if s >= 9)
        detractors = sum(1 for s in nps_scores if s <= 6)
        nps_score = round(((promoters - detractors) / len(nps_scores)) * 100, 1)

    csat_average = round(sum(csat_scores) / len(csat_scores), 2) if csat_scores else None

    return SurveySummaryOut(nps_score=nps_score, csat_average=csat_average, total_responses=len(surveys))


@router.post("/clients/{client_id}/surveys", response_model=SurveyOut, status_code=status.HTTP_201_CREATED)
def create_survey(
    client_id: str,
    payload: SurveyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    survey = Survey(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(survey)
    db.commit()
    db.refresh(survey)

    log_audit(db, actor=current_user, action="create", resource_type=RESOURCE, resource_id=survey.id, after={"type": survey.type.value, "score": survey.score})

    # RF-108: resposta negativa gera automaticamente uma tarefa de acompanhamento.
    if _is_negative(survey):
        client_name = client.trade_name or client.corporate_name
        task = Task(
            client_id=client_id,
            title=f"Follow-up de resposta negativa ({survey.type.value.upper()}) — {client_name}",
            description=f"Nota {survey.score} registrada em {survey.survey_date}. Comentário: {survey.comment or '(sem comentário)'}",
            due_date=survey.survey_date + timedelta(days=3),
            priority=TaskPriority.ALTA,
            origin="satisfacao_negativa",
            created_by_id=current_user.id,
        )
        db.add(task)
        db.commit()

    db.refresh(survey)
    return survey


@router.delete("/surveys/{survey_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_survey(
    survey_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Pesquisa não encontrada.")
    db.delete(survey)
    db.commit()
    log_audit(db, actor=current_user, action="delete", resource_type=RESOURCE, resource_id=survey_id)
