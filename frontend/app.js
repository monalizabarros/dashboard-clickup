if (typeof Chart !== "undefined" && typeof ChartDataLabels !== "undefined") {
  Chart.register(ChartDataLabels);
}

const state = {
  me: null, // usuário logado {id, username, role}
  users: [],
  dashboardsMeta: [], // lista com permissões por visualização
  currentDashboard: null, // {id, can_edit} da visualização aberta
  teamId: null,
  hierarchy: null,
  selectedLists: new Set(), // list_ids
  fields: { builtin: [], custom: [] },
  tasks: [],
  entries: [], // time entries enriquecidas com campos da task
  widgets: [],
  cleanSnapshot: null, // JSON do último estado salvo/carregado, p/ detectar alterações não salvas
  teams: [],
  collaborators: [],
  timeOff: [],
  collabPage: 1,
  timeOffPage: 1,
};

// fetch com tratamento de sessão expirada
async function api(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }
  return res;
}

const el = (id) => document.getElementById(id);
const PALETTE = ["#0E7C7B", "#4C5FD5", "#FF6B6B", "#F2A93B", "#3AA6A0", "#8B93EA", "#2C3E50", "#E2725B", "#7BC950", "#B14AED"];

const TIME_METRIC = "tt_hours"; // métrica especial: horas de time tracking (por entrada)
const ENTRY_USER_FIELD = { id: "entry_user", name: "Colaborador (time tracking)", type: "labels" };

// Campos "inteligentes": resolvidos pelo NOME do campo customizado, em qualquer lista
const SMART_FIELDS = [
  { id: "smart_produto", name: "Produto (campo)", type: "labels" },
  { id: "smart_tipo_suporte", name: "Tipo de suporte (campo)", type: "labels" },
  { id: "smart_categoria", name: "Categoria (por Departamento)", type: "labels" },
];

const HIST_METRIC = "hist_hours"; // métrica: horas do snapshot semanal
const HIST_FIELDS = [
  { id: "hist_week", name: "Histórico: Semana", type: "date" },
  { id: "hist_produto", name: "Histórico: Produto", type: "labels" },
  { id: "hist_categoria", name: "Histórico: Categoria", type: "labels" },
  { id: "hist_tipo_suporte", name: "Histórico: Tipo de suporte", type: "labels" },
  { id: "hist_tipo_registro", name: "Histórico: Tipo de registro", type: "labels" },
  { id: "hist_colaborador", name: "Histórico: Colaborador", type: "labels" },
];

// Métricas calculadas a partir do cadastro de colaboradores (times, valor/hora, capacidade)
const COLLAB_COST_METRIC = "collab_cost"; // custo (R$) = horas rastreadas × valor/hora de quem lançou — admin only
const COLLAB_CAPACITY_METRIC = "collab_capacity"; // capacidade disponível (h) no período, por colaborador
const COLLAB_UTILIZATION_METRIC = "collab_utilization"; // horas rastreadas ÷ capacidade, no período — admin only
const COLLAB_FIELDS = [{ id: "collab_team", name: "Time do colaborador", type: "labels" }];

function collabByClickupId(userId) {
  return state.collaborators.find((c) => String(c.clickup_user_id) === String(userId));
}

/** Custo (R$) de um lançamento de horas: horas × valor/hora de quem lançou (0 se não cadastrado). */
function collabCostFor(userId, hours) {
  const c = collabByClickupId(userId);
  if (!c || c.hourly_rate == null) return 0;
  return Number((Number(hours || 0) * Number(c.hourly_rate)).toFixed(2));
}

/** Time do colaborador que lançou a hora (para a dimensão "Time do colaborador"). */
function collabTeamFor(userId) {
  const c = collabByClickupId(userId);
  if (!c) return "(sem colaborador cadastrado)";
  const t = state.teams.find((tm) => tm.id === c.team_id);
  return t ? t.name : "(sem time)";
}

/** Dias úteis (seg-sex), inclusive, entre dois timestamps (epoch ms, em passos de 1 dia). */
function countWeekdays(fromMs, toMs) {
  const dayMs = 24 * 3600 * 1000;
  let n = 0;
  for (let t = fromMs; t <= toMs; t += dayMs) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

/** Linhas sintéticas (uma por colaborador) com capacidade disponível e utilização no período —
 *  não vêm do ClickUp: cruzam cadastro de colaboradores + folgas/férias + horas já carregadas. */
function collabCapacityRows(period) {
  if (period.start == null || period.end == null) return [];
  const periodEntries = entriesInPeriod(period);
  const trackedByCollab = {};
  periodEntries.forEach((e) => {
    trackedByCollab[e.entry_user_id] = (trackedByCollab[e.entry_user_id] || 0) + Number(e.duration_hours || 0);
  });

  return state.collaborators.map((c) => {
    const hoursPerDay = Number(c.capacity_hours_day || 0);
    const grossHours = countWeekdays(period.start, period.end) * hoursPerDay;
    let offHours = 0;
    state.timeOff.filter((t) => t.collaborator_id === c.id).forEach((t) => {
      const offStart = new Date(t.start_date + "T00:00:00").getTime();
      const offEnd = new Date(t.end_date + "T23:59:59.999").getTime();
      const overlapStart = Math.max(offStart, period.start);
      const overlapEnd = Math.min(offEnd, period.end);
      if (overlapEnd >= overlapStart) offHours += countWeekdays(overlapStart, overlapEnd) * hoursPerDay;
    });
    const capacity_hours = Math.max(0, Number((grossHours - offHours).toFixed(2)));
    const tracked = Number((trackedByCollab[c.clickup_user_id] || 0).toFixed(2));
    const utilization_pct = capacity_hours > 0 ? Number(((tracked / capacity_hours) * 100).toFixed(1)) : 0;
    const team = state.teams.find((t) => t.id === c.team_id);
    return {
      entry_user: c.name,
      collab_team: team ? team.name : "(sem time)",
      capacity_hours,
      utilization_pct,
    };
  });
}

const smartCache = { produto: null, tipoSuporte: null, departamento: null };

// Mapeia valores do campo "Departamento" para as 4 categorias do painel.
const DEPARTAMENTO_MAP = {
  "projetos": "Projetos", "ux": "Projetos", "ia": "Projetos",
  "suporte": "Suporte",
  "produto": "Produto",
  "geral": "Geral", "diretoria": "Geral",
};

function mapDepartamentoToCategoria(valor) {
  if (!valor) return "(vazio)";
  const key = String(valor).trim().toLowerCase();
  return DEPARTAMENTO_MAP[key] || valor; // valor desconhecido: mostra como veio, não esconde
}

function resolveSmartFields() {
  const find = (regexes) => {
    for (const rx of regexes) {
      const f = state.fields.custom.find((c) => rx.test(c.name));
      if (f) return f.id;
    }
    return null;
  };
  smartCache.produto = find([/^produtos?$/i, /produto/i]);
  smartCache.tipoSuporte = find([/tipo\s*(de)?\s*suporte/i, /suporte/i]);
  smartCache.departamento = find([/^departamentos?$/i, /departamento/i]);
}

function resolveValue(row, dimId) {
  if (dimId === "smart_produto") return smartCache.produto ? row[smartCache.produto] : null;
  if (dimId === "smart_tipo_suporte") return smartCache.tipoSuporte ? row[smartCache.tipoSuporte] : null;
  if (dimId === "smart_categoria") {
    const raw = smartCache.departamento ? row[smartCache.departamento] : null;
    if (Array.isArray(raw)) return raw.map(mapDepartamentoToCategoria);
    return mapDepartamentoToCategoria(raw);
  }
  return row[dimId];
}

// ================= Árvore de pastas/listas =================

async function loadHierarchy(force = false) {
  el("tree").innerHTML = `<div class="loading-box"><span class="spinner"></span>Carregando espaços e pastas...</div>`;
  const res = await api(`/api/hierarchy${force ? "?force=1" : ""}`);
  if (!res.ok) {
    el("tree").innerHTML = `<div class="hint">Erro ao carregar hierarquia (verifique o token).</div>`;
    return;
  }
  state.hierarchy = await res.json();
  renderTree();
  syncFolderChecks();
}

function renderTree() {
  const tree = el("tree");
  tree.innerHTML = "";
  state.hierarchy.teams.forEach((team) => {
    if (!state.teamId) state.teamId = team.id;
    team.spaces.forEach((space) => {
      const spaceEl = document.createElement("div");
      spaceEl.className = "tree-space";
      spaceEl.innerHTML = `
        <label class="tree-space-head">
          <input type="checkbox" class="tree-check space-check" />
          <span class="tree-space-name">${space.name}</span>
        </label>`;
      tree.appendChild(spaceEl);

      const spaceCheck = spaceEl.querySelector(".space-check");
      spaceCheck.addEventListener("change", () => {
        spaceEl.querySelectorAll(".list-check").forEach((cb) => {
          cb.checked = spaceCheck.checked;
          if (spaceCheck.checked) state.selectedLists.add(cb.dataset.listId);
          else state.selectedLists.delete(cb.dataset.listId);
        });
        syncFolderChecks();
        syncSpaceChecks();
        syncSelectAll();
        updateSelectionSummary();
      });

      // Pastas (colapsadas por padrão)
      space.folders.forEach((folder) => {
        spaceEl.appendChild(buildFolderNode(folder));
      });

      // Listas soltas do space
      if (space.lists.length) {
        const looseWrap = document.createElement("div");
        looseWrap.className = "tree-children open";
        space.lists.forEach((l) => looseWrap.appendChild(buildListNode(l)));
        spaceEl.appendChild(looseWrap);
      }
    });
  });
}

function buildFolderNode(folder) {
  const wrap = document.createElement("div");
  wrap.className = "tree-folder";

  const head = document.createElement("div");
  head.className = "tree-folder-head";
  head.innerHTML = `
    <button class="tree-toggle" title="Expandir">▸</button>
    <input type="checkbox" class="tree-check folder-check" />
    <span class="tree-folder-name">📁 ${folder.name}</span>
    <span class="tree-count">${folder.lists.length}</span>
  `;

  const children = document.createElement("div");
  children.className = "tree-children"; // fechado por padrão
  folder.lists.forEach((l) => children.appendChild(buildListNode(l)));

  head.querySelector(".tree-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    const open = children.classList.toggle("open");
    e.target.textContent = open ? "▾" : "▸";
  });

  const folderCheck = head.querySelector(".folder-check");
  folderCheck.addEventListener("change", () => {
    // marcar/desmarcar todas as listas da pasta
    children.querySelectorAll(".list-check").forEach((cb) => {
      cb.checked = folderCheck.checked;
      const listId = cb.dataset.listId;
      if (folderCheck.checked) state.selectedLists.add(listId);
      else state.selectedLists.delete(listId);
    });
    updateSelectionSummary();
    syncSelectAll();
  });

  wrap.appendChild(head);
  wrap.appendChild(children);
  return wrap;
}

