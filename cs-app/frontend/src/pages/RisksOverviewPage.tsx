import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { RISK_CATEGORY_LABELS, type RiskWithClient } from "../types";

export default function RisksOverviewPage() {
  const [risks, setRisks] = useState<RiskWithClient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RiskWithClient[]>("/risks/critical")
      .then(setRisks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar riscos."));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>Riscos críticos</h1>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        Riscos com impacto alto e probabilidade alta, ainda não mitigados ou encerrados, em todas as contas.
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 2fr 1fr 1fr", padding: "10px 16px", fontSize: 11.5, color: "var(--text-muted)", borderBottom: "0.5px solid var(--border-subtle)", letterSpacing: "0.03em" }}>
          <div>CLIENTE</div>
          <div>CATEGORIA</div>
          <div>DESCRIÇÃO</div>
          <div>PRAZO</div>
          <div>STATUS</div>
        </div>
        {risks === null && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
        {risks?.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Nenhum risco crítico no momento.</div>}
        {risks?.map((r) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 2fr 1fr 1fr", alignItems: "center", padding: "11px 16px", fontSize: 13, borderBottom: "0.5px solid var(--border-subtle)" }}>
            <Link to={`/clientes/${r.client_id}`} style={{ color: "var(--color-blue)", fontWeight: 500 }}>
              {r.client_name}
            </Link>
            <div style={{ color: "var(--text-secondary)" }}>{RISK_CATEGORY_LABELS[r.category]}</div>
            <div style={{ color: "var(--text-secondary)" }}>{r.description}</div>
            <div style={{ color: "var(--text-secondary)" }}>{r.due_date || "—"}</div>
            <div>
              <StatusBadge label="Crítico" tone="danger" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
