import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import StatusBadge from "./StatusBadge";
import { ACTION_PLAN_STATUS_LABELS, type ActionPlan, type ActionPlanStatus } from "../types";

const TONE: Record<ActionPlanStatus, "neutral" | "warning" | "success"> = {
  aberto: "neutral",
  em_andamento: "warning",
  concluido: "success",
};

export default function ActionPlansPanel({ clientId }: { clientId: string }) {
  const [plans, setPlans] = useState<ActionPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function load() {
    api.get<ActionPlan[]>(`/clients/${clientId}/action-plans`).then(setPlans).catch(() => setPlans([]));
  }

  useEffect(load, [clientId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!title) return;
    try {
      await api.post(`/clients/${clientId}/action-plans`, { title, description: description || null });
      setTitle("");
      setDescription("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar plano de ação.");
    }
  }

  async function advanceStatus(plan: ActionPlan) {
    const next: Record<ActionPlanStatus, ActionPlanStatus> = {
      aberto: "em_andamento",
      em_andamento: "concluido",
      concluido: "aberto",
    };
    try {
      await api.patch(`/action-plans/${plan.id}`, { status: next[plan.status] });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar plano.");
    }
  }

  return (
    <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {plans?.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum plano de ação criado ainda.</div>}
      {plans?.map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid var(--border-subtle)", paddingBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-graphite)" }}>{p.title}</div>
            {p.description && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.description}</div>}
          </div>
          <button onClick={() => advanceStatus(p)} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <StatusBadge label={ACTION_PLAN_STATUS_LABELS[p.status]} tone={TONE[p.status]} />
          </button>
        </div>
      ))}

      <form onSubmit={create} style={{ display: "flex", gap: 6 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do plano" style={{ ...fieldInput, flex: 1 }} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" style={{ ...fieldInput, flex: 2 }} />
        <button type="submit" style={smallButton}>Criar</button>
      </form>
    </div>
  );
}

const fieldInput: CSSProperties = {
  padding: "7px 9px",
  borderRadius: "var(--radius-control)",
  border: "0.5px solid var(--border-default)",
  fontSize: 13,
};

const smallButton: CSSProperties = {
  background: "transparent",
  border: "0.5px solid var(--border-default)",
  borderRadius: "var(--radius-control)",
  padding: "7px 12px",
  fontSize: 12,
  color: "var(--text-secondary)",
};
