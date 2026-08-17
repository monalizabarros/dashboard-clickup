import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import {
  CONTACT_STATUS_LABELS,
  INFLUENCE_LEVEL_LABELS,
  STAKEHOLDER_TYPE_LABELS,
  type Contact,
  type ContactStatus,
  type InfluenceLevel,
  type StakeholderType,
} from "../types";

const STAKEHOLDER_OPTIONS = Object.entries(STAKEHOLDER_TYPE_LABELS) as [StakeholderType, string][];
const INFLUENCE_OPTIONS = Object.entries(INFLUENCE_LEVEL_LABELS) as [InfluenceLevel, string][];

export default function ContactsPanel({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api
      .get<Contact[]>(`/clients/${clientId}/contacts`)
      .then(setContacts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar contatos."));
  }

  useEffect(load, [clientId]);

  async function toggleSponsor(contact: Contact) {
    try {
      await api.patch(`/contacts/${contact.id}`, { is_main_sponsor: !contact.is_main_sponsor });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar contato.");
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<StakeholderType, Contact[]>();
    (contacts ?? []).forEach((c) => {
      const list = map.get(c.stakeholder_type) ?? [];
      list.push(c);
      map.set(c.stakeholder_type, list);
    });
    return map;
  }, [contacts]);

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
          Contatos e stakeholders — {clientName}
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
            {showForm ? "Cancelar" : "+ Novo contato"}
          </button>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 13, color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {showForm && (
        <NewContactForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
          clientId={clientId}
        />
      )}

      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.03em" }}>
          MAPA DE STAKEHOLDERS
        </div>
        {contacts === null && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
        {contacts?.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum contato cadastrado ainda.</div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {STAKEHOLDER_OPTIONS.filter(([type]) => grouped.has(type)).map(([type, label]) => (
            <div
              key={type}
              style={{
                border: "0.5px solid var(--border-default)",
                borderRadius: "var(--radius-control)",
                padding: "10px 12px",
                background: "var(--surface-page)",
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.03em" }}>
                {label.toUpperCase()}
              </div>
              {grouped.get(type)!.map((c) => (
                <div key={c.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "0.5px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-graphite)" }}>{c.name}</span>
                    {c.is_main_sponsor && (
                      <span style={{ fontSize: 11, color: "var(--color-blue)", fontWeight: 500 }}>★ sponsor principal</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {c.role_title || "—"} {c.area ? `· ${c.area}` : ""}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Influência: {INFLUENCE_LEVEL_LABELS[c.influence_level]} · {CONTACT_STATUS_LABELS[c.status]}
                  </div>
                  {c.stakeholder_type === "sponsor" && (
                    <button
                      onClick={() => toggleSponsor(c)}
                      style={{
                        marginTop: 4,
                        background: "transparent",
                        border: "0.5px solid var(--border-default)",
                        borderRadius: "var(--radius-control)",
                        padding: "2px 8px",
                        fontSize: 11,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {c.is_main_sponsor ? "Remover como principal" : "Definir como principal"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewContactForm({
  clientId,
  onCreated,
  onError,
}: {
  clientId: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [area, setArea] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stakeholderType, setStakeholderType] = useState<StakeholderType>("outro");
  const [influenceLevel, setInfluenceLevel] = useState<InfluenceLevel>("medio");
  const [status, setStatus] = useState<ContactStatus>("ativo");
  const [isMainSponsor, setIsMainSponsor] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name) {
      onError("Informe ao menos o nome do contato.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/clients/${clientId}/contacts`, {
        name,
        role_title: roleTitle || null,
        area: area || null,
        email: email || null,
        phone: phone || null,
        status,
        influence_level: influenceLevel,
        stakeholder_type: stakeholderType,
        is_main_sponsor: isMainSponsor,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar contato.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-control)",
        padding: "12px 14px",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
      }}
    >
      <Field label="Nome">
        <input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Cargo">
        <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Área">
        <input value={area} onChange={(e) => setArea(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="E-mail">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Telefone">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as ContactStatus)} style={fieldInput}>
          {Object.entries(CONTACT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipo de stakeholder">
        <select value={stakeholderType} onChange={(e) => setStakeholderType(e.target.value as StakeholderType)} style={fieldInput}>
          {STAKEHOLDER_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nível de influência">
        <select value={influenceLevel} onChange={(e) => setInfluenceLevel(e.target.value as InfluenceLevel)} style={fieldInput}>
          {INFLUENCE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", marginTop: 18 }}>
        <input type="checkbox" checked={isMainSponsor} onChange={(e) => setIsMainSponsor(e.target.checked)} />
        Sponsor principal da conta
      </label>

      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: "var(--color-blue)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-control)",
            padding: "7px 14px",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {submitting ? "Salvando..." : "Salvar contato"}
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

const fieldInput: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "7px 9px",
  borderRadius: "var(--radius-control)",
  border: "0.5px solid var(--border-default)",
  fontSize: 13,
};
