export type RoleName =
  | "administrador"
  | "cs"
  | "gestor_cs"
  | "comercial"
  | "projetos"
  | "suporte"
  | "produto"
  | "gestao";

export const ROLE_LABELS: Record<RoleName, string> = {
  administrador: "Administrador",
  cs: "CS",
  gestor_cs: "Gestor de CS",
  comercial: "Comercial",
  projetos: "Projetos",
  suporte: "Suporte",
  produto: "Produto",
  gestao: "Gestão",
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type ClientStatus =
  | "prospect"
  | "em_onboarding"
  | "ativo"
  | "em_risco"
  | "em_recuperacao"
  | "em_renovacao"
  | "churn"
  | "encerrado";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: "Prospect",
  em_onboarding: "Em onboarding",
  ativo: "Ativo",
  em_risco: "Em risco",
  em_recuperacao: "Em recuperação",
  em_renovacao: "Em renovação",
  churn: "Churn",
  encerrado: "Encerrado",
};

export type ClientStatusTone = "success" | "warning" | "danger" | "neutral";

export const CLIENT_STATUS_TONE: Record<ClientStatus, ClientStatusTone> = {
  prospect: "neutral",
  em_onboarding: "warning",
  ativo: "success",
  em_risco: "danger",
  em_recuperacao: "danger",
  em_renovacao: "warning",
  churn: "neutral",
  encerrado: "neutral",
};

export type TierLevel = "platina" | "ouro" | "prata" | "bronze";

export const TIER_LEVEL_LABELS: Record<TierLevel, string> = {
  platina: "Platina",
  ouro: "Ouro",
  prata: "Prata",
  bronze: "Bronze",
};

