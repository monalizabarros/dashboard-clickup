import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import ActionPlansPanel from "../components/ActionPlansPanel";
import CheckInsPanel from "../components/CheckInsPanel";
import ContactsPanel from "../components/ContactsPanel";
import CSParticipationPanel from "../components/CSParticipationPanel";
import DeliveryHandoffPanel from "../components/DeliveryHandoffPanel";
import HandoffPanel from "../components/HandoffPanel";
import HealthScorePanel from "../components/HealthScorePanel";
import ImplementationPanel from "../components/ImplementationPanel";
import InteractionsTimeline from "../components/InteractionsTimeline";
import OnboardingPanel from "../components/OnboardingPanel";
import ProductMatrixPanel from "../components/ProductMatrixPanel";
import RisksPanel from "../components/RisksPanel";
import SurveysPanel from "../components/SurveysPanel";
import StatusBadge from "../components/StatusBadge";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONE,
  HEALTH_SCORE_CLASSIFICATION_LABELS,
  HEALTH_SCORE_CLASSIFICATION_TONE,
  TIER_LEVEL_LABELS,
  type AccountRisk,
  type Client,
  type DeliveryHandoff,
  type HealthScoreSnapshot,
  type ImplementationSummary,
  type SalesHandoff,
  type Task,
  type TierLevel,
  type UserOption,
} from "../types";

