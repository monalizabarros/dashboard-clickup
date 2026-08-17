import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import {
  IMPLEMENTATION_PHASE_LABELS,
  IMPLEMENTATION_PHASE_ORDER,
  JOURNEY_RISK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
  type ImplementationPhase,
  type JourneyRisk,
  type JourneyRiskCategory,
  type PhaseParticipation,
  type PostGoLiveObjective,
  type Task,
  type TaskPriority,
} from "../types";

const RISK_CATEGORY_OPTIONS = Object.entries(JOURNEY_RISK_CATEGORY_LABELS) as [JourneyRiskCategory, string][];
const PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][];

export default function CSParticipationPanel({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [participations, setParticipations] = useState<PhaseParticipation[]>([]);
  const [risks, setRisks] = useState<JourneyRisk[]>([]);
  const [objectives, setObjectives] = useState<PostGoLiveObjective[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newRiskCategory, setNewRiskCategory] = useState<JourneyRiskCategory>("adocao");
  const [newRiskDesc, setNewRiskDesc] = useState("");
  const [newObjective, setNewObjective] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("media");

  function loadParticipations() {
    api.get<PhaseParticipation[]>(`/clients/${clientId}/phase-participation`).then(setParticipations).catch(() => setParticipations([]));
  }
  function loadRisks() {
    api.get<JourneyRisk[]>(`/clients/${clientId}/journey-risks`).then(setRisks).catch(() => setRisks([]));
  }
  function loadObjectives() {
    api.get<PostGoLiveObjective[]>(`/clients/${clientId}/objectives`).then(setObjectives).catch(() => setObjectives([]));
  }
  function loadTasks() {
    api.get<Task[]>(`/clients/${clientId}/tasks`).then(setTasks).catch(() => setTasks([]));
  }

  useEffect(() => {
    loadParticipations();
    loadRisks();
    loadObjectives();
    loadTasks();
  }, [clientId]);

  function participationFor(phase: ImplementationPhase) {
    return participations.find((p) => p.phase === phase);
  }

  async function togglePhase(phase: ImplementationPhase) {
    const current = participationFor(phase);
    try {
      await api.put(`/clients/${clientId}/phase-participation`, {
        phase,
        participated: !current?.participated,
        participation_date: !current?.participated ? new Date().toISOString().slice(0, 10) : current?.participation_date,
      });
      loadParticipations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar participação.");
    }
  }

  async function addRisk(e: FormEvent) {
    e.preventDefault();
    if (!newRiskDesc) return;
    try {
      await api.post(`/clients/${clientId}/journey-risks`, { category: newRiskCategory, description: newRiskDesc });
      setNewRiskDesc("");
      loadRisks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao registrar risco.");
    }
  }

  async function addObjective(e: FormEvent) {
    e.preventDefault();
    if (!newObjective) return;
    try {
      await api.post(`/clients/${clientId}/objectives`, { description: newObjective });
      setNewObjective("");
      loadObjectives();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao registrar objetivo.");
    }
  }

  async function toggleObjective(o: PostGoLiveObjective) {
    try {
      await api.patch(`/objectives/${o.id}`, {
        is_achieved: !o.is_achieved,
        achieved_at: !o.is_achieved ? new Date().toISOString().slice(0, 10) : null,
      });
      loadObjectives();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar objetivo.");
    }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!newTaskTitle) return;
    try {
      await api.post(`/clients/${clientId}/tasks`, {
        title: newTaskTitle,
        due_date: newTaskDueDate || null,
        priority: newTaskPriority,
        origin: "adocao",
      });
      setNewTaskTitle("");
      setNewTaskDueDate("");
      loadTasks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar tarefa.");
    }
  }

  async function toggleTaskDone(t: Task) {
    try {
      await api.patch(`/tasks/${t.id}`, { status: t.status === "concluida" ? "aberta" : "concluida" });
      loadTasks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar tarefa.");
    }
  }

  return (
    <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-graphite)" }}>
          Participação do CS — {clientName}
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 13, color: "var(--text-muted)" }}>
          Fechar
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <div>
        <SectionTitle>Participação nas fases da implantação</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {IMPLEMENTATION_PHASE_ORDER.map((phase) => {
            const p = participationFor(phase);
            const active = !!p?.participated;
            return (
              <button
                key={phase}
                onClick={() => togglePhase(phase)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  border: active ? "0.5px solid var(--color-blue)" : "0.5px solid var(--border-default)",
                  background: active ? "var(--color-blue)" : "transparent",
                  color: active ? "#fff" : "var(--text-secondary)",
                  fontSize: 12.5,
                }}
              >
                {active ? "✓" : ""} {IMPLEMENTATION_PHASE_LABELS[phase]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionTitle>Riscos da jornada (expectativa, relacionamento, adoção, satisfação, resultado)</SectionTitle>
        {risks.length === 0 && <EmptyNote />}
        {risks.map((r) => (
          <div key={r.id} style={rowNoteStyle}>
            <span style={{ fontWeight: 500, color: "var(--color-graphite)" }}>{JOURNEY_RISK_CATEGORY_LABELS[r.category]}:</span> {r.description}
          </div>
        ))}
        <form onSubmit={addRisk} style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <select value={newRiskCategory} onChange={(e) => setNewRiskCategory(e.target.value as JourneyRiskCategory)} style={fieldInput}>
            {RISK_CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input value={newRiskDesc} onChange={(e) => setNewRiskDesc(e.target.value)} placeholder="Descrição do risco" style={{ ...fieldInput, flex: 1 }} />
          <button type="submit" style={smallButton}>Registrar</button>
        </form>
      </div>

      <div>
        <SectionTitle>Objetivos e critérios de sucesso a avaliar após o go-live</SectionTitle>
        {objectives.length === 0 && <EmptyNote />}
        {objectives.map((o) => (
          <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 4 }}>
            <input type="checkbox" checked={o.is_achieved} onChange={() => toggleObjective(o)} />
            <span style={{ textDecoration: o.is_achieved ? "line-through" : "none" }}>{o.description}</span>
          </label>
        ))}
        <form onSubmit={addObjective} style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={newObjective} onChange={(e) => setNewObjective(e.target.value)} placeholder="Novo objetivo" style={{ ...fieldInput, flex: 1 }} />
          <button type="submit" style={smallButton}>Adicionar</button>
        </form>
      </div>

      <div>
        <SectionTitle>Tarefas de CS ligadas à adoção</SectionTitle>
        {tasks.length === 0 && <EmptyNote />}
        {tasks.map((t) => (
          <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 4 }}>
            <input type="checkbox" checked={t.status === "concluida"} onChange={() => toggleTaskDone(t)} />
            <span style={{ textDecoration: t.status === "concluida" ? "line-through" : "none" }}>{t.title}</span>
            <span style={{ color: "var(--text-muted)" }}>
              {TASK_PRIORITY_LABELS[t.priority]}{t.due_date ? ` · ${t.due_date}` : ""}
            </span>
          </label>
        ))}
        <form onSubmit={addTask} style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Nova tarefa de adoção" style={{ ...fieldInput, flex: 1 }} />
          <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} style={fieldInput} />
          <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)} style={fieldInput}>
            {PRIORITY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" style={smallButton}>Criar</button>
        </form>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.03em" }}>
      {children.toUpperCase()}
    </div>
  );
}

function EmptyNote() {
  return <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum registro ainda.</div>;
}

const rowNoteStyle: CSSProperties = {
  fontSize: 12.5,
  color: "var(--text-secondary)",
  marginBottom: 6,
  paddingBottom: 6,
  borderBottom: "0.5px solid var(--border-subtle)",
};

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