export interface Client {
  id: string;
  corporate_name: string;
  trade_name: string | null;
  cnpj: string | null;
  segment: string | null;
  economic_group: string | null;
  location: string | null;
  relationship_start_date: string | null;
  status: ClientStatus;
  tier: TierLevel | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TierCadence {
  tier: TierLevel;
  frequency_days: number;
}

export interface CheckIn {
  id: string;
  client_id: string;
  scheduled_at: string;
  completed_at: string | null;
  client_perception: string | null;
  problems: string | null;
  opportunities: string | null;
  feedback: string | null;
  decisions: string | null;
  commitments: string | null;
  next_steps: string | null;
  created_by_id: string | null;
  created_at: string;
}

export interface OverdueClient {
  client_id: string;
  client_name: string;
  tier: TierLevel | null;
  last_check_in_at: string | null;
  cadence_days: number | null;
  days_since_last_contact: number | null;
}

export interface ClientOwnerHistoryEntry {
  id: string;
  client_id: string;
  previous_owner_id: string | null;
  new_owner_id: string | null;
  changed_by_id: string | null;
  changed_at: string;
}

export interface UserOption {
  id: string;
  name: string;
  role: string;
}

export type ContactStatus = "ativo" | "inativo";

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

export type InfluenceLevel = "baixo" | "medio" | "alto";

export const INFLUENCE_LEVEL_LABELS: Record<InfluenceLevel, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

export type StakeholderType =
  | "sponsor"
  | "decisor"
  | "usuario"
  | "influenciador"
  | "ti"
  | "administrativo"
  | "financeiro"
  | "outro";

export const STAKEHOLDER_TYPE_LABELS: Record<StakeholderType, string> = {
  sponsor: "Sponsor",
  decisor: "Decisor",
  usuario: "Usuário",
  influenciador: "Influenciador",
  ti: "TI",
  administrativo: "Administrativo",
  financeiro: "Financeiro",
  outro: "Outro",
};

export interface Module {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  modules: Module[];
}

export type ProductStatus =
  | "nao_iniciado"
  | "em_implantacao"
  | "implantado"
  | "ativo"
  | "suspenso"
  | "encerrado";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_implantacao: "Em implantação",
  implantado: "Implantado",
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export const PRODUCT_STATUS_TONE: Record<ProductStatus, ClientStatusTone> = {
  nao_iniciado: "neutral",
  em_implantacao: "warning",
  implantado: "warning",
  ativo: "success",
  suspenso: "danger",
  encerrado: "neutral",
};

export interface ClientProduct {
  id: string;
  client_id: string;
  product_id: string;
  contracted_at: string | null;
  status: ProductStatus;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type UsageLevel = "nao_avaliado" | "baixa" | "media" | "alta";

export const USAGE_LEVEL_LABELS: Record<UsageLevel, string> = {
  nao_avaliado: "Não avaliado",
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export interface ClientModule {
  id: string;
  client_id: string;
  module_id: string;
  contracted_at: string | null;
  is_implemented: boolean;
  usage_level: UsageLevel;
  created_at: string;
  updated_at: string;
}

export interface SalesHandoff {
  id: string;
  client_id: string;
  contract_reference: string | null;
  scope: string | null;
  products_summary: string | null;
  modules_summary: string | null;
  customizations: string | null;
  integrations: string | null;
  assumptions: string | null;
  dependencies: string | null;
  purchase_reason: string | null;
  problem_to_solve: string | null;
  contracting_objective: string | null;
  expected_result: string | null;
  expected_deadline: string | null;
  sponsor_contact_id: string | null;
  stakeholders_notes: string | null;
  success_criteria: string | null;
  perceived_risks: string | null;
  participants: string | null;
  handoff_date: string | null;
  pending_items: string | null;
  completed_at: string | null;
  completed_by_id: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  owner_type: string;
  owner_id: string;
  label: string;
  is_done: boolean;
  done_at: string | null;
  done_by_id: string | null;
  order_index: number;
}

export type ImplementationStatus =
  | "nao_iniciado"
  | "planejado"
  | "em_implantacao"
  | "pre_go_live"
  | "go_live"
  | "hypercare"
  | "concluido";

export const IMPLEMENTATION_STATUS_LABELS: Record<ImplementationStatus, string> = {
  nao_iniciado: "Não iniciado",
  planejado: "Planejado",
  em_implantacao: "Em implantação",
  pre_go_live: "Pré-go-live",
  go_live: "Go-live",
  hypercare: "Hypercare",
  concluido: "Concluído",
};

export type ImplementationSituation = "no_prazo" | "em_atencao" | "atrasado";

export const IMPLEMENTATION_SITUATION_LABELS: Record<ImplementationSituation, string> = {
  no_prazo: "No prazo",
  em_atencao: "Em atenção",
  atrasado: "Atrasado",
};

export const IMPLEMENTATION_SITUATION_TONE: Record<ImplementationSituation, ClientStatusTone> = {
  no_prazo: "success",
  em_atencao: "warning",
  atrasado: "danger",
};

export interface ImplementationSummary {
  id: string;
  client_id: string;
  status: ImplementationStatus;
  situation: ImplementationSituation;
  expected_deadline: string | null;
  external_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  client_id: string;
  label: string;
  target_date: string | null;
  is_completed: boolean;
  order_index: number;
}

export type ImplementationEventType = "risco" | "impedimento" | "dependencia" | "decisao";

export const IMPLEMENTATION_EVENT_TYPE_LABELS: Record<ImplementationEventType, string> = {
  risco: "Risco",
  impedimento: "Impedimento",
  dependencia: "Dependência",
  decisao: "Decisão",
};

export interface ImplementationEvent {
  id: string;
  client_id: string;
  type: ImplementationEventType;
  description: string;
  created_by_id: string | null;
  created_at: string;
}

export type ImplementationPhase = "handoff" | "kickoff" | "pre_go_live" | "go_live" | "hypercare";

export const IMPLEMENTATION_PHASE_LABELS: Record<ImplementationPhase, string> = {
  handoff: "Handoff",
  kickoff: "Kickoff",
  pre_go_live: "Pré-go-live",
  go_live: "Go-live",
  hypercare: "Hypercare",
};

export const IMPLEMENTATION_PHASE_ORDER: ImplementationPhase[] = [
  "handoff",
  "kickoff",
  "pre_go_live",
  "go_live",
  "hypercare",
];

export interface PhaseParticipation {
  id: string;
  client_id: string;
  phase: ImplementationPhase;
  participated: boolean;
  participation_date: string | null;
  notes: string | null;
  updated_at: string;
}

export type JourneyRiskCategory = "expectativa" | "relacionamento" | "adocao" | "satisfacao" | "resultado_esperado";

export const JOURNEY_RISK_CATEGORY_LABELS: Record<JourneyRiskCategory, string> = {
  expectativa: "Expectativa",
  relacionamento: "Relacionamento",
  adocao: "Adoção",
  satisfacao: "Satisfação",
  resultado_esperado: "Resultado esperado",
};

export interface JourneyRisk {
  id: string;
  client_id: string;
  category: JourneyRiskCategory;
  description: string;
  created_by_id: string | null;
  created_at: string;
}

export interface PostGoLiveObjective {
  id: string;
  client_id: string;
  description: string;
  is_achieved: boolean;
  achieved_at: string | null;
  created_by_id: string | null;
  created_at: string;
}

export type TaskPriority = "baixa" | "media" | "alta";

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export type TaskStatus = "aberta" | "em_andamento" | "concluida";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export interface Task {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  responsible_user_id: string | null;
  due_date: string | null;
  priority: TaskPriority;
  origin: string;
  product_id: string | null;
  action_plan_id: string | null;
  status: TaskStatus;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithClient extends Task {
  client_name: string;
}

export type ActionPlanStatus = "aberto" | "em_andamento" | "concluido";

export const ACTION_PLAN_STATUS_LABELS: Record<ActionPlanStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export interface ActionPlan {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: ActionPlanStatus;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTemplateItem {
  id: string;
  product_id: string;
  label: string;
  order_index: number;
}

export interface OnboardingJourney {
  id: string;
  client_id: string;
  started_at: string;
  first_usage_at: string | null;
}

export interface OnboardingActivity {
  id: string;
  client_id: string;
  label: string;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  order_index: number;
}

export interface OnboardingState {
  journey: OnboardingJourney | null;
  activities: OnboardingActivity[];
  progress_percent: number;
}

export interface AdoptionMilestone {
  id: string;
  client_id: string;
  label: string;
  notes: string | null;
  achieved_at: string;
  created_by_id: string | null;
  created_at: string;
}

export interface DeliveryHandoff {
  id: string;
  client_id: string;
  contracted_scope: string | null;
  delivered_scope: string | null;
  pending_items: string | null;
  customizations: string | null;
  integrations: string | null;
  known_limitations: string | null;
  known_issues: string | null;
  sponsor_contact_id: string | null;
  stakeholders_notes: string | null;
  business_objective: string | null;
  success_criteria: string | null;
  go_live_date: string | null;
  hypercare_start: string | null;
  hypercare_end: string | null;
  next_adoption_steps: string | null;
  accepted_at: string | null;
  accepted_by_id: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export type InteractionType =
  | "reuniao"
  | "ligacao"
  | "email"
  | "contato"
  | "reclamacao"
  | "elogio"
  | "decisao"
  | "compromisso"
  | "feedback"
  | "incidente";

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  reuniao: "Reunião",
  ligacao: "Ligação",
  email: "E-mail",
  contato: "Contato",
  reclamacao: "Reclamação",
  elogio: "Elogio",
  decisao: "Decisão",
  compromisso: "Compromisso",
  feedback: "Feedback",
  incidente: "Incidente",
};

export interface Interaction {
  id: string;
  client_id: string;
  type: InteractionType;
  description: string;
  occurred_at: string;
  attachment_url: string | null;
  product_id: string | null;
  module_id: string | null;
  contact_id: string | null;
  created_by_id: string | null;
  created_at: string;
}

export type IndicatorSource = "auto" | "manual";

export const INDICATOR_SOURCE_LABELS: Record<IndicatorSource, string> = {
  auto: "Automático",
  manual: "Manual",
};

export interface HealthScoreIndicator {
  id: string;
  key: string;
  label: string;
  weight: number;
  source: IndicatorSource;
  is_active: boolean;
}

export interface HealthScoreManualValue {
  id: string;
  client_id: string;
  indicator_key: string;
  score: number;
  updated_at: string;
}

export type HealthScoreClassification = "verde" | "amarelo" | "vermelho";

export const HEALTH_SCORE_CLASSIFICATION_LABELS: Record<HealthScoreClassification, string> = {
  verde: "Saudável",
  amarelo: "Atenção",
  vermelho: "Crítico",
};

export const HEALTH_SCORE_CLASSIFICATION_TONE: Record<HealthScoreClassification, ClientStatusTone> = {
  verde: "success",
  amarelo: "warning",
  vermelho: "danger",
};

export interface HealthScoreComponent {
  key: string;
  label: string;
  value: number;
  weight: number;
}

export interface HealthScoreSnapshot {
  id: string;
  client_id: string;
  score: number;
  classification: HealthScoreClassification;
  components: HealthScoreComponent[];
  calculated_at: string;
}

export interface DeteriorationReason {
  key: string;
  label: string;
  previous_value: number;
  current_value: number;
  drop: number;
}

export type RiskCategory =
  | "adocao"
  | "relacionamento"
  | "produto"
  | "suporte"
  | "implantacao"
  | "financeiro"
  | "renovacao"
  | "concorrencia";

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  adocao: "Adoção",
  relacionamento: "Relacionamento",
  produto: "Produto",
  suporte: "Suporte",
  implantacao: "Implantação",
  financeiro: "Financeiro",
  renovacao: "Renovação",
  concorrencia: "Concorrência",
};

export type RiskImpact = "baixo" | "medio" | "alto";
export const RISK_IMPACT_LABELS: Record<RiskImpact, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

export type RiskProbability = "baixa" | "media" | "alta";
export const RISK_PROBABILITY_LABELS: Record<RiskProbability, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };

export type RiskStatus = "aberto" | "em_andamento" | "mitigado" | "encerrado";
export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  mitigado: "Mitigado",
  encerrado: "Encerrado",
};

export interface AccountRisk {
  id: string;
  client_id: string;
  category: RiskCategory;
  description: string;
  impact: RiskImpact;
  probability: RiskProbability;
  responsible_user_id: string | null;
  due_date: string | null;
  status: RiskStatus;
  action_plan_id: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskWithClient extends AccountRisk {
  client_name: string;
  is_critical: boolean;
}

export interface RiskEvidence {
  id: string;
  risk_id: string;
  description: string;
  attachment_url: string | null;
  created_by_id: string | null;
  created_at: string;
}

export type SurveyType = "nps" | "csat";

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  nps: "NPS",
  csat: "CSAT",
};

export interface Survey {
  id: string;
  client_id: string;
  type: SurveyType;
  score: number;
  comment: string | null;
  survey_date: string;
  respondent_contact_id: string | null;
  respondent_name: string | null;
  created_by_id: string | null;
  created_at: string;
}

export interface SurveySummary {
  nps_score: number | null;
  csat_average: number | null;
  total_responses: number;
}

export interface ExecutiveDashboard {
  total_clients: number;
  healthy_clients: number;
  attention_clients: number;
  at_risk_clients: number;
  churned_clients: number;
  in_renewal_clients: number;
  avg_nps: number | null;
  avg_csat: number | null;
  avg_utilization: number | null;
}

export interface OperationalDashboard {
  open_tasks: number;
  overdue_tasks: number;
  pending_check_ins: number;
  clients_without_contact: number;
  open_risks: number;
  critical_risks: number;
  recovery_plans_in_progress: number;
  critical_implementations: number;
  clients_in_hypercare: number;
}

export type AlertEventType =
  | "sem_contato"
  | "queda_utilizacao"
  | "mudanca_health_score"
  | "satisfacao_negativa"
  | "renovacao_proxima"
  | "renovacao_risco"
  | "implantacao_atrasada"
  | "risco_critico";

export const ALERT_EVENT_LABELS: Record<AlertEventType, string> = {
  sem_contato: "Sem contato",
  queda_utilizacao: "Queda de utilização",
  mudanca_health_score: "Mudança no Health Score",
  satisfacao_negativa: "Satisfação negativa",
  renovacao_proxima: "Renovação próxima",
  renovacao_risco: "Renovação em risco",
  implantacao_atrasada: "Implantação atrasada",
  risco_critico: "Risco crítico",
};

export interface AlertRule {
  id: string;
  event_type: AlertEventType;
  name: string;
  is_active: boolean;
  auto_create_task: boolean;
}

export interface ActiveAlert {
  event_type: AlertEventType;
  client_id: string;
  client_name: string;
  message: string;
  severity: string;
}

export interface SearchResultItem {
  type: string;
  id: string;
  label: string;
  subtitle: string | null;
  client_id: string | null;
}

export interface Contact {
  id: string;
  client_id: string;
  name: string;
  role_title: string | null;
  area: string | null;
  email: string | null;
  phone: string | null;
  status: ContactStatus;
  influence_level: InfluenceLevel;
  stakeholder_type: StakeholderType;
  is_main_sponsor: boolean;
  created_at: string;
  updated_at: string;
}
