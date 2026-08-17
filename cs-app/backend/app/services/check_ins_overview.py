from datetime import date

from sqlalchemy.orm import Session

from app.models.check_in import CheckIn
from app.models.client import Client
from app.models.tier_cadence import TierCadence


def list_overdue_clients(db: Session) -> list[dict]:
    """RF-090: clientes sem contato dentro da periodicidade definida pelo
    Tier. Reaproveitado pelo router de check-ins, pelo dashboard (Bloco 15)
    e pelo motor de alertas (Bloco 15)."""
    cadences = {c.tier: c.frequency_days for c in db.query(TierCadence).all()}
    today = date.today()
    results = []

    for client in db.query(Client).all():
        cadence_days = cadences.get(client.tier) if client.tier else None
        if cadence_days is None:
            continue

        last_check_in = (
            db.query(CheckIn)
            .filter(CheckIn.client_id == client.id, CheckIn.completed_at.isnot(None))
            .order_by(CheckIn.completed_at.desc())
            .first()
        )
        last_date = last_check_in.completed_at.date() if last_check_in else client.relationship_start_date
        days_since = (today - last_date).days if last_date else None

        if days_since is None or days_since > cadence_days:
            results.append(
                {
                    "client_id": client.id,
                    "client_name": client.trade_name or client.corporate_name,
                    "tier": client.tier,
                    "last_check_in_at": last_date,
                    "cadence_days": cadence_days,
                    "days_since_last_contact": days_since,
                }
            )

    return results


def list_overdue_client_ids(db: Session) -> list[str]:
    return [r["client_id"] for r in list_overdue_clients(db)]
