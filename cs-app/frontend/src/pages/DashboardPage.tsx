import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ExecutiveDashboard, OperationalDashboard } from "../types";

export default function DashboardPage() {
  const [exec, setExec] = useState<ExecutiveDashboard | null>(null);
  const [ops, setOps] = useState<OperationalDashboard | null>(null);

  useEffect(() => {
    api.get<ExecutiveDashboard>("/dashboard/executive").then(setExec).catch(() => {});
    api.get<OperationalDashboard>("/dashboard/operational").then(setOps).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 20, color: "var(--color-graphite)", marginBottom: 12 }}>Dashboard executivo</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Metric label="Total de clientes" value={exec?.total_clients} />
          <Metric label="Saudáveis" value={exec?.healthy_clients} tone="success" />
          <Metric label="Em atenção" value={exec?.attention_clients} tone="warning" />
          <Metric label="Em risco" value={exec?.at_risk_clients} tone="danger" />
          <Metric label="Churn" value={exec?.churned_clients} />
          <Metric label="Em renovação" value={exec?.in_renewal_clients} />
          <Metric label="NPS médio" value={exec?.avg_nps ?? "—"} />
          <Metric label="CSAT médio" value={exec?.avg_csat ?? "—"} />
          <Metric label="Utilização média (%)" value={exec?.avg_utilization ?? "—"} />
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: 20, color: "var(--color-graphite)", marginBottom: 12 }}>Dashboard operacional</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Metric label="Tarefas abertas" value={ops?.open_tasks} />
          <Metric label="Tarefas vencidas" value={ops?.overdue_tasks} tone="danger" />
          <Metric label="Check-ins pendentes" value={ops?.pending_check_ins} />
          <Metric label="Clientes sem contato" value={ops?.clients_without_contact} tone="warning" />
          <Metric label="Riscos abertos" value={ops?.open_risks} />
          <Metric label="Riscos críticos" value={ops?.critical_risks} tone="danger" />
          <Metric label="Planos de recuperação ativos" value={ops?.recovery_plans_in_progress} />
          <Metric label="Implantações críticas" value={ops?.critical_implementations} tone="danger" />
          <Metric label="Clientes em hypercare" value={ops?.clients_in_hypercare} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string | undefined; tone?: "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "var(--color-success-text)" : tone === "warning" ? "var(--color-warning-text)" : tone === "danger" ? "var(--color-danger-text)" : "var(--color-graphite)";
  return (
    <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 600, color }}>{value ?? "—"}</div>
    </div>
  );
}
