import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import StatusBadge from "./StatusBadge";
import type { ChecklistItem, DeliveryHandoff } from "../types";

export default function DeliveryHandoffPanel({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [handoffs, setHandoffs] = useState<DeliveryHandoff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api
      .get<DeliveryHandoff[]>(`/clients/${clientId}/delivery-handoffs`)
      .then(setHandoffs)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar handoffs."));
  }

  useEffect(load, [clientId]);

  return (
    <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-graphite)" }}>
          Handoff Projetos → CS — {clientName}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowForm((v) => !v)} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "5px 12px", fontSize: 12, fontWeight: 500 }}>
            {showForm ? "Cancelar" : "+ Novo handoff"}
          </button>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 13, color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {showForm && (
        <NewDeliveryHandoffForm
          clientId={clientId}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      {handoffs === null && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
      {handoffs?.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum handoff registrado ainda.</div>}
      {handoffs?.map((h) => (
        <DeliveryHandoffCard key={h.id} handoff={h} onChanged={load} onError={setError} />
      ))}
    </div>
  );
}

function DeliveryHandoffCard({
  handoff,
  onChanged,
  onError,
}: {
  handoff: DeliveryHandoff;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");

  function loadChecklist() {
    api.get<ChecklistItem[]>(`/delivery-handoffs/${handoff.id}/checklist`).then(setChecklist).catch(() => setChecklist([]));
  }

  useEffect(loadChecklist, [handoff.id]);

  async function toggleItem(item: ChecklistItem) {
    try {
      await api.patch(`/checklist-items/${item.id}`, { is_done: !item.is_done });
      loadChecklist();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao atualizar item.");
    }
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!newItemLabel) return;
    try {
      await api.post(`/delivery-handoffs/${handoff.id}/checklist`, { label: newItemLabel, order_index: checklist?.length ?? 0 });
      setNewItemLabel("");
      loadChecklist();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao adicionar item.");
    }
  }

  async function accept() {
    try {
      await api.post(`/delivery-handoffs/${handoff.id}/accept`);
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao aceitar handoff.");
    }
  }

  return (
    <div style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--color-graphite)" }}>
          Go-live: {handoff.go_live_date || "não definido"}
        </div>
        {handoff.accepted_at ? (
          <StatusBadge label="Aceito" tone="success" />
        ) : (
          <StatusBadge label="Pendente de aceite" tone="warning" />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
        <InfoBlock label="Escopo contratado" value={handoff.contracted_scope} />
        <InfoBlock label="Escopo entregue" value={handoff.delivered_scope} />
        <InfoBlock label="Pendências" value={handoff.pending_items} />
        <InfoBlock label="Customizações" value={handoff.customizations} />
        <InfoBlock label="Integrações" value={handoff.integrations} />
        <InfoBlock label="Limitações conhecidas" value={handoff.known_limitations} />
        <InfoBlock label="Problemas conhecidos" value={handoff.known_issues} />
        <InfoBlock label="Stakeholders" value={handoff.stakeholders_notes} />
        <InfoBlock label="Objetivo de negócio" value={handoff.business_objective} />
        <InfoBlock label="Critérios de sucesso" value={handoff.success_criteria} />
        <InfoBlock label="Período de hypercare" value={handoff.hypercare_start && handoff.hypercare_end ? `${handoff.hypercare_start} a ${handoff.hypercare_end}` : null} />
        <InfoBlock label="Próximos passos de adoção" value={handoff.next_adoption_steps} />
      </div>

      <div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.03em" }}>
          CHECKLIST DE TRANSFERÊNCIA
        </div>
        {checklist?.map((item) => (
          <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 4 }}>
            <input type="checkbox" checked={item.is_done} onChange={() => toggleItem(item)} disabled={!!handoff.accepted_at} />
            <span style={{ textDecoration: item.is_done ? "line-through" : "none" }}>{item.label}</span>
          </label>
        ))}
        {!handoff.accepted_at && (
          <form onSubmit={addItem} style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} placeholder="Novo item do checklist" style={{ ...fieldInput, flex: 1 }} />
            <button type="submit" style={smallButton}>Adicionar</button>
          </form>
        )}
      </div>

      {handoff.accepted_at ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Aceito em {new Date(handoff.accepted_at).toLocaleString("pt-BR")} — conta em operação recorrente.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            Ao aceitar, o status da conta muda automaticamente para "Ativo" (operação recorrente).
          </div>
          <button
            onClick={accept}
            style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 12.5, fontWeight: 500 }}
          >
            Aceitar handoff (CS)
          </button>
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{label}</div>
      <div style={{ color: "var(--text-secondary)" }}>{value}</div>
    </div>
  );
}

