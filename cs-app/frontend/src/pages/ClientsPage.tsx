import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import ContactsPanel from "../components/ContactsPanel";
import CSParticipationPanel from "../components/CSParticipationPanel";
import DeliveryHandoffPanel from "../components/DeliveryHandoffPanel";
import HandoffPanel from "../components/HandoffPanel";
import ImplementationPanel from "../components/ImplementationPanel";
import ProductMatrixPanel from "../components/ProductMatrixPanel";
import StatusBadge from "../components/StatusBadge";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONE,
  type Client,
  type ClientOwnerHistoryEntry,
  type ClientStatus,
  type OverdueClient,
  type UserOption,
} from "../types";

const STATUS_OPTIONS = Object.entries(CLIENT_STATUS_LABELS) as [ClientStatus, string][];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [csOptions, setCsOptions] = useState<UserOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [contactsClientId, setContactsClientId] = useState<string | null>(null);
  const [productsClientId, setProductsClientId] = useState<string | null>(null);
  const [handoffClientId, setHandoffClientId] = useState<string | null>(null);
  const [implementationClientId, setImplementationClientId] = useState<string | null>(null);
  const [participationClientId, setParticipationClientId] = useState<string | null>(null);
  const [deliveryHandoffClientId, setDeliveryHandoffClientId] = useState<string | null>(null);
  const [overdueClients, setOverdueClients] = useState<OverdueClient[]>([]);

  const ownerNameById = useMemo(() => {
    const map = new Map<string, string>();
    csOptions.forEach((o) => map.set(o.id, o.name));
    return map;
  }, [csOptions]);

  function load() {
    api
      .get<Client[]>("/clients")
      .then(setClients)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar clientes."));
  }

  useEffect(() => {
    load();
    api.get<UserOption[]>("/users/options/cs").then(setCsOptions).catch(() => {});
    api.get<OverdueClient[]>("/check-ins/overdue-clients").then(setOverdueClients).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>Clientes</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
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
          {showForm ? "Cancelar" : "+ Novo cliente"}
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {overdueClients.length > 0 && (
        <div style={{ background: "var(--color-warning-bg)", borderRadius: "var(--radius-card)", padding: "12px 16px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-warning-text)", marginBottom: 6, letterSpacing: "0.03em" }}>
            CLIENTES SEM CONTATO DENTRO DA PERIODICIDADE ({overdueClients.length})
          </div>
          {overdueClients.map((o) => (
            <div key={o.client_id} style={{ fontSize: 12.5, color: "var(--color-warning-text)" }}>
              •{" "}
              <Link to={`/clientes/${o.client_id}`} style={{ color: "var(--color-warning-text)", fontWeight: 500 }}>
                {o.client_name}
              </Link>{" "}
              — {o.days_since_last_contact === null ? "nenhum check-in registrado" : `${o.days_since_last_contact} dias sem contato`} (cadência: {o.cadence_days} dias)
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NewClientForm
          csOptions={csOptions}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      <div
        style={{
          background: "var(--surface-card)",
          border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
        }}
      >
        <div style={rowStyle("header")}>
          <div>CLIENTE</div>
          <div>SEGMENTO</div>
          <div>RESPONSÁVEL CS</div>
          <div>STATUS</div>
          <div />
        </div>
        {clients === null && (
          <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>
        )}
        {clients?.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>
            Nenhum cliente cadastrado ainda.
          </div>
        )}
        {clients?.map((c) => (
          <div key={c.id} style={rowStyle("body")}>
            <div>
              <Link
                to={`/clientes/${c.id}`}
                style={{ fontWeight: 500, color: "var(--color-graphite)", textDecoration: "none" }}
              >
                {c.trade_name || c.corporate_name} <span style={{ color: "var(--color-blue)", fontSize: 11 }}>360°</span>
              </Link>
              {c.trade_name && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.corporate_name}</div>
              )}
            </div>
            <div style={{ color: "var(--text-secondary)" }}>{c.segment || "—"}</div>
            <div style={{ color: "var(--text-secondary)" }}>
              {c.owner_user_id ? ownerNameById.get(c.owner_user_id) ?? "—" : "—"}
            </div>
            <div>
              <StatusBadge label={CLIENT_STATUS_LABELS[c.status]} tone={CLIENT_STATUS_TONE[c.status]} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 6 }}>
              <button onClick={() => setDeliveryHandoffClientId(c.id)} style={actionButtonStyle}>
                Handoff Entrega
              </button>
              <button onClick={() => setParticipationClientId(c.id)} style={actionButtonStyle}>
                Participação CS
              </button>
              <button onClick={() => setImplementationClientId(c.id)} style={actionButtonStyle}>
                Implantação
              </button>
              <button onClick={() => setHandoffClientId(c.id)} style={actionButtonStyle}>
                Handoff Venda
              </button>
              <button onClick={() => setProductsClientId(c.id)} style={actionButtonStyle}>
                Produtos
              </button>
              <button onClick={() => setContactsClientId(c.id)} style={actionButtonStyle}>
                Contatos
              </button>
              <button onClick={() => setHistoryClientId(c.id)} style={actionButtonStyle}>
                Histórico
              </button>
            </div>
          </div>
        ))}
      </div>

      {historyClientId && (
        <OwnerHistoryPanel
          clientId={historyClientId}
          clientName={
            clients?.find((c) => c.id === historyClientId)?.trade_name ??
            clients?.find((c) => c.id === historyClientId)?.corporate_name ??
            ""
          }
          ownerNameById={ownerNameById}
          onClose={() => setHistoryClientId(null)}
        />
      )}

      {contactsClientId && (
        <ContactsPanel
          clientId={contactsClientId}
          clientName={
            clients?.find((c) => c.id === contactsClientId)?.trade_name ??
            clients?.find((c) => c.id === contactsClientId)?.corporate_name ??
            ""
          }
          onClose={() => setContactsClientId(null)}
        />
      )}

      {productsClientId && (
        <ProductMatrixPanel
          clientId={productsClientId}
          clientName={
            clients?.find((c) => c.id === productsClientId)?.trade_name ??
            clients?.find((c) => c.id === productsClientId)?.corporate_name ??
            ""
          }
          onClose={() => setProductsClientId(null)}
        />
      )}

      {handoffClientId && (
        <HandoffPanel
          clientId={handoffClientId}
          clientName={
            clients?.find((c) => c.id === handoffClientId)?.trade_name ??
            clients?.find((c) => c.id === handoffClientId)?.corporate_name ??
            ""
          }
          onClose={() => setHandoffClientId(null)}
        />
      )}

      {implementationClientId && (
        <ImplementationPanel
          clientId={implementationClientId}
          clientName={
            clients?.find((c) => c.id === implementationClientId)?.trade_name ??
            clients?.find((c) => c.id === implementationClientId)?.corporate_name ??
            ""
          }
          onClose={() => setImplementationClientId(null)}
        />
      )}

      {participationClientId && (
        <CSParticipationPanel
          clientId={participationClientId}
          clientName={
            clients?.find((c) => c.id === participationClientId)?.trade_name ??
            clients?.find((c) => c.id === participationClientId)?.corporate_name ??
            ""
          }
          onClose={() => setParticipationClientId(null)}
        />
      )}

      {deliveryHandoffClientId && (
        <DeliveryHandoffPanel
          clientId={deliveryHandoffClientId}
          clientName={
            clients?.find((c) => c.id === deliveryHandoffClientId)?.trade_name ??
            clients?.find((c) => c.id === deliveryHandoffClientId)?.corporate_name ??
            ""
          }
          onClose={() => setDeliveryHandoffClientId(null)}
        />
      )}
    </div>
  );
}

