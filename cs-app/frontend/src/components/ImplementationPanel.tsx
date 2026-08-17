import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import StatusBadge from "./StatusBadge";
import {
  IMPLEMENTATION_EVENT_TYPE_LABELS,
  IMPLEMENTATION_SITUATION_LABELS,
  IMPLEMENTATION_SITUATION_TONE,
  IMPLEMENTATION_STATUS_LABELS,
  type ImplementationEvent,
  type ImplementationEventType,
  type ImplementationSituation,
  type ImplementationStatus,
  type ImplementationSummary,
  type Milestone,
} from "../types";

const STATUS_OPTIONS = Object.entries(IMPLEMENTATION_STATUS_LABELS) as [ImplementationStatus, string][];
const SITUATION_OPTIONS = Object.entries(IMPLEMENTATION_SITUATION_LABELS) as [ImplementationSituation, string][];
const EVENT_TYPE_OPTIONS = Object.entries(IMPLEMENTATION_EVENT_TYPE_LABELS) as [ImplementationEventType, string][];

export default function ImplementationPanel({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<ImplementationSummary | null | undefined>(undefined);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [events, setEvents] = useState<ImplementationEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [newEventType, setNewEventType] = useState<ImplementationEventType>("risco");
  const [newEventDesc, setNewEventDesc] = useState("");

  function loadSummary() {
    api
      .get<ImplementationSummary>(`/clients/${clientId}/implementation-summary`)
      .then((s) => {
        setSummary(s);
        setEditing(false);
      })
      .catch(() => setSummary(null));
  }

  function loadMilestones() {
    api.get<Milestone[]>(`/clients/${clientId}/milestones`).then(setMilestones).catch(() => setMilestones([]));
  }

  function loadEvents() {
    api.get<ImplementationEvent[]>(`/clients/${clientId}/implementation-events`).then(setEvents).catch(() => setEvents([]));
  }

  useEffect(() => {
    loadSummary();
    loadMilestones();
    loadEvents();
  }, [clientId]);

  async function toggleMilestone(m: Milestone) {
    try {
      await api.patch(`/milestones/${m.id}`, { is_completed: !m.is_completed });
      loadMilestones();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar marco.");
    }
  }

  async function addMilestone(e: FormEvent) {
    e.preventDefault();
    if (!newMilestone) return;
    try {
      await api.post(`/clients/${clientId}/milestones`, {
        label: newMilestone,
        target_date: newMilestoneDate || null,
        order_index: milestones.length,
      });
      setNewMilestone("");
      setNewMilestoneDate("");
      loadMilestones();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao adicionar marco.");
    }
  }

  async function addEvent(e: FormEvent) {
    e.preventDefault();
    if (!newEventDesc) return;
    try {
      await api.post(`/clients/${clientId}/implementation-events`, { type: newEventType, description: newEventDesc });
      setNewEventDesc("");
      loadEvents();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao registrar evento.");
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
          Implantação — {clientName}
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 13, color: "var(--text-muted)" }}>
          Fechar
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {summary === undefined && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}

      {summary !== undefined && (!summary || editing) && (
        <SummaryForm
          clientId={clientId}
          initial={summary ?? undefined}
          onSaved={loadSummary}
          onError={setError}
          onCancel={summary ? () => setEditing(false) : undefined}
        />
      )}

      {summary && !editing && (
        <div style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <StatusBadge label={IMPLEMENTATION_STATUS_LABELS[summary.status]} tone="neutral" />
              <StatusBadge
                label={IMPLEMENTATION_SITUATION_LABELS[summary.situation]}
                tone={IMPLEMENTATION_SITUATION_TONE[summary.situation]}
              />
            </div>
            <button onClick={() => setEditing(true)} style={{ background: "transparent", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "4px 10px", fontSize: 12, color: "var(--text-secondary)" }}>
              Editar
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            Prazo previsto: {summary.expected_deadline || "não definido"}
          </div>
          {summary.external_link && (
            <div style={{ fontSize: 12.5, marginTop: 4 }}>
              <a href={summary.external_link} target="_blank" rel="noreferrer" style={{ color: "var(--color-blue)" }}>
                Ver projeto detalhado (Projetos) ↗
              </a>
            </div>
          )}
        </div>
      )}

      {summary && (
        <>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.03em" }}>
              PRINCIPAIS MARCOS
            </div>
            {milestones.map((m) => (
              <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 4 }}>
                <input type="checkbox" checked={m.is_completed} onChange={() => toggleMilestone(m)} />
                <span style={{ textDecoration: m.is_completed ? "line-through" : "none" }}>{m.label}</span>
                {m.target_date && <span style={{ color: "var(--text-muted)" }}>({m.target_date})</span>}
              </label>
            ))}
            <form onSubmit={addMilestone} style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} placeholder="Novo marco" style={{ ...fieldInput, flex: 1 }} />
              <input type="date" value={newMilestoneDate} onChange={(e) => setNewMilestoneDate(e.target.value)} style={fieldInput} />
              <button type="submit" style={smallButton}>Adicionar</button>
            </form>
          </div>

          <div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.03em" }}>
              RISCOS, IMPEDIMENTOS, DEPENDÊNCIAS E DECISÕES
            </div>
            {events.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum registro ainda.</div>}
            {events.map((ev) => (
              <div key={ev.id} style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6, paddingBottom: 6, borderBottom: "0.5px solid var(--border-subtle)" }}>
                <span style={{ fontWeight: 500, color: "var(--color-graphite)" }}>{IMPLEMENTATION_EVENT_TYPE_LABELS[ev.type]}:</span> {ev.description}
              </div>
            ))}
            <form onSubmit={addEvent} style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <select value={newEventType} onChange={(e) => setNewEventType(e.target.value as ImplementationEventType)} style={fieldInput}>
                {EVENT_TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} placeholder="Descrição" style={{ ...fieldInput, flex: 1 }} />
              <button type="submit" style={smallButton}>Registrar</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryForm({
  clientId,
  initial,
  onSaved,
  onError,
  onCancel,
}: {
  clientId: string;
  initial?: ImplementationSummary;
  onSaved: () => void;
  onError: (msg: string) => void;
  onCancel?: () => void;
}) {
  const [status, setStatus] = useState<ImplementationStatus>(initial?.status ?? "nao_iniciado");
  const [situation, setSituation] = useState<ImplementationSituation>(initial?.situation ?? "no_prazo");
  const [expectedDeadline, setExpectedDeadline] = useState(initial?.expected_deadline ?? "");
  const [externalLink, setExternalLink] = useState(initial?.external_link ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/clients/${clientId}/implementation-summary`, {
        status,
        situation,
        expected_deadline: expectedDeadline || null,
        external_link: externalLink || null,
      });
      onSaved();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao salvar resumo de implantação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Status macro
        <select value={status} onChange={(e) => setStatus(e.target.value as ImplementationStatus)} style={fieldInput}>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Situação
        <select value={situation} onChange={(e) => setSituation(e.target.value as ImplementationSituation)} style={fieldInput}>
          {SITUATION_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Prazo previsto
        <input type="date" value={expectedDeadline ?? ""} onChange={(e) => setExpectedDeadline(e.target.value)} style={fieldInput} />
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Link do projeto (Projetos/ClickUp)
        <input value={externalLink ?? ""} onChange={(e) => setExternalLink(e.target.value)} style={fieldInput} placeholder="https://..." />
      </label>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ background: "transparent", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 13, color: "var(--text-secondary)" }}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={submitting} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 13, fontWeight: 500 }}>
          {submitting ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

const fieldInput: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
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
