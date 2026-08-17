import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, ApiError } from "../api/client";
import StatusBadge from "./StatusBadge";
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONE,
  USAGE_LEVEL_LABELS,
  type ClientModule,
  type ClientProduct,
  type Module,
  type Product,
  type ProductStatus,
  type UsageLevel,
} from "../types";

const STATUS_OPTIONS = Object.entries(PRODUCT_STATUS_LABELS) as [ProductStatus, string][];
const USAGE_OPTIONS = Object.entries(USAGE_LEVEL_LABELS) as [UsageLevel, string][];

export default function ProductMatrixPanel({ clientId, clientName, onClose }: { clientId: string; clientName: string; onClose: () => void }) {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [clientProducts, setClientProducts] = useState<ClientProduct[] | null>(null);
  const [clientModules, setClientModules] = useState<ClientModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");

  function loadLinks() {
    api.get<ClientProduct[]>(`/clients/${clientId}/products`).then(setClientProducts).catch(() => setClientProducts([]));
    api.get<ClientModule[]>(`/clients/${clientId}/modules`).then(setClientModules).catch(() => setClientModules([]));
  }

  useEffect(() => {
    api.get<Product[]>("/products").then(setCatalog).catch(() => {});
    loadLinks();
  }, [clientId]);

  const moduleById = useMemo(() => {
    const map = new Map<string, Module>();
    catalog.forEach((p) => p.modules.forEach((m) => map.set(m.id, m)));
    return map;
  }, [catalog]);

  const contractedProductIds = useMemo(() => new Set((clientProducts ?? []).map((cp) => cp.product_id)), [clientProducts]);
  const availableProducts = catalog.filter((p) => !contractedProductIds.has(p.id));

  async function contractProduct() {
    if (!selectedProductId) return;
    try {
      await api.post(`/clients/${clientId}/products`, { product_id: selectedProductId, status: "nao_iniciado" });
      setSelectedProductId("");
      loadLinks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao contratar produto.");
    }
  }

  async function contractModule(moduleId: string) {
    try {
      await api.post(`/clients/${clientId}/modules`, { module_id: moduleId });
      loadLinks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao contratar módulo.");
    }
  }

  async function updateProductStatus(cpId: string, status: ProductStatus) {
    try {
      await api.patch(`/client-products/${cpId}`, { status });
      loadLinks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar status.");
    }
  }

  async function updateModule(cmId: string, data: { is_implemented?: boolean; usage_level?: UsageLevel }) {
    try {
      await api.patch(`/client-modules/${cmId}`, data);
      loadLinks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar módulo.");
    }
  }

  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-card)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-graphite)" }}>
          Produtos e módulos — {clientName}
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 13, color: "var(--text-muted)" }}>
          Fechar
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {availableProducts.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} style={selectStyle}>
            <option value="">Selecione um produto do catálogo...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={contractProduct}
            disabled={!selectedProductId}
            style={{
              background: "var(--color-blue)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-control)",
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Contratar
          </button>
        </div>
      )}

      {clientProducts?.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum produto contratado ainda.</div>
      )}

      {clientProducts?.map((cp) => {
        const product = catalog.find((p) => p.id === cp.product_id);
        const contractedModuleIds = new Set((clientModules ?? []).filter((cm) => moduleById.get(cm.module_id)?.product_id === cp.product_id).map((cm) => cm.module_id));
        const availableModules = (product?.modules ?? []).filter((m) => !contractedModuleIds.has(m.id));

        return (
          <div key={cp.id} style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--color-graphite)" }}>{product?.name ?? "Produto"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusBadge label={PRODUCT_STATUS_LABELS[cp.status]} tone={PRODUCT_STATUS_TONE[cp.status]} />
                <select
                  value={cp.status}
                  onChange={(e) => updateProductStatus(cp.id, e.target.value as ProductStatus)}
                  style={{ ...selectStyle, width: "auto", fontSize: 12 }}
                >
                  {STATUS_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {(clientModules ?? [])
                .filter((cm) => moduleById.get(cm.module_id)?.product_id === cp.product_id)
                .map((cm) => (
                  <div key={cm.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <div style={{ color: "var(--text-secondary)" }}>{moduleById.get(cm.module_id)?.name}</div>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)" }}>
                      <input
                        type="checkbox"
                        checked={cm.is_implemented}
                        onChange={(e) => updateModule(cm.id, { is_implemented: e.target.checked })}
                      />
                      Implantado
                    </label>
                    <select
                      value={cm.usage_level}
                      onChange={(e) => updateModule(cm.id, { usage_level: e.target.value as UsageLevel })}
                      style={{ ...selectStyle, fontSize: 12 }}
                    >
                      {USAGE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          Utilização: {label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

              {availableModules.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {availableModules.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => contractModule(m.id)}
                      style={{
                        background: "transparent",
                        border: "0.5px dashed var(--border-default)",
                        borderRadius: "var(--radius-pill)",
                        padding: "3px 10px",
                        fontSize: 11.5,
                        color: "var(--text-muted)",
                      }}
                    >
                      + {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const selectStyle: CSSProperties = {
  padding: "6px 8px",
  borderRadius: "var(--radius-control)",
  border: "0.5px solid var(--border-default)",
  fontSize: 13,
};
