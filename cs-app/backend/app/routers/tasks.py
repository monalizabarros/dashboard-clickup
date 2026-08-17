from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models.client import Client
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate, TaskWithClientOut
from app.services.audit import log_audit

router = APIRouter(tags=["tasks"])

RESOURCE = "tasks"


@router.get("/tasks", response_model=list[TaskWithClientOut])
def list_all_tasks(
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    responsible_user_id: str | None = Query(default=None),
    overdue: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    query = db.query(Task, Client).join(Client, Task.client_id == Client.id)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    if responsible_user_id:
        query = query.filter(Task.responsible_user_id == responsible_user_id)
    if overdue:
        today = date.today()
        query = query.filter(Task.due_date < today, Task.status != TaskStatus.CONCLUIDA)

    results = []
    for task, client in query.order_by(Task.due_date).all():
        data = TaskOut.model_validate(task).model_dump()
        data["client_name"] = client.trade_name or client.corporate_name
        results.append(data)
    return results


def _serialize(task: Task) -> dict:
    return {
        "id": task.id,
        "client_id": task.client_id,
        "title": task.title,
        "status": task.status.value,
        "due_date": str(task.due_date) if task.due_date else None,
        "responsible_user_id": task.responsible_user_id,
        "origin": task.origin,
    }


@router.get("/clients/{client_id}/tasks", response_model=list[TaskOut])
def list_tasks(
    client_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_permission(RESOURCE, "view")),
):
    return db.query(Task).filter(Task.client_id == client_id).order_by(Task.due_date).all()


@router.post("/clients/{client_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    client_id: str,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "create")),
):
    if not db.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    task = Task(client_id=client_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)

    log_audit(db, actor=current_user, action="create", resource_type=RESOURCE, resource_id=task.id, after=_serialize(task))
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "edit")),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    before = _serialize(task)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)

    log_audit(db, actor=current_user, action="update", resource_type=RESOURCE, resource_id=task.id, before=before, after=_serialize(task))
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(RESOURCE, "delete")),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    before = _serialize(task)
    db.delete(task)
    db.commit()

    log_audit(db, actor=current_user, action="delete", resource_type=RESOURCE, resource_id=task_id, before=before)
