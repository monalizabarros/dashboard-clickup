from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.database import Base, engine
from app.migrations import run_light_migrations
from app.routers import (
    account_risks,
    action_plans,
    alerts,
    audit_logs,
    auth,
    check_ins,
    checklist_items,
    client_products,
    clients,
    contacts,
    cs_participation,
    dashboard,
    delivery_handoffs,
    health_score,
    implementation,
    interactions,
    onboarding,
    permissions,
    products,
    reports,
    sales_handoffs,
    search,
    surveys,
    tasks,
    users,
)

Base.metadata.create_all(bind=engine)
run_light_migrations(engine)

app = FastAPI(title="3Wings CS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(clients.router)
app.include_router(contacts.router)
app.include_router(products.router)
app.include_router(client_products.router)
app.include_router(sales_handoffs.router)
app.include_router(delivery_handoffs.router)
app.include_router(checklist_items.router)
app.include_router(interactions.router)
app.include_router(implementation.router)
app.include_router(cs_participation.router)
app.include_router(tasks.router)
app.include_router(action_plans.router)
app.include_router(onboarding.router)
app.include_router(check_ins.router)
app.include_router(health_score.router)
app.include_router(account_risks.router)
app.include_router(surveys.router)
app.include_router(dashboard.router)
app.include_router(alerts.router)
app.include_router(search.router)
app.include_router(reports.router)
app.include_router(permissions.router)
app.include_router(audit_logs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