const TIER_OPTIONS = Object.entries(TIER_LEVEL_LABELS) as [TierLevel, string][];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [csOptions, setCsOptions] = useState<UserOption[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [salesHandoffs, setSalesHandoffs] = useState<SalesHandoff[]>([]);
  const [deliveryHandoffs, setDeliveryHandoffs] = useState<DeliveryHandoff[]>([]);
  const [implementation, setImplementation] = useState<ImplementationSummary | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScoreSnapshot | null>(null);
  const [risks, setRisks] = useState<AccountRisk[]>([]);

  useEffect(() => {
    if (!id) return;
    api.get<Client>(`/clients/${id}`).then(setClient).catch(() => setClient(null));
    api.get<UserOption[]>("/users/options/cs").then(setCsOptions).catch(() => {});
    api.get<Task[]>(`/clients/${id}/tasks`).then(setTasks).catch(() => setTasks([]));
    api.get<SalesHandoff[]>(`/clients/${id}/sales-handoffs`).then(setSalesHandoffs).catch(() => setSalesHandoffs([]));
    api.get<DeliveryHandoff[]>(`/clients/${id}/delivery-handoffs`).then(setDeliveryHandoffs).catch(() => setDeliveryHandoffs([]));
    api.get<ImplementationSummary>(`/clients/${id}/implementation-summary`).then(setImplementation).catch(() => setImplementation(null));
    api.get<HealthScoreSnapshot>(`/clients/${id}/health-score/latest`).then(setHealthScore).catch(() => setHealthScore(null));
    api.get<AccountRisk[]>(`/clients/${id}/risks`).then(setRisks).catch(() => setRisks([]));
  }, [id]);

  const ownerName = useMemo(
    () => csOptions.find((o) => o.id === client?.owner_user_id)?.name ?? null,
    [csOptions, client]
  );

  const nextStep = useMemo(() => {
    const open = tasks
      .filter((t) => t.status !== "concluida")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    return open[0] ?? null;
  }, [tasks]);

  const alerts = useMemo(() => {
    const list: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    const openSalesHandoff = salesHandoffs.find((h) => !h.completed_at);
    if (openSalesHandoff) list.push("Handoff comercial (venda) pendente de conclusão.");

    const openDeliveryHandoff = deliveryHandoffs.find((h) => !h.accepted_at);
    if (openDeliveryHandoff) list.push("Handoff de entrega (Projetos → CS) pendente de aceite.");

    const overdueTasks = tasks.filter((t) => t.status !== "concluida" && t.due_date && t.due_date < today);
    if (overdueTasks.length > 0) list.push(`${overdueTasks.length} tarefa(s) vencida(s).`);

    if (implementation?.situation === "atrasado") list.push("Implantação está atrasada.");

    const criticalRisks = risks.filter(
      (r) => r.impact === "alto" && r.probability === "alta" && r.status !== "mitigado" && r.status !== "encerrado"
    );
    if (criticalRisks.length > 0) list.push(`${criticalRisks.length} risco(s) crítico(s) em aberto.`);

    return list;
  }, [salesHandoffs, deliveryHandoffs, tasks, implementation, risks]);

  async function updateTier(tier: TierLevel | "") {
    if (!id) return;
    try {
      const updated = await api.patch<Client>(`/clients/${id}`, { tier: tier || null });
      setClient(updated);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Erro ao atualizar tier.");
    }
  }

  if (!id) return null;
  if (!client) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Link to="/clientes" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          ← Voltar para clientes
        </Link>
      </div>

      <div style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, color: "var(--color-graphite)" }}>{client.trade_name || client.corporate_name}</h1>
            {client.trade_name && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{client.corporate_name}</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {healthScore && (
              <StatusBadge
                label={`Health Score: ${healthScore.score} (${HEALTH_SCORE_CLASSIFICATION_LABELS[healthScore.classification]})`}
                tone={HEALTH_SCORE_CLASSIFICATION_TONE[healthScore.classification]}
              />
            )}
            <StatusBadge label={CLIENT_STATUS_LABELS[client.status]} tone={CLIENT_STATUS_TONE[client.status]} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, fontSize: 12.5, marginBottom: 16 }}>
          <Field label="CNPJ" value={client.cnpj} />
          <Field label="Segmento" value={client.segment} />
          <Field label="Grupo econômico" value={client.economic_group} />
          <Field label="Localização" value={client.location} />
          <Field label="Responsável de CS" value={ownerName} />
          <Field label="Início do relacionamento" value={client.relationship_start_date} />
          <label style={{ fontSize: 12.5 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Tier</div>
            <select
              value={client.tier ?? ""}
              onChange={(e) => updateTier(e.target.value as TierLevel | "")}
              style={{ marginTop: 2, padding: "4px 6px", borderRadius: "var(--radius-control)", border: "0.5px solid var(--border-default)", fontSize: 12.5, color: "var(--text-secondary)" }}
            >
              <option value="">Não definido</option>
              {TIER_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Próximo passo"
            value={nextStep ? `${nextStep.title}${nextStep.due_date ? ` (${nextStep.due_date})` : ""}` : "Nenhum próximo passo definido"}
          />
        </div>

        {alerts.length > 0 && (
          <div style={{ background: "var(--color-warning-bg)", borderRadius: "var(--radius-control)", padding: "10px 14px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-warning-text)", marginBottom: 4 }}>ALERTAS E PENDÊNCIAS</div>
            {alerts.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: "var(--color-warning-text)" }}>
                • {a}
              </div>
            ))}
          </div>
        )}
      </div>

      <Section title="Contatos e stakeholders">
        <ContactsPanel clientId={id} clientName={client.trade_name || client.corporate_name} onClose={() => {}} />
      </Section>

      <Section title="Produtos e módulos">
        <ProductMatrixPanel clientId={id} clientName={client.trade_name || client.corporate_name} onClose={() => {}} />
      </Section>

      <Section title="Implantação">
        <ImplementationPanel clientId={id} clientName={client.trade_name || client.corporate_name} onClose={() => {}} />
      </Section>

      <Section title="Handoff comercial (venda)">
        <HandoffPanel clientId={id} clientName={client.trade_name || client.corporate_name} onClose={() => {}} />
      </Section>

      <Section title="Handoff de entrega (Projetos → CS)">
        <DeliveryHandoffPanel clientId={id} clientName={client.trade_name || client.corporate_name} onClose={() => {}} />
      </Section>

      <Section title="Participação do CS">
        <CSParticipationPanel clientId={id} clientName={client.trade_name || client.corporate_name} onClose={() => {}} />
      </Section>

      <Section title="Pesquisas de satisfação">
        <SurveysPanel clientId={id} />
      </Section>

      <Section title="Riscos e recuperação">
        <RisksPanel clientId={id} />
      </Section>

      <Section title="Health Score">
        <HealthScorePanel clientId={id} />
      </Section>

      <Section title="Check-ins e relacionamento">
        <CheckInsPanel clientId={id} />
      </Section>

      <Section title="Onboarding e adoção">
        <OnboardingPanel clientId={id} />
      </Section>

      <Section title="Planos de ação">
        <ActionPlansPanel clientId={id} />
      </Section>

      <Section title="Histórico e interações">
        <InteractionsTimeline clientId={id} />
      </Section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{label}</div>
      <div style={{ color: "var(--text-secondary)" }}>{value || "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 15, color: "var(--color-graphite)", marginBottom: 10 }}>{title}</h2>
      {children}
    </div>
  );
}
