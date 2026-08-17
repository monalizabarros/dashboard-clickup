import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type TaskStatus, type TaskWithClient } from "../types";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "aberta", label: "Abertas" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "overdue", label: "Vencidas" },
  { key: "concluida", label: "Concluídas" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithClient[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  function load(activeFilter: string) {
    const params = new URLSearchParams();
    if (activeFilter === "overdue") params.set("overdue", "true");
    else if (activeFilter !== "all") params.set("status", activeFilter);

    api
      .get<TaskWithClient[]>(`/tasks${params.toString() ? `?${params}` : ""}`)
      .then(setTasks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar tarefas."));
  }

  useEffect(() => load(filter), [filter]);

  const today = new Date().toISOString().slice(0, 10);

  async function toggleDone(t: TaskWithClient) {
    try {
      await api.patch(`/tasks/${t.id}`, { status: t.status === "concluida" ? "aberta" : "concluida" });
      load(filter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar tarefa.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>Tarefas</h1>

      <div style={{ display: "flex", gap: 8 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-pill)",
              border: filter === f.key ? "0.5px solid var(--color-blue)" : "0.5px solid var(--border-default)",
              background: filter === f.key ? "var(--color-blue)" : "transparent",
              color: filter === f.key ? "#fff" : "var(--text-secondary)",
              fontSize: 12.5,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.4fr 2fr 1.4fr 1fr 0.8fr 0.8fr", padding: "10px 16px", fontSize: 11.5, color: "var(--text-muted)", borderBottom: "0.5px solid var(--border-subtle)", letterSpacing: "0.03em" }}>
          <div />
          <div>TAREFA</div>
          <div>CLIENTE</div>
          <div>PRAZO</div>
          <div>PRIORIDADE</div>
          <div>STATUS</div>
        </div>
        {tasks === null && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
        {tasks?.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Nenhuma tarefa encontrada.</div>}
        {tasks?.map((t) => {
          const overdue = t.status !== "concluida" && !!t.due_date && t.due_date < today;
          return (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "0.4fr 2fr 1.4fr 1fr 0.8fr 0.8fr", alignItems: "center", padding: "11px 16px", fontSize: 13, borderBottom: "0.5px solid var(--border-subtle)" }}>
              <input type="checkbox" checked={t.status === "concluida"} onChange={() => toggleDone(t)} />
              <div style={{ color: "var(--color-graphite)", textDecoration: t.status === "concluida" ? "line-through" : "none" }}>{t.title}</div>
              <Link to={`/clientes/${t.client_id}`} style={{ color: "var(--color-blue)", fontSize: 12.5 }}>
                {t.client_name}
              </Link>
              <div style={{ color: overdue ? "var(--color-danger-text)" : "var(--text-secondary)", fontWeight: overdue ? 500 : 400 }}>
                {t.due_date || "—"}
              </div>
              <div style={{ color: "var(--text-secondary)" }}>{TASK_PRIORITY_LABELS[t.priority]}</div>
              <div>
                {overdue ? (
                  <StatusBadge label="Vencida" tone="danger" />
                ) : (
                  <StatusBadge label={TASK_STATUS_LABELS[t.status as TaskStatus]} tone={t.status === "concluida" ? "success" : "neutral"} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
