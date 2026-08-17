from sqlalchemy.orm import Session

from app.models.client_product import ClientProduct
from app.models.onboarding import OnboardingActivity, OnboardingJourney, OnboardingTemplateItem


def start_onboarding_journey(db: Session, client_id: str) -> OnboardingJourney:
    """Cria a jornada de onboarding do cliente se ainda não existir (RF-077),
    semeando as atividades a partir dos templates dos produtos contratados
    (RF-078). Idempotente — chamado tanto pelo endpoint manual quanto
    automaticamente ao aceitar o handoff Projetos->CS (Bloco 8)."""
    journey = db.query(OnboardingJourney).filter(OnboardingJourney.client_id == client_id).first()
    if journey:
        return journey

    journey = OnboardingJourney(client_id=client_id)
    db.add(journey)

    product_ids = [
        row.product_id
        for row in db.query(ClientProduct.product_id).filter(ClientProduct.client_id == client_id).all()
    ]
    if product_ids:
        template_items = (
            db.query(OnboardingTemplateItem)
            .filter(OnboardingTemplateItem.product_id.in_(product_ids))
            .order_by(OnboardingTemplateItem.order_index)
            .all()
        )
        for item in template_items:
            db.add(
                OnboardingActivity(
                    client_id=client_id,
                    label=item.label,
                    order_index=item.order_index,
                )
            )

    db.commit()
    db.refresh(journey)
    return journey
