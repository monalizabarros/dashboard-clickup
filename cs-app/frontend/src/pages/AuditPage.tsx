import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

interface AuditLog {
  id: string;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Exclusão",
  login: "Login",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AuditLog[]>("/audit-logs")
      .then(setLogs)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar auditoria."));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>Auditoria</h1>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <div
        style={{
          background: "var(--surface-card)",
          border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.4fr 1.2fr", padding: "10px 16px", fontSize: 11.5, color: "var(--text-muted)", borderBottom: "0.5px solid var(--border-subtle)", letterSpacing: "0.03em" }}>
          <div>USUÁRIO</div>
          <div>AÇÃO</div>
          <div>RECURSO</div>
          <div>ID DO REGISTRO</div>
          <div>DATA</div>
        </div>
        {logs === null && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
        {logs?.map((log) => (
          <div
            key={log.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr 1.4fr 1.2fr",
              alignItems: "center",
              padding: "11px 16px",
              fontSize: 13,
              borderBottom: "0.5px solid var(--border-subtle)",
            }}
          >
            <div style={{ color: "var(--color-graphite)" }}>{log.user_email ?? "—"}</div>
            <div style={{ color: "var(--text-secondary)" }}>{ACTION_LABELS[log.action] ?? log.action}</div>
            <div style={{ color: "var(--text-secondary)" }}>{log.resource_type}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{log.resource_id ?? "—"}</div>
            <div style={{ color: "var(--text-secondary)" }}>{new Date(log.created_at).toLocaleString("pt-BR")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