function NewDeliveryHandoffForm({
  clientId,
  onCreated,
  onError,
}: {
  clientId: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [fields, setFields] = useState({
    contracted_scope: "",
    delivered_scope: "",
    pending_items: "",
    customizations: "",
    integrations: "",
    known_limitations: "",
    known_issues: "",
    stakeholders_notes: "",
    business_objective: "",
    success_criteria: "",
    go_live_date: "",
    hypercare_start: "",
    hypercare_end: "",
    next_adoption_steps: "",
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
      await api.post(`/clients/${clientId}/delivery-handoffs`, payload);
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar handoff.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={gridStyle}>
        <Field label="Escopo contratado">
          <textarea value={fields.contracted_scope} onChange={(e) => set("contracted_scope", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Escopo entregue">
          <textarea value={fields.delivered_scope} onChange={(e) => set("delivered_scope", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Customizações">
          <textarea value={fields.customizations} onChange={(e) => set("customizations", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Integrações">
          <textarea value={fields.integrations} onChange={(e) => set("integrations", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Limitações conhecidas">
          <textarea value={fields.known_limitations} onChange={(e) => set("known_limitations", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Problemas conhecidos">
          <textarea value={fields.known_issues} onChange={(e) => set("known_issues", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Stakeholders">
          <textarea value={fields.stakeholders_notes} onChange={(e) => set("stakeholders_notes", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Objetivo de negócio">
          <textarea value={fields.business_objective} onChange={(e) => set("business_objective", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Critérios de sucesso">
          <textarea value={fields.success_criteria} onChange={(e) => set("success_criteria", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Próximos passos de adoção">
          <textarea value={fields.next_adoption_steps} onChange={(e) => set("next_adoption_steps", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Data de go-live">
          <input type="date" value={fields.go_live_date} onChange={(e) => set("go_live_date", e.target.value)} style={fieldInput} />
        </Field>
        <Field label="Pendências">
          <textarea value={fields.pending_items} onChange={(e) => set("pending_items", e.target.value)} style={textareaInput} />
        </Field>
        <Field label="Hypercare — início">
          <input type="date" value={fields.hypercare_start} onChange={(e) => set("hypercare_start", e.target.value)} style={fieldInput} />
        </Field>
        <Field label="Hypercare — fim">
          <input type="date" value={fields.hypercare_end} onChange={(e) => set("hypercare_end", e.target.value)} style={fieldInput} />
        </Field>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={submitting} style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>
          {submitting ? "Salvando..." : "Salvar handoff"}
        </button>
      </div>
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

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
};

const fieldInput: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "7px 9px",
  borderRadius: "var(--radius-control)",
  border: "0.5px solid var(--border-default)",
  fontSize: 13,
};

const textareaInput: CSSProperties = {
  ...fieldInput,
  minHeight: 50,
  resize: "vertical",
  fontFamily: "inherit",
};

const smallButton: CSSProperties = {
  background: "transparent",
  border: "0.5px solid var(--border-default)",
  borderRadius: "var(--radius-control)",
  padding: "6px 10px",
  fontSize: 12,
  color: "var(--text-secondary)",
};
