from pydantic import BaseModel


class ExecutiveDashboardOut(BaseModel):
    total_clients: int
    healthy_clients: int
    attention_clients: int
    at_risk_clients: int
    churned_clients: int
    in_renewal_clients: int
    avg_nps: float | None
    avg_csat: float | None
    avg_utilization: float | None


class OperationalDashboardOut(BaseModel):
    open_tasks: int
    overdue_tasks: int
    pending_check_ins: int
    clients_without_contact: int
    open_risks: int
    critical_risks: int
    recovery_plans_in_progress: int
    critical_implementations: int
    clients_in_hypercare: int
