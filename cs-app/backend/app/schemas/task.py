from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.task import TaskPriority, TaskStatus


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    responsible_user_id: str | None = None
    due_date: date | None = None
    priority: TaskPriority = TaskPriority.MEDIA
    origin: str = "adocao"
    product_id: str | None = None
    action_plan_id: str | None = None
    status: TaskStatus = TaskStatus.ABERTA


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    responsible_user_id: str | None = None
    due_date: date | None = None
    priority: TaskPriority | None = None
    origin: str | None = None
    product_id: str | None = None
    action_plan_id: str | None = None
    status: TaskStatus | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


class TaskWithClientOut(TaskOut):
    client_name: str
