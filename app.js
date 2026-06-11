const IGV_RATE = 0.18;
const DETRACTION_RATE = 0.12;
const DETRACTION_THRESHOLD = 700;
const COMMISSION_RATE = 0.05;

const STORAGE_KEY = "bandu-panel-state-v2";
const LEGACY_STORAGE_KEY = "bandu-panel-state-v1";
const AUTH_KEY = "bandu-panel-auth-v1";
const SESSION_KEY = "nebumia-session";
const THEME_KEY = "bandu-panel-theme";
const DASHBOARD_FILTERS_KEY = "nebumia-dashboard-filters";

const quoteStatuses = ["Por cotizar", "Cotizado", "Ganado", "Perdido"];
const leadStatuses = ["Nuevo", "Contactado", "Reunion", "Propuesta", "Cotizado", "Ganado", "Cerrado perdido"];
const paymentStatuses = ["Pendiente", "Facturado", "Pagado", "Vencido"];
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const navItems = [
  ["dashboard", "Dashboard", "layout"],
  ["leads", "Oportunidades", "target"],
  ["quotes", "Cotizaciones", "fileText"],
  ["sales", "Ventas", "receipt"],
  ["clients", "Clientes", "users"],
  ["collections", "Cobranzas", "wallet"],
  ["finance", "Caja de ingresos y egresos", "banknote"],
  ["taxes", "Pago impuestos", "receipt"],
  ["team", "Pago personal", "briefcase"],
  ["settings", "Configuración", "settings"]
];

const icons = {
  layout: '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
  target: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle>',
  fileText: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path><path d="M14 2v5h5"></path><path d="M9 13h6"></path><path d="M9 17h6"></path>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2z"></path><path d="M8 7h8"></path><path d="M8 11h8"></path><path d="M8 15h5"></path>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h14a2 2 0 0 1 2 2v4h-3a2 2 0 0 0 0 4h3v1a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"></path><path d="M18 14h.01"></path>',
  banknote: '<rect x="3" y="6" width="18" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M7 12h.01"></path><path d="M17 12h.01"></path>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M2 12h20"></path>',
  chart: '<path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path>',
  plug: '<path d="M12 22v-5"></path><path d="M9 8V2"></path><path d="M15 8V2"></path><path d="M6 8h12v4a6 6 0 0 1-12 0z"></path>',
  settings: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"></path><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.4 1.05V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.05-.4H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6A1.65 1.65 0 0 0 10.4 3V3a2 2 0 1 1 4 0v.09c0 .4.15.77.4 1.05.27.29.62.48 1 .56a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.08.38.27.73.56 1 .28.25.65.4 1.05.4H21a2 2 0 1 1 0 4h-.09c-.4 0-.77.15-1.05.4-.29.27-.48.62-.56 1z"></path>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M17 8 12 3 7 8"></path><path d="M12 3v12"></path>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path>',
  plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
  edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  creditCard: '<rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path>',
  sparkles: '<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z"></path><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"></path><path d="M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8z"></path>',
  package: '<path d="m21 8-9-5-9 5 9 5 9-5z"></path><path d="M3 8v8l9 5 9-5V8"></path><path d="M12 13v8"></path>',
  trending: '<path d="m22 7-8.5 8.5-5-5L2 17"></path><path d="M16 7h6v6"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>'
};

function icon(name, className = "") {
  return `<svg class="app-icon ${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.layout}</svg>`;
}

function uid() {
  return crypto.randomUUID();
}

function newLead(data = {}) {
  return {
    id: data.id || uid(),
    date: data.date || today(),
    client: data.client || "",
    contact: data.contact || "",
    source: data.source || "Kommo Partner",
    channel: data.channel || "WhatsApp",
    service: data.service || "",
    estimatedValue: Number(data.estimatedValue || data.value || 0),
    currency: data.currency || "PEN",
    status: data.status || "Nuevo",
    owner: data.owner || "Dante Trujillo",
    notes: data.notes || "",
    quoteId: data.quoteId || ""
  };
}

function newQuote(data = {}) {
  return {
    id: data.id || uid(),
    code: data.code || nextQuoteCode(),
    leadId: data.leadId || "",
    month: data.month || currentMonthName(),
    date: data.date || today(),
    category: data.category || "Marketing",
    service: data.service || "",
    owner: data.owner || "Dante Trujillo",
    client: data.client || "",
    subtotal: Number(data.subtotal || 0),
    currency: data.currency || "PEN",
    status: data.status || "Por cotizar",
    hasIgv: data.hasIgv !== undefined ? Boolean(data.hasIgv) : true,
    paymentType: data.paymentType || "split",
    repo: data.repo || "",
    comments: data.comments || ""
  };
}

function newClient(data = {}) {
  return {
    id: data.id || uid(),
    name: data.name || "",
    ruc: data.ruc || "",
    contact: data.contact || "",
    email: data.email || "",
    phone: data.phone || "",
    owner: data.owner || "Dante Trujillo",
    notes: data.notes || ""
  };
}

function newExpense(data = {}) {
  return {
    id: data.id || uid(),
    month: data.month || currentMonthName(),
    concept: data.concept || "",
    type: data.type || "Gasto fijo",
    amount: Number(data.amount || 0),
    status: data.status || "Pendiente",
    owner: data.owner || "Bandu"
  };
}

function newTeamPayment(data = {}) {
  return {
    id: data.id || uid(),
    month: data.month || currentMonthName(),
    name: data.name || "",
    role: data.role || "Team interno",
    amount: Number(data.amount || 0),
    status: data.status || "Pendiente",
    receipt: data.receipt || ""
  };
}

function seedState() {
  const state = {
    settings: {
      monthlyGoal: 8000,
      currency: "PEN",
      commissionRate: COMMISSION_RATE,
      detractionRate: DETRACTION_RATE,
      igvRate: IGV_RATE,
      detractionThreshold: DETRACTION_THRESHOLD,
      bankAccounts: ["CC Interbank S/", "CP Interbank S/", "CC Interbank $", "CP Interbank $"]
    },
    users: [{ name: "Administrador", email: "admin@bandu.pe", role: "Owner" }],
    clients: [
      newClient({ name: "EYM Cirujia y Estetica Laser S.A.C.", owner: "Dante Trujillo" }),
      newClient({ name: "Diplomados Rebagliati", owner: "Dante Trujillo" }),
      newClient({ name: "E2I", owner: "Dante Trujillo" }),
      newClient({ name: "Mundo Tesis", owner: "Christian Trujillo" }),
      newClient({ name: "Neodoctor", owner: "Dante Trujillo" })
    ],
    leads: [
      newLead({ date: "2026-06-03", client: "Neodoctor", source: "Kommo Partner", channel: "Partner", service: "Implementacion CRM + automatizaciones", estimatedValue: 4200, status: "Nuevo" }),
      newLead({ date: "2026-05-09", client: "Mundo Tesis", source: "Meta Ads WhatsApp", channel: "WhatsApp", service: "Estrategia y anuncios Meta Ads", estimatedValue: 300, status: "Ganado", owner: "Christian Trujillo" }),
      newLead({ date: "2026-04-18", client: "E2I", source: "Referido", channel: "Correo", service: "Chat inteligente con IA", estimatedValue: 7436, status: "Propuesta" }),
      newLead({ date: "2026-03-11", client: "Diplomados Rebagliati", source: "Kommo Partner", channel: "Partner", service: "Renovacion de usuarios Kommo CRM", estimatedValue: 3588.23, status: "Ganado" })
    ],
    quotes: [
      newQuote({ code: "PPTO 0286", month: "Enero", date: "2026-01-09", category: "Marketing", service: "Contratacion de 1 usuario para Kommo CRM (10 meses + 3 meses gratis)", owner: "Dante Trujillo", client: "EYM Cirujia y Estetica Laser S.A.C.", subtotal: 837.5, status: "Ganado", hasIgv: true, paymentType: "split", comments: "Recomendacion de Marla Canari" }),
      newQuote({ code: "PPTO 0302", month: "Marzo", date: "2026-03-11", category: "Tecnologia", service: "Renovacion de 7 usuarios para Kommo CRM", owner: "Dante Trujillo", client: "Diplomados Rebagliati", subtotal: 3588.23, status: "Ganado", hasIgv: true, paymentType: "full", comments: "Incluye mes gratis" }),
      newQuote({ code: "PPTO 0311+V2", month: "Abril", date: "2026-04-18", category: "IA", service: "Diseno UX/UI del chat inteligente con IA en plataforma Dairel", owner: "Dante Trujillo", client: "E2I", subtotal: 7436, status: "Cotizado", hasIgv: true, paymentType: "split", comments: "Version ajustada" }),
      newQuote({ code: "PPTO 0318", month: "Mayo", date: "2026-05-07", category: "Marketing", service: "Estrategia, configuracion y anuncios en Meta Ads", owner: "Christian Trujillo", client: "Mundo Tesis", subtotal: 300, status: "Ganado", hasIgv: false, paymentType: "split", comments: "Curso Meta Ads" }),
      newQuote({ code: "PPTO 0324", month: "Junio", date: "2026-06-03", category: "CRM", service: "Implementacion, configuracion y automatizacion de Kommo CRM", owner: "Dante Trujillo", client: "Neodoctor", subtotal: 4200, status: "Por cotizar", hasIgv: true, paymentType: "split", comments: "Lead Kommo Partner" })
    ],
    collections: [],
    expenses: [
      newExpense({ month: "Enero", concept: "Correo corporativo Gmail Administracion", amount: 16.8, type: "Gasto fijo", status: "Completado" }),
      newExpense({ month: "Enero", concept: "Correo corporativo Gmail Christian Trujillo", amount: 16.8, type: "Gasto fijo", status: "Completado" }),
      newExpense({ month: "Abril", concept: "Herramientas Kommo / Make / Hosting", amount: 790, type: "Operacion", status: "Completado" }),
      newExpense({ month: "Mayo", concept: "Produccion y documentacion", amount: 520, type: "Proyecto", status: "Pendiente" })
    ],
    team: [
      newTeamPayment({ month: "Enero", name: "Christian Trujillo", role: "Team interno", amount: 500, status: "Pagado" }),
      newTeamPayment({ month: "Enero", name: "Dante Trujillo", role: "Team interno", amount: 3000, status: "Pagado" }),
      newTeamPayment({ month: "Junio", name: "Especialista externo", role: "Proyecto", amount: 84, status: "Pendiente" })
    ]
  };
  state.quotes.forEach(q => syncQuoteSideEffects(state, q));
  return state;
}

