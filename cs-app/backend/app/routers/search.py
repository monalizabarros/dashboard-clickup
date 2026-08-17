from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, has_permission
from app.models.account_risk import AccountRisk
from app.models.client import Client
from app.models.contact import Contact
from app.models.product import Product
from app.models.task import Task
from app.models.user import User
from app.schemas.search import SearchResultItem, SearchResultsOut

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResultsOut)
def global_search(
    q: str = Query(min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca global (RF-147). Cada tipo de resultado só aparece se o
    perfil do usuário tiver permissão de visualização no recurso
    correspondente — reaproveita a mesma matriz de permissões do resto do
    sistema em vez de expor tudo indiscriminadamente."""
    term = f"%{q.lower()}%"
    results: list[SearchResultItem] = []

    if has_permission(db, current_user, "clients", "view"):
        for c in db.query(Client).filter(
            (Client.corporate_name.ilike(term)) | (Client.trade_name.ilike(term)) | (Client.cnpj.ilike(term))
        ).limit(10).all():
            results.append(SearchResultItem(type="cliente", id=c.id, label=c.trade_name or c.corporate_name, subtitle=c.segment, client_id=c.id))

    if has_permission(db, current_user, "contacts", "view"):
        for ct in db.query(Contact).filter(Contact.name.ilike(term)).limit(10).all():
            results.append(SearchResultItem(type="contato", id=ct.id, label=ct.name, subtitle=ct.role_title, client_id=ct.client_id))

    if has_permission(db, current_user, "products", "view"):
        for p in db.query(Product).filter(Product.name.ilike(term)).limit(10).all():
            results.append(SearchResultItem(type="produto", id=p.id, label=p.name, subtitle=p.description))

    if has_permission(db, current_user, "tasks", "view"):
        for t in db.query(Task).filter(Task.title.ilike(term)).limit(10).all():
            results.append(SearchResultItem(type="tarefa", id=t.id, label=t.title, subtitle=t.status.value, client_id=t.client_id))

    if has_permission(db, current_user, "risks", "view"):
        for r in db.query(AccountRisk).filter(AccountRisk.description.ilike(term)).limit(10).all():
            results.append(SearchResultItem(type="risco", id=r.id, label=r.description, subtitle=r.category.value, client_id=r.client_id))

    return SearchResultsOut(query=q, results=results)
