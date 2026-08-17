from datetime import date

from sqlalchemy.orm import Session

from app.models.check_in import CheckIn
from app.models.client import Client
from app.models.client_module import ClientModule, UsageLevel
from app.models.health_score import (
    HealthScoreClassification,
    HealthScoreIndicator,
    HealthScoreManualValue,
    HealthScoreSnapshot,
    IndicatorSource,
)
from app.models.implementation import ImplementationSituation, ImplementationSummary
from app.models.onboarding import OnboardingActivity, OnboardingJourney
from app.models.survey import Survey, SurveyType
from app.models.tier_cadence import TierCadence

# --- Indicadores automáticos: aproveitam dados já existentes no sistema. ---
# Indicadores manuais (ex: suporte) ficam prontos para alimentação
# automática quando os Blocos 13/17 existirem (RF-098).


def _implantacao_value(db: Session, client_id: str) -> float | None:
    summary = db.query(ImplementationSummary).filter(ImplementationSummary.client_id == client_id).first()
    if not summary:
        return None
    mapping = {
        ImplementationSituation.NO_PRAZO: 100.0,
        ImplementationSituation.EM_ATENCAO: 60.0,
        ImplementationSituation.ATRASADO: 20.0,
    }
    return mapping[summary.situation]


def _adocao_value(db: Session, client_id: str) -> float | None:
    journey = db.query(OnboardingJourney).filter(OnboardingJourney.client_id == client_id).first()
    if not journey:
        return None
    activities = db.query(OnboardingActivity).filter(OnboardingActivity.client_id == client_id).all()
    if not activities:
        return None
    done = sum(1 for a in activities if a.is_completed)
    return (done / len(activities)) * 100.0


def _relacionamento_value(db: Session, client_id: str) -> float | None:
    client = db.get(Client, client_id)
    if not client or not client.tier:
        return None
    cadence = db.get(TierCadence, client.tier)
    if not cadence:
        return None

    last = (
        db.query(CheckIn)
        .filter(CheckIn.client_id == client_id, CheckIn.completed_at.isnot(None))
        .order_by(CheckIn.completed_at.desc())
        .first()
    )
    last_date = last.completed_at.date() if last else client.relationship_start_date
    if not last_date:
        return 0.0

    days_since = (date.today() - last_date).days
    if days_since <= cadence.frequency_days:
        return 100.0
    return max(0.0, 100.0 - (days_since - cadence.frequency_days))


def _utilizacao_value(db: Session, client_id: str) -> float | None:
    modules = (
        db.query(ClientModule)
        .filter(ClientModule.client_id == client_id, ClientModule.usage_level != UsageLevel.NAO_AVALIADO)
        .all()
    )
    if not modules:
        return None
    mapping = {UsageLevel.BAIXA: 30.0, UsageLevel.MEDIA: 65.0, UsageLevel.ALTA: 100.0}
    values = [mapping[m.usage_level] for m in modules]
    return sum(values) / len(values)


def _satisfacao_value(db: Session, client_id: str) -> float | None:
    """RF-098 concretizado: usa as respostas reais de NPS/CSAT (Bloco 14)
    em vez de depender só de valor manual. Considera as respostas mais
    recentes de cada tipo; normaliza NPS (0-10) e CSAT (1-5) para 0-100."""
    surveys = (
        db.query(Survey)
        .filter(Survey.client_id == client_id)
        .order_by(Survey.survey_date.desc())
        .limit(10)
        .all()
    )
    if not surveys:
        return None

    normalized = []
    for s in surveys:
        if s.type == SurveyType.NPS:
            normalized.append((s.score / 10) * 100)
        else:  # CSAT, escala 1-5
            normalized.append((s.score / 5) * 100)
    return sum(normalized) / len(normalized)


AUTO_VALUE_FUNCS = {
    "implantacao": _implantacao_value,
    "adocao": _adocao_value,
    "relacionamento": _relacionamento_value,
    "utilizacao": _utilizacao_value,
    "satisfacao": _satisfacao_value,
}


def calculate_health_score(db: Session, client_id: str, actor_id: str | None = None) -> HealthScoreSnapshot:
    indicators = db.query(HealthScoreIndicator).filter(HealthScoreIndicator.is_active.is_(True)).all()
    manual_values = {
        v.indicator_key: v.score
        for v in db.query(HealthScoreManualValue).filter(HealthScoreManualValue.client_id == client_id).all()
    }

    components = []
    weighted_sum = 0.0
    weight_total = 0.0

    for indicator in indicators:
        if indicator.source == IndicatorSource.AUTO:
            func = AUTO_VALUE_FUNCS.get(indicator.key)
            value = func(db, client_id) if func else None
        else:
            value = manual_values.get(indicator.key)

        if value is None:
            continue

        weighted_sum += value * indicator.weight
        weight_total += indicator.weight
        components.append({"key": indicator.key, "label": indicator.label, "value": round(value, 1), "weight": indicator.weight})

    score = round(weighted_sum / weight_total, 1) if weight_total > 0 else 50.0

    if score >= 70:
        classification = HealthScoreClassification.VERDE
    elif score >= 40:
        classification = HealthScoreClassification.AMARELO
    else:
        classification = HealthScoreClassification.VERMELHO

    snapshot = HealthScoreSnapshot(
        client_id=client_id,
        score=score,
        classification=classification,
        components=components,
        calculated_by_id=actor_id,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def get_deterioration_reasons(db: Session, client_id: str) -> list[dict]:
    """RF-097: compara o snapshot mais recente com o anterior e aponta quais
    componentes pioraram."""
    snapshots = (
        db.query(HealthScoreSnapshot)
        .filter(HealthScoreSnapshot.client_id == client_id)
        .order_by(HealthScoreSnapshot.calculated_at.desc())
        .limit(2)
        .all()
    )
    if len(snapshots) < 2:
        return []

    latest, previous = snapshots[0], snapshots[1]
    prev_by_key = {c["key"]: c["value"] for c in previous.components}

    reasons = []
    for c in latest.components:
        prev_value = prev_by_key.get(c["key"])
        if prev_value is not None and c["value"] < prev_value:
            reasons.append(
                {
                    "key": c["key"],
                    "label": c["label"],
                    "previous_value": prev_value,
                    "current_value": c["value"],
                    "drop": round(prev_value - c["value"], 1),
                }
            )
    reasons.sort(key=lambda r: r["drop"], reverse=True)
    return reasons