function buildListNode(list) {
  const row = document.createElement("label");
  row.className = "tree-list";
  row.innerHTML = `
    <input type="checkbox" class="tree-check list-check" data-list-id="${list.id}" />
    <span>≡ ${list.name}</span>
  `;
  const cb = row.querySelector("input");
  cb.checked = state.selectedLists.has(String(list.id));
  cb.addEventListener("change", () => {
    if (cb.checked) state.selectedLists.add(String(list.id));
    else state.selectedLists.delete(String(list.id));
    updateSelectionSummary();
    syncFolderChecks();
    syncSelectAll();
  });
  return row;
}

function syncFolderChecks() {
  document.querySelectorAll(".tree-folder").forEach((f) => {
    const listChecks = [...f.querySelectorAll(".list-check")];
    const folderCheck = f.querySelector(".folder-check");
    folderCheck.checked = listChecks.length > 0 && listChecks.every((c) => c.checked);
    folderCheck.indeterminate = !folderCheck.checked && listChecks.some((c) => c.checked);
  });
  syncSpaceChecks();
}

function syncSpaceChecks() {
  document.querySelectorAll(".tree-space").forEach((s) => {
    const listChecks = [...s.querySelectorAll(".list-check")];
    const spaceCheck = s.querySelector(".space-check");
    if (!spaceCheck) return;
    spaceCheck.checked = listChecks.length > 0 && listChecks.every((c) => c.checked);
    spaceCheck.indeterminate = !spaceCheck.checked && listChecks.some((c) => c.checked);
  });
}

function updateSelectionSummary() {
  const n = state.selectedLists.size;
  el("selectionSummary").textContent = n
    ? `${n} lista${n > 1 ? "s" : ""} selecionada${n > 1 ? "s" : ""}`
    : "Nenhuma lista selecionada";
}

function setTreeSelection(listIds) {
  state.selectedLists = new Set(listIds.map(String));
  document.querySelectorAll(".list-check").forEach((cb) => {
    cb.checked = state.selectedLists.has(cb.dataset.listId);
  });
  syncFolderChecks();
  syncSelectAll();
  updateSelectionSummary();
}

function allWorkspaceListIds() {
  return [...document.querySelectorAll(".list-check")].map((cb) => cb.dataset.listId);
}

function syncSelectAll() {
  const all = allWorkspaceListIds();
  const cb = el("selectAllLists");
  cb.checked = all.length > 0 && all.every((id) => state.selectedLists.has(id));
  cb.indeterminate = !cb.checked && state.selectedLists.size > 0;
}

// ================= Período =================

function getPeriod() {
  const startStr = el("periodStart").value;
  const endStr = el("periodEnd").value;
  const start = startStr ? new Date(startStr + "T00:00:00").getTime() : null;
  const end = endStr ? new Date(endStr + "T23:59:59.999").getTime() : null;
  return {
    start,
    end,
    criteria: {
      created: el("critCreated").checked,
      closed: el("critClosed").checked,
      hours: el("critHours").checked,
    },
  };
}

function inRange(ts, period) {
  if (ts === null || ts === undefined || ts === "" || isNaN(Number(ts))) return false;
  const n = Number(ts);
  if (period.start && n < period.start) return false;
  if (period.end && n > period.end) return false;
  return true;
}

/** Entradas de tempo cujo registro caiu dentro do período. */
function entriesInPeriod(period) {
  return state.entries.filter((e) => inRange(e.entry_start, period));
}

/** Set de task_ids que tiveram horas registradas dentro do período. */
function taskIdsWithHoursInPeriod(period) {
  const s = new Set();
  entriesInPeriod(period).forEach((e) => e.id && s.add(e.id));
  return s;
}

function taskInPeriod(task, period, hoursSet) {
  if (!period.start && !period.end) return true;
  const c = period.criteria;
  if (!c.created && !c.closed && !c.hours) return true; // nenhum critério = sem filtro
  // lógica OU: basta atender um critério marcado
  if (c.created && inRange(task.date_created, period)) return true;
  if (c.closed && inRange(task.date_closed, period)) return true;
  if (c.hours && hoursSet && hoursSet.has(task.id)) return true;
  return false;
}

function applyPreset(preset) {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  let start, end;

  switch (preset) {
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
      break;
    case "last_month":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case "last_30":
      start = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      end = now;
      break;
    case "last_90":
      start = new Date(Date.now() - 90 * 24 * 3600 * 1000);
      end = now;
      break;
    case "last_180":
      start = new Date(Date.now() - 180 * 24 * 3600 * 1000);
      end = now;
      break;
    case "this_year":
      start = new Date(now.getFullYear(), 0, 1);
      end = now;
      break;
    default:
      return; // personalizado: mantém o que estiver nos inputs
  }
  el("periodStart").value = iso(start);
  el("periodEnd").value = iso(end);
}

function defaultPeriod() {
  el("periodPreset").value = "this_month";
  applyPreset("this_month");
}

// ================= Carregamento de dados =================

