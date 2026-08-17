import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { ALERT_EVENT_LABELS, type ActiveAlert, type AlertRule } from "../types";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<ActiveAlert[] | null>(null);
  const [rules, setRules] = useState<AlertRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  function load() {
    api.get<ActiveAlert[]>("/alerts/active").then(setAlerts).catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar alertas."));
    api.get<AlertRule[]>("/alert-rules").then(setRules).catch(() => setRules([]));
  }

  useEffect(load, []);

  async function toggleRule(rule: AlertRule, field: "is_active" | "auto_create_task") {
    try {
      await api.patch(`/alert-rules/${rule.id}`, { [field]: !rule[field] });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar regra.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>Alertas</h1>
        <button onClick={() => setShowRules((v) => !v)} style={{ background: "transparent", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 13, color: "var(--text-secondary)" }}>
          {showRules ? "Ver alertas ativos" : "Configurar regras"}
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {showRules ? (
        <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 16px", fontSize: 11.5, color: "var(--text-muted)", borderBottom: "0.5px solid var(--border-subtle)", letterSpacing: "0.03em" }}>
            <div>REGRA</div>
            <div>ATIVA</div>
            <div>CRIAR TAREFA AUTOMATICAMENTE</div>
          </div>
          {rules?.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", alignItems: "center", padding: "11px 16px", fontSize: 13, borderBottom: "0.5px solid var(--border-subtle)" }}>
              <div style={{ color: "var(--color-graphite)" }}>{r.name}</div>
              <input type="checkbox" checked={r.is_active} onChange={() => toggleRule(r, "is_active")} />
              <input type="checkbox" checked={r.auto_create_task} onChange={() => toggleRule(r, "auto_create_task")} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 2fr 0.8fr", padding: "10px 16px", fontSize: 11.5, color: "var(--text-muted)", borderBottom: "0.5px solid var(--border-subtle)", letterSpacing: "0.03em" }}>
            <div>CLIENTE</div>
            <div>TIPO</div>
            <div>MENSAGEM</div>
            <div>SEVERIDADE</div>
          </div>
          {alerts === null && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
          {alerts?.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Nenhum alerta ativo no momento.</div>}
          {alerts?.map((a, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 2fr 0.8fr", alignItems: "center", padding: "11px 16px", fontSize: 13, borderBottom: "0.5px solid var(--border-subtle)" }}>
              <Link to={`/clientes/${a.client_id}`} style={{ color: "var(--color-blue)", fontWeight: 500 }}>
                {a.client_name}
              </Link>
              <div style={{ color: "var(--text-secondary)" }}>{ALERT_EVENT_LABELS[a.event_type]}</div>
              <div style={{ color: "var(--text-secondary)" }}>{a.message}</div>
              <div>
                <StatusBadge label={a.severity === "alta" ? "Alta" : "Média"} tone={a.severity === "alta" ? "danger" : "warning"} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
