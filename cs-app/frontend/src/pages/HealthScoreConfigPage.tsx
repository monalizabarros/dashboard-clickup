import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { INDICATOR_SOURCE_LABELS, type HealthScoreIndicator, type IndicatorSource } from "../types";

export default function HealthScoreConfigPage() {
  const [indicators, setIndicators] = useState<HealthScoreIndicator[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get<HealthScoreIndicator[]>("/health-score-indicators").then(setIndicators).catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar indicadores."));
  }

  useEffect(load, []);

  async function updateWeight(indicator: HealthScoreIndicator, weight: number) {
    try {
      await api.patch(`/health-score-indicators/${indicator.id}`, { weight });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar peso.");
    }
  }

  async function toggleActive(indicator: HealthScoreIndicator) {
    try {
      await api.patch(`/health-score-indicators/${indicator.id}`, { is_active: !indicator.is_active });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar indicador.");
    }
  }

  async function updateSource(indicator: HealthScoreIndicator, source: IndicatorSource) {
    try {
      await api.patch(`/health-score-indicators/${indicator.id}`, { source });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar origem do indicador.");
    }
  }

  const totalWeight = indicators?.filter((i) => i.is_active).reduce((sum, i) => sum + i.weight, 0) ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>Indicadores de Health Score</h1>
        <button onClick={() => setShowForm((v) => !v)} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 13, fontWeight: 500 }}>
          {showForm ? "Cancelar" : "+ Novo indicador"}
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        Soma dos pesos ativos: {totalWeight}. O cálculo normaliza automaticamente pelo peso dos indicadores com dado disponível — não precisa somar 100.
      </div>

      {showForm && (
        <NewIndicatorForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 16px", fontSize: 11.5, color: "var(--text-muted)", borderBottom: "0.5px solid var(--border-subtle)", letterSpacing: "0.03em" }}>
          <div>INDICADOR</div>
          <div>CHAVE</div>
          <div>ORIGEM</div>
          <div>PESO</div>
          <div>ATIVO</div>
        </div>
        {indicators === null && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
        {indicators?.map((ind) => (
          <div key={ind.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", alignItems: "center", padding: "11px 16px", fontSize: 13, borderBottom: "0.5px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--color-graphite)" }}>{ind.label}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{ind.key}</div>
            <select value={ind.source} onChange={(e) => updateSource(ind, e.target.value as IndicatorSource)} style={{ padding: "4px 6px", borderRadius: "var(--radius-control)", border: "0.5px solid var(--border-default)", fontSize: 12.5, color: "var(--text-secondary)" }}>
              <option value="manual">{INDICATOR_SOURCE_LABELS.manual}</option>
              <option value="auto">{INDICATOR_SOURCE_LABELS.auto}</option>
            </select>
            <input
              type="number"
              min={0}
              max={100}
              defaultValue={ind.weight}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n !== ind.weight) updateWeight(ind, n);
              }}
              style={{ width: 60, padding: "5px 7px", borderRadius: "var(--radius-control)", border: "0.5px solid var(--border-default)", fontSize: 13 }}
            />
            <input type="checkbox" checked={ind.is_active} onChange={() => toggleActive(ind)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NewIndicatorForm({ onCreated, onError }: { onCreated: () => void; onError: (msg: string) => void }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [weight, setWeight] = useState("10");
  const [source, setSource] = useState<IndicatorSource>("manual");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!key || !label) {
      onError("Informe a chave e o rótulo do indicador.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/health-score-indicators", { key, label, weight: Number(weight) || 10, source });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar indicador.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr 1.5fr 0.6fr 0.8fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Chave (única)">
        <input value={key} onChange={(e) => setKey(e.target.value)} style={fieldInput} placeholder="ex: nps" />
      </Field>
      <Field label="Rótulo">
        <input value={label} onChange={(e) => setLabel(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Peso">
        <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Origem">
        <select value={source} onChange={(e) => setSource(e.target.value as IndicatorSource)} style={fieldInput}>
          <option value="manual">Manual</option>
          <option value="auto">Automático (requer código)</option>
        </select>
      </Field>
      <button type="submit" disabled={submitting} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "8px 14px", fontSize: 13, fontWeight: 500, height: 36 }}>
        Criar
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
      {label}
      {children}
    </label>
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