let state = loadState();
let activeView = "dashboard";
let editingId = "";
let editingType = "";
let authMode = "login";
let dashboardRange = getDashboardPreset("thisYear");
let dashboardSections = new Set(["metrics", "revenue", "collections", "pipeline", "profitability", "salesOwner"]);
let dashboardSavedFilters = JSON.parse(localStorage.getItem(DASHBOARD_FILTERS_KEY) || "[]");

const loginScreen = document.querySelector("#loginScreen");
const appShell = document.querySelector("#appShell");
const viewRoot = document.querySelector("#viewRoot");
const quoteDialog = document.querySelector("#quoteDialog");
const quoteForm = document.querySelector("#quoteForm");
const passwordDialog = document.querySelector("#passwordDialog");
const profileDialog = document.querySelector("#profileDialog");
const profileForm = document.querySelector("#profileForm");
const themeToggleBtn = document.querySelector("#themeToggleBtn");
const profileMenuBtn = document.querySelector("#profileMenuBtn");
const profileDropdown = document.querySelector("#profileDropdown");
const editProfileBtn = document.querySelector("#editProfileBtn");
const profileLogoutBtn = document.querySelector("#profileLogoutBtn");
const profileName = document.querySelector("#profileName");
const profileEmail = document.querySelector("#profileEmail");
const profileAvatar = document.querySelector("#profileAvatar");
const authTitle = document.querySelector("#authTitle");
const authSubtitle = document.querySelector("#authSubtitle");
const authSubmitBtn = document.querySelector("#authSubmitBtn");
const authHint = document.querySelector("#authHint");
const passwordField = document.querySelector("#passwordField");
const forgotPasswordBtn = document.querySelector("#forgotPasswordBtn");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return migrateState(JSON.parse(saved));
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) return migrateState(JSON.parse(legacy));
  return seedState();
}

function migrateState(input) {
  const base = seedState();
  const inputSettings = { ...(input.settings || {}) };
  if (inputSettings.commissionRate === 0.0005) inputSettings.commissionRate = COMMISSION_RATE;
  const migrated = {
    ...base,
    ...input,
    settings: { ...base.settings, ...inputSettings },
    clients: (input.clients || base.clients).map(newClient),
    leads: (input.leads || base.leads).map((lead) => newLead({
      ...lead,
      estimatedValue: lead.estimatedValue || lead.value || 0,
      client: lead.client || "Lead sin cliente",
      service: lead.service || lead.source || ""
    })),
    quotes: (input.quotes || base.quotes).map(newQuote),
    collections: (input.collections || []).map(c => ({
      id: c.id || uid(),
      quoteId: c.quoteId || "",
      part: Number(c.part || 1),
      label: c.label || `Pago ${c.part || 1}`,
      dueDate: c.dueDate || c.due || today(),
      amount: Number(c.amount || 0),
      detraction: Number(c.detraction || 0),
      currency: c.currency || "PEN",
      status: c.status || "Pendiente",
      paidDate: c.paidDate || "",
      invoice: c.invoice || "",
      bankAccount: c.bankAccount || ""
    })),
    expenses: (input.expenses || base.expenses).map(newExpense),
    team: (input.team || base.team).map(newTeamPayment)
  };
  migrated.quotes.forEach(q => syncQuoteSideEffects(migrated, q));
  syncClientsFromActivity(migrated);
  return migrated;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const label = theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  themeToggleBtn.innerHTML = icon(theme === "dark" ? "sun" : "moon");
  themeToggleBtn.setAttribute("aria-label", label);
  themeToggleBtn.title = label;
  localStorage.setItem(THEME_KEY, theme);
}

function auth() {
  const saved = localStorage.getItem(AUTH_KEY);
  return saved ? JSON.parse(saved) : { name: "Administrador", email: "admin@bandu.pe", password: "bandu2026" };
}

function saveAuth(next) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...auth(), ...next }));
}

function syncProfileUI() {
  const current = auth();
  const name = current.name || "Administrador";
  profileName.textContent = name;
  profileEmail.textContent = current.email || "admin@bandu.pe";
  profileAvatar.textContent = name.trim().charAt(0).toUpperCase() || "N";
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  appShell.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  profileDropdown.classList.add("hidden");
}

