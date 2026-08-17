from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.health_score import HealthScoreClassification, IndicatorSource


class IndicatorCreate(BaseModel):
    key: str
    label: str
    weight: int = 10
    source: IndicatorSource
    is_active: bool = True


class IndicatorUpdate(BaseModel):
    label: str | None = None
    weight: int | None = None
    is_active: bool | None = None
    source: IndicatorSource | None = None


class IndicatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str
    label: str
    weight: int
    source: IndicatorSource
    is_active: bool


class ManualValueUpsert(BaseModel):
    indicator_key: str
    score: float


class ManualValueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    indicator_key: str
    score: float
    updated_at: datetime


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    score: float
    classification: HealthScoreClassification
    components: list[dict]
    calculated_at: datetime


class DeteriorationReasonOut(BaseModel):
    key: str
    label: str
    previous_value: float
    current_value: float
    drop: float
