import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProductStatus(str, enum.Enum):
    NAO_INICIADO = "nao_iniciado"
    EM_IMPLANTACAO = "em_implantacao"
    IMPLANTADO = "implantado"
    ATIVO = "ativo"
    SUSPENSO = "suspenso"
    ENCERRADO = "encerrado"


def _uuid() -> str:
    return str(uuid.uuid4())


class ClientProduct(Base):
    """Produto contratado por um cliente (RF-017 a RF-021)."""

    __tablename__ = "client_products"
    __table_args__ = (UniqueConstraint("client_id", "product_id", name="uq_client_product"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)

    contracted_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus), nullable=False, default=ProductStatus.NAO_INICIADO
    )
    owner_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