function setAuthMode(mode) {
  authMode = mode;
  passwordField.classList.toggle("hidden", mode === "forgot");
  document.querySelector("#password").required = mode !== "forgot";
  forgotPasswordBtn.classList.toggle("hidden", mode === "forgot");

  if (mode === "login") {
    authTitle.textContent = "Bienvenido de vuelta";
    authSubtitle.textContent = "Ingresa tus datos para acceder a Nebumia.";
    authSubmitBtn.innerHTML = "Ingresar al sistema";
    authHint.textContent = "Demo: admin@bandu.pe / bandu2026";
  }
  if (mode === "forgot") {
    authTitle.textContent = "Recupera tu contrasena";
    authSubtitle.textContent = "Ingresa tu correo para recibir instrucciones de recuperacion.";
    authSubmitBtn.innerHTML = "Enviar instrucciones";
    authHint.textContent = "En produccion enviaremos un correo seguro de recuperacion.";
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function shiftDate(value, days) {
  const date = typeof value === "string" ? parseDate(value) : new Date(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function getDashboardPreset(key) {
  const current = parseDate(today());
  const end = isoDate(current);
  const year = current.getFullYear();
  const month = current.getMonth();
  const weekday = (current.getDay() + 6) % 7;
  const presets = {
    today: { start: end, end, label: "Hoy" },
    yesterday: { start: shiftDate(end, -1), end: shiftDate(end, -1), label: "Ayer" },
    last7: { start: shiftDate(end, -6), end, label: "Últimos 7 días" },
    last14: { start: shiftDate(end, -13), end, label: "Últimos 14 días" },
    last30: { start: shiftDate(end, -29), end, label: "Últimos 30 días" },
    thisWeek: { start: shiftDate(end, -weekday), end, label: "Esta semana" },
    lastWeek: { start: shiftDate(end, -weekday - 7), end: shiftDate(end, -weekday - 1), label: "Semana pasada" },
    thisMonth: { start: isoDate(new Date(year, month, 1)), end, label: "Este mes" },
    lastMonth: {
      start: isoDate(new Date(year, month - 1, 1)),
      end: isoDate(new Date(year, month, 0)),
      label: "Mes pasado"
    },
    thisYear: { start: `${year}-01-01`, end, label: "Este año" },
    maximum: { start: "2022-01-01", end, label: "Máximo" }
  };
  return { key, ...presets[key] };
}

function dateInRange(value, range = dashboardRange) {
  if (!value) return false;
  return value >= range.start && value <= range.end;
}

function monthDate(month) {
  const index = months.indexOf(month);
  return index >= 0 ? `2026-${String(index + 1).padStart(2, "0")}-01` : "";
}

function formatRangeDate(value) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(parseDate(value));
}

function dateFilterControl() {
  return `
    <div class="date-filter">
      <button id="dateFilterBtn" class="date-filter-trigger" type="button" aria-expanded="false">
        ${icon("clock")}<span>${dashboardRange.label}</span>
        <svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
      </button>
      <div id="dateFilterPopover" class="date-filter-popover hidden">
        <aside class="date-presets">
          <h4>Rangos rápidos</h4>
          ${[
            ["today", "Hoy"], ["yesterday", "Ayer"], ["last7", "Últimos 7 días"],
            ["last14", "Últimos 14 días"], ["last30", "Últimos 30 días"],
            ["thisWeek", "Esta semana"], ["lastWeek", "Semana pasada"],
            ["thisMonth", "Este mes"], ["lastMonth", "Mes pasado"],
            ["thisYear", "Este año"], ["maximum", "Máximo"]
          ].map(([key, label]) => `<button class="${dashboardRange.key === key ? "active" : ""}" data-date-preset="${key}" type="button"><span></span>${label}</button>`).join("")}
        </aside>
        <section class="date-custom">
          <div class="date-custom-head">
            <div><h3>Seleccionar periodo</h3><p>Las fechas se muestran en la hora de Lima.</p></div>
            <button id="closeDateFilter" class="icon-button" type="button" aria-label="Cerrar">×</button>
          </div>
          <div class="date-inputs">
            <label>Desde<input id="dashboardStartDate" type="date" value="${dashboardRange.start}"></label>
            <span>hasta</span>
            <label>Hasta<input id="dashboardEndDate" type="date" value="${dashboardRange.end}"></label>
          </div>
          <p id="dateFilterError" class="form-note error-note"></p>
          <div class="date-filter-actions">
            <button id="resetDateFilter" class="secondary-action" type="button">Restablecer</button>
            <button id="applyDateFilter" class="primary-action" type="button">Actualizar</button>
          </div>
        </section>
      </div>
    </div>
  `;
}

function moduleToolbar({ search = "", filters = "", action = "", showDate = true } = {}) {
  const actions = {
    quote: ["Nueva cotización", "quotes"],
    lead: ["Nueva oportunidad", "leads"],
    client: ["Nuevo cliente", "clients"],
    expense: ["Nuevo egreso", "finance"],
    payment: ["Nuevo pago", "team"],
    taxPayment: ["Nuevo pago", "taxes"]
  };
  const actionConfig = actions[action];
  return `
    <div class="module-controls">
      <section class="module-toolbar module-query-bar">
        ${search ? `<label class="module-search">${icon("search")}<input id="moduleSearch" type="search" placeholder="${search}"></label>` : ""}
        <div class="module-query-filters">
          ${filters}
          ${showDate ? dateFilterControl() : ""}
        </div>
      </section>
      <section class="module-toolbar module-action-bar">
        <div class="module-primary-action">
          ${actionConfig ? `<button class="create-action" data-module-action="${actionConfig[1]}" type="button">${icon("plus")}<span>${actionConfig[0]}</span></button>` : ""}
        </div>
        <div class="module-toolbar-actions">
        <button class="secondary-action" data-import-state type="button">${icon("upload")}<span>Importar</span></button>
        <button class="secondary-action" data-export-state type="button">${icon("download")}<span>Exportar</span></button>
        </div>
      </section>
    </div>
  `;
}

function dashboardFilterBar() {
  const sectionOptions = [
    ["metrics", "Métricas principales"],
    ["revenue", "Gráfico de ingresos"],
    ["collections", "Próximos cobros"],
    ["pipeline", "Pipeline comercial"],
    ["profitability", "Rentabilidad por servicio"],
    ["salesOwner", "Ventas por comercial"]
  ];
  return `
    <section class="dashboard-filter-zone">
      <div class="dashboard-quick-filters">
        <span class="dashboard-filter-label">Filtros rápidos</span>
        <button data-dashboard-preset="all" type="button">Vista completa</button>
        <button data-dashboard-preset="commercial" type="button">Comercial</button>
        <button data-dashboard-preset="finance" type="button">Finanzas</button>
        ${dashboardSavedFilters.map(filter => `<button data-saved-dashboard-filter="${filter.id}" type="button">${escapeHtml(filter.name)}</button>`).join("")}
        <div class="dashboard-filter-builder">
          <button id="createDashboardFilter" class="add-filter-button" type="button">${icon("plus")}<span>Crear filtro</span></button>
          <div id="dashboardFilterBuilder" class="dashboard-filter-popover hidden">
            <div class="dashboard-filter-builder-head">
              <strong>Nuevo filtro</strong>
              <button id="closeDashboardFilter" class="icon-button" type="button" aria-label="Cerrar">×</button>
            </div>
            <label>Nombre del filtro<input id="dashboardFilterName" placeholder="Ej. Seguimiento comercial"></label>
            <div class="dashboard-component-list">
              ${sectionOptions.map(([key, label]) => `
                <label><input type="checkbox" value="${key}" ${dashboardSections.has(key) ? "checked" : ""}><span>${label}</span></label>
              `).join("")}
            </div>
            <button id="saveDashboardFilter" class="primary-action" type="button">${icon("check")}<span>Guardar y aplicar</span></button>
          </div>
        </div>
      </div>
      <div class="dashboard-date-side">
        ${dateFilterControl()}
        <div class="period-summary">Periodo analizado: <strong>${formatRangeDate(dashboardRange.start)} - ${formatRangeDate(dashboardRange.end)}</strong></div>
      </div>
    </section>
  `;
}

function dashboardSnapshot() {
  const leads = state.leads.filter(lead => dateInRange(lead.date));
  const quotes = state.quotes.filter(quote => dateInRange(quote.date));
  const won = quotes.filter(quote => quote.status === "Ganado").map(quote => ({ ...quote, ...calcQuote(quote) }));
  const lost = quotes.filter(quote => quote.status === "Perdido");
  const collections = collectionRows().filter(row => dateInRange(row.paidDate || row.dueDate));
  const expenses = state.expenses.filter(expense => dateInRange(monthDate(expense.month)));
  const team = state.team.filter(payment => dateInRange(monthDate(payment.month)));
  const revenue = won.reduce((sum, sale) => sum + sale.total, 0);
  const paid = collections.filter(row => row.status === "Pagado").reduce((sum, row) => sum + row.amount, 0);
  const pending = collections.filter(row => row.status !== "Pagado").reduce((sum, row) => sum + row.amount, 0);
  const outflows = expenses.reduce((sum, expense) => sum + expense.amount, 0) + team.reduce((sum, payment) => sum + payment.amount, 0);
  return { leads, quotes, won, lost, collections, expenses, team, revenue, paid, pending, outflows };
}

function currentMonthName() {
  return months[new Date().getMonth()];
}

function fmt(amount, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(amount || 0);
}

function fmtMixed(rows, valueFn, currencyFn = r => r.currency || "PEN") {
  const map = {};
  rows.forEach(r => { const c = currencyFn(r); map[c] = (map[c] || 0) + valueFn(r); });
  const parts = Object.entries(map).map(([c, v]) => fmt(v, c));
  return parts.length ? parts.join(" + ") : fmt(0);
}

function calcQuote(q, sourceState = state) {
  const igv = q.hasIgv ? q.subtotal * sourceState.settings.igvRate : 0;
  const total = q.subtotal + igv;
  const threshold = sourceState.settings.detractionThreshold ?? DETRACTION_THRESHOLD;
  const detraction = total > threshold && q.hasIgv ? total * sourceState.settings.detractionRate : 0;
  const commission = q.subtotal * sourceState.settings.commissionRate;
  return { igv, total, detraction, commission, netCash: total - detraction };
}

function wonQuotes() {
  return state.quotes.filter(q => q.status === "Ganado").map(q => ({ ...q, ...calcQuote(q) }));
}

function collectionRows() {
  return state.collections.map(c => {
    const quote = state.quotes.find(q => q.id === c.quoteId);
    return { ...c, quote, client: quote?.client || "Sin cotizacion", service: quote?.service || "", code: quote?.code || "-", currency: c.currency || quote?.currency || "PEN" };
  });
}

function totals() {
  const won = wonQuotes();
  const revenue = won.reduce((sum, s) => sum + s.total, 0);
  const detractions = won.reduce((sum, s) => sum + s.detraction, 0);
  const expenses = state.expenses.reduce((sum, e) => sum + e.amount, 0) + state.team.reduce((sum, t) => sum + t.amount, 0);
  const pending = state.collections.filter(r => r.status !== "Pagado").reduce((sum, r) => sum + r.amount, 0);
  const paid = state.collections.filter(r => r.status === "Pagado").reduce((sum, r) => sum + r.amount, 0);
  return { revenue, detractions, expenses, pending, paid, profit: revenue - expenses, quotes: state.quotes.length };
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeStatus(status) {
  return String(status || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
}

function nextQuoteCode() {
  const nums = state?.quotes?.map(q => Number(String(q.code).match(/\d+/)?.[0] || 0)).filter(Boolean) || [285];
  return `PPTO ${String(Math.max(...nums, 285) + 1).padStart(4, "0")}`;
}

function syncClientsFromActivity(targetState = state) {
  const names = new Set(targetState.clients.map(c => c.name.toLowerCase()));
  [...targetState.leads, ...targetState.quotes].forEach(item => {
    if (item.client && !names.has(item.client.toLowerCase())) {
      targetState.clients.push(newClient({ name: item.client, owner: item.owner || "Dante Trujillo" }));
      names.add(item.client.toLowerCase());
    }
  });
}

function syncQuoteSideEffects(targetState, q) {
  syncClientsFromActivity(targetState);
  if (q.leadId) {
    const lead = targetState.leads.find(item => item.id === q.leadId);
    if (lead) {
      lead.quoteId = q.id;
      if (q.status === "Ganado") lead.status = "Ganado";
      else if (q.status === "Perdido") lead.status = "Cerrado perdido";
      else if (q.status === "Cotizado") lead.status = "Cotizado";
      else lead.status = "Propuesta";
    }
  }
  if (q.status !== "Ganado") {
    targetState.collections = targetState.collections.filter(c => c.quoteId !== q.id);
    return;
  }
  const calc = calcQuote(q, targetState);
  const existing = targetState.collections.filter(c => c.quoteId === q.id);
  const parts = q.paymentType === "split" ? [0.5, 0.5] : q.paymentType === "thirds" ? [1/3, 1/3, 1/3] : [1];
  const totalParts = parts.length;
  const next = parts.map((part, index) => {
    const old = existing.find(c => c.part === index + 1) || {};
    const label = totalParts === 1 ? "Pago 100%" : `Pago ${index + 1}/${totalParts}`;
    const dueDateOffset = index * 30;
    return {
      id: old.id || uid(),
      quoteId: q.id,
      currency: q.currency || "PEN",
      part: index + 1,
      label,
      dueDate: old.dueDate || addDays(q.date, dueDateOffset),
      amount: calc.total * part,
      detraction: calc.detraction * part,
      status: old.status || (index === 0 ? "Facturado" : "Pendiente"),
      paidDate: old.paidDate || "",
      invoice: old.invoice || "",
      bankAccount: old.bankAccount || ""
    };
  });
  targetState.collections = targetState.collections.filter(c => c.quoteId !== q.id).concat(next);
}

function renderNav() {
  const nav = document.querySelector("#mainNav");
  nav.innerHTML = navItems.map(([id, label, iconName]) => `
    <button class="nav-btn ${id === activeView ? "active" : ""}" data-view="${id}" type="button">
      <span class="nav-icon">${icon(iconName)}</span><span>${label}</span>
    </button>
  `).join("");
  nav.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
    activeView = btn.dataset.view;
    render();
  }));
}

function render() {
  renderNav();
  syncProfileUI();
  const item = navItems.find(([id]) => id === activeView);
  viewRoot.innerHTML = `<h1 class="page-title">${item[1]}</h1>${views[activeView]()}`;
  bindViewEvents();
  drawCharts();
}

const views = {
  dashboard() {
    const snapshot = dashboardSnapshot();
    const openLeads = snapshot.leads.filter(l => !["Ganado", "Cerrado perdido"].includes(l.status));
    const opportunityAmount = openLeads.reduce((sum, lead) => sum + lead.estimatedValue, 0);
    const wonSales = snapshot.won;
    const lostSales = snapshot.lost;
    const lostAmount = lostSales.reduce((sum, quote) => sum + calcQuote(quote).total, 0);
    const upcoming = snapshot.collections.filter(r => r.status !== "Pagado").slice(0, 4);
    return `
      ${dashboardFilterBar()}
      <section class="metric-grid dashboard-metrics ${dashboardSections.has("metrics") ? "" : "hidden"}" data-dashboard-section="metrics">
        ${metric("Oportunidades", openLeads.length, `${snapshot.leads.length} registradas`, "up", "8%", "purple")}
        ${metric("Pipeline de oportunidades", fmtMixed(openLeads, l => l.estimatedValue), `${openLeads.length} oportunidades abiertas`, "up", "2%", "amber")}
        ${metric("Ventas ganadas", fmtMixed(snapshot.won, q => q.total), `${wonSales.length} cotizaciones ganadas`, "up", "12%", "mint")}
        ${metric("Ventas perdidas", fmtMixed(snapshot.lost, q => calcQuote(q).total, q => q.currency || "PEN"), `${lostSales.length} cotizaciones perdidas`, "down", "4%", "coral")}
      </section>
      <section class="dashboard-grid">
        <div class="panel chart-panel ${dashboardSections.has("revenue") ? "" : "hidden"}" data-dashboard-section="revenue">
          <div class="panel-head">
            <div><h3>Ingresos</h3><p>${fmtMixed(snapshot.won, q => q.total)} vendidos · ${fmtMixed(snapshot.collections.filter(r => r.status === "Pagado"), r => r.amount)} cobrado</p></div>
          </div>
          <canvas id="revenueChart" class="chart"></canvas>
        </div>
        <aside class="panel agenda-panel ${dashboardSections.has("collections") ? "" : "hidden"}" data-dashboard-section="collections">
          <div class="panel-head">
            <div><h3>Cobros proximos</h3><p>Seguimiento de clientes</p></div>
          </div>
          <div class="timeline">
            ${upcoming.length ? upcoming.map(r => `
              <div class="timeline-item">
                <small>${r.dueDate}</small>
                <strong>${r.client}</strong>
                <span>${r.label} · ${fmt(r.amount)}</span>
                ${badge(r.status)}
              </div>
            `).join("") : `<div class="empty-state">Sin cobros pendientes.</div>`}
          </div>
        </aside>
        <div class="panel ${dashboardSections.has("pipeline") ? "" : "hidden"}" data-dashboard-section="pipeline">
          <div class="panel-head"><div><h3>Pipeline comercial</h3><p>Estado de oportunidades</p></div></div>
          <div class="kanban-mini">
            ${miniStage("Nuevo", snapshot.leads.filter(l => l.status === "Nuevo").length)}
            ${miniStage("Propuesta", snapshot.leads.filter(l => l.status === "Propuesta").length)}
            ${miniStage("Cotizado", snapshot.quotes.filter(q => q.status === "Cotizado").length)}
            ${miniStage("Ganado", snapshot.won.length)}
          </div>
        </div>
        <div class="panel ${dashboardSections.has("profitability") ? "" : "hidden"}" data-dashboard-section="profitability">
          <div class="panel-head"><div><h3>Rentabilidad por servicio</h3><p>Ventas menos egresos</p></div></div>
          ${miniBars(group(snapshot.won, "category", q => q.total))}
        </div>
        <div class="panel ${dashboardSections.has("salesOwner") ? "" : "hidden"}" data-dashboard-section="salesOwner">
          <div class="panel-head"><div><h3>Ventas por comercial</h3><p>Rendimiento y base de comisiones</p></div></div>
          ${miniBars(group(snapshot.won, "owner", q => q.total))}
        </div>
      </section>
    `;
  },
  leads() {
    const leads = state.leads.filter(lead => dateInRange(lead.date));
    const openLeads = leads.filter(l => !["Ganado", "Cerrado perdido"].includes(l.status));
    return `
      <section class="metric-grid">
        ${metric("Leads abiertos", openLeads.length, "Aun no cerrados")}
        ${metric("Pipeline estimado", fmtMixed(openLeads, l => l.estimatedValue), "Oportunidades abiertas")}
        ${metric("Cotizados", leads.filter(l => l.quoteId).length, "Leads con PPTO vinculado")}
        ${metric("Fuentes activas", new Set(leads.map(l => l.source)).size, "Canales de adquisicion")}
      </section>
      ${moduleToolbar({
        search: "Buscar cliente, fuente o servicio",
        filters: `<select id="leadStatus">${options(["Todos"].concat(leadStatuses), "Todos")}</select>`,
        action: "lead"
      })}
      <div id="leadsTable">${leadsTable(leads)}</div>
    `;
  },
  quotes() {
    const quotes = state.quotes.filter(quote => dateInRange(quote.date));
    const quoteTotal = quotes.reduce((sum, quote) => sum + calcQuote(quote).total, 0);
    const won = quotes.filter(quote => quote.status === "Ganado");
    return `
      <section class="metric-grid">
        ${metric("Cotizaciones", quotes.length, "Propuestas en el periodo", "", "", "purple")}
        ${metric("Monto cotizado", fmt(quoteTotal), "Valor total con impuestos", "", "", "amber")}
        ${metric("Cotizaciones ganadas", won.length, `${fmt(won.reduce((sum, quote) => sum + calcQuote(quote).total, 0))} cerrados`, "", "", "mint")}
        ${metric("Conversión", `${quotes.length ? Math.round((won.length / quotes.length) * 100) : 0}%`, "Ganadas sobre cotizadas", "", "", "coral")}
      </section>
      ${moduleToolbar({
        search: "Buscar cliente, PPTO o servicio",
        filters: `<select id="quoteStatus"><option value="">Todos los estados</option>${options(quoteStatuses)}</select>`,
        action: "quote"
      })}
      <div id="quotesTable">${quotesTable(quotes)}</div>
    `;
  },
  clients() {
    const clients = state.clients.filter(client => [...state.leads, ...state.quotes].some(item =>
      item.client.toLowerCase() === client.name.toLowerCase() && dateInRange(item.date)
    ));
    const rows = clients.map(client => {
      const qs = state.quotes.filter(q => q.client.toLowerCase() === client.name.toLowerCase() && dateInRange(q.date));
      const won = qs.filter(q => q.status === "Ganado");
      const leads = state.leads.filter(l => l.client.toLowerCase() === client.name.toLowerCase() && dateInRange(l.date));
      return [client.name, client.contact || "-", client.email || "-", leads.length, qs.length, fmt(won.reduce((s, q) => s + calcQuote(q).total, 0)), clientActions(client.id)];
    });
    const clientRevenue = state.quotes.filter(q => q.status === "Ganado" && dateInRange(q.date)).reduce((sum, q) => sum + calcQuote(q).total, 0);
    const clientCollections = collectionRows().filter(row => dateInRange(row.paidDate || row.dueDate));
    return `
      <section class="metric-grid">
        ${metric("Clientes activos", clients.length, "Con actividad en el periodo", "", "", "purple")}
        ${metric("Nuevas oportunidades", state.leads.filter(l => dateInRange(l.date)).length, "Leads vinculados", "", "", "amber")}
        ${metric("Facturación", fmt(clientRevenue), "Ventas ganadas", "", "", "mint")}
        ${metric("Por cobrar", fmt(clientCollections.filter(r => r.status !== "Pagado").reduce((sum, r) => sum + r.amount, 0)), "Saldo pendiente", "", "", "coral")}
      </section>
      ${moduleToolbar({ search: "Buscar cliente, contacto o correo", action: "client" })}
      ${table(["Cliente", "Contacto", "Correo", "Leads", "Cotizaciones", "Facturacion", "Acciones"], rows)}`;
  },
  sales() {
    const sales = wonQuotes().filter(sale => dateInRange(sale.date));
    const salesTotal = sales.reduce((sum, sale) => sum + sale.total, 0);
    return `
      <section class="metric-grid">
        ${metric("Ventas ganadas", sales.length, "Cierres del periodo", "", "", "purple")}
        ${metric("Ingresos vendidos", fmt(salesTotal), "Total con IGV", "", "", "amber")}
        ${metric("Ticket promedio", fmt(sales.length ? salesTotal / sales.length : 0), "Promedio por venta", "", "", "mint")}
        ${metric("Comisiones", fmt(sales.reduce((sum, sale) => sum + sale.commission, 0)), "Base comercial", "", "", "coral")}
      </section>
      ${moduleToolbar({ search: "Buscar venta, cliente o servicio", action: "quote" })}
      ${table(["PPTO", "Cliente", "Servicio", "Subtotal", "IGV", "Total", "Detraccion", "Comision", "Moneda", "Acciones"], sales.map(s => {
      const cur = s.currency || "PEN";
      return [s.code, s.client, s.service, fmt(s.subtotal, cur), fmt(s.igv, cur), fmt(s.total, cur), fmt(s.detraction, cur), fmt(s.commission, cur), `<span class="currency-badge ${cur.toLowerCase()}">${cur}</span>`, `<button class="action-link" data-edit-quote="${s.id}" type="button">${icon("edit")}<span>Editar</span></button>`];
    }))}`;
  },
  collections() {
    const collections = collectionRows().filter(row => dateInRange(row.paidDate || row.dueDate));
    const paid = collections.filter(row => row.status === "Pagado");
    const pending = collections.filter(row => row.status !== "Pagado");
    const overdue = collections.filter(row => row.status === "Vencido");
    return `
      <section class="metric-grid">
        ${metric("Pendiente de cobro", fmt(pending.reduce((sum, row) => sum + row.amount, 0)), `${pending.length} cobros abiertos`, "", "", "purple")}
        ${metric("Cobrado", fmt(paid.reduce((sum, row) => sum + row.amount, 0)), `${paid.length} pagos recibidos`, "", "", "mint")}
        ${metric("Vencido", fmt(overdue.reduce((sum, row) => sum + row.amount, 0)), `${overdue.length} cobros vencidos`, "", "", "coral")}
        ${metric("Total gestionado", fmt(collections.reduce((sum, row) => sum + row.amount, 0)), `${collections.length} movimientos`, "", "", "amber")}
      </section>
      ${moduleToolbar({
        search: "Buscar cliente, PPTO o cobro",
        filters: `<select data-table-filter><option value="">Todos los estados</option>${options(paymentStatuses)}</select>`,
        action: "quote"
      })}
      ${table(["PPTO", "Cliente", "Pago", "Fecha PP", "Fecha RP", "Monto", "Detracción", "Factura", "Cuenta", "Moneda", "Estado", "Acciones"], collections.map(r => [
      r.code, r.client, r.label, r.dueDate, r.paidDate || "—", fmt(r.amount, r.currency), fmt(r.detraction, r.currency), r.invoice || "—", r.bankAccount || "—", `<span class="currency-badge ${(r.currency || "pen").toLowerCase()}">${r.currency || "PEN"}</span>`, badge(r.status), collectionActions(r)
    ]))}`;
  },
  finance() {
    const snapshot = dashboardSnapshot();
    const t = { revenue: snapshot.revenue, paid: snapshot.paid, expenses: snapshot.outflows };
    const paidRows = snapshot.collections.filter(row => row.status === "Pagado");
    return `
      <section class="metric-grid">
        ${metric("Ingresos vendidos", fmt(t.revenue), "Ventas ganadas")}
        ${metric("Cobrado", fmt(t.paid), "Caja efectiva registrada")}
        ${metric("Gastos + planilla", fmt(t.expenses), "Fijos, variables y equipo")}
        ${metric("Caja neta estimada", fmt(t.paid - t.expenses), "Cobrado menos egresos")}
      </section>
      ${moduleToolbar({ search: "Buscar ingreso, egreso o cliente", action: "expense" })}
      <section class="finance-sections">
        <div>
          <div class="section-heading"><h3>Ingresos cobrados</h3><span>${paidRows.length} movimientos</span></div>
          ${table(["Fecha", "Cliente", "PPTO", "Concepto", "Monto"], paidRows.map(row => [row.paidDate || row.dueDate, row.client, row.code, row.label, fmt(row.amount, row.currency)]))}
        </div>
        <div>
          <div class="section-heading"><h3>Egresos</h3><span>${snapshot.expenses.length} movimientos</span></div>
          ${table(["Mes", "Concepto", "Tipo", "Monto", "Estado", "Acciones"], snapshot.expenses.map(e => [e.month, e.concept, e.type, fmt(e.amount), badge(e.status), `<button class="action-link" data-edit-expense="${e.id}" type="button">${icon("edit")}<span>Editar</span></button>`]))}
        </div>
      </section>
    `;
  },
  taxes() {
    const won = wonQuotes().filter(item => dateInRange(item.date));
    const igv = won.reduce((sum, item) => sum + item.igv, 0);
    const detractions = won.reduce((sum, item) => sum + item.detraction, 0);
    return `
      <section class="metric-grid">
        ${metric("IGV generado", fmt(igv), `${Math.round(state.settings.igvRate * 100)}% en ventas con IGV`, "", "", "purple")}
        ${metric("Detracciones", fmt(detractions), `${Math.round(state.settings.detractionRate * 100)}% según regla`, "", "", "amber")}
        ${metric("Ventas afectas", won.filter(item => item.hasIgv).length, "Operaciones con IGV", "", "", "mint")}
        ${metric("Con detraccion", won.filter(item => item.detraction > 0).length, `Superan ${fmt(state.settings.detractionThreshold)}`, "", "", "coral")}
      </section>
      ${moduleToolbar({ search: "Buscar PPTO, cliente o impuesto", action: "taxPayment" })}
      ${table(["PPTO", "Cliente", "Subtotal", "IGV", "Total", "Detraccion"], won.map(item => [
        item.code, item.client, fmt(item.subtotal), fmt(item.igv), fmt(item.total), fmt(item.detraction)
      ]))}
    `;
  },
  team() {
    const team = state.team.filter(item => dateInRange(monthDate(item.month)));
    const paidTeam = team.filter(item => item.status === "Pagado");
    return `
      <section class="metric-grid">
        ${metric("Pagos registrados", team.length, "Movimientos del periodo", "", "", "purple")}
        ${metric("Total planilla", fmt(team.reduce((sum, item) => sum + item.amount, 0)), "Internos y especialistas", "", "", "amber")}
        ${metric("Pagado", fmt(paidTeam.reduce((sum, item) => sum + item.amount, 0)), `${paidTeam.length} pagos completados`, "", "", "mint")}
        ${metric("Pendiente", fmt(team.filter(item => item.status !== "Pagado").reduce((sum, item) => sum + item.amount, 0)), "Por desembolsar", "", "", "coral")}
      </section>
      ${moduleToolbar({
        search: "Buscar persona, rol o estado",
        filters: `<select data-table-filter><option value="">Todos los estados</option><option>Pagado</option><option>Pendiente</option></select>`,
        action: "payment"
      })}
      ${table(["Mes", "Nombre", "Tipo", "Pago", "Estado", "Acciones"], team.map(t => [t.month, t.name, t.role, fmt(t.amount), badge(t.status), `<button class="action-link" data-edit-team="${t.id}" type="button">${icon("edit")}<span>Editar</span></button>`]))}`;
  },
  settings() {
    return `
      <section class="metric-grid">
        ${metric("Meta mensual", fmt(state.settings.monthlyGoal), "Objetivo configurado", "", "", "purple")}
        ${metric("IGV", `${state.settings.igvRate * 100}%`, "Tasa aplicada", "", "", "amber")}
        ${metric("Detracción", `${state.settings.detractionRate * 100}%`, `Desde ${fmt(state.settings.detractionThreshold)}`, "", "", "mint")}
        ${metric("Comisión", `${state.settings.commissionRate * 100}%`, "Sobre subtotal sin IGV", "", "", "coral")}
      </section>
      <form id="settingsForm" class="settings-layout">
        <section class="panel settings-panel">
          <div class="panel-head"><div><h3>Reglas financieras</h3><p>Estos valores afectan los cálculos de toda la plataforma.</p></div></div>
          <div class="form-grid">
            <label>Meta mensual (S/)<input name="monthlyGoal" type="number" min="0" step="100" value="${state.settings.monthlyGoal}" required></label>
            <label>IGV (%)<input name="igvRate" type="number" min="0" max="100" step="0.01" value="${state.settings.igvRate * 100}" required></label>
            <label>Detracción (%)<input name="detractionRate" type="number" min="0" max="100" step="0.01" value="${state.settings.detractionRate * 100}" required></label>
            <label>Umbral de detracción (S/)<input name="detractionThreshold" type="number" min="0" step="1" value="${state.settings.detractionThreshold}" required></label>
            <label>Comisión comercial (%)<input name="commissionRate" type="number" min="0" max="100" step="0.01" value="${state.settings.commissionRate * 100}" required></label>
            <label>Moneda<select name="currency"><option value="PEN" ${state.settings.currency === "PEN" ? "selected" : ""}>Soles (PEN)</option><option value="USD" ${state.settings.currency === "USD" ? "selected" : ""}>Dólares (USD)</option></select></label>
          </div>
          <div class="settings-actions">
            <span id="settingsMessage" class="form-note"></span>
            <button class="primary-action" type="submit">${icon("check")}<span>Guardar configuración</span></button>
          </div>
        </section>
        <aside class="panel settings-summary">
          <h3>Flujo automatizado</h3>
          <p>Cuando una cotización se marca como ganada, Nebumia calcula impuestos y genera los cobros automáticamente.</p>
          <div class="split-list">
            ${alertItem("Cobranza", "Pago completo o modalidad 50% / 50%")}
            ${alertItem("Detracción", `Se aplica al superar ${fmt(state.settings.detractionThreshold)}`)}
            ${alertItem("Comisión", "Calculada sobre el subtotal sin IGV")}
          </div>
        </aside>
      </form>
      <section class="panel settings-panel" style="margin-top:1rem">
        <div class="panel-head"><div><h3>Cuentas bancarias</h3><p>Cuentas disponibles al registrar cobros (DEP. C. CORRIENTE).</p></div></div>
        <ul class="bank-accounts-list">
          ${(state.settings.bankAccounts || []).map((a, i) => `
            <li class="bank-account-item">
              <span>${a}</span>
              <button class="action-link danger" data-delete-bank="${i}" type="button">${icon("trash")}<span>Eliminar</span></button>
            </li>`).join("")}
        </ul>
        <form id="addBankAccountForm" class="form-grid" style="margin-top:1rem">
          <label class="full">Nueva cuenta<input name="accountName" placeholder="Ej: CC BCP S/" required></label>
          <div style="grid-column:1/-1;display:flex;justify-content:flex-end">
            <button class="primary-action" type="submit">${icon("plus")}<span>Agregar cuenta</span></button>
          </div>
        </form>
      </section>
    `;
  }
};

function metric(label, value, note, trend = "", trendValue = "", tone = "blue") {
  const toneIcon = { purple: "users", amber: "package", mint: "trending", coral: "clock", blue: "chart" }[tone] || "chart";
  const trendBadge = trend ? `<em class="trend ${trend}">${trend === "up" ? "▲" : "▼"} ${trendValue}</em>` : "";
  return `<article class="metric metric-${tone}"><div class="metric-top"><span>${label}</span>${trendBadge}</div><span class="metric-icon">${icon(toneIcon)}</span><strong>${value}</strong><small>${note}</small></article>`;
}

function alertItem(title, note) {
  return `<div class="list-item"><div><strong>${title}</strong><span>${note}</span></div></div>`;
}

function badge(status) {
  return `<span class="status ${normalizeStatus(status)}">${status}</span>`;
}

function table(headers, rows) {
  if (!rows.length) return `<div class="empty-state">Sin registros todavia.</div>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function leadsTable(rows) {
  return table(["Fecha", "Cliente", "Fuente", "Servicio", "Valor", "Estado", "Acciones"], rows.map(l => [
    l.date, l.client, `${l.source}<br><span class="muted">${l.channel}</span>`, l.service, fmt(l.estimatedValue, l.currency || "PEN"), badge(l.status), leadActions(l)
  ]));
}

function leadActions(l) {
  const quoteText = l.quoteId ? "Ver cotizacion" : "Cotizar";
  return `
    <div class="row-actions">
      <button class="action-link" data-edit-lead="${l.id}" type="button">${icon("edit")}<span>Editar</span></button>
      <button class="action-link" data-quote-lead="${l.id}" type="button">${icon("fileText")}<span>${quoteText}</span></button>
      <button class="action-link danger-link" data-close-lead="${l.id}" type="button">${icon("x")}<span>Cerrar perdido</span></button>
    </div>
  `;
}

function quotesTable(rows) {
  return table(["PPTO", "Mes", "Cliente", "Servicio", "Subtotal", "Total", "Moneda", "Estado", "Acciones"], rows.map(q => {
    const c = calcQuote(q);
    const cur = q.currency || "PEN";
    return [q.code, q.month, q.client, q.service, fmt(q.subtotal, cur), fmt(c.total, cur), `<span class="currency-badge ${cur.toLowerCase()}">${cur}</span>`, badge(q.status), quoteActions(q)];
  }));
}

function quoteActions(q) {
  return `
    <div class="row-actions">
      <button class="action-link" data-edit-quote="${q.id}" type="button">${icon("edit")}<span>Editar</span></button>
      ${q.status !== "Ganado" ? `<button class="action-link" data-win="${q.id}" type="button">${icon("check")}<span>Ganada</span></button>` : ""}
      ${q.status !== "Perdido" ? `<button class="action-link danger-link" data-lose="${q.id}" type="button">${icon("x")}<span>Perdida</span></button>` : ""}
    </div>
  `;
}

function clientActions(id) {
  return `<button class="action-link" data-edit-client="${id}" type="button">${icon("edit")}<span>Editar</span></button>`;
}

function collectionActions(r) {
  return `
    <div class="row-actions">
      <button class="action-link" data-edit-collection="${r.id}" type="button">${icon("edit")}<span>Editar</span></button>
      ${r.status !== "Pagado" ? `<button class="action-link" data-pay="${r.id}" type="button">${icon("creditCard")}<span>Marcar pagado</span></button>` : ""}
    </div>
  `;
}

function options(values, selected = "") {
  return values.map(value => `<option ${value === selected ? "selected" : ""}>${value}</option>`).join("");
}

function ruleCard(title, copy) {
  return `<article class="panel rule-card"><h4>${title}</h4><p>${copy}</p></article>`;
}

function miniBars(data) {
  const max = Math.max(...data.map(d => d.value), 1);
  return `<div class="split-list">${data.map(d => `
    <div>
      <div class="list-item"><strong>${d.label}</strong><span>${fmt(d.value)}</span></div>
      <div class="progress"><i style="width:${Math.max(8, d.value / max * 100)}%"></i></div>
    </div>`).join("")}</div>`;
}

function miniStage(label, count) {
  return `
    <article class="stage-card">
      <span>${label}</span>
      <strong>${count}</strong>
      <div class="progress"><i style="width:${Math.min(100, Math.max(10, count * 20))}%"></i></div>
    </article>
  `;
}

function group(rows, key, valueFn) {
  const map = new Map();
  rows.forEach(row => map.set(row[key], (map.get(row[key]) || 0) + valueFn(row)));
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function bindViewEvents() {
  bindFilters();
  bindDashboardDateFilter();
  bindDashboardQuickFilters();
  bindModuleToolbar();
  bindActions("[data-edit-lead]", id => openLeadDialog(state.leads.find(x => x.id === id)));
  bindActions("[data-quote-lead]", id => quoteLead(id));
  bindActions("[data-close-lead]", id => updateLeadStatus(id, "Cerrado perdido"));
  bindActions("[data-edit-quote]", id => openQuoteDialog(state.quotes.find(x => x.id === id)));
  bindActions("[data-win]", id => updateQuoteStatus(id, "Ganado"));
  bindActions("[data-lose]", id => updateQuoteStatus(id, "Perdido"));
  bindActions("[data-edit-client]", id => openClientDialog(state.clients.find(x => x.id === id)));
  bindActions("[data-edit-collection]", id => openCollectionDialog(state.collections.find(x => x.id === id)));
  bindActions("[data-pay]", id => markCollectionPaid(id));
  bindActions("[data-edit-expense]", id => openExpenseDialog(state.expenses.find(x => x.id === id)));
  bindActions("[data-edit-team]", id => openTeamDialog(state.team.find(x => x.id === id)));
  const settingsForm = document.querySelector("#settingsForm");
  if (settingsForm) settingsForm.addEventListener("submit", saveSettings);
  const addBankForm = document.querySelector("#addBankAccountForm");
  if (addBankForm) addBankForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("accountName").trim();
    if (name && !state.settings.bankAccounts.includes(name)) {
      state.settings.bankAccounts = [...(state.settings.bankAccounts || []), name];
      saveState();
      render();
    }
  });
  document.querySelectorAll("[data-delete-bank]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.getAttribute("data-delete-bank"));
    state.settings.bankAccounts = state.settings.bankAccounts.filter((_, idx) => idx !== i);
    saveState();
    render();
  }));
}

function bindDashboardQuickFilters() {
  if (activeView !== "dashboard") return;
  const allSections = ["metrics", "revenue", "collections", "pipeline", "profitability", "salesOwner"];
  const presets = {
    all: allSections,
    commercial: ["metrics", "pipeline", "salesOwner"],
    finance: ["metrics", "revenue", "collections", "profitability"]
  };

  document.querySelectorAll("[data-dashboard-preset]").forEach(button => {
    button.addEventListener("click", () => {
      dashboardSections = new Set(presets[button.dataset.dashboardPreset] || allSections);
      render();
    });
  });

  document.querySelectorAll("[data-saved-dashboard-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const filter = dashboardSavedFilters.find(item => item.id === button.dataset.savedDashboardFilter);
      if (!filter) return;
      dashboardSections = new Set(filter.sections);
      render();
    });
  });

  const builder = document.querySelector("#dashboardFilterBuilder");
  document.querySelector("#createDashboardFilter")?.addEventListener("click", () => builder.classList.toggle("hidden"));
  document.querySelector("#closeDashboardFilter")?.addEventListener("click", () => builder.classList.add("hidden"));
  document.querySelector("#saveDashboardFilter")?.addEventListener("click", () => {
    const name = document.querySelector("#dashboardFilterName").value.trim();
    const sections = [...builder.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
    if (!name || !sections.length) return;
    dashboardSavedFilters.push({ id: uid(), name, sections });
    localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(dashboardSavedFilters));
    dashboardSections = new Set(sections);
    render();
  });
}

function bindDashboardDateFilter() {
  const trigger = document.querySelector("#dateFilterBtn");
  const popover = document.querySelector("#dateFilterPopover");
  if (!trigger || !popover) return;

  const close = () => {
    popover.classList.add("hidden");
    trigger.setAttribute("aria-expanded", "false");
  };

  trigger.addEventListener("click", () => {
    const willOpen = popover.classList.contains("hidden");
    popover.classList.toggle("hidden", !willOpen);
    trigger.setAttribute("aria-expanded", String(willOpen));
  });

  document.querySelector("#closeDateFilter").addEventListener("click", close);
  document.querySelector("#resetDateFilter").addEventListener("click", () => {
    dashboardRange = getDashboardPreset("thisYear");
    render();
  });

  document.querySelectorAll("[data-date-preset]").forEach(button => {
    button.addEventListener("click", () => {
      dashboardRange = getDashboardPreset(button.dataset.datePreset);
      render();
    });
  });

  document.querySelector("#applyDateFilter").addEventListener("click", () => {
    const start = document.querySelector("#dashboardStartDate").value;
    const end = document.querySelector("#dashboardEndDate").value;
    const error = document.querySelector("#dateFilterError");
    if (!start || !end) {
      error.textContent = "Selecciona ambas fechas.";
      return;
    }
    if (start > end) {
      error.textContent = "La fecha inicial no puede ser posterior a la fecha final.";
      return;
    }
    dashboardRange = { key: "custom", start, end, label: "Rango personalizado" };
    render();
  });
}

function saveSettings(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  state.settings = {
    ...state.settings,
    monthlyGoal: Number(data.monthlyGoal),
    igvRate: Number(data.igvRate) / 100,
    detractionRate: Number(data.detractionRate) / 100,
    detractionThreshold: Number(data.detractionThreshold),
    commissionRate: Number(data.commissionRate) / 100,
    currency: data.currency
  };
  state.quotes.forEach(quote => syncQuoteSideEffects(state, quote));
  saveState();
  render();
  const message = document.querySelector("#settingsMessage");
  if (message) message.textContent = "Configuración guardada correctamente.";
}

function bindActions(selector, handler) {
  document.querySelectorAll(selector).forEach(btn => btn.addEventListener("click", () => handler(btn.getAttribute(selector.slice(1, -1)))));
}

function bindFilters() {
  const quoteSearch = activeView === "quotes" ? document.querySelector("#moduleSearch") : null;
  const quoteStatus = document.querySelector("#quoteStatus");
  if (quoteSearch && quoteStatus) {
    const filter = () => {
      const term = quoteSearch.value.toLowerCase();
      const rows = state.quotes.filter(q => dateInRange(q.date) && (!quoteStatus.value || q.status === quoteStatus.value) && [q.code, q.client, q.service].join(" ").toLowerCase().includes(term));
      document.querySelector("#quotesTable").innerHTML = quotesTable(rows);
      bindViewEvents();
    };
    quoteSearch.addEventListener("input", filter);
    quoteStatus.addEventListener("change", filter);
  }
  const leadSearch = activeView === "leads" ? document.querySelector("#moduleSearch") : null;
  const leadStatus = document.querySelector("#leadStatus");
  if (leadSearch && leadStatus) {
    const filter = () => {
      const term = leadSearch.value.toLowerCase();
      const rows = state.leads.filter(l => dateInRange(l.date) && (leadStatus.value === "Todos" || l.status === leadStatus.value) && [l.client, l.source, l.service].join(" ").toLowerCase().includes(term));
      document.querySelector("#leadsTable").innerHTML = leadsTable(rows);
      bindViewEvents();
    };
    leadSearch.addEventListener("input", filter);
    leadStatus.addEventListener("change", filter);
  }
}

function bindModuleToolbar() {
  const search = document.querySelector("#moduleSearch");
  const tableFilter = document.querySelector("[data-table-filter]");
  const filterTableRows = () => {
    const term = search?.value.trim().toLowerCase() || "";
    const status = tableFilter?.value.toLowerCase() || "";
    document.querySelectorAll(".table-wrap tbody tr").forEach(row => {
      const text = row.textContent.toLowerCase();
      row.hidden = !text.includes(term) || (status && !text.includes(status));
    });
  };

  if (search && !["leads", "quotes"].includes(activeView)) {
    search.addEventListener("input", () => {
      if (activeView !== "dashboard") return filterTableRows();
      const term = search.value.trim().toLowerCase();
      document.querySelectorAll(".dashboard-metrics .metric, .dashboard-grid .panel").forEach(item => {
        item.hidden = !item.textContent.toLowerCase().includes(term);
      });
    });
  }
  tableFilter?.addEventListener("change", filterTableRows);

  document.querySelector("[data-module-action]")?.addEventListener("click", event => {
    const action = event.currentTarget.dataset.moduleAction;
    if (action === "leads") openLeadDialog();
    else if (action === "clients") openClientDialog();
    else if (action === "finance") openExpenseDialog();
    else if (action === "team") openTeamDialog();
    else if (action === "taxes") openTaxPaymentDialog();
    else openQuoteDialog();
  });

  document.querySelector("[data-export-state]")?.addEventListener("click", exportState);
  document.querySelector("[data-import-state]")?.addEventListener("click", importState);
}

function exportState() {
  const payload = JSON.stringify({ product: "Nebumia", exportedAt: new Date().toISOString(), state }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nebumia-respaldo-${today()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importState() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const parsed = JSON.parse(reader.result);
        state = migrateState(parsed.state || parsed);
        saveState();
        render();
        alert("Respaldo importado correctamente.");
      } catch {
        alert("El archivo no contiene un respaldo válido de Nebumia.");
      }
    });
    reader.readAsText(file);
  });
  input.click();
}

function updateLeadStatus(id, status) {
  const lead = state.leads.find(l => l.id === id);
  if (!lead) return;
  lead.status = status;
  saveState();
  render();
}

function updateQuoteStatus(id, status) {
  const q = state.quotes.find(item => item.id === id);
  if (!q) return;
  q.status = status;
  syncQuoteSideEffects(state, q);
  saveState();
  render();
}

function markCollectionPaid(id) {
  const row = state.collections.find(c => c.id === id);
  if (!row) return;
  row.status = "Pagado";
  row.paidDate = today();
  saveState();
  render();
}

function quoteLead(id) {
  const lead = state.leads.find(l => l.id === id);
  if (!lead) return;
  if (lead.quoteId) {
    activeView = "quotes";
    render();
    return;
  }
  openQuoteDialog(newQuote({
    leadId: lead.id,
    client: lead.client,
    service: lead.service,
    owner: lead.owner,
    subtotal: lead.estimatedValue,
    status: "Por cotizar"
  }), true);
}

function dialogShell(type, title, body, submitText = "Guardar") {
  editingType = type;
  quoteForm.innerHTML = `
    <div class="dialog-head">
      <div><p class="eyebrow">${type}</p><h3>${title}</h3></div>
      <button class="icon-button" data-close-dialog aria-label="Cerrar" type="button">x</button>
    </div>
    ${body}
    <div class="dialog-actions">
      <button class="secondary-action" data-close-dialog type="button">Cancelar</button>
      <button class="primary-action" value="default" type="submit">${submitText}</button>
    </div>
  `;
  bindDialogCloseControls(quoteDialog);
  quoteDialog.showModal();
}

function bindDialogCloseControls(dialog) {
  dialog.querySelectorAll("[data-close-dialog]").forEach(button => {
    button.onclick = () => dialog.close();
  });
}

function setupDialogs() {
  document.querySelectorAll("dialog").forEach(dialog => {
    bindDialogCloseControls(dialog);
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
  });
}

function openLeadDialog(lead = null) {
  const item = lead || newLead();
  editingId = lead && state.leads.some(l => l.id === lead.id) ? lead.id : "";
  dialogShell("lead", editingId ? "Editar lead" : "Nuevo lead", `
    <div class="form-grid">
      <label>Fecha<input name="date" type="date" value="${item.date}" required></label>
      <label>Cliente<input name="client" value="${escapeAttr(item.client)}" required></label>
      <label>Contacto<input name="contact" value="${escapeAttr(item.contact)}"></label>
      <label>Fuente<input name="source" value="${escapeAttr(item.source)}" required></label>
      <label>Canal<input name="channel" value="${escapeAttr(item.channel)}"></label>
      <label>Comercial<input name="owner" value="${escapeAttr(item.owner)}" required></label>
      <label class="full">Servicio<input name="service" value="${escapeAttr(item.service)}" required></label>
      <label>Valor estimado<input name="estimatedValue" type="number" min="0" step="0.01" value="${item.estimatedValue}" required></label>
      <label>Moneda<select name="currency"><option value="PEN" ${(item.currency || "PEN") === "PEN" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${item.currency === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
      <label>Estado<select name="status">${options(leadStatuses, item.status)}</select></label>
      <label class="full">Notas<textarea name="notes" rows="3">${escapeHtml(item.notes)}</textarea></label>
    </div>
  `);
}

function openQuoteDialog(q = null, isNewFromLead = false) {
  const item = q || newQuote();
  editingId = !isNewFromLead && q && state.quotes.some(existing => existing.id === q.id) ? q.id : "";
  dialogShell("quote", editingId ? "Editar cotizacion" : "Nueva cotizacion", `
    <div class="form-grid">
      <label>PPTO<input name="code" value="${escapeAttr(item.code || nextQuoteCode())}" required></label>
      <label>Fecha<input name="date" type="date" value="${item.date}" required></label>
      <label>Mes<select name="month">${options(months, item.month)}</select></label>
      <label>Categoria<input name="category" value="${escapeAttr(item.category)}" required></label>
      <label>Cliente<input name="client" value="${escapeAttr(item.client)}" required></label>
      <label>Comercial<input name="owner" value="${escapeAttr(item.owner)}" required></label>
      <label class="full">Servicio<input name="service" value="${escapeAttr(item.service)}" required></label>
      <label>Monto sin IGV<input name="subtotal" type="number" min="0" step="0.01" value="${item.subtotal}" required></label>
      <label>Moneda<select name="currency"><option value="PEN" ${(item.currency || "PEN") === "PEN" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${item.currency === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
      <label>Estado<select name="status">${options(quoteStatuses, item.status)}</select></label>
      <label>Tipo de pago<select name="paymentType"><option value="split" ${item.paymentType === "split" ? "selected" : ""}>50% / 50%</option><option value="thirds" ${item.paymentType === "thirds" ? "selected" : ""}>3 cuotas (33/33/33)</option><option value="full" ${item.paymentType === "full" ? "selected" : ""}>100%</option></select></label>
      <label class="check-row"><input name="hasIgv" type="checkbox" ${item.hasIgv ? "checked" : ""}> Aplica IGV</label>
      <input name="leadId" type="hidden" value="${escapeAttr(item.leadId || "")}">
      <label class="full">Repositorio<input name="repo" value="${escapeAttr(item.repo)}" placeholder="https://drive.google.com/..."></label>
      <label class="full">Comentarios<textarea name="comments" rows="3">${escapeHtml(item.comments)}</textarea></label>
    </div>
  `);
}

function openClientDialog(client = null) {
  const item = client || newClient();
  editingId = client && state.clients.some(c => c.id === client.id) ? client.id : "";
  dialogShell("client", editingId ? "Editar cliente" : "Nuevo cliente", `
    <div class="form-grid">
      <label>Cliente<input name="name" value="${escapeAttr(item.name)}" required></label>
      <label>RUC<input name="ruc" value="${escapeAttr(item.ruc)}"></label>
      <label>Contacto<input name="contact" value="${escapeAttr(item.contact)}"></label>
      <label>Correo<input name="email" type="email" value="${escapeAttr(item.email)}"></label>
      <label>Telefono<input name="phone" value="${escapeAttr(item.phone)}"></label>
      <label>Comercial<input name="owner" value="${escapeAttr(item.owner)}"></label>
      <label class="full">Notas<textarea name="notes" rows="3">${escapeHtml(item.notes)}</textarea></label>
    </div>
  `);
}

function openCollectionDialog(row) {
  if (!row) return;
  editingId = row.id;
  dialogShell("collection", "Editar cobro", `
    <div class="form-grid">
      <label>Fecha PP (vencimiento)<input name="dueDate" type="date" value="${row.dueDate}" required></label>
      <label>Fecha RP (cobrado)<input name="paidDate" type="date" value="${row.paidDate || ""}"></label>
      <label>Monto<input name="amount" type="number" step="0.01" value="${row.amount}" required></label>
      <label>Detracción<input name="detraction" type="number" step="0.01" value="${row.detraction}"></label>
      <label>Estado<select name="status">${options(paymentStatuses, row.status)}</select></label>
      <label>Factura<input name="invoice" value="${escapeAttr(row.invoice)}" placeholder="F001-000..."></label>
      <label class="full">Cuenta (DEP. C. CORRIENTE)<select name="bankAccount"><option value="">— Sin cuenta —</option>${(state.settings.bankAccounts || []).map(a => `<option value="${escapeAttr(a)}" ${row.bankAccount === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>
    </div>
  `);
}

function openExpenseDialog(expense = null) {
  const item = expense || newExpense();
  editingId = expense && state.expenses.some(e => e.id === expense.id) ? expense.id : "";
  dialogShell("expense", editingId ? "Editar gasto" : "Nuevo gasto", `
    <div class="form-grid">
      <label>Mes<select name="month">${options(months, item.month)}</select></label>
      <label>Tipo<input name="type" value="${escapeAttr(item.type)}" required></label>
      <label class="full">Concepto<input name="concept" value="${escapeAttr(item.concept)}" required></label>
      <label>Monto<input name="amount" type="number" step="0.01" value="${item.amount}" required></label>
      <label>Estado<select name="status">${options(["Pendiente", "Completado"], item.status)}</select></label>
      <label>Encargado<input name="owner" value="${escapeAttr(item.owner)}"></label>
    </div>
  `);
}

function openTaxPaymentDialog() {
  const item = newExpense({
    type: "Pago de impuestos",
    concept: "Pago de IGV / detracción",
    owner: "Bandu"
  });
  editingId = "";
  dialogShell("taxPayment", "Nuevo pago de impuestos", `
    <div class="form-grid">
      <label>Mes<select name="month">${options(months, item.month)}</select></label>
      <label>Tipo de impuesto<select name="type">${options(["IGV", "Detracción", "Renta", "Otro"], "IGV")}</select></label>
      <label class="full">Concepto<input name="concept" value="${escapeAttr(item.concept)}" required></label>
      <label>Monto<input name="amount" type="number" min="0" step="0.01" value="${item.amount}" required></label>
      <label>Estado<select name="status">${options(["Pendiente", "Completado"], item.status)}</select></label>
      <label>Encargado<input name="owner" value="${escapeAttr(item.owner)}"></label>
    </div>
  `);
}

function openTeamDialog(payment = null) {
  const item = payment || newTeamPayment();
  editingId = payment && state.team.some(t => t.id === payment.id) ? payment.id : "";
  dialogShell("team", editingId ? "Editar pago" : "Nuevo pago", `
    <div class="form-grid">
      <label>Mes<select name="month">${options(months, item.month)}</select></label>
      <label>Nombre<input name="name" value="${escapeAttr(item.name)}" required></label>
      <label>Tipo<input name="role" value="${escapeAttr(item.role)}" required></label>
      <label>Pago<input name="amount" type="number" step="0.01" value="${item.amount}" required></label>
      <label>Estado<select name="status">${options(["Pendiente", "Pagado"], item.status)}</select></label>
      <label>RHE / soporte<input name="receipt" value="${escapeAttr(item.receipt)}"></label>
    </div>
  `);
}

function handleEntitySubmit(event) {
  if (event.submitter.value === "cancel") return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  if (editingType === "lead") saveLead(data);
  if (editingType === "quote") saveQuote(data);
  if (editingType === "client") saveClient(data);
  if (editingType === "collection") saveCollection(data);
  if (editingType === "expense") saveExpense(data);
  if (editingType === "taxPayment") saveTaxPayment(data);
  if (editingType === "team") saveTeam(data);
  saveState();
  quoteDialog.close();
  render();
}

function saveLead(data) {
  const item = newLead(data);
  if (editingId) state.leads = state.leads.map(l => l.id === editingId ? { ...l, ...item, id: editingId, quoteId: l.quoteId } : l);
  else state.leads.unshift(item);
  syncClientsFromActivity();
  activeView = "leads";
}

function saveQuote(data) {
  const item = newQuote({ ...data, subtotal: Number(data.subtotal), hasIgv: data.hasIgv === "on" });
  if (editingId) state.quotes = state.quotes.map(q => q.id === editingId ? { ...q, ...item, id: editingId } : q);
  else state.quotes.unshift(item);
  const saved = editingId ? state.quotes.find(q => q.id === editingId) : state.quotes[0];
  syncQuoteSideEffects(state, saved);
  activeView = "quotes";
}

function saveClient(data) {
  const item = newClient(data);
  if (editingId) state.clients = state.clients.map(c => c.id === editingId ? { ...c, ...item, id: editingId } : c);
  else state.clients.unshift(item);
  activeView = "clients";
}

function saveCollection(data) {
  state.collections = state.collections.map(c => c.id === editingId ? { ...c, ...data, amount: Number(data.amount), detraction: Number(data.detraction || 0), bankAccount: data.bankAccount || "" } : c);
  activeView = "collections";
}

function saveExpense(data) {
  const item = newExpense(data);
  if (editingId) state.expenses = state.expenses.map(e => e.id === editingId ? { ...e, ...item, id: editingId } : e);
  else state.expenses.unshift(item);
  activeView = "finance";
}

function saveTaxPayment(data) {
  state.expenses.unshift(newExpense({ ...data, type: `Impuesto: ${data.type}` }));
  activeView = "taxes";
}

function saveTeam(data) {
  const item = newTeamPayment(data);
  if (editingId) state.team = state.team.map(t => t.id === editingId ? { ...t, ...item, id: editingId } : t);
  else state.team.unshift(item);
  activeView = "team";
}

function escapeHtml(text = "") {
  return String(text).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

function escapeAttr(text = "") {
  return escapeHtml(text);
}

function drawCharts() {
  const canvas = document.querySelector("#revenueChart");
  if (!canvas) return;
  const ratio = devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const snapshot = dashboardSnapshot();
  const periods = [];
  const cursor = new Date(parseDate(dashboardRange.start).getFullYear(), parseDate(dashboardRange.start).getMonth(), 1);
  const last = new Date(parseDate(dashboardRange.end).getFullYear(), parseDate(dashboardRange.end).getMonth(), 1);
  while (cursor <= last && periods.length < 12) {
    periods.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("es-PE", { month: "short" }).format(cursor).replace(".", "")
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const labels = periods.map(period => period.label);
  const values = periods.map(period => snapshot.won
    .filter(quote => quote.date.startsWith(period.key))
    .reduce((sum, quote) => sum + quote.total, 0));
  const max = Math.max(...values, state.settings.monthlyGoal) * 1.15;
  const pad = 34;
  ctx.strokeStyle = "#dde5ec";
  ctx.beginPath();
  ctx.moveTo(pad, rect.height - pad);
  ctx.lineTo(rect.width - 10, rect.height - pad);
  ctx.stroke();
  labels.forEach((m, i) => {
    const divisor = Math.max(labels.length - 1, 1);
    const x = labels.length === 1 ? rect.width / 2 : pad + i * ((rect.width - pad - 20) / divisor);
    const h = (values[i] / max) * (rect.height - 70);
    ctx.fillStyle = "#4f7cff";
    ctx.fillRect(x - 15, rect.height - pad - h, 30, h);
    ctx.fillStyle = "#657286";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(m, x - 11, rect.height - 10);
  });
  const goalY = rect.height - pad - (state.settings.monthlyGoal / max) * (rect.height - 70);
  ctx.strokeStyle = "#ff8a7a";
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(pad, goalY);
  ctx.lineTo(rect.width - 10, goalY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ff8a7a";
  ctx.fillText("Meta mensual", pad, goalY - 8);
}

document.querySelector("#loginForm").addEventListener("submit", event => {
  event.preventDefault();
  const credentials = auth();
  const email = document.querySelector("#email").value;
  const password = document.querySelector("#password").value;

  if (authMode === "forgot") {
    authHint.textContent = `Listo. Enviaremos instrucciones a ${email}.`;
    setTimeout(() => setAuthMode("login"), 1200);
    return;
  }

  if (email === credentials.email && password === credentials.password) {
    localStorage.setItem(SESSION_KEY, "active");
    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    render();
  } else {
    alert("Credenciales incorrectas.");
  }
});

document.querySelector("#changePasswordBtn").addEventListener("click", () => passwordDialog.showModal());
profileMenuBtn.addEventListener("click", () => {
  const isOpen = !profileDropdown.classList.contains("hidden");
  profileDropdown.classList.toggle("hidden", isOpen);
  profileMenuBtn.setAttribute("aria-expanded", String(!isOpen));
});
editProfileBtn.addEventListener("click", () => {
  const current = auth();
  profileForm.elements.profileName.value = current.name || "Administrador";
  profileForm.elements.profileEmail.value = current.email || "admin@bandu.pe";
  document.querySelector("#profileMessage").textContent = "";
  profileDropdown.classList.add("hidden");
  profileDialog.showModal();
});
profileLogoutBtn.addEventListener("click", logout);
document.addEventListener("click", event => {
  if (!event.target.closest(".profile-menu")) {
    profileDropdown.classList.add("hidden");
    profileMenuBtn.setAttribute("aria-expanded", "false");
  }
});
forgotPasswordBtn.addEventListener("click", () => setAuthMode("forgot"));
themeToggleBtn.addEventListener("click", () => {
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
});
quoteForm.addEventListener("submit", handleEntitySubmit);

document.querySelector("#passwordForm").addEventListener("submit", event => {
  if (event.submitter.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const next = form.get("newPassword");
  const confirm = form.get("confirmPassword");
  const message = document.querySelector("#passwordMessage");
  if (next !== confirm) {
    message.textContent = "Las contrasenas no coinciden.";
    return;
  }
  saveAuth({ password: next });
  message.textContent = "Contrasena actualizada.";
  setTimeout(() => passwordDialog.close(), 500);
});

profileForm.addEventListener("submit", event => {
  if (event.submitter.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  saveAuth({ name: form.get("profileName"), email: form.get("profileEmail") });
  syncProfileUI();
  document.querySelector("#email").value = form.get("profileEmail");
  document.querySelector("#profileMessage").textContent = "Perfil actualizado.";
  setTimeout(() => profileDialog.close(), 500);
});

applyTheme(localStorage.getItem(THEME_KEY) || "light");
setAuthMode("login");
syncProfileUI();
setupDialogs();
if (localStorage.getItem(SESSION_KEY) === "active") {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  render();
}
