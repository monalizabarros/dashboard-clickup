import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import type { AdoptionMilestone, OnboardingState } from "../types";

export default function OnboardingPanel({ clientId }: { clientId: string }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [milestones, setMilestones] = useState<AdoptionMilestone[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newActivity, setNewActivity] = useState("");
  const [newActivityDue, setNewActivityDue] = useState("");
  const [firstUsageDate, setFirstUsageDate] = useState("");
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");

  function load() {
    api.get<OnboardingState>(`/clients/${clientId}/onboarding`).then(setState).catch(() => setState({ journey: null, activities: [], progress_percent: 0 }));
    api.get<AdoptionMilestone[]>(`/clients/${clientId}/adoption-milestones`).then(setMilestones).catch(() => setMilestones([]));
  }

  useEffect(load, [clientId]);

  async function startJourney() {
    try {
      await api.post(`/clients/${clientId}/onboarding/start`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao iniciar onboarding.");
    }
  }

  async function toggleActivity(id: string, isCompleted: boolean) {
    try {
      await api.patch(`/onboarding-activities/${id}`, { is_completed: !isCompleted });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar atividade.");
    }
  }

  async function addActivity(e: FormEvent) {
    e.preventDefault();
    if (!newActivity) return;
    try {
      await api.post(`/clients/${clientId}/onboarding/activities`, { label: newActivity, due_date: newActivityDue || null });
      setNewActivity("");
      setNewActivityDue("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao adicionar atividade.");
    }
  }

  async function registerFirstUsage(e: FormEvent) {
    e.preventDefault();
    if (!firstUsageDate) return;
    try {
      await api.post(`/clients/${clientId}/onboarding/first-usage`, { first_usage_date: firstUsageDate });
      setFirstUsageDate("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao registrar primeira utilização.");
    }
  }

  async function addMilestone(e: FormEvent) {
    e.preventDefault();
    if (!newMilestoneLabel || !newMilestoneDate) return;
    try {
      await api.post(`/clients/${clientId}/adoption-milestones`, { label: newMilestoneLabel, achieved_at: newMilestoneDate });
      setNewMilestoneLabel("");
      setNewMilestoneDate("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao registrar marco.");
    }
  }

  if (!state) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>;

  if (!state.journey) {
    return (
      <div style={{ background: "var(--surface-card)", border: "0.5px dashed var(--border-default)", borderRadius: "var(--radius-card)", padding: "20px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
          Onboarding ainda não iniciado para este cliente.
        </div>
        <button onClick={startJourney} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 13, fontWeight: 500 }}>
          Iniciar jornada de onboarding
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 4 }}>
          <span>Progresso do onboarding</span>
          <span style={{ fontWeight: 500 }}>{state.progress_percent}%</span>
        </div>
        <div style={{ background: "var(--surface-page)", borderRadius: "var(--radius-pill)", height: 8, overflow: "hidden" }}>
          <div style={{ background: "var(--color-blue)", height: "100%", width: `${state.progress_percent}%`, transition: "width 0.2s" }} />
        </div>
      </div>

      <div>
        <SectionTitle>Atividades</SectionTitle>
        {state.activities.length === 0 && <EmptyNote />}
        {state.activities.map((a) => {
          const today = new Date().toISOString().slice(0, 10);
          const overdue = !a.is_completed && !!a.due_date && a.due_date < today;
          return (
            <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: overdue ? "var(--color-danger-text)" : "var(--text-secondary)", marginBottom: 4 }}>
              <input type="checkbox" checked={a.is_completed} onChange={() => toggleActivity(a.id, a.is_completed)} />
              <span style={{ textDecoration: a.is_completed ? "line-through" : "none" }}>{a.label}</span>
              {a.due_date && <span>({a.due_date}{overdue ? " — atrasada" : ""})</span>}
            </label>
          );
        })}
        <form onSubmit={addActivity} style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={newActivity} onChange={(e) => setNewActivity(e.target.value)} placeholder="Nova atividade" style={{ ...fieldInput, flex: 1 }} />
          <input type="date" value={newActivityDue} onChange={(e) => setNewActivityDue(e.target.value)} style={fieldInput} />
          <button type="submit" style={smallButton}>Adicionar</button>
        </form>
      </div>

      <div>
        <SectionTitle>Primeira utilização</SectionTitle>
        {state.journey.first_usage_at ? (
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Registrada em {state.journey.first_usage_at}</div>
        ) : (
          <form onSubmit={registerFirstUsage} style={{ display: "flex", gap: 6 }}>
            <input type="date" value={firstUsageDate} onChange={(e) => setFirstUsageDate(e.target.value)} style={fieldInput} />
            <button type="submit" style={smallButton}>Registrar</button>
          </form>
        )}
      </div>

      <div>
        <SectionTitle>Marcos de adoção</SectionTitle>
        {milestones.length === 0 && <EmptyNote />}
        {milestones.map((m) => (
          <div key={m.id} style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 4 }}>
            {m.achieved_at} — {m.label}
          </div>
        ))}
        <form onSubmit={addMilestone} style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={newMilestoneLabel} onChange={(e) => setNewMilestoneLabel(e.target.value)} placeholder="Novo marco" style={{ ...fieldInput, flex: 1 }} />
          <input type="date" value={newMilestoneDate} onChange={(e) => setNewMilestoneDate(e.target.value)} style={fieldInput} />
          <button type="submit" style={smallButton}>Registrar</button>
        </form>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.03em" }}>{children.toUpperCase()}</div>;
}

function EmptyNote() {
  return <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum registro ainda.</div>;
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
