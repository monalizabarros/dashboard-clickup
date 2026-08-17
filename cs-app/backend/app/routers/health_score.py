from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.health_score import HealthScoreIndicator, HealthScoreManualValue, HealthScoreSnapshot
from app.models.user import User
from app.schemas.health_score import (
    DeteriorationReasonOut,
    IndicatorCreate,
    IndicatorOut,
    IndicatorUpdate,
    ManualValueOut,
    ManualValueUpsert,
    SnapshotOut,
)
from app.services.audit import log_audit
from app.services.health_score import calculate_health_score, get_deterioration_reasons

router = APIRouter(tags=["health-score"])

CONFIG_RESOURCE = "health_score_config"
RESOURCE = "health_score"


# --- Catálogo de indicadores (RF-092, RF-093) ---


@router.get("/health-score-indicators", response_model=list[IndicatorOut])
def list_indicators(
    db: Session = Depends(get_db),
    _=Depends(require_permission(CONFIG_RESOURCE, "view")),
):
    return db.query(HealthScoreIndicator).all()


@router.post("/health-score-indicators", response_model=IndicatorOut, status_code=status.HTTP_201_CREATED)
def create_indicator(
    payload: IndicatorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(CONFIG_RESOURCE, "create")),
):
    if db.query(HealthScoreIndicator).filter(HealthScoreIndicator.key == payload.key).first():
        raise HTTPException(status_code=409, detail="Já existe um indicador com esta chave.")
    indicator = HealthScoreIndicator(**payload.model_dump())
    db.add(indicator)
    db.commit()
    db.refresh(indicator)
    log_audit(db, actor=current_user, action="create", resource_type=CONFIG_RESOURCE, resource_id=indicator.id, after={"key": indicator.key})
    return indicator


@router.patch("/health-score-indicators/{indicator_id}", response_model=IndicatorOut)
def update_indicator(
    indicator_id: str,
    payload: IndicatorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(CONFIG_RESOURCE, "edit")),
):
    indicator = db.get(HealthScoreIndicator, indicator_id)
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador não encontrado.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(indicator, field, value)
    db.commit()
    db.refresh(indicator)
    log_audit(db, actor=current_user, action="update", resource_type=CONFIG_RESOURCE, resource_id=indicator.id)
    return indicator


@router.delete("/health-score-indicators/{indicator_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_indicator(
    indicator_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(CONFIG_RESOURCE, "delete")),
):
    indicator = db.get(HealthScoreIndicator, indicator_id)
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador não encontrado.")
    db.delete(indicator)
    db.commit()
    log_audit(db, actor=current_user, action="delete", resource_type=CONFIG_RESOURCE, resource_id=indicator_id)


# --- Valores manuais por cliente ---


@router.get("/clients/{client_id}/health-score-manual-values", response_model=list[ManualValueOut])
def list_manual_values(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(HealthScoreManualValue).filter(HealthScoreManualValue.client_id == client_id).all()


@router.put("/clients/{client_id}/health-score-manual-values", response_model=ManualValueOut)
def upsert_manual_value(
    client_id: str,
    payload: ManualValueUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    value = (
        db.query(HealthScoreManualValue)
        .filter(HealthScoreManualValue.client_id == client_id, HealthScoreManualValue.indicator_key == payload.indicator_key)
        .first()
    )
    if not value:
        value = HealthScoreManualValue(client_id=client_id, indicator_key=payload.indicator_key, score=payload.score, updated_by_id=current_user.id)
        db.add(value)
    else:
        value.score = payload.score
        value.updated_by_id = current_user.id

    db.commit()
    db.refresh(value)
    log_audit(db, actor=current_user, action="update", resource_type=RESOURCE, resource_id=value.id, after={"indicator_key": value.indicator_key, "score": value.score})
    return value


# --- Cálculo, histórico e motivos de deterioração ---


@router.post("/clients/{client_id}/health-score/calculate", response_model=SnapshotOut)
def calculate(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    snapshot = calculate_health_score(db, client_id, actor_id=current_user.id)
    log_audit(db, actor=current_user, action="create", resource_type="health_score_snapshots", resource_id=snapshot.id, after={"score": snapshot.score, "classification": snapshot.classification.value})
    return snapshot


@router.get("/clients/{client_id}/health-score/latest", response_model=SnapshotOut | None)
def get_latest(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return (
        db.query(HealthScoreSnapshot)
        .filter(HealthScoreSnapshot.client_id == client_id)
        .order_by(HealthScoreSnapshot.calculated_at.desc())
        .first()
    )


@router.get("/clients/{client_id}/health-score/history", response_model=list[SnapshotOut])
def get_history(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return (
        db.query(HealthScoreSnapshot)
        .filter(HealthScoreSnapshot.client_id == client_id)
        .order_by(HealthScoreSnapshot.calculated_at.desc())
        .all()
    )


@router.get("/clients/{client_id}/health-score/deterioration-reasons", response_model=list[DeteriorationReasonOut])
def get_deterioration(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return get_deterioration_reasons(db, client_id)
