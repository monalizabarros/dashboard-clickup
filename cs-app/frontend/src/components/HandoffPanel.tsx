import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import StatusBadge from "./StatusBadge";
import type { ChecklistItem, SalesHandoff } from "../types";

export default function HandoffPanel({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [handoffs, setHandoffs] = useState<SalesHandoff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api
      .get<SalesHandoff[]>(`/clients/${clientId}/sales-handoffs`)
      .then(setHandoffs)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar handoffs."));
  }

  useEffect(load, [clientId]);

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
          Handoff Comercial → Projetos + CS — {clientName}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              background: "var(--color-blue)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-control)",
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {showForm ? "Cancelar" : "+ Novo handoff"}
          </button>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 13, color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {showForm && (
        <NewHandoffForm
          clientId={clientId}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      {handoffs === null && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
      {handoffs?.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum handoff registrado ainda.</div>
      )}
      {handoffs?.map((h) => (
        <HandoffCard key={h.id} handoff={h} onChanged={load} onError={setError} />
      ))}
    </div>
  );
}

function HandoffCard({
  handoff,
  onChanged,
  onError,
}: {
  handoff: SalesHandoff;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");

  function loadChecklist() {
    api.get<ChecklistItem[]>(`/sales-handoffs/${handoff.id}/checklist`).then(setChecklist).catch(() => setChecklist([]));
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
      await api.post(`/sales-handoffs/${handoff.id}/checklist`, { label: newItemLabel, order_index: checklist?.length ?? 0 });
      setNewItemLabel("");
      loadChecklist();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao adicionar item.");
    }
  }

  async function complete() {
    try {
      await api.post(`/sales-handoffs/${handoff.id}/complete`);
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao concluir handoff.");
    }
  }

  return (
    <div style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--color-graphite)" }}>
          {handoff.contract_reference || "Handoff sem referência de contrato"}
        </div>
        {handoff.completed_at ? (
          <StatusBadge label="Concluído" tone="success" />
        ) : (
          <StatusBadge label="Pendente" tone="warning" />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
        <InfoBlock label="Escopo" value={handoff.scope} />
        <InfoBlock label="Data do handoff" value={handoff.handoff_date} />
        <InfoBlock label="Motivo da compra" value={handoff.purchase_reason} />
        <InfoBlock label="Problema a resolver" value={handoff.problem_to_solve} />
        <InfoBlock label="Objetivo da contratação" value={handoff.contracting_objective} />
        <InfoBlock label="Resultado esperado" value={handoff.expected_result} />
        <InfoBlock label="Critérios de sucesso" value={handoff.success_criteria} />
        <InfoBlock label="Riscos percebidos" value={handoff.perceived_risks} />
        <InfoBlock label="Customizações" value={handoff.customizations} />
        <InfoBlock label="Integrações" value={handoff.integrations} />
        <InfoBlock label="Premissas" value={handoff.assumptions} />
        <InfoBlock label="Dependências" value={handoff.dependencies} />
        <InfoBlock label="Participantes" value={handoff.participants} />
        <InfoBlock label="Pendências" value={handoff.pending_items} />
      </div>

      <div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.03em" }}>
          CHECKLIST
        </div>
        {checklist?.map((item) => (
          <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 4 }}>
            <input type="checkbox" checked={item.is_done} onChange={() => toggleItem(item)} disabled={!!handoff.completed_at} />
            <span style={{ textDecoration: item.is_done ? "line-through" : "none" }}>{item.label}</span>
          </label>
        ))}
        {!handoff.completed_at && (
          <form onSubmit={addItem} style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              placeholder="Novo item do checklist"
              style={{ ...fieldInput, flex: 1 }}
            />
            <button type="submit" style={{ background: "transparent", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "6px 10px", fontSize: 12, color: "var(--text-secondary)" }}>
              Adicionar
            </button>
          </form>
        )}
      </div>

      {handoff.completed_at ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Concluído em {new Date(handoff.completed_at).toLocaleString("pt-BR")}
        </div>
      ) : (
        <button
          onClick={complete}
          style={{
            alignSelf: "flex-start",
            background: "var(--color-blue)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-control)",
            padding: "7px 14px",
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          Concluir handoff (aceite formal)
        </button>
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

function NewHandoffForm({
  clientId,
  onCreated,
  onError,
}: {
  clientId: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [fields, setFields] = useState({
    contract_reference: "",
    scope: "",
    handoff_date: "",
    participants: "",
    purchase_reason: "",
    problem_to_solve: "",
    contracting_objective: "",
    expected_result: "",
    success_criteria: "",
    perceived_risks: "",
    customizations: "",
    integrations: "",
    assumptions: "",
    dependencies: "",
    pending_items: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function set(field: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, v || null])
      );
      await api.post(`/clients/${clientId}/sales-handoffs`, payload);
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar handoff.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <Section title="Execução (para Projetos)">
        <div style={gridStyle}>
          <Field label="Referência do contrato">
            <input value={fields.contract_reference} onChange={(e) => set("contract_reference", e.target.value)} style={fieldInput} />
          </Field>
          <Field label="Data do handoff">
            <input type="date" value={fields.handoff_date} onChange={(e) => set("handoff_date", e.target.value)} style={fieldInput} />
          </Field>
          <Field label="Escopo">
            <textarea value={fields.scope} onChange={(e) => set("scope", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Customizações">
            <textarea value={fields.customizations} onChange={(e) => set("customizations", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Integrações">
            <textarea value={fields.integrations} onChange={(e) => set("integrations", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Premissas">
            <textarea value={fields.assumptions} onChange={(e) => set("assumptions", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Dependências">
            <textarea value={fields.dependencies} onChange={(e) => set("dependencies", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Participantes">
            <input value={fields.participants} onChange={(e) => set("participants", e.target.value)} style={fieldInput} />
          </Field>
        </div>
      </Section>

      <Section title="Contexto de sucesso (para CS)">
        <div style={gridStyle}>
          <Field label="Motivo da compra">
            <textarea value={fields.purchase_reason} onChange={(e) => set("purchase_reason", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Problema que o cliente quer resolver">
            <textarea value={fields.problem_to_solve} onChange={(e) => set("problem_to_solve", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Objetivo da contratação">
            <textarea value={fields.contracting_objective} onChange={(e) => set("contracting_objective", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Resultado esperado">
            <textarea value={fields.expected_result} onChange={(e) => set("expected_result", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Critérios de sucesso">
            <textarea value={fields.success_criteria} onChange={(e) => set("success_criteria", e.target.value)} style={textareaInput} />
          </Field>
          <Field label="Riscos percebidos">
            <textarea value={fields.perceived_risks} onChange={(e) => set("perceived_risks", e.target.value)} style={textareaInput} />
          </Field>
        </div>
      </Section>

      <Section title="Pendências">
        <textarea value={fields.pending_items} onChange={(e) => set("pending_items", e.target.value)} style={textareaInput} />
      </Section>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: "var(--color-blue)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-control)",
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {submitting ? "Salvando..." : "Salvar handoff"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.03em" }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
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
