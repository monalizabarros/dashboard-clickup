import { useEffect, useState, type CSSProperties } from "react";
import { api, ApiError } from "../api/client";
import StatusBadge from "./StatusBadge";
import {
  HEALTH_SCORE_CLASSIFICATION_LABELS,
  HEALTH_SCORE_CLASSIFICATION_TONE,
  type DeteriorationReason,
  type HealthScoreIndicator,
  type HealthScoreManualValue,
  type HealthScoreSnapshot,
} from "../types";

export default function HealthScorePanel({ clientId }: { clientId: string }) {
  const [latest, setLatest] = useState<HealthScoreSnapshot | null | undefined>(undefined);
  const [history, setHistory] = useState<HealthScoreSnapshot[]>([]);
  const [reasons, setReasons] = useState<DeteriorationReason[]>([]);
  const [indicators, setIndicators] = useState<HealthScoreIndicator[]>([]);
  const [manualValues, setManualValues] = useState<HealthScoreManualValue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  function load() {
    api.get<HealthScoreSnapshot>(`/clients/${clientId}/health-score/latest`).then(setLatest).catch(() => setLatest(null));
    api.get<HealthScoreSnapshot[]>(`/clients/${clientId}/health-score/history`).then(setHistory).catch(() => setHistory([]));
    api.get<DeteriorationReason[]>(`/clients/${clientId}/health-score/deterioration-reasons`).then(setReasons).catch(() => setReasons([]));
    api.get<HealthScoreIndicator[]>("/health-score-indicators").then(setIndicators).catch(() => setIndicators([]));
    api.get<HealthScoreManualValue[]>(`/clients/${clientId}/health-score-manual-values`).then(setManualValues).catch(() => setManualValues([]));
  }

  useEffect(load, [clientId]);

  async function recalculate() {
    setCalculating(true);
    try {
      await api.post(`/clients/${clientId}/health-score/calculate`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao calcular Health Score.");
    } finally {
      setCalculating(false);
    }
  }

  async function saveManualValue(indicatorKey: string, score: number) {
    try {
      await api.put(`/clients/${clientId}/health-score-manual-values`, { indicator_key: indicatorKey, score });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar valor manual.");
    }
  }

  const manualIndicators = indicators.filter((i) => i.source === "manual" && i.is_active);
  const manualByKey = new Map(manualValues.map((v) => [v.indicator_key, v.score]));

  return (
    <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {latest ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 32, fontWeight: 600, color: "var(--color-graphite)" }}>{latest.score}</span>
            <StatusBadge label={HEALTH_SCORE_CLASSIFICATION_LABELS[latest.classification]} tone={HEALTH_SCORE_CLASSIFICATION_TONE[latest.classification]} />
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{latest === undefined ? "Carregando..." : "Ainda não calculado."}</div>
        )}
        <button onClick={recalculate} disabled={calculating} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 12.5, fontWeight: 500 }}>
          {calculating ? "Calculando..." : "Recalcular"}
        </button>
      </div>

      {latest && latest.components.length > 0 && (
        <div>
          <SectionTitle>Componentes da pontuação</SectionTitle>
          {latest.components.map((c) => (
            <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 170, fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>{c.label}</div>
              <div style={{ flex: 1, background: "var(--surface-page)", borderRadius: "var(--radius-pill)", height: 6, overflow: "hidden" }}>
                <div style={{ background: "var(--color-blue)", height: "100%", width: `${c.value}%` }} />
              </div>
              <div style={{ width: 60, fontSize: 11.5, color: "var(--text-muted)", textAlign: "right" }}>{c.value} (p{c.weight})</div>
            </div>
          ))}
        </div>
      )}

      {reasons.length > 0 && (
        <div>
          <SectionTitle>Principais motivos de deterioração</SectionTitle>
          {reasons.map((r) => (
            <div key={r.key} style={{ fontSize: 12.5, color: "var(--color-danger-text)" }}>
              • {r.label}: {r.previous_value} → {r.current_value} (-{r.drop})
            </div>
          ))}
        </div>
      )}

      {manualIndicators.length > 0 && (
        <div>
          <SectionTitle>Indicadores manuais</SectionTitle>
          {manualIndicators.map((ind) => (
            <ManualValueRow key={ind.id} indicator={ind} currentScore={manualByKey.get(ind.key)} onSave={saveManualValue} />
          ))}
        </div>
      )}

      {history.length > 1 && (
        <div>
          <SectionTitle>Histórico</SectionTitle>
          {history.map((h) => (
            <div key={h.id} style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {new Date(h.calculated_at).toLocaleString("pt-BR")} — {h.score} ({HEALTH_SCORE_CLASSIFICATION_LABELS[h.classification]})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManualValueRow({ indicator, currentScore, onSave }: { indicator: HealthScoreIndicator; currentScore: number | undefined; onSave: (key: string, score: number) => void }) {
  const [value, setValue] = useState(currentScore?.toString() ?? "");

  useEffect(() => setValue(currentScore?.toString() ?? ""), [currentScore]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ width: 170, fontSize: 12, color: "var(--text-secondary)" }}>{indicator.label}</div>
      <input type="number" min={0} max={100} value={value} onChange={(e) => setValue(e.target.value)} style={{ ...fieldInput, width: 70 }} />
      <button
        onClick={() => {
          const n = Number(value);
          if (!Number.isNaN(n)) onSave(indicator.key, Math.max(0, Math.min(100, n)));
        }}
        style={smallButton}
      >
        Salvar
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.03em" }}>{children.toUpperCase()}</div>;
}

const fieldInput: CSSProperties = {
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
