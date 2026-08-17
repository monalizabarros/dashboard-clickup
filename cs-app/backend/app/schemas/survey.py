from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.survey import SurveyType


class SurveyCreate(BaseModel):
    type: SurveyType
    score: int
    comment: str | None = None
    survey_date: date
    respondent_contact_id: str | None = None
    respondent_name: str | None = None


class SurveyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    type: SurveyType
    score: int
    comment: str | None
    survey_date: date
    respondent_contact_id: str | None
    respondent_name: str | None
    created_by_id: str | None
    created_at: datetime


class SurveySummaryOut(BaseModel):
    nps_score: float | None
    csat_average: float | None
    total_responses: int