const actionButtonStyle: CSSProperties = {
  background: "transparent",
  border: "0.5px solid var(--border-default)",
  borderRadius: "var(--radius-control)",
  padding: "5px 10px",
  fontSize: 12,
  color: "var(--text-secondary)",
};

function rowStyle(kind: "header" | "body"): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.8fr 1fr 0.8fr 2.1fr",
    alignItems: "center",
    padding: kind === "header" ? "10px 16px" : "11px 16px",
    fontSize: kind === "header" ? 11.5 : 13,
    color: kind === "header" ? "var(--text-muted)" : undefined,
    borderBottom: "0.5px solid var(--border-subtle)",
    letterSpacing: kind === "header" ? "0.03em" : undefined,
  };
}

function NewClientForm({
  csOptions,
  onCreated,
  onError,
}: {
  csOptions: UserOption[];
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [corporateName, setCorporateName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segment, setSegment] = useState("");
  const [economicGroup, setEconomicGroup] = useState("");
  const [location, setLocation] = useState("");
  const [relationshipStartDate, setRelationshipStartDate] = useState("");
  const [status, setStatus] = useState<ClientStatus>("prospect");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!corporateName) {
      onError("Informe ao menos a razão social.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/clients", {
        corporate_name: corporateName,
        trade_name: tradeName || null,
        cnpj: cnpj || null,
        segment: segment || null,
        economic_group: economicGroup || null,
        location: location || null,
        relationship_start_date: relationshipStartDate || null,
        status,
        owner_user_id: ownerUserId || null,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar cliente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--surface-card)",
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-card)",
        padding: "16px 18px",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
      }}
    >
      <Field label="Razão social">
        <input value={corporateName} onChange={(e) => setCorporateName(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Nome fantasia">
        <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="CNPJ">
        <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Segmento">
        <input value={segment} onChange={(e) => setSegment(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Grupo econômico">
        <input value={economicGroup} onChange={(e) => setEconomicGroup(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Localização">
        <input value={location} onChange={(e) => setLocation(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Início do relacionamento">
        <input
          type="date"
          value={relationshipStartDate}
          onChange={(e) => setRelationshipStartDate(e.target.value)}
          style={fieldInput}
        />
      </Field>
      <Field label="Status da conta">
        <select value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)} style={fieldInput}>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Responsável de CS">
        <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} style={fieldInput}>
          <option value="">Sem responsável definido</option>
          {csOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
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
          {submitting ? "Salvando..." : "Salvar cliente"}
        </button>
      </div>
    </form>
  );
}

function OwnerHistoryPanel({
  clientId,
  clientName,
  ownerNameById,
  onClose,
}: {
  clientId: string;
  clientName: string;
  ownerNameById: Map<string, string>;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<ClientOwnerHistoryEntry[] | null>(null);

  useEffect(() => {
    setHistory(null);
    api.get<ClientOwnerHistoryEntry[]>(`/clients/${clientId}/owner-history`).then(setHistory).catch(() => setHistory([]));
  }, [clientId]);

  function ownerLabel(id: string | null) {
    if (!id) return "Sem responsável";
    return ownerNameById.get(id) ?? "Usuário removido";
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
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-graphite)" }}>
          Histórico de responsável — {clientName}
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", fontSize: 13, color: "var(--text-muted)" }}
        >
          Fechar
        </button>
      </div>

      {history === null && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
      {history?.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhuma troca de responsável registrada.</div>
      )}
      {history?.map((h) => (
        <div key={h.id} style={{ fontSize: 13, color: "var(--text-secondary)", borderBottom: "0.5px solid var(--border-subtle)", paddingBottom: 6 }}>
          <span style={{ color: "var(--text-muted)" }}>{new Date(h.changed_at).toLocaleString("pt-BR")}</span>
          {" — "}
          {ownerLabel(h.previous_owner_id)} <span style={{ color: "var(--text-muted)" }}>→</span> {ownerLabel(h.new_owner_id)}
        </div>
      ))}
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

const fieldInput: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "7px 9px",
  borderRadius: "var(--radius-control)",
  border: "0.5px solid var(--border-default)",
  fontSize: 13,
};
