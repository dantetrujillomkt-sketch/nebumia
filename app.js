// ── SUPABASE ─────────────────────────────────────────────
const SUPABASE_URL = "https://avjthwvppogqezlljksz.supabase.co";
const SUPABASE_KEY = "sb_publishable_UhsLakmDIvELDC0Ori-PFg_NHvd-iQs";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let sbUser = null;

function toSnake(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj))
    out[k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)] = v;
  return out;
}
function toCamel(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj))
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  return out;
}

// Columns that exist in Supabase for each table (prevents unknown-column upsert errors)
const SB_COLS = {
  clients:       ["id","name","ruc","date","contact","email","phone","client_type","country","owner","source","notes"],
  leads:         ["id","name","client","contact","service","source","channel","owner","status","estimated_value","date","notes","quote_id"],
  quotes:        ["id","code","lead_id","month","client","service","category","owner","subtotal","has_igv","status","payment_type","currency","date","won_date","repo","comments","cuotas","invoice","bank_account"],
  expenses:      ["id","date","concept","type","amount","currency","status","owner","refund","is_ad_spend","vendor","ruc","invoice","category","doc_link"],
  team_payments: ["id","month","name","role","amount","status","receipt","due_date","ruc","currency","bank_name","account_number","cci","comm_invoice","comm_repo"],
  tax_payments:  ["id","date","type","period","amount","status","sunat_ref","doc_link"],
  purchases:     ["id","date","vendor","ruc","invoice_type","invoice_num","concept","subtotal","igv","total","currency","detraction","paid_date","bank_account","declared","repo"],
  invoiced_sales:["id","date","client","ruc","invoice_type","invoice_num","service","subtotal","igv","total","currency","quote_id","part"],
  cash_entries:  ["id","date","type","concept","category","amount","currency","status","bank_account","notes","invoice"],
  collections:   ["id","quote_id","part","label","due_date","amount","detraction","currency","status","paid_date","invoice","bank_account","declared","repo"],
  declaraciones: ["id","period","igv1011","renta3121","otro","otro_concepto","status","notes"],
};

async function sbSyncTable(table, records) {
  if (!sbUser) return;
  const uid = sbUser.id;
  const allowed = new Set(SB_COLS[table] || []);
  const rows = records.map(r => {
    const snake = toSnake(r);
    const filtered = { user_id: uid };
    for (const [k, v] of Object.entries(snake)) {
      if (allowed.has(k)) filtered[k] = v;
    }
    return filtered;
  });
  const { data: existing } = await sb.from(table).select("id").eq("user_id", uid);
  const dbIds = new Set((existing || []).map(r => r.id));
  const localIds = new Set(rows.map(r => r.id));
  const toDelete = [...dbIds].filter(id => !localIds.has(id));
  if (toDelete.length) await sb.from(table).delete().in("id", toDelete);
  if (rows.length) {
    const { error } = await sb.from(table).upsert(rows, { onConflict: "id" });
    if (error) console.error(`sbSyncTable(${table}):`, error.message);
  }
}

async function sbSyncSettings() {
  if (!sbUser) return;
  const s = state.settings;
  const base = {
    user_id: sbUser.id,
    igv_rate: s.igvRate, detraction_rate: s.detractionRate,
    detraction_threshold: s.detractionThreshold, commission_rate: s.commissionRate,
    currency: s.currency, bank_accounts: s.bankAccounts || [],
    fixed_expenses: s.fixedExpenses || [], team_members: s.teamMembers || [],
    services: state.services || [], categories: state.categories || [],
    sources: state.sources || [], profiles: state.profiles || [],
    vendors: state.vendors || [],
    updated_at: new Date().toISOString()
  };
  const { error } = await sb.from("settings").upsert({ ...base, saldos_iniciales: s.saldosIniciales || [], detraction_account: s.detractionAccount || "Detracciones", collection_det_modes: s.collectionDetModes || {}, tax_payment_collections: s.taxPaymentCollections || {}, fixed_expense_overrides: s.fixedExpenseOverrides || {} }, { onConflict: "user_id" });
  if (error) await sb.from("settings").upsert(base, { onConflict: "user_id" });
}

async function sbSyncSalesTargets() {
  if (!sbUser) return;
  const all = getSalesTargets();
  for (const [year, d] of Object.entries(all)) {
    await sb.from("sales_targets").upsert({
      user_id: sbUser.id, year: Number(year),
      mode: d.mode || "annual", annual_pen: d.annualPEN || 0,
      annual_usd: d.annualUSD || 0, monthly: d.monthly || {}
    }, { onConflict: "user_id,year" });
  }
}

async function sbSync() {
  await Promise.all([
    sbSyncTable("clients", state.clients),
    sbSyncTable("leads", state.leads),
    sbSyncTable("quotes", state.quotes),
    sbSyncTable("collections", state.collections),
    sbSyncTable("expenses", state.expenses),
    sbSyncTable("team_payments", state.team),
    sbSyncTable("tax_payments", state.taxPayments),
    sbSyncTable("purchases", state.purchases),
    sbSyncTable("invoiced_sales", state.invoicedSales),
    sbSyncTable("cash_entries", state.cashEntries),
    sbSyncTable("declaraciones", state.declaraciones),
    sbSyncSettings(),
    sbSyncSalesTargets(),
  ]);
}

async function sbLoad() {
  const uid = sbUser.id;
  const [
    { data: clients }, { data: leads }, { data: quotes }, { data: collections },
    { data: expenses }, { data: team }, { data: taxPayments }, { data: purchases },
    { data: invoicedSales }, { data: cashEntries }, { data: declaraciones },
    { data: settings }, { data: salesTargets }
  ] = await Promise.all([
    sb.from("clients").select("*").eq("user_id", uid),
    sb.from("leads").select("*").eq("user_id", uid),
    sb.from("quotes").select("*").eq("user_id", uid),
    sb.from("collections").select("*").eq("user_id", uid),
    sb.from("expenses").select("*").eq("user_id", uid),
    sb.from("team_payments").select("*").eq("user_id", uid),
    sb.from("tax_payments").select("*").eq("user_id", uid),
    sb.from("purchases").select("*").eq("user_id", uid),
    sb.from("invoiced_sales").select("*").eq("user_id", uid),
    sb.from("cash_entries").select("*").eq("user_id", uid),
    sb.from("declaraciones").select("*").eq("user_id", uid),
    sb.from("settings").select("*").eq("user_id", uid).maybeSingle(),
    sb.from("sales_targets").select("*").eq("user_id", uid),
  ]);

  // If Supabase is completely empty but localStorage has data, push local → Supabase instead of wiping
  const sbEmpty = ![clients,leads,quotes,collections,expenses,team,taxPayments,purchases,invoicedSales,cashEntries].some(a => a?.length);
  if (sbEmpty && !settings) {
    const local = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } })();
    const localHasData = local && [local.clients,local.leads,local.quotes,local.expenses].some(a => a?.length);
    if (localHasData) {
      state = migrateState(local);
      sbSync().catch(e => console.error("sbLoad fallback sync:", e));
      return;
    }
  }
  const base = seedState();
  const localSnap = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.settings || {}; } catch { return {}; } })();
  state.clients       = (clients       || []).map(r => newClient(toCamel(r)));
  state.leads         = (leads         || []).map(r => newLead(toCamel(r)));
  state.quotes        = (quotes        || []).map(r => newQuote(toCamel(r)));
  state.collections   = (collections   || []).map(r => { const c = toCamel(r); return { id:c.id, quoteId:c.quoteId||"", part:Number(c.part||1), label:c.label||"", dueDate:c.dueDate||"", amount:Number(c.amount||0), detraction:Number(c.detraction||0), currency:c.currency||"PEN", status:c.status||"Pendiente", paidDate:c.paidDate||"", invoice:c.invoice||"", bankAccount:c.bankAccount||"", declared:c.declared||"Sin declarar", repo:c.repo||"" }; });
  state.expenses      = (expenses      || []).map(r => newExpense(toCamel(r)));
  state.team          = (team          || []).map(r => newTeamPayment(toCamel(r)));
  state.taxPayments   = (taxPayments   || []).map(r => newTaxPayment(toCamel(r)));
  state.purchases     = (purchases     || []).map(r => newPurchase(toCamel(r)));
  state.invoicedSales = (invoicedSales || []).map(r => newInvoicedSale(toCamel(r)));
  state.cashEntries   = (cashEntries   || []).map(r => newCashEntry(toCamel(r)));
  state.declaraciones = (declaraciones || []).map(r => newDeclaracion(toCamel(r)));
  if (settings) {
    state.settings = { ...base.settings, igvRate: settings.igv_rate, detractionRate: settings.detraction_rate, detractionThreshold: settings.detraction_threshold, commissionRate: settings.commission_rate, currency: settings.currency, bankAccounts: settings.bank_accounts || [], fixedExpenses: settings.fixed_expenses || [], teamMembers: settings.team_members || [], saldosIniciales: settings.saldos_iniciales || localSnap.saldosIniciales || [], detractionAccount: settings.detraction_account || localSnap.detractionAccount || "Detracciones", collectionDetModes: settings.collection_det_modes || localSnap.collectionDetModes || {}, taxPaymentCollections: settings.tax_payment_collections || localSnap.taxPaymentCollections || {}, fixedExpenseOverrides: settings.fixed_expense_overrides || localSnap.fixedExpenseOverrides || {} };
    state.services   = settings.services   || base.services;
    state.categories = settings.categories || base.categories;
    state.sources    = settings.sources    || base.sources;
    state.profiles   = settings.profiles   || base.profiles;
    state.vendors    = settings.vendors    || [];
  }
  if (salesTargets?.length) {
    const map = {};
    for (const t of salesTargets) map[t.year] = { mode: t.mode, annualPEN: t.annual_pen, annualUSD: t.annual_usd, monthly: t.monthly || {} };
    localStorage.setItem(SALES_TARGETS_KEY, JSON.stringify(map));
  }
  state.quotes.forEach(q => syncQuoteSideEffects(state, q));
  syncClientsFromActivity(state);
  const codeChanged = applyCodePadding(state);
  const bankChanged = applyBankAccountDefaults(state);
  if (codeChanged || bankChanged) sbSync().catch(e => console.error("migration sync:", e));
}
// ─────────────────────────────────────────────────────────

const IGV_RATE = 0.18;
const DETRACTION_RATE = 0.12;
const DETRACTION_THRESHOLD = 700;
const DETRACTION_THRESHOLD_USD = 189;
const COMMISSION_RATE = 0.05;

const STORAGE_KEY = "bandu-panel-state-v2";
const LEGACY_STORAGE_KEY = "bandu-panel-state-v1";
const AUTH_KEY = "bandu-panel-auth-v1";
const SESSION_KEY = "nebumia-session";
const THEME_KEY = "bandu-panel-theme";
const SIDEBAR_KEY = "nebumia-sidebar-collapsed";
let sidebarCollapsed = localStorage.getItem(SIDEBAR_KEY) === "1";
const DASHBOARD_FILTERS_KEY = "nebumia-dashboard-filters";
const DASH_SECTIONS_KEY = "nebumia-dash-sections";
const METRICS_VIS_KEY = "nebumia-metrics-vis";
const SALES_TARGETS_KEY = "nebumia-sales-targets";
function getSalesTargets() {
  try { return JSON.parse(localStorage.getItem(SALES_TARGETS_KEY) || "{}"); } catch { return {}; }
}
function setSalesTargets(data) {
  localStorage.setItem(SALES_TARGETS_KEY, JSON.stringify(data));
}
function getMonthTarget(year, monthNum) {
  const fallbackPEN = (typeof state !== "undefined" ? state?.settings?.monthlyGoal : 0) || 0;
  const all = getSalesTargets();
  const yd = all[year];
  if (!yd) return { pen: fallbackPEN, usd: 0 };
  const mk = String(monthNum).padStart(2, "0");
  if (yd.mode === "monthly") {
    const saved = yd.monthly?.[mk];
    // Only fall back when the month has NEVER been saved
    if (saved == null) return { pen: fallbackPEN, usd: 0 };
    return { pen: Number(saved.pen ?? 0), usd: Number(saved.usd ?? 0) };
  }
  const penAnnual = Math.round((yd.annualPEN || 0) / 12);
  const usdAnnual = Math.round((yd.annualUSD || 0) / 12);
  return { pen: penAnnual || fallbackPEN, usd: usdAnnual };
}
function isMetricVisible(view) {
  const vis = JSON.parse(localStorage.getItem(METRICS_VIS_KEY) || "{}");
  return vis[view] !== false;
}
function setMetricVis(view, visible) {
  const vis = JSON.parse(localStorage.getItem(METRICS_VIS_KEY) || "{}");
  vis[view] = visible;
  localStorage.setItem(METRICS_VIS_KEY, JSON.stringify(vis));
}

const quoteStatuses = ["Por cotizar", "Cotizado", "Ganado", "Perdido"];
const leadStatuses = ["Nuevo", "Contactado", "Reunion", "Propuesta", "Cotizado", "Ganado", "Cerrado perdido"];
const paymentStatuses = ["Pendiente", "Facturado", "Pagado", "Vencido"];
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const navItems = [
  ["dashboard", "Dashboard", "layout"],
  ["clients", "Clientes", "users"],
  ["quotes", "Cotizaciones", "fileText"],
  ["sales", "Ventas", "receipt"],
  ["collections", "Cobranzas", "wallet"],
  ["finance", "Caja financiera", "banknote"],
  ["comprobantes", "Contabilidad", "book"],
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
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
  trash: '<path d="M3 6h18"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M9 6V4h6v2"></path>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
  "chevron-up": '<path d="m18 15-6-6-6 6"></path>',
  "chevron-down": '<path d="m6 9 6 6 6-6"></path>',
  "chevron-left": '<path d="m15 18-6-6 6-6"></path>',
  "chevron-right": '<path d="m9 18 6-6-6-6"></path>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
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
    cuotas: Number(data.cuotas) || (data.paymentType === "thirds" ? 3 : data.paymentType === "full" ? 1 : 2),
    repo: data.repo || "",
    comments: data.comments || "",
    wonDate: data.wonDate || "",
    invoice: data.invoice || "",
    bankAccount: data.bankAccount || ""
  };
}

const countriesList = ["Perú","Argentina","Bolivia","Brasil","Chile","Colombia","Ecuador","Paraguay","Uruguay","Venezuela","México","Estados Unidos","España","Alemania","Francia","Italia","Reino Unido","Portugal","Países Bajos","Bélgica","Suiza","Austria","Suecia","Noruega","Dinamarca","Finlandia","Polonia","República Checa","Rumania","Grecia","Turquía","Rusia","Ucrania","China","Japón","Corea del Sur","India","Indonesia","Filipinas","Vietnam","Tailandia","Malasia","Singapur","Australia","Nueva Zelanda","Canadá","Costa Rica","Panamá","Guatemala","Honduras","El Salvador","Nicaragua","Cuba","Puerto Rico","República Dominicana","Haití","Jamaica","Trinidad y Tobago","Angola","Sudáfrica","Nigeria","Kenia","Etiopía","Ghana","Marruecos","Egipto","Argelia","Tanzania","Mozambique","Uganda","Camerún","Costa de Marfil","Senegal","Zambia","Zimbabwe","Arabia Saudita","Emiratos Árabes Unidos","Israel","Irán","Irak","Pakistán","Bangladés","Sri Lanka","Nepal","Afganistán"];

function newClient(data = {}) {
  return {
    id: data.id || uid(),
    name: data.name || "",
    ruc: data.ruc || "",
    date: data.date || "",
    contact: data.contact || "",
    email: data.email || "",
    phone: data.phone || "",
    clientType: data.clientType || "",
    country: data.country || "Perú",
    owner: data.owner || "Dante Trujillo",
    source: data.source || "",
    notes: data.notes || ""
  };
}

function newExpense(data = {}) {
  return {
    id: data.id || uid(),
    date: data.date || (data.month ? monthDate(data.month) || today() : today()),
    concept: data.concept || "",
    type: data.type || "Gasto fijo",
    amount: Number(data.amount || 0),
    currency: data.currency || "PEN",
    status: data.status || "Pendiente",
    owner: data.owner || "Bandu",
    refund: Boolean(data.refund),
    isAdSpend: Boolean(data.isAdSpend),
    docLink: data.docLink || ""
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
    receipt: data.receipt || "",
    dueDate: data.dueDate || "",
    ruc: data.ruc || "",
    currency: data.currency || "PEN",
    bankName: data.bankName || "",
    accountNumber: data.accountNumber || "",
    cci: data.cci || "",
    commInvoice: data.commInvoice || "",
    commRepo: data.commRepo || ""
  };
}

function profileHasCommission(roleName) {
  return (state.profiles || []).find(p => p.name === roleName)?.hasCommission || false;
}

function calcTeamCommission(name) {
  const rate = state.settings.commissionRate || 0.05;
  return wonQuotes()
    .filter(q => q.owner === name)
    .reduce((sum, q) => sum + calcQuote(q, state).commission, 0);
}

function newTaxPayment(data = {}) {
  return {
    id: data.id || uid(),
    date: data.date || today(),
    type: data.type || "IGV 1011",
    period: data.period || currentMonthName(),
    amount: Number(data.amount || 0),
    status: data.status || "Pendiente",
    sunatRef: data.sunatRef || "",
    docLink: data.docLink || "",
    collectionId: data.collectionId || ""
  };
}

function newDeclaracion(data = {}) {
  return {
    id: data.id || uid(),
    period: data.period || currentMonthName(),
    igv1011: Number(data.igv1011 || 0),
    renta3121: Number(data.renta3121 || 0),
    otro: Number(data.otro || 0),
    otroConcepto: data.otroConcepto || "",
    status: data.status || "Pendiente",
    notes: data.notes || ""
  };
}

function newPurchase(data = {}) {
  return {
    id: data.id || uid(),
    date: data.date || today(),
    vendor: data.vendor || "",
    ruc: data.ruc || "",
    invoiceType: data.invoiceType || "Factura",
    invoiceNum: data.invoiceNum || "",
    concept: data.concept || "",
    subtotal: Number(data.subtotal || 0),
    igv: Number(data.igv || 0),
    total: Number(data.total || 0),
    currency: data.currency || "PEN",
    detraction: Number(data.detraction || 0),
    paidDate: data.paidDate || "",
    bankAccount: data.bankAccount || "",
    declared: data.declared || "Sin declarar",
    repo: data.repo || ""
  };
}

function newInvoicedSale(data = {}) {
  return {
    id: data.id || uid(),
    date: data.date || today(),
    client: data.client || "",
    ruc: data.ruc || "",
    invoiceType: data.invoiceType || "Factura",
    invoiceNum: data.invoiceNum || "",
    service: data.service || "",
    subtotal: Number(data.subtotal || 0),
    igv: Number(data.igv || 0),
    total: Number(data.total || 0),
    currency: data.currency || "PEN",
    quoteId: data.quoteId || "",
    part: data.part || 0
  };
}

function newCashEntry(data = {}) {
  return {
    id: data.id || uid(),
    date: data.date || today(),
    type: data.type || "egreso",
    concept: data.concept || "",
    category: data.category || "",
    amount: Number(data.amount || 0),
    currency: data.currency || "PEN",
    status: data.status || "Confirmado",
    bankAccount: data.bankAccount || "",
    notes: data.notes || "",
    invoice: data.invoice || ""
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
      bankAccounts: ["CC Interbank S/", "CP Interbank S/", "CC Interbank $", "CP Interbank $"],
      fixedExpenses: [],
      teamMembers: [],
      saldosIniciales: [],
      detractionAccount: "Detracciones",
      collectionDetModes: {},
      taxPaymentCollections: {},
      fixedExpenseOverrides: {}
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
    taxPayments: [],
    vendors: [],
    purchases: [],
    invoicedSales: [],
    cashEntries: [],
    declaraciones: [],
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

// ONE-TIME RESET — se ejecuta una sola vez al abrir el app
(() => {
  const RESET_FLAG = "bandu-reset-20260612b";
  if (!localStorage.getItem(RESET_FLAG)) {
    const clean = {
      clients: [{ id: crypto.randomUUID(), name: "TESY S.A.C.", ruc: "", date: "", contact: "", email: "", phone: "", clientType: "B2B", country: "Perú", owner: "Dante Trujillo", notes: "" }],
      leads: [], quotes: [], collections: [], expenses: [],
      team: [], taxPayments: [], purchases: [], invoicedSales: [], cashEntries: [], declaraciones: [],
      services: [
        "Estrategia y anuncios Meta Ads",
        "Implementacion CRM + automatizaciones",
        "Diseno UX/UI de Página Web",
        "Chat inteligente con IA",
        "Contratacion usuarios Kommo CRM",
        "Renovacion usuarios Kommo CRM",
        "SEO y posicionamiento web",
        "Gestion de redes sociales",
        "Email marketing",
        "Consultoria digital"
      ],
      categories: ["CRM", "Diseño", "IA", "Marketing", "Tecnologia", "Otro"],
      sources: ["Kommo Partners", "Recomendado", "Página Web", "Meta Ads", "Referido", "Otro"],
      profiles: [
        { name: "Comercial",   hasCommission: true  },
        { name: "Diseñador",   hasCommission: false },
        { name: "Especialista",hasCommission: false },
        { name: "Externo",     hasCommission: false }
      ],
      settings: {}
    };
    localStorage.setItem("bandu-panel-state-v2", JSON.stringify(clean));
    localStorage.removeItem("bandu-panel-state-v1");
    localStorage.removeItem("nebumia-active-view");
    localStorage.setItem(RESET_FLAG, "1");
  }
})();

let state = loadState();
let activeView = localStorage.getItem("nebumia-active-view") || "dashboard";
let editingId = "";
let editingType = "";
let activeCajaTab = "general";
let activeSettingsTab = "financiero";
let salesTargetsYear = new Date().getFullYear();
let authMode = "login";
const VIEW_RANGES_KEY = "nebumia-view-ranges";
let viewRanges = (() => { try { return JSON.parse(localStorage.getItem(VIEW_RANGES_KEY) || "{}"); } catch { return {}; } })();
function getCurrentRange() { return viewRanges[activeView] || getDashboardPreset("thisMonth"); }
function setCurrentRange(range) { viewRanges[activeView] = range; localStorage.setItem(VIEW_RANGES_KEY, JSON.stringify(viewRanges)); }
let dashboardRange = getCurrentRange();
let revenueChartTab = "";
let dashboardSections = (() => {
  const always = ["accountsBreakdown", "annualProjection"];
  try {
    const stored = JSON.parse(localStorage.getItem(DASH_SECTIONS_KEY));
    if (Array.isArray(stored)) {
      const s = new Set(stored);
      always.forEach(k => s.add(k));
      return s;
    }
  } catch {}
  return new Set(["metrics", "revenue", "pipeline", "accountsBreakdown", "profitability", "salesSource", "salesOwner", "collections", "activity", "annualProjection"]);
})();
let activeDashboardFilter = null;
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
    settings: { ...base.settings, ...inputSettings, fixedExpenses: inputSettings.fixedExpenses || [], teamMembers: inputSettings.teamMembers || [], saldosIniciales: inputSettings.saldosIniciales || [], detractionAccount: inputSettings.detractionAccount || "Detracciones", collectionDetModes: inputSettings.collectionDetModes || {}, taxPaymentCollections: inputSettings.taxPaymentCollections || {}, fixedExpenseOverrides: inputSettings.fixedExpenseOverrides || {} },
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
      bankAccount: c.bankAccount || "",
      declared: c.declared || "Sin declarar"
    })),
    expenses: (input.expenses || base.expenses).map(e => newExpense({ ...e, date: e.date || monthDate(e.month) || today() })),
    team: (input.team || base.team).map(newTeamPayment),
    taxPayments: (input.taxPayments || []).map(newTaxPayment),
    purchases: (input.purchases || []).map(newPurchase),
    invoicedSales: (input.invoicedSales || []).map(newInvoicedSale),
    cashEntries: (input.cashEntries || []).map(newCashEntry),
    declaraciones: (input.declaraciones || []).map(newDeclaracion),
    services: input.services || base.services || [],
    categories: input.categories || base.categories || ["CRM", "Diseño", "IA", "Marketing", "Tecnologia", "Otro"],
    sources: input.sources || base.sources || ["Kommo Partners", "Recomendado", "Página Web", "Meta Ads", "Referido", "Otro"],
    profiles: input.profiles || base.profiles || [{ name: "Comercial", hasCommission: true }, { name: "Especialista", hasCommission: false }]
  };
  migrated.quotes.forEach(q => syncQuoteSideEffects(migrated, q));
  syncClientsFromActivity(migrated);
  applyCodePadding(migrated);
  applyBankAccountDefaults(migrated);
  return migrated;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (sbUser) sbSync().catch(err => console.error("Supabase sync:", err));
  if (typeof refreshNotifBadge === "function") refreshNotifBadge();
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const label = theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  themeToggleBtn.textContent = label;
  themeToggleBtn.setAttribute("aria-label", label);
  localStorage.setItem(THEME_KEY, theme);
}

function auth() {
  const saved = localStorage.getItem(AUTH_KEY);
  return saved ? JSON.parse(saved) : { name: "Administrador", email: "admin@bandu.pe", password: "bandu2026" };
}

function saveAuth(next) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...auth(), ...next }));
}

function compressPhoto(dataUrl, size = 96) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      const min = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.src = dataUrl;
  });
}

function syncFromSupabaseMeta(user) {
  const meta = user?.user_metadata || {};
  if (meta.name) saveAuth({ name: meta.name, companyName: meta.companyName || "", email: user.email || auth().email });
  else if (user?.email) saveAuth({ email: user.email });
  if (meta.photo) localStorage.setItem("nebumia-profile-photo", meta.photo);
}

function syncProfileUI() {
  const current = auth();
  const name = current.name || "Administrador";
  const firstName = name.split(" ")[0];
  const hello = document.getElementById("topbarHello");
  const company = document.getElementById("topbarCompany");
  if (hello) hello.textContent = `¡Hola, ${firstName}!`;
  if (company) company.textContent = current.companyName || "";
  profileName.textContent = name;
  profileEmail.textContent = current.email || "admin@bandu.pe";
  const photo = localStorage.getItem("nebumia-profile-photo");
  const img = document.getElementById("profilePhotoImg");
  if (photo) {
    profileAvatar.textContent = "";
    profileAvatar.style.backgroundImage = `url(${photo})`;
    profileAvatar.style.backgroundSize = "cover";
    profileAvatar.style.backgroundPosition = "center";
    if (img) { img.src = photo; img.style.display = "block"; }
    document.getElementById("profilePhotoInitial").style.display = "none";
  } else {
    profileAvatar.textContent = name.trim().charAt(0).toUpperCase() || "N";
    profileAvatar.style.backgroundImage = "";
    if (img) { img.src = ""; img.style.display = "none"; }
    const ini = document.getElementById("profilePhotoInitial");
    if (ini) { ini.textContent = name.trim().charAt(0).toUpperCase() || "N"; ini.style.display = ""; }
  }
}

function logout() {
  profileDropdown.classList.add("hidden");
  const overlay = document.createElement("div");
  overlay.className = "logout-overlay";
  overlay.innerHTML = '<div class="content-spinner"></div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));
  sb.auth.signOut().finally(() => {
    sbUser = null;
    setTimeout(() => {
      localStorage.removeItem(SESSION_KEY);
      appShell.classList.add("hidden");
      loginScreen.classList.remove("hidden");
      setAuthMode("login");
      overlay.remove();
    }, 800);
  });
}

function setAuthMode(mode) {
  authMode = mode;
  passwordField.classList.toggle("hidden", mode === "forgot");
  document.querySelector("#password").required = mode !== "forgot";
  forgotPasswordBtn.classList.toggle("hidden", mode === "forgot");

  if (mode === "login") {
    authTitle.textContent = "Bienvenido de vuelta";
    authSubtitle.textContent = "Ingresa tus datos para acceder a Nebumia.";
    authSubmitBtn.innerHTML = "Ingresar";
    authHint.textContent = "";
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
    thisMonth: { start: isoDate(new Date(year, month, 1)), end: isoDate(new Date(year, month + 1, 0)), label: "Este mes" },
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

function prevRange() {
  const s = new Date(dashboardRange.start + "T00:00:00");
  const e = new Date(dashboardRange.end   + "T00:00:00");
  const days = Math.round((e - s) / 86400000) + 1;
  const pe = new Date(s.getTime() - 86400000);
  const ps = new Date(pe.getTime() - (days - 1) * 86400000);
  const fmt2 = d => d.toISOString().substring(0, 10);
  return { start: fmt2(ps), end: fmt2(pe), label: days <= 31 ? "el mes pasado" : "el periodo anterior" };
}

function dateInPrevRange(value) {
  const pr = prevRange();
  if (!value) return false;
  return value >= pr.start && value <= pr.end;
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

function metricsToggleBtn(view) {
  const visible = isMetricVisible(view);
  return `<button class="filter-toggle-btn metrics-vis-btn${visible ? "" : " filter-active"}" data-metrics-toggle type="button" title="${visible ? "Ocultar métricas" : "Mostrar métricas"}" aria-label="${visible ? "Ocultar métricas" : "Mostrar métricas"}">${icon("layout")}</button>`;
}

function filterPopover(id, filtersHtml, isActive = false) {
  if (!filtersHtml) return "";
  return `
    <div class="filter-btn-wrap">
      <button class="filter-toggle-btn${isActive ? " filter-active" : ""}" data-filter-toggle="${id}" type="button" title="Filtros">
        ${icon("sliders")}
        <span class="filter-dot${isActive ? "" : " hidden"}"></span>
      </button>
      <div id="${id}" class="filter-popover hidden">
        ${filtersHtml}
        <button class="filter-reset-btn${isActive ? "" : " hidden"}" data-filter-reset="${id}" type="button">Limpiar filtros</button>
      </div>
    </div>
  `;
}

function moduleToolbar({ search = "", filters = "", action = "", showDate = true, metricsToggle = false } = {}) {
  const actions = {
    quote: ["Nueva cotización", "quotes"],
    lead: ["Nueva oportunidad", "quotes"],
    client: ["Nuevo cliente", "clients"],
    expense: ["Nuevo egreso", "finance"],
    payment: ["Nuevo pago", "team"],
    taxPayment: ["Nuevo pago SUNAT", "comprobantes"],
    sale: ["Nueva venta", "sales"],
    collection: ["Nueva cobranza", "collections"]
  };
  const actionConfig = actions[action];
  const navItem = navItems.find(([id]) => id === activeView);
  const title = navItem ? navItem[1] : "";
  return `
    <div class="module-page-header" data-page-header>
      <h1 class="page-title" style="margin-bottom:0">${escapeHtml(title)}</h1>
      ${showDate ? dateFilterControl() : ""}
    </div>
    <div class="module-controls module-controls-inline">
      <div class="module-controls-left">
        ${search ? `<label class="module-search">${icon("search")}<input id="moduleSearch" type="search" placeholder="${search}"></label>` : ""}
        ${filterPopover(`${activeView}-filters`, filters)}
        ${metricsToggle ? metricsToggleBtn(activeView) : ""}
      </div>
      <div class="module-controls-right">
        <button class="secondary-action" data-import-state type="button">${icon("upload")}<span>Importar</span></button>
        <button class="secondary-action" data-export-state type="button">${icon("download")}<span>Exportar</span></button>
        ${actionConfig ? `<button class="create-action" data-module-action="${actionConfig[1]}" type="button">${icon("plus")}<span>${actionConfig[0]}</span></button>` : ""}
      </div>
    </div>
  `;
}

function dashboardFilterBar() {
  const sectionOptions = [
    ["metrics", "Métricas principales"],
    ["revenue", "Gráfico de ingresos"],
    ["pipeline", "Embudo comercial"],
    ["profitability", "Por categoría"],
    ["salesSource", "Por fuente"],
    ["salesOwner", "Comerciales"],
    ["collections", "Cobros próximos"],
    ["activity", "Ranking de clientes"],
    ["annualProjection", "Proyección anual"]
  ];
  return `
    <section class="dashboard-filter-zone">
      <div class="dashboard-quick-filters">
        <span class="dashboard-filter-label">Filtros rápidos</span>
        <button data-dashboard-preset="all" type="button" class="${activeDashboardFilter === "all" ? "dash-filter-active" : ""}">Vista completa</button>
        ${dashboardSavedFilters.map(filter => `
          <div class="saved-filter-chip${activeDashboardFilter === filter.id ? " dash-filter-active" : ""}">
            <button class="saved-filter-chip__name" data-saved-dashboard-filter="${filter.id}" type="button">${escapeHtml(filter.name)}</button>
            <button class="saved-filter-delete" data-delete-dashboard-filter="${filter.id}" type="button" title="Eliminar filtro" aria-label="Eliminar filtro">${icon("x")}</button>
          </div>`).join("")}
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
  const won = state.quotes.filter(q => q.status === "Ganado" && dateInRange(q.wonDate || q.date)).map(q => ({ ...q, ...calcQuote(q) }));
  const lost = state.quotes.filter(q => q.status === "Perdido" && dateInRange(q.wonDate || q.date));
  const allCollections = collectionRows();
  const collections = allCollections.filter(row => dateInRange(row.paidDate || row.dueDate));
  const expenses = state.expenses.filter(expense => dateInRange(expense.date || monthDate(expense.month)));
  const team = state.team.filter(payment => dateInRange(payment.dueDate || monthDate(payment.month)));
  const revenue = won.reduce((sum, sale) => sum + sale.total, 0);
  const paid = collections.filter(row => row.status === "Pagado").reduce((sum, row) => sum + row.amount, 0);
  const pending = collections.filter(row => row.status !== "Pagado").reduce((sum, row) => sum + row.amount, 0);
  const outflows = expenses.reduce((sum, expense) => sum + expense.amount, 0) + team.reduce((sum, payment) => sum + payment.amount, 0);
  const taxesPaid = (state.taxPayments || []).filter(t => dateInRange(t.date) && t.status === "Pagado").reduce((sum, t) => sum + t.amount, 0);
  const adSpend = expenses.filter(e => e.isAdSpend).reduce((sum, e) => sum + e.amount, 0);
  const netProfit = paid - outflows - taxesPaid;
  const roas = adSpend > 0 ? paid / adSpend : null;
  // pipeline: leads + quotes in the filtered period that are still open
  const openLeads = state.leads.filter(l => !["Ganado","Cerrado perdido"].includes(l.status) && dateInRange(l.date));
  const openQuotes = state.quotes.filter(q => ["Por cotizar","Cotizado"].includes(q.status) && dateInRange(q.date));
  const pipelineValue = openLeads.reduce((s,l) => s + (l.estimatedValue||0), 0) + openQuotes.reduce((s,q) => s + calcQuote(q).total, 0);
  // conversión: se calcula en la tarjeta (soles, mismo denominador que Pipeline activo)
  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.status === "Ganado").length;
  // PEN-specific stats
  const wonPEN = won.filter(q => (q.currency||"PEN") === "PEN");
  const lostPEN = lost.filter(q => (q.currency||"PEN") === "PEN");
  const wonThisMonthPEN = wonPEN.reduce((s,q) => s + q.total, 0);
  const pipelinePEN = openLeads.filter(l => (l.currency||"PEN") === "PEN").reduce((s,l) => s + (l.estimatedValue||0), 0)
    + openQuotes.filter(q => (q.currency||"PEN") === "PEN").reduce((s,q) => s + calcQuote(q).total, 0);
  // USD-specific stats
  const wonUSD = won.filter(q => q.currency === "USD");
  const lostUSD = lost.filter(q => q.currency === "USD");
  const pipelineUSD = openLeads.filter(l => l.currency === "USD").reduce((s,l) => s + (l.estimatedValue||0), 0)
    + openQuotes.filter(q => q.currency === "USD").reduce((s,q) => s + calcQuote(q).total, 0);
  const wonThisMonthUSD = wonUSD.reduce((s,q) => s + q.total, 0);
  // goal based on the filtered period's start month
  const _rangeDate = new Date(dashboardRange.start + "T00:00:00");
  const _monthTarget = getMonthTarget(_rangeDate.getFullYear(), _rangeDate.getMonth() + 1);
  const goal = _monthTarget.pen || 0;
  const goalUSD = _monthTarget.usd || 0;
  const goalPctPEN = goal > 0 ? Math.min(100, Math.round(wonThisMonthPEN / goal * 100)) : 0;
  const goalPctUSD = goalUSD > 0 ? Math.min(100, Math.round(wonThisMonthUSD / goalUSD * 100)) : 0;
  const rangePeriodLabel = months[_rangeDate.getMonth()];
  // kept for backwards compat with other dashboard sections
  const wonThisMonth = wonThisMonthPEN + wonThisMonthUSD;
  const goalPct = goalPctPEN;
  // overdue collections
  const overdueCollections = allCollections.filter(c => c.status !== "Pagado" && c.dueDate && c.dueDate < today());
  const pendingSunat = (state.taxPayments||[]).filter(t => t.status === "Pendiente");
  const pendingTeam = state.team.filter(t => t.status === "Pendiente");
  return { leads, quotes, won, lost, collections, expenses, team, revenue, paid, pending, outflows, taxesPaid, adSpend, netProfit, roas, openLeads, openQuotes, pipelineValue, totalLeads, wonLeads, wonThisMonth, goal, goalUSD, goalPct, overdueCollections, pendingSunat, pendingTeam, wonPEN, lostPEN, wonThisMonthPEN, goalPctPEN, pipelinePEN, wonUSD, lostUSD, pipelineUSD, wonThisMonthUSD, goalPctUSD, rangePeriodLabel };
}

function currentMonthName() {
  return months[new Date().getMonth()];
}

function fmt(amount, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(amount || 0);
}

function gaugeKpi(pct, current, goal, currency, label, periodLabel = currentMonthName()) {
  const R = 82, SW = 13, cx = 100, cy = 118;
  const total = Math.PI * R;
  const filled = (Math.min(Math.max(pct, 0), 100) / 100 * total).toFixed(1);
  const arcD = `M ${cx - R},${cy} A ${R},${R} 0 0,1 ${cx + R},${cy}`;
  const color = pct >= 100 ? "var(--mint)" : pct >= 50 ? "var(--brand)" : "var(--coral)";
  const pctClass = pct >= 100 ? "kpi-pct--ok" : pct >= 50 ? "kpi-pct--warn" : "kpi-pct--low";
  const sym = currency === "USD" ? "$" : "S/";
  const fmtS = n => n >= 1000 ? `${sym} ${(n / 1000).toFixed(1)}k` : `${sym} ${Math.round(n)}`;
  const goalText = goal > 0 ? `de ${fmtS(goal)} · ${periodLabel}` : periodLabel;
  return `
    <div class="kpi-top">
      <span class="kpi-label">${label}</span>
      ${goal > 0 ? `<span class="kpi-pct ${pctClass}">${pct}%</span>` : ""}
    </div>
    <div class="gauge-wrap">
      <svg viewBox="0 0 200 128" xmlns="http://www.w3.org/2000/svg">
        <path d="${arcD}" fill="none" stroke="var(--hover)" stroke-width="${SW}" stroke-linecap="round"/>
        <path d="${arcD}" fill="none" stroke="${color}" stroke-width="${SW}" stroke-linecap="round"
          stroke-dasharray="${filled} ${total.toFixed(1)}"/>
        <text x="${cx}" y="90" text-anchor="middle" font-family="inherit" font-size="21" font-weight="600" fill="var(--ink)">${fmtS(current)}</text>
        <text x="${cx}" y="112" text-anchor="middle" font-family="inherit" font-size="10.5" fill="var(--muted)">${goalText}</text>
      </svg>
    </div>`;
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
  const isUSD = q.currency === "USD";
  const threshold = isUSD ? DETRACTION_THRESHOLD_USD : (sourceState.settings.detractionThreshold ?? DETRACTION_THRESHOLD);
  const detraction = total >= threshold && q.hasIgv ? total * sourceState.settings.detractionRate : 0;
  const commission = q.subtotal * sourceState.settings.commissionRate;
  return { igv, total, detraction, commission, netCash: total - detraction };
}

function wonQuotes() {
  return state.quotes.filter(q => q.status === "Ganado").map(q => ({ ...q, ...calcQuote(q) }));
}

function annualProjectionTables() {
  const year = new Date().getFullYear();
  const currentMk = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const penRows = months.map((name, i) => {
    const monthNum = i + 1;
    const key = `${year}-${String(monthNum).padStart(2, "0")}`;
    const isCurrent = key === currentMk;
    const target = getMonthTarget(year, monthNum);
    const goal = target.pen || 0;
    const ganado = state.quotes.filter(q => q.status === "Ganado" && (q.currency||"PEN") === "PEN" && q.date.startsWith(key)).reduce((s, q) => s + calcQuote(q).total, 0);
    const cobrado = collectionRows().filter(c => (c.currency||"PEN") === "PEN" && c.status === "Pagado" && (c.paidDate||"").startsWith(key)).reduce((s, c) => s + c.amount, 0);
    const pct = goal > 0 ? Math.round((ganado / goal) * 100) : 0;
    const nameTd = isCurrent ? `<strong>${name}</strong>` : name;
    return [nameTd, goal > 0 ? fmt(goal) : "—", fmt(ganado), fmt(cobrado), goal > 0 ? `<span class="${pct >= 100 ? "badge-ok" : pct >= 50 ? "badge-warn" : "badge-low"}">${pct}%</span>` : "—"];
  });
  const usdRows = months.map((name, i) => {
    const monthNum = i + 1;
    const key = `${year}-${String(monthNum).padStart(2, "0")}`;
    const isCurrent = key === currentMk;
    const target = getMonthTarget(year, monthNum);
    const goalUsd = target.usd || 0;
    const ganado = state.quotes.filter(q => q.status === "Ganado" && q.currency === "USD" && q.date.startsWith(key)).reduce((s, q) => s + calcQuote(q).total, 0);
    const cobrado = collectionRows().filter(c => c.currency === "USD" && c.status === "Pagado" && (c.paidDate||"").startsWith(key)).reduce((s, c) => s + c.amount, 0);
    const pct = goalUsd > 0 ? Math.round((ganado / goalUsd) * 100) : 0;
    const nameTd = isCurrent ? `<strong>${name}</strong>` : name;
    return [nameTd, goalUsd > 0 ? fmt(goalUsd, "USD") : "—", fmt(ganado, "USD"), fmt(cobrado, "USD"), goalUsd > 0 ? `<span class="${pct >= 100 ? "badge-ok" : pct >= 50 ? "badge-warn" : "badge-low"}">${pct}%</span>` : "—"];
  });
  return `
    <div class="annual-proj-tables">
      <div class="annual-proj-col">
        <div class="annual-proj-subtitle">Soles (S/)</div>
        ${table(["Mes", "Meta S/", "Ganado", "Cobrado", "% Meta"], penRows)}
      </div>
      <div class="annual-proj-col">
        <div class="annual-proj-subtitle">Dólares ($)</div>
        ${table(["Mes", "Meta $", "Ganado", "Cobrado", "% Meta"], usdRows)}
      </div>
    </div>`;
}

function autoDetraction(c, dm) {
  if (dm.detActual != null) return dm.detActual;
  const isUSD = c.currency === "USD";
  const threshold = isUSD ? DETRACTION_THRESHOLD_USD : (state.settings.detractionThreshold ?? DETRACTION_THRESHOLD);
  if (c.amount < threshold) return 0;
  return c.detraction ? Math.round(c.detraction) : 0;
}

function collectionRows() {
  return state.collections.map(c => {
    const quote = state.quotes.find(q => q.id === c.quoteId);
    return { ...c, quote, client: quote?.client || "Sin cotizacion", service: quote?.service || "", code: quote?.code || "-", owner: quote?.owner || "—", wonDate: quote?.wonDate || quote?.date || "", currency: c.currency || quote?.currency || "PEN" };
  });
}

function buildCajaRows() {
  const rows = [];

  const detAccount  = state.settings.detractionAccount  || "Detracciones";
  const detModes    = state.settings.collectionDetModes  || {};
  collectionRows().filter(c => c.status === "Pagado").forEach(c => {
    const dm    = detModes[c.id] || {};
    const det   = autoDetraction(c, dm);
    const mode  = dm.mode || "cliente";
    const label = [c.code, c.client].filter(Boolean).join(" · ");
    const base  = { date: c.paidDate || c.dueDate, currency: c.currency || "PEN",
                    status: "Confirmado", source: "Cobro", sourceId: c.id,
                    invoice: c.invoice || "", repo: c.repo || c.quote?.repo || "" };
    const defaultIngreso = det > 0 && mode !== "bandu" ? c.amount - det : c.amount;
    const ingresoAmt = dm.montoReal != null ? dm.montoReal : defaultIngreso;
    const detStatus = dm.detStatus || "Completado";
    rows.push({ ...base, id: `col-${c.id}`, type: "ingreso", sourceType: "collection",
      concept: [c.code, c.service, c.client].filter(Boolean).join(" · "),
      category: "Cobro de venta", amount: ingresoAmt, bankAccount: c.bankAccount || "" });
    if (det > 0 && detStatus === "Completado") {
      if (mode === "bandu") {
        // Egreso de la cuenta corriente (nosotros transferimos la detracción)
        rows.push({ ...base, id: `col-det-out-${c.id}`, type: "egreso", sourceType: "collectionDet",
          concept: `Detracción pagada · ${label}`, category: "Detracción",
          amount: det, bankAccount: dm.cuenta || c.bankAccount || "", status: "Completado", currency: "PEN" });
        // Ingreso a la cuenta detracciones (el dinero entra a Detracciones)
        rows.push({ ...base, id: `col-det-in-${c.id}`, type: "ingreso", sourceType: "collectionDet",
          concept: `Detracción · ${label}`, category: "Detracción",
          amount: det, bankAccount: detAccount, status: "Completado", currency: "PEN" });
      } else {
        // Cliente pagó directamente a la cuenta detracciones
        rows.push({ ...base, id: `col-det-${c.id}`, type: "ingreso", sourceType: "collectionDet",
          concept: `Detracción · ${label}`, category: "Detracción",
          amount: det, bankAccount: detAccount, status: "Completado", currency: "PEN" });
      }
    }
  });

  state.expenses.forEach(e => {
    rows.push({
      id: `exp-${e.id}`, date: e.date || today(), type: "egreso",
      concept: (e.refund ? "↩ " : "") + (e.concept || e.type),
      category: e.type || "Gasto", amount: e.amount, currency: e.currency || "PEN",
      status: e.status, source: "Gasto", sourceType: "expense", sourceId: e.id
    });
  });

  const teamBanks = state.settings.bankAccounts || [];
  const findTeamBank = (currency, type) => teamBanks.find(b => {
    const currMatch = currency === "USD" ? /\$|Dólar|USD/i.test(b) : /S\/|Sol|PEN/i.test(b);
    const typeMatch = type === "cc" ? /Corriente/i.test(b) : /Personal/i.test(b);
    return currMatch && typeMatch;
  }) || teamBanks[0] || "";
  const teamRemaining = {};
  teamBanks.forEach(b => {
    const br = rows.filter(r => r.bankAccount === b && r.status !== "Pendiente");
    const inn = br.filter(r => r.type === "ingreso").reduce((s, r) => s + r.amount, 0);
    const out = br.filter(r => r.type === "egreso").reduce((s, r) => s + r.amount, 0);
    teamRemaining[b] = inn - out;
  });
  state.team.forEach(t => {
    const cur = t.currency || "PEN";
    const cc = findTeamBank(cur, "cc");
    const cp = findTeamBank(cur, "cp");
    let assigned;
    if (cc && teamRemaining[cc] >= t.amount) { teamRemaining[cc] -= t.amount; assigned = cc; }
    else { assigned = cp || cc; }
    rows.push({
      id: `team-${t.id}`, date: t.dueDate || monthDate(t.month) || today(), type: "egreso",
      concept: [t.name, t.role].filter(Boolean).join(" — "),
      category: "Personal", amount: t.amount, currency: cur,
      status: t.status, source: "Personal", sourceType: "team", sourceId: t.id,
      bankAccount: assigned
    });
    if (profileHasCommission(t.role)) {
      const comm = calcTeamCommission(t.name);
      if (comm > 0) {
        rows.push({
          id: `comm-${t.id}`, date: t.dueDate || monthDate(t.month) || today(), type: "egreso",
          concept: `${t.name} — Interno (comisión de ventas)`,
          category: "Comisión", amount: comm, currency: cur,
          status: t.status, source: "Gasto variable", sourceType: "commission", sourceId: t.id,
          invoice: t.commInvoice || "", repo: t.commRepo || "",
          bankAccount: assigned
        });
      }
    }
  });

  (state.taxPayments || []).forEach(t => {
    rows.push({
      id: `tax-${t.id}`, date: t.date, type: "egreso",
      concept: `${t.type} · ${t.period}`,
      category: "Impuesto", amount: t.amount, currency: "PEN",
      status: t.status, source: "SUNAT", sourceType: "tax", sourceId: t.id,
      invoice: t.sunatRef || ""
    });
  });

  (state.purchases || []).filter(p => p.bankAccount && p.paidDate).forEach(p => {
    rows.push({
      id: `pur-${p.id}`, date: p.paidDate, type: "egreso",
      concept: (p.concept || p.vendor || "Compra") + (p.invoiceNum ? ` · ${p.invoiceNum}` : ""),
      category: "Compra", amount: p.total, currency: p.currency || "PEN",
      status: "Confirmado", source: "Compra", sourceType: "purchase", sourceId: p.id,
      bankAccount: p.bankAccount, invoice: p.invoiceNum || ""
    });
  });

  (state.cashEntries || []).forEach(e => {
    rows.push({ ...e, source: "Manual", sourceType: "cashEntry", sourceId: e.id, bankAccount: e.bankAccount || "" });
  });

  return rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function getAccountBalance(accountName) {
  const rows = buildCajaRows().filter(r => r.bankAccount === accountName && r.status !== "Pendiente");
  const ingresos = rows.filter(r => r.type === "ingreso").reduce((s, r) => s + r.amount, 0);
  const egresos  = rows.filter(r => r.type === "egreso").reduce((s, r) => s + r.amount, 0);
  return ingresos - egresos;
}

function buildSaldoAnteriorRows(allCajaRows, tab, rangeStart, rangeEnd) {
  const fixedAssigned = assignFixedExpenses();
  const tabCurrency = tab !== "general" && /\$|USD/i.test(tab) ? "USD" : "PEN";

  function genFixedRows(fromMonth, toMonth) {
    const result = [];
    if (!fixedAssigned.length) return result;
    let fc = new Date(fromMonth + "-01T00:00:00");
    const fe = new Date(toMonth  + "-01T00:00:00");
    while (fc < fe) {
      const d = isoDate(fc);
      fixedAssigned.forEach(f => result.push({
        date: d, type: "egreso", amount: f.amount, currency: f.currency,
        bankAccount: f.assignedAccount || ""
      }));
      fc.setMonth(fc.getMonth() + 1);
    }
    return result;
  }

  const rs = new Date(rangeStart + "T00:00:00");
  const priorStart = new Date(rs.getFullYear(), rs.getMonth() - 36, 1).toISOString().substring(0, 7);
  const priorFixed = genFixedRows(priorStart, rangeStart.substring(0, 7));
  const baseRows   = [...allCajaRows, ...priorFixed];

  const saldosIniciales = state.settings.saldosIniciales || [];

  const rows = [];
  let cursor = new Date(rs.getFullYear(), rs.getMonth(), 1);
  const endDate = new Date(rangeEnd + "T00:00:00");

  while (cursor <= endDate) {
    const firstDay = isoDate(cursor);
    const monthKey = firstDay.substring(0, 7);
    let saldo = 0;

    const override = tab !== "general"
      ? saldosIniciales.filter(s => s.bankAccount === tab && s.date <= monthKey)
                       .sort((a, b) => b.date.localeCompare(a.date))[0]
      : null;

    if (override) {
      saldo = override.amount;
      const postFixed = genFixedRows(override.date, monthKey);
      [...allCajaRows, ...postFixed].forEach(r => {
        if (!r.date || r.currency !== tabCurrency || r.bankAccount !== tab) return;
        if (r.status === "Pendiente") return;
        const rm = r.date.substring(0, 7);
        if (rm < override.date || rm >= monthKey) return;
        saldo += (r.type === "ingreso" ? 1 : -1) * (r.amount || 0);
      });
    } else {
      baseRows.forEach(r => {
        if (!r.date || r.currency !== tabCurrency) return;
        if (tab !== "general" && r.bankAccount !== tab) return;
        if (r.status === "Pendiente") return;
        if (r.date.substring(0, 7) >= monthKey) return;
        saldo += (r.type === "ingreso" ? 1 : -1) * (r.amount || 0);
      });
    }

    rows.push({
      id: `saldo-${firstDay}`,
      date: firstDay,
      type: saldo >= 0 ? "ingreso" : "egreso",
      concept: "Saldo anterior de caja",
      category: "Saldo anterior",
      source: "Saldo anterior",
      amount: Math.abs(saldo),
      currency: tabCurrency,
      sourceType: "saldoAnterior",
      bankAccount: tab !== "general" ? tab : "",
      _monthKey: monthKey,
      _signedAmount: saldo
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return rows;
}

function assignFixedExpenses() {
  const banks = state.settings.bankAccounts || [];
  const fixed = state.settings.fixedExpenses || [];

  const find = (currency, type) => banks.find(b => {
    const isPEN = /S\/|Sol|PEN/i.test(b);
    const isUSD = /\$|Dólar|USD/i.test(b);
    const isCorriente = /Corriente/i.test(b);
    const isPersonal  = /Personal/i.test(b);
    const currMatch = currency === "PEN" ? isPEN : isUSD;
    const typeMatch  = type === "primary" ? isCorriente : isPersonal;
    return currMatch && typeMatch;
  }) || banks[0] || "";

  const remaining = {};
  banks.forEach(b => { remaining[b] = getAccountBalance(b); });

  return fixed.map(f => {
    if (f.assignedAccount) return f;
    const primary  = find(f.currency, "primary");
    const fallback = find(f.currency, "fallback");
    let assigned;
    if (primary && remaining[primary] >= f.amount) {
      remaining[primary] -= f.amount;
      assigned = primary;
    } else {
      assigned = fallback || primary;
    }
    return { ...f, assignedAccount: assigned };
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

function addBusinessDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function normalizeStatus(status) {
  return String(status || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
}

function padQuoteCode(code) {
  const s = String(code || "").trim();
  if (!s || s.startsWith("0")) return s;       // already padded or empty
  if (!/^\d/.test(s)) return s;                // starts with letter/symbol, leave as-is
  const num = parseInt(s.match(/^\d+/)[0], 10);
  return num < 1000 ? "0" + s : s;             // <1000 → prepend "0"; ≥1000 → no change
}

function nextQuoteCode() {
  const nums = state?.quotes?.map(q => Number(String(q.code).match(/\d+/)?.[0] || 0)).filter(Boolean) || [285];
  const next = Math.max(...nums, 285) + 1;
  return next < 1000 ? String(next).padStart(4, "0") : String(next);
}

function applyCodePadding(st) {
  let changed = false;
  (st.quotes || []).forEach(q => {
    const padded = padQuoteCode(q.code);
    if (padded !== q.code) { q.code = padded; changed = true; }
  });
  return changed;
}

function fmtDate(str) {
  if (!str || str === "—") return str || "—";
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : str;
}

function normalizeImportDate(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (!s || s === "—") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  const dmyd = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyd) return `${dmyd[3]}-${dmyd[2].padStart(2,"0")}-${dmyd[1].padStart(2,"0")}`;
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return s;
}

function cleanNumericImport(val) {
  if (val === undefined || val === null || val === "") return "";
  const s = String(val).trim();
  const cleaned = s.replace(/[S\/\$USDusd\s]/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? s : String(n);
}

function cleanBooleanImport(val) {
  return /^(sí|si|1|true|yes|TRUE|SI|SÍ)$/i.test(String(val).trim());
}

function displayCode(code) {
  return padQuoteCode(String(code || "").replace(/^PPTO\s*/i, ""));
}

// Ordena registros por fecha descendente (más reciente primero). Las fechas ISO (YYYY-MM-DD) se comparan como texto.
function sortByDateDesc(arr, getDate = r => r.date) {
  return [...arr].sort((a, b) => String(getDate(b) || "").localeCompare(String(getDate(a) || "")));
}

const tablePages = {};
function getTablePage(key) {
  if (!tablePages[key]) tablePages[key] = { page: 1, pageSize: 10 };
  return tablePages[key];
}

function renderPaginator(key, page, totalPages, pageSize, total) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const sizes = [10, 50, 100, 200];

  const nums = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) nums.push(i);
  } else {
    const set = new Set([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages].filter(p => p >= 1 && p <= totalPages));
    [...set].sort((a, b) => a - b).forEach(p => nums.push(p));
  }

  let pages = "";
  let prev = 0;
  nums.forEach(p => {
    if (prev && p - prev > 1) pages += `<span class="pag-ellipsis">…</span>`;
    pages += `<button class="pag-btn ${p === page ? "active" : ""}" data-pag-key="${escapeAttr(key)}" data-pag-page="${p}">${p}</button>`;
    prev = p;
  });

  return `
    <div class="paginator">
      <div class="pag-left">
        <span class="pag-info">${from}–${to} de ${total}</span>
        <div class="pag-controls">
          <button class="pag-btn pag-nav" data-pag-key="${escapeAttr(key)}" data-pag-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>‹</button>
          ${pages}
          <button class="pag-btn pag-nav" data-pag-key="${escapeAttr(key)}" data-pag-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>›</button>
        </div>
      </div>
      <div class="pag-size-group">
        ${sizes.map(s => `<button class="pag-size-btn ${s === pageSize ? "active" : ""}" data-pag-key="${escapeAttr(key)}" data-pag-size="${s}">${s}</button>`).join("")}
        <span class="pag-size-label">filas</span>
      </div>
    </div>
  `;
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
  const cuotas = Number(q.cuotas) || 1;
  const parts = cuotas === 3 ? [1/3, 1/3, 1/3] : cuotas === 2 ? [0.5, 0.5] : [1];
  const totalParts = parts.length;
  const next = parts.map((part, index) => {
    const old = existing.find(c => c.part === index + 1) || {};
    const label = totalParts === 1 ? "Pago 100%" : `Pago ${index + 1}/${totalParts}`;
    const isPending = !old.status || old.status === "Pendiente";
    const dueDate = (!isPending && old.dueDate) ? old.dueDate : (index === 0 ? (q.wonDate || q.date) : (old.dueDate || ""));
    return {
      id: old.id || uid(),
      quoteId: q.id,
      currency: q.currency || "PEN",
      part: index + 1,
      label,
      dueDate,
      amount: calc.total * part,
      detraction: calc.detraction * part,
      status: old.status || "Pendiente",
      paidDate: old.paidDate || "",
      invoice: index === 0 ? (q.invoice || old.invoice || "") : (old.invoice || ""),
      bankAccount: old.bankAccount || q.bankAccount || "",
      repo: old.repo || ""
    };
  });
  targetState.collections = targetState.collections.filter(c => c.quoteId !== q.id).concat(next);
}

function renderNav() {
  const mainItems     = navItems.filter(([id]) => id !== "settings");
  const settingsItem  = navItems.find(([id]) => id === "settings");
  const btnHtml = ([id, label, iconName]) => `
    <button class="nav-btn ${id === activeView ? "active" : ""}" data-view="${id}" data-label="${label}" type="button">
      <span class="nav-icon">${icon(iconName)}</span><span class="nav-label">${label}</span>
    </button>`;
  const nav = document.querySelector("#mainNav");
  nav.innerHTML = mainItems.map(btnHtml).join("");
  const settingsEl = document.querySelector("#sidebarSettings");
  if (settingsEl && settingsItem) settingsEl.innerHTML = btnHtml(settingsItem);
  document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
    activeView = btn.dataset.view;
    showContentLoader();
    render();
    hideContentLoader(50);
  }));
}

function render() {
  dashboardRange = getCurrentRange();
  localStorage.setItem("nebumia-active-view", activeView);
  renderNav();
  syncProfileUI();
  const item = navItems.find(([id]) => id === activeView);
  const viewContent = views[activeView]();
  const hasCustomHeader = viewContent.includes("data-page-header");
  viewRoot.innerHTML = `${hasCustomHeader ? "" : `<h1 class="page-title">${item[1]}</h1>`}${viewContent}`;
  bindViewEvents();
  drawCharts();
}

const views = {
  dashboard() {
    const s = dashboardSnapshot();
    const upcoming = collectionRows().filter(r => r.status !== "Pagado").sort((a,b) => (a.dueDate||"").localeCompare(b.dueDate||"")).slice(0, 5);
    const _detModes = state.settings.collectionDetModes || {};
    const pendingDets = collectionRows().filter(c => {
      if (c.status !== "Pagado") return false;
      const dm = _detModes[c.id] || {};
      const det = autoDetraction(c, dm);
      return det > 0 && (dm.detStatus || "Completado") === "Pendiente";
    }).map(c => {
      const dm = _detModes[c.id] || {};
      return { ...c, detActual: autoDetraction(c, dm), mode: dm.mode || "cliente" };
    });
    const salesByOwner = group(s.won, "owner", q => q.total);
    const salesByCategory = group(s.won, "category", q => q.total);
    const clientSourceMap = new Map(state.clients.map(c => [c.name, c.source]));
    const wonWithSource = s.won.map(q => ({ ...q, source: clientSourceMap.get(q.client) || "" })).filter(q => q.source);
    const salesBySource = group(wonWithSource, "source", q => q.total);
    const wonBeforePeriod = state.quotes.filter(q => q.status === "Ganado" && (q.wonDate || q.date) < dashboardRange.start);
    const recurringClients = new Set(wonBeforePeriod.map(q => q.client));
    const recurringTotal = s.won.filter(q => recurringClients.has(q.client)).reduce((sum, q) => sum + q.total, 0);
    if (recurringTotal > 0) salesBySource.push({ label: "Recurrente", value: recurringTotal });
    const newClientNames = new Set(state.clients.filter(c => dateInRange(c.date)).map(c => c.name));
    const existingClientsWithQuote = new Set(
      state.quotes.filter(q => dateInRange(q.date) && !newClientNames.has(q.client)).map(q => q.client)
    );
    const leadsNew = newClientNames.size + existingClientsWithQuote.size;
    const propuestasCount = s.quotes.filter(q => q.status === "Por cotizar").length;
    const quotedCount = s.quotes.filter(q => q.status === "Cotizado").length;
    const funnelMax = Math.max(leadsNew + propuestasCount + quotedCount + s.won.length + s.lost.length, 1);
    const _allCajaRows = buildCajaRows();
    const _allColls = collectionRows();
    const accountStats = (state.settings.bankAccounts || []).map(bank => {
      const isUSD = /\$|USD|Dólar/i.test(bank);
      const currency = isUSD ? "USD" : "PEN";
      // Cobrado: paid collections assigned to this account in the period
      const cobrado = _allColls
        .filter(c => c.bankAccount === bank && c.status === "Pagado" && dateInRange(c.paidDate || c.dueDate))
        .reduce((a, c) => a + c.amount, 0);
      // Egresos: caja rows for this account (team, cashEntries, detracciones) — exclude pending
      const egresos = _allCajaRows
        .filter(r => r.bankAccount === bank && r.type === "egreso" && r.status !== "Pendiente" && dateInRange(r.date))
        .reduce((a, r) => a + r.amount, 0);
      const vendido = s.won.filter(q => q.bankAccount === bank).reduce((a, q) => a + q.total, 0);
      return { bank, currency, vendido, cobrado, egresos, balance: cobrado - egresos };
    });
    const alertCount = s.overdueCollections.length + s.pendingSunat.length + s.pendingTeam.filter(t => t.dueDate && t.dueDate < today()).length;

    return `
      ${onboardingBannerHTML()}
      ${dashboardFilterBar()}

      <!-- KPIs -->
      <div class="dash-kpi-grid" data-dash-section="metrics">
        <div class="kpi-card kpi-meta">
          ${gaugeKpi(s.goalPctPEN, s.wonThisMonthPEN, s.goal, "PEN", "Meta mensual", s.rangePeriodLabel)}
        </div>
        <div class="kpi-card">
          ${(() => {
            const wonPENTotal = s.wonPEN.reduce((a,q)=>a+q.total,0);
            const wonPct = s.goal > 0 ? Math.round(wonPENTotal / s.goal * 100) : 0;
            return `<div class="kpi-top"><span class="kpi-label">Ventas ganadas</span><span class="kpi-pct ${wonPct>=100?"kpi-pct--ok":wonPct>=50?"kpi-pct--warn":"kpi-pct--low"}">${wonPct}% meta</span></div>
            <div class="kpi-value kpi-value--blue">${fmt(wonPENTotal)}</div>
            <div class="kpi-sub">${s.wonPEN.length} ${s.wonPEN.length===1?"venta":"ventas"} · periodo</div>`;
          })()}
        </div>
        <div class="kpi-card">
          ${(() => {
            const lostAmt = s.lostPEN.reduce((a,q)=>a+calcQuote(q).total,0);
            const totalClosed = s.wonPEN.length + s.lostPEN.length;
            const lossPct = totalClosed > 0 ? Math.round(s.lostPEN.length / totalClosed * 100) : 0;
            return `<div class="kpi-top"><span class="kpi-label">Ventas perdidas</span><span class="kpi-pct kpi-pct--low">${lossPct}% tasa</span></div>
            <div class="kpi-value kpi-value--coral">${fmt(lostAmt)}</div>
            <div class="kpi-sub">${s.lostPEN.length} ${s.lostPEN.length===1?"venta perdida":"ventas perdidas"} · periodo</div>`;
          })()}
        </div>
        <div class="kpi-card">
          ${(() => {
            const openPEN = s.openQuotes.filter(q => (q.currency||"PEN") === "PEN");
            return `<div class="kpi-top"><span class="kpi-label">Pipeline activo</span></div>
            <div class="kpi-value kpi-value--purple">${fmt(s.pipelinePEN)}</div>
            <div class="kpi-sub">${openPEN.length} ${openPEN.length===1?"cotización abierta":"cotizaciones abiertas"}</div>`;
          })()}
        </div>
        <div class="kpi-card">
          ${(() => {
            const closedPEN = s.wonPEN.length + s.lostPEN.length;
            const conv = closedPEN > 0 ? Math.round(s.wonPEN.length / closedPEN * 100) : 0;
            return `<div class="kpi-top"><span class="kpi-label">Conversión</span></div>
            <div class="kpi-value kpi-value--mint">${conv}%</div>
            <div class="kpi-sub">${s.wonPEN.length} ganadas de ${closedPEN} cerradas</div>
            <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${conv}%;background:var(--mint)"></div></div>`;
          })()}
        </div>
      </div>

      <!-- KPIs USD -->
      <div class="dash-kpi-grid" data-dash-section="metrics">
        <div class="kpi-card kpi-meta">
          ${gaugeKpi(s.goalPctUSD, s.wonThisMonthUSD, s.goalUSD, "USD", "Meta mensual $", s.rangePeriodLabel)}
        </div>
        <div class="kpi-card">
          ${(() => {
            const wonUSDTotal = s.wonUSD.reduce((a,q)=>a+q.total,0);
            const wonPctUSD = s.goalUSD > 0 ? Math.round(wonUSDTotal / s.goalUSD * 100) : 0;
            return `<div class="kpi-top"><span class="kpi-label">Ventas ganadas</span><span class="kpi-pct ${wonPctUSD>=100?"kpi-pct--ok":wonPctUSD>=50?"kpi-pct--warn":"kpi-pct--low"}">${wonPctUSD}% meta</span></div>
            <div class="kpi-value kpi-value--blue">${fmt(wonUSDTotal, "USD")}</div>
            <div class="kpi-sub">${s.wonUSD.length} ${s.wonUSD.length===1?"venta":"ventas"} · periodo</div>`;
          })()}
        </div>
        <div class="kpi-card">
          ${(() => {
            const lostUSDTotal = s.lostUSD.reduce((a,q)=>a+calcQuote(q).total,0);
            const totalClosedUSD = s.wonUSD.length + s.lostUSD.length;
            const lossPctUSD = totalClosedUSD > 0 ? Math.round(s.lostUSD.length / totalClosedUSD * 100) : 0;
            return `<div class="kpi-top"><span class="kpi-label">Ventas perdidas</span><span class="kpi-pct kpi-pct--low">${lossPctUSD}% tasa</span></div>
            <div class="kpi-value kpi-value--coral">${fmt(lostUSDTotal, "USD")}</div>
            <div class="kpi-sub">${s.lostUSD.length} ${s.lostUSD.length===1?"venta perdida":"ventas perdidas"} · periodo</div>`;
          })()}
        </div>
        <div class="kpi-card">
          ${(() => {
            const openUSD = s.openQuotes.filter(q => q.currency === "USD");
            return `<div class="kpi-top"><span class="kpi-label">Pipeline activo</span></div>
            <div class="kpi-value kpi-value--purple">${fmt(s.pipelineUSD, "USD")}</div>
            <div class="kpi-sub">${openUSD.length} ${openUSD.length===1?"cotización abierta":"cotizaciones abiertas"}</div>`;
          })()}
        </div>
        <div class="kpi-card">
          ${(() => {
            const closedUSD = s.wonUSD.length + s.lostUSD.length;
            const convUSD = closedUSD > 0 ? Math.round(s.wonUSD.length / closedUSD * 100) : 0;
            return `<div class="kpi-top"><span class="kpi-label">Conversión</span></div>
            <div class="kpi-value kpi-value--mint">${convUSD}%</div>
            <div class="kpi-sub">${s.wonUSD.length} ganadas de ${closedUSD} cerradas</div>
            <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${convUSD}%;background:var(--mint)"></div></div>`;
          })()}
        </div>
      </div>

      <!-- Fila 2: Ingresos vs Egresos + Embudo comercial -->
      <div class="dash-main-grid" data-dash-grid>
        <div class="panel chart-panel" data-dash-section="revenue">
          <div class="panel-head">
            <div><h3>Ingresos vs Egresos</h3><p id="revenueChartSubtitle">vendido vs cobrado</p></div>
            <div class="chart-acct-tabs" id="revenueChartTabs">
              <button class="chart-acct-tab ${revenueChartTab===''?'active':''}" data-acct="">Todas</button>
              ${(state.settings.bankAccounts||[]).map(a=>`<button class="chart-acct-tab ${revenueChartTab===a?'active':''}" data-acct="${escapeAttr(a)}">${escapeHtml(a)}</button>`).join("")}
            </div>
          </div>
          <canvas id="revenueChart" class="chart"></canvas>
        </div>
        <div class="panel" data-dash-section="pipeline">
          <div class="panel-head"><div><h3>Embudo comercial</h3><p>Leads → cierre</p></div></div>
          <div class="funnel-flow">
            ${dashFunnelChart([
              {label:"Leads",    count:leadsNew,         color:"var(--brand)"},
              {label:"Cotizado", count:quotedCount,      color:"#0891b2"},
              {label:"Ganado",   count:s.won.length,     color:"var(--mint)"},
              {label:"Perdido",  count:s.lost.length,    color:"var(--coral)"},
            ])}
          </div>
        </div>
      </div>

      <!-- Fila 4: Por categoría + Por fuente + Comerciales -->
      <div class="dash-mid-grid" data-dash-grid>
        <div class="panel" data-dash-section="profitability">
          <div class="panel-head"><div><h3>Por categoría</h3><p>Distribución de ventas</p></div></div>
          ${salesByCategory.length ? miniBars(salesByCategory) : `<p class="fe-empty">Sin ventas en el periodo.</p>`}
        </div>
        <div class="panel" data-dash-section="salesSource">
          <div class="panel-head"><div><h3>Por fuente</h3><p>Origen de leads ganados</p></div></div>
          ${salesBySource.length ? miniBars(salesBySource) : `<p class="fe-empty">Sin datos de fuente.</p>`}
        </div>
        <div class="panel" data-dash-section="salesOwner">
          <div class="panel-head"><div><h3>Comerciales</h3><p>Ventas del periodo</p></div></div>
          ${salesByOwner.length ? `<div class="ranking-list">${salesByOwner.map((o, i) => {
            const comm = calcTeamCommission(o.label);
            return `<div class="ranking-item">
              <div class="ranking-pos">${i+1}</div>
              <div class="ranking-info">
                <strong>${escapeHtml(o.label)}</strong>
                <span>${fmt(o.value)}</span>
              </div>
              ${comm > 0 ? `<div class="ranking-comm">Comisión<strong>${fmt(comm)}</strong></div>` : ""}
            </div>`;
          }).join("")}</div>` : `<p class="fe-empty">Sin ventas en el periodo.</p>`}
        </div>
      </div>

      <!-- Fila 4: Cobros próximos + Actividad reciente -->
      <div class="dash-bottom-grid" data-dash-grid>
        <div class="panel" data-dash-section="collections">
          <div class="panel-head"><div><h3>Cobros próximos</h3><p>Pendientes ordenados por fecha</p></div></div>
          <div class="timeline">
            ${upcoming.length ? upcoming.map(r => {
              const isOverdue = r.dueDate && r.dueDate < today();
              return `<div class="timeline-item ${isOverdue ? "timeline-item--overdue" : ""}">
                <div class="timeline-row"><strong>${escapeHtml(r.client)}</strong>${badge(r.status)}</div>
                <div class="timeline-row"><span>${escapeHtml(r.label||r.code||"—")} · ${fmt(r.amount, r.currency)}</span><small>${fmtDate(r.dueDate)}</small></div>
              </div>`;
            }).join("") : `<div class="empty-state">Sin cobros pendientes.</div>`}
          </div>
          ${pendingDets.length ? `
            <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
              <p style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.04em;margin-bottom:8px">DETRACCIONES PENDIENTES</p>
              <div class="timeline">
                ${pendingDets.map(r => `
                  <div class="timeline-item timeline-item--overdue">
                    <div class="timeline-row"><strong>${escapeHtml(r.client)}</strong><span class="status pendiente">Pendiente</span></div>
                    <div class="timeline-row"><span>${r.mode === "bandu" ? "Nosotros pagamos" : "Cobrar al cliente"} · ${fmt(r.detActual, "PEN")}</span><small>${fmtDate(r.dueDate || r.paidDate)}</small></div>
                  </div>`).join("")}
              </div>
            </div>` : ""}
        </div>
        <div class="panel" data-dash-section="activity">
          <div class="panel-head"><div><h3>Ranking de clientes</h3><p>Quién más compró en el periodo</p></div></div>
          ${dashClientRanking(s.won)}
        </div>
      </div>

      <!-- Fila 6: Proyección anual -->
      <div class="panel" data-dash-section="annualProjection" style="margin-bottom:14px">
        <div class="panel-head"><div><h3>Proyección anual</h3><p>Meta mensual vs. ingresos reales ${new Date().getFullYear()}</p></div></div>
        ${annualProjectionTables()}
      </div>
    `;
  },
  leads() { activeView = "quotes"; render(); return ""; },
  quotes() {
    const quotes = state.quotes.filter(quote => dateInRange(quote.date));
    const active = quotes.filter(q => q.status === "Por cotizar" || q.status === "Cotizado");
    const won = quotes.filter(q => q.status === "Ganado");

    const totalPEN = quotes.filter(q => (q.currency || "PEN") === "PEN").reduce((sum, q) => sum + calcQuote(q).total, 0);
    const totalUSD = quotes.filter(q => q.currency === "USD").reduce((sum, q) => sum + calcQuote(q).total, 0);

    const wonPEN = won.filter(q => (q.currency || "PEN") === "PEN").reduce((sum, q) => sum + calcQuote(q).total, 0);
    const wonUSD = won.filter(q => q.currency === "USD").reduce((sum, q) => sum + calcQuote(q).total, 0);
    const convPEN = totalPEN > 0 ? Math.round(wonPEN / totalPEN * 100) : 0;
    const convUSD = totalUSD > 0 ? Math.round(wonUSD / totalUSD * 100) : 0;
    const wonNote = [
      totalPEN > 0 ? `S/ ${wonPEN.toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2})} (${convPEN}%)` : "",
      totalUSD > 0 ? `$ ${wonUSD.toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2})} (${convUSD}%)` : ""
    ].filter(Boolean).join("  ·  ") || "S/ 0.00 (0%)";

    const _pr = prevRange();
    const _prevQ = state.quotes.filter(q => dateInRange(q.date, _pr));
    const _prevActive = _prevQ.filter(q => q.status === "Por cotizar" || q.status === "Cotizado").length;
    const _prevPEN = _prevQ.filter(q => (q.currency || "PEN") === "PEN").reduce((sum, q) => sum + calcQuote(q).total, 0);
    const _prevUSD = _prevQ.filter(q => q.currency === "USD").reduce((sum, q) => sum + calcQuote(q).total, 0);
    const _prevWon = _prevQ.filter(q => q.status === "Ganado").length;
    const _fmtN = (n, sym) => `${n >= 0 ? "+" : ""}${sym ? sym + " " : ""}${Math.abs(n).toLocaleString("es-PE", {minimumFractionDigits: sym ? 2 : 0, maximumFractionDigits: sym ? 2 : 0})}`;

    return `
      <section class="metric-grid">
        ${metric("Cotizaciones activas", active.length, "Por cotizar y cotizado", active.length >= _prevActive ? "up" : "down", "", "purple", `${_fmtN(active.length - _prevActive)} vs ${_pr.label}`)}
        ${metric("Monto cotizado S/", `S/ ${totalPEN.toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2})}`, "Total con impuestos en soles", totalPEN >= _prevPEN ? "up" : "down", "", "amber", `${_fmtN(totalPEN - _prevPEN, "S/")} vs ${_pr.label}`)}
        ${metric("Monto cotizado $", `$ ${totalUSD.toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2})}`, "Total con impuestos en dólares", totalUSD >= _prevUSD ? "up" : "down", "", "blue", `${_fmtN(totalUSD - _prevUSD, "$")} vs ${_pr.label}`)}
        ${metric("Ventas generadas", won.length, wonNote, won.length >= _prevWon ? "up" : "down", "", "mint", `${_fmtN(won.length - _prevWon)} vs ${_pr.label}`)}
      </section>
      ${moduleToolbar({
        search: "Buscar cliente, PPTO o servicio",
        filters: `<select id="quoteStatus" class="filter-select"><option value="">Todos los estados</option>${options(quoteStatuses)}</select><select id="quoteYear" class="filter-select"><option value="">Todos los años</option>${Array.from({length: new Date().getFullYear() - 2021}, (_, i) => 2022 + i).reverse().map(y => `<option value="${y}">${y}</option>`).join("")}</select><select id="quoteCurrencyFilter" class="filter-select"><option value="">Todas las monedas</option><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select>`,
        action: "quote",
        metricsToggle: true
      })}
      <div id="quotesTable">${quotesTable(sortByDateDesc(quotes))}</div>
    `;
  },
  clients() {
    const allClients = sortByDateDesc(state.clients);
    const tipos = [...new Set(allClients.map(c => c.clientType).filter(Boolean))].sort();
    const paises = [...new Set(allClients.map(c => c.country).filter(Boolean))].sort();
    const rows = allClients.map(client => [
      escapeHtml(client.name),
      escapeHtml(client.ruc || "—"),
      fmtDate(client.date) || "—",
      escapeHtml(client.contact || "—"),
      client.email ? `<a href="mailto:${escapeAttr(client.email)}" class="action-link">${escapeHtml(client.email)}</a>` : "—",
      escapeHtml(client.phone || "—"),
      client.clientType ? `<span class="badge-type">${escapeHtml(client.clientType)}</span>` : "—",
      escapeHtml(client.country || "—"),
      escapeHtml(client.owner || "—"),
      clientActions(client.id)
    ]);
    const clientFilters = `
      <select data-table-filter><option value="">Todos los tipos</option>${tipos.map(t => `<option>${escapeHtml(t)}</option>`).join("")}</select>
      <select data-table-filter><option value="">Todos los países</option>${paises.map(p => `<option>${escapeHtml(p)}</option>`).join("")}</select>
    `;
    const clientsWithQuotes = new Set(state.quotes.map(q => q.client)).size;
    const clientsWithSales = new Set(wonQuotes().map(q => q.client)).size;
    const activeCountries = new Set(allClients.map(c => c.country).filter(Boolean)).size;
    return `
      <section class="metric-grid">
        ${metric("Total clientes", allClients.length, `${tipos.length} tipo${tipos.length !== 1 ? "s" : ""} registrado${tipos.length !== 1 ? "s" : ""}`, "", "", "purple")}
        ${metric("Con cotizaciones", clientsWithQuotes, "Clientes en pipeline activo", "", "", "amber")}
        ${metric("Con ventas ganadas", clientsWithSales, "Clientes con al menos 1 cierre", "", "", "mint")}
        ${metric("Países activos", activeCountries, `De ${allClients.length} clientes registrados`, "", "", "blue")}
      </section>
      ${moduleToolbar({ search: "Buscar cliente, contacto o correo", filters: clientFilters, action: "client", metricsToggle: true })}
      ${table(["Cliente", "RUC / DNI", "Fecha", "Contacto principal", "Correo electrónico", "Teléfono", "Tipo", "País", "Comercial", "Acciones"], rows, "clients")}`;

  },
  sales() {
    const sales    = sortByDateDesc(wonQuotes().filter(sale => dateInRange(sale.wonDate || sale.date)), s => s.wonDate || s.date);
    const pen      = sales.filter(s => (s.currency || "PEN") === "PEN");
    const usd      = sales.filter(s => s.currency === "USD");
    const sumFld   = (arr, fld) => arr.reduce((sum, s) => sum + (s[fld] || 0), 0);
    const penConIGV  = sumFld(pen, "total");
    const penSinIGV  = sumFld(pen, "subtotal");
    const usdConIGV  = sumFld(usd, "total");
    const usdSinIGV  = sumFld(usd, "subtotal");
    const comPEN   = sumFld(pen, "commission");
    const comUSD   = sumFld(usd, "commission");
    const penNote  = `Sin IGV: ${fmt(penSinIGV,"PEN")} · ${pen.length} ${pen.length === 1 ? "venta" : "ventas"}`;
    const usdNote  = `Sin IGV: ${fmt(usdSinIGV,"USD")} · ${usd.length} ${usd.length === 1 ? "venta" : "ventas"}`;
    const comNote  = comUSD > 0 ? `Com. $: ${fmt(comUSD,"USD")}` : "Base comercial";

    const _pr = prevRange();
    const _prevSales = wonQuotes().filter(s => dateInRange(s.wonDate || s.date, _pr));
    const _prevPen   = _prevSales.filter(s => (s.currency || "PEN") === "PEN");
    const _prevUsd   = _prevSales.filter(s => s.currency === "USD");
    const _prevPenIGV = _prevPen.reduce((sum, s) => sum + (s.total || 0), 0);
    const _prevUsdIGV = _prevUsd.reduce((sum, s) => sum + (s.total || 0), 0);
    const _prevComPEN = _prevPen.reduce((sum, s) => sum + (s.commission || 0), 0);
    const _fmtS = (n, sym) => `${n >= 0 ? "+" : "-"}${sym} ${Math.abs(n).toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    const _fmtN = (n) => `${n >= 0 ? "+" : ""}${n}`;

    return `
      <section class="metric-grid">
        ${metric("Ventas ganadas", sales.length, `${pen.length} en S/ · ${usd.length} en $`, sales.length >= _prevSales.length ? "up" : "down", "", "purple", `${_fmtN(sales.length - _prevSales.length)} vs ${_pr.label}`)}
        ${metric("Total con IGV S/", fmt(penConIGV,"PEN"), penNote, penConIGV >= _prevPenIGV ? "up" : "down", "", "amber", `${_fmtS(penConIGV - _prevPenIGV, "S/")} vs ${_pr.label}`)}
        ${metric("Total con IGV $", fmt(usdConIGV,"USD"), usdNote, usdConIGV >= _prevUsdIGV ? "up" : "down", "", "blue", `${_fmtS(usdConIGV - _prevUsdIGV, "$")} vs ${_pr.label}`)}
        ${metric("Comisiones S/", fmt(comPEN,"PEN"), comNote, comPEN >= _prevComPEN ? "up" : "down", "", "coral", `${_fmtS(comPEN - _prevComPEN, "S/")} vs ${_pr.label}`)}
      </section>
      ${moduleToolbar({
        search: "Buscar venta, cliente o servicio",
        filters: `
          <select data-table-filter class="filter-select"><option value="">Todas las monedas</option><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select>
          <select data-table-filter class="filter-select"><option value="">Todos los tipos de pago</option><option value="1 pago">1 pago</option><option value="2 pagos">2 pagos</option><option value="3 pagos">3 pagos</option></select>
        `,
        action: "sale",
        metricsToggle: true
      })}
      ${table(["PPTO","Fecha venta","Servicio","Cliente","Moneda","Sin IGV","Con IGV","IGV","Detracción","Comisión","Cuenta","Tipo pago","Estado","Acciones"], sales.map(s => {
        const cur      = s.currency || "PEN";
        const cuotas   = Number(s.cuotas) || 1;
        const tipoPago = cuotas === 3 ? "3 pagos" : cuotas === 2 ? "2 pagos" : "1 pago";
        return [
          displayCode(s.code), fmtDate(s.wonDate || s.date),
          `<div class="cell-clamp2">${escapeHtml(s.service)}</div>`,
          escapeHtml(s.client),
          cur,
          fmt(s.subtotal, cur), fmt(s.total || (s.subtotal + s.igv), cur), fmt(s.igv, cur),
          fmt(s.detraction, cur), fmt(s.commission, cur),
          escapeHtml(s.bankAccount || "—"),
          tipoPago,
          badge(s.status),
          `<div class="row-actions"><button class="action-link" data-edit-sale="${s.id}" type="button">${icon("edit")}<span>Editar</span></button></div>`
        ];
      }), "sales")}`;

  },
  collections() {
    const allColls  = sortByDateDesc(collectionRows().filter(row => dateInRange(row.dueDate || row.wonDate)), r => r.dueDate || r.wonDate);
    const paid      = allColls.filter(row => row.status === "Pagado");
    const pending   = allColls.filter(row => row.status !== "Pagado");
    const overdue   = allColls.filter(row => row.status === "Vencido");
    const sumCur    = (arr, cur) => arr.filter(r => (r.currency || "PEN") === cur).reduce((s, r) => s + r.amount, 0);
    const cntCur    = (arr, cur) => arr.filter(r => (r.currency || "PEN") === cur).length;
    const accounts  = [...new Set(allColls.map(r => r.bankAccount).filter(Boolean))].sort();
    const nroPagos  = [...new Set(allColls.map(r => r.label === "Pago 100%" ? "1/1" : (r.label || "").replace("Pago ", "")))].filter(Boolean).sort();

    const _pr = prevRange();
    const _prevColls = collectionRows().filter(row => dateInRange(row.dueDate || row.wonDate, _pr));
    const _prevPaid  = _prevColls.filter(row => row.status === "Pagado");
    const _prevPend  = _prevColls.filter(row => row.status !== "Pagado");
    const _cobPEN = sumCur(paid, "PEN"), _prevCobPEN = sumCur(_prevPaid, "PEN");
    const _cobUSD = sumCur(paid, "USD"), _prevCobUSD = sumCur(_prevPaid, "USD");
    const _pendPEN = sumCur(pending, "PEN"), _prevPendPEN = sumCur(_prevPend, "PEN");
    const _pendUSD = sumCur(pending, "USD"), _prevPendUSD = sumCur(_prevPend, "USD");
    const _fmtS = (n, sym) => `${n >= 0 ? "+" : "-"}${sym} ${Math.abs(n).toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2})}`;

    return `
      <section class="metric-grid">
        ${metric("Pendiente S/", fmt(_pendPEN), `${cntCur(pending,"PEN")} abiertos · ${overdue.filter(r=>(r.currency||"PEN")==="PEN").length} vencidos`, _pendPEN <= _prevPendPEN ? "up" : "down", "", "purple", `${_fmtS(_pendPEN - _prevPendPEN, "S/")} pendiente vs ${_pr.label}`)}
        ${metric("Pendiente $", fmt(_pendUSD,"USD"), `${cntCur(pending,"USD")} abiertos`, _pendUSD <= _prevPendUSD ? "up" : "down", "", "blue", `${_fmtS(_pendUSD - _prevPendUSD, "$")} pendiente vs ${_pr.label}`)}
        ${metric("Cobrado S/", fmt(_cobPEN), `${cntCur(paid,"PEN")} recibidos`, _cobPEN >= _prevCobPEN ? "up" : "down", "", "mint", `${_fmtS(_cobPEN - _prevCobPEN, "S/")} vs ${_pr.label}`)}
        ${metric("Cobrado $", fmt(_cobUSD,"USD"), `${cntCur(paid,"USD")} recibidos`, _cobUSD >= _prevCobUSD ? "up" : "down", "", "amber", `${_fmtS(_cobUSD - _prevCobUSD, "$")} vs ${_pr.label}`)}
      </section>
      ${moduleToolbar({
        search: "Buscar cliente, PPTO o cobro",
        filters: `
          <select data-table-filter class="filter-select"><option value="">Todos los estados</option>${options(paymentStatuses)}</select>
          <select data-table-filter class="filter-select"><option value="">Todas las monedas</option><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select>
          <select data-table-filter class="filter-select"><option value="">Todas las cuentas</option>${accounts.map(a => `<option value="${escapeAttr(a)}">${escapeHtml(a)}</option>`).join("")}</select>
          <select data-table-filter class="filter-select"><option value="">Todos los nros de pago</option>${nroPagos.map(n => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join("")}</select>
          <select data-table-filter class="filter-select"><option value="">Todos los tipos</option><option value="1 pago">1 pago</option><option value="2 pagos">2 pagos</option><option value="3 pagos">3 pagos</option></select>
        `,
        metricsToggle: true
      })}
      ${table(["PPTO","Fecha venta","Servicio","Cliente","Factura","Fecha PP","Fecha RP","Moneda","Total","Detracción","Monto recibir","Cuenta","Nro pago","Repo","Estado","Acciones"], allColls.map(r => {
        const nroPago    = r.label === "Pago 100%" ? "1/1" : (r.label || "").replace("Pago ", "");
        const totalParts = nroPago === "1/1" ? 1 : (parseInt(nroPago.split("/")[1]) || 1);
        const tipoPago   = totalParts === 1 ? "1 pago" : totalParts + " pagos";
        const _dm = (state.settings.collectionDetModes || {})[r.id] || {};
        const detActual = autoDetraction(r, _dm);
        const netAmount  = _dm.montoReal != null ? _dm.montoReal : (r.currency === "PEN" ? r.amount - detActual : r.amount);
        const collRepo   = r.repo || r.quote?.repo || "";
        const repoIcon   = collRepo
          ? `<a href="${escapeAttr(collRepo)}" target="_blank" rel="noopener" title="Ver repositorio" style="color:var(--brand);display:inline-flex">${icon("fileText")}</a>`
          : `<span style="color:var(--line);display:inline-flex">${icon("fileText")}</span>`;
        return [
          displayCode(r.code),
          fmtDate(r.wonDate),
          `<div class="cell-clamp2">${escapeHtml(r.service)}</div>`,
          escapeHtml(r.client),
          escapeHtml(r.invoice || "—"),
          r.dueDate ? fmtDate(r.dueDate) : "—",
          r.paidDate ? fmtDate(r.paidDate) : "—",
          r.currency || "PEN",
          fmt(r.amount, r.currency),
          detActual > 0 ? fmt(detActual, "PEN") : "—",
          fmt(netAmount, r.currency),
          escapeHtml(r.bankAccount || "—"),
          `${nroPago}<span style="display:none"> ${tipoPago}</span>`,
          repoIcon,
          badge(r.status),
          collectionActions(r)
        ];
      }), "collections")}`;

  },
  finance() {
    const banks = state.settings.bankAccounts || [];
    if (activeCajaTab === "general" && banks.length) activeCajaTab = banks[0];
    const tab = activeCajaTab || banks[0] || "";
    const q      = (document.querySelector("[data-search-finance]")?.value || "").toLowerCase();
    const fuente = document.querySelector("[data-caja-fuente]")?.value || "";
    const cat    = document.querySelector("[data-caja-cat]")?.value || "";

    const detAccount = state.settings.detractionAccount || "Detracciones";

    // Generate virtual fixed expense rows for each month in the selected range
    const assignedFixed = assignFixedExpenses();
    const fixedRows = [];
    if (assignedFixed.length) {
      let cursor = new Date(dashboardRange.start + "T00:00:00");
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const rangeEnd = new Date(dashboardRange.end + "T00:00:00");
      while (cursor <= rangeEnd) {
        const monthStr = isoDate(cursor);
        const overrides = state.settings.fixedExpenseOverrides || {};
        assignedFixed.forEach(f => {
          const monthKey = monthStr.substring(0, 7);
          const overrideKey = `${f.id}-${monthKey}`;
          const account = overrides[overrideKey] !== undefined ? overrides[overrideKey] : (f.assignedAccount || "");
          fixedRows.push({
            id: `fixed-${f.id}-${monthStr}`,
            date: monthStr,
            type: "egreso",
            concept: f.concept,
            category: f.category || "Gasto fijo",
            amount: f.amount,
            currency: f.currency,
            status: "Confirmado",
            source: "Fijo",
            sourceType: "fixedExpense",
            sourceId: f.id,
            bankAccount: account
          });
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    // Generate recurring rows for cash entries with category "Gasto fijo" (for months AFTER the original)
    const recurringEntries = (state.cashEntries || []).filter(e => e.type === "egreso" && e.category === "Gasto fijo" && e.date);
    if (recurringEntries.length) {
      let cur = new Date(dashboardRange.start + "T00:00:00");
      cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const rangeEnd2 = new Date(dashboardRange.end + "T00:00:00");
      while (cur <= rangeEnd2) {
        const monthKey = cur.getFullYear() + "-" + String(cur.getMonth() + 1).padStart(2, "0");
        const overrides = state.settings.fixedExpenseOverrides || {};
        recurringEntries.forEach(e => {
          if (monthKey <= e.date.substring(0, 7)) return; // skip original month and prior
          const overrideKey = `expense-${e.id}-${monthKey}`;
          const account = overrides[overrideKey] !== undefined ? overrides[overrideKey] : (e.bankAccount || "");
          const origDay = new Date(e.date + "T00:00:00").getDate();
          const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
          const day = String(Math.min(origDay, daysInMonth)).padStart(2, "0");
          fixedRows.push({
            id: `expense-recur-${e.id}-${monthKey}`,
            date: `${monthKey}-${day}`,
            type: "egreso",
            concept: e.concept,
            category: "Gasto fijo",
            amount: e.amount,
            currency: e.currency,
            status: "Confirmado",
            source: "Fijo",
            sourceType: "expenseRecurring",
            sourceId: e.id,
            bankAccount: account
          });
        });
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    const allCajaRows = buildCajaRows();
    const saldoRows = buildSaldoAnteriorRows(allCajaRows, tab, dashboardRange.start, dashboardRange.end);
    let all = [...allCajaRows, ...fixedRows, ...saldoRows].filter(r =>
      r.sourceType === "saldoAnterior" || (
        r.sourceType === "collection"
          ? (r.date || "") >= dashboardRange.start
          : dateInRange(r.date)
      )
    );

    // Bank tab filter
    if (tab !== "general") {
      all = all.filter(r => r.bankAccount === tab);
    }

    const matchesCaja = (r, term) =>
      (r.concept || "").toLowerCase().includes(term) ||
      (r.category || "").toLowerCase().includes(term) ||
      (r.source || "").toLowerCase().includes(term);

    const ingresos = all.filter(r => r.type === "ingreso");
    const egresos  = all.filter(r => r.type === "egreso");

    const fuentes = [...new Set(all.filter(r => r.sourceType !== "saldoAnterior").map(r => r.source).filter(Boolean))].sort();
    const cats    = [...new Set(all.filter(r => r.sourceType !== "saldoAnterior").map(r => r.category).filter(Boolean))].sort();

    const ingresosFiltered = sortByDateDesc(ingresos.filter(r =>
      r.sourceType === "saldoAnterior" ||
      ((!q || matchesCaja(r, q)) && (!fuente || r.source === fuente) && (!cat || r.category === cat))
    ));
    const egresosFiltered = sortByDateDesc(egresos.filter(r =>
      r.sourceType === "saldoAnterior" ||
      ((!q || matchesCaja(r, q)) && (!fuente || r.source === fuente) && (!cat || r.category === cat))
    ));

    const sumPEN = rows => rows.filter(r => r.currency === "PEN").reduce((s, r) => s + r.amount, 0);
    const sumUSD = rows => rows.filter(r => r.currency === "USD").reduce((s, r) => s + r.amount, 0);
    const tabCurrency = tab !== "general" && /\$|USD/i.test(tab) ? "USD" : "PEN";
    const sumTab = rows => rows.filter(r => r.currency === tabCurrency).reduce((s, r) => s + r.amount, 0);
    const totalIn  = sumTab(ingresos);
    const completedEgresos = egresos.filter(r => r.status !== "Pendiente");
    const pendingEgresos   = egresos.filter(r => r.status === "Pendiente");
    const totalOut = sumTab(completedEgresos);
    const pendingCobros = collectionRows().filter(c => {
      if (c.status === "Pagado") return false;
      if (tab !== "general") return (c.currency || "PEN") === tabCurrency && (c.bankAccount || "") === tab;
      return true;
    });
    const pending = pendingCobros.reduce((s, c) => s + c.amount, 0);

    const editBtn = row => {
      if (row.sourceType === "expense")   return `<div class="row-actions"><button class="action-link" data-edit-expense="${row.sourceId}" type="button">${icon("edit")}<span>Editar</span></button></div>`;
      if (row.sourceType === "team")       return `<div class="row-actions"><button class="action-link" data-edit-team="${row.sourceId}" type="button">${icon("edit")}<span>Editar</span></button><button class="action-link danger" data-delete-team="${row.sourceId}" type="button">${icon("trash")}</button></div>`;
      if (row.sourceType === "commission") return `<div class="row-actions"><button class="action-link" data-edit-team="${row.sourceId}" type="button">${icon("edit")}<span>Editar</span></button></div>`;
      if (row.sourceType === "tax")       return `<div class="row-actions"><button class="action-link" data-edit-taxpayment="${row.sourceId}" type="button">${icon("edit")}<span>Editar</span></button></div>`;
      if (row.sourceType === "cashEntry")   return `<div class="row-actions"><button class="action-link" data-edit-cash-entry="${row.sourceId}" type="button">${icon("edit")}<span>Editar</span></button><button class="action-link danger" data-delete-cash-entry="${row.sourceId}" type="button">${icon("trash")}</button></div>`;
      if (row.sourceType === "collection")   return `<div class="row-actions"><button class="action-link" data-edit-collection="${row.sourceId}" type="button">${icon("edit")}<span>Editar</span></button></div>`;
      if (row.sourceType === "collectionDet") return `<div class="row-actions"><button class="action-link" data-edit-collection="${row.sourceId}" type="button">${icon("edit")}<span>Editar</span></button></div>`;
      if (row.sourceType === "fixedExpense") return `<div class="row-actions"><button class="action-link" data-edit-fixed-expense="${row.sourceId}" data-edit-fixed-month="${(row.date || "").substring(0, 7)}" type="button">${icon("edit")}<span>Editar cuenta</span></button></div>`;
      if (row.sourceType === "expenseRecurring") return `<div class="row-actions"><button class="action-link" data-edit-expense-recur="${row.sourceId}" data-edit-fixed-month="${(row.date || "").substring(0, 7)}" type="button">${icon("edit")}<span>Editar cuenta</span></button></div>`;
      if (row.sourceType === "saldoAnterior") return `<div class="row-actions"><button class="action-link" data-edit-saldo="${escapeAttr(row._monthKey + "||" + row.bankAccount + "||" + row._signedAmount)}" type="button">${icon("edit")}<span>Editar saldo</span></button></div>`;
      return "—";
    };

    const cajaRepoIcon = r => {
      const repo = r.repo || "";
      return repo
        ? `<a href="${escapeAttr(repo)}" target="_blank" rel="noopener" title="Ver repositorio" style="color:var(--brand);display:inline-flex">${icon("fileText")}</a>`
        : `<span style="color:var(--line);display:inline-flex">${icon("fileText")}</span>`;
    };
    const cajaTable = (rows, emptyMsg, tableKey) => rows.length
      ? table(
          ["Fecha", "Concepto", "Categoría", "Fuente", "Factura", "Monto", "Acciones"],
          rows.map(r => [
            fmtDate(r.date),
            r.status === "Pendiente"
              ? `${escapeHtml(r.concept)} <span class="status pendiente" style="font-size:10px;padding:1px 6px;margin-left:4px;vertical-align:middle">Pendiente</span>`
              : escapeHtml(r.concept),
            escapeHtml(r.category),
            `<span class="source-tag">${r.source}</span>`,
            escapeHtml(r.invoice || "—"),
            r.status === "Pendiente"
              ? `<strong style="opacity:0.45">${fmt(r.amount, r.currency)}</strong>`
              : `<strong>${fmt(r.amount, r.currency)}</strong>`,
            editBtn(r)
          ]),
          tableKey
        )
      : `<div class="empty-state">${emptyMsg}</div>`;

    const tabBtn = (key, label) =>
      `<button class="caja-bank-btn ${tab === key ? "active" : ""}" data-caja-tab="${escapeAttr(key)}">${escapeHtml(label)}</button>`;

    // Periodo anterior para comparación
    const _curStart = new Date(dashboardRange.start + "T00:00:00");
    const _curEnd   = new Date(dashboardRange.end   + "T00:00:00");
    const _days     = Math.round((_curEnd - _curStart) / 86400000) + 1;
    const _prevEnd   = new Date(_curStart.getTime() - 86400000);
    const _prevStart = new Date(_prevEnd.getTime()  - (_days - 1) * 86400000);
    const _ps = _prevStart.toISOString().substring(0, 10);
    const _pe = _prevEnd.toISOString().substring(0, 10);
    let _prevAll = [...allCajaRows, ...fixedRows].filter(r => r.date >= _ps && r.date <= _pe);
    if (tab !== "general") _prevAll = _prevAll.filter(r => r.bankAccount === tab);
    const _prevIn  = _prevAll.filter(r => r.type === "ingreso" && r.currency === tabCurrency).reduce((s, r) => s + r.amount, 0);
    const _prevOut = _prevAll.filter(r => r.type === "egreso"  && r.currency === tabCurrency && r.status !== "Pendiente").reduce((s, r) => s + r.amount, 0);
    const _sym = tabCurrency === "USD" ? "$" : "S/";
    const _fmtDiff = (diff) => `${diff >= 0 ? "+" : "-"}${_sym} ${Math.abs(diff).toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    const _diffIn  = totalIn - _prevIn;
    const _diffOut = totalOut - _prevOut;
    const _diffBal = (totalIn - totalOut) - (_prevIn - _prevOut);
    const _prevLabel = _days <= 31 ? "el mes pasado" : "el periodo anterior";
    const _ttIn  = `${_fmtDiff(_diffIn)} vs ${_prevLabel}`;
    const _ttOut = `${_fmtDiff(_diffOut)} en egresos vs ${_prevLabel}`;
    const _ttBal = `${_fmtDiff(_diffBal)} en balance vs ${_prevLabel}`;

    return `
      <section class="metric-grid">
        ${metric("Ingresos", fmt(totalIn, tabCurrency), `${ingresos.filter(r=>r.currency===tabCurrency).length} movimientos en ${tabCurrency}`, _diffIn >= 0 ? "up" : "down", "", "mint", _ttIn)}
        ${metric("Egresos", fmt(totalOut, tabCurrency), `${completedEgresos.filter(r=>r.currency===tabCurrency).length} completados${pendingEgresos.filter(r=>r.currency===tabCurrency).length > 0 ? ` · ${pendingEgresos.filter(r=>r.currency===tabCurrency).length} pendientes` : ""}`, _diffOut <= 0 ? "up" : "down", "", "coral", _ttOut)}
        ${metric("Balance neto", fmt(totalIn - totalOut, tabCurrency), `Ingresos – Egresos (${tabCurrency === "USD" ? "$" : "S/"})`, _diffBal >= 0 ? "up" : "down", "", undefined, _ttBal)}
        ${metric("Por cobrar", fmt(pending, tabCurrency), `${pendingCobros.length} cobros pendientes`, "", "", "amber")}
      </section>

      <div class="module-page-header" data-page-header>
        <h1 class="page-title" style="margin-bottom:0">Caja financiera</h1>
        ${dateFilterControl()}
      </div>

      <div class="module-controls module-controls-inline">
        <div class="module-controls-left">
          <label class="module-search">${icon("search")}<input data-search-finance type="search" placeholder="Buscar concepto, categoría, fuente…" value="${q}"></label>
          ${filterPopover("caja-filters", `
            <select data-caja-fuente class="filter-select">
              <option value="">Todas las fuentes</option>
              ${fuentes.map(f => `<option ${fuente === f ? "selected" : ""}>${escapeHtml(f)}</option>`).join("")}
            </select>
            <select data-caja-cat class="filter-select">
              <option value="">Todas las categorías</option>
              ${cats.map(c => `<option ${cat === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
            </select>
          `, fuente !== "" || cat !== "")}
          ${metricsToggleBtn("finance")}
        </div>
        <div class="module-controls-right">
          <button class="secondary-action" data-export-state type="button">${icon("download")}<span>Exportar</span></button>
          <button class="create-action" data-open-cash-entry="ingreso" type="button">${icon("plus")}<span>Ingreso manual</span></button>
          <button class="create-action" data-open-cash-entry="egreso" type="button">${icon("plus")}<span>Egreso manual</span></button>
        </div>
      </div>

      <div class="caja-bank-tabs">
        ${banks.map(b => tabBtn(b, b)).join("")}
        ${allCajaRows.some(r => r.sourceType === "collectionDet") ? tabBtn(detAccount, detAccount) : ""}
      </div>

      <div class="caja-section">
        <div class="caja-section-head ingreso-head">
          <div>
            <h3>Ingresos</h3>
            <span>${ingresos.length} movimientos</span>
          </div>
          <div class="caja-section-totals">
            ${sumPEN(ingresos) ? `<strong class="caja-total-pen">S/ ${sumPEN(ingresos).toLocaleString("es-PE", {minimumFractionDigits:2})}</strong>` : ""}
            ${sumUSD(ingresos) ? `<strong class="caja-total-usd">$ ${sumUSD(ingresos).toLocaleString("es-PE", {minimumFractionDigits:2})}</strong>` : ""}
          </div>
        </div>
        ${cajaTable(ingresosFiltered, "Sin ingresos en este periodo.", "caja-in")}
      </div>

      <div class="caja-section">
        <div class="caja-section-head egreso-head">
          <div>
            <h3>Egresos</h3>
            <span>${egresos.length} movimientos</span>
          </div>
          <div class="caja-section-totals">
            ${sumPEN(egresos) ? `<strong class="caja-total-pen egreso">S/ ${sumPEN(egresos).toLocaleString("es-PE", {minimumFractionDigits:2})}</strong>` : ""}
            ${sumUSD(egresos) ? `<strong class="caja-total-usd egreso">$ ${sumUSD(egresos).toLocaleString("es-PE", {minimumFractionDigits:2})}</strong>` : ""}
          </div>
        </div>
        ${cajaTable(egresosFiltered, "Sin egresos en este periodo.", "caja-out")}
      </div>
    `;
  },
  taxes() { activeView = "comprobantes"; render(); return ""; },
  team() {
    const team = sortByDateDesc(state.team.filter(item => dateInRange(item.dueDate || monthDate(item.month))), t => t.dueDate || monthDate(t.month));
    const paidTeam = team.filter(item => item.status === "Pagado");
    const totalPlanilla = team.reduce((sum, item) => sum + item.amount, 0);
    const totalPagado   = paidTeam.reduce((sum, item) => sum + item.amount, 0);
    const totalPend     = team.filter(item => item.status !== "Pagado").reduce((sum, item) => sum + item.amount, 0);

    const _pr = prevRange();
    const _prevTeam = state.team.filter(item => dateInRange(item.dueDate || monthDate(item.month), _pr));
    const _prevPaid = _prevTeam.filter(item => item.status === "Pagado");
    const _prevTot  = _prevTeam.reduce((sum, item) => sum + item.amount, 0);
    const _prevPag  = _prevPaid.reduce((sum, item) => sum + item.amount, 0);
    const _prevPend = _prevTeam.filter(item => item.status !== "Pagado").reduce((sum, item) => sum + item.amount, 0);
    const _fmtS = (n) => `${n >= 0 ? "+" : "-"}S/ ${Math.abs(n).toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    const _fmtN = (n) => `${n >= 0 ? "+" : ""}${n}`;

    return `
      <section class="metric-grid">
        ${metric("Pagos registrados", team.length, "Movimientos del periodo", team.length >= _prevTeam.length ? "up" : "down", "", "purple", `${_fmtN(team.length - _prevTeam.length)} vs ${_pr.label}`)}
        ${metric("Total planilla", fmt(totalPlanilla), "Internos y especialistas", totalPlanilla <= _prevTot ? "up" : "down", "", "amber", `${_fmtS(totalPlanilla - _prevTot)} vs ${_pr.label}`)}
        ${metric("Pagado", fmt(totalPagado), `${paidTeam.length} pagos completados`, totalPagado >= _prevPag ? "up" : "down", "", "mint", `${_fmtS(totalPagado - _prevPag)} vs ${_pr.label}`)}
        ${metric("Pendiente", fmt(totalPend), "Por desembolsar", totalPend <= _prevPend ? "up" : "down", "", "coral", `${_fmtS(totalPend - _prevPend)} pendiente vs ${_pr.label}`)}
      </section>
      ${moduleToolbar({
        search: "Buscar persona, rol o estado",
        filters: `<select data-table-filter class="filter-select"><option value="">Todos los estados</option><option>Pagado</option><option>Pendiente</option></select><select data-table-filter class="filter-select"><option value="">Todas las monedas</option><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select>`,
        action: "payment",
        metricsToggle: true
      })}
      ${table(["Fecha de pago", "Tipo de pago", "Nombre completo", "Moneda", "Monto", "Comisión", "Banco", "Nro de cuenta", "CCI", "RHE", "Estado", "Acciones"], team.map(t => {
        const comm = profileHasCommission(t.role) ? calcTeamCommission(t.name) : null;
        return [
          fmtDate(t.dueDate || t.month), t.role, t.name,
          t.currency || "PEN", fmt(t.amount, t.currency),
          comm !== null ? `<strong style="color:var(--brand)">${fmt(comm, t.currency)}</strong>` : `<span style="color:var(--muted)">—</span>`,
          t.bankName || "—", t.accountNumber || "—", t.cci || "—",
          t.receipt
            ? `<a href="${escapeAttr(t.receipt)}" target="_blank" rel="noopener" title="Ver RHE" style="color:var(--brand)">${icon("link")}</a>`
            : `<span style="color:var(--muted)">${icon("link")}</span>`,
          badge(t.status),
          `<div class="row-actions"><button class="action-link" data-edit-team="${t.id}" type="button">${icon("edit")}<span>Editar</span></button><button class="action-link" data-copy-team="${t.id}" type="button" title="Duplicar pago">${icon("copy")}</button><button class="action-link danger" data-delete-team="${t.id}" type="button">${icon("trash")}</button></div>`
        ];
      }), "team")}`;
  },
  comprobantes() {
    const purchases = sortByDateDesc(state.purchases || []);
    const invoicedSales = sortByDateDesc(collectionRows().filter(r => ["Facturado", "Pagado", "Vencido"].includes(r.status) && dateInRange(r.dueDate || r.wonDate)), r => r.paidDate || r.dueDate);
    const taxPayments = sortByDateDesc(state.taxPayments || []);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
    const totalSales = invoicedSales.reduce((sum, s) => sum + s.amount, 0);
    const won = wonQuotes().filter(item => dateInRange(item.wonDate || item.date));
    const igvGen = won.reduce((sum, item) => sum + item.igv, 0);
    const detPaid = taxPayments.filter(t => t.type === "Detracción" && t.status === "Pagado").reduce((sum, t) => sum + t.amount, 0);
    const detBilled = collectionRows().filter(r => r.status === "Pagado").reduce((sum, r) => sum + r.detraction, 0);
    const igvPaid = taxPayments.filter(t => t.status === "Pagado").reduce((s, t) => s + t.amount, 0);

    const _pr = prevRange();
    const _prevInv = collectionRows().filter(r => ["Facturado", "Pagado", "Vencido"].includes(r.status) && dateInRange(r.dueDate || r.wonDate, _pr));
    const _prevSales = _prevInv.reduce((sum, s) => sum + s.amount, 0);
    const _prevWon   = wonQuotes().filter(item => dateInRange(item.wonDate || item.date, _pr));
    const _prevIgvGen = _prevWon.reduce((sum, item) => sum + item.igv, 0);
    const _fmtS = (n) => `${n >= 0 ? "+" : "-"}S/ ${Math.abs(n).toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2})}`;

    return `
      <section class="metric-grid">
        ${metric("Ventas facturadas", fmt(totalSales), `${invoicedSales.length} comprobantes emitidos`, totalSales >= _prevSales ? "up" : "down", "", "mint", `${_fmtS(totalSales - _prevSales)} vs ${_pr.label}`)}
        ${metric("Compras registradas", fmt(totalPurchases), `${purchases.length} comprobantes recibidos`, "", "", "amber")}
        ${metric("IGV generado", fmt(igvGen), "En ventas ganadas del periodo", igvGen >= _prevIgvGen ? "up" : "down", "", "purple", `${_fmtS(igvGen - _prevIgvGen)} vs ${_pr.label}`)}
        ${metric("Impuestos pagados SUNAT", fmt(igvPaid), `${taxPayments.filter(t => t.status === "Pagado").length} pagos · Det. saldo ${fmt(detBilled - detPaid)}`, "", "", "coral")}
      </section>

      <div class="module-page-header" data-page-header>
        <h1 class="page-title" style="margin-bottom:0">Contabilidad</h1>
        ${dateFilterControl()}
      </div>
      <div class="module-controls module-controls-inline">
        <div class="module-controls-left">
          <label class="module-search">${icon("search")}<input id="moduleSearch" type="search" placeholder="Buscar en comprobantes..."></label>
          ${metricsToggleBtn("comprobantes")}
        </div>
        <div class="module-controls-right">
          <button class="secondary-action" data-import-state type="button">${icon("upload")}<span>Importar</span></button>
          <button class="secondary-action" data-export-state type="button">${icon("download")}<span>Exportar</span></button>
          <button class="create-action" data-module-action="invoicedSale" type="button">${icon("plus")}<span>Reg. de venta</span></button>
          <button class="create-action" data-module-action="purchase" type="button">${icon("plus")}<span>Reg. de compra</span></button>
          <button class="create-action" data-module-action="taxPayment" type="button">${icon("plus")}<span>Pago SUNAT</span></button>
          <button class="create-action" data-module-action="declaracion" type="button">${icon("plus")}<span>Declaración</span></button>
        </div>
      </div>

      <div class="comp-section">
        <h2 class="comp-section-title">Registro de ventas</h2>
        ${table(["Fecha", "Concepto", "Razón Social", "Factura", "Fecha RP", "Total", "Detracción", "Monto a recibir", "Cuenta", "Nro pago", "Repositorio", "Estado", "Acciones"], invoicedSales.filter(s => s.quote?.hasIgv).map(s => {
          const nroPago = s.label === "Pago 100%" ? "1/1" : (s.label || "").replace("Pago ", "");
          const dm = (state.settings.collectionDetModes || {})[s.id] || {};
          const detActual = autoDetraction(s, dm);
          const netAmount = dm.montoReal != null ? dm.montoReal : (s.currency === "PEN" ? s.amount - detActual : s.amount);
          const declaredStatus = s.declared || "Sin declarar";
          const sRepo = s.repo || s.quote?.repo || "";
          const sRepoIcon = sRepo
            ? `<a href="${escapeAttr(sRepo)}" target="_blank" rel="noopener" title="Ver repositorio" style="color:var(--brand);display:inline-flex">${icon("fileText")}</a>`
            : `<span style="color:var(--line);display:inline-flex">${icon("fileText")}</span>`;
          return [
            fmtDate(s.dueDate || s.wonDate),
            `<div class="cell-clamp2">${escapeHtml(s.service)}</div>`,
            escapeHtml(s.client),
            escapeHtml(s.invoice || "—"),
            s.paidDate ? fmtDate(s.paidDate) : "—",
            `<strong>${fmt(s.amount, s.currency)}</strong>`,
            detActual > 0 ? fmt(detActual, "PEN") : "—",
            fmt(netAmount, s.currency),
            escapeHtml(s.bankAccount || "—"),
            nroPago,
            sRepoIcon,
            badge(declaredStatus),
            `<div class="row-actions"><button class="action-link" data-edit-collection="${s.id}" type="button">${icon("edit")}<span>Editar</span></button></div>`
          ];
        }), "invoiced-sales")}
      </div>

      <div class="comp-section">
        <h2 class="comp-section-title">Registro de compras</h2>
        ${table(["Fecha", "Concepto", "Razón Social", "Factura", "Fecha RP", "Total", "Detracción", "Monto a recibir", "Cuenta", "Nro pago", "Repositorio", "Estado", "Acciones"], purchases.map(p => {
          const netAmount = p.total - (p.detraction || 0);
          const declaredStatus = p.declared || "Sin declarar";
          const repoIcon = p.repo
            ? `<a href="${escapeAttr(p.repo)}" target="_blank" rel="noopener" title="Ver repositorio" style="color:var(--brand);display:inline-flex">${icon("fileText")}</a>`
            : `<span style="color:var(--line);display:inline-flex">${icon("fileText")}</span>`;
          return [
            fmtDate(p.date),
            `<div class="cell-clamp2">${escapeHtml(p.concept)}</div>`,
            escapeHtml(p.vendor),
            escapeHtml(p.invoiceNum || "—"),
            p.paidDate ? fmtDate(p.paidDate) : "—",
            `<strong>${fmt(p.total, p.currency)}</strong>`,
            fmt(p.detraction || 0, p.currency),
            fmt(netAmount, p.currency),
            escapeHtml(p.bankAccount || "—"),
            "—",
            repoIcon,
            badge(declaredStatus),
            `<div class="row-actions"><button class="action-link" data-edit-purchase="${p.id}" type="button">${icon("edit")}<span>Editar</span></button><button class="action-link danger" data-delete-purchase="${p.id}" type="button" title="Eliminar compra">${icon("trash")}</button></div>`
          ];
        }), "purchases")}
      </div>

      <div class="comp-section">
        <h2 class="comp-section-title">Pago SUNAT</h2>
        <p class="comp-section-sub">Obligaciones generadas (facturas emitidas)</p>
        ${table(["Fecha", "Nro Pago", "Cliente", "Factura", "Subtotal", "IGV", "Total", "Detracción", "Estado Detrac.", "Acciones"], invoicedSales.filter(r => r.quote?.hasIgv).map(r => {
          const igvRate = state.settings.igvRate;
          const hasIgv = r.quote?.hasIgv;
          const subtotal = hasIgv ? r.amount / (1 + igvRate) : r.amount;
          const igv = hasIgv ? r.amount - subtotal : 0;
          const nroPago = r.label === "Pago 100%" ? "1/1" : (r.label || "").replace("Pago ", "");
          const invoiceDate = r.dueDate || r.wonDate;
          const period = invoiceDate ? new Date(invoiceDate + "T00:00:00").toLocaleString("es-PE", { month: "long", timeZone: "America/Lima" }).replace(/^\w/, c => c.toUpperCase()) : currentMonthName();
          const dm = (state.settings.collectionDetModes || {})[r.id] || {};
          const mode = dm.mode || "cliente";
          const detActual = autoDetraction(r, dm);
          const detStatus = dm.detStatus || "Completado";
          const detCell = detActual > 0 ? fmt(detActual, "PEN") : "—";
          const detBadge = mode === "bandu"
            ? badge(detStatus === "Completado" ? "Completado" : "Pendiente")
            : `<span class="status cliente">Cliente</span>`;
          const pagarBtn = mode === "bandu" && detActual > 0 && detStatus !== "Completado"
            ? `<button class="action-link" data-pay-detraction="${r.id}" data-det-amount="${detActual}" data-det-period="${escapeAttr(period)}" type="button">${icon("creditCard")}<span>Pagar</span></button>`
            : "";
          return [
            fmtDate(invoiceDate), nroPago,
            escapeHtml(r.client), escapeHtml(r.invoice || "—"),
            fmt(subtotal, r.currency), fmt(igv, r.currency),
            fmt(r.amount, r.currency), detCell, detBadge,
            `<div class="row-actions">${pagarBtn}</div>`
          ];
        }), "tax-obligations")}
        <p class="comp-section-sub" style="margin-top:24px">Detracciones pagadas</p>
        ${(() => {
          const _detModes = state.settings.collectionDetModes || {};
          // Detracciones del cliente: cobranzas Pagadas con mode=cliente y detActual > 0
          const clienteDets = invoicedSales.filter(r => r.quote?.hasIgv && r.status === "Pagado").map(r => {
            const dm = _detModes[r.id] || {};
            const mode = dm.mode || "cliente";
            if (mode !== "cliente") return null;
            const detActual = autoDetraction(r, dm);
            if (!detActual) return null;
            const invoiceDate = r.dueDate || r.wonDate;
            const igvRate = state.settings.igvRate;
            const subtotal = r.quote?.hasIgv ? r.amount / (1 + igvRate) : r.amount;
            const igv = r.quote?.hasIgv ? r.amount - subtotal : 0;
            const nroPago = r.label === "Pago 100%" ? "1/1" : (r.label || "").replace("Pago ", "");
            return { _date: r.paidDate || invoiceDate, _type: "cliente",
              row: [fmtDate(r.paidDate || invoiceDate), nroPago,
                escapeHtml(r.client), escapeHtml(r.invoice || "—"),
                fmt(subtotal, r.currency), fmt(igv, r.currency), fmt(r.amount, r.currency),
                fmt(detActual, "PEN"), `<span class="status cliente">Cliente</span>`, "—"] };
          }).filter(Boolean);
          // Detracciones manuales nuestras: taxPayments Pagado
          const manualDets = taxPayments.filter(t => (t.type === "Detracción" || t.type === "Autodetracción") && t.status === "Pagado").map(t => {
            const linkedCid = t.collectionId || (state.settings.taxPaymentCollections || {})[t.id] || "";
            const linked = linkedCid ? invoicedSales.find(r => r.id === linkedCid) : null;
            const nroPago = linked ? (linked.label === "Pago 100%" ? "1/1" : (linked.label || "").replace("Pago ", "")) : "—";
            const igvRate = state.settings.igvRate;
            const subtotal = linked?.quote?.hasIgv ? linked.amount / (1 + igvRate) : (linked?.amount ?? 0);
            const igv = linked?.quote?.hasIgv ? linked.amount - subtotal : 0;
            return { _date: t.date, _type: "manual",
              row: [fmtDate(t.date), nroPago,
                linked ? escapeHtml(linked.client) : "—", linked ? escapeHtml(linked.invoice || "—") : "—",
                linked ? fmt(subtotal, linked.currency) : "—", linked ? fmt(igv, linked.currency) : "—",
                linked ? fmt(linked.amount, linked.currency) : "—",
                fmt(t.amount, "PEN"), badge(t.status),
                `<div class="row-actions">${t.sunatRef ? `<span style="color:var(--text2);font-size:12px">${escapeHtml(t.sunatRef)}</span>` : ""}<button class="action-link" data-edit-taxpayment="${t.id}" type="button">${icon("edit")}<span>Editar</span></button><button class="action-link danger" data-delete-taxpayment="${t.id}" type="button" title="Eliminar">${icon("trash")}</button></div>`] };
          });
          const allDets = [...clienteDets, ...manualDets].sort((a, b) => (b._date || "").localeCompare(a._date || ""));
          return table(["Fecha", "Nro Pago", "Cliente", "Factura", "Subtotal", "IGV", "Total", "Detracción", "Estado Detrac.", "Acciones"],
            allDets.map(d => d.row), "tax-payments");
        })()}
      </div>

      <div class="comp-section">
        <div class="comp-section-head">
          <div>
            <h2 class="comp-section-title">Declaración mensual</h2>
            <p class="comp-section-sub">IGV 1011 · Renta 3121 · Otros pagos SUNAT</p>
          </div>
        </div>
        ${(() => {
          const declaraciones = state.declaraciones || [];
          if (!declaraciones.length) return `<div class="empty-state">Sin declaraciones registradas. Usa el botón para registrar el cierre mensual.</div>`;
          return table(
            ["Periodo", "IGV 1011", "Renta 3121", "Otro", "Concepto otro", "Total", "Estado", "Acciones"],
            declaraciones.map(d => {
              const total = d.igv1011 + d.renta3121 + d.otro;
              return [
                escapeHtml(d.period),
                fmt(d.igv1011), fmt(d.renta3121), fmt(d.otro),
                escapeHtml(d.otroConcepto || "—"),
                `<strong>${fmt(total)}</strong>`,
                badge(d.status),
                `<div class="row-actions"><button class="action-link" data-edit-declaracion="${d.id}" type="button">${icon("edit")}<span>Editar</span></button><button class="action-link danger" data-delete-declaracion="${d.id}" type="button">${icon("trash")}</button></div>`
              ];
            }), "declaraciones");
        })()}
      </div>
    `;
  },
  settings() {
    const banks = state.settings.bankAccounts || [];
    const assignedExp = assignFixedExpenses();
    const totalFixed = assignedExp.filter(f => f.currency === "PEN").reduce((s, f) => s + f.amount, 0);
    const teamMembers = [...new Map(state.team.map(t => [t.name, t])).values()];

    const settingsTabs = [
      { key: "financiero", label: "Reglas financieras" },
      { key: "metas",      label: "Metas de ventas" },
      { key: "cuentas",    label: "Cuentas bancarias" },
      { key: "gastos",     label: "Gastos fijos" },
      { key: "equipo",     label: "Equipo de ventas" },
      { key: "servicios",   label: "Servicios" },
      { key: "proveedores", label: "Proveedores" },
      { key: "categorias",  label: "Categorías" },
      { key: "fuentes",    label: "Fuentes" },
      { key: "perfiles",   label: "Perfiles" },
    ];

    const tabStrip = `<div class="caja-bank-tabs">
      ${settingsTabs.map(t => `<button class="caja-bank-btn ${activeSettingsTab === t.key ? "active" : ""}" data-settings-tab="${t.key}">${t.label}</button>`).join("")}
    </div>`;

    let tabContent = "";

    if (activeSettingsTab === "financiero") {
      tabContent = `
        <form id="settingsForm" class="panel settings-panel">
          <div class="panel-head"><div><h3>Reglas financieras</h3><p>Valores que afectan los cálculos de toda la plataforma.</p></div></div>
          <div class="form-grid">
            <label>IGV (%)<input name="igvRate" type="number" min="0" max="100" step="0.01" value="${state.settings.igvRate * 100}" required></label>
            <label>Detracción (%)<input name="detractionRate" type="number" min="0" max="100" step="0.01" value="${state.settings.detractionRate * 100}" required></label>
            <label>Umbral de detracción (S/)<input name="detractionThreshold" type="number" min="0" step="1" value="${state.settings.detractionThreshold}" required></label>
            <label>Comisión comercial (%)<input name="commissionRate" type="number" min="0" max="100" step="0.01" value="${state.settings.commissionRate * 100}" required></label>
            <label>Moneda base<select name="currency"><option value="PEN" ${state.settings.currency === "PEN" ? "selected" : ""}>Soles (PEN)</option><option value="USD" ${state.settings.currency === "USD" ? "selected" : ""}>Dólares (USD)</option></select></label>
          </div>
          <div class="settings-actions">
            <span id="settingsMessage" class="form-note"></span>
            <button class="primary-action" type="submit">${icon("check")}<span>Guardar cambios</span></button>
          </div>
        </form>`;

    } else if (activeSettingsTab === "cuentas") {
      // Detect orphaned bank account names (used in records but absent from settings list)
      const bankSet = new Set(banks);
      const allUsed = new Set([
        ...(state.quotes      || []).map(r => r.bankAccount),
        ...(state.collections || []).map(r => r.bankAccount),
        ...(state.purchases   || []).map(r => r.bankAccount),
        ...(state.cashEntries || []).map(r => r.bankAccount),
      ]);
      const orphaned = [...allUsed].filter(v => v && !bankSet.has(v));
      const orphanSection = orphaned.length ? `
        <section class="panel settings-panel" style="margin-top:16px">
          <div class="panel-head"><div><h3 style="color:var(--warning,#f59e0b)">Cuentas desactualizadas</h3>
          <p>${orphaned.length} nombre${orphaned.length>1?"s":""} de cuenta en tus registros no coincide${orphaned.length>1?"n":""} con la lista actual. Reasígnalos para sincronizar todo de golpe.</p></div></div>
          <ul class="bank-accounts-list">
            ${orphaned.map(old => `
              <li class="bank-account-item" style="gap:12px">
                <span class="bank-account-name" style="color:var(--danger,#ef4444);min-width:160px">${escapeHtml(old)}</span>
                <span style="opacity:.5">→</span>
                <select class="orphan-bank-select" data-orphan-old="${escapeAttr(old)}" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)">
                  <option value="">— Seleccionar cuenta —</option>
                  ${banks.map(b => `<option value="${escapeAttr(b)}">${escapeHtml(b)}</option>`).join("")}
                </select>
                <button class="primary-action" data-apply-orphan="${escapeAttr(old)}" type="button" style="white-space:nowrap">Aplicar</button>
              </li>`).join("")}
          </ul>
        </section>` : "";
      tabContent = `
        <section class="panel settings-panel">
          <div class="panel-head"><div><h3>Cuentas bancarias</h3><p>Cuentas para registrar cobros y movimientos de caja.</p></div></div>
          <ul class="bank-accounts-list">
            ${banks.map((a, i) => `
              <li class="bank-account-item" data-bank-idx="${i}">
                <div class="bank-account-order">
                  <button class="action-link" data-move-bank="${i}" data-dir="-1" type="button" ${i === 0 ? "disabled" : ""}>${icon("chevron-up")}</button>
                  <button class="action-link" data-move-bank="${i}" data-dir="1" type="button" ${i === banks.length - 1 ? "disabled" : ""}>${icon("chevron-down")}</button>
                </div>
                <span class="bank-account-name">${escapeHtml(a)}</span>
                <input class="bank-account-edit-input" style="display:none" value="${escapeAttr(a)}" data-bank-idx="${i}">
                <div class="bank-account-actions">
                  <button class="action-link" data-edit-bank-inline="${i}" type="button">${icon("edit")}<span>Editar</span></button>
                  <button class="action-link" data-save-bank-inline="${i}" type="button" style="display:none">${icon("check")}<span>Guardar</span></button>
                  <button class="action-link danger" data-delete-bank="${i}" type="button">${icon("trash")}</button>
                </div>
              </li>`).join("")}
          </ul>
          <form id="addBankAccountForm" class="bank-add-form">
            <input name="accountName" placeholder="Ej: CC Interbank S/" required>
            <button class="primary-action" type="submit">${icon("plus")}<span>Agregar cuenta</span></button>
          </form>
        </section>
        ${orphanSection}`;

    } else if (activeSettingsTab === "gastos") {
      tabContent = `
        <section class="panel settings-panel settings-fixed-expenses">
          <div class="panel-head">
            <div><h3>Gastos fijos</h3><p>Conceptos recurrentes mensuales. Se asignan a la Cuenta Corriente si tiene saldo suficiente, si no a la Cuenta Personal.</p></div>
          </div>
          ${assignedExp.length ? `
          <table class="fixed-exp-table">
            <thead><tr><th>Concepto</th><th>Categoría</th><th>Monto</th><th>Moneda</th><th>Cuenta asignada</th><th></th></tr></thead>
            <tbody>
              ${assignedExp.map((f, i) => {
                const isCC = /Corriente/i.test(f.assignedAccount);
                return `
                <tr data-fixed-idx="${i}">
                  <td><span class="fe-text">${escapeHtml(f.concept)}</span><input class="fe-input" style="display:none" name="concept" value="${escapeAttr(f.concept)}"></td>
                  <td><span class="fe-text">${escapeHtml(f.category)}</span><input class="fe-input" style="display:none" name="category" value="${escapeAttr(f.category)}"></td>
                  <td><span class="fe-text">${fmt(f.amount, f.currency)}</span><input class="fe-input" style="display:none" name="amount" type="number" step="0.01" min="0" value="${f.amount}"></td>
                  <td><span class="fe-text">${f.currency}</span><select class="fe-input" style="display:none" name="currency"><option ${f.currency === "PEN" ? "selected" : ""}>PEN</option><option ${f.currency === "USD" ? "selected" : ""}>USD</option></select></td>
                  <td><span class="fe-account-tag ${isCC ? "cc" : "cp"}">${escapeHtml(f.assignedAccount)}</span></td>
                  <td>
                    <div class="bank-account-actions">
                      <button class="action-link fe-edit" data-fe-edit="${i}" type="button">${icon("edit")}<span>Editar</span></button>
                      <button class="action-link fe-save" data-fe-save="${i}" type="button" style="display:none">${icon("check")}<span>Guardar</span></button>
                      <button class="action-link danger" data-fe-delete="${i}" type="button">${icon("trash")}</button>
                    </div>
                  </td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>` : `<p class="fe-empty">No hay gastos fijos registrados.</p>`}
          <form id="addFixedExpenseForm" class="fe-add-form">
            <input name="concept" placeholder="Concepto (Ej: Alquiler oficina)" required>
            <input name="category" placeholder="Categoría (Ej: Arriendo)" required>
            <input name="amount" type="number" step="0.01" min="0" placeholder="Monto" required>
            <select name="currency"><option value="PEN">S/ Soles</option><option value="USD">$ Dólares</option></select>
            <button class="primary-action" type="submit">${icon("plus")}<span>Agregar</span></button>
          </form>
        </section>`;

    } else if (activeSettingsTab === "equipo") {
      const members = state.settings.teamMembers || [];
      tabContent = `
        <section class="panel settings-panel">
          <div class="panel-head"><div><h3>Equipo de ventas</h3><p>Vendedores y comerciales registrados en el sistema.</p></div></div>
          <ul class="bank-accounts-list">
            ${members.map((m, i) => `
              <li class="bank-account-item" data-member-idx="${i}">
                <div class="team-member-info">
                  <div class="team-member-avatar">${escapeHtml(m.name.trim().charAt(0).toUpperCase())}</div>
                  <span class="bank-account-name">${escapeHtml(m.name)}</span>
                  <input class="bank-account-edit-input" style="display:none" value="${escapeAttr(m.name)}" data-member-idx="${i}">
                </div>
                <div class="bank-account-actions">
                  <button class="action-link" data-edit-member-inline="${i}" type="button">${icon("edit")}<span>Editar</span></button>
                  <button class="action-link" data-save-member-inline="${i}" type="button" style="display:none">${icon("check")}<span>Guardar</span></button>
                  <button class="action-link danger" data-delete-member="${i}" type="button">${icon("trash")}</button>
                </div>
              </li>`).join("")}
          </ul>
          ${!members.length ? `<p class="fe-empty">No hay vendedores registrados.</p>` : ""}
          <form id="addTeamMemberForm" class="bank-add-form">
            <input name="memberName" placeholder="Nombre del vendedor" required>
            <button class="primary-action" type="submit">${icon("plus")}<span>Agregar</span></button>
          </form>
        </section>`;

    } else if (activeSettingsTab === "perfiles") {
      const profiles = state.profiles || [];
      tabContent = `
        <section class="panel settings-panel">
          <div class="panel-head"><div><h3>Perfiles de pago personal</h3><p>Define los roles del equipo. Los perfiles con ★ generan fila de comisión en caja financiera.</p></div></div>
          <ul class="bank-accounts-list">
            ${profiles.map((p, i) => `
              <li class="bank-account-item" data-profile-idx="${i}">
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
                  <span class="bank-account-name">${escapeHtml(p.name)}</span>
                  <input class="bank-account-edit-input" style="display:none" value="${escapeAttr(p.name)}" data-profile-idx="${i}">
                  ${p.hasCommission ? `<span class="badge-type" style="background:var(--brand-light,#e8f0fe);color:var(--brand);font-size:11px">★ Comisión</span>` : ""}
                </div>
                <div class="bank-account-actions">
                  <button class="action-link" data-toggle-profile-comm="${i}" type="button" title="${p.hasCommission ? "Quitar comisión" : "Activar comisión"}">${p.hasCommission ? icon("check") : icon("plus")}<span>${p.hasCommission ? "Comisión ON" : "Comisión OFF"}</span></button>
                  <button class="action-link" data-edit-profile-inline="${i}" type="button">${icon("edit")}<span>Editar</span></button>
                  <button class="action-link" data-save-profile-inline="${i}" type="button" style="display:none">${icon("check")}<span>Guardar</span></button>
                  <button class="action-link danger" data-delete-profile="${i}" type="button">${icon("trash")}</button>
                </div>
              </li>`).join("")}
          </ul>
          ${!profiles.length ? `<p class="fe-empty">No hay perfiles registrados.</p>` : ""}
          <form id="addProfileForm" class="bank-add-form">
            <input name="profileName" placeholder="Ej: Diseñador" required>
            <label style="display:flex;align-items:center;gap:6px;white-space:nowrap"><input type="checkbox" name="profileComm"> Aplica comisión</label>
            <button class="primary-action" type="submit">${icon("plus")}<span>Agregar perfil</span></button>
          </form>
        </section>`;

    } else if (activeSettingsTab === "fuentes") {
      const sources = state.sources || [];
      tabContent = `
        <section class="panel settings-panel">
          <div class="panel-head"><div><h3>Fuentes de clientes</h3><p>Canales y medios por los que llegan los clientes.</p></div></div>
          <ul class="bank-accounts-list">
            ${sources.map((s, i) => `
              <li class="bank-account-item" data-source-idx="${i}">
                <span class="bank-account-name">${escapeHtml(s)}</span>
                <input class="bank-account-edit-input" style="display:none" value="${escapeAttr(s)}" data-source-idx="${i}">
                <div class="bank-account-actions">
                  <button class="action-link" data-edit-source-inline="${i}" type="button">${icon("edit")}<span>Editar</span></button>
                  <button class="action-link" data-save-source-inline="${i}" type="button" style="display:none">${icon("check")}<span>Guardar</span></button>
                  <button class="action-link danger" data-delete-source="${i}" type="button">${icon("trash")}</button>
                </div>
              </li>`).join("")}
          </ul>
          ${!sources.length ? `<p class="fe-empty">No hay fuentes registradas.</p>` : ""}
          <form id="addSourceForm" class="bank-add-form">
            <input name="sourceName" placeholder="Ej: LinkedIn" required>
            <button class="primary-action" type="submit">${icon("plus")}<span>Agregar fuente</span></button>
          </form>
        </section>`;

    } else if (activeSettingsTab === "categorias") {
      const cats = state.categories || [];
      tabContent = `
        <section class="panel settings-panel">
          <div class="panel-head"><div><h3>Categorías de servicios</h3><p>Categorías para clasificar cotizaciones y ventas.</p></div></div>
          <ul class="bank-accounts-list">
            ${cats.map((c, i) => `
              <li class="bank-account-item" data-cat-idx="${i}">
                <span class="bank-account-name">${escapeHtml(c)}</span>
                <input class="bank-account-edit-input" style="display:none" value="${escapeAttr(c)}" data-cat-idx="${i}">
                <div class="bank-account-actions">
                  <button class="action-link" data-edit-cat-inline="${i}" type="button">${icon("edit")}<span>Editar</span></button>
                  <button class="action-link" data-save-cat-inline="${i}" type="button" style="display:none">${icon("check")}<span>Guardar</span></button>
                  <button class="action-link danger" data-delete-cat="${i}" type="button">${icon("trash")}</button>
                </div>
              </li>`).join("")}
          </ul>
          ${!cats.length ? `<p class="fe-empty">No hay categorías registradas.</p>` : ""}
          <form id="addCategoryForm" class="bank-add-form">
            <input name="categoryName" placeholder="Ej: Branding" required>
            <button class="primary-action" type="submit">${icon("plus")}<span>Agregar categoría</span></button>
          </form>
        </section>`;

    } else if (activeSettingsTab === "proveedores") {
      const vendors = state.vendors || [];
      tabContent = `
        <section class="panel settings-panel">
          <div class="panel-head"><div><h3>Proveedores</h3><p>Lista de proveedores con RUC para autocompletar en compras.</p></div></div>
          <ul class="bank-accounts-list">
            ${vendors.map((v, i) => `
              <li class="bank-account-item" data-vendor-idx="${i}">
                <div style="flex:1;min-width:0">
                  <span class="bank-account-name">${escapeHtml(v.name)}</span>
                  <span style="font-size:12px;color:var(--muted);margin-left:8px">${escapeHtml(v.ruc || "Sin RUC")}</span>
                </div>
                <div class="bank-account-actions">
                  <button class="action-link danger" data-delete-vendor="${i}" type="button">${icon("trash")}</button>
                </div>
              </li>`).join("")}
          </ul>
          ${!vendors.length ? `<p class="fe-empty">No hay proveedores registrados.</p>` : ""}
          <form id="addVendorForm" class="bank-add-form" style="grid-template-columns:1fr 1fr auto">
            <input name="vendorName" placeholder="Razón social / nombre" required>
            <input name="vendorRuc" placeholder="RUC (opcional)" type="text" inputmode="numeric" maxlength="11">
            <button class="primary-action" type="submit">${icon("plus")}<span>Agregar</span></button>
          </form>
        </section>`;

    } else if (activeSettingsTab === "servicios") {
      const services = state.services || [];
      tabContent = `
        <section class="panel settings-panel">
          <div class="panel-head"><div><h3>Servicios</h3><p>Catálogo de servicios disponibles para cotizaciones y ventas.</p></div></div>
          <ul class="bank-accounts-list">
            ${services.map((s, i) => `
              <li class="bank-account-item" data-service-idx="${i}">
                <span class="bank-account-name">${escapeHtml(s)}</span>
                <input class="bank-account-edit-input" style="display:none" value="${escapeAttr(s)}" data-service-idx="${i}">
                <div class="bank-account-actions">
                  <button class="action-link" data-edit-service-inline="${i}" type="button">${icon("edit")}<span>Editar</span></button>
                  <button class="action-link" data-save-service-inline="${i}" type="button" style="display:none">${icon("check")}<span>Guardar</span></button>
                  <button class="action-link danger" data-delete-service="${i}" type="button">${icon("trash")}</button>
                </div>
              </li>`).join("")}
          </ul>
          ${!services.length ? `<p class="fe-empty">No hay servicios registrados.</p>` : ""}
          <form id="addServiceForm" class="bank-add-form">
            <input name="serviceName" placeholder="Ej: Diseño web corporativo" required>
            <button class="primary-action" type="submit">${icon("plus")}<span>Agregar servicio</span></button>
          </form>
        </section>`;

    } else if (activeSettingsTab === "metas") {
      const allTargets = getSalesTargets();
      const yd = allTargets[salesTargetsYear] || { mode: "annual", annualPEN: 0, annualUSD: 0, monthly: {} };
      const tMode = yd.mode || "annual";
      const currentYear = new Date().getFullYear();
      const currentMonthNum = new Date().getMonth() + 1;
      const currentMonthMk = String(currentMonthNum).padStart(2, "0");
      const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
      const monthRows = months.map((name, i) => {
        const monthNum = i + 1;
        const mk = String(monthNum).padStart(2, "0");
        // For inputs: use raw stored value so 0 stays 0 (not overridden by fallback)
        const saved = yd.monthly?.[mk];
        const rawPen = saved != null ? Number(saved.pen ?? 0) : "";
        const rawUsd = saved != null ? Number(saved.usd ?? 0) : "";
        // For display (annual mode): use getMonthTarget which applies fallback
        const t = tMode !== "monthly" ? getMonthTarget(salesTargetsYear, monthNum) : null;
        const isCurrent = mk === currentMonthMk && salesTargetsYear === currentYear;
        return { name, mk, pen: tMode === "monthly" ? rawPen : t.pen, usd: tMode === "monthly" ? rawUsd : t.usd, isCurrent };
      });
      const totalPEN = monthRows.reduce((s, r) => s + r.pen, 0);
      const totalUSD = monthRows.reduce((s, r) => s + r.usd, 0);
      tabContent = `
        <section class="panel settings-panel">
          <div class="panel-head">
            <div><h3>Metas de ventas</h3><p>Define metas mensuales en soles y dólares. Se reflejan en el dashboard y proyección anual.</p></div>
            <select id="salesTargetYear" class="filter-select" style="min-width:90px">
              ${yearOptions.map(y => `<option value="${y}" ${y === salesTargetsYear ? "selected" : ""}>${y}</option>`).join("")}
            </select>
          </div>
          <div class="targets-mode-row">
            <label class="targets-mode-opt ${tMode === "annual" ? "active" : ""}">
              <input type="radio" name="targetsMode" value="annual" data-targets-mode="annual" ${tMode === "annual" ? "checked" : ""}> ${icon("calendar")} Meta anual <span class="targets-mode-hint">Se divide ÷12 por mes</span>
            </label>
            <label class="targets-mode-opt ${tMode === "monthly" ? "active" : ""}">
              <input type="radio" name="targetsMode" value="monthly" data-targets-mode="monthly" ${tMode === "monthly" ? "checked" : ""}> ${icon("edit")} Mensual personalizada <span class="targets-mode-hint">Definir cada mes</span>
            </label>
          </div>
          ${tMode === "annual" ? `
          <div class="targets-annual-form">
            <div class="form-grid">
              <label>Meta anual (S/)<input id="annualPEN" type="number" min="0" step="100" value="${yd.annualPEN || 0}" placeholder="Ej: 96000"></label>
              <label>Meta anual ($)<input id="annualUSD" type="number" min="0" step="100" value="${yd.annualUSD || 0}" placeholder="Ej: 24000"></label>
            </div>
            <div class="settings-actions" style="margin-top:0">
              <span class="form-note">Se distribuye ${fmt(Math.round((yd.annualPEN || 0) / 12))} / ${fmt(Math.round((yd.annualUSD || 0) / 12), "USD")} por mes</span>
              <button id="saveAnnualTargets" class="primary-action">${icon("check")}<span>Guardar</span></button>
            </div>
          </div>
          ` : ""}
          <table class="targets-table">
            <thead>
              <tr><th>Mes</th><th>Meta S/</th><th>Meta $</th></tr>
            </thead>
            <tbody>
              ${monthRows.map(r => tMode === "monthly" ? `
                <tr class="${r.isCurrent ? "targets-row-current" : ""}">
                  <td class="targets-month-name">${r.name}${r.isCurrent ? `<span class="targets-current-badge">dashboard</span>` : ""}</td>
                  <td><input class="targets-input" data-mk="${r.mk}" data-cur="pen" type="number" min="0" step="100" value="${r.pen}" placeholder="${state.settings.monthlyGoal || 0}"></td>
                  <td><input class="targets-input" data-mk="${r.mk}" data-cur="usd" type="number" min="0" step="100" value="${r.usd}" placeholder="0"></td>
                </tr>
              ` : `
                <tr class="${r.isCurrent ? "targets-row-current" : ""}">
                  <td class="targets-month-name">${r.name}${r.isCurrent ? `<span class="targets-current-badge">dashboard</span>` : ""}</td>
                  <td class="targets-cell-value">${r.pen > 0 ? fmt(r.pen) : "—"}</td>
                  <td class="targets-cell-value">${r.usd > 0 ? fmt(r.usd, "USD") : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr class="targets-total-row">
                <td>Total anual</td>
                <td class="targets-cell-value">${totalPEN > 0 ? fmt(totalPEN) : "—"}</td>
                <td class="targets-cell-value">${totalUSD > 0 ? fmt(totalUSD, "USD") : "—"}</td>
              </tr>
            </tfoot>
          </table>
          ${tMode === "monthly" ? `
          <div class="settings-actions">
            <button id="saveMonthlyTargets" class="primary-action">${icon("check")}<span>Guardar metas</span></button>
          </div>
          ` : ""}
        </section>`;
    }

    return `${tabStrip}${tabContent}`;
  }
};

function metric(label, value, note, trend = "", trendValue = "", tone = "blue", tooltip = "") {
  const toneIcon = { purple: "users", amber: "package", mint: "trending", coral: "clock", blue: "chart" }[tone] || "chart";
  const tooltipAttr = tooltip ? ` data-tooltip="${escapeAttr(tooltip)}"` : "";
  const trendDot = trend ? `<em class="metric-trend ${trend}"${tooltipAttr}>${trend === "up" ? "▲" : "▼"}</em>` : "";
  return `<article class="metric metric-${tone}"><div class="metric-top"><span>${label}</span></div><span class="metric-icon">${icon(toneIcon)}</span>${trendDot}<strong>${value}</strong><small>${note}</small></article>`;
}

function alertItem(title, note) {
  return `<div class="list-item"><div><strong>${title}</strong><span>${note}</span></div></div>`;
}

function badge(status) {
  return `<span class="status ${normalizeStatus(status)}">${status}</span>`;
}

function table(headers, rows, key = null) {
  if (!rows.length) return `<div class="empty-state">Sin registros todavia.</div>`;
  let displayRows = rows;
  let paginatorHtml = "";
  if (key) {
    const pg = getTablePage(key);
    const totalPages = Math.max(1, Math.ceil(rows.length / pg.pageSize));
    pg.page = Math.min(pg.page, totalPages);
    displayRows = rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize);
    paginatorHtml = renderPaginator(key, pg.page, totalPages, pg.pageSize, rows.length);
  }
  const cls = key ? ` class="table-${key}"` : "";
  return `<div class="table-wrap"><table${cls}><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${displayRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${paginatorHtml}`;
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
  return table(
    ["PPTO", "Fecha", "Categoría", "Servicio", "Comercial", "Cliente", "Subtotal", "IGV", "Total", "Repositorio", "Estado", "Acciones"],
    rows.map(q => {
      const c = calcQuote(q);
      const cur = q.currency || "PEN";
      const repoIcon = q.repo
        ? `<a href="${escapeAttr(q.repo)}" target="_blank" rel="noopener" title="Ver repositorio" style="color:var(--brand);display:inline-flex">${icon("fileText")}</a>`
        : `<span style="color:var(--line);display:inline-flex">${icon("fileText")}</span>`;
      return [
        displayCode(q.code),
        fmtDate(q.date || q.month),
        escapeHtml(q.category || "—"),
        escapeHtml(q.service),
        escapeHtml(q.owner || "—"),
        escapeHtml(q.client),
        fmt(q.subtotal, cur),
        fmt(c.igv, cur),
        `<strong>${fmt(c.total, cur)}</strong>`,
        repoIcon,
        badge(q.status),
        quoteActions(q)
      ];
    }),
    "quotes"
  );
}

function quoteActions(q) {
  return `
    <div class="row-actions">
      <button class="action-link" data-edit-quote="${q.id}" type="button">${icon("edit")}<span>Editar</span></button>
      <button class="action-link" data-copy-quote="${q.id}" type="button" title="Duplicar cotización">${icon("copy")}</button>
      <button class="action-link danger" data-delete-quote="${q.id}" type="button" title="Eliminar cotización">${icon("trash")}</button>
    </div>
  `;
}

function duplicateQuote(id) {
  const original = state.quotes.find(q => q.id === id);
  if (!original) return;
  const copy = { ...original, id: uid(), code: nextQuoteCode(), status: "Por cotizar", leadId: "", date: today(), wonDate: "", month: currentMonthName() };
  state.quotes.unshift(copy);
  saveState();
  openQuoteDialog(copy);
}

function clientActions(id) {
  return `<div class="row-actions"><button class="action-link" data-edit-client="${id}" type="button">${icon("edit")}<span>Editar</span></button><button class="action-link danger" data-delete-client="${id}" type="button">${icon("trash")}</button></div>`;
}

function collectionActions(r) {
  return `<div class="row-actions"><button class="action-link" data-edit-collection="${r.id}" type="button">${icon("edit")}<span>Editar</span></button></div>`;
}

function options(values, selected = "") {
  return values.map(value => `<option ${value === selected ? "selected" : ""}>${value}</option>`).join("");
}

function ruleCard(title, copy) {
  return `<article class="panel rule-card"><h4>${title}</h4><p>${copy}</p></article>`;
}

function dashClientRanking(wonQuotes) {
  if (!wonQuotes.length) return `<div class="empty-state">Sin ventas ganadas en el periodo.</div>`;
  const map = new Map();
  wonQuotes.forEach(q => {
    const cur = q.currency || "PEN";
    const total = q.total || calcQuote(q).total;
    if (!map.has(q.client)) map.set(q.client, { pen: 0, usd: 0, count: 0 });
    const e = map.get(q.client);
    if (cur === "USD") e.usd += total; else e.pen += total;
    e.count++;
  });
  const ranked = [...map.entries()]
    .map(([client, v]) => ({ client, ...v }))
    .sort((a, b) => (b.pen + b.usd * 3.7) - (a.pen + a.usd * 3.7));
  const maxVal = ranked[0].pen + ranked[0].usd * 3.7;
  return `<div class="client-ranking">${ranked.map((r, i) => {
    const barPct = maxVal > 0 ? Math.round((r.pen + r.usd * 3.7) / maxVal * 100) : 0;
    const amts = [r.pen > 0 ? fmt(r.pen, "PEN") : "", r.usd > 0 ? fmt(r.usd, "USD") : ""].filter(Boolean).join(" · ");
    const quoteLabel = r.count === 1 ? "1 venta" : `${r.count} ventas`;
    return `<div class="ranking-item">
      <div class="ranking-row">
        <span class="ranking-pos">${i + 1}</span>
        <strong class="ranking-name">${escapeHtml(r.client)}</strong>
        <span class="ranking-amt">${amts}</span>
      </div>
      <div class="ranking-bar-wrap">
        <div class="ranking-bar" style="width:${barPct}%"></div>
        <span class="ranking-sub">${quoteLabel}</span>
      </div>
    </div>`;
  }).join("")}</div>`;
}

function dashFunnelChart(steps) {
  const W = 300, segH = 32, gap = 2;
  const totalH = steps.length * (segH + gap);
  const pcts = [1, 0.80, 0.62, 0.46, 0.32];
  const poly = i => {
    const y = i * (segH + gap);
    const wT = pcts[i] * W, wB = (pcts[i + 1] ?? pcts[i] * 0.76) * W;
    const xT = (W - wT) / 2, xB = (W - wB) / 2;
    return { pts: `${xT.toFixed(1)},${y} ${(xT+wT).toFixed(1)},${y} ${(xB+wB).toFixed(1)},${y+segH} ${xB.toFixed(1)},${y+segH}`, cy: (y + segH / 2).toFixed(1), wMin: Math.min(wT, wB), wMax: Math.max(wT, wB) };
  };
  // Render polygons first, then all text on top (unclipped so count numbers never get cut off)
  const polys = steps.map((s, i) => `<polygon points="${poly(i).pts}" fill="${s.color}"/>`).join('');
  const texts = steps.map((s, i) => {
    const { cy, wMin, wMax } = poly(i);
    const mid = W / 2;
    // Use midpoint of the narrowest width for text bounds
    const lx = (mid - wMin / 2 + 10).toFixed(1);
    const rx = (mid + wMin / 2 - 10).toFixed(1);
    return `<text x="${lx}" y="${cy}" dominant-baseline="middle" fill="white" font-size="11.5" font-weight="600" font-family="system-ui,sans-serif">${s.label}</text>` +
      `<text x="${rx}" y="${cy}" text-anchor="end" dominant-baseline="middle" fill="rgba(255,255,255,.92)" font-size="9.5" font-weight="500" font-family="system-ui,sans-serif">${s.count}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${totalH}" width="100%" style="display:block">${polys}${texts}</svg>`;
}

function dashAlerts(s) {
  const items = [];
  s.overdueCollections.forEach(c => {
    items.push(`<div class="alert-item alert-item--red">
      <div class="alert-icon">${icon("clock")}</div>
      <div class="alert-body"><strong>Cobro vencido</strong><span>${escapeHtml(c.client)} · ${fmt(c.amount, c.currency)} · venció ${fmtDate(c.dueDate)}</span></div>
    </div>`);
  });
  s.pendingSunat.forEach(t => {
    items.push(`<div class="alert-item alert-item--amber">
      <div class="alert-icon">${icon("package")}</div>
      <div class="alert-body"><strong>SUNAT pendiente</strong><span>${escapeHtml(t.type)} · ${escapeHtml(t.period)} · ${fmt(t.amount)}</span></div>
    </div>`);
  });
  s.pendingTeam.filter(t => t.dueDate && t.dueDate < today()).forEach(t => {
    items.push(`<div class="alert-item alert-item--amber">
      <div class="alert-icon">${icon("users")}</div>
      <div class="alert-body"><strong>Pago personal vencido</strong><span>${escapeHtml(t.name)} · ${fmt(t.amount, t.currency)}</span></div>
    </div>`);
  });
  return items.length
    ? `<div class="alert-list">${items.join("")}</div>`
    : `<div class="empty-state">${icon("check")} Sin alertas pendientes. Todo al día.</div>`;
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

let _filterPopoverDocListenerAdded = false;

function bindFilterPopovers() {
  document.querySelectorAll("[data-filter-toggle]").forEach(btn => {
    if (btn.dataset.bound) return;   // evita listeners duplicados en re-render parcial
    btn.dataset.bound = "1";
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const popover = document.getElementById(btn.dataset.filterToggle);
      document.querySelectorAll(".filter-popover:not(.hidden)").forEach(p => {
        if (p !== popover) p.classList.add("hidden");
      });
      popover?.classList.toggle("hidden");
    });

    const popover = document.getElementById(btn.dataset.filterToggle);
    if (!popover) return;
    const dot = btn.querySelector(".filter-dot");
    const resetBtn = popover.querySelector("[data-filter-reset]");

    const checkActive = () => {
      const active = [...popover.querySelectorAll("select")].some(s => s.value !== "");
      btn.classList.toggle("filter-active", active);
      dot?.classList.toggle("hidden", !active);
      resetBtn?.classList.toggle("hidden", !active);
    };

    popover.querySelectorAll("select").forEach(s => s.addEventListener("change", checkActive));

    resetBtn?.addEventListener("click", e => {
      e.stopPropagation();
      popover.querySelectorAll("select").forEach(s => {
        s.value = "";
        s.dispatchEvent(new Event("change", { bubbles: true }));
      });
      checkActive();
    });
  });

  if (!_filterPopoverDocListenerAdded) {
    document.addEventListener("click", e => {
      if (!e.target.closest(".filter-btn-wrap")) {
        document.querySelectorAll(".filter-popover:not(.hidden)").forEach(p => p.classList.add("hidden"));
      }
    });
    _filterPopoverDocListenerAdded = true;
  }
}

function applyDashboardSections() {
  if (activeView !== "dashboard") return;
  document.querySelectorAll("[data-dash-section]").forEach(el => {
    el.classList.toggle("dash-section-hidden", !dashboardSections.has(el.dataset.dashSection));
  });
  document.querySelectorAll("[data-dash-grid]").forEach(grid => {
    const hasVisible = [...grid.children].some(c => !c.classList.contains("dash-section-hidden"));
    grid.classList.toggle("dash-section-hidden", !hasVisible);
  });
}

function applyMetricsVisibility() {
  const visible = isMetricVisible(activeView);
  if (activeView === "dashboard") {
    document.querySelectorAll(".dash-kpi-grid").forEach(el => el.classList.toggle("metrics-hidden", !visible));
  } else {
    document.querySelectorAll(".metric-grid").forEach(el => el.classList.toggle("metrics-hidden", !visible));
  }
}

function bindMetricsToggle() {
  document.querySelectorAll("[data-metrics-toggle]").forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const next = !isMetricVisible(activeView);
      setMetricVis(activeView, next);
      applyMetricsVisibility();
      document.querySelectorAll("[data-metrics-toggle]").forEach(b => {
        b.title = next ? "Ocultar métricas" : "Mostrar métricas";
        b.setAttribute("aria-label", next ? "Ocultar métricas" : "Mostrar métricas");
        b.innerHTML = icon("layout");
        b.classList.toggle("filter-active", !next);
      });
    });
  });
}

function bindViewEvents() {
  document.getElementById("revenueChartTabs")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-acct]");
    if (!btn) return;
    revenueChartTab = btn.dataset.acct;
    document.querySelectorAll(".chart-acct-tab").forEach(b => b.classList.toggle("active", b === btn));
    drawCharts();
  });
  bindFilters();
  bindDashboardDateFilter();
  bindDashboardQuickFilters();
  bindModuleToolbar();
  bindFilterPopovers();
  bindMetricsToggle();
  applyMetricsVisibility();
  applyDashboardSections();
  bindActions("[data-edit-lead]", id => openLeadDialog(state.leads.find(x => x.id === id)));
  bindActions("[data-quote-lead]", id => quoteLead(id));
  bindActions("[data-close-lead]", id => updateLeadStatus(id, "Cerrado perdido"));
  bindActions("[data-edit-quote]", id => openQuoteDialog(state.quotes.find(x => x.id === id)));
  bindActions("[data-edit-sale]", id => openSaleDialog(state.quotes.find(x => x.id === id)));
  bindActions("[data-copy-quote]", id => duplicateQuote(id));
  bindActions("[data-delete-quote]", id => {
    confirmDelete("Esta cotización y sus cobranzas asociadas serán eliminadas permanentemente.", () => {
      state.collections = state.collections.filter(c => c.quoteId !== id);
      state.quotes = state.quotes.filter(q => q.id !== id);
      saveState(); render();
    });
  });
  bindActions("[data-copy-team]", id => duplicateTeamPayment(id));
  bindActions("[data-win]", id => updateQuoteStatus(id, "Ganado"));
  bindActions("[data-lose]", id => updateQuoteStatus(id, "Perdido"));
  bindActions("[data-edit-client]", id => openClientDialog(state.clients.find(x => x.id === id)));
  bindActions("[data-delete-client]", id => {
    if (!confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) return;
    state.clients = state.clients.filter(c => c.id !== id);
    saveState(); render(); showToast("Cliente eliminado");
  });
  bindActions("[data-edit-collection]", id => openCollectionDialog(state.collections.find(x => x.id === id)));
  bindActions("[data-invoice-collection]", id => openInvoiceDialog(id));
  bindActions("[data-program-cobros]", id => openProgramarCobrosDialog(id));
  bindActions("[data-pay]", id => markCollectionPaid(id));
  bindActions("[data-edit-expense]", id => openExpenseDialog(state.expenses.find(x => x.id === id)));
  bindActions("[data-edit-team]", id => openTeamDialog(state.team.find(x => x.id === id)));
  bindActions("[data-delete-team]", id => {
    confirmDelete("Este pago será eliminado permanentemente y no se podrá restablecer.", () => {
      state.team = state.team.filter(t => t.id !== id);
      saveState(); render();
    });
  });
  bindActions("[data-edit-taxpayment]", id => openTaxPaymentDialog((state.taxPayments || []).find(x => x.id === id)));
  bindActions("[data-delete-taxpayment]", id => {
    confirmDelete("Este pago SUNAT será eliminado permanentemente.", () => {
      state.taxPayments = (state.taxPayments || []).filter(t => t.id !== id);
      saveState(); render();
    });
  });
  document.querySelectorAll("[data-pay-detraction]").forEach(btn => {
    btn.addEventListener("click", () => {
      openTaxPaymentDialog(null, {
        type: "Detracción",
        amount: Number(btn.dataset.detAmount || 0),
        period: btn.dataset.detPeriod || currentMonthName(),
        collectionId: btn.dataset.payDetraction || ""
      });
    });
  });
  bindActions("[data-edit-declaracion]", id => openDeclaracionDialog((state.declaraciones || []).find(x => x.id === id)));
  bindActions("[data-delete-declaracion]", id => {
    confirmDelete("Esta declaración será eliminada permanentemente.", () => {
      state.declaraciones = (state.declaraciones || []).filter(d => d.id !== id);
      saveState(); render();
    });
  });
  bindActions("[data-edit-purchase]", id => openPurchaseDialog((state.purchases || []).find(x => x.id === id)));
  bindActions("[data-delete-purchase]", id => {
    confirmDelete("Esta compra será eliminada permanentemente.", () => {
      state.purchases = (state.purchases || []).filter(p => p.id !== id);
      saveState(); render();
    });
  });
  bindActions("[data-edit-invoicedsale]", id => openInvoicedSaleDialog((state.invoicedSales || []).find(x => x.id === id)));
  bindActions("[data-edit-cash-entry]", id => openCashEntryDialog("egreso", (state.cashEntries || []).find(x => x.id === id)));
  document.querySelectorAll("[data-edit-fixed-expense]").forEach(btn => {
    btn.addEventListener("click", () => openFixedExpenseBankDialog(btn.dataset.editFixedExpense, btn.dataset.editFixedMonth || ""));
  });
  document.querySelectorAll("[data-edit-expense-recur]").forEach(btn => {
    btn.addEventListener("click", () => openExpenseRecurBankDialog(btn.dataset.editExpenseRecur, btn.dataset.editFixedMonth || ""));
  });
  bindActions("[data-edit-saldo]", val => {
    const [month, account, amountStr] = val.split("||");
    openSaldoInicialDialog(month, account, parseFloat(amountStr) || 0);
  });
  bindActions("[data-delete-cash-entry]", id => {
    confirmDelete("Este movimiento será eliminado permanentemente y no se podrá restablecer.", () => {
      state.cashEntries = (state.cashEntries || []).filter(e => e.id !== id);
      saveState(); render();
    });
  });
  document.querySelectorAll("[data-pag-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.pagKey;
      const pg = Number(btn.dataset.pagPage);
      if (!tablePages[key]) tablePages[key] = { page: 1, pageSize: 10 };
      tablePages[key].page = pg;
      render();
    });
  });
  document.querySelectorAll("[data-pag-size]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.pagKey;
      const size = Number(btn.dataset.pagSize);
      if (!tablePages[key]) tablePages[key] = { page: 1, pageSize: 10 };
      tablePages[key].pageSize = size;
      tablePages[key].page = 1;
      render();
    });
  });
  document.querySelectorAll("[data-caja-tab]").forEach(btn => {
    btn.addEventListener("click", () => { activeCajaTab = btn.dataset.cajaTab; render(); });
  });
  document.querySelectorAll("[data-settings-tab]").forEach(btn => {
    btn.addEventListener("click", () => { activeSettingsTab = btn.dataset.settingsTab; render(); });
  });

  // Sales targets handlers
  document.querySelector("#salesTargetYear")?.addEventListener("change", e => {
    salesTargetsYear = Number(e.target.value);
    render();
  });
  document.querySelectorAll("[data-targets-mode]").forEach(btn => {
    btn.addEventListener("change", () => {
      const all = getSalesTargets();
      const newMode = btn.dataset.targetsMode;
      if (!all[salesTargetsYear]) all[salesTargetsYear] = { mode: "annual", annualPEN: 0, annualUSD: 0, monthly: {} };
      if (newMode === "monthly" && all[salesTargetsYear].mode !== "monthly") {
        const perPEN = Math.round((all[salesTargetsYear].annualPEN || 0) / 12);
        const perUSD = Math.round((all[salesTargetsYear].annualUSD || 0) / 12);
        for (let i = 1; i <= 12; i++) {
          const mk = String(i).padStart(2, "0");
          if (!all[salesTargetsYear].monthly[mk]) all[salesTargetsYear].monthly[mk] = { pen: perPEN, usd: perUSD };
        }
      }
      all[salesTargetsYear].mode = newMode;
      setSalesTargets(all);
      render();
    });
  });
  document.querySelector("#saveAnnualTargets")?.addEventListener("click", () => {
    const all = getSalesTargets();
    if (!all[salesTargetsYear]) all[salesTargetsYear] = { mode: "annual", annualPEN: 0, annualUSD: 0, monthly: {} };
    all[salesTargetsYear].annualPEN = Number(document.querySelector("#annualPEN")?.value) || 0;
    all[salesTargetsYear].annualUSD = Number(document.querySelector("#annualUSD")?.value) || 0;
    setSalesTargets(all);
    render();
    showToast("Metas guardadas");
  });
  document.querySelector("#saveMonthlyTargets")?.addEventListener("click", () => {
    const all = getSalesTargets();
    if (!all[salesTargetsYear]) all[salesTargetsYear] = { mode: "monthly", annualPEN: 0, annualUSD: 0, monthly: {} };
    all[salesTargetsYear].mode = "monthly";
    all[salesTargetsYear].monthly = all[salesTargetsYear].monthly || {};
    document.querySelectorAll(".targets-input[data-cur='pen']").forEach(inp => {
      const mk = inp.dataset.mk;
      const usdInp = document.querySelector(`.targets-input[data-mk="${mk}"][data-cur="usd"]`);
      const penVal = inp.value.trim();
      const usdVal = usdInp?.value.trim() ?? "";
      if (penVal === "" && usdVal === "") {
        delete all[salesTargetsYear].monthly[mk];
      } else {
        if (!all[salesTargetsYear].monthly[mk]) all[salesTargetsYear].monthly[mk] = { pen: 0, usd: 0 };
        all[salesTargetsYear].monthly[mk].pen = penVal === "" ? 0 : Number(penVal);
        all[salesTargetsYear].monthly[mk].usd = usdVal === "" ? 0 : Number(usdVal);
      }
    });
    all[salesTargetsYear].annualPEN = Object.values(all[salesTargetsYear].monthly).reduce((s, m) => s + (m.pen || 0), 0);
    all[salesTargetsYear].annualUSD = Object.values(all[salesTargetsYear].monthly).reduce((s, m) => s + (m.usd || 0), 0);
    setSalesTargets(all);
    render();
    showToast("Metas guardadas");
  });

  const addMemberForm = document.querySelector("#addTeamMemberForm");
  if (addMemberForm) addMemberForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("memberName").trim();
    if (!name) return;
    state.settings.teamMembers = [...(state.settings.teamMembers || []), { name }];
    saveState(); render();
    showToast("Vendedor agregado");
  });
  document.querySelectorAll("[data-edit-member-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("li");
      li.querySelector(".bank-account-name").style.display = "none";
      li.querySelector(".bank-account-edit-input").style.display = "";
      li.querySelector(".bank-account-edit-input").focus();
      btn.style.display = "none";
      li.querySelector("[data-save-member-inline]").style.display = "";
    });
  });
  document.querySelectorAll("[data-save-member-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.saveMemberInline);
      const li = btn.closest("li");
      const newName = li.querySelector(".bank-account-edit-input").value.trim();
      if (!newName) return;
      state.settings.teamMembers[i] = { ...state.settings.teamMembers[i], name: newName };
      saveState(); render();
      showToast("Vendedor actualizado");
    });
  });
  document.querySelectorAll("[data-delete-member]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.deleteMember);
    confirmDelete("Este vendedor será eliminado de la lista y no se podrá restablecer.", () => {
      state.settings.teamMembers = state.settings.teamMembers.filter((_, idx) => idx !== i);
      saveState(); render();
    });
  }));
  const addProfileForm = document.querySelector("#addProfileForm");
  if (addProfileForm) addProfileForm.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("profileName").trim();
    if (!name) return;
    if (!(state.profiles || []).find(p => p.name === name)) {
      state.profiles = [...(state.profiles || []), { name, hasCommission: fd.get("profileComm") === "on" }];
      saveState(); render();
      showToast("Perfil agregado");
    }
  });
  document.querySelectorAll("[data-edit-profile-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("li");
      li.querySelector(".bank-account-name").style.display = "none";
      li.querySelector(".bank-account-edit-input").style.display = "";
      li.querySelector(".bank-account-edit-input").focus();
      btn.style.display = "none";
      li.querySelector("[data-save-profile-inline]").style.display = "";
    });
  });
  document.querySelectorAll("[data-save-profile-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.saveProfileInline);
      const li = btn.closest("li");
      const newName = li.querySelector(".bank-account-edit-input").value.trim();
      if (!newName) return;
      state.profiles[i] = { ...state.profiles[i], name: newName };
      saveState(); render();
      showToast("Perfil actualizado");
    });
  });
  document.querySelectorAll("[data-toggle-profile-comm]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.toggleProfileComm);
    state.profiles[i] = { ...state.profiles[i], hasCommission: !state.profiles[i].hasCommission };
    saveState(); render();
  }));
  document.querySelectorAll("[data-delete-profile]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.deleteProfile);
    confirmDelete("Este perfil será eliminado permanentemente.", () => {
      state.profiles = state.profiles.filter((_, idx) => idx !== i);
      saveState(); render();
    });
  }));
  const addSourceForm = document.querySelector("#addSourceForm");
  if (addSourceForm) addSourceForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("sourceName").trim();
    if (!name) return;
    if (!(state.sources || []).includes(name)) {
      state.sources = [...(state.sources || []), name].sort();
      saveState(); render();
      showToast("Fuente agregada");
    }
  });
  document.querySelectorAll("[data-edit-source-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("li");
      li.querySelector(".bank-account-name").style.display = "none";
      li.querySelector(".bank-account-edit-input").style.display = "";
      li.querySelector(".bank-account-edit-input").focus();
      btn.style.display = "none";
      li.querySelector("[data-save-source-inline]").style.display = "";
    });
  });
  document.querySelectorAll("[data-save-source-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.saveSourceInline);
      const li = btn.closest("li");
      const newName = li.querySelector(".bank-account-edit-input").value.trim();
      if (!newName) return;
      state.sources[i] = newName;
      state.sources = [...state.sources].sort();
      saveState(); render();
      showToast("Fuente actualizada");
    });
  });
  document.querySelectorAll("[data-delete-source]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.deleteSource);
    confirmDelete("Esta fuente será eliminada permanentemente.", () => {
      state.sources = state.sources.filter((_, idx) => idx !== i);
      saveState(); render();
    });
  }));
  const addCategoryForm = document.querySelector("#addCategoryForm");
  if (addCategoryForm) addCategoryForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("categoryName").trim();
    if (!name) return;
    if (!(state.categories || []).includes(name)) {
      state.categories = [...(state.categories || []), name].sort();
      saveState(); render();
      showToast("Categoría agregada");
    }
  });
  document.querySelectorAll("[data-edit-cat-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("li");
      li.querySelector(".bank-account-name").style.display = "none";
      li.querySelector(".bank-account-edit-input").style.display = "";
      li.querySelector(".bank-account-edit-input").focus();
      btn.style.display = "none";
      li.querySelector("[data-save-cat-inline]").style.display = "";
    });
  });
  document.querySelectorAll("[data-save-cat-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.saveCatInline);
      const li = btn.closest("li");
      const newName = li.querySelector(".bank-account-edit-input").value.trim();
      if (!newName) return;
      state.categories[i] = newName;
      state.categories = [...state.categories].sort();
      saveState(); render();
      showToast("Categoría actualizada");
    });
  });
  document.querySelectorAll("[data-delete-cat]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.deleteCat);
    confirmDelete("Esta categoría será eliminada del catálogo permanentemente.", () => {
      state.categories = state.categories.filter((_, idx) => idx !== i);
      saveState(); render();
    });
  }));
  const addServiceForm = document.querySelector("#addServiceForm");
  if (addServiceForm) addServiceForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("serviceName").trim();
    if (!name) return;
    if (!(state.services || []).includes(name)) {
      state.services = [...(state.services || []), name].sort();
      saveState(); render();
      showToast("Servicio agregado");
    }
  });
  document.querySelector("#addVendorForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("vendorName").trim();
    const ruc  = fd.get("vendorRuc").replace(/\D/g, "").slice(0, 11);
    if (!name) return;
    if (!(state.vendors || []).some(v => v.name.toLowerCase() === name.toLowerCase())) {
      state.vendors = [...(state.vendors || []), { id: uid(), name, ruc }];
      saveState(); render();
      showToast("Proveedor agregado");
    }
  });
  document.querySelectorAll("[data-delete-vendor]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.deleteVendor);
    confirmDelete("Este proveedor será eliminado permanentemente.", () => {
      state.vendors = (state.vendors || []).filter((_, idx) => idx !== i);
      saveState(); render();
    });
  }));

  document.querySelectorAll("[data-edit-service-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("li");
      li.querySelector(".bank-account-name").style.display = "none";
      li.querySelector(".bank-account-edit-input").style.display = "";
      li.querySelector(".bank-account-edit-input").focus();
      btn.style.display = "none";
      li.querySelector("[data-save-service-inline]").style.display = "";
    });
  });
  document.querySelectorAll("[data-save-service-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.saveServiceInline);
      const li = btn.closest("li");
      const newName = li.querySelector(".bank-account-edit-input").value.trim();
      if (!newName) return;
      state.services[i] = newName;
      state.services = [...state.services].sort();
      saveState(); render();
      showToast("Servicio actualizado");
    });
  });
  document.querySelectorAll("[data-delete-service]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.deleteService);
    confirmDelete("Este servicio será eliminado del catálogo permanentemente.", () => {
      state.services = state.services.filter((_, idx) => idx !== i);
      saveState(); render();
    });
  }));
  document.querySelectorAll("[data-open-cash-entry]").forEach(btn => {
    btn.addEventListener("click", () => openCashEntryDialog(btn.dataset.openCashEntry));
  });
  document.querySelector("[data-search-finance]")?.addEventListener("input", (e) => {
    const val = e.target.value;
    render();
    const inp = document.querySelector("[data-search-finance]");
    if (inp) { inp.focus(); inp.setSelectionRange(val.length, val.length); }
  });
  document.querySelector("[data-caja-fuente]")?.addEventListener("change", () => render());
  document.querySelector("[data-caja-cat]")?.addEventListener("change", () => render());
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
      showToast("Cuenta bancaria agregada");
    }
  });
  document.querySelectorAll("[data-delete-bank]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.getAttribute("data-delete-bank"));
    confirmDelete("Esta cuenta bancaria será eliminada permanentemente y no se podrá restablecer.", () => {
      state.settings.bankAccounts = state.settings.bankAccounts.filter((_, idx) => idx !== i);
      saveState(); render();
    });
  }));
  document.querySelectorAll("[data-move-bank]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.moveBank);
    const dir = Number(btn.dataset.dir);
    const arr = [...state.settings.bankAccounts];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    state.settings.bankAccounts = arr;
    activeCajaTab = "general";
    saveState(); render();
  }));
  document.querySelectorAll("[data-edit-bank-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.editBankInline);
      const li = btn.closest("li");
      li.querySelector(".bank-account-name").style.display = "none";
      li.querySelector(".bank-account-edit-input").style.display = "";
      li.querySelector(".bank-account-edit-input").focus();
      btn.style.display = "none";
      li.querySelector("[data-save-bank-inline]").style.display = "";
    });
  });
  document.querySelectorAll("[data-save-bank-inline]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.saveBankInline);
      const li = btn.closest("li");
      const newName = li.querySelector(".bank-account-edit-input").value.trim();
      if (!newName) return;
      const oldName = state.settings.bankAccounts[i];
      state.settings.bankAccounts[i] = newName;
      if (oldName && oldName !== newName) {
        const rename = arr => arr.forEach(r => { if (r.bankAccount === oldName) r.bankAccount = newName; });
        rename(state.quotes); rename(state.collections); rename(state.purchases); rename(state.cashEntries);
      }
      saveState(); sbSync().catch(() => {}); render();
      showToast("Cuenta bancaria actualizada");
    });
  });

  document.querySelectorAll("[data-apply-orphan]").forEach(btn => {
    btn.addEventListener("click", () => {
      const oldName = btn.dataset.applyOrphan;
      const li = btn.closest("li");
      const newName = li.querySelector(".orphan-bank-select").value;
      if (!newName) { showToast("Selecciona una cuenta destino", "error"); return; }
      const rename = arr => arr.forEach(r => { if (r.bankAccount === oldName) r.bankAccount = newName; });
      rename(state.quotes); rename(state.collections); rename(state.purchases); rename(state.cashEntries);
      saveState(); sbSync().catch(() => {}); render();
      showToast(`"${oldName}" → "${newName}" aplicado a todos los registros`);
    });
  });

  const addFixedExpForm = document.querySelector("#addFixedExpenseForm");
  if (addFixedExpForm) addFixedExpForm.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const entry = { id: uid(), concept: fd.get("concept").trim(), category: fd.get("category").trim(), amount: Number(fd.get("amount")), currency: fd.get("currency") || "PEN" };
    if (!entry.concept || !entry.amount) return;
    state.settings.fixedExpenses = [...(state.settings.fixedExpenses || []), entry];
    saveState(); render();
    showToast("Gasto fijo agregado");
  });

  document.querySelectorAll("[data-fe-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tr = btn.closest("tr");
      tr.querySelectorAll(".fe-text").forEach(el => el.style.display = "none");
      tr.querySelectorAll(".fe-input").forEach(el => el.style.display = "");
      tr.querySelector(".fe-edit").style.display = "none";
      tr.querySelector(".fe-save").style.display = "";
    });
  });

  document.querySelectorAll("[data-fe-save]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.feSave);
      const tr = btn.closest("tr");
      const concept = tr.querySelector("[name=concept]").value.trim();
      const category = tr.querySelector("[name=category]").value.trim();
      const amount = Number(tr.querySelector("[name=amount]").value);
      const currency = tr.querySelector("[name=currency]").value;
      if (!concept || !amount) return;
      state.settings.fixedExpenses[i] = { ...state.settings.fixedExpenses[i], concept, category, amount, currency };
      saveState(); render();
      showToast("Gasto fijo actualizado");
    });
  });

  document.querySelectorAll("[data-fe-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.feDelete);
      confirmDelete("Este gasto fijo será eliminado permanentemente y no se podrá restablecer.", () => {
        state.settings.fixedExpenses = state.settings.fixedExpenses.filter((_, idx) => idx !== i);
        saveState(); render();
      });
    });
  });
}

function setDashboardSections(sections, filterId) {
  dashboardSections = new Set(sections);
  activeDashboardFilter = filterId || null;
  localStorage.setItem(DASH_SECTIONS_KEY, JSON.stringify([...dashboardSections]));
}

function bindDashboardQuickFilters() {
  if (activeView !== "dashboard") return;
  const allSections = ["metrics", "revenue", "pipeline", "profitability", "salesSource", "salesOwner", "collections", "activity", "annualProjection"];
  const presets = {
    all: allSections
  };

  document.querySelectorAll("[data-dashboard-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      setDashboardSections(presets[btn.dataset.dashboardPreset] || allSections, btn.dataset.dashboardPreset);
      render();
    });
  });

  document.querySelectorAll("[data-saved-dashboard-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      const filter = dashboardSavedFilters.find(f => f.id === btn.dataset.savedDashboardFilter);
      if (!filter) return;
      setDashboardSections(filter.sections, filter.id);
      render();
    });
  });

  document.querySelectorAll("[data-delete-dashboard-filter]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const id = btn.dataset.deleteDashboardFilter;
      dashboardSavedFilters = dashboardSavedFilters.filter(f => f.id !== id);
      localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(dashboardSavedFilters));
      if (activeDashboardFilter === id) activeDashboardFilter = null;
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
    const newFilter = { id: uid(), name, sections };
    dashboardSavedFilters.push(newFilter);
    localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(dashboardSavedFilters));
    setDashboardSections(sections, newFilter.id);
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
    setCurrentRange(getDashboardPreset("thisMonth"));
    render();
  });

  document.querySelectorAll("[data-date-preset]").forEach(button => {
    button.addEventListener("click", () => {
      setCurrentRange(getDashboardPreset(button.dataset.datePreset));
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
    setCurrentRange({ key: "custom", start, end, label: "Rango personalizado" });
    render();
  });
}

function saveSettings(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  state.settings = {
    ...state.settings,
    igvRate: Number(data.igvRate) / 100,
    detractionRate: Number(data.detractionRate) / 100,
    detractionThreshold: Number(data.detractionThreshold),
    commissionRate: Number(data.commissionRate) / 100,
    currency: data.currency
  };
  state.quotes.forEach(quote => syncQuoteSideEffects(state, quote));
  saveState();
  render();
  showToast("Configuración guardada");
}

function bindActions(selector, handler) {
  document.querySelectorAll(selector).forEach(btn => btn.addEventListener("click", () => handler(btn.getAttribute(selector.slice(1, -1)))));
}

// Re-enlaza solo las acciones de fila de la tabla de cotizaciones/leads tras un re-render parcial,
// sin volver a enlazar la barra (evita listeners duplicados en filtros/popovers).
function bindQuoteTableActions() {
  bindActions("[data-edit-lead]", id => openLeadDialog(state.leads.find(x => x.id === id)));
  bindActions("[data-quote-lead]", id => quoteLead(id));
  bindActions("[data-close-lead]", id => updateLeadStatus(id, "Cerrado perdido"));
  bindActions("[data-edit-quote]", id => openQuoteDialog(state.quotes.find(x => x.id === id)));
  bindActions("[data-copy-quote]", id => duplicateQuote(id));
  bindActions("[data-delete-quote]", id => {
    confirmDelete("Esta cotización y sus cobranzas asociadas serán eliminadas permanentemente.", () => {
      state.collections = state.collections.filter(c => c.quoteId !== id);
      state.quotes = state.quotes.filter(q => q.id !== id);
      saveState(); render();
    });
  });
  bindActions("[data-win]", id => updateQuoteStatus(id, "Ganado"));
  bindActions("[data-lose]", id => updateQuoteStatus(id, "Perdido"));
}

function bindFilters() {
  const quoteSearch = activeView === "quotes" ? document.querySelector("#moduleSearch") : null;
  const quoteStatus = document.querySelector("#quoteStatus");
  const quoteYear = document.querySelector("#quoteYear");
  const quoteCurrencyFilter = document.querySelector("#quoteCurrencyFilter");
  if (quoteSearch && quoteStatus && !quoteStatus.dataset.bound) {
    quoteStatus.dataset.bound = "1";
    const filter = () => {
      const term = quoteSearch.value.toLowerCase();
      const yr = quoteYear?.value || "";
      const cur = quoteCurrencyFilter?.value || "";
      const rows = sortByDateDesc(state.quotes.filter(q =>
        (yr ? q.date.startsWith(yr) : dateInRange(q.date)) &&
        (!quoteStatus.value || q.status === quoteStatus.value) &&
        (!cur || (q.currency || "PEN") === cur) &&
        [q.code, q.client, q.service].join(" ").toLowerCase().includes(term)
      ));
      document.querySelector("#quotesTable").innerHTML = quotesTable(rows);
      bindQuoteTableActions();
    };
    quoteSearch.addEventListener("input", filter);
    quoteStatus.addEventListener("change", filter);
    quoteYear?.addEventListener("change", filter);
    quoteCurrencyFilter?.addEventListener("change", filter);
  }
  const leadSearch = activeView === "leads" ? document.querySelector("#moduleSearch") : null;
  const leadStatus = document.querySelector("#leadStatus");
  if (leadSearch && leadStatus && !leadStatus.dataset.bound) {
    leadStatus.dataset.bound = "1";
    const filter = () => {
      const term = leadSearch.value.toLowerCase();
      const rows = sortByDateDesc(state.leads.filter(l => dateInRange(l.date) && (leadStatus.value === "Todos" || l.status === leadStatus.value) && [l.client, l.source, l.service].join(" ").toLowerCase().includes(term)));
      document.querySelector("#leadsTable").innerHTML = leadsTable(rows);
      bindQuoteTableActions();
    };
    leadSearch.addEventListener("input", filter);
    leadStatus.addEventListener("change", filter);
  }
}

function bindModuleToolbar() {
  const search = document.querySelector("#moduleSearch");
  const tableFilters = [...document.querySelectorAll("[data-table-filter]")];
  const filterTableRows = () => {
    const term = search?.value.trim().toLowerCase() || "";
    const active = tableFilters.map(f => f.value.toLowerCase()).filter(Boolean);
    document.querySelectorAll(".table-wrap tbody tr").forEach(row => {
      const text = row.textContent.toLowerCase();
      row.hidden = !text.includes(term) || !active.every(f => text.includes(f));
    });
  };

  if (search && !["leads", "quotes"].includes(activeView) && !search.dataset.bound) {
    search.dataset.bound = "1";
    search.addEventListener("input", () => {
      if (activeView !== "dashboard") return filterTableRows();
      const term = search.value.trim().toLowerCase();
      document.querySelectorAll(".dashboard-metrics .metric, .dashboard-grid .panel").forEach(item => {
        item.hidden = !item.textContent.toLowerCase().includes(term);
      });
    });
  }
  tableFilters.forEach(f => { if (f.dataset.bound) return; f.dataset.bound = "1"; f.addEventListener("change", filterTableRows); });

  document.querySelectorAll("[data-module-action]").forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const action = btn.dataset.moduleAction;
      if (action === "lead") openLeadDialog();
      else if (action === "client" || action === "clients") openClientDialog();
      else if (action === "finance") openExpenseDialog();
      else if (action === "team") openTeamDialog();
      else if (action === "taxPayment") openTaxPaymentDialog();
      else if (action === "purchase") openPurchaseDialog();
      else if (action === "invoicedSale") openInvoicedSaleDialog();
      else if (action === "sales") openSaleDialog();
      else if (action === "collections") openQuoteDialog();
      else if (action === "declaracion") openDeclaracionDialog();
      else openQuoteDialog();
    });
  });

  const exportBtn = document.querySelector("[data-export-state]");
  if (exportBtn && !exportBtn.dataset.bound) { exportBtn.dataset.bound = "1"; exportBtn.addEventListener("click", exportState); }
  const importBtn = document.querySelector("[data-import-state]");
  if (importBtn && !importBtn.dataset.bound) { importBtn.dataset.bound = "1"; importBtn.addEventListener("click", importState); }
}

const EXCEL_SCHEMAS = {
  clients:     { label:"Clientes",          stateKey:"clients",       viewKey:"clients",     dateFields:["date"],              numericFields:[],                                    booleanFields:[],                         cols:{name:"Cliente",ruc:"RUC/DNI",clientType:"Tipo",contact:"Contacto",email:"Correo",phone:"Teléfono",owner:"Comercial",source:"Fuente",country:"País",date:"Fecha",notes:"Notas"}, example:{name:"Empresa SAC",ruc:"20123456789",clientType:"Empresa",contact:"Juan Pérez",email:"juan@empresa.com",phone:"999888777",owner:"María López",source:"Referido",country:"Perú",date:"2024-01-15",notes:"Cliente VIP"}, getData:()=>state.clients },
  leads:       { label:"Leads",             stateKey:"leads",         viewKey:"leads",       dateFields:["date"],              numericFields:["estimatedValue"],                    booleanFields:[],                         cols:{name:"Nombre",client:"Empresa",contact:"Contacto",service:"Servicio",source:"Fuente",channel:"Canal",owner:"Comercial",status:"Estado",estimatedValue:"Valor estimado",currency:"Moneda",date:"Fecha",notes:"Notas"}, example:{name:"Ana Torres",client:"Torres Corp",contact:"ana@torres.com",service:"Diseño web",source:"LinkedIn",channel:"Redes sociales",owner:"María López",status:"Nuevo",estimatedValue:"3500",currency:"PEN",date:"2024-01-15",notes:"Interesado en paquete completo"}, getData:()=>state.leads },
  quotes:      { label:"Cotizaciones",      stateKey:"quotes",        viewKey:"quotes",      dateFields:["date","wonDate"],    numericFields:["subtotal"],                          booleanFields:["hasIgv"],                 cols:{code:"Código",client:"Cliente",service:"Servicio",category:"Categoría",owner:"Comercial",subtotal:"Subtotal",status:"Estado",paymentType:"Tipo pago",currency:"Moneda",hasIgv:"Con IGV",bankAccount:"Cuenta",repo:"Repositorio",invoice:"Factura",date:"Fecha",wonDate:"Fecha ganado",comments:"Comentarios"}, example:{code:"COT-001",client:"Empresa SAC",service:"Diseño de marca",category:"Marketing",owner:"María López",subtotal:"5000",status:"Ganado",paymentType:"split",currency:"PEN",hasIgv:"Sí",bankAccount:"CC Interbank S/",repo:"",invoice:"",date:"2024-01-10",wonDate:"2024-01-20",comments:"Incluye manual de marca"}, getData:()=>state.quotes },
  collections: { label:"Cobranzas",         stateKey:"collections",   viewKey:"collections", dateFields:["dueDate","paidDate"],numericFields:["amount","detraction"],               booleanFields:[],                         cols:{quoteId:"Cotización",label:"Cuota",dueDate:"Vencimiento",amount:"Monto",detraction:"Detracción",currency:"Moneda",status:"Estado",paidDate:"Fecha pago",invoice:"Factura",bankAccount:"Cuenta",declared:"Declarado"}, example:{quoteId:"COT-001",label:"Cuota 1 de 2",dueDate:"2024-02-01",amount:"2950",detraction:"0",currency:"PEN",status:"Pagado",paidDate:"2024-02-03",invoice:"F001-00123",bankAccount:"CC Interbank S/",declared:"Declarado"}, getData:()=>collectionRows() },
  expenses:    { label:"Gastos",            stateKey:"expenses",      viewKey:"expenses",    dateFields:["date"],              numericFields:["amount"],                            booleanFields:["refund","isAdSpend"],     cols:{date:"Fecha",concept:"Concepto",type:"Tipo",amount:"Monto",currency:"Moneda",status:"Estado",owner:"Encargado",refund:"Devolución",isAdSpend:"Pauta publicitaria",docLink:"Link documento"}, example:{date:"2024-01-05",concept:"Adobe Creative Cloud",type:"Gasto fijo",amount:"180",currency:"PEN",status:"Pendiente",owner:"Bandu",refund:"No",isAdSpend:"No",docLink:""}, getData:()=>state.expenses },
  team:        { label:"Pagos equipo",      stateKey:"team",          viewKey:"team",        dateFields:["dueDate"],           numericFields:["amount"],                            booleanFields:[],                         cols:{month:"Mes",name:"Nombre",role:"Perfil",amount:"Monto",currency:"Moneda",status:"Estado",dueDate:"Fecha",ruc:"RUC",bankName:"Banco",accountNumber:"Nro cuenta",cci:"CCI",receipt:"Link RHE",commInvoice:"Factura comisión",commRepo:"Repo comisión"}, example:{month:"2024-01",name:"Carlos Ruiz",role:"Diseñador",amount:"3500",currency:"PEN",status:"Pagado",dueDate:"2024-01-31",ruc:"10456789012",bankName:"Interbank",accountNumber:"000-000000-0-00",cci:"00300000000000000000",receipt:"",commInvoice:"",commRepo:""}, getData:()=>state.team },
  purchases:   { label:"Compras",           stateKey:"purchases",     viewKey:"comprobantes",dateFields:["date","paidDate"],   numericFields:["subtotal","igv","total","detraction"],booleanFields:[],                         cols:{date:"Fecha",vendor:"Proveedor",ruc:"RUC",invoiceType:"Tipo comprobante",invoiceNum:"N° comprobante",concept:"Concepto",subtotal:"Base imponible",igv:"IGV",total:"Total",detraction:"Detracción",currency:"Moneda",paidDate:"Fecha RP",bankAccount:"Cuenta",declared:"Estado declaración",repo:"Repositorio"}, example:{date:"2024-01-08",vendor:"Proveedor SAC",ruc:"20111222333",invoiceType:"Factura",invoiceNum:"F002-00789",concept:"Equipos de cómputo",subtotal:"2542.37",igv:"457.63",total:"3000",detraction:"0",currency:"PEN",paidDate:"",bankAccount:"CC Interbank S/",declared:"Sin declarar",repo:""}, getData:()=>state.purchases },
  sales:       { label:"Ventas facturadas", stateKey:"invoicedSales", viewKey:"sales",       dateFields:["date"],              numericFields:["subtotal","igv","total"],             booleanFields:[],                         cols:{date:"Fecha",client:"Cliente",ruc:"RUC",invoiceType:"Tipo",invoiceNum:"N° comprobante",service:"Servicio",subtotal:"Subtotal",igv:"IGV",total:"Total",currency:"Moneda"}, example:{date:"2024-01-20",client:"Empresa SAC",ruc:"20123456789",invoiceType:"Factura",invoiceNum:"F001-00123",service:"Diseño de marca",subtotal:"5000",igv:"900",total:"5900",currency:"PEN"}, getData:()=>state.invoicedSales },
  finance:     { label:"Caja",              stateKey:null,            viewKey:"finance",     dateFields:["date"],              numericFields:["amount"],                            booleanFields:[],                         cols:{date:"Fecha",type:"Tipo",concept:"Concepto",category:"Categoría",amount:"Monto",currency:"Moneda",status:"Estado",bankAccount:"Cuenta",invoice:"Factura",notes:"Notas"}, example:{date:"2024-01-15",type:"ingreso",concept:"Pago cuota 1 - Empresa SAC",category:"Cobranza",amount:"2950",currency:"PEN",status:"Confirmado",bankAccount:"BCP Soles",invoice:"",notes:""}, getData:()=>buildCajaRows() },
};

function getSchemaForView() {
  return Object.values(EXCEL_SCHEMAS).find(s => s.viewKey === activeView) || null;
}

function exportState() {
  const schema = getSchemaForView();
  if (!schema || typeof XLSX === "undefined") { exportStateJson(); return; }
  const cols = schema.cols;
  const keys = Object.keys(cols);
  const headers = Object.values(cols);
  const data = schema.getData();
  const isTemplate = !data?.length;
  const allKeys    = schema.stateKey ? ["id", ...keys] : keys;
  const allHeaders = schema.stateKey ? ["ID",  ...headers] : headers;
  const dataRows = isTemplate
    ? [allKeys.map(k => k === "id" ? "" : (schema.example?.[k] ?? ""))]
    : data.map(r => allKeys.map(k => {
        const v = r[k];
        if (typeof v === "boolean") return v ? "Sí" : "No";
        return v ?? "";
      }));
  const ws = XLSX.utils.aoa_to_sheet([allHeaders, ...dataRows]);
  const hStyle = { font:{ bold:true, color:{ rgb:"FFFFFF" } }, fill:{ fgColor:{ rgb:"4F46E5" } }, alignment:{ horizontal:"center" } };
  allHeaders.forEach((_, i) => { const c = XLSX.utils.encode_cell({r:0,c:i}); if (ws[c]) ws[c].s = hStyle; });
  if (isTemplate) {
    const eStyle = { font:{ italic:true, color:{ rgb:"94A3B8" } } };
    allKeys.forEach((_, i) => { const c = XLSX.utils.encode_cell({r:1,c:i}); if (ws[c]) ws[c].s = eStyle; });
  }
  ws["!cols"] = allHeaders.map((h, i) => ({ wch: i === 0 && h === "ID" ? 8 : Math.max(h.length + 4, 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, schema.label);
  XLSX.writeFile(wb, isTemplate ? `plantilla-${schema.label.toLowerCase().replace(/ /g,"-")}.xlsx` : `nebumia-${schema.label.toLowerCase().replace(/ /g,"-")}-${today()}.xlsx`);
  showToast(isTemplate ? "Plantilla descargada — borra la fila de ejemplo antes de importar" : "Excel exportado");
}

function exportStateJson() {
  const payload = JSON.stringify({ product:"Nebumia", exportedAt:new Date().toISOString(), state }, null, 2);
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([payload], {type:"application/json"})), download:`nebumia-respaldo-${today()}.json` });
  a.click();
}

function importState() {
  const schema = getSchemaForView();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xls,application/json,.json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.name.endsWith(".json")) { importStateJson(file); return; }
    if (!schema || typeof XLSX === "undefined") { showToast("Este módulo no soporta importación Excel"); return; }
    if (!schema.stateKey) { showToast("La Caja no soporta importación directa"); return; }
    const reader = new FileReader();
    reader.addEventListener("load", e => {
      try {
        const wb = XLSX.read(e.target.result, { type:"array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval:"", raw:false });
        if (!rawRows.length) { showToast("El archivo está vacío"); return; }

        // Invert label→key map
        const labelToKey = Object.fromEntries(Object.entries(schema.cols).map(([k,v]) => [v,k]));

        // Validate and map rows
        const dateFieldSet    = new Set(schema.dateFields    || []);
        const numericFieldSet = new Set(schema.numericFields || []);
        const booleanFieldSet = new Set(schema.booleanFields || []);
        const errors = [];
        const imported = rawRows.map((row, ri) => {
          const rowId = String(row["ID"] || "").trim();
          const obj = { id: rowId || crypto.randomUUID() };
          let hasData = false;
          for (const [label, val] of Object.entries(row)) {
            if (label === "ID") continue;
            const key = labelToKey[label];
            if (key) {
              const strVal = val === undefined ? "" : String(val).trim();
              if (dateFieldSet.has(key)) {
                obj[key] = normalizeImportDate(strVal);
              } else if (numericFieldSet.has(key)) {
                obj[key] = cleanNumericImport(strVal);
              } else if (booleanFieldSet.has(key)) {
                obj[key] = cleanBooleanImport(strVal);
              } else {
                obj[key] = strVal;
              }
              hasData = true;
            } else if (label && String(val).trim()) errors.push(`Fila ${ri+2}: columna desconocida "${label}"`);
          }
          if (!hasData) errors.push(`Fila ${ri+2}: fila vacía o sin columnas reconocidas`);
          return obj;
        }).filter(o => Object.keys(o).length > 1);

        if (!imported.length) {
          showImportErrorModal("No se encontraron datos válidos.\n\nAsegúrate de usar la plantilla descargada desde Nebumia con los encabezados correctos.", []);
          return;
        }
        showImportConfirmModal(schema, imported, errors);
      } catch (err) {
        showImportErrorModal("No se pudo leer el archivo Excel.\n\nError: " + err.message, []);
      }
    });
    reader.readAsArrayBuffer(file);
  });
  input.click();
}

function showImportConfirmModal(schema, imported, warnings) {
  const existing = (state[schema.stateKey] || []).length;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2000;display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:28px;max-width:440px;width:90%;box-shadow:0 24px 48px rgba(0,0,0,.2);">
      <h3 style="margin:0 0 8px;font-size:16px;">Confirmar importación</h3>
      <p style="margin:0 0 16px;color:var(--muted);font-size:14px;">Módulo: <strong style="color:var(--ink)">${schema.label}</strong></p>
      <div style="background:var(--surface);border-radius:10px;padding:14px 16px;margin-bottom:${warnings.length?'12px':'20px'};display:grid;gap:6px;">
        <div style="display:flex;justify-content:space-between;font-size:14px;"><span style="color:var(--muted)">Filas a importar</span><strong>${imported.length}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;"><span style="color:var(--muted)">Registros existentes</span><strong>${existing}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;"><span style="color:var(--muted)">Total tras importar</span><strong>${existing + imported.length}</strong></div>
      </div>
      ${warnings.length ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 12px;margin-bottom:20px;font-size:12px;color:#9a3412;max-height:80px;overflow-y:auto;">${warnings.slice(0,5).map(w=>`⚠ ${w}`).join("<br>")}${warnings.length>5?`<br>…y ${warnings.length-5} advertencias más`:""}</div>` : ""}
      <div style="display:flex;gap:10px;">
        <button id="importCancelBtn" style="flex:1;padding:10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink);cursor:pointer;font-size:14px;">Cancelar</button>
        <button id="importConfirmBtn" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--brand);color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Importar ${imported.length} registros</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#importCancelBtn").onclick = () => overlay.remove();
  overlay.querySelector("#importConfirmBtn").onclick = () => {
    overlay.remove();
    runImport(schema, imported);
  };
}

function showImportErrorModal(msg, errors) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2000;display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:28px;max-width:440px;width:90%;box-shadow:0 24px 48px rgba(0,0,0,.2);">
      <h3 style="margin:0 0 12px;font-size:16px;color:var(--danger);">Error en la importación</h3>
      <p style="margin:0 0 ${errors.length?'12px':'20px'};font-size:14px;color:var(--muted);white-space:pre-line;">${msg}</p>
      ${errors.length ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;margin-bottom:20px;font-size:12px;color:#991b1b;max-height:120px;overflow-y:auto;">${errors.map(e=>`✗ ${e}`).join("<br>")}</div>` : ""}
      <button onclick="this.closest('div[style]').remove()" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink);cursor:pointer;font-size:14px;">Cerrar</button>
    </div>`;
  document.body.appendChild(overlay);
}

async function runImport(schema, imported) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2000;display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:32px 28px;max-width:360px;width:90%;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,.2);">
      <div style="margin-bottom:16px;font-size:22px;">⏳</div>
      <h3 style="margin:0 0 8px;font-size:15px;" id="importProgressTitle">Importando registros…</h3>
      <p style="margin:0 0 16px;font-size:13px;color:var(--muted);" id="importProgressSub">0 de ${imported.length}</p>
      <div style="background:var(--surface);border-radius:999px;height:6px;overflow:hidden;">
        <div id="importProgressBar" style="background:var(--brand);height:100%;width:0%;transition:width .2s;border-radius:999px;"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const bar = overlay.querySelector("#importProgressBar");
  const sub = overlay.querySelector("#importProgressSub");

  // Upsert in chunks: update existing records by id, insert new ones
  const CHUNK = 20;
  let done = 0;
  state[schema.stateKey] = state[schema.stateKey] || [];
  const existingMap = new Map(state[schema.stateKey].map(r => [r.id, r]));
  let updated = 0, inserted = 0;
  for (let i = 0; i < imported.length; i += CHUNK) {
    for (const rec of imported.slice(i, i + CHUNK)) {
      if (existingMap.has(rec.id)) {
        const idx = state[schema.stateKey].findIndex(r => r.id === rec.id);
        state[schema.stateKey][idx] = { ...state[schema.stateKey][idx], ...rec };
        updated++;
      } else {
        state[schema.stateKey].push(rec);
        existingMap.set(rec.id, rec);
        inserted++;
      }
    }
    done = Math.min(i + CHUNK, imported.length);
    bar.style.width = Math.round((done / imported.length) * 100) + "%";
    sub.textContent = `${done} de ${imported.length}`;
    await new Promise(r => setTimeout(r, 60));
  }

  // Save and sync
  overlay.querySelector("#importProgressTitle").textContent = "Guardando en Supabase…";
  saveState();
  if (sbUser) {
    try { await sbSync(); } catch(e) { console.error("Sync error:", e); }
  }

  overlay.remove();
  render();
  showToast(`✓ ${schema.label}: ${inserted} nuevos, ${updated} actualizados`);
}

function importStateJson(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = migrateState(parsed.state || parsed);
      saveState(); render();
      showToast("Respaldo importado correctamente");
    } catch {
      showToast("El archivo no contiene un respaldo válido de Nebumia");
    }
  });
  reader.readAsText(file);
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
  if (status === "Ganado" && !q.wonDate) q.wonDate = today();
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
  attachFormValidation(quoteForm);
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

function clientSelect(selected, attrs = "") {
  const opts = state.clients.map(c =>
    `<option value="${escapeAttr(c.name)}" ${c.name === selected ? "selected" : ""}>${escapeHtml(c.name)}</option>`
  ).join("");
  return `<select name="client" required ${attrs}><option value="">— Seleccionar cliente —</option>${opts}</select>`;
}

function categorySelect(selected) {
  const cats = state.categories || [];
  const opts = cats.map(c => `<option value="${escapeAttr(c)}" ${c === selected ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
  return `<select name="category"><option value="">— Categoría —</option>${opts}</select>`;
}

function ownerSelect(selected) {
  const owners = (state.settings.teamMembers || []).map(m => m.name).filter(Boolean);
  const opts = owners.map(o => `<option value="${escapeAttr(o)}" ${o === selected ? "selected" : ""}>${escapeHtml(o)}</option>`).join("");
  return `<select name="owner"><option value="">— Comercial —</option>${opts}</select>`;
}

function serviceSelect(selected) {
  return `<input name="service" autocomplete="off" required
    placeholder="Selecciona o escribe un servicio nuevo" value="${escapeAttr(selected || "")}">`;
}

function saveServiceIfNew(serviceName) {
  const name = (serviceName || "").trim();
  if (!name) return;
  if (!(state.services || []).includes(name)) {
    state.services = [...(state.services || []), name].sort();
  }
}

function openLeadDialog(lead = null) {
  const item = lead || newLead();
  editingId = lead && state.leads.some(l => l.id === lead.id) ? lead.id : "";
  dialogShell("lead", editingId ? "Editar lead" : "Nuevo lead", `
    <div class="form-grid">
      <label>Fecha<input name="date" type="date" value="${item.date}" required></label>
      <label>Cliente${clientSelect(item.client)}</label>
      <label>Contacto<input name="contact" value="${escapeAttr(item.contact)}"></label>
      <label>Fuente<input name="source" value="${escapeAttr(item.source)}" required></label>
      <label>Canal<input name="channel" value="${escapeAttr(item.channel)}"></label>
      <label>Comercial${ownerSelect(item.owner)}</label>
      <label class="full">Servicio${serviceSelect(item.service)}</label>
      <label>Valor estimado<input name="estimatedValue" type="number" min="0" step="0.01" value="${item.estimatedValue}" required></label>
      <label>Moneda<select name="currency"><option value="PEN" ${(item.currency || "PEN") === "PEN" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${item.currency === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
      <label>Estado<select name="status">${options(leadStatuses, item.status)}</select></label>
      <label class="full">Notas<textarea name="notes" rows="3">${escapeHtml(item.notes)}</textarea></label>
    </div>
  `);
  bindDialogAutofills();
}

function openQuoteDialog(q = null, isNewFromLead = false) {
  const last = !q && state.quotes[0];
  const item = q || newQuote(last ? { bankAccount: last.bankAccount, currency: last.currency, hasIgv: last.hasIgv, cuotas: last.cuotas } : {});
  editingId = !isNewFromLead && q && state.quotes.some(existing => existing.id === q.id) ? q.id : "";
  const igvRate = state.settings.igvRate || 0.18;
  const commRate = state.settings.commissionRate || 0.05;
  const c = calcQuote(item);
  dialogShell("quote", editingId ? "Editar cotización" : "Nueva cotización", `
    <div class="form-grid">
      <label>PPTO<input name="code" value="${escapeAttr(item.code || nextQuoteCode())}" required></label>
      <label>Fecha<input name="date" type="date" value="${item.date}" required></label>
      <label>Categoría${categorySelect(item.category)}</label>
      <label>Comercial${ownerSelect(item.owner)}</label>
      <label class="full">Servicio${serviceSelect(item.service)}</label>
      <label class="full">Cliente${clientSelect(item.client)}</label>
      <div class="full quote-subtotal-block">
        <div class="quote-subtotal-row">
          <label style="flex:1">Subtotal (sin IGV)<input name="subtotal" id="quoteSubtotal" type="number" min="0" step="0.01" value="${item.subtotal || ""}" required placeholder="0.00"></label>
          <label>Moneda<select name="currency" id="quoteCurrency"><option value="PEN" ${(item.currency || "PEN") === "PEN" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${item.currency === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
          <label class="check-row quote-igv-check"><input name="hasIgv" id="quoteHasIgv" type="checkbox" ${item.hasIgv ? "checked" : ""}> Aplica IGV (${Math.round(igvRate * 100)}%)</label>
        </div>
        <div class="quote-calc-preview" id="quoteCalcPreview">
          <div class="calc-item"><span>IGV</span><strong id="previewIGV">${fmt(c.igv, item.currency || "PEN")}</strong></div>
          <div class="calc-item"><span>Total</span><strong id="previewTotal">${fmt(c.total, item.currency || "PEN")}</strong></div>
          <div class="calc-item accent"><span>Comisión ${Math.round(commRate * 100)}%</span><strong id="previewComm">${fmt(c.commission, item.currency || "PEN")}</strong></div>
        </div>
      </div>
      <label>Estado<select name="status">${options(quoteStatuses, item.status)}</select></label>
      <label>Cuenta<select name="bankAccount"><option value="">— Sin cuenta —</option>${(state.settings.bankAccounts || []).map(a => `<option value="${escapeAttr(a)}" ${item.bankAccount === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("")}</select></label>
      <input name="leadId" type="hidden" value="${escapeAttr(item.leadId || "")}">
      <input name="cuotas" type="hidden" value="${item.cuotas || 2}">
      <label class="full">Repositorio (Drive)<input name="repo" value="${escapeAttr(item.repo)}" placeholder="https://drive.google.com/..."></label>
      <label class="full">Comentarios<textarea name="comments" rows="3">${escapeHtml(item.comments)}</textarea></label>
    </div>
  `);
  bindDialogAutofills();
  bindQuoteCalcPreview();
  bindBankAccountAutofill("quoteHasIgv", "quoteCurrency");
}

function openClientDialog(client = null) {
  const item = client || newClient({ date: today() });
  editingId = client && state.clients.some(c => c.id === client.id) ? client.id : "";
  dialogShell("client", editingId ? "Editar cliente" : "Nuevo cliente", `
    <div class="form-grid">
      <label>Cliente<input name="name" value="${escapeAttr(item.name)}" required></label>
      <label>RUC / DNI<input name="ruc" value="${escapeAttr(item.ruc)}" placeholder="20XXXXXXXXX" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="11"></label>
      <label>Fecha de alta<input name="date" type="date" value="${escapeAttr(item.date)}"></label>
      <label>Contacto principal<input name="contact" value="${escapeAttr(item.contact)}"></label>
      <label>Correo electrónico<input name="email" type="email" value="${escapeAttr(item.email)}"></label>
      <label>Teléfono<input name="phone" value="${escapeAttr(item.phone)}" placeholder="+51 9XXXXXXXX"></label>
      <label>Tipo de cliente<select name="clientType"><option value="">— Seleccionar —</option><option value="B2B" ${item.clientType === "B2B" ? "selected" : ""}>B2B</option><option value="Natural" ${item.clientType === "Natural" ? "selected" : ""}>Natural</option></select></label>
      <label class="ac-label">País<input id="clientCountryInput" name="country" value="${escapeAttr(item.country || "Perú")}" autocomplete="off" placeholder="Buscar país..."></label>
      <label>Comercial${ownerSelect(item.owner)}</label>
      <label>Fuente<select name="source"><option value="">— Fuente —</option>${(state.sources || []).map(s => `<option value="${escapeAttr(s)}" ${s === item.source ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></label>
      <label class="full">Notas<textarea name="notes" rows="3">${escapeHtml(item.notes)}</textarea></label>
    </div>
  `);
  bindDialogAutofills();
  initAC(
    document.getElementById("clientCountryInput"),
    () => countriesList,
    { label: "país", onSelect: () => {}, onCreate: null }
  );
}

function openSaleDialog(quote = null) {
  const item = quote || newQuote({ status: "Ganado", wonDate: today() });
  editingId = quote && state.quotes.some(q => q.id === quote.id) ? quote.id : "";
  const clientNames = state.clients.map(c => c.name);
  const igvRate  = state.settings.igvRate  || 0.18;
  const commRate = state.settings.commissionRate || 0.05;
  const detRate  = state.settings.detractionRate || 0.12;
  const c = calcQuote(item);
  const cur = item.currency || "PEN";
  dialogShell("sale", editingId ? "Editar venta" : "Nueva venta", `
    <div class="form-grid">
      <label>PPTO<input name="code" value="${escapeAttr(item.code || nextQuoteCode())}" required></label>
      <label>Fecha de venta<input name="wonDate" type="date" value="${escapeAttr(item.wonDate || item.date || today())}" required></label>
      <label>Cliente${clientSelect(item.client)}</label>
      <label>Comercial${ownerSelect(item.owner)}</label>
      <label>Categoría${categorySelect(item.category)}</label>
      <label>Tipo de pago<select name="cuotas">
        <option value="1" ${(item.cuotas || 1) == 1 ? "selected" : ""}>1 pago</option>
        <option value="2" ${(item.cuotas || 1) == 2 ? "selected" : ""}>2 pagos</option>
        <option value="3" ${(item.cuotas || 1) == 3 ? "selected" : ""}>3 pagos</option>
      </select></label>
      <label class="full">Servicio${serviceSelect(item.service)}</label>
      <label>Factura<input name="invoice" value="${escapeAttr(item.invoice || "")}" placeholder="Ej: F001-00001"></label>
      <label>Cuenta<select name="bankAccount"><option value="">— Sin cuenta —</option>${(state.settings.bankAccounts || []).map(a => `<option value="${escapeAttr(a)}" ${item.bankAccount === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("")}</select></label>
      <div class="full quote-subtotal-block">
        <div class="quote-subtotal-row">
          <label style="flex:1">Subtotal (sin IGV)<input name="subtotal" id="saleSubtotal" type="number" min="0" step="0.01" value="${item.subtotal || ""}" required placeholder="0.00"></label>
          <label>Moneda<select name="currency" id="saleCurrency"><option value="PEN" ${cur !== "USD" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${cur === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
          <label class="check-row quote-igv-check"><input name="hasIgv" id="saleHasIgv" type="checkbox" ${item.hasIgv ? "checked" : ""}> Aplica IGV (${Math.round(igvRate * 100)}%)</label>
        </div>
        <div class="quote-calc-preview" id="saleCalcPreview">
          <div class="calc-item"><span>IGV</span><strong id="salePreviewIGV">${fmt(c.igv, cur)}</strong></div>
          <div class="calc-item"><span>Total</span><strong id="salePreviewTotal">${fmt(c.total, cur)}</strong></div>
          <div class="calc-item"><span>Detracción ${Math.round(detRate * 100)}%</span><strong id="salePreviewDet">${fmt(c.detraction, cur)}</strong></div>
          <div class="calc-item accent"><span>Comisión ${Math.round(commRate * 100)}%</span><strong id="salePreviewComm">${fmt(c.commission, cur)}</strong></div>
        </div>
      </div>
    </div>
  `);
  bindDialogAutofills();
  bindSaleCalcPreview();
  bindBankAccountAutofill("saleHasIgv", "saleCurrency");
}

function saveSale(data) {
  saveServiceIfNew(data.service);
  const existing = editingId ? state.quotes.find(q => q.id === editingId) : null;
  const item = newQuote({
    ...data,
    subtotal: Number(data.subtotal),
    hasIgv: data.hasIgv === "on",
    status: "Ganado",
    // Preserva la fecha de cotización original; para ventas nuevas usa la fecha de venta
    date: existing?.date || data.wonDate || today(),
    wonDate: data.wonDate || existing?.wonDate || today()
  });
  if (editingId) state.quotes = state.quotes.map(q => q.id === editingId ? { ...q, ...item, id: editingId } : q);
  else state.quotes.unshift(item);
  const saved = editingId ? state.quotes.find(q => q.id === editingId) : state.quotes[0];
  syncQuoteSideEffects(state, saved);
  activeView = "sales";
}

function openCollectionDialog(row) {
  if (!row) return;
  editingId = row.id;
  const quote = state.quotes.find(q => q.id === row.quoteId);
  const clientRecord = state.clients.find(c => c.name === (quote?.client || ""));
  const client = quote?.client || "—";
  const ruc = clientRecord?.ruc || "—";
  const service = quote?.service || "—";
  const owner = quote?.owner || "—";
  const code = quote?.code ? displayCode(quote.code) : "—";
  const wonDate = fmtDate(quote?.wonDate || quote?.date || "");
  const currency = row.currency || quote?.currency || "PEN";
  const nroPago = row.label === "Pago 100%" ? "1/1" : (row.label || "").replace("Pago ", "");
  const sym = currency === "USD" ? "$" : "S/";
  const calc = quote ? calcQuote(quote, state) : { igv: 0, total: 0, detraction: 0 };
  const subtotal = quote?.subtotal || 0;
  const effectiveBankAccount = row.bankAccount || (quote ? resolveDefaultBankAccount(quote.hasIgv, currency) : "");
  dialogShell("collection", "Editar cobranza", `
    <div class="coll-info-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="coll-info-item"><span class="coll-info-label">PPTO</span><span class="coll-info-value">${escapeHtml(code)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Fecha venta</span><span class="coll-info-value">${escapeHtml(wonDate)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Comercial</span><span class="coll-info-value">${escapeHtml(owner)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Cliente</span><span class="coll-info-value">${escapeHtml(client)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">RUC / DNI</span><span class="coll-info-value">${escapeHtml(ruc)}</span></div>
      <div class="coll-info-item" style="grid-column:span 1"><span class="coll-info-label">Servicio</span><span class="coll-info-value" style="white-space:normal;word-break:break-word">${escapeHtml(service)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Subtotal</span><span class="coll-info-value">${sym} ${subtotal.toFixed(2)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">IGV</span><span class="coll-info-value">${sym} ${calc.igv.toFixed(2)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Total</span><span class="coll-info-value">${sym} ${calc.total.toFixed(2)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Detracción</span><span class="coll-info-value">${currency === "USD" ? "S/ (ingresar)" : `${sym} ${calc.detraction.toFixed(2)}`}</span></div>
    </div>
    <div class="form-grid" style="margin-top:16px">
      <label>Nro Pago<input name="nroPago" value="${escapeAttr(nroPago)}" readonly style="background:var(--surface);color:var(--muted);cursor:default"></label>
      <label>Estado<select name="status">${options(paymentStatuses, row.status)}</select></label>
      <label>Factura<input name="invoice" value="${escapeAttr(row.invoice || "")}" placeholder="F001-00001"></label>
      <label>Cuenta<select name="bankAccount"><option value="">— Sin cuenta —</option>${(state.settings.bankAccounts || []).map(a => `<option value="${escapeAttr(a)}" ${effectiveBankAccount === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>
      <label>Fecha PP (vencimiento)<input name="dueDate" type="date" value="${row.dueDate || ""}"></label>
      <label>Fecha RP (cobrado)<input name="paidDate" type="date" value="${row.paidDate || ""}"></label>
      <label class="full">Link repositorio<input name="repo" type="url" value="${escapeAttr(row.repo || "")}" placeholder="https://..."></label>
      ${calc.detraction > 0 ? (() => {
        const dm = (state.settings.collectionDetModes || {})[row.id] || {};
        const mode = dm.mode || "cliente";
        const bankOpts = (state.settings.bankAccounts || []).map(a =>
          `<option value="${escapeAttr(a)}" ${dm.cuenta === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("");
        return `
          <div class="full" style="border-top:1px solid var(--line);padding-top:12px;margin-top:4px"></div>
          <label>¿Quién pagó la detracción?<select name="detraccionMode" id="detModeSelect">
            <option value="cliente" ${mode === "cliente" ? "selected" : ""}>Cliente (depositó el neto a tu cuenta)</option>
            <option value="bandu"   ${mode === "bandu"   ? "selected" : ""}>Nosotros (cliente depositó el 100%, nosotros pagamos)</option>
          </select></label>
          <label>Estado detracción<select name="detStatus">
            <option value="Completado" ${(dm.detStatus || "Completado") === "Completado" ? "selected" : ""}>Completado (ya pagado)</option>
            <option value="Pendiente"  ${dm.detStatus === "Pendiente" ? "selected" : ""}>Pendiente (aún no pagado)</option>
          </select></label>
          <label>Monto real de detracción (S/)<input name="detActual" type="text" inputmode="decimal"
            value="${dm.detActual != null ? dm.detActual : (currency === "USD" ? "" : Math.round(calc.detraction).toFixed(2))}"
            placeholder="${currency === "USD" ? "Ej: 235.00" : Math.round(calc.detraction).toFixed(2)}"></label>
          <label class="full">Monto real recibido en cuenta (${sym})<input name="montoReal" type="text" inputmode="decimal"
            value="${dm.montoReal != null ? dm.montoReal : ""}"
            placeholder="${mode === "bandu" ? calc.total.toFixed(2) : (calc.total - Math.round(calc.detraction)).toFixed(2)}"></label>
          <label id="detCuentaLabel" ${mode !== "bandu" ? 'style="display:none"' : ""}>¿Desde qué cuenta sale la detracción?<select name="detraccionCuenta">
            <option value="">— Cuenta —</option>${bankOpts}
          </select></label>`;
      })() : ""}
    </div>
    <script>
      (function(){
        const sel = document.getElementById("detModeSelect");
        const lbl = document.getElementById("detCuentaLabel");
        if (sel && lbl) sel.addEventListener("change", () => { lbl.style.display = sel.value === "bandu" ? "" : "none"; });
      })();
    </script>
  `);
}

function openInvoiceDialog(collectionId) {
  const raw = state.collections.find(c => c.id === collectionId);
  if (!raw) return;
  editingId = collectionId;
  const quote = state.quotes.find(q => q.id === raw.quoteId);
  const clientRecord = state.clients.find(c => c.name === (quote?.client || ""));
  const currency = raw.currency || quote?.currency || "PEN";
  const sym = currency === "USD" ? "$" : "S/";
  const netAmount = (raw.amount || 0) - (raw.detraction || 0);
  const nroPago = raw.label === "Pago 100%" ? "1/1" : (raw.label || "").replace("Pago ", "");
  const code = quote?.code ? displayCode(quote.code) : "—";
  const client = quote?.client || "—";
  const ruc = clientRecord?.ruc || "—";
  const service = quote?.service || "—";
  const wonDate = fmtDate(quote?.wonDate || quote?.date || "");
  dialogShell("invoiceCollection", "Emitir factura", `
    <div class="coll-info-grid" style="grid-template-columns: repeat(4,1fr)">
      <div class="coll-info-item"><span class="coll-info-label">PPTO</span><span class="coll-info-value">${escapeHtml(code)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Nro Pago</span><span class="coll-info-value">${escapeHtml(nroPago)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Fecha venta</span><span class="coll-info-value">${escapeHtml(wonDate)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Moneda</span><span class="coll-info-value">${escapeHtml(currency)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Cliente</span><span class="coll-info-value">${escapeHtml(client)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">RUC / DNI</span><span class="coll-info-value">${escapeHtml(ruc)}</span></div>
      <div class="coll-info-item" style="grid-column:span 2"><span class="coll-info-label">Servicio</span><span class="coll-info-value">${escapeHtml(service)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Total</span><span class="coll-info-value">${sym} ${(raw.amount || 0).toFixed(2)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Detracción</span><span class="coll-info-value">${sym} ${(raw.detraction || 0).toFixed(2)}</span></div>
      <div class="coll-info-item"><span class="coll-info-label">Monto a recibir</span><span class="coll-info-value">${sym} ${netAmount.toFixed(2)}</span></div>
    </div>
    <div class="form-grid" style="margin-top:16px">
      <label>Número de factura<input name="invoice" value="${escapeAttr(raw.invoice || "")}" placeholder="F001-00001" required></label>
      <label>Fecha de emisión<input name="invoiceDate" type="date" value="${raw.invoiceDate || today()}" required></label>
      <label class="full">Cuenta<select name="bankAccount"><option value="">— Sin cuenta —</option>${(state.settings.bankAccounts || []).map(a => `<option value="${escapeAttr(a)}" ${(raw.bankAccount || (quote ? resolveDefaultBankAccount(quote.hasIgv, currency) : "")) === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>
      <label class="full">Observaciones<textarea name="invoiceNotes" rows="2" placeholder="Notas adicionales...">${escapeHtml(raw.invoiceNotes || "")}</textarea></label>
    </div>
  `, "Emitir factura");
}

function saveInvoiceCollection(data) {
  state.collections = state.collections.map(c =>
    c.id === editingId
      ? { ...c, invoice: data.invoice, invoiceDate: data.invoiceDate, bankAccount: data.bankAccount || "", invoiceNotes: data.invoiceNotes || "", status: "Facturado" }
      : c
  );
  activeView = "collections";
}

function openProgramarCobrosDialog(quoteId) {
  const q = state.quotes.find(x => x.id === quoteId);
  if (!q) return;
  editingId = quoteId;
  const current = q.cuotas || 2;
  const calc = calcQuote(q, state);
  const sym = q.currency === "USD" ? "$" : "S/";
  const previewForCuotas = n => {
    const parts = n === 3 ? [1/3,1/3,1/3] : n === 2 ? [0.5,0.5] : [1];
    return parts.map((p, i) => {
      const label = n === 1 ? "Pago 100%" : `Pago ${i+1}/${n}`;
      return `<div class="cuota-preview-row"><span>${label}</span><strong>${sym} ${(calc.total * p).toFixed(2)}</strong></div>`;
    }).join("");
  };
  dialogShell("programarCobros", `Programar cobros — ${q.code}`, `
    <div class="form-grid">
      <label class="full">Número de cuotas
        <div class="cuotas-btn-group">
          <button type="button" class="cuotas-opt ${current === 1 ? "active" : ""}" data-cuotas="1">1 cuota<br><small>100% al inicio</small></button>
          <button type="button" class="cuotas-opt ${current === 2 ? "active" : ""}" data-cuotas="2">2 cuotas<br><small>50% / 50%</small></button>
          <button type="button" class="cuotas-opt ${current === 3 ? "active" : ""}" data-cuotas="3">3 cuotas<br><small>33% / 33% / 33%</small></button>
        </div>
        <input type="hidden" name="cuotas" id="cuotasHidden" value="${current}">
      </label>
      <div class="full cuota-preview" id="cuotaPreview">${previewForCuotas(current)}</div>
    </div>
  `);
  const dialog = document.querySelector("#appDialog");
  dialog.querySelectorAll(".cuotas-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      dialog.querySelectorAll(".cuotas-opt").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const n = Number(btn.dataset.cuotas);
      dialog.querySelector("#cuotasHidden").value = n;
      dialog.querySelector("#cuotaPreview").innerHTML = previewForCuotas(n);
    });
  });
}

function saveProgramarCobros(data) {
  const q = state.quotes.find(x => x.id === editingId);
  if (!q) return;
  q.cuotas = Number(data.cuotas) || 2;
  syncQuoteSideEffects(state, q);
  activeView = "collections";
}

function openExpenseDialog(expense = null) {
  const item = expense || newExpense();
  editingId = expense && state.expenses.some(e => e.id === expense.id) ? expense.id : "";
  dialogShell("expense", editingId ? "Editar gasto" : "Nuevo gasto", `
    <div class="form-grid">
      <label>Fecha<input name="date" type="date" value="${item.date || today()}" required></label>
      <label>Moneda<select name="currency"><option value="PEN" ${item.currency !== "USD" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${item.currency === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
      <label>Tipo<input name="type" value="${escapeAttr(item.type)}" required></label>
      <label>Encargado${ownerSelect(item.owner)}</label>
      <label class="full">Concepto<input name="concept" value="${escapeAttr(item.concept)}" required></label>
      <label>Monto<input name="amount" type="number" step="0.01" value="${item.amount}" required></label>
      <label>Estado<select name="status">${options(["Pendiente", "Completado"], item.status)}</select></label>
      <label class="full">Link documento<input name="docLink" type="url" value="${escapeAttr(item.docLink)}" placeholder="https://drive.google.com/..."></label>
      <label><input type="checkbox" name="refund" ${item.refund ? "checked" : ""}> Es devolución</label>
      <label><input type="checkbox" name="isAdSpend" ${item.isAdSpend ? "checked" : ""}> Pauta publicitaria (ads)</label>
    </div>
  `);
  bindDialogAutofills();
}

function openTaxPaymentDialog(record = null, prefill = {}) {
  const item = record || newTaxPayment();
  editingId = record?.id || "";
  const typeVal = prefill.type || item.type;
  const amountVal = prefill.amount !== undefined ? prefill.amount : item.amount;
  const periodVal = prefill.period || item.period;
  const collectionId = prefill.collectionId || item.collectionId || "";
  dialogShell("taxPayment", editingId ? "Editar pago a SUNAT" : "Nuevo pago a SUNAT", `
    <div class="form-grid">
      <input type="hidden" name="collectionId" value="${escapeAttr(collectionId)}">
      <label>Fecha<input name="date" type="date" value="${item.date}" required></label>
      <label>Tipo<select name="type">${options(["IGV 1011", "Renta 3121", "Detracción", "Autodetracción", "Otro"], typeVal)}</select></label>
      <label>Periodo<select name="period">${options(months, periodVal)}</select></label>
      <label>Monto<input name="amount" type="number" min="0" step="0.01" value="${amountVal}" required></label>
      <label>Estado<select name="status">${options(["Pendiente", "Pagado"], item.status)}</select></label>
      <label>Ref. SUNAT<input name="sunatRef" value="${escapeAttr(item.sunatRef)}" placeholder="N° operación SUNAT"></label>
      <label class="full">Link carpeta<input name="docLink" type="url" value="${escapeAttr(item.docLink)}" placeholder="https://drive.google.com/..."></label>
    </div>
  `);
}

function openTeamDialog(payment = null) {
  const item = payment || newTeamPayment();
  editingId = payment && state.team.some(t => t.id === payment.id) ? payment.id : "";
  const profiles = state.profiles || [];
  const isComm = profileHasCommission(item.role) || (!editingId && profileHasCommission(profiles[0]?.name));
  const comm = calcTeamCommission(item.name);
  const profileOpts = profiles.map(p => `<option value="${escapeAttr(p.name)}" ${p.name === item.role ? "selected" : ""}>${escapeHtml(p.name)}${p.hasCommission ? " ★" : ""}</option>`).join("");
  dialogShell("team", editingId ? "Editar pago" : "Nuevo pago de personal", `
    <div class="form-grid">
      <label>Fecha<input name="dueDate" type="date" value="${item.dueDate || today()}" required></label>
      <label>Perfil<select name="role"><option value="">— Seleccionar perfil —</option>${profileOpts}</select></label>
      <label>Nombre completo<input name="name" value="${escapeAttr(item.name)}" required></label>
      <label>Moneda<select name="currency"><option value="PEN" ${item.currency !== "USD" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${item.currency === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
      <label>Monto<input name="amount" type="number" step="0.01" value="${item.amount}" required></label>
      <label>Estado<select name="status">${options(["Pendiente", "Pagado"], item.status)}</select></label>
      <label>Nombre de Banco<input name="bankName" value="${escapeAttr(item.bankName)}" placeholder="Interbank, BCP..."></label>
      <label>Nro de cuenta<input name="accountNumber" value="${escapeAttr(item.accountNumber)}" placeholder="000-0000000-0-00"></label>
      <label class="full">CCI<input name="cci" value="${escapeAttr(item.cci)}" placeholder="00300000000000000000"></label>
      <label class="full">Link RHE<input name="receipt" type="url" value="${escapeAttr(item.receipt)}" placeholder="https://..."></label>
      ${isComm ? `
      <div class="form-divider full">Comisión de ventas <strong style="color:var(--brand)">${fmt(comm, item.currency)}</strong></div>
      <label>Factura comisión<input name="commInvoice" value="${escapeAttr(item.commInvoice)}" placeholder="S/N o número de factura"></label>
      <label class="full">Repositorio comisión<input name="commRepo" type="url" value="${escapeAttr(item.commRepo)}" placeholder="https://drive.google.com/..."></label>
      ` : `<input type="hidden" name="commInvoice" value="${escapeAttr(item.commInvoice)}"><input type="hidden" name="commRepo" value="${escapeAttr(item.commRepo)}">`}
    </div>
  `);
  bindDialogAutofills();
}

function openDeclaracionDialog(record = null, prefill = {}) {
  const item = record || newDeclaracion();
  editingId = record?.id || "";
  const igvRate = state.settings.igvRate || 0.18;
  const igvVentas = collectionRows()
    .filter(r => ["Facturado", "Pagado", "Vencido"].includes(r.status))
    .reduce((s, r) => s + (r.quote?.hasIgv ? r.amount - r.amount / (1 + igvRate) : 0), 0);
  const creditoFiscal = (state.purchases || [])
    .reduce((s, p) => s + (p.igv || 0), 0);
  const igvSugerido = Math.max(0, igvVentas - creditoFiscal);
  dialogShell("declaracion", editingId ? "Editar declaración" : "Nueva declaración mensual", `
    <div class="form-grid">
      <label>Periodo<select name="period">${options(months, prefill.period || item.period)}</select></label>
      <label>Estado<select name="status">${options(["Pendiente", "Pagado"], item.status)}</select></label>
      <label>IGV 1011 (S/)<input name="igv1011" type="number" min="0" step="0.01" value="${prefill.igv1011 !== undefined ? prefill.igv1011 : item.igv1011 || igvSugerido.toFixed(2)}" placeholder="Calculado: ${fmt(igvSugerido)}" required></label>
      <label>Renta 3121 (S/)<input name="renta3121" type="number" min="0" step="0.01" value="${item.renta3121}" required></label>
      <label>Otro (S/)<input name="otro" type="number" min="0" step="0.01" value="${item.otro}" required></label>
      <label>Concepto otro<input name="otroConcepto" value="${escapeAttr(item.otroConcepto)}" placeholder="Ej: ITAN, multa..."></label>
      <label class="full">Notas<textarea name="notes" rows="2">${escapeHtml(item.notes)}</textarea></label>
    </div>
    <p class="form-note">Referencia: IGV ventas ${fmt(igvVentas)} · Crédito fiscal ${fmt(creditoFiscal)} · IGV estimado ${fmt(igvSugerido)}</p>
  `);
}

function openPurchaseDialog(purchase = null) {
  const item = purchase || newPurchase();
  editingId = purchase?.id || "";
  dialogShell("purchase", editingId ? "Editar compra" : "Nueva compra", `
    <div class="form-grid">
      <label>Fecha<input name="date" type="date" value="${item.date}" required></label>
      <label>Moneda<select name="currency"><option value="PEN" ${item.currency !== "USD" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${item.currency === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
      <label>Proveedor<input name="vendor" value="${escapeAttr(item.vendor)}" required></label>
      <label>RUC proveedor<input name="ruc" value="${escapeAttr(item.ruc)}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="11"></label>
      <label>Tipo comprobante<select name="invoiceType">${options(["Factura", "Boleta", "Recibo", "Otro"], item.invoiceType)}</select></label>
      <label>N° comprobante<input name="invoiceNum" value="${escapeAttr(item.invoiceNum)}" placeholder="F001-0000001"></label>
      <label class="full">Concepto<input name="concept" value="${escapeAttr(item.concept)}" required></label>
      <label>Base imponible<input name="subtotal" type="number" step="0.01" value="${item.subtotal}" required></label>
      <label>IGV<input name="igv" type="number" step="0.01" value="${item.igv}"></label>
      <label>Total<input name="total" type="number" step="0.01" value="${item.total}" required></label>
      <label>Detracción<input name="detraction" type="number" step="0.01" value="${item.detraction || 0}"></label>
      <label>Fecha RP<input name="paidDate" type="date" value="${item.paidDate || ""}"></label>
      <label>Cuenta<select name="bankAccount"><option value="">— Sin cuenta —</option>${(state.settings.bankAccounts || []).map(a => `<option value="${escapeAttr(a)}" ${item.bankAccount === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>
      <label>Estado declaración<select name="declared">${options(["Sin declarar", "Declarado"], item.declared || "Sin declarar")}</select></label>
      <label class="full">Link repositorio<input name="repo" type="url" value="${escapeAttr(item.repo || "")}" placeholder="https://..."></label>
    </div>
  `);
  // Auto-calc IGV and Total when subtotal changes
  (() => {
    const form = quoteDialog.querySelector("form");
    const subIn  = form?.querySelector("[name='subtotal']");
    const igvIn  = form?.querySelector("[name='igv']");
    const totIn  = form?.querySelector("[name='total']");
    const rate   = state.settings.igvRate || 0.18;
    if (subIn && igvIn && totIn) {
      subIn.addEventListener("input", () => {
        const sub = parseFloat(subIn.value) || 0;
        const igv = Math.round(sub * rate * 100) / 100;
        igvIn.value = igv.toFixed(2);
        totIn.value = (sub + igv).toFixed(2);
      });
    }
  })();
  bindDialogAutofills();
}

function openInvoicedSaleDialog(sale = null) {
  const item = sale || newInvoicedSale();
  editingId = sale?.id || "";
  dialogShell("invoicedSale", editingId ? "Editar venta facturada" : "Nueva venta facturada", `
    <div class="form-grid">
      <label>Fecha<input name="date" type="date" value="${item.date}" required></label>
      <label>Moneda<select name="currency"><option value="PEN" ${item.currency !== "USD" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${item.currency === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
      <label>Cliente${clientSelect(item.client)}</label>
      <label>RUC cliente<input name="ruc" value="${escapeAttr(item.ruc)}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="11"></label>
      <label>Tipo comprobante<select name="invoiceType">${options(["Factura", "Boleta", "Recibo", "Otro"], item.invoiceType)}</select></label>
      <label>N° comprobante<input name="invoiceNum" value="${escapeAttr(item.invoiceNum)}" placeholder="F001-0000001"></label>
      <label class="full">Servicio${serviceSelect(item.service)}</label>
      <label>Base imponible<input name="subtotal" type="number" step="0.01" value="${item.subtotal}" required></label>
      <label>IGV<input name="igv" type="number" step="0.01" value="${item.igv}"></label>
      <label>Total<input name="total" type="number" step="0.01" value="${item.total}" required></label>
    </div>
  `);
  bindDialogAutofills();
}

function openCashEntryDialog(type = "egreso", entry = null) {
  const defaultBank = activeCajaTab && activeCajaTab !== "general" ? activeCajaTab : (state.settings.bankAccounts?.[0] || "");
  const item = entry || newCashEntry({ type, bankAccount: defaultBank });
  editingId = entry?.id || "";
  const isIngreso = (entry?.type || type) === "ingreso";
  const catOptions = isIngreso
    ? ["Cobro de venta", "Adelanto", "Otro ingreso"]
    : ["Gasto fijo", "Gasto variable", "Personal", "Impuesto", "Inversión", "Otro egreso"];
  const bankOpts = (state.settings.bankAccounts || []);
  dialogShell("cashEntry", editingId ? "Editar movimiento" : (isIngreso ? "Nuevo ingreso" : "Nuevo egreso"), `
    <div class="form-grid">
      <input type="hidden" name="type" value="${isIngreso ? "ingreso" : "egreso"}">
      <label>Fecha<input name="date" type="date" value="${item.date}" required></label>
      <label>Moneda<select name="currency"><option value="PEN" ${item.currency !== "USD" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${item.currency === "USD" ? "selected" : ""}>Dólares ($)</option></select></label>
      <label class="full">Concepto<input name="concept" value="${escapeAttr(item.concept)}" required placeholder="${isIngreso ? "Ej: Pago proyecto Calma Vital" : "Ej: Correo corporativo"}"></label>
      <label>Categoría<select name="category"><option value="">— Categoría —</option>${catOptions.map(c => `<option value="${escapeAttr(c)}" ${item.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select></label>
      <label>Monto<input name="amount" type="number" step="0.01" min="0" value="${item.amount || ""}" required></label>
      <label>Estado<select name="status">${options(["Confirmado", "Pendiente"], item.status)}</select></label>
      <label>Cuenta bancaria<select name="bankAccount"><option value="">— Sin cuenta —</option>${bankOpts.map(a => `<option value="${escapeAttr(a)}" ${item.bankAccount === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("")}</select></label>
      <label>Factura<input name="invoice" value="${escapeAttr(item.invoice || "")}" placeholder="F001-00001"></label>
      <label class="full">Notas<textarea name="notes" rows="2">${escapeHtml(item.notes)}</textarea></label>
    </div>
  `);
  bindDialogAutofills();
}

function openFixedExpenseBankDialog(id, month) {
  const fe = (state.settings.fixedExpenses || []).find(f => f.id === id);
  if (!fe) return;
  editingId = id;
  const bankOpts = (state.settings.bankAccounts || []);
  const overrides = state.settings.fixedExpenseOverrides || {};
  const currentOverride = month ? overrides[`${id}-${month}`] : undefined;
  const currentAccount = currentOverride !== undefined ? currentOverride : (fe.assignedAccount || "");
  const monthLabel = month ? new Date(month + "-01T00:00:00").toLocaleString("es-PE", { month: "long", year: "numeric", timeZone: "America/Lima" }).replace(/^\w/, c => c.toUpperCase()) : "";
  dialogShell("fixedExpenseBank", "Editar cuenta bancaria", `
    <div class="form-grid">
      <input type="hidden" name="id" value="${escapeAttr(id)}">
      <input type="hidden" name="month" value="${escapeAttr(month || "")}">
      <label class="full" style="font-weight:600">${escapeHtml(fe.concept)}</label>
      <label class="full">Cuenta bancaria<select name="bankAccount">
        <option value="">— Sin cuenta —</option>
        ${bankOpts.map(a => `<option value="${escapeAttr(a)}" ${currentAccount === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("")}
      </select></label>
      <label class="full">Aplicar a<select name="scope">
        ${month ? `<option value="month">Solo ${monthLabel}</option>` : ""}
        <option value="always">Siempre (todos los meses)</option>
      </select></label>
    </div>
  `);
}

function openExpenseRecurBankDialog(id, month) {
  const e = (state.expenses || []).find(x => x.id === id);
  if (!e) return;
  editingId = id;
  const bankOpts = state.settings.bankAccounts || [];
  const overrides = state.settings.fixedExpenseOverrides || {};
  const overrideKey = `expense-${id}-${month}`;
  const currentAccount = overrides[overrideKey] !== undefined ? overrides[overrideKey] : (e.bankAccount || "");
  const monthLabel = month ? new Date(month + "-01T00:00:00").toLocaleString("es-PE", { month: "long", year: "numeric", timeZone: "America/Lima" }).replace(/^\w/, c => c.toUpperCase()) : "";
  dialogShell("fixedExpenseBank", "Editar cuenta bancaria", `
    <div class="form-grid">
      <input type="hidden" name="id" value="${escapeAttr(id)}">
      <input type="hidden" name="month" value="${escapeAttr(month || "")}">
      <input type="hidden" name="isExpenseRecur" value="1">
      <label class="full" style="font-weight:600">${escapeHtml(e.concept)}</label>
      <label class="full">Cuenta bancaria<select name="bankAccount">
        <option value="">— Sin cuenta —</option>
        ${bankOpts.map(a => `<option value="${escapeAttr(a)}" ${currentAccount === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("")}
      </select></label>
      <label class="full">Aplicar a<select name="scope">
        ${month ? `<option value="month">Solo ${monthLabel}</option>` : ""}
        <option value="always">Siempre (todos los meses)</option>
      </select></label>
    </div>
  `);
}

function openSaldoInicialDialog(monthKey, bankAccount, currentSigned) {
  const [yr, mo] = monthKey.split("-");
  const monthName = new Date(Number(yr), Number(mo) - 1, 1)
    .toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const isUSD = /\$|USD/i.test(bankAccount);
  const sym   = isUSD ? "USD $" : "S/";
  dialogShell("saldoInicial", "Saldo al inicio de " + monthName, `
    <div class="form-grid">
      <input type="hidden" name="month" value="${escapeAttr(monthKey)}">
      <input type="hidden" name="bankAccount" value="${escapeAttr(bankAccount)}">
      <label class="full" style="font-size:.85rem;color:var(--text-2)">Cuenta: ${escapeHtml(bankAccount)}</label>
      <label class="full">Monto (${sym})
        <input name="amount" type="text" inputmode="decimal" value="${currentSigned !== 0 ? Math.abs(currentSigned) : ""}" placeholder="${isUSD ? "Ej: 885.00" : "Ej: 12,373.65"}" autofocus>
      </label>
      <p class="full" style="font-size:.8rem;color:var(--text-2);margin:0">Deja en 0 o vacío para volver al cálculo automático.</p>
    </div>
  `);
}

function saveSaldoInicial(data) {
  const { month, bankAccount, amount } = data;
  const amt = parseFloat(cleanNumericImport(amount)) || 0;
  const sl = state.settings.saldosIniciales || [];
  const idx = sl.findIndex(s => s.bankAccount === bankAccount && s.date === month);
  if (amt === 0) {
    state.settings.saldosIniciales = sl.filter((_, i) => i !== idx);
  } else if (idx >= 0) {
    sl[idx].amount = amt;
    state.settings.saldosIniciales = [...sl];
  } else {
    state.settings.saldosIniciales = [...sl, { bankAccount, date: month, amount: amt }];
  }
}

function saveFixedExpenseBank(data) {
  const id = data.id || editingId;
  const overrides = state.settings.fixedExpenseOverrides || {};
  // Gasto fijo recurrente (desde state.expenses)
  if (data.isExpenseRecur === "1") {
    const e = (state.expenses || []).find(x => x.id === id);
    if (!e) return;
    if (data.scope === "month" && data.month) {
      overrides[`expense-${id}-${data.month}`] = data.bankAccount || "";
    } else {
      e.bankAccount = data.bankAccount || "";
      Object.keys(overrides).forEach(k => { if (k.startsWith(`expense-${id}-`)) delete overrides[k]; });
    }
    state.settings.fixedExpenseOverrides = overrides;
    return;
  }
  // Gasto fijo de settings
  const fe = (state.settings.fixedExpenses || []).find(f => f.id === id);
  if (!fe) return;
  if (data.scope === "month" && data.month) {
    overrides[`${fe.id}-${data.month}`] = data.bankAccount || "";
    state.settings.fixedExpenseOverrides = overrides;
  } else {
    fe.assignedAccount = data.bankAccount || "";
    Object.keys(overrides).forEach(k => { if (k.startsWith(fe.id + "-")) delete overrides[k]; });
    state.settings.fixedExpenseOverrides = overrides;
  }
}

function saveCashEntry(data) {
  const item = newCashEntry({ ...data, id: editingId || undefined });
  if (!state.cashEntries) state.cashEntries = [];
  if (editingId) state.cashEntries = state.cashEntries.map(e => e.id === editingId ? item : e);
  else state.cashEntries.unshift(item);
  const banks = state.settings.bankAccounts || [];
  if (item.bankAccount && banks.includes(item.bankAccount)) activeCajaTab = item.bankAccount;
  else if (banks.length) activeCajaTab = banks[0];
  saveState();
  activeView = "finance";
}

function resolveDefaultBankAccount(hasIgv, currency) {
  const accounts = state.settings.bankAccounts || [];
  const isUSD = currency === "USD";
  const isCur = a => isUSD ? /\$|USD|d[oó]lar/i.test(a) : /S\/|sol|PEN/i.test(a);
  const isCC  = a => /corriente|CC\b/i.test(a);
  const isCP  = a => /personal|CP\b|ahorro/i.test(a);
  const match = hasIgv
    ? accounts.find(a => isCur(a) && isCC(a))
    : accounts.find(a => isCur(a) && isCP(a));
  return match || accounts.find(isCur) || accounts[0] || "";
}

function applyBankAccountDefaults(st) {
  let changed = false;
  (st.quotes || []).forEach(q => {
    if (!q.bankAccount) {
      q.bankAccount = resolveDefaultBankAccount(q.hasIgv, q.currency || "PEN");
      changed = true;
    }
  });
  (st.collections || []).forEach(c => {
    if (!c.bankAccount) {
      const q = (st.quotes || []).find(r => r.id === c.quoteId);
      if (q) {
        c.bankAccount = resolveDefaultBankAccount(q.hasIgv, c.currency || q.currency || "PEN");
        changed = true;
      }
    }
  });
  return changed;
}

function bindBankAccountAutofill(igvId, currencyId) {
  const igvEl  = document.getElementById(igvId);
  const curEl  = document.getElementById(currencyId);
  const bankEl = quoteDialog.querySelector("[name='bankAccount']");
  if (!bankEl) return;
  const resolve = () => resolveDefaultBankAccount(igvEl?.checked || false, curEl?.value || "PEN");
  const update  = () => {
    const known = state.settings.bankAccounts || [];
    if (!bankEl.value || known.includes(bankEl.value)) bankEl.value = resolve();
  };
  if (!bankEl.value) bankEl.value = resolve();
  igvEl?.addEventListener("change", update);
  curEl?.addEventListener("change", update);
}

function bindQuoteCalcPreview() {
  const subtotalEl = document.getElementById("quoteSubtotal");
  const igvEl      = document.getElementById("quoteHasIgv");
  const curEl      = document.getElementById("quoteCurrency");
  const previewEl  = document.getElementById("quoteCalcPreview");
  if (!subtotalEl || !previewEl) return;

  const igvRate  = state.settings.igvRate  || 0.18;
  const commRate = state.settings.commissionRate || 0.05;

  const update = () => {
    const subtotal = parseFloat(subtotalEl.value) || 0;
    const hasIgv   = igvEl?.checked || false;
    const cur      = curEl?.value || "PEN";
    const sym      = cur === "USD" ? "$" : "S/";
    const igv      = hasIgv ? subtotal * igvRate : 0;
    const total    = subtotal + igv;
    const comm     = subtotal * commRate;
    const f = n => sym + " " + n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("previewIGV").textContent  = f(igv);
    document.getElementById("previewTotal").textContent = f(total);
    document.getElementById("previewComm").textContent = f(comm);
    previewEl.classList.toggle("has-igv", hasIgv);
  };

  subtotalEl.addEventListener("input", update);
  igvEl?.addEventListener("change", update);
  curEl?.addEventListener("change", update);
  update();
}

function bindSaleCalcPreview() {
  const subtotalEl = document.getElementById("saleSubtotal");
  const igvEl      = document.getElementById("saleHasIgv");
  const curEl      = document.getElementById("saleCurrency");
  const previewEl  = document.getElementById("saleCalcPreview");
  if (!subtotalEl || !previewEl) return;

  const igvRate   = state.settings.igvRate  || 0.18;
  const commRate  = state.settings.commissionRate || 0.05;
  const detRate   = state.settings.detractionRate || 0.12;
  const threshold = state.settings.detractionThreshold ?? 700;

  const update = () => {
    const subtotal = parseFloat(subtotalEl.value) || 0;
    const hasIgv   = igvEl?.checked || false;
    const cur      = curEl?.value || "PEN";
    const sym      = cur === "USD" ? "$" : "S/";
    const igv      = hasIgv ? subtotal * igvRate : 0;
    const total    = subtotal + igv;
    const det      = total > threshold && hasIgv && cur === "PEN" ? total * detRate : 0;
    const comm     = subtotal * commRate;
    const f = n => sym + " " + n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("salePreviewIGV").textContent   = f(igv);
    document.getElementById("salePreviewTotal").textContent = f(total);
    document.getElementById("salePreviewDet").textContent   = f(det);
    document.getElementById("salePreviewComm").textContent  = f(comm);
    previewEl.classList.toggle("has-igv", hasIgv);
  };

  subtotalEl.addEventListener("input", update);
  igvEl?.addEventListener("change", update);
  curEl?.addEventListener("change", update);
  update();
}

function handleEntitySubmit(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  try {
    if (!validateFormBeforeSubmit(event.currentTarget)) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (editingType === "lead") saveLead(data);
    if (editingType === "quote") saveQuote(data);
    if (editingType === "client") saveClient(data);
    if (editingType === "sale") saveSale(data);
    if (editingType === "collection") saveCollection(data);
    if (editingType === "invoiceCollection") saveInvoiceCollection(data);
    if (editingType === "expense") saveExpense(data);
    if (editingType === "taxPayment") saveTaxPayment(data);
    if (editingType === "team") saveTeam(data);
    if (editingType === "purchase") savePurchase(data);
    if (editingType === "invoicedSale") saveInvoicedSale(data);
    if (editingType === "declaracion") saveDeclaracion(data);
    if (editingType === "programarCobros") { saveProgramarCobros(data); saveState(); quoteDialog.close(); render(); showToast(); return; }
    if (editingType === "cashEntry") { saveCashEntry(data); quoteDialog.close(); render(); showToast(); return; }
    if (editingType === "fixedExpenseBank") { saveFixedExpenseBank(data); saveState(); sbSync().catch(() => {}); quoteDialog.close(); render(); showToast("Cuenta actualizada"); return; }
    if (editingType === "saldoInicial") { saveSaldoInicial(data); saveState(); sbSync().catch(() => {}); quoteDialog.close(); render(); showToast("Saldo inicial actualizado"); return; }
    saveState();
    quoteDialog.close();
    render();
    showToast();
  } catch (err) {
    console.error("Error al guardar:", err);
    showToast("Error al guardar: " + err.message);
  }
}

function saveLead(data) {
  data.service = (data.service || "").trim();
  saveServiceIfNew(data.service);
  const item = newLead(data);
  if (editingId) state.leads = state.leads.map(l => l.id === editingId ? { ...l, ...item, id: editingId, quoteId: l.quoteId } : l);
  else state.leads.unshift(item);
  syncClientsFromActivity();
  activeView = "quotes";
}

function saveQuote(data) {
  data.service = (data.service || "").trim();
  saveServiceIfNew(data.service);
  const existing = editingId ? state.quotes.find(q => q.id === editingId) : null;
  const existingWasGanado = existing?.status === "Ganado";
  const item = newQuote({ ...data, subtotal: Number(data.subtotal), hasIgv: data.hasIgv === "on", wonDate: existingWasGanado ? (existing?.wonDate || "") : "" });
  if (item.status === "Ganado" && !item.wonDate) item.wonDate = today();
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
  if (data.detraccionMode) {
    const modes = state.settings.collectionDetModes || {};
    modes[editingId] = {
      mode:      data.detraccionMode,
      cuenta:    data.detraccionCuenta || "",
      detActual: data.detActual ? (parseFloat(cleanNumericImport(data.detActual)) || null) : null,
      montoReal: data.montoReal ? (parseFloat(cleanNumericImport(data.montoReal)) || null) : null,
      detStatus: data.detStatus || "Completado"
    };
    state.settings.collectionDetModes = modes;
  }
  state.collections = state.collections.map(c => {
    if (c.id !== editingId) return c;
    const paidDate = data.paidDate || (data.status === "Pagado" ? today() : c.paidDate);
    return {
      ...c,
      status: data.status || c.status,
      invoice: data.invoice !== undefined ? data.invoice : c.invoice,
      bankAccount: data.bankAccount || c.bankAccount || "",
      dueDate: data.dueDate || c.dueDate,
      paidDate,
      declared: data.declared || c.declared || "Sin declarar",
      repo: data.repo !== undefined ? data.repo : (c.repo || "")
    };
  });
  activeView = "collections";
}

function saveExpense(data) {
  const item = newExpense({ ...data, refund: data.refund === "on", isAdSpend: data.isAdSpend === "on" });
  if (editingId) state.expenses = state.expenses.map(e => e.id === editingId ? { ...e, ...item, id: editingId } : e);
  else state.expenses.unshift(item);
  activeView = "finance";
}

function saveTaxPayment(data) {
  const item = newTaxPayment(data);
  if (editingId) state.taxPayments = (state.taxPayments || []).map(t => t.id === editingId ? { ...t, ...item, id: editingId } : t);
  else state.taxPayments = [item, ...(state.taxPayments || [])];
  // Guardar mapping taxPaymentId → collectionId en settings (persiste aunque Supabase no tenga la columna)
  if (item.collectionId) {
    const tpc = state.settings.taxPaymentCollections || {};
    tpc[item.id] = item.collectionId;
    state.settings.taxPaymentCollections = tpc;
  }
  // Si es Detracción con collectionId → sincronizar detStatus según estado del pago
  const linkedCollectionId = item.collectionId || (state.settings.taxPaymentCollections || {})[editingId] || "";
  if ((item.type === "Detracción" || item.type === "Autodetracción") && linkedCollectionId) {
    const modes = state.settings.collectionDetModes || {};
    const newDetStatus = item.status === "Pagado" ? "Completado" : "Pendiente";
    modes[linkedCollectionId] = { ...(modes[linkedCollectionId] || {}), detStatus: newDetStatus };
    state.settings.collectionDetModes = modes;
  }
  activeView = "comprobantes";
}

function saveDeclaracion(data) {
  const item = newDeclaracion(data);
  if (editingId) state.declaraciones = (state.declaraciones || []).map(d => d.id === editingId ? { ...d, ...item, id: editingId } : d);
  else state.declaraciones = [item, ...(state.declaraciones || [])];
  activeView = "comprobantes";
}

function savePurchase(data) {
  const item = newPurchase(data);
  if (editingId) state.purchases = state.purchases.map(p => p.id === editingId ? { ...p, ...item, id: editingId } : p);
  else state.purchases.unshift(item);
  activeView = "comprobantes";
}

function saveInvoicedSale(data) {
  const item = newInvoicedSale(data);
  if (editingId) state.invoicedSales = state.invoicedSales.map(s => s.id === editingId ? { ...s, ...item, id: editingId } : s);
  else state.invoicedSales.unshift(item);
  activeView = "comprobantes";
}

function saveTeam(data) {
  const item = newTeamPayment(data);
  if (editingId) state.team = state.team.map(t => t.id === editingId ? { ...t, ...item, id: editingId } : t);
  else state.team.unshift(item);
  activeView = "team";
}

function duplicateTeamPayment(id) {
  const original = state.team.find(t => t.id === id);
  if (!original) return;
  state.team.unshift({ ...original, id: uid(), status: "Pendiente" });
  saveState(); render();
}

function escapeHtml(text = "") {
  return String(text).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

function escapeAttr(text = "") {
  return escapeHtml(text);
}

function initAC(input, getOptions, { label = "opción", onSelect = null, onCreate = null } = {}) {
  let dropdown = null;
  let activeIdx = -1;

  function getOpts() {
    return [...new Set(getOptions().filter(Boolean))];
  }

  function positionDropdown() {
    const r = input.getBoundingClientRect();
    dropdown.style.position = "fixed";
    dropdown.style.top = (r.bottom + 4) + "px";
    dropdown.style.left = r.left + "px";
    dropdown.style.width = r.width + "px";
  }

  function render(term) {
    const all = getOpts();
    const q = term.trim().toLowerCase();
    const filtered = all.filter(o => o.toLowerCase().includes(q)).slice(0, 50);
    const isNew = q.length > 0 && !all.some(o => o.toLowerCase() === q);

    if (!filtered.length && !isNew) { close(); return; }

    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.className = "ac-dropdown";
      const host = input.closest("dialog[open]") || document.body;
      host.appendChild(dropdown);
    }
    positionDropdown();

    dropdown.innerHTML = filtered.map((opt, i) =>
      `<div class="ac-option" data-idx="${i}" data-value="${escapeAttr(opt)}">${escapeHtml(opt)}</div>`
    ).join("") + (isNew
      ? `<div class="ac-create" data-create="${escapeAttr(term.trim())}">← crear ${escapeHtml(label)} <strong>"${escapeHtml(term.trim())}"</strong></div>`
      : "");

    dropdown.querySelectorAll(".ac-option").forEach(el => {
      el.addEventListener("mousedown", e => { e.preventDefault(); pick(el.dataset.value); });
    });
    const cEl = dropdown.querySelector(".ac-create");
    if (cEl) cEl.addEventListener("mousedown", e => { e.preventDefault(); create(cEl.dataset.create); });

    activeIdx = -1;
  }

  function close() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
    activeIdx = -1;
  }

  function pick(value) {
    input.value = value;
    close();
    if (onSelect) onSelect(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function create(value) {
    if (onCreate) onCreate(value);
    pick(value);
  }

  input.addEventListener("input", () => {
    const t = input.value;
    if (!t) { close(); return; }
    render(t);
  });

  input.addEventListener("focus", () => render(input.value || ""));
  input.addEventListener("blur", () => setTimeout(close, 180));

  input.addEventListener("keydown", e => {
    if (!dropdown) {
      if (e.key === "Enter") return;
      return;
    }
    const items = [...dropdown.querySelectorAll(".ac-option, .ac-create")];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
    } else if (e.key === "Enter") {
      if (activeIdx >= 0) {
        e.preventDefault();
        items[activeIdx].dispatchEvent(new MouseEvent("mousedown"));
        return;
      }
      const q = input.value.trim();
      const isNew = q && !getOpts().some(o => o.toLowerCase() === q.toLowerCase());
      if (isNew) { e.preventDefault(); create(q); }
    } else if (e.key === "Escape") {
      close();
    }
    items.forEach((el, i) => el.classList.toggle("active", i === activeIdx));
  });

  window.addEventListener("scroll", () => { if (dropdown) positionDropdown(); }, true);
  window.addEventListener("resize", () => { if (dropdown) positionDropdown(); });
}

function bindDialogAutofills() {
  const form = quoteDialog.querySelector("form");
  if (!form) return;

  // RUC/DNI: solo números, máx 11 dígitos
  form.querySelectorAll("input[name='ruc']").forEach(inp => {
    inp.addEventListener("input", () => {
      inp.value = inp.value.replace(/\D/g, "").slice(0, 11);
    });
  });

  const uniq = arr => [...new Set(arr.filter(s => s && s.length > 0))];
  const getClients    = () => uniq(state.clients.map(c => c.name));
  const getOwners     = () => uniq([...state.leads, ...state.quotes, ...state.team].map(i => i.owner || i.name));
  const getCategories = () => uniq(state.quotes.map(q => q.category));
  const getServices   = () => uniq([...(state.services || []), ...state.quotes.map(q => q.service)]);
  const createService = name => { saveServiceIfNew(name); saveState(); };
  const getSources    = () => uniq(state.leads.map(l => l.source));
  const getChannels   = () => uniq(state.leads.map(l => l.channel));
  const getExpTypes   = () => uniq(state.expenses.map(e => e.type));
  const getVendors    = () => uniq([...(state.vendors || []).map(v => v.name), ...(state.purchases || []).map(p => p.vendor)]);

  const fill = (name, value) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (el && !el.value) el.value = value || "";
  };

  const onClientSelect = name => {
    const found = state.clients.find(c => c.name.toLowerCase() === name.toLowerCase());
    const set = (fieldName, value) => {
      const el = form.querySelector(`[name="${fieldName}"]`);
      if (el) el.value = found ? (value || "") : "";
    };
    set("ruc",        found?.ruc);
    set("contact",    found?.contact);
    set("email",      found?.email);
    set("phone",      found?.phone);
    set("owner",      found?.owner);
    set("clientType", found?.clientType);
    set("country",    found?.country);
  };

  const onVendorSelect = name => {
    const vnd = (state.vendors || []).find(v => v.name.toLowerCase() === name.toLowerCase());
    if (vnd) { fill("ruc", vnd.ruc); return; }
    const found = (state.purchases || []).find(p => p.vendor.toLowerCase() === name.toLowerCase());
    if (found) fill("ruc", found.ruc);
  };

  const createClient = name => {
    if (!state.clients.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      state.clients.unshift(newClient({ name }));
      saveState();
    }
  };

  const getTeamNames  = () => uniq(state.team.map(t => t.name));
  const getTeamRoles  = () => uniq(state.team.map(t => t.role));
  const getTeamBanks  = () => uniq(state.team.map(t => t.bankName).filter(Boolean));

  const isTeam = editingType === "team";

  const acMap = [
    { names: isTeam ? [] : ["client", "name"], getOpts: getClients,    label: "cliente",    onSelect: onClientSelect, onCreate: createClient },
    { names: isTeam ? ["name"]  : [],          getOpts: getTeamNames,  label: "persona" },
    { names: isTeam ? ["role"]  : [],          getOpts: getTeamRoles,  label: "tipo" },
    { names: isTeam ? ["bankName"] : [],       getOpts: getTeamBanks,  label: "banco" },
    { names: ["owner"],                        getOpts: getOwners,     label: "comercial" },
    { names: ["category"],                     getOpts: getCategories, label: "categoría" },
    { names: ["service"],                      getOpts: getServices,   label: "servicio",   onCreate: createService },
    { names: ["source"],                       getOpts: getSources,    label: "fuente" },
    { names: ["channel"],                      getOpts: getChannels,   label: "canal" },
    { names: ["type"],                         getOpts: getExpTypes,   label: "tipo" },
    { names: ["vendor"],                       getOpts: getVendors,    label: "proveedor",  onSelect: onVendorSelect },
  ];

  acMap.forEach(({ names, getOpts, label, onSelect = null, onCreate = null }) => {
    names.forEach(name => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      if (input.tagName === "SELECT") {
        if (onSelect) input.addEventListener("change", () => onSelect(input.value));
      } else {
        initAC(input, getOpts, { label, onSelect, onCreate });
      }
    });
  });
}

function drawCharts() {
  const canvas = document.querySelector("#revenueChart");
  if (!canvas) return;
  const ratio = devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, rect.width, rect.height);

  // Determine granularity from current filter range
  const rStart = parseDate(dashboardRange.start);
  const rEnd   = parseDate(dashboardRange.end);
  const diffDays = Math.round((rEnd - rStart) / 86400000);

  const periods = [];
  const dayFmt  = d => new Intl.DateTimeFormat("es-PE", { day:"numeric", month:"short" }).format(d).replace(".","");
  const monFmt  = d => new Intl.DateTimeFormat("es-PE", { month:"short" }).format(d).replace(".","");

  if (diffDays <= 1) {
    // Single day → one bar labelled with the date
    periods.push({ key: dashboardRange.start, label: dayFmt(rStart), type: "day" });
  } else if (diffDays <= 14) {
    // Up to 2 weeks → one bar per day
    const cur = new Date(rStart);
    while (cur <= rEnd && periods.length <= 14) {
      const key = cur.toISOString().slice(0, 10);
      periods.push({ key, label: dayFmt(new Date(key + "T12:00:00")), type: "day" });
      cur.setDate(cur.getDate() + 1);
    }
  } else if (diffDays <= 90) {
    // Up to 3 months → one bar per week (Mon–Sun)
    const cur = new Date(rStart);
    // align to Monday
    const dow = cur.getDay(); const off = dow === 0 ? -6 : 1 - dow;
    cur.setDate(cur.getDate() + off);
    while (cur <= rEnd && periods.length <= 18) {
      const key = cur.toISOString().slice(0, 10);
      const label = dayFmt(new Date(key + "T12:00:00"));
      const weekEnd = new Date(cur); weekEnd.setDate(cur.getDate() + 6);
      periods.push({ key, keyEnd: weekEnd.toISOString().slice(0, 10), label, type: "week" });
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    // Month granularity
    const cur = new Date(rStart.getFullYear(), rStart.getMonth(), 1);
    const last = new Date(rEnd.getFullYear(), rEnd.getMonth(), 1);
    while (cur <= last && periods.length <= 24) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
      periods.push({ key, label: monFmt(cur), type: "month" });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  // Aggregate data per period (filtered by selected account tab)
  const _acct = revenueChartTab;
  const allColl = collectionRows();

  // Build a quoteId → bankAccount map from collections so that won quotes
  // without a bankAccount assigned can be attributed via their collections.
  const quoteAcctMap = new Map();
  allColl.forEach(c => { if (c.quoteId && c.bankAccount) quoteAcctMap.set(c.quoteId, c.bankAccount); });
  const resolveQuoteAcct = q => q.bankAccount || quoteAcctMap.get(q.id) || "";

  const wonValues = periods.map(p => {
    const qs = state.quotes.filter(q => q.status === "Ganado" && (!_acct || resolveQuoteAcct(q) === _acct));
    if (p.type === "week")
      return qs.filter(q => (q.wonDate||q.date||"") >= p.key && (q.wonDate||q.date||"") <= p.keyEnd).reduce((s,q) => s+calcQuote(q).total, 0);
    return qs.filter(q => (q.wonDate||q.date||"").startsWith(p.key)).reduce((s,q) => s+calcQuote(q).total, 0);
  });
  const cobValues = periods.map(p => {
    const cs = allColl.filter(c => c.status === "Pagado" && (!_acct || c.bankAccount === _acct));
    if (p.type === "week")
      return cs.filter(c => (c.paidDate||"") >= p.key && (c.paidDate||"") <= p.keyEnd).reduce((s,c) => s+c.amount, 0);
    return cs.filter(c => (c.paidDate||"").startsWith(p.key)).reduce((s,c) => s+c.amount, 0);
  });
  const allEgrRows = buildCajaRows().filter(r => r.type === "egreso" && r.status !== "Pendiente");
  const egrValues = periods.map(p => {
    const inRange = (d) => p.type === "week" ? d >= p.key && d <= p.keyEnd : d.startsWith(p.key);
    return allEgrRows.filter(r => inRange(r.date||"") && (!_acct || r.bankAccount === _acct)).reduce((s,r) => s+r.amount, 0);
  });

  const goal = state.settings.monthlyGoal || 0;
  const showGoal = p => p.type === "month" && goal > 0;
  const max = Math.max(...wonValues, ...cobValues, ...egrValues, goal) * 1.2 || 1;
  const padL = 52, padB = 34, padT = 24, padR = 14;
  const chartW = rect.width - padL - padR;
  const chartH = rect.height - padB - padT;
  const n = periods.length;
  const groupW = chartW / n;
  const barW = Math.min(20, Math.max(6, groupW * 0.26));

  // Grid lines + Y labels
  const gridLines = 4;
  ctx.font = `11px Inter, sans-serif`;
  for (let i = 0; i <= gridLines; i++) {
    const v = (max / gridLines) * i;
    const y = padT + chartH - (v / max) * chartH;
    ctx.strokeStyle = "#e8eef4";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(rect.width - padR, y); ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    const lbl = v >= 1000 ? `${(v/1000).toFixed(v>=10000?0:1)}k` : `${Math.round(v)}`;
    ctx.fillText(lbl, 2, y + 4);
  }

  // Bars
  const drawRoundedBar = (x, y, w, h, r, color) => {
    if (h < 1) return;
    r = Math.min(r, w/2, h);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
  };

  periods.forEach((p, i) => {
    const cx = padL + i * groupW + groupW / 2;
    const gap = barW + 2;
    drawRoundedBar(cx - gap - barW/2, padT + chartH - (wonValues[i]/max)*chartH, barW, (wonValues[i]/max)*chartH, 3, "#4f7cff");
    drawRoundedBar(cx         - barW/2, padT + chartH - (cobValues[i]/max)*chartH, barW, (cobValues[i]/max)*chartH, 3, "#34d399");
    drawRoundedBar(cx + gap   - barW/2, padT + chartH - (egrValues[i]/max)*chartH, barW, (egrValues[i]/max)*chartH, 3, "#fb7185");
    ctx.fillStyle = "#64748b";
    ctx.font = `${n > 20 ? 9 : 11}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(p.label, cx, rect.height - 8);
    ctx.textAlign = "left";
  });

  // Goal line (only for month view)
  if (goal > 0 && periods[0]?.type === "month") {
    const goalY = padT + chartH - (goal / max) * chartH;
    ctx.strokeStyle = "#f59e0b";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, goalY); ctx.lineTo(rect.width - padR, goalY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f59e0b";
    ctx.font = `11px Inter, sans-serif`;
    ctx.fillText("Meta", padL + 4, goalY - 5);
  }

  // Subtitle — reflect active filter
  const subtitleEl = document.getElementById("revenueChartSubtitle");
  if (subtitleEl) subtitleEl.textContent = `${dashboardRange.label} · vendido vs cobrado`;

  // Legend — top right
  const legendItems = [["#4f7cff","Vendido"],["#34d399","Cobrado"],["#fb7185","Egresos"]];
  ctx.font = `11px Inter, sans-serif`;
  const totalLegendW = legendItems.reduce((s,[,l]) => s + 10 + 4 + ctx.measureText(l).width + 16, 0);
  let lx = rect.width - padR - totalLegendW;
  const legendY = padT - 8;
  legendItems.forEach(([color, label]) => {
    ctx.fillStyle = color;
    ctx.fillRect(lx, legendY, 10, 10);
    ctx.fillStyle = "#64748b";
    ctx.fillText(label, lx + 14, legendY + 9);
    lx += 14 + ctx.measureText(label).width + 16;
  });

  // Store bar hit areas for tooltip
  canvas._chartBars = periods.map((p, i) => {
    const cx = padL + i * groupW + groupW / 2;
    const gap = barW + 2;
    return {
      label: p.label,
      bars: [
        { name: "Vendido", color: "#4f7cff", value: wonValues[i], x: cx - gap - barW/2, y: padT + chartH - (wonValues[i]/max)*chartH, w: barW, h: (wonValues[i]/max)*chartH },
        { name: "Cobrado", color: "#34d399", value: cobValues[i], x: cx - barW/2,       y: padT + chartH - (cobValues[i]/max)*chartH, w: barW, h: (cobValues[i]/max)*chartH },
        { name: "Egresos", color: "#fb7185", value: egrValues[i], x: cx + gap - barW/2, y: padT + chartH - (egrValues[i]/max)*chartH, w: barW, h: (egrValues[i]/max)*chartH },
      ]
    };
  });

  // Attach tooltip listener once
  if (!canvas._tooltipBound) {
    canvas._tooltipBound = true;
    let tooltip = document.getElementById("chartTooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "chartTooltip";
      tooltip.style.cssText = "position:fixed;pointer-events:none;background:#1e293b;color:#f1f5f9;font:12px Inter,sans-serif;padding:8px 12px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.2);display:none;z-index:9999;line-height:1.6;white-space:nowrap;";
      document.body.appendChild(tooltip);
    }
    canvas.addEventListener("mousemove", e => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let hit = null;
      for (const period of (canvas._chartBars || [])) {
        for (const bar of period.bars) {
          if (mx >= bar.x && mx <= bar.x + bar.w && my >= bar.y && my <= bar.y + bar.h) { hit = { period, bar }; break; }
        }
        if (hit) break;
      }
      if (hit) {
        const fmt = v => v >= 1000 ? `S/ ${(v/1000).toFixed(1)}k` : `S/ ${Math.round(v)}`;
        tooltip.innerHTML = `<strong style="color:${hit.bar.color}">${hit.bar.name}</strong> · ${hit.period.label}<br>${fmt(hit.bar.value)}`;
        tooltip.style.display = "block";
        tooltip.style.left = (e.clientX + 12) + "px";
        tooltip.style.top  = (e.clientY - 36) + "px";
      } else {
        tooltip.style.display = "none";
      }
    });
    canvas.addEventListener("mouseleave", () => {
      const tooltip = document.getElementById("chartTooltip");
      if (tooltip) tooltip.style.display = "none";
    });
  }
}

document.querySelector("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  if (authMode === "forgot") {
    const { error } = await sb.auth.resetPasswordForEmail(email);
    authHint.textContent = error ? error.message : `Listo. Revisa tu correo ${email}.`;
    if (!error) setTimeout(() => setAuthMode("login"), 2000);
    return;
  }

  const submitBtn = event.currentTarget.querySelector("button[type=submit]");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Ingresando..."; }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Ingresar"; }

  if (error) {
    authHint.textContent = "Correo o contraseña incorrectos.";
    return;
  }

  sbUser = data.user;
  syncFromSupabaseMeta(data.user);
  loginScreen.classList.add("hidden");
  if (isMobileDevice()) { showMobileGate(); } else { showSkeleton(activeView); appShell.classList.remove("hidden"); }
  await sbLoad();
  render();
  hideSkeleton(2000);
  setTimeout(initOnboarding, 400);
});

profileMenuBtn.addEventListener("click", () => {
  const isOpen = !profileDropdown.classList.contains("hidden");
  profileDropdown.classList.toggle("hidden", isOpen);
  profileMenuBtn.setAttribute("aria-expanded", String(!isOpen));
});
editProfileBtn.addEventListener("click", () => {
  const current = auth();
  profileForm.elements.profileName.value = current.name || "Administrador";
  profileForm.elements.profileEmail.value = current.email || "admin@bandu.pe";
  profileForm.elements.companyName.value = current.companyName || "";
  profileForm.elements.newPassword.value = "";
  profileForm.elements.confirmPassword.value = "";
  document.querySelector("#profileMessage").textContent = "";
  // populate photo preview
  const photo = localStorage.getItem("nebumia-profile-photo");
  const img = document.getElementById("profilePhotoImg");
  const ini = document.getElementById("profilePhotoInitial");
  if (photo && img) { img.src = photo; img.style.display = "block"; ini.style.display = "none"; }
  else if (img) { img.src = ""; img.style.display = "none"; ini.style.display = ""; ini.textContent = (current.name||"N").charAt(0).toUpperCase(); }
  profileDropdown.classList.add("hidden");
  profileDialog.showModal();
});
// photo upload preview
document.getElementById("profilePhotoInput")?.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById("profilePhotoImg");
    const ini = document.getElementById("profilePhotoInitial");
    img.src = ev.target.result;
    img.style.display = "block";
    ini.style.display = "none";
  };
  reader.readAsDataURL(file);
});
document.getElementById("removeProfilePhoto")?.addEventListener("click", () => {
  const img = document.getElementById("profilePhotoImg");
  const ini = document.getElementById("profilePhotoInitial");
  document.getElementById("profilePhotoInput").value = "";
  img.src = ""; img.style.display = "none";
  ini.style.display = "";
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
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  location.reload();
});

// ── Notification bell ──────────────────────────────────────────────────────
function buildNotifAlerts() {
  const t = today();
  const soon = new Date(); soon.setDate(soon.getDate() + 7);
  const soonStr = soon.toISOString().slice(0, 10);

  const items = [];
  const nowTs = new Date();
  const nowLabel = nowTs.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + nowTs.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  // Cobros vencidos
  const allCollections = [
    ...(state.quotes || []).flatMap(q => (q.collections || []).map(c => ({ ...c, ref: q.client }))),
    ...(state.cashEntries || []).filter(e => e.type === "cobro"),
  ];
  allCollections
    .filter(c => c.status !== "Pagado" && c.dueDate && c.dueDate < t)
    .forEach(c => items.push({ type: "red", section: "Cobros vencidos", nav: "collections", title: `Cobro vencido: ${c.ref || c.description || "Sin descripción"}`, sub: `Venció el ${c.dueDate}`, createdAt: nowLabel }));

  // Cobros próximos (próximos 7 días)
  allCollections
    .filter(c => c.status !== "Pagado" && c.dueDate && c.dueDate >= t && c.dueDate <= soonStr)
    .forEach(c => items.push({ type: "amber", section: "Cobros próximos", nav: "collections", title: `Cobro próximo: ${c.ref || c.description || "Sin descripción"}`, sub: `Vence el ${c.dueDate}`, createdAt: nowLabel }));

  // Pagos de equipo pendientes — sólo cuando la fecha de pago ya llegó o es en los próximos 7 días
  const _lastDayOf = monthName => {
    const idx = months.indexOf(monthName);
    if (idx < 0) return "";
    const now2 = new Date();
    return new Date(now2.getFullYear(), idx + 1, 0).toISOString().substring(0, 10);
  };
  (state.team || [])
    .filter(m => {
      if (m.status !== "Pendiente") return false;
      const d = m.dueDate || _lastDayOf(m.month);
      return d && d <= soonStr;
    })
    .forEach(m => {
      const d = m.dueDate || _lastDayOf(m.month);
      const overdue = d < t;
      items.push({ type: overdue ? "red" : "amber", section: overdue ? "Pagos equipo vencidos" : "Pagos equipo próximos", nav: "team", title: `Pago pendiente: ${m.name}`, sub: `${fmt(m.amount || 0, m.currency)} · ${m.role || ""} · vence ${fmtDate(d)}`, createdAt: nowLabel });
    });

  // SUNAT pendiente — sólo cuando el período ya terminó o vence en los próximos 7 días
  const _periodEnd = tp => {
    const idx = months.indexOf(tp.period || "");
    if (idx < 0) return tp.date || "";
    const yr = tp.date ? parseInt(tp.date.substring(0, 4)) : new Date().getFullYear();
    return new Date(yr, idx + 1, 0).toISOString().substring(0, 10);
  };
  (state.taxPayments || [])
    .filter(tp => {
      if (tp.status !== "Pendiente") return false;
      const d = _periodEnd(tp);
      return d && d <= soonStr;
    })
    .forEach(tp => {
      const d = _periodEnd(tp);
      const overdue = d < t;
      items.push({ type: overdue ? "red" : "amber", section: overdue ? "SUNAT vencido" : "SUNAT próximo", nav: "comprobantes", title: `Declaración SUNAT pendiente`, sub: `${tp.period || ""} · ${fmt(tp.amount || 0)} · ${overdue ? "período cerrado" : `cierra ${fmtDate(d)}`}`, createdAt: nowLabel });
    });

  return items;
}

function renderNotifDropdown() {
  const items = buildNotifAlerts();
  const badge = document.querySelector("#notifBadge");
  const dropdown = document.querySelector("#notifDropdown");

  // Badge
  if (items.length > 0) {
    badge.textContent = items.length > 99 ? "99+" : items.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  // Group by section
  const sections = {};
  items.forEach(it => {
    if (!sections[it.section]) sections[it.section] = [];
    sections[it.section].push(it);
  });

  const dotColor = type => type === "red" ? "#ef4444" : "#4f7cff";

  let html = `<div class="notif-header"><span class="notif-header-title">Notificaciones</span></div><div class="notif-body">`;

  if (items.length === 0) {
    html += `<div class="notif-empty">Sin alertas pendientes</div>`;
  } else {
    Object.entries(sections).forEach(([sec, its]) => {
      html += `<div class="notif-section-label">${escapeHtml(sec)}</div>`;
      its.forEach(it => {
        html += `<div class="notif-item notif-item--${it.type} notif-item--clickable" data-notif-nav="${it.nav}" role="button" tabindex="0">
          <div class="notif-dot" style="background:${dotColor(it.type)}"></div>
          <div class="notif-content"><strong>${escapeHtml(it.title)}</strong><span>${escapeHtml(it.sub)}</span>${it.createdAt ? `<span class="notif-timestamp">${escapeHtml(it.createdAt)}</span>` : ""}</div>
          <svg class="app-icon notif-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>`;
      });
    });
  }

  html += `</div>`;
  dropdown.innerHTML = html;
}

const notifBtn = document.querySelector("#notifBtn");
const notifDropdown = document.querySelector("#notifDropdown");

notifBtn.addEventListener("click", e => {
  e.stopPropagation();
  renderNotifDropdown();
  notifDropdown.classList.toggle("hidden");
});

notifDropdown.addEventListener("click", e => {
  const item = e.target.closest("[data-notif-nav]");
  if (!item) return;
  const view = item.dataset.notifNav;
  if (!view) return;
  notifDropdown.classList.add("hidden");
  activeView = view;
  showContentLoader();
  render();
  hideContentLoader(50);
});

document.addEventListener("click", e => {
  if (!notifDropdown.classList.contains("hidden") && !notifDropdown.contains(e.target) && e.target !== notifBtn) {
    notifDropdown.classList.add("hidden");
  }
});

function refreshNotifBadge() {
  const items = buildNotifAlerts();
  const badge = document.querySelector("#notifBadge");
  if (items.length > 0) {
    badge.textContent = items.length > 99 ? "99+" : items.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}
quoteForm.addEventListener("submit", handleEntitySubmit);

profileForm.addEventListener("submit", async event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const message = document.querySelector("#profileMessage");
  const newPwd = form.get("newPassword");
  const confirmPwd = form.get("confirmPassword");
  if (newPwd && newPwd !== confirmPwd) {
    message.textContent = "Las contraseñas no coinciden.";
    return;
  }
  const updates = { name: form.get("profileName"), email: form.get("profileEmail"), companyName: form.get("companyName") || "" };
  if (newPwd) updates.password = newPwd;
  saveAuth(updates);
  // handle photo: compress and sync to Supabase metadata
  const photoInput = document.getElementById("profilePhotoInput");
  const img = document.getElementById("profilePhotoImg");
  let photoThumb = null;
  if (photoInput?.files[0] && img?.src) {
    photoThumb = await compressPhoto(img.src);
    localStorage.setItem("nebumia-profile-photo", photoThumb);
  } else if (img?.src && img.src.startsWith("data:")) {
    photoThumb = img.src.length < 50000 ? img.src : await compressPhoto(img.src);
    localStorage.setItem("nebumia-profile-photo", photoThumb);
  } else if (!img?.src || !img.src.startsWith("data:")) {
    localStorage.removeItem("nebumia-profile-photo");
  }
  // sync everything to Supabase user metadata
  const sbMeta = { name: updates.name, companyName: updates.companyName, photo: photoThumb };
  if (newPwd) sb.auth.updateUser({ password: newPwd, data: sbMeta }).catch(() => {});
  else sb.auth.updateUser({ data: sbMeta }).catch(() => {});
  syncProfileUI();
  document.querySelector("#email").value = form.get("profileEmail");
  message.textContent = "";
  showToast(newPwd ? "Perfil y contraseña actualizados" : "Perfil actualizado");
  setTimeout(() => profileDialog.close(), 500);
});

document.getElementById("helpBtn")?.addEventListener("click", () => {
  document.getElementById("helpFeedback").textContent = "";
  document.getElementById("helpForm").reset();
  profileDropdown.classList.add("hidden");
  document.getElementById("helpDialog").showModal();
});
document.getElementById("helpForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const current = auth();
  const form = new FormData(e.currentTarget);
  const subject = encodeURIComponent(`[Nebumia] ${form.get("helpSubject")}`);
  const body = encodeURIComponent(`De: ${current.name} (${current.email})\n\n${form.get("helpMessage")}`);
  window.open(`mailto:soporte@bandu.pe?subject=${subject}&body=${body}`, "_blank");
  document.getElementById("helpFeedback").textContent = "✓ Abriendo tu cliente de correo…";
  setTimeout(() => document.getElementById("helpDialog").close(), 1200);
});

const SK_SIDEBAR = `
  <div class="sk-sidebar">
    <div class="sk-logo">
      <div class="sk-block" style="width:32px;height:32px;border-radius:8px"></div>
      <div class="sk-block" style="width:80px;height:16px"></div>
    </div>
    <div class="sk-nav">
      <div class="sk-block" style="width:100%;height:14px"></div>
      <div class="sk-block" style="width:75%;height:14px"></div>
      <div class="sk-block" style="width:90%;height:14px"></div>
      <div class="sk-block" style="width:65%;height:14px"></div>
      <div class="sk-block" style="width:85%;height:14px"></div>
      <div class="sk-block" style="width:70%;height:14px"></div>
      <div class="sk-block" style="width:80%;height:14px"></div>
      <div class="sk-block" style="width:60%;height:14px"></div>
    </div>
  </div>`;

function skMetrics(n) {
  return `<div class="sk-metrics sk-metrics-${n}">${Array(n).fill('<div class="sk-card"></div>').join("")}</div>`;
}
function skToolbar() {
  return `<div class="sk-toolbar">
    <div class="sk-block" style="width:220px;height:36px;border-radius:8px"></div>
    <div class="sk-block" style="width:130px;height:36px;border-radius:8px"></div>
    <div class="sk-block" style="width:110px;height:36px;border-radius:8px"></div>
  </div>`;
}
function skTable(rows = 5) {
  return `<div class="sk-table">
    <div class="sk-row header"></div>
    ${Array(rows).fill('<div class="sk-row"></div>').join("")}
  </div>`;
}
function skTabs() {
  return `<div class="sk-tabs">
    <div class="sk-block" style="width:80px;height:30px;border-radius:20px"></div>
    <div class="sk-block" style="width:200px;height:30px;border-radius:20px"></div>
    <div class="sk-block" style="width:200px;height:30px;border-radius:20px"></div>
  </div>`;
}
function skTwoCol() {
  return `<div class="sk-two-col">
    <div class="sk-panel"></div>
    <div class="sk-panel"></div>
  </div>`;
}

function skContentFor(view) {
  const topbar = `<div class="sk-topbar">
    <div class="sk-block" style="width:180px;height:22px"></div>
    <div class="sk-block" style="width:100px;height:34px;border-radius:8px"></div>
  </div>`;
  switch (view) {
    case "dashboard":
      return topbar + skMetrics(4) + skToolbar() + skTable(5);
    case "quotes":
      return topbar + skMetrics(2) + skToolbar() + skTable(5);
    case "sales":
      return topbar + skMetrics(3) + skToolbar() + skTable(5);
    case "collections":
      return topbar + skMetrics(3) + skToolbar() + skTable(5);
    case "clients":
      return topbar + skToolbar() + skTable(6);
    case "finance":
      return topbar + skMetrics(4) + skTabs() + skToolbar() + skTable(4) + skTable(3);
    case "team":
      return topbar + skMetrics(2) + skToolbar() + skTable(5);
    case "comprobantes":
      return topbar + skToolbar() + skTable(4) + skTable(4);
    case "settings":
      return topbar + skMetrics(4) + skTwoCol();
    default:
      return topbar + skMetrics(4) + skToolbar() + skTable(5);
  }
}

let _pendingDeleteCallback = null;

function applySidebarState() {
  appShell.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  const btn = document.getElementById("sidebarCollapseBtn");
  if (btn) {
    btn.title = sidebarCollapsed ? "Expandir menú" : "Colapsar menú";
    btn.innerHTML = icon(sidebarCollapsed ? "chevron-right" : "chevron-left");
  }
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
  applySidebarState();
}

function initConfirmDialog() {
  const modal  = document.getElementById("confirmModal");
  const btnOk  = document.getElementById("confirmDeleteBtn");
  const btnCan = document.getElementById("confirmCancelBtn");
  if (!modal || !btnOk || !btnCan) return;
  btnOk.addEventListener("click", () => {
    modal.classList.add("hidden");
    if (_pendingDeleteCallback) { _pendingDeleteCallback(); _pendingDeleteCallback = null; }
  });
  btnCan.addEventListener("click", () => {
    modal.classList.add("hidden");
    _pendingDeleteCallback = null;
  });
  modal.addEventListener("click", e => {
    if (e.target === modal) { modal.classList.add("hidden"); _pendingDeleteCallback = null; }
  });
}

function confirmDelete(message, onConfirm) {
  const modal = document.getElementById("confirmModal");
  if (!modal) return;
  document.getElementById("confirmMessage").textContent = message || "Esta acción no se puede revertir. El elemento será eliminado permanentemente.";
  _pendingDeleteCallback = onConfirm;
  modal.classList.remove("hidden");
}

function showToast(message = "Guardado correctamente") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 280);
  }, 3000);
}

function showContentLoader() {
  const el = document.getElementById("contentLoader");
  if (!el) return;
  el.classList.remove("hidden", "fade-out");
}

function hideContentLoader(delay = 0) {
  const el = document.getElementById("contentLoader");
  if (!el) return;
  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => el.classList.add("hidden"), 150);
  }, delay);
}

function hideSkeleton(delay = 0) {
  const sk = document.getElementById("preloader");
  if (!sk) return;
  setTimeout(() => {
    sk.classList.add("fade-out");
    setTimeout(() => sk.remove(), 220);
  }, delay);
}

function showSkeleton(view) {
  let sk = document.getElementById("preloader");
  if (!sk) {
    sk = document.createElement("div");
    sk.id = "preloader";
    sk.setAttribute("aria-hidden", "true");
    document.body.prepend(sk);
  }
  sk.classList.remove("fade-out");
  sk.innerHTML = SK_SIDEBAR + `<div class="sk-content">${skContentFor(view)}</div>`;
}

// ════════════════════════════════════════════════════════════
// INLINE FORM VALIDATION
// ════════════════════════════════════════════════════════════
const FIELD_RULES = {
  date:           { required: true,  msg: "Selecciona una fecha" },
  dueDate:        { required: true,  msg: "Selecciona una fecha" },
  wonDate:        { required: true,  msg: "Selecciona una fecha de venta" },
  code:           { required: true,  msg: "El código PPTO es requerido" },
  client:         { required: true,  msg: "Selecciona un cliente" },
  service:        { required: true,  msg: "Selecciona un servicio" },
  owner:          { required: true,  msg: "Selecciona un comercial" },
  subtotal:       { required: true,  msg: "Ingresa un monto válido" },
  estimatedValue: { required: true,  msg: "Ingresa un valor estimado" },
  name:           { required: true,  minLen: 2, msg: "Ingresa el nombre completo" },
  type:           { required: true,  msg: "Ingresa el tipo" },
  concept:        { required: true,  msg: "Ingresa el concepto" },
  amount:         { required: true,  msg: "Ingresa un monto válido" },
  email:          { optional: true,  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: "Correo inválido" },
  repo:           { optional: true,  pattern: /^$|^https?:\/\/.+/, msg: "Debe ser una URL válida (https://…)" },
  docLink:        { optional: true,  pattern: /^$|^https?:\/\/.+/, msg: "Debe ser una URL válida (https://…)" },
  receipt:        { optional: true,  pattern: /^$|^https?:\/\/.+/, msg: "Debe ser una URL válida (https://…)" },
};

function validateField(name, value) {
  const rule = FIELD_RULES[name];
  if (!rule) return null;
  const v = (value || "").toString().trim();
  if (rule.required && !v) return rule.msg;
  if (rule.minLen && v.length > 0 && v.length < rule.minLen) return rule.msg;
  if (rule.pattern && v && !rule.pattern.test(v)) return rule.msg;
  return null;
}

function setFieldState(label, error) {
  label.classList.remove("label-invalid", "label-valid");
  const prev = label.querySelector(".field-err-msg");
  if (prev) prev.remove();
  if (error) {
    label.classList.add("label-invalid");
    const msg = document.createElement("span");
    msg.className = "field-err-msg";
    msg.textContent = error;
    label.appendChild(msg);
  } else {
    const input = label.querySelector("input,select,textarea");
    if (input?.value?.toString().trim()) label.classList.add("label-valid");
  }
}

function updateErrorSummary(form) {
  const invalidCount = form.querySelectorAll(".label-invalid").length;
  let summary = form.querySelector(".dialog-error-summary");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "dialog-error-summary";
    const actions = form.querySelector(".dialog-actions");
    if (actions) actions.before(summary);
  }
  if (invalidCount > 0) {
    summary.textContent = `${invalidCount} campo${invalidCount === 1 ? "" : "s"} con error — revisa antes de guardar`;
    summary.classList.add("visible");
  } else {
    summary.classList.remove("visible");
  }
}

function attachFormValidation(form) {
  if (!form) return;
  form.querySelectorAll("input[name], select[name], textarea[name]").forEach(input => {
    const rule = FIELD_RULES[input.name];
    if (!rule) return;
    const label = input.closest("label");
    if (!label) return;
    // Required asterisk — wrap text + star in a single span so display:grid doesn't split them onto separate rows
    if (rule.required && !label.querySelector(".req-star")) {
      const firstText = [...label.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      if (firstText) {
        const wrapper = document.createElement("span");
        wrapper.className = "field-label-text";
        wrapper.textContent = firstText.textContent;
        const star = document.createElement("span");
        star.className = "req-star";
        star.setAttribute("aria-hidden", "true");
        star.textContent = " *";
        wrapper.appendChild(star);
        firstText.replaceWith(wrapper);
      }
    }
    const doValidate = () => {
      setFieldState(label, validateField(input.name, input.value));
      updateErrorSummary(form);
    };
    input.addEventListener("blur", doValidate);
    if (input.tagName === "SELECT") input.addEventListener("change", doValidate);
  });
}

function validateFormBeforeSubmit(form) {
  let hasError = false;
  form.querySelectorAll("input[name], select[name], textarea[name]").forEach(input => {
    if (!FIELD_RULES[input.name]) return;
    const label = input.closest("label");
    if (!label) return;
    const error = validateField(input.name, input.value);
    setFieldState(label, error);
    if (error) hasError = true;
  });
  updateErrorSummary(form);
  if (hasError) {
    const firstInvalid = form.querySelector(".label-invalid input, .label-invalid select, .label-invalid textarea");
    if (firstInvalid) firstInvalid.focus();
  }
  return !hasError;
}

// ════════════════════════════════════════════════════════════
// COMMAND PALETTE (Ctrl/Cmd + K)
// ════════════════════════════════════════════════════════════
let cpSelectedIdx = 0;
let cpCurrentItems = [];

const CP_ACTIONS = [
  { type: "action", label: "Nueva cotización",     sub: "Crear cotización o lead",         icon: "fileText",  iconBg: "#eff3ff", action: "new-quote"  },
  { type: "action", label: "Nuevo lead",            sub: "Registrar oportunidad comercial", icon: "target",    iconBg: "#ecfdf5", action: "new-lead"   },
  { type: "action", label: "Nuevo cliente",         sub: "Agregar cliente a la base",       icon: "users",     iconBg: "#fdf4ff", action: "new-client" },
  { type: "action", label: "Nueva venta",           sub: "Registrar venta ganada",          icon: "receipt",   iconBg: "#fff7ed", action: "new-sale"   },
  { type: "action", label: "Nuevo pago de equipo",  sub: "Registrar pago a personal",       icon: "briefcase", iconBg: "#f5f3ff", action: "new-team"   },
];

const CP_MODULES = [
  { type: "module", label: "Dashboard",       sub: "Vista general de la agencia",    icon: "layout",   iconBg: "#f0fdf4", nav: "dashboard"     },
  { type: "module", label: "Clientes",        sub: "Base de clientes",               icon: "users",    iconBg: "#eff3ff", nav: "clients"       },
  { type: "module", label: "Cotizaciones",    sub: "Pipeline y cotizaciones",        icon: "fileText", iconBg: "#fffbeb", nav: "quotes"        },
  { type: "module", label: "Ventas",          sub: "Ventas ganadas",                 icon: "receipt",  iconBg: "#f0fdf4", nav: "sales"         },
  { type: "module", label: "Cobranzas",       sub: "Cobros pendientes y pagados",    icon: "wallet",   iconBg: "#eff3ff", nav: "collections"   },
  { type: "module", label: "Caja financiera", sub: "Ingresos, egresos y balance",   icon: "banknote", iconBg: "#fdf4ff", nav: "finance"       },
  { type: "module", label: "Contabilidad",    sub: "SUNAT, compras, facturas",       icon: "book",     iconBg: "#fff7ed", nav: "comprobantes"  },
  { type: "module", label: "Pago personal",   sub: "Pagos al equipo",               icon: "briefcase",iconBg: "#f5f3ff", nav: "team"          },
  { type: "module", label: "Configuración",   sub: "Ajustes del sistema",            icon: "settings", iconBg: "#f8fafc", nav: "settings"      },
];

function buildCPIndex() {
  const items = [];
  const fmtAmt = (amt, curr) => fmt(Number(amt) || 0, curr || "PEN");

  // Clientes
  (state.clients || []).forEach(c => items.push({
    type: "client", nav: "clients", icon: "users", iconBg: "#eff3ff", badge: c.clientType || null,
    label: c.name,
    sub: [c.ruc ? "RUC " + c.ruc : null, c.clientType, c.contact].filter(Boolean).join(" · "),
    _s: [c.name, c.ruc, c.contact, c.email, c.phone, c.clientType].join(" ")
  }));

  // Cotizaciones — TODAS (incluyendo Ganadas) → siempre buscables como cotización
  (state.quotes || []).forEach(q => {
    const base_s = [q.code, q.client, q.service, q.category, q.owner, q.status, q.comments, q.month].join(" ");
    items.push({
      type: "quote", nav: "quotes", icon: "fileText", iconBg: "#fffbeb", badge: q.status || null,
      label: (q.code || "") + (q.client ? " — " + q.client : ""),
      sub: [q.service, fmtAmt(q.subtotal, q.currency), q.status].filter(Boolean).join(" · "),
      _s: base_s
    });
    // Ganadas también en Ventas (módulo separado)
    if (q.status === "Ganado") {
      items.push({
        type: "sale", nav: "sales", icon: "receipt", iconBg: "#f0fdf4", badge: "Ganado",
        label: (q.code || "") + (q.client ? " — " + q.client : ""),
        sub: [q.service, fmtAmt(q.subtotal, q.currency), "Ganado"].filter(Boolean).join(" · "),
        _s: base_s
      });
    }
  });

  // Leads
  (state.leads || []).forEach(l => items.push({
    type: "lead", nav: "quotes", icon: "target", iconBg: "#ecfdf5", badge: l.status || null,
    label: (l.client || "Sin cliente") + (l.service ? " · " + l.service : ""),
    sub: [l.source, l.status, l.estimatedValue ? fmtAmt(l.estimatedValue, l.currency) : null].filter(Boolean).join(" · "),
    _s: [l.client, l.service, l.source, l.channel, l.owner, l.status, l.notes].join(" ")
  }));

  // Cobranzas
  (state.collections || []).forEach(c => {
    const q = (state.quotes || []).find(x => x.id === c.quoteId);
    items.push({
      type: "collection", nav: "collections", icon: "wallet", iconBg: "#eff3ff", badge: c.status || null,
      label: [q ? q.code : null, q ? q.client : null].filter(Boolean).join(" — ") + (c.label ? " · " + c.label : ""),
      sub: [fmtAmt(c.amount, c.currency), c.status, c.dueDate].filter(Boolean).join(" · "),
      _s: [q ? q.code : "", q ? q.client : "", c.status, c.label, c.invoice].join(" ")
    });
  });

  // Gastos (caja financiera)
  (state.expenses || []).forEach(e => items.push({
    type: "expense", nav: "finance", icon: "banknote", iconBg: "#fdf4ff", badge: e.status || null,
    label: e.concept || "Gasto",
    sub: [e.type, fmtAmt(e.amount, e.currency), e.status].filter(Boolean).join(" · "),
    _s: [e.concept, e.type, e.status, e.owner].join(" ")
  }));

  // Pago personal (equipo)
  (state.team || []).forEach(t => items.push({
    type: "team", nav: "team", icon: "briefcase", iconBg: "#f5f3ff", badge: t.status || null,
    label: (t.name || "Sin nombre") + (t.role ? " · " + t.role : ""),
    sub: [t.month, fmtAmt(t.amount), t.status].filter(Boolean).join(" · "),
    _s: [t.name, t.role, t.month, t.status].join(" ")
  }));

  // Pagos SUNAT / tributos
  (state.taxPayments || []).forEach(tp => items.push({
    type: "taxpayment", nav: "comprobantes", icon: "book", iconBg: "#fff7ed", badge: tp.status || null,
    label: (tp.type || "SUNAT") + " — " + (tp.period || ""),
    sub: [fmtAmt(tp.amount), tp.status].filter(Boolean).join(" · "),
    _s: [tp.type, tp.period, tp.status, tp.sunatRef].join(" ")
  }));

  // Compras
  (state.purchases || []).forEach(p => items.push({
    type: "purchase", nav: "comprobantes", icon: "book", iconBg: "#fff7ed", badge: p.invoiceType || null,
    label: (p.vendor || "Proveedor") + (p.invoiceNum ? " · " + p.invoiceNum : ""),
    sub: [p.concept, fmtAmt(p.subtotal || p.amount, p.currency)].filter(Boolean).join(" · "),
    _s: [p.vendor, p.ruc, p.invoiceNum, p.concept, p.declared].join(" ")
  }));

  // Ventas facturadas
  (state.invoicedSales || []).forEach(inv => {
    const invQ = (state.quotes || []).find(x => x.id === inv.quoteId);
    items.push({
      type: "invoicedsale", nav: "comprobantes", icon: "receipt", iconBg: "#f0fdf4", badge: inv.invoiceType || null,
      label: (inv.invoiceNum || inv.invoiceType || "Factura") + (inv.client ? " — " + inv.client : ""),
      sub: [inv.service, fmtAmt(inv.total, inv.currency)].filter(Boolean).join(" · "),
      _s: [inv.client, inv.ruc, inv.invoiceNum, inv.service, inv.invoiceType, invQ ? invQ.code : ""].join(" ")
    });
  });

  // Caja financiera — filas computadas (ingresos de cobranzas, egresos de gastos, pagos, etc.)
  try {
    buildCajaRows().forEach(row => items.push({
      type: "cashentry", nav: "finance", icon: row.type === "ingreso" ? "banknote" : "banknote", iconBg: row.type === "ingreso" ? "#f0fdf4" : "#fdf4ff", badge: row.type === "ingreso" ? "Ingreso" : "Egreso",
      label: row.concept || "Movimiento de caja",
      sub: [row.category, fmtAmt(row.amount, row.currency), row.status].filter(Boolean).join(" · "),
      _s: [row.concept, row.category, row.source, row.type, row.status, row.invoice].join(" ")
    }));
  } catch(_) {}
  // Entradas manuales de caja (ya incluidas en buildCajaRows pero indexadas también por sus campos propios)
  (state.cashEntries || []).forEach(ce => items.push({
    type: "cashentry", nav: "finance", icon: "banknote", iconBg: "#f0fdf4", badge: ce.type || null,
    label: ce.concept || "Movimiento de caja",
    sub: [ce.type === "ingreso" ? "Ingreso" : "Egreso", fmtAmt(ce.amount, ce.currency), ce.category].filter(Boolean).join(" · "),
    _s: [ce.concept, ce.category, ce.type, ce.bankAccount].join(" ")
  }));

  // Declaraciones mensuales SUNAT
  (state.declaraciones || []).forEach(d => items.push({
    type: "declaracion", nav: "comprobantes", icon: "book", iconBg: "#fff7ed", badge: d.status || null,
    label: "Declaración — " + (d.period || ""),
    sub: [d.status, d.notes].filter(Boolean).join(" · "),
    _s: ["declaracion", "declaración", d.period, d.status, d.otroConcepto, d.notes].join(" ")
  }));

  // Servicios ofrecidos
  (state.services || []).forEach(s => items.push({
    type: "service", nav: "settings", icon: "settings", iconBg: "#f8fafc",
    label: s, sub: "Servicio ofrecido",
    _s: s
  }));

  return items;
}

function cpHighlight(text, query) {
  if (!query) return escapeHtml(text);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(text);
  return escapeHtml(text.slice(0, idx)) +
    `<span class="cp-hl">${escapeHtml(text.slice(idx, idx + query.length))}</span>` +
    escapeHtml(text.slice(idx + query.length));
}

function renderCPItems(items, query) {
  if (!items.length) return `<div class="cp-empty">Sin resultados para "<strong>${escapeHtml(query)}</strong>"</div>`;
  const groups = {};
  items.forEach(it => {
    const g = it.type === "action"       ? "Acciones rápidas"
            : it.type === "module"       ? "Módulos"
            : it.type === "client"       ? "Clientes"
            : it.type === "quote"        ? "Cotizaciones"
            : it.type === "sale"         ? "Ventas"
            : it.type === "lead"         ? "Leads"
            : it.type === "collection"   ? "Cobranzas"
            : it.type === "expense"      ? "Gastos"
            : it.type === "team"         ? "Pago personal"
            : it.type === "taxpayment"   ? "SUNAT"
            : it.type === "purchase"     ? "Compras"
            : it.type === "invoicedsale" ? "Ventas facturadas"
            : it.type === "cashentry"    ? "Caja financiera"
            : it.type === "declaracion"  ? "Declaraciones"
            : it.type === "service"      ? "Servicios" : "Resultados";
    if (!groups[g]) groups[g] = [];
    groups[g].push(it);
  });
  let html = ""; let gi = 0;
  Object.entries(groups).forEach(([label, its]) => {
    html += `<div class="cp-section">${label}</div>`;
    its.forEach(it => {
      const idx = gi++;
      const iconEl = `<div class="cp-item-icon" style="background:${it.iconBg}">${icon(it.icon)}</div>`;
      const badgeEl = it.badge ? `<span class="cp-item-badge" style="background:${it.iconBg};color:var(--muted)">${escapeHtml(it.badge)}</span>` : "";
      html += `<div class="cp-item${idx === cpSelectedIdx ? " cp-active" : ""}" data-cp-idx="${idx}">
        ${iconEl}
        <div class="cp-item-body">
          <div class="cp-item-title">${cpHighlight(it.label, query)}</div>
          ${it.sub ? `<div class="cp-item-sub">${escapeHtml(it.sub)}</div>` : ""}
        </div>
        ${badgeEl}
        <span class="cp-enter-hint">↵</span>
      </div>`;
    });
  });
  return html;
}

function filterCP(query) {
  if (!query.trim()) {
    cpCurrentItems = [...CP_ACTIONS, ...CP_MODULES];
  } else {
    const q = query.toLowerCase();
    cpCurrentItems = [...CP_ACTIONS, ...CP_MODULES, ...buildCPIndex()]
      .filter(it => (it._s || it.label + " " + (it.sub || "")).toLowerCase().includes(q))
      .slice(0, 25);
  }
  cpSelectedIdx = 0;
  document.getElementById("cpResults").innerHTML = renderCPItems(cpCurrentItems, query);
  bindCPClicks();
}

function bindCPClicks() {
  document.querySelectorAll(".cp-item").forEach(el => {
    el.addEventListener("click", () => executeCPItem(cpCurrentItems[parseInt(el.dataset.cpIdx, 10)]));
    el.addEventListener("mouseenter", () => {
      cpSelectedIdx = parseInt(el.dataset.cpIdx, 10);
      document.querySelectorAll(".cp-item").forEach((e, i) => e.classList.toggle("cp-active", i === cpSelectedIdx));
    });
  });
}

function executeCPItem(item) {
  if (!item) return;
  closeCommandPalette();
  if (item.action) {
    const actionMap = {
      "new-quote":  () => { activeView = "quotes";   render(); setTimeout(openQuoteDialog,  60); },
      "new-lead":   () => { activeView = "quotes";   render(); setTimeout(openLeadDialog,   60); },
      "new-client": () => { activeView = "clients";  render(); setTimeout(openClientDialog, 60); },
      "new-sale":   () => { activeView = "sales";    render(); setTimeout(openSaleDialog,   60); },
      "new-team":   () => { activeView = "team";     render(); setTimeout(openTeamDialog,   60); },
    };
    (actionMap[item.action] || (() => {}))();
  } else if (item.nav) {
    activeView = item.nav;
    showContentLoader();
    render();
    hideContentLoader(50);
  }
}

function openCommandPalette() {
  const pal = document.getElementById("commandPalette");
  const inp = document.getElementById("cpInput");
  if (!pal || !inp) return;
  pal.classList.remove("hidden");
  inp.value = "";
  filterCP("");
  setTimeout(() => inp.focus(), 30);
}

function closeCommandPalette() {
  document.getElementById("commandPalette")?.classList.add("hidden");
}

function initCommandPalette() {
  document.getElementById("topbarSearchBtn")?.addEventListener("click", openCommandPalette);
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      const pal = document.getElementById("commandPalette");
      if (!pal) return;
      pal.classList.contains("hidden") ? openCommandPalette() : closeCommandPalette();
      return;
    }
    const pal = document.getElementById("commandPalette");
    if (!pal || pal.classList.contains("hidden")) return;
    if (e.key === "Escape") { closeCommandPalette(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      cpSelectedIdx = Math.min(cpSelectedIdx + 1, cpCurrentItems.length - 1);
      document.querySelectorAll(".cp-item").forEach((el, i) => el.classList.toggle("cp-active", i === cpSelectedIdx));
      document.querySelector(".cp-item.cp-active")?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cpSelectedIdx = Math.max(cpSelectedIdx - 1, 0);
      document.querySelectorAll(".cp-item").forEach((el, i) => el.classList.toggle("cp-active", i === cpSelectedIdx));
      document.querySelector(".cp-item.cp-active")?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeCPItem(cpCurrentItems[cpSelectedIdx]);
    }
  });
  document.getElementById("cpInput")?.addEventListener("input", e => filterCP(e.target.value));
  document.getElementById("commandPalette")?.addEventListener("click", e => {
    if (e.target === document.getElementById("commandPalette")) closeCommandPalette();
  });
}

// ════════════════════════════════════════════════════════════
// ONBOARDING WIZARD
// ════════════════════════════════════════════════════════════
const ONBOARDING_KEY = "nebumia-onboarding-v1";

function getOnboarding() {
  try { return JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{"done":false}'); }
  catch { return { done: false }; }
}
function saveOnboarding(data) { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(data)); }

function onboardingHasData() {
  return state.clients.length > 0 || state.quotes.length > 0 || state.leads.length > 0;
}

function onboardingBannerHTML() {
  if (getOnboarding().done || onboardingHasData()) return "";
  const hasGoal    = (state.settings.monthlyGoal || 0) > 0;
  const hasService = (state.services || []).length > 0;
  const hasLead    = state.leads.length > 0;
  const steps = [
    { label: "Meta mensual", done: hasGoal },
    { label: "Servicios",    done: hasService },
    { label: "Primer lead",  done: hasLead },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const pct = Math.round(doneCount / 3 * 100);
  const stepsHtml = steps.map(s =>
    `<span class="onb-banner-step ${s.done ? "done" : "active"}">${s.done ? "✓ " : ""}${escapeHtml(s.label)}</span>`
  ).join("");
  return `<div class="onb-banner">
    <div class="onb-banner-left">
      <h4>Completa tu configuración</h4>
      <p>${doneCount} de 3 pasos completados</p>
      <div class="onb-banner-steps">${stepsHtml}</div>
    </div>
    <div class="onb-banner-right">
      <div class="onb-banner-pct">${pct}%</div>
      <div class="onb-banner-label">progreso</div>
      <button class="onb-continue-btn" onclick="openOnboardingWizard()">Continuar →</button>
    </div>
  </div>`;
}

function renderOnbStep(step) {
  const content = document.getElementById("onbWizardContent");
  if (!content) return;
  const trackHtml = [0, 1, 2].map(i => {
    const cls = i < step ? "done" : i === step ? "active" : "todo";
    const dot = `<div class="onb-step-dot ${cls}">${cls === "done" ? "✓" : i + 1}</div>`;
    return i === 0 ? dot : `<div class="onb-step-line ${i <= step ? "done" : "todo"}"></div>${dot}`;
  }).join("");

  let bodyHtml = "";
  if (step === 0) {
    const cur = state.settings.monthlyGoal || "";
    bodyHtml = `
      <div class="onb-step-title">¿Cuánto quieres vender este mes?</div>
      <div class="onb-step-desc">Define tu objetivo mensual. Aparecerá en el KPI de Meta en tu dashboard.</div>
      <div style="position:relative">
        <input id="onbGoalInput" class="onb-input" type="number" min="0" step="100"
          placeholder="Ej: 8000" value="${cur}" style="padding-right:38px" autofocus>
        <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--muted);pointer-events:none">S/</span>
      </div>
      <div class="onb-prefix" style="margin-top:10px;font-size:11px;color:var(--muted)">Puedes cambiarlo en Configuración → Reglas financieras.</div>`;
  } else if (step === 1) {
    const tags = (state.services || []).map(s =>
      `<span class="onb-tag">${escapeHtml(s)}<button onclick="onbRemoveService('${escapeAttr(s)}')" type="button">×</button></span>`
    ).join("");
    bodyHtml = `
      <div class="onb-step-title">¿Qué servicios ofrece tu agencia?</div>
      <div class="onb-step-desc">Aparecerán al crear cotizaciones. Puedes agregar más desde Configuración.</div>
      <div class="onb-input-row">
        <input id="onbServiceInput" class="onb-input" type="text" placeholder="Ej: Meta Ads, CRM, Diseño Web…">
        <button class="onb-next-btn" onclick="onbAddService()" type="button" style="padding:9px 14px;flex-shrink:0">+ Agregar</button>
      </div>
      <div class="onb-tags" id="onbTagsContainer">${tags}</div>`;
  } else {
    bodyHtml = `
      <div style="text-align:center;padding:12px 0 18px">
        <div style="font-size:44px;margin-bottom:12px">🎉</div>
        <div class="onb-step-title" style="font-size:16px">¡Todo listo para empezar!</div>
        <div class="onb-step-desc">Ahora crea tu primer lead para ver el embudo comercial en acción.</div>
      </div>`;
  }

  const nextLabel = step < 2 ? "Siguiente →" : "Ir al dashboard";
  const extraBtn  = step === 2
    ? `<button class="onb-next-btn" style="background:#059669;margin-right:8px" onclick="onbCreateLead()" type="button">Crear primer lead</button>`
    : "";

  content.innerHTML = `
    <div class="onb-head">
      <div class="onb-head-label">Configuración inicial · Paso ${step + 1} de 3</div>
      <div class="onb-head-title">Nebumia</div>
      <div class="onb-steps-track">${trackHtml}</div>
    </div>
    <div class="onb-body">${bodyHtml}</div>
    <div class="onb-footer">
      <button class="onb-skip-btn" onclick="onbSkip()" type="button">Omitir configuración</button>
      <div>${extraBtn}<button class="onb-next-btn" onclick="onbNext(${step})" type="button">${nextLabel}</button></div>
    </div>`;

  setTimeout(() => content.querySelector("input:not([type=hidden])")?.focus(), 50);
}

function openOnboardingWizard() {
  let step = 0;
  if ((state.settings.monthlyGoal || 0) > 0)                                           step = 1;
  if ((state.settings.monthlyGoal || 0) > 0 && (state.services || []).length > 0)       step = 2;
  document.getElementById("onboardingWizard").classList.remove("hidden");
  renderOnbStep(step);
}

function onbNext(step) {
  if (step === 0) {
    const val = parseFloat(document.getElementById("onbGoalInput")?.value);
    if (val > 0) { state.settings.monthlyGoal = val; saveState(); }
    renderOnbStep(1);
  } else if (step === 1) {
    renderOnbStep(2);
  } else {
    onbSkip();
  }
}

function onbAddService() {
  const inp = document.getElementById("onbServiceInput");
  const val = (inp?.value || "").trim();
  if (!val) return;
  if (!(state.services || []).includes(val)) {
    state.services = [...(state.services || []), val].sort();
    saveState();
  }
  inp.value = "";
  const c = document.getElementById("onbTagsContainer");
  if (c) c.innerHTML = (state.services || []).map(s =>
    `<span class="onb-tag">${escapeHtml(s)}<button onclick="onbRemoveService('${escapeAttr(s)}')" type="button">×</button></span>`
  ).join("");
  inp.focus();
}

function onbRemoveService(name) {
  state.services = (state.services || []).filter(s => s !== name);
  saveState();
  const c = document.getElementById("onbTagsContainer");
  if (c) c.innerHTML = (state.services || []).map(s =>
    `<span class="onb-tag">${escapeHtml(s)}<button onclick="onbRemoveService('${escapeAttr(s)}')" type="button">×</button></span>`
  ).join("");
}

function onbSkip() {
  saveOnboarding({ done: true });
  document.getElementById("onboardingWizard").classList.add("hidden");
  render();
}

function onbCreateLead() {
  saveOnboarding({ done: true });
  document.getElementById("onboardingWizard").classList.add("hidden");
  activeView = "quotes";
  render();
  setTimeout(openLeadDialog, 60);
}

function initOnboarding() {
  if (getOnboarding().done || onboardingHasData()) return;
  openOnboardingWizard();
}

applyTheme(localStorage.getItem(THEME_KEY) || "light");
setAuthMode("login");
syncProfileUI();
setupDialogs();
initConfirmDialog();
refreshNotifBadge();
initCommandPalette();
document.getElementById("sidebarCollapseBtn")?.addEventListener("click", toggleSidebar);
applySidebarState();

// Mobile gate (phones only — tablets get responsive layout)
function isMobileDevice() {
  return window.innerWidth < 640;
}
function showMobileGate() {
  document.getElementById("mobileGate")?.classList.remove("hidden");
  appShell.classList.add("hidden");
}
document.getElementById("mobileGateLogout")?.addEventListener("click", async () => {
  await sb.auth.signOut();
  document.getElementById("mobileGate")?.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});

// Tablet/mobile sidebar drawer
function closeSidebarDrawer() {
  appShell.classList.remove("sidebar-open");
}
function updateMobileMenuBtn() {
  const btn = document.getElementById("mobileMenuBtn");
  if (!btn) return;
  const isMobile = window.innerWidth <= 768;
  btn.style.display = isMobile ? "flex" : "none";
  if (!isMobile) closeSidebarDrawer();
}
updateMobileMenuBtn();
window.addEventListener("resize", updateMobileMenuBtn);
document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
  appShell.classList.toggle("sidebar-open");
});
document.getElementById("sidebarOverlay")?.addEventListener("click", closeSidebarDrawer);
document.getElementById("mainNav")?.addEventListener("click", e => {
  if (e.target.closest(".nav-btn") && window.innerWidth <= 768) closeSidebarDrawer();
});

// Inicialización con Supabase Auth
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    const { data: { user: freshUser } } = await sb.auth.getUser();
    sbUser = freshUser || session.user;
    syncFromSupabaseMeta(sbUser);
    loginScreen.classList.add("hidden");
    if (isMobileDevice()) { showMobileGate(); } else { showSkeleton(activeView); appShell.classList.remove("hidden"); }
    await sbLoad();
    render();
    hideSkeleton(2000);
    setTimeout(initOnboarding, 400);
  } else {
    hideSkeleton(0);
  }
})();