function allFields() {
  const combined = [...SMART_FIELDS, ...state.fields.builtin, ...state.fields.custom, ENTRY_USER_FIELD, ...HIST_FIELDS, ...COLLAB_FIELDS];
  return combined.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function loadData(force = false) {
  if (state.selectedLists.size === 0) {
    alert("Selecione pelo menos uma lista ou pasta.");
    return;
  }
  const listIds = [...state.selectedLists].join(",");
  const period = getPeriod();
  const f = force ? "&force=1" : "";

  const btn = el("loadTasksBtn");
  const refreshBtn = el("refreshBtn");
  btn.disabled = true; refreshBtn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Carregando...`;
  el("taskCount").textContent = force
    ? "Buscando dados novos direto do ClickUp..."
    : "Carregando tasks, campos e time tracking...";

  // janela ampla (mín. 1 ano), arredondada ao dia — datas estáveis fazem o cache do servidor funcionar
  const dayMs = 24 * 3600 * 1000;
  const yearAgo = Math.floor((Date.now() - 365 * dayMs) / dayMs) * dayMs;
  const start = Math.min(period.start ?? yearAgo, yearAgo);
  const end = (Math.floor(Date.now() / dayMs) + 1) * dayMs - 1; // fim do dia de hoje

  try {
    const [fieldsRes, tasksRes, entriesRes] = await Promise.all([
      api(`/api/fields?list_ids=${listIds}${f}`),
      api(`/api/tasks?list_ids=${listIds}${f}`),
      api(`/api/time_entries?team_id=${state.teamId}&start=${start}&end=${end}&list_ids=${listIds}${f}`),
    ]);
    if (!fieldsRes.ok || !tasksRes.ok || !entriesRes.ok) throw new Error("resposta não-ok");

    try {
      const snapRes = await api("/api/snapshots");
      const snapData = await snapRes.json();
      state.snapshots = (snapData.rows || []).map((r) => ({
        hist_week: r.week_start,
        hist_produto: r.produto,
        hist_categoria: r.categoria,
        hist_tipo_suporte: r.tipo_suporte,
        hist_tipo_registro: r.tipo_registro,
        hist_colaborador: r.colaborador,
        horas: r.horas,
      }));
    } catch (e) { state.snapshots = []; }

    state.fields = await fieldsRes.json();
    resolveSmartFields();
    const tasksData = await tasksRes.json();
    state.tasks = tasksData.tasks;
    state.dataCachedAt = tasksData.cached_at;

    // Enriquecer entradas de tempo com os campos da task (produto, cliente, tipo de suporte...)
    const tasksById = Object.fromEntries(state.tasks.map((t) => [t.id, t]));
    const rawEntries = (await entriesRes.json()).entries;
    state.entries = rawEntries.map((e) => ({
      ...(tasksById[e.task_id] || { name: e.task_name, list_id: e.list_id }),
      entry_user: e.entry_user,
      entry_user_id: e.entry_user_id,
      duration_hours: e.duration_hours,
      entry_start: e.start,
      collab_cost: collabCostFor(e.entry_user_id, e.duration_hours),
      collab_team: collabTeamFor(e.entry_user_id),
    }));

    const p = getPeriod();
    const hoursSet = taskIdsWithHoursInPeriod(p);
    const visibleTasks = state.tasks.filter((t) => taskInPeriod(t, p, hoursSet));
    const hora = state.dataCachedAt
      ? new Date(state.dataCachedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "";
    el("taskCount").textContent =
      `${visibleTasks.length} tasks no período · ${entriesInPeriod(p).length} registros de tempo` +
      (hora ? ` · dados de ${hora}` : "");

    state.widgets.forEach((w) => populateWidgetSelects(w.el));
    state.widgets.forEach((w) => renderWidget(w));
  } catch (err) {
    console.error(err);
    el("taskCount").textContent = "Erro ao carregar dados.";
  } finally {
    btn.disabled = false;
    el("refreshBtn").disabled = false;
    btn.textContent = "Carregar dados";
  }
}

// ================= Widgets =================

function createWidget(existingConfig) {
  const tpl = el("widgetTemplate").content.cloneNode(true);
  const widgetEl = tpl.querySelector(".widget");
  el("widgetGrid").appendChild(widgetEl);
  el("emptyState").classList.remove("visible");

  populateWidgetSelects(widgetEl);

  const widget = { el: widgetEl, chart: null, lastTable: null, size: null, sort: null };
  state.widgets.push(widget);

  // widget novo (sem configuração salva) nasce expandido, pronto pra configurar;
  // widget carregado de uma visualização salva nasce recolhido.
  if (!existingConfig) widgetEl.classList.add("expanded");

  // observa redimensionamento manual (alça do canto) e guarda o tamanho p/ salvar na visualização
  const ro = new ResizeObserver(() => {
    clearTimeout(widget._resizeTimer);
    widget._resizeTimer = setTimeout(() => {
      widget.size = { w: widgetEl.offsetWidth, h: widgetEl.offsetHeight };
      if (widget.chart) widget.chart.resize();
    }, 120);
  });
  ro.observe(widgetEl);

  // arrastar para reordenar (a ordem é a do array state.widgets, salva na visualização)
  const dragHandle = widgetEl.querySelector(".widget-drag");
  dragHandle.addEventListener("dragstart", (e) => {
    widgetEl.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ""); // exigido pelo Firefox
    // usa o card inteiro como imagem do arrasto
    e.dataTransfer.setDragImage(widgetEl, 20, 20);
  });
  dragHandle.addEventListener("dragend", () => {
    widgetEl.classList.remove("dragging");
    syncWidgetOrderFromDom();
  });

  widgetEl.querySelector(".widget-expand-toggle").addEventListener("click", () => {
    widgetEl.classList.toggle("expanded");
  });

  widgetEl.querySelector(".widget-remove").addEventListener("click", () => {
    if (widget.chart) widget.chart.destroy();
    widgetEl.remove();
    state.widgets = state.widgets.filter((w) => w !== widget);
    toggleEmptyState();
  });

  widgetEl.querySelectorAll(".widget-config select, .widget-config input, .widget-title").forEach((input) =>
    input.addEventListener("change", () => renderWidget(widget))
  );
  widgetEl.querySelector(".widget-chart-type").addEventListener("change", () => {
    updateWidgetChrome(widgetEl);
    renderWidget(widget);
  });

  widgetEl.querySelector(".widget-filter-toggle").addEventListener("click", () => {
    const box = widgetEl.querySelector(".widget-filters");
    const open = box.style.display !== "none";
    box.style.display = open ? "none" : "flex";
    widgetEl.querySelector(".widget-filter-toggle").classList.toggle("active", !open);
  });
  widgetEl.querySelector(".add-filter-btn").addEventListener("click", () => {
    addFilterRow(widgetEl, widget);
  });
  widgetEl.querySelector(".add-extra-metric-btn").addEventListener("click", () => {
    addExtraMetricRow(widgetEl, widget);
    renderWidget(widget);
  });
  widgetEl.querySelector(".widget-export-btn").addEventListener("click", () => exportWidgetExcel(widget));
  widgetEl.querySelector(".widget-export-img-btn").addEventListener("click", () => exportWidgetImage(widget));

  if (existingConfig) {
    widgetEl.querySelector(".widget-title").value = existingConfig.title || "";
    widgetEl.querySelector(".widget-chart-type").value = existingConfig.chartType;
    widgetEl.querySelector(".widget-metric").value = existingConfig.metric;
    widgetEl.querySelector(".widget-agg").value = existingConfig.agg;
    widgetEl.querySelector(".widget-dim1").value = existingConfig.dim1;
    widgetEl.querySelector(".widget-dim2").value = existingConfig.dim2 || "";
    widgetEl.querySelector(".widget-dim3").value = existingConfig.dim3 || "";
    widgetEl.querySelector(".widget-dim4").value = existingConfig.dim4 || "";
    widgetEl.querySelector(".widget-dim5").value = existingConfig.dim5 || "";
    if (existingConfig.compare) widgetEl.querySelector(".widget-compare").value = existingConfig.compare;
    if (existingConfig.alertOp) widgetEl.querySelector(".widget-alert-op").value = existingConfig.alertOp;
    if (existingConfig.alertValue) widgetEl.querySelector(".widget-alert-value").value = existingConfig.alertValue;
    if (existingConfig.size && existingConfig.size.w) {
      widgetEl.style.width = existingConfig.size.w + "px";
      widgetEl.style.height = existingConfig.size.h + "px";
      widget.size = existingConfig.size;
    }
    (existingConfig.filters || []).forEach((f) => addFilterRow(widgetEl, widget, f));
    if ((existingConfig.filters || []).length) {
      widgetEl.querySelector(".widget-filters").style.display = "flex";
      widgetEl.querySelector(".widget-filter-toggle").classList.add("active");
    }
    (existingConfig.extraMetrics || []).forEach((m) => addExtraMetricRow(widgetEl, widget, m));
  }

  updateWidgetChrome(widgetEl);
  renderWidget(widget);
  toggleEmptyState();
  return widget;
}

/** Mostra/esconde dimensões 3-5 e métricas extras (só fazem sentido em tabela) e o botão de exportar. */
function updateWidgetChrome(widgetEl) {
  const isTable = widgetEl.querySelector(".widget-chart-type").value === "table";
  widgetEl.querySelectorAll(".dim-table-only").forEach((el2) => (el2.style.display = isTable ? "" : "none"));
  widgetEl.querySelectorAll(".metric-table-only").forEach((el2) => (el2.style.display = isTable ? "" : "none"));
  widgetEl.querySelector(".widget-export-btn").style.display = isTable ? "" : "none";
}

/** Opções de métrica para uma tabela extra: sem Horas (time tracking / histórico), porque essas
 *  vêm de uma base de linhas diferente da métrica principal (ver renderWidgetInner). */
function extraMetricOptionsHtml() {
  return `<option value="__count__">Nº de tasks</option>` +
    allFields().map((f) => `<option value="${f.id}">${f.name}</option>`).join("");
}

function addExtraMetricRow(widgetEl, widget, existing) {
  const list = widgetEl.querySelector(".widget-extra-metrics");
  const row = document.createElement("div");
  row.className = "extra-metric-row";
  row.innerHTML = `
    <select class="extra-metric-field input-inline">${extraMetricOptionsHtml()}</select>
    <select class="extra-metric-agg input-inline">
      <option value="sum">Soma</option>
      <option value="count">Contagem</option>
      <option value="avg">Média</option>
    </select>
    <button type="button" class="extra-metric-remove" title="Remover métrica">✕</button>
  `;
  list.appendChild(row);

  if (existing) {
    if (existing.metric) row.querySelector(".extra-metric-field").value = existing.metric;
    if (existing.agg) row.querySelector(".extra-metric-agg").value = existing.agg;
  }

  row.querySelectorAll("select").forEach((sel) => sel.addEventListener("change", () => renderWidget(widget)));
  row.querySelector(".extra-metric-remove").addEventListener("click", () => {
    row.remove();
    renderWidget(widget);
  });
}

function collectExtraMetrics(widgetEl) {
  return [...widgetEl.querySelectorAll(".extra-metric-row")].map((row) => ({
    metric: row.querySelector(".extra-metric-field").value,
    agg: row.querySelector(".extra-metric-agg").value,
  }));
}

function populateWidgetSelects(widgetEl) {
  const fields = allFields();
  const fieldOptions = fields.map((f) => `<option value="${f.id}">${f.name}</option>`).join("");
  const optionalOptions = `<option value="">—</option>` + fieldOptions;

  widgetEl.querySelector(".widget-dim1").innerHTML = fieldOptions;
  widgetEl.querySelector(".widget-dim2").innerHTML = optionalOptions;
  widgetEl.querySelector(".widget-dim3").innerHTML = optionalOptions;
  widgetEl.querySelector(".widget-dim4").innerHTML = optionalOptions;
  widgetEl.querySelector(".widget-dim5").innerHTML = optionalOptions;

  const isAdmin = state.me && state.me.role === "admin";
  widgetEl.querySelector(".widget-metric").innerHTML =
    `<option value="${TIME_METRIC}">Horas rastreadas (time tracking)</option>` +
    `<option value="${HIST_METRIC}">Horas (histórico semanal)</option>` +
    `<option value="__count__">Nº de tasks</option>` +
    `<option value="${COLLAB_CAPACITY_METRIC}">Capacidade disponível (h)</option>` +
    (isAdmin ? `<option value="${COLLAB_COST_METRIC}">Custo (R$)</option>` : "") +
    (isAdmin ? `<option value="${COLLAB_UTILIZATION_METRIC}">Utilização (%)</option>` : "") +
    fieldOptions;

  widgetEl.querySelector(".widget-chart-type").innerHTML = `
    <option value="bar">Barras</option>
    <option value="line">Linha</option>
    <option value="pie">Pizza</option>
    <option value="table">Tabela</option>
    <option value="kpi">KPI (número único)</option>
  `;

  // atualiza os selects de campo dentro de filtros e métricas extras já existentes
  widgetEl.querySelectorAll(".filter-field").forEach((sel) => {
    const cur = sel.value;
    sel.innerHTML = fieldOptions;
    if (cur) sel.value = cur;
  });
  widgetEl.querySelectorAll(".extra-metric-field").forEach((sel) => {
    const cur = sel.value;
    sel.innerHTML = extraMetricOptionsHtml();
    if (cur) sel.value = cur;
  });
}

/** Realinha state.widgets com a ordem atual dos cards no DOM. */
function syncWidgetOrderFromDom() {
  const domOrder = [...el("widgetGrid").querySelectorAll(".widget")];
  state.widgets.sort((a, b) => domOrder.indexOf(a.el) - domOrder.indexOf(b.el));
}

/** Encontra o widget diante do qual o card arrastado deve ser inserido (layout com quebra de linha). */
function widgetAfterPointer(x, y) {
  const others = [...el("widgetGrid").querySelectorAll(".widget:not(.dragging)")];
  return (
    others.find((w) => {
      const r = w.getBoundingClientRect();
      return y < r.top + r.height / 2 || (y < r.bottom && x < r.left + r.width / 2);
    }) || null
  );
}

function toggleEmptyState() {
  el("emptyState").classList.toggle("visible", state.widgets.length === 0);
}

// ================= Filtros por widget =================

/** Valores únicos possíveis de um campo, olhando a coleção de dados correta. */
function valuesForField(fieldId) {
  let source = state.tasks;
  if (fieldId.startsWith("hist_")) source = state.snapshots || [];
  else if (fieldId === "entry_user") source = state.entries || [];
  const set = new Set();
  source.forEach((row) => dimValues(row, fieldId).forEach((v) => set.add(String(v))));
  return [...set].sort();
}

function addFilterRow(widgetEl, widget, existing) {
  const list = widgetEl.querySelector(".filters-list");
  const row = document.createElement("div");
  row.className = "filter-row";
  const fields = allFields();
  row.innerHTML = `
    <select class="filter-field input-inline">${fields.map((f) => `<option value="${f.id}">${f.name}</option>`).join("")}</select>
    <div class="filter-values"></div>
    <button class="filter-remove" title="Remover filtro">✕</button>
  `;
  list.appendChild(row);

  const fieldSel = row.querySelector(".filter-field");
  const valuesBox = row.querySelector(".filter-values");

  const rebuildValues = (checkedValues) => {
    const opts = valuesForField(fieldSel.value);
    valuesBox.innerHTML = opts
      .map(
        (v) =>
          `<label><input type="checkbox" value="${v.replace(/"/g, "&quot;")}" ${
            !checkedValues || checkedValues.includes(v) ? "" : ""
          }/> ${v}</label>`
      )
      .join("");
    if (checkedValues) {
      valuesBox.querySelectorAll("input").forEach((cb) => {
        cb.checked = checkedValues.includes(cb.value);
      });
    }
    valuesBox.querySelectorAll("input").forEach((cb) => cb.addEventListener("change", () => renderWidget(widget)));
  };

  if (existing && existing.field) fieldSel.value = existing.field;
  rebuildValues(existing ? existing.values : null);

  fieldSel.addEventListener("change", () => {
    rebuildValues(null); // trocou o campo: começa sem seleção (= não filtra)
    renderWidget(widget);
  });
  row.querySelector(".filter-remove").addEventListener("click", () => {
    row.remove();
    renderWidget(widget);
  });
}

function collectWidgetFilters(widgetEl) {
  return [...widgetEl.querySelectorAll(".filter-row")]
    .map((row) => {
      const field = row.querySelector(".filter-field").value;
      const values = [...row.querySelectorAll(".filter-values input:checked")].map((cb) => cb.value);
      return { field, values };
    })
    .filter((f) => f.field && f.values.length > 0); // sem valores marcados = filtro inativo
}

function passesFilters(row, filters) {
  return filters.every((f) => {
    const vals = dimValues(row, f.field).map(String);
    return vals.some((v) => f.values.includes(v));
  });
}

// ================= Dataset + agregação multi-dimensão =================

/** Período imediatamente anterior, com o mesmo tamanho do atual. */
function previousPeriod(p) {
  if (!p.start || !p.end) return null;
  const len = p.end - p.start;
  return { start: p.start - len - 1, end: p.start - 1, criteria: p.criteria };
}

function datasetFor(metric, filters, periodOverride) {
  const period = periodOverride || getPeriod();
  const applyFilters = (rows) => (filters && filters.length ? rows.filter((r) => passesFilters(r, filters)) : rows);

  if (metric === HIST_METRIC) {
    const rows = (state.snapshots || []).filter((r) => {
      const ts = new Date(r.hist_week + "T00:00:00").getTime();
      if (period.start && ts < period.start - 6 * 24 * 3600 * 1000) return false; // semana que toca o período conta
      if (period.end && ts > period.end) return false;
      return true;
    });
    return { rows: applyFilters(rows), valueField: "horas" };
  }
  if (metric === TIME_METRIC) {
    // horas: sempre filtradas pela data em que foram registradas
    return { rows: applyFilters(entriesInPeriod(period)), valueField: "duration_hours" };
  }
  if (metric === COLLAB_COST_METRIC) {
    // mesma base de linhas do time tracking — só troca a coluna (horas → custo)
    return { rows: applyFilters(entriesInPeriod(period)), valueField: "collab_cost" };
  }
  if (metric === COLLAB_CAPACITY_METRIC) {
    return { rows: applyFilters(collabCapacityRows(period)), valueField: "capacity_hours" };
  }
  if (metric === COLLAB_UTILIZATION_METRIC) {
    return { rows: applyFilters(collabCapacityRows(period)), valueField: "utilization_pct" };
  }
  const hoursSet = taskIdsWithHoursInPeriod(period);
  const rows = state.tasks.filter((t) => taskInPeriod(t, period, hoursSet));
  return { rows: applyFilters(rows), valueField: metric === "__count__" ? null : metric };
}

function dimValues(row, dimId) {
  let v = resolveValue(row, dimId);
  if (v === undefined || v === null || v === "") v = "(vazio)";
  return Array.isArray(v) ? (v.length ? v : ["(vazio)"]) : [v];
}

function aggregateValues(rows, valueField, agg) {
  if (!valueField || agg === "count") return rows.length;
  const nums = rows.map((r) => Number(r[valueField])).filter((n) => !isNaN(n));
  if (!nums.length) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  if (agg === "sum") return Number(sum.toFixed(2));
  if (agg === "avg") return Number((sum / nums.length).toFixed(2));
  return rows.length;
}

/** Agrupa por até 3 dimensões. Retorna mapa aninhado {d1: {d2: {d3: rows}}} */
function groupRows(rows, dims) {
  const root = {};
  rows.forEach((row) => {
    const combos = dims.map((d) => dimValues(row, d));
    // produto cartesiano (campos multi-valor, ex: assignees)
    const expand = (idx, path) => {
      if (idx === combos.length) {
        let node = root;
        path.forEach((key, i) => {
          if (i === path.length - 1) {
            node[key] = node[key] || [];
            node[key].push(row);
          } else {
            node[key] = node[key] || {};
            node = node[key];
          }
        });
        return;
      }
      combos[idx].forEach((v) => expand(idx + 1, [...path, String(v)]));
    };
    expand(0, []);
  });
  return root;
}

// ================= Render =================

function renderWidget(widget) {
  try {
    renderWidgetInner(widget);
  } catch (err) {
    console.error("Erro ao renderizar widget:", err);
    const tableWrap = widget.el.querySelector(".widget-table-wrap");
    widget.el.querySelector(".chart-holder").style.display = "none";
    tableWrap.innerHTML = `<div class="hint" style="padding:24px;text-align:center">⚠️ Erro ao montar este widget: ${err.message}</div>`;
  }
}

function renderWidgetInner(widget) {
  if (typeof Chart === "undefined") {
    throw new Error("biblioteca de gráficos não carregou (Chart.js). Verifique se o arquivo vendor/chart.umd.min.js existe.");
  }
  const wEl = widget.el;
  const chartType = wEl.querySelector(".widget-chart-type").value;
  const metric = wEl.querySelector(".widget-metric").value;
  const agg = wEl.querySelector(".widget-agg").value;
  const dim1 = wEl.querySelector(".widget-dim1").value;
  const dim2 = wEl.querySelector(".widget-dim2").value;
  const dim3 = wEl.querySelector(".widget-dim3").value;
  const dim4 = wEl.querySelector(".widget-dim4").value;
  const dim5 = wEl.querySelector(".widget-dim5").value;
  const filters = collectWidgetFilters(wEl);
  const compareMode = wEl.querySelector(".widget-compare").value;
  const alertOp = wEl.querySelector(".widget-alert-op").value;
  const alertValue = parseFloat(wEl.querySelector(".widget-alert-value").value);
  const hasAlert = alertOp && !isNaN(alertValue);
  const violates = (v) => hasAlert && (alertOp === ">" ? Number(v) > alertValue : Number(v) < alertValue);

  const holder = wEl.querySelector(".chart-holder");
  const tableWrap = wEl.querySelector(".widget-table-wrap");
  const badges = wEl.querySelector(".widget-badges");
  if (widget.chart) { widget.chart.destroy(); widget.chart = null; }
  holder.innerHTML = "";
  holder.style.display = "none";
  tableWrap.innerHTML = "";
  tableWrap.style.display = "none";
  badges.innerHTML = "";
  wEl.classList.remove("alerting");
  widget.lastTable = null;

  const { rows, valueField } = datasetFor(metric, filters);

  // dados do período anterior (mesmo tamanho), quando comparação ativa
  let prevRows = null;
  if (compareMode === "prev") {
    const prevP = previousPeriod(getPeriod());
    if (prevP) prevRows = datasetFor(metric, filters, prevP).rows;
  }

  const pctBadge = (cur, prev) => {
    if (prev === 0 && cur === 0) return "";
    if (prev === 0) return `<span class="badge badge-up">▲ novo vs anterior (0 → ${cur.toLocaleString("pt-BR")})</span>`;
    const pct = ((cur - prev) / prev) * 100;
    const cls = pct > 0.5 ? "badge-up" : pct < -0.5 ? "badge-down" : "badge-flat";
    const arrow = pct > 0.5 ? "▲" : pct < -0.5 ? "▼" : "＝";
    return `<span class="badge ${cls}">${arrow} ${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}% vs anterior (${prev.toLocaleString("pt-BR", {maximumFractionDigits:1})} → ${cur.toLocaleString("pt-BR", {maximumFractionDigits:1})})</span>`;
  };

  const flagAlert = (count) => {
    if (!count) return;
    wEl.classList.add("alerting");
    badges.innerHTML += `<span class="badge badge-alert">⚠ ${count === true ? "limite violado" : count + " grupo(s) fora do limite"} (${alertOp} ${alertValue})</span>`;
  };
  if (!rows.length) {
    tableWrap.style.display = "block";
    tableWrap.innerHTML = `<div class="hint" style="padding:30px;text-align:center">Sem dados para os filtros/período atuais.</div>`;
    return;
  }

  if (chartType === "kpi") {
    tableWrap.style.display = "block";
    const total = aggregateValues(rows, valueField, agg);
    const isViolating = violates(total);
    let compareHtml = "";
    if (prevRows) {
      const prevTotal = aggregateValues(prevRows, valueField, agg);
      badges.innerHTML += pctBadge(Number(total), Number(prevTotal));
      compareHtml = `<div class="kpi-compare">período anterior: ${Number(prevTotal).toLocaleString("pt-BR")}</div>`;
    }
    if (isViolating) flagAlert(true);
    tableWrap.innerHTML = `
      <div class="kpi-value ${isViolating ? "kpi-alert" : ""}">${Number(total).toLocaleString("pt-BR")}</div>
      <div class="kpi-label">${metricLabel(metric, agg)}</div>${compareHtml}`;
    return;
  }

  if (chartType === "table") {
    tableWrap.style.display = "block";
    const dims = [dim1, dim2, dim3, dim4, dim5].filter(Boolean);
    const extraMetrics = collectExtraMetrics(wEl);
    const metricConfigs = [
      { valueField, agg, label: metricLabel(metric, agg) },
      ...extraMetrics.map((m) => ({
        valueField: m.metric === "__count__" ? null : m.metric,
        agg: m.agg,
        label: metricLabel(m.metric, m.agg),
      })),
    ];
    const built = buildTableData(rows, dims, metricConfigs);

    // comparação com período anterior só faz sentido com uma única métrica
    // (com várias métricas, Anterior/Δ% de qual coluna? evitamos ambiguidade)
    if (prevRows && metricConfigs.length === 1) {
      const prevBuilt = buildTableData(prevRows, dims, metricConfigs);
      const prevMap = {};
      prevBuilt.rows.forEach((r) => { prevMap[JSON.stringify(r.slice(0, dims.length))] = r[dims.length]; });
      built.headers = [...built.headers, "Anterior", "Δ%"];
      built.rows = built.rows.map((r) => {
        const prev = prevMap[JSON.stringify(r.slice(0, dims.length))] ?? 0;
        const cur = Number(r[dims.length]);
        const delta = prev === 0 ? (cur > 0 ? Infinity : 0) : ((cur - prev) / prev) * 100;
        return [...r, prev, delta];
      });
      const curTotal = built.rows.reduce((a, r) => a + Number(r[dims.length]), 0);
      const prevTotal = prevBuilt.rows.reduce((a, r) => a + Number(r[dims.length]), 0);
      badges.innerHTML += pctBadge(curTotal, prevTotal);
    }
    built.metricIndex = dims.length;
    built.numericFrom = dims.length; // colunas numéricas a partir da 1ª métrica
    built.alert = hasAlert ? { violates } : null;

    if (hasAlert) {
      // alerta sempre avalia a métrica principal (1ª coluna numérica)
      const n = built.rows.filter((r) => violates(r[dims.length])).length;
      flagAlert(n);
    }

    widget.lastTable = built;
    if (widget.sort && widget.sort.col >= built.headers.length) widget.sort = null;
    renderWidgetTable(widget, tableWrap);
    return;
  }

  // Gráficos: canvas novo a cada render (evita estado residual do Chart.js)
  holder.style.display = "block";
  const canvas = document.createElement("canvas");
  holder.appendChild(canvas);

  if (dim2 && chartType !== "pie") {
    const grouped = groupRows(rows, [dim1, dim2]);
    const labels = Object.keys(grouped).sort();

    if (prevRows) {
      // com 2 dimensões a comparação aparece como badge do total (evita gráfico ilegível)
      const totalOf = (rws) => {
        const g = groupRows(rws, [dim1, dim2]);
        let t = 0;
        Object.values(g).forEach((sub) => Object.values(sub).forEach((arr) => (t += Number(aggregateValues(arr, valueField, agg)))));
        return t;
      };
      badges.innerHTML += pctBadge(totalOf(rows), totalOf(prevRows));
    }
    const dim2Values = [...new Set(labels.flatMap((l) => Object.keys(grouped[l])))].sort();
    const datasets = dim2Values.map((d2, i) => ({
      label: d2,
      data: labels.map((l) => grouped[l][d2] ? aggregateValues(grouped[l][d2], valueField, agg) : 0),
      backgroundColor: PALETTE[i % PALETTE.length],
      borderColor: PALETTE[i % PALETTE.length],
      borderRadius: chartType === "bar" ? 6 : 0,
      tension: 0.3,
    }));
    widget.chart = new Chart(canvas.getContext("2d"), {
      type: chartType,
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: true, position: "bottom" },
          datalabels: dataLabelsConfig(chartType, true),
        },
        scales: { x: { stacked: chartType === "bar" }, y: { stacked: chartType === "bar", beginAtZero: true } },
      },
    });
  } else {
    const grouped = groupRows(rows, [dim1]);
    let labels = Object.keys(grouped).sort();
    const values = labels.map((l) => aggregateValues(grouped[l], valueField, agg));

    // alerta: destaca em coral os grupos fora do limite
    const violCount = hasAlert ? values.filter((v) => violates(v)).length : 0;
    if (violCount) flagAlert(violCount);
    const barColors = labels.map((_, i) => (hasAlert && violates(values[i]) ? "#FF6B6B" : "#0E7C7B"));

    const datasets = [{
      label: metricLabel(metric, agg),
      data: values,
      backgroundColor: chartType === "pie" ? PALETTE : barColors,
      borderColor: chartType === "line" ? "#0E7C7B" : undefined,
      borderRadius: chartType === "bar" ? 8 : 0,
      tension: 0.3,
    }];

    // comparação: série cinza do período anterior (barra/linha) + badge do total
    if (prevRows) {
      const prevGrouped = groupRows(prevRows, [dim1]);
      if (chartType !== "pie") {
        labels = [...new Set([...labels, ...Object.keys(prevGrouped)])].sort();
        datasets[0].data = labels.map((l) => (grouped[l] ? aggregateValues(grouped[l], valueField, agg) : 0));
        datasets[0].backgroundColor = chartType === "pie" ? PALETTE
          : labels.map((l, i) => (hasAlert && violates(datasets[0].data[i]) ? "#FF6B6B" : "#0E7C7B"));
        datasets.push({
          label: "Período anterior",
          data: labels.map((l) => (prevGrouped[l] ? aggregateValues(prevGrouped[l], valueField, agg) : 0)),
          backgroundColor: "#C3CDD6",
          borderColor: chartType === "line" ? "#8B98A5" : undefined,
          borderRadius: chartType === "bar" ? 8 : 0,
          borderDash: chartType === "line" ? [6, 4] : undefined,
          tension: 0.3,
        });
      }
      const curTotal = values.reduce((a, b) => a + Number(b), 0);
      const prevTotal = Object.values(prevGrouped).reduce((a, g) => a + Number(aggregateValues(g, valueField, agg)), 0);
      badges.innerHTML += pctBadge(curTotal, prevTotal);
    }

    widget.chart = new Chart(canvas.getContext("2d"), {
      type: chartType,
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: chartType === "pie", position: "bottom" },
          datalabels: dataLabelsConfig(chartType, false),
        },
        scales: chartType === "pie" ? {} : { y: { beginAtZero: true } },
      },
    });
  }
}

/** Configuração dos rótulos de dados por tipo de gráfico. */
function dataLabelsConfig(chartType, stacked) {
  if (typeof ChartDataLabels === "undefined") return { display: false };
  const fmt = (v) => {
    if (typeof v !== "number" && typeof v !== "string") return "";
    const n = Number(v);
    return isFinite(n) && n ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "";
  };
  if (chartType === "pie") {
    return {
      color: "#fff",
      font: { size: 11, weight: "bold", family: "'JetBrains Mono', monospace" },
      formatter: fmt,
      display: (ctx) => Number(ctx.dataset.data[ctx.dataIndex]) > 0,
    };
  }
  if (stacked && chartType === "bar") {
    return {
      color: "#fff",
      anchor: "center",
      align: "center",
      font: { size: 9, family: "'JetBrains Mono', monospace" },
      formatter: fmt,
      // esconde rótulos de segmentos muito pequenos para não poluir
      display: (ctx) => {
        const v = Number(ctx.dataset.data[ctx.dataIndex]);
        const max = Math.max(...ctx.chart.data.datasets.flatMap((d) => d.data.map(Number)));
        return v > 0 && v >= max * 0.06;
      },
    };
  }
  return {
    color: "#1B2430",
    anchor: "end",
    align: "top",
    offset: -2,
    clamp: true,
    font: { size: 10, family: "'JetBrains Mono', monospace" },
    formatter: fmt,
    display: (ctx) => Number(ctx.dataset.data[ctx.dataIndex]) > 0,
  };
}

/** Achata a agregação em {headers, rows} — reaproveitado pela tabela HTML e pelo export Excel. */
/** metricConfigs: [{ valueField, agg, label }, ...] — uma coluna por métrica, na ordem dada.
 *  Todas as métricas usam a mesma base de linhas (a da métrica principal). */
function buildTableData(rows, dims, metricConfigs) {
  const flat = [];
  const walk = (node, path) => {
    Object.keys(node).sort().forEach((key) => {
      const child = node[key];
      if (Array.isArray(child)) {
        const values = metricConfigs.map((m) => aggregateValues(child, m.valueField, m.agg));
        flat.push([...path, key, ...values]);
      } else {
        walk(child, [...path, key]);
      }
    });
  };
  walk(groupRows(rows, dims), []);

  const fieldName = (id) => (allFields().find((f) => f.id === id) || { name: id }).name;
  const headers = [...dims.map(fieldName), ...metricConfigs.map((m) => m.label)];
  return { headers, rows: flat };
}

/** Ordena as linhas segundo o sort do widget (default: métrica, do maior ao menor). */
function sortTableRows(built, sort) {
  const metricCol = built.metricIndex ?? built.headers.length - 1;
  const numericFrom = built.numericFrom ?? metricCol;
  const col = sort ? sort.col : metricCol;
  const dir = sort ? sort.dir : "desc";
  const mult = dir === "asc" ? 1 : -1;
  const rows = [...built.rows];
  rows.sort((a, b) => {
    if (col >= numericFrom) return (Number(a[col]) - Number(b[col])) * mult;
    return String(a[col]).localeCompare(String(b[col]), "pt-BR") * mult;
  });
  return rows;
}

function tableDataToHtml(built, sort) {
  const metricCol = built.metricIndex ?? built.headers.length - 1;
  const numericFrom = built.numericFrom ?? metricCol;
  const deltaCol = built.headers[built.headers.length - 1] === "Δ%" ? built.headers.length - 1 : -1;
  const activeCol = sort ? sort.col : metricCol;
  const activeDir = sort ? sort.dir : "desc";

  const head = built.headers
    .map((h, i) => {
      const arrow = i === activeCol ? `<span class="sort-arrow">${activeDir === "asc" ? "▲" : "▼"}</span>` : "";
      return `<th data-col="${i}" title="Ordenar por ${h}">${h}${arrow}</th>`;
    })
    .join("");

  const fmtCell = (c, i) => {
    if (i === deltaCol) {
      if (!isFinite(c)) return `<td class="delta-up" title="novo">▲ novo</td>`;
      const cls = c > 0.5 ? "delta-up" : c < -0.5 ? "delta-down" : "";
      const arrow = c > 0.5 ? "▲ " : c < -0.5 ? "▼ " : "";
      return `<td class="${cls}">${arrow}${c > 0 ? "+" : ""}${Number(c).toFixed(1).replace(".", ",")}%</td>`;
    }
    if (i >= numericFrom) return `<td title="${c}">${Number(c).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>`;
    return `<td title="${c}">${c}</td>`;
  };

  const rows = sortTableRows(built, sort);
  const body = rows
    .map((r) => {
      const alertCls = built.alert && built.alert.violates(r[metricCol]) ? "row-alert" : "";
      return `<tr class="${alertCls}">${r.map(fmtCell).join("")}</tr>`;
    })
    .join("");
  return `<table class="widget-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Renderiza a tabela do widget e liga os cliques de ordenação nos cabeçalhos. */
function renderWidgetTable(widget, tableWrap) {
  tableWrap.innerHTML = tableDataToHtml(widget.lastTable, widget.sort);
  tableWrap.querySelectorAll("th").forEach((th) => {
    th.addEventListener("click", () => {
      const col = Number(th.dataset.col);
      const metricCol = widget.lastTable.metricIndex ?? widget.lastTable.headers.length - 1;
      const current = widget.sort || { col: metricCol, dir: "desc" };
      if (current.col === col) {
        widget.sort = { col, dir: current.dir === "desc" ? "asc" : "desc" };
      } else {
        // nova coluna: numérica começa desc (maior→menor), texto começa asc (A→Z)
        const numericFrom = widget.lastTable.numericFrom ?? metricCol;
        widget.sort = { col, dir: col >= numericFrom ? "desc" : "asc" };
      }
      renderWidgetTable(widget, tableWrap);
    });
  });
}

function exportWidgetExcel(widget) {
  if (!widget.lastTable || !widget.lastTable.rows.length) {
    alert("Não há dados de tabela para exportar. Configure o widget como Tabela com dados carregados.");
    return;
  }
  if (typeof XLSX === "undefined") {
    alert("Biblioteca de exportação não carregou (xlsx.full.min.js).");
    return;
  }
  const title = widget.el.querySelector(".widget-title").value.trim() || "widget";
  const headers = widget.lastTable.headers;
  const rows = sortTableRows(widget.lastTable, widget.sort);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, String(h).length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  const safeName = title.replace(/[\\/*?:[\]]/g, "").slice(0, 28);
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}

// Exporta o widget (título + gráfico/tabela) como uma imagem PNG, pronta
// para colar em e-mail, slide ou documento.
async function exportWidgetImage(widget) {
  if (typeof html2canvas === "undefined") {
    alert("Biblioteca de exportação de imagem não carregou (html2canvas.min.js).");
    return;
  }
  const widgetEl = widget.el;
  const btn = widgetEl.querySelector(".widget-export-img-btn");
  const originalLabel = btn.textContent;
  const title = widgetEl.querySelector(".widget-title").value.trim() || "widget";

  btn.disabled = true;
  btn.textContent = "Gerando...";
  widgetEl.classList.add("widget-exporting");

  // garante que o gráfico já esteja desenhado no layout "limpo" (sem o
  // painel de configuração) antes de capturar a imagem
  if (widget.chart) widget.chart.resize();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const canvas = await html2canvas(widgetEl, {
      backgroundColor: "#ffffff",
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
    });
    const safeName = title.replace(/[\\/*?:[\]]/g, "").slice(0, 40) || "widget";
    const link = document.createElement("a");
    link.download = `${safeName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (e) {
    alert("Não foi possível gerar a imagem do widget: " + e.message);
  } finally {
    widgetEl.classList.remove("widget-exporting");
    if (widget.chart) widget.chart.resize();
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

function metricLabel(metricId, agg) {
  if (metricId === HIST_METRIC) return `Horas históricas (${{ sum: "soma", avg: "média", count: "contagem" }[agg]})`;
  if (metricId === TIME_METRIC) return `Horas rastreadas (${{ sum: "soma", avg: "média", count: "contagem" }[agg]})`;
  if (metricId === COLLAB_COST_METRIC) return `Custo (R$) (${{ sum: "soma", avg: "média", count: "contagem" }[agg]})`;
  if (metricId === COLLAB_CAPACITY_METRIC) return `Capacidade disponível (h) (${{ sum: "soma", avg: "média", count: "contagem" }[agg]})`;
  if (metricId === COLLAB_UTILIZATION_METRIC) return `Utilização (%) (${{ sum: "soma", avg: "média", count: "contagem" }[agg]})`;
  if (metricId === "__count__") return "Nº de tasks";
  const field = allFields().find((f) => f.id === metricId);
  return `${field ? field.name : metricId} (${{ sum: "soma", avg: "média", count: "contagem" }[agg] || ""})`;
}

// ================= Salvar / carregar dashboards =================

function collectDashboardConfig() {
  return {
    listIds: [...state.selectedLists],
    period: {
      preset: el("periodPreset").value,
      start: el("periodStart").value,
      end: el("periodEnd").value,
      criteria: {
        created: el("critCreated").checked,
        closed: el("critClosed").checked,
        hours: el("critHours").checked,
      },
    },
    widgets: state.widgets.map((w) => ({
      title: w.el.querySelector(".widget-title").value,
      chartType: w.el.querySelector(".widget-chart-type").value,
      metric: w.el.querySelector(".widget-metric").value,
      agg: w.el.querySelector(".widget-agg").value,
      dim1: w.el.querySelector(".widget-dim1").value,
      dim2: w.el.querySelector(".widget-dim2").value,
      dim3: w.el.querySelector(".widget-dim3").value,
      dim4: w.el.querySelector(".widget-dim4").value,
      dim5: w.el.querySelector(".widget-dim5").value,
      filters: collectWidgetFilters(w.el),
      extraMetrics: collectExtraMetrics(w.el),
      size: w.size || null,
      compare: w.el.querySelector(".widget-compare").value,
      alertOp: w.el.querySelector(".widget-alert-op").value,
      alertValue: w.el.querySelector(".widget-alert-value").value,
    })),
  };
}

/** Marca o estado atual (listas, período, widgets) como "limpo" — chamar depois de
 *  carregar, salvar ou zerar uma visualização, para servir de referência a isDirty(). */
function markSnapshotClean() {
  state.cleanSnapshot = JSON.stringify(collectDashboardConfig());
}

/** Há alterações desde o último carregamento/salvamento que seriam perdidas? */
function isDirty() {
  if (state.cleanSnapshot === null) return false;
  return state.cleanSnapshot !== JSON.stringify(collectDashboardConfig());
}

/** Limpa widgets, nome e seleção para começar uma visualização do zero. */
function newDashboard() {
  if (isDirty() && !confirm("Você tem alterações não salvas. Descartar e começar uma nova visualização do zero?")) {
    return;
  }
  state.widgets.forEach((w) => w.chart && w.chart.destroy());
  el("widgetGrid").innerHTML = "";
  state.widgets = [];
  state.currentDashboard = null;
  el("dashboardName").value = "";
  el("savedDashboards").selectedIndex = -1;
  el("dashInfo").textContent = "";
  setTreeSelection([]);
  defaultPeriod();
  updatePeriodBanner();
  toggleEmptyState();
  markSnapshotClean();
}

async function saveDashboard() {
  const name = el("dashboardName").value.trim();
  if (!name) return alert("Dê um nome para a visualização antes de salvar.");
  if (state.selectedLists.size === 0) return alert("Selecione ao menos uma lista.");

  // se há uma visualização aberta com permissão de edição E o nome não mudou → atualiza
  const cur = state.currentDashboard;
  let payloadId = null;
  if (cur && cur.can_edit && cur.name === name) {
    payloadId = cur.id;
  } else if (cur && !cur.can_edit && cur.name === name) {
    if (!confirm("Você não tem permissão para editar esta visualização. Salvar como uma NOVA visualização sua?")) return;
  }

  const res = await api("/api/dashboards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: payloadId,
      name,
      list_id: [...state.selectedLists].join(","),
      config: collectDashboardConfig(),
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    return alert(d.detail || "Erro ao salvar.");
  }
  const saved = await res.json();
  state.currentDashboard = { id: saved.id, name, can_edit: true };
  await refreshSavedDashboards();
  el("savedDashboards").value = saved.id;
  updateDashInfo();
  markSnapshotClean();
  alert(payloadId ? "Visualização atualizada." : "Visualização salva.");
}

async function refreshSavedDashboards() {
  const res = await api("/api/dashboards");
  state.dashboardsMeta = await res.json();
  const select = el("savedDashboards");
  select.innerHTML = state.dashboardsMeta
    .map((d) => `<option value="${d.id}">${d.can_edit ? "" : "🔒 "}${d.name}</option>`)
    .join("");
  updateDashInfo();
}

function selectedDashMeta() {
  const id = Number(el("savedDashboards").value);
  return state.dashboardsMeta.find((d) => d.id === id) || null;
}

function updateDashInfo() {
  const d = selectedDashMeta();
  const info = el("dashInfo");
  if (!d) { info.textContent = ""; return; }
  const owner = d.creator_name || "Sistema";
  const perms = d.can_edit ? "você pode editar" : "somente leitura para você";
  info.textContent = `Criada por: ${owner} · ${perms}`;
  el("deleteDashboardBtn").disabled = !d.can_delete;
  el("editorsBtn").disabled = !d.can_manage_editors;
}

async function openSavedDashboard() {
  const id = el("savedDashboards").value;
  if (!id) return;
  if (isDirty() && !confirm("Você tem alterações não salvas. Descartar e abrir esta visualização mesmo assim?")) {
    el("savedDashboards").value = state.currentDashboard ? state.currentDashboard.id : "";
    return;
  }
  const isSameDashboard = state.currentDashboard && String(state.currentDashboard.id) === String(id);

  const res = await api(`/api/dashboards/${id}`);
  const d = await res.json();
  const cfg = d.config;

  state.currentDashboard = { id: d.id, name: d.name, can_edit: d.can_edit };
  el("dashboardName").value = d.name;

  if (isSameDashboard) {
    // reabrindo a MESMA visualização: preserva o período/listas que você já escolheu na tela
    updatePeriodBanner();
  } else {
    // trocando de visualização: aplica o período salvo nela (e avisa, para não gerar dúvida)
    const savedLists = (cfg.listIds || String(d.list_id || "").split(",")).filter(Boolean);
    if (savedLists.length) {
      setTreeSelection(savedLists);
    } else if (state.selectedLists.size === 0) {
      alert("Este painel não fixa listas. Selecione as pastas/listas na árvore lateral e abra novamente.");
      return;
    }
    if (cfg.period) {
      const preset = cfg.period.preset || "custom";
      el("periodPreset").value = preset;
      if (preset === "custom") {
        el("periodStart").value = cfg.period.start || "";
        el("periodEnd").value = cfg.period.end || "";
      } else {
        applyPreset(preset);
      }
      if (cfg.period.criteria) {
        el("critCreated").checked = !!cfg.period.criteria.created;
        el("critClosed").checked = !!cfg.period.criteria.closed;
        el("critHours").checked = !!cfg.period.criteria.hours;
      } else {
        el("critCreated").checked = (cfg.period.field || "date_created") === "date_created";
        el("critClosed").checked = cfg.period.field === "date_closed";
        el("critHours").checked = true;
      }
    }
    updatePeriodBanner(`Período ajustado para o salvo em "${d.name}".`);
  }

  await loadData();

  state.widgets.forEach((w) => w.chart && w.chart.destroy());
  el("widgetGrid").innerHTML = "";
  state.widgets = [];
  (cfg.widgets || []).forEach((wc) => createWidget(wc));
  toggleEmptyState();
  markSnapshotClean();
}

/** Banner sempre visível com o período/critérios que estão de fato sendo aplicados aos dados. */
function updatePeriodBanner(noticeMsg) {
  const s = el("periodStart").value, e = el("periodEnd").value;
  const fmt = (x) => (x ? x.split("-").reverse().join("/") : "—");
  const presetLabel = el("periodPreset").options[el("periodPreset").selectedIndex]?.text || "";
  const crits = [];
  if (el("critCreated").checked) crits.push("criadas");
  if (el("critClosed").checked) crits.push("fechadas");
  if (el("critHours").checked) crits.push("com horas");
  const critTxt = crits.length ? crits.join(" ou ") : "sem filtro de data";
  el("periodBanner").innerHTML = `
    📅 <b>Período ativo:</b> <span class="pb-dates">${fmt(s)} → ${fmt(e)}</span>
    <span>(${presetLabel} · tasks ${critTxt})</span>
    ${noticeMsg ? `<span class="pb-warn">⚠ ${noticeMsg}</span>` : ""}
  `;
}

async function duplicateDashboard() {
  const id = el("savedDashboards").value;
  if (!id) return;
  const res = await api(`/api/dashboards/${id}/duplicate`, { method: "POST" });
  if (!res.ok) return alert("Erro ao duplicar.");
  const d = await res.json();
  await refreshSavedDashboards();
  el("savedDashboards").value = d.id;
  updateDashInfo();
  alert("Cópia criada — ela é sua, você pode editar à vontade.");
}

async function deleteSavedDashboard() {
  const meta = selectedDashMeta();
  if (!meta) return;
  if (!confirm(`Excluir "${meta.name}"?`)) return;
  const res = await api(`/api/dashboards/${meta.id}`, { method: "DELETE" });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    return alert(d.detail || "Sem permissão para excluir.");
  }
  if (state.currentDashboard && state.currentDashboard.id === meta.id) state.currentDashboard = null;
  await refreshSavedDashboards();
}

// ================= Modal: editores =================

function openModal(id) {
  el("modalOverlay").classList.add("visible");
  document.querySelectorAll(".modal").forEach((m) => (m.style.display = "none"));
  el(id).style.display = "block";
}
function closeModals() {
  el("modalOverlay").classList.remove("visible");
}

async function openEditorsModal() {
  const meta = selectedDashMeta();
  if (!meta) return;
  const res = await api("/api/users");
  state.users = await res.json();
  el("editorsDashName").textContent = meta.name;
  const listEl = el("editorsList");
  listEl.innerHTML = state.users
    .filter((u) => u.id !== meta.created_by) // criador sempre pode, não precisa marcar
    .map(
      (u) => `<label><input type="checkbox" class="tree-check editor-check" value="${u.id}"
        ${meta.editors.includes(u.id) ? "checked" : ""} />
        ${u.username} <span class="role-badge">${u.role}</span></label>`
    )
    .join("") || `<div class="hint">Nenhum outro usuário cadastrado.</div>`;
  el("saveEditorsBtn").dataset.dashId = meta.id;
  openModal("editorsModal");
}

async function saveEditors() {
  const dashId = el("saveEditorsBtn").dataset.dashId;
  const ids = [...document.querySelectorAll(".editor-check:checked")].map((c) => Number(c.value));
  const res = await api(`/api/dashboards/${dashId}/editors`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ editor_ids: ids }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    return alert(d.detail || "Erro ao salvar editores.");
  }
  closeModals();
  await refreshSavedDashboards();
  alert("Editores atualizados.");
}

// ================= Modal: usuários (admin) =================

async function openUsersModal() {
  await renderUsersTable();
  await refreshBackupStatus();
  openModal("usersModal");
}

async function refreshBackupStatus() {
  try {
    const res = await api("/api/backup/status");
    const s = await res.json();
    const fmt = (b) => (b ? `${b.file} (${new Date(b.when).toLocaleString("pt-BR")})` : "nenhum ainda");
    let gdriveLine;
    if (!s.gdrive_configured) {
      gdriveLine = `☁️ Google Drive: não configurado (veja docs/BACKUP_GOOGLE_DRIVE.md)`;
    } else if (s.gdrive_error) {
      gdriveLine = `☁️ Google Drive: erro — ${s.gdrive_error}`;
    } else {
      const metodo = s.gdrive_method === "api" ? "via API" : "pasta sincronizada";
      gdriveLine = `☁️ Google Drive (${metodo}): ${fmt(s.gdrive)}`;
    }
    el("backupStatus").innerHTML = `💾 Local: ${fmt(s.local)}<br>${gdriveLine}`;
  } catch (e) {
    el("backupStatus").textContent = "";
  }
}

async function renderUsersTable() {
  const res = await api("/api/users");
  state.users = await res.json();
  const tbody = document.querySelector("#usersTable tbody");
  tbody.innerHTML = state.users
    .map(
      (u) => `<tr>
        <td>${u.username}${u.id === state.me.id ? " (você)" : ""}</td>
        <td><span class="role-badge">${u.role}</span></td>
        <td style="text-align:right">
          <button class="mini-btn" data-action="pass" data-id="${u.id}">Redefinir senha</button>
          ${u.id !== state.me.id ? `<button class="mini-btn danger" data-action="del" data-id="${u.id}" data-name="${u.username}">Excluir</button>` : ""}
        </td>
      </tr>`
    )
    .join("");
  tbody.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === "del") {
        if (!confirm(`Excluir o usuário ${btn.dataset.name}?`)) return;
        const res = await api(`/api/users/${id}`, { method: "DELETE" });
        if (!res.ok) { const d = await res.json().catch(()=>({})); return alert(d.detail || "Erro."); }
        await renderUsersTable();
      } else {
        const nova = prompt("Nova senha (mínimo 4 caracteres):");
        if (!nova) return;
        const res = await api(`/api/users/${id}/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: nova }),
        });
        if (!res.ok) { const d = await res.json().catch(()=>({})); return alert(d.detail || "Erro."); }
        alert("Senha redefinida.");
      }
    })
  );
}

async function createUser() {
  const username = el("newUserName").value.trim();
  const password = el("newUserPass").value;
  const role = el("newUserRole").value;
  const msg = el("userFormMsg");
  if (!username || !password) { msg.textContent = "Preencha usuário e senha."; return; }
  const res = await api("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { msg.textContent = d.detail || "Erro ao criar usuário."; return; }
  msg.textContent = `Usuário ${username} criado.`;
  el("newUserName").value = ""; el("newUserPass").value = "";
  await renderUsersTable();
}

// ================= Modal: colaboradores (admin) =================

const COLLAB_PAGE_SIZE = 8;

async function openCollabModal() {
  if (!state.teamId) await loadHierarchy();
  await refreshTeams();
  await refreshCollaborators();
  await refreshTimeOffData();
  await loadClickupMembersPicker();
  openModal("collabModal");
}

/** Renderiza os controles de página (‹ Anterior / Página X de Y / Próxima ›). */
function renderPagination(containerId, page, totalItems, pageSize, onChange) {
  const box = el(containerId);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) { box.innerHTML = ""; return totalPages; }
  box.innerHTML = `
    <button class="page-prev" ${page <= 1 ? "disabled" : ""}>‹ Anterior</button>
    <span>Página ${page} de ${totalPages}</span>
    <button class="page-next" ${page >= totalPages ? "disabled" : ""}>Próxima ›</button>
  `;
  box.querySelector(".page-prev").addEventListener("click", () => onChange(page - 1));
  box.querySelector(".page-next").addEventListener("click", () => onChange(page + 1));
  return totalPages;
}

async function refreshTeams() {
  const res = await api("/api/teams");
  state.teams = await res.json();
  el("teamsList").textContent = state.teams.map((t) => t.name).join(" · ");
  const sel = el("newCollabTeam");
  const cur = sel.value;
  sel.innerHTML = `<option value="">— (sem time)</option>` + state.teams.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
  if (cur) sel.value = cur;
}

async function refreshCollaborators() {
  const res = await api("/api/collaborators");
  state.collaborators = await res.json();
  renderCollabTable();
  el("newTimeOffCollab").innerHTML = state.collaborators.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
}

function renderCollabTable() {
  const totalPages = renderPagination("collabPagination", state.collabPage || 1, state.collaborators.length, COLLAB_PAGE_SIZE, (p) => {
    state.collabPage = p;
    renderCollabTable();
  });
  state.collabPage = Math.min(state.collabPage || 1, totalPages);
  const start = (state.collabPage - 1) * COLLAB_PAGE_SIZE;
  const pageItems = state.collaborators.slice(start, start + COLLAB_PAGE_SIZE);

  const tbody = document.querySelector("#collabTable tbody");
  tbody.innerHTML = pageItems.map((c) => `
    <tr data-id="${c.id}">
      <td>${c.name}</td>
      <td>
        <select class="input-inline collab-team-select">
          <option value="">— (sem time)</option>
          ${state.teams.map((t) => `<option value="${t.id}" ${t.id === c.team_id ? "selected" : ""}>${t.name}</option>`).join("")}
        </select>
      </td>
      <td><input class="input-inline collab-rate-input" type="number" min="0" step="0.01" value="${c.hourly_rate ?? 0}" style="width:90px" /></td>
      <td><input class="input-inline collab-capacity-input" type="number" min="0" step="0.5" value="${c.capacity_hours_day ?? 8}" style="width:70px" /></td>
      <td><button class="mini-btn danger collab-remove" title="Remover colaborador">✕</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach((row) => {
    const id = Number(row.dataset.id);
    const save = async () => {
      const teamVal = row.querySelector(".collab-team-select").value;
      const hourly_rate = parseFloat(row.querySelector(".collab-rate-input").value) || 0;
      const capacity_hours_day = parseFloat(row.querySelector(".collab-capacity-input").value) || 0;
      await api(`/api/collaborators/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamVal ? Number(teamVal) : null, hourly_rate, capacity_hours_day }),
      });
      const c = state.collaborators.find((x) => x.id === id);
      if (c) { c.team_id = teamVal ? Number(teamVal) : null; c.hourly_rate = hourly_rate; c.capacity_hours_day = capacity_hours_day; }
    };
    row.querySelector(".collab-team-select").addEventListener("change", save);
    row.querySelector(".collab-rate-input").addEventListener("change", save);
    row.querySelector(".collab-capacity-input").addEventListener("change", save);
    row.querySelector(".collab-remove").addEventListener("click", async () => {
      const name = (state.collaborators.find((c) => c.id === id) || {}).name || "";
      if (!confirm(`Remover ${name} dos colaboradores? Isso também remove as folgas/férias cadastradas para essa pessoa.`)) return;
      await api(`/api/collaborators/${id}`, { method: "DELETE" });
      await refreshCollaborators();
      await refreshTimeOffData();
      await loadClickupMembersPicker();
    });
  });
}

async function loadClickupMembersPicker() {
  const sel = el("newCollabClickupUser");
  sel.innerHTML = `<option value="">Carregando membros do ClickUp...</option>`;
  try {
    const res = await api(`/api/collaborators/clickup-members?team_id=${state.teamId}`);
    const members = await res.json();
    state.clickupMembers = members;
    const already = new Set(state.collaborators.map((c) => String(c.clickup_user_id)));
    sel.innerHTML = `<option value="">Buscar colaborador no ClickUp...</option>` +
      members.filter((m) => !already.has(String(m.id)))
        .map((m) => `<option value="${m.id}">${m.username || m.email}</option>`).join("");
  } catch (e) {
    sel.innerHTML = `<option value="">Erro ao buscar membros do ClickUp</option>`;
  }
}

function renderTimeOffTable() {
  const totalPages = renderPagination("timeOffPagination", state.timeOffPage || 1, state.timeOff.length, COLLAB_PAGE_SIZE, (p) => {
    state.timeOffPage = p;
    renderTimeOffTable();
  });
  state.timeOffPage = Math.min(state.timeOffPage || 1, totalPages);
  const start = (state.timeOffPage - 1) * COLLAB_PAGE_SIZE;
  const pageItems = state.timeOff.slice(start, start + COLLAB_PAGE_SIZE);

  const tbody = document.querySelector("#timeOffTable tbody");
  const fmt = (s) => (s ? s.split("-").reverse().join("/") : "—");
  tbody.innerHTML = pageItems.map((t) => `
    <tr data-id="${t.id}">
      <td>${t.collaborator_name}</td>
      <td>${t.type === "ferias" ? "Férias" : "Folga"}</td>
      <td>${fmt(t.start_date)}</td>
      <td>${fmt(t.end_date)}</td>
      <td><button class="mini-btn danger timeoff-remove" title="Remover">✕</button></td>
    </tr>
  `).join("");
  tbody.querySelectorAll(".timeoff-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.closest("tr").dataset.id);
      await api(`/api/time-off/${id}`, { method: "DELETE" });
      await refreshTimeOffData();
    });
  });
}

async function refreshTimeOffData() {
  const res = await api("/api/time-off");
  state.timeOff = await res.json();
  renderTimeOffTable();
}

// ================= Autenticação =================

async function initAuth() {
  const res = await fetch("/api/auth/me");
  if (!res.ok) { window.location.href = "/login"; return false; }
  state.me = await res.json();
  el("userName").textContent = state.me.username;
  el("userRole").textContent = state.me.role;
  if (state.me.role === "admin") {
    el("usersBtn").style.display = "";
    el("collabBtn").style.display = "";
  }
  return true;
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

// ================= Exportar PDF =================

function exportPdf() {
  if (state.widgets.length === 0) {
    alert("Adicione pelo menos um widget antes de exportar.");
    return;
  }
  const name = el("dashboardName").value.trim() || "Painel de Acompanhamento";
  const startStr = el("periodStart").value;
  const endStr = el("periodEnd").value;
  const fmt = (s) => (s ? s.split("-").reverse().join("/") : "—");

  document.querySelector("#printHeader .print-title").textContent = name;
  document.querySelector("#printHeader .print-meta").textContent =
    `Período: ${fmt(startStr)} a ${fmt(endStr)} · Gerado em ${new Date().toLocaleString("pt-BR")}`;

  // Congela cada gráfico como uma imagem estática (snapshot) antes de imprimir.
  // Motivo: em alguns navegadores o <canvas> do Chart.js não é redimensionado
  // a tempo quando o layout muda de tela (cards largos) para impressão (grade
  // de 2 colunas), e isso cortava as barras do lado direito de gráficos largos.
  // Uma <img> estática com object-fit:contain sempre cabe inteira na área do
  // widget, então nada fica cortado — mesmo que o recálculo de layout atrase.
  const snapshots = [];
  state.widgets.forEach((widget) => {
    if (!widget.chart) return;
    const holder = widget.el.querySelector(".chart-holder");
    if (!holder) return;
    const img = document.createElement("img");
    img.className = "print-chart-snapshot";
    img.src = widget.chart.toBase64Image("image/png", 1);
    holder.appendChild(img);
    snapshots.push({ holder, img });
  });

  const removeSnapshots = () => {
    snapshots.forEach(({ holder, img }) => { if (holder.contains(img)) holder.removeChild(img); });
  };
  // redimensiona os gráficos de volta ao tamanho de tela e remove os snapshots
  const restoreAfterPrint = () => {
    removeSnapshots();
    state.widgets.forEach((w) => w.chart && w.chart.resize());
  };
  window.addEventListener("afterprint", restoreAfterPrint, { once: true });

  // espera os snapshots entrarem no DOM antes de abrir a caixa de impressão
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

// ================= Bootstrap =================

el("widgetGrid").addEventListener("dragover", (e) => {
  const dragging = document.querySelector(".widget.dragging");
  if (!dragging) return;
  e.preventDefault();
  const after = widgetAfterPointer(e.clientX, e.clientY);
  if (after == null) el("widgetGrid").appendChild(dragging);
  else if (after !== dragging) el("widgetGrid").insertBefore(dragging, after);
});
el("widgetGrid").addEventListener("drop", (e) => e.preventDefault());

el("selectAllLists").addEventListener("change", () => {
  const marcar = el("selectAllLists").checked;
  setTreeSelection(marcar ? allWorkspaceListIds() : []);
});
el("loadTasksBtn").addEventListener("click", () => loadData(false));
el("refreshBtn").addEventListener("click", async () => {
  await loadHierarchy(true);
  if (state.selectedLists.size > 0) await loadData(true);
});
el("addWidgetBtn").addEventListener("click", () => createWidget());
el("newDashboardBtn").addEventListener("click", newDashboard);
el("saveDashboardBtn").addEventListener("click", saveDashboard);
el("loadDashboardBtn").addEventListener("click", openSavedDashboard);
el("duplicateDashboardBtn").addEventListener("click", duplicateDashboard);
el("deleteDashboardBtn").addEventListener("click", deleteSavedDashboard);
el("editorsBtn").addEventListener("click", openEditorsModal);
el("saveEditorsBtn").addEventListener("click", saveEditors);
el("usersBtn").addEventListener("click", openUsersModal);
el("collabBtn").addEventListener("click", openCollabModal);
document.querySelectorAll("#collabModal .section-toggle").forEach((h) => {
  h.addEventListener("click", () => h.closest(".modal-section").classList.toggle("collapsed"));
});
el("createTeamBtn").addEventListener("click", async () => {
  const btn = el("createTeamBtn");
  const name = el("newTeamName").value.trim();
  if (!name || btn.disabled) return;
  btn.disabled = true;
  try {
    const res = await api("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.detail || "Erro ao criar time.");
      return;
    }
    el("newTeamName").value = "";
    await refreshTeams();
  } finally {
    btn.disabled = false;
  }
});
el("createCollabBtn").addEventListener("click", async () => {
  const btn = el("createCollabBtn");
  const clickupId = el("newCollabClickupUser").value;
  const msg = el("collabFormMsg");
  if (!clickupId) { msg.textContent = "Selecione um colaborador do ClickUp."; return; }
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const member = (state.clickupMembers || []).find((m) => String(m.id) === String(clickupId));
    const team_id = el("newCollabTeam").value ? Number(el("newCollabTeam").value) : null;
    const hourly_rate = parseFloat(el("newCollabRate").value) || 0;
    const capacity_hours_day = parseFloat(el("newCollabCapacity").value) || 8;
    const res = await api("/api/collaborators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: member ? (member.username || member.email || "") : "",
        clickup_user_id: clickupId,
        team_id, hourly_rate, capacity_hours_day,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { msg.textContent = d.detail || "Erro ao adicionar colaborador."; return; }
    msg.textContent = "Colaborador adicionado.";
    el("newCollabRate").value = "";
    el("newCollabCapacity").value = "8";
    await refreshCollaborators();
    await loadClickupMembersPicker();
  } finally {
    btn.disabled = false;
  }
});
el("createTimeOffBtn").addEventListener("click", async () => {
  const btn = el("createTimeOffBtn");
  const msg = el("timeOffFormMsg");
  const collaborator_id = Number(el("newTimeOffCollab").value);
  const type = el("newTimeOffType").value;
  const start_date = el("newTimeOffStart").value;
  const end_date = el("newTimeOffEnd").value;
  if (!collaborator_id || !start_date || !end_date) { msg.textContent = "Preencha colaborador e as duas datas."; return; }
  if (end_date < start_date) { msg.textContent = "Data final não pode ser antes da inicial."; return; }
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const res = await api("/api/time-off", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaborator_id, type, start_date, end_date }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); msg.textContent = d.detail || "Erro ao adicionar."; return; }
    msg.textContent = "";
    el("newTimeOffStart").value = "";
    el("newTimeOffEnd").value = "";
    await refreshTimeOffData();
  } finally {
    btn.disabled = false;
  }
});
el("createUserBtn").addEventListener("click", createUser);
el("runSnapshotsBtn").addEventListener("click", async () => {
  const btn = el("runSnapshotsBtn");
  const msg = el("snapshotsMsg");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Gerando (pode demorar)...`;
  try {
    const res = await api("/api/snapshots/run", { method: "POST" });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || "Erro ao gerar snapshots");
    const n = (d.generated || []).length;
    msg.textContent = n ? `${n} semana(s) gerada(s): ${d.generated.map((g) => g.week).join(", ")}` : "Nenhuma semana pendente — histórico em dia.";
  } catch (e) {
    msg.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Gerar snapshots agora (só semanas faltantes)";
  }
});
el("runBackupBtn").addEventListener("click", async () => {
  const btn = el("runBackupBtn");
  const msg = el("backupMsg");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Fazendo backup...`;
  try {
    const res = await api("/api/backup/run", { method: "POST" });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || "Erro ao fazer backup");
    msg.textContent = d.gdrive_copied
      ? `Backup criado e copiado para o Google Drive: ${d.file}`
      : d.gdrive_error
        ? `Backup local criado (${d.file}), mas falhou ao copiar pro Drive: ${d.gdrive_error}`
        : `Backup local criado: ${d.file} (Google Drive não configurado)`;
    await refreshBackupStatus();
  } catch (e) {
    msg.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Backup agora";
  }
});
el("regenSnapshotsBtn").addEventListener("click", async () => {
  if (!confirm("Isso recalcula TODAS as semanas do histórico (últimos ~6 meses) com a regra de categoria atual. Pode levar vários minutos. Continuar?")) return;
  const btn = el("regenSnapshotsBtn");
  const msg = el("snapshotsMsg");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Regenerando todo o histórico...`;
  try {
    const res = await api("/api/snapshots/regenerate", { method: "POST" });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || "Erro ao regenerar snapshots");
    msg.textContent = `${(d.generated || []).length} semana(s) recalculada(s) com a regra atual de Categoria.`;
  } catch (e) {
    msg.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "🔁 Regenerar TODO o histórico (recalcula tudo)";
  }
});
el("logoutBtn").addEventListener("click", logout);
el("exportPdfBtn").addEventListener("click", exportPdf);
el("savedDashboards").addEventListener("change", updateDashInfo);

document.querySelectorAll(".modal-close").forEach((b) => b.addEventListener("click", closeModals));
el("modalOverlay").addEventListener("click", (e) => { if (e.target === el("modalOverlay")) closeModals(); });

el("periodPreset").addEventListener("change", () => {
  applyPreset(el("periodPreset").value);
  updatePeriodBanner();
  state.widgets.forEach((w) => renderWidget(w));
});

["periodStart", "periodEnd"].forEach((id) =>
  el(id).addEventListener("change", () => {
    el("periodPreset").value = "custom";
    updatePeriodBanner();
    state.widgets.forEach((w) => renderWidget(w));
  })
);
["critCreated", "critClosed", "critHours"].forEach((id) =>
  el(id).addEventListener("change", () => {
    updatePeriodBanner();
    state.widgets.forEach((w) => renderWidget(w));
  })
);

el("sidebarToggle").addEventListener("click", () => {
  const collapsed = el("appRoot").classList.toggle("collapsed");
  el("sidebarToggle").textContent = collapsed ? "▶" : "◀";
  setTimeout(() => state.widgets.forEach((w) => w.chart && w.chart.resize()), 250);
});

window.addEventListener("beforeunload", (e) => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

(async () => {
  if (!(await initAuth())) return;
  defaultPeriod();
  updatePeriodBanner();
  loadHierarchy();
  refreshSavedDashboards();
  // times/colaboradores/folgas: carregados p/ todo mundo (não só quem abre o modal),
  // pois alimentam a dimensão "Time do colaborador" e as métricas de capacidade/custo
  await refreshTeams();
  await Promise.all([refreshCollaborators(), refreshTimeOffData()]);
  updateSelectionSummary();
  toggleEmptyState();
  markSnapshotClean();
})();
