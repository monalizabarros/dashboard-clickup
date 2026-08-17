import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import type { CheckIn } from "../types";

const ROTEIRO = [
  "Como está a percepção geral do cliente sobre o produto?",
  "Existem problemas ou reclamações recentes?",
  "Há oportunidades de expansão identificadas?",
  "Quais decisões foram tomadas nesta conversa?",
  "Quais compromissos foram assumidos por cada lado?",
  "Quais são os próximos passos?",
];

export default function CheckInsPanel({ clientId }: { clientId: string }) {
  const [checkIns, setCheckIns] = useState<CheckIn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);

  function load() {
    api.get<CheckIn[]>(`/clients/${clientId}/check-ins`).then(setCheckIns).catch(() => setCheckIns([]));
  }

  useEffect(load, [clientId]);

  async function schedule(e: FormEvent) {
    e.preventDefault();
    if (!newDate) return;
    try {
      await api.post(`/clients/${clientId}/check-ins`, { scheduled_at: newDate });
      setNewDate("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao agendar check-in.");
    }
  }

  const pending = checkIns?.filter((c) => !c.completed_at) ?? [];
  const done = checkIns?.filter((c) => !!c.completed_at) ?? [];

  return (
    <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <div>
        <SectionTitle>Check-ins agendados</SectionTitle>
        {pending.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum check-in agendado.</div>}
        {pending.map((c) => (
          <div key={c.id} style={{ marginBottom: 8 }}>
            {completingId === c.id ? (
              <CompleteForm checkIn={c} onDone={() => { setCompletingId(null); load(); }} onError={setError} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "var(--text-secondary)" }}>Agendado para {c.scheduled_at}</span>
                <button onClick={() => setCompletingId(c.id)} style={smallButton}>Concluir check-in</button>
              </div>
            )}
          </div>
        ))}
        <form onSubmit={schedule} style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={fieldInput} />
          <button type="submit" style={smallButton}>Agendar novo</button>
        </form>
      </div>

      <div>
        <SectionTitle>Histórico de check-ins</SectionTitle>
        {done.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum check-in concluído ainda.</div>}
        {done.map((c) => (
          <div key={c.id} style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 8, paddingBottom: 8, borderBottom: "0.5px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{new Date(c.completed_at!).toLocaleDateString("pt-BR")}</div>
            {c.client_perception && <div><strong>Percepção:</strong> {c.client_perception}</div>}
            {c.problems && <div><strong>Problemas:</strong> {c.problems}</div>}
            {c.opportunities && <div><strong>Oportunidades:</strong> {c.opportunities}</div>}
            {c.feedback && <div><strong>Feedback:</strong> {c.feedback}</div>}
            {c.decisions && <div><strong>Decisões:</strong> {c.decisions}</div>}
            {c.commitments && <div><strong>Compromissos:</strong> {c.commitments}</div>}
            {c.next_steps && <div><strong>Próximos passos:</strong> {c.next_steps}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompleteForm({ checkIn, onDone, onError }: { checkIn: CheckIn; onDone: () => void; onError: (msg: string) => void }) {
  const [fields, setFields] = useState({
    client_perception: "",
    problems: "",
    opportunities: "",
    feedback: "",
    decisions: "",
    commitments: "",
    next_steps: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function set(field: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v || null]));
      await api.post(`/check-ins/${checkIn.id}/complete`, payload);
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao concluir check-in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        Roteiro sugerido: {ROTEIRO.join(" · ")}
      </div>
      <textarea placeholder="Percepção do cliente" value={fields.client_perception} onChange={(e) => set("client_perception", e.target.value)} style={textareaInput} />
      <textarea placeholder="Problemas" value={fields.problems} onChange={(e) => set("problems", e.target.value)} style={textareaInput} />
      <textarea placeholder="Oportunidades" value={fields.opportunities} onChange={(e) => set("opportunities", e.target.value)} style={textareaInput} />
      <textarea placeholder="Feedback" value={fields.feedback} onChange={(e) => set("feedback", e.target.value)} style={textareaInput} />
      <textarea placeholder="Decisões" value={fields.decisions} onChange={(e) => set("decisions", e.target.value)} style={textareaInput} />
      <textarea placeholder="Compromissos" value={fields.commitments} onChange={(e) => set("commitments", e.target.value)} style={textareaInput} />
      <textarea placeholder="Próximos passos" value={fields.next_steps} onChange={(e) => set("next_steps", e.target.value)} style={textareaInput} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={submitting} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 12.5, fontWeight: 500 }}>
          {submitting ? "Salvando..." : "Concluir check-in"}
        </button>
      </div>
    </form>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.03em" }}>{children.toUpperCase()}</div>;
}

const fieldInput: CSSProperties = {
  padding: "7px 9px",
  borderRadius: "var(--radius-control)",
  border: "0.5px solid var(--border-default)",
  fontSize: 13,
};

const textareaInput: CSSProperties = {
  ...fieldInput,
  minHeight: 42,
  resize: "vertical",
  fontFamily: "inherit",
};

const smallButton: CSSProperties = {
  background: "transparent",
  border: "0.5px solid var(--border-default)",
  borderRadius: "var(--radius-control)",
  padding: "7px 12px",
  fontSize: 12,
  color: "var(--text-secondary)",
};
