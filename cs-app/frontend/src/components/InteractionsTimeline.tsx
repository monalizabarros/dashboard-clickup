import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { INTERACTION_TYPE_LABELS, type Interaction, type InteractionType } from "../types";

const TYPE_OPTIONS = Object.entries(INTERACTION_TYPE_LABELS) as [InteractionType, string][];

export default function InteractionsTimeline({ clientId }: { clientId: string }) {
  const [interactions, setInteractions] = useState<Interaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<InteractionType>("reuniao");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .get<Interaction[]>(`/clients/${clientId}/interactions`)
      .then(setInteractions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar histórico."));
  }

  useEffect(load, [clientId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description) {
      setError("Descreva a interação.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/clients/${clientId}/interactions`, {
        type,
        description,
        occurred_at: occurredAt,
        attachment_url: attachmentUrl || null,
      });
      setDescription("");
      setAttachmentUrl("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao registrar interação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr auto", gap: 8, alignItems: "end" }}>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as InteractionType)} style={fieldInput}>
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Descrição
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={fieldInput} />
        </label>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Data/hora
          <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} style={fieldInput} />
        </label>
        <button type="submit" disabled={submitting} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 12.5, fontWeight: 500, height: 34 }}>
          Registrar
        </button>
        <label style={{ fontSize: 12, color: "var(--text-secondary)", gridColumn: "1 / -1" }}>
          Link de anexo (opcional)
          <input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} style={fieldInput} placeholder="https://..." />
        </label>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {interactions === null && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
        {interactions?.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhuma interação registrada ainda.</div>}
        {interactions?.map((it) => (
          <div key={it.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--border-subtle)" }}>
            <div style={{ width: 130, flexShrink: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
              {new Date(it.occurred_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite)" }}>{INTERACTION_TYPE_LABELS[it.type]}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}> — {it.description}</span>
              {it.attachment_url && (
                <div>
                  <a href={it.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--color-blue)" }}>
                    Ver anexo ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
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
