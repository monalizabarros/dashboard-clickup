import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import StatusBadge from "./StatusBadge";
import {
  RISK_CATEGORY_LABELS,
  RISK_IMPACT_LABELS,
  RISK_PROBABILITY_LABELS,
  RISK_STATUS_LABELS,
  type AccountRisk,
  type RiskCategory,
  type RiskEvidence,
  type RiskImpact,
  type RiskProbability,
  type RiskStatus,
} from "../types";

const CATEGORY_OPTIONS = Object.entries(RISK_CATEGORY_LABELS) as [RiskCategory, string][];
const IMPACT_OPTIONS = Object.entries(RISK_IMPACT_LABELS) as [RiskImpact, string][];
const PROBABILITY_OPTIONS = Object.entries(RISK_PROBABILITY_LABELS) as [RiskProbability, string][];
const STATUS_OPTIONS = Object.entries(RISK_STATUS_LABELS) as [RiskStatus, string][];

function isCritical(r: AccountRisk) {
  return r.impact === "alto" && r.probability === "alta" && r.status !== "mitigado" && r.status !== "encerrado";
}

export default function RisksPanel({ clientId }: { clientId: string }) {
  const [risks, setRisks] = useState<AccountRisk[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get<AccountRisk[]>(`/clients/${clientId}/risks`).then(setRisks).catch(() => setRisks([]));
  }

  useEffect(load, [clientId]);

  return (
    <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setShowForm((v) => !v)} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "6px 12px", fontSize: 12, fontWeight: 500 }}>
          {showForm ? "Cancelar" : "+ Novo risco"}
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {showForm && (
        <NewRiskForm
          clientId={clientId}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      {risks?.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum risco registrado ainda.</div>}
      {risks?.map((r) => (
        <RiskCard key={r.id} risk={r} onChanged={load} onError={setError} />
      ))}
    </div>
  );
}

function RiskCard({ risk, onChanged, onError }: { risk: AccountRisk; onChanged: () => void; onError: (msg: string) => void }) {
  const [evidence, setEvidence] = useState<RiskEvidence[]>([]);
  const [newEvidence, setNewEvidence] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);

  function loadEvidence() {
    api.get<RiskEvidence[]>(`/risks/${risk.id}/evidence`).then(setEvidence).catch(() => setEvidence([]));
  }

  useEffect(loadEvidence, [risk.id]);

  async function updateStatus(status: RiskStatus) {
    try {
      await api.patch(`/risks/${risk.id}`, { status });
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao atualizar risco.");
    }
  }

  async function addEvidence(e: FormEvent) {
    e.preventDefault();
    if (!newEvidence) return;
    try {
      await api.post(`/risks/${risk.id}/evidence`, { description: newEvidence });
      setNewEvidence("");
      loadEvidence();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao registrar evidência.");
    }
  }

  async function createRecoveryPlan() {
    setCreatingPlan(true);
    try {
      await api.post(`/risks/${risk.id}/recovery-plan`);
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar plano de recuperação.");
    } finally {
      setCreatingPlan(false);
    }
  }

  const critical = isCritical(risk);

  return (
    <div style={{ border: critical ? "0.5px solid var(--color-danger-text)" : "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-graphite)" }}>
          {RISK_CATEGORY_LABELS[risk.category]}
          {critical && <span style={{ marginLeft: 8 }}><StatusBadge label="Crítico" tone="danger" /></span>}
        </div>
        <select value={risk.status} onChange={(e) => updateStatus(e.target.value as RiskStatus)} style={fieldInput}>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{risk.description}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        Impacto: {RISK_IMPACT_LABELS[risk.impact]} · Probabilidade: {RISK_PROBABILITY_LABELS[risk.probability]}
        {risk.due_date ? ` · Prazo: ${risk.due_date}` : ""}
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.03em" }}>EVIDÊNCIAS</div>
        {evidence.map((ev) => (
          <div key={ev.id} style={{ fontSize: 12, color: "var(--text-secondary)" }}>• {ev.description}</div>
        ))}
        <form onSubmit={addEvidence} style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input value={newEvidence} onChange={(e) => setNewEvidence(e.target.value)} placeholder="Nova evidência" style={{ ...fieldInput, flex: 1 }} />
          <button type="submit" style={smallButton}>Adicionar</button>
        </form>
      </div>

      {risk.action_plan_id ? (
        <div style={{ fontSize: 11.5, color: "var(--color-blue)" }}>Plano de recuperação criado (ver em Planos de ação).</div>
      ) : (
        <button onClick={createRecoveryPlan} disabled={creatingPlan} style={{ ...smallButton, alignSelf: "flex-start" }}>
          {creatingPlan ? "Criando..." : "Criar plano de recuperação"}
        </button>
      )}
    </div>
  );
}

function NewRiskForm({ clientId, onCreated, onError }: { clientId: string; onCreated: () => void; onError: (msg: string) => void }) {
  const [category, setCategory] = useState<RiskCategory>("adocao");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<RiskImpact>("medio");
  const [probability, setProbability] = useState<RiskProbability>("media");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description) {
      onError("Descreva o risco.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/clients/${clientId}/risks`, { category, description, impact, probability, due_date: dueDate || null });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar risco.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Categoria
        <select value={category} onChange={(e) => setCategory(e.target.value as RiskCategory)} style={fieldInput}>
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Prazo
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={fieldInput} />
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Impacto
        <select value={impact} onChange={(e) => setImpact(e.target.value as RiskImpact)} style={fieldInput}>
          {IMPACT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Probabilidade
        <select value={probability} onChange={(e) => setProbability(e.target.value as RiskProbability)} style={fieldInput}>
          {PROBABILITY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)", gridColumn: "1 / -1" }}>
        Descrição
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...fieldInput, minHeight: 50, resize: "vertical", fontFamily: "inherit" }} />
      </label>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={submitting} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 13, fontWeight: 500 }}>
          {submitting ? "Salvando..." : "Registrar risco"}
        </button>
      </div>
    </form>
  );
}

const fieldInput: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "6px 8px",
  borderRadius: "var(--radius-control)",
  border: "0.5px solid var(--border-default)",
  fontSize: 13,
};

const smallButton: CSSProperties = {
  background: "transparent",
  border: "0.5px solid var(--border-default)",
  borderRadius: "var(--radius-control)",
  padding: "6px 10px",
  fontSize: 12,
  color: "var(--text-secondary)",
};
