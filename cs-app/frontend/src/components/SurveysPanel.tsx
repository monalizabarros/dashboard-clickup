import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import StatusBadge from "./StatusBadge";
import { SURVEY_TYPE_LABELS, type Survey, type SurveySummary, type SurveyType } from "../types";

function isNegative(s: Survey) {
  return s.type === "nps" ? s.score <= 6 : s.score <= 2;
}

export default function SurveysPanel({ clientId }: { clientId: string }) {
  const [surveys, setSurveys] = useState<Survey[] | null>(null);
  const [summary, setSummary] = useState<SurveySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get<Survey[]>(`/clients/${clientId}/surveys`).then(setSurveys).catch(() => setSurveys([]));
    api.get<SurveySummary>(`/clients/${clientId}/surveys/summary`).then(setSummary).catch(() => setSummary(null));
  }

  useEffect(load, [clientId]);

  return (
    <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 16 }}>
          {summary?.nps_score !== null && summary?.nps_score !== undefined && (
            <Metric label="NPS" value={summary.nps_score} />
          )}
          {summary?.csat_average !== null && summary?.csat_average !== undefined && (
            <Metric label="CSAT médio" value={summary.csat_average} />
          )}
          {summary && summary.total_responses === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhuma resposta ainda.</div>}
        </div>
        <button onClick={() => setShowForm((v) => !v)} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "6px 12px", fontSize: 12, fontWeight: 500 }}>
          {showForm ? "Cancelar" : "+ Nova resposta"}
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {showForm && (
        <NewSurveyForm
          clientId={clientId}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      <div>
        {surveys?.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhuma pesquisa registrada ainda.</div>}
        {surveys?.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6, paddingBottom: 6, borderBottom: "0.5px solid var(--border-subtle)" }}>
            <span style={{ color: "var(--text-muted)", width: 90 }}>{s.survey_date}</span>
            <StatusBadge label={`${SURVEY_TYPE_LABELS[s.type]} ${s.score}`} tone={isNegative(s) ? "danger" : "success"} />
            <span>{s.respondent_name || "—"}</span>
            {s.comment && <span style={{ color: "var(--text-muted)" }}>— {s.comment}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600, color: "var(--color-graphite)" }}>{value}</div>
    </div>
  );
}

function NewSurveyForm({ clientId, onCreated, onError }: { clientId: string; onCreated: () => void; onError: (msg: string) => void }) {
  const [type, setType] = useState<SurveyType>("nps");
  const [score, setScore] = useState("10");
  const [comment, setComment] = useState("");
  const [surveyDate, setSurveyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [respondentName, setRespondentName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const maxScore = type === "nps" ? 10 : 5;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(score);
    if (Number.isNaN(n) || n < 0 || n > maxScore) {
      onError(`Nota deve estar entre 0 e ${maxScore}.`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/clients/${clientId}/surveys`, {
        type,
        score: n,
        comment: comment || null,
        survey_date: surveyDate,
        respondent_name: respondentName || null,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao registrar pesquisa.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Tipo
        <select value={type} onChange={(e) => { setType(e.target.value as SurveyType); setScore(e.target.value === "nps" ? "10" : "5"); }} style={fieldInput}>
          <option value="nps">NPS (0 a 10)</option>
          <option value="csat">CSAT (1 a 5)</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Nota (0-{maxScore} negativo: {type === "nps" ? "≤6" : "≤2"})
        <input type="number" min={0} max={maxScore} value={score} onChange={(e) => setScore(e.target.value)} style={fieldInput} />
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Data
        <input type="date" value={surveyDate} onChange={(e) => setSurveyDate(e.target.value)} style={fieldInput} />
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Respondente
        <input value={respondentName} onChange={(e) => setRespondentName(e.target.value)} style={fieldInput} />
      </label>
      <label style={{ fontSize: 12, color: "var(--text-secondary)", gridColumn: "1 / -1" }}>
        Comentário
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} style={{ ...fieldInput, minHeight: 42, resize: "vertical", fontFamily: "inherit" }} />
      </label>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={submitting} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 13, fontWeight: 500 }}>
          {submitting ? "Salvando..." : "Registrar resposta"}
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
