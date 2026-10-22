// Skeleton de carga de Guvia. Se arma con las MISMAS clases de layout que la app real
// (.app-shell, .sidebar, .topbar, .metric-grid, .dash-kpi-grid, .panel…), así su tamaño sigue
// al diseño real. Respeta: menú colapsado/expandido, tema (claro/oscuro) y la página que se abrirá.
(function () {
  var SIDEBAR_KEY = "nebumia-sidebar-collapsed";
  var VIEW_KEY = "nebumia-active-view";
  var SLUG_TO_VIEW = {
    dashboard: "dashboard", clientes: "clients", cotizaciones: "quotes", ventas: "sales",
    cobranzas: "collections", "caja-financiera": "finance", contabilidad: "comprobantes",
    "pago-personal": "team", configuracion: "settings"
  };

  function b(w, h, extra) {
    return '<div class="skx-b" style="width:' + w + ';height:' + h + 'px;' + (extra || "") + '"></div>';
  }
  function rep(n, fn) { var o = ""; for (var i = 0; i < n; i++) o += fn(i); return o; }

  function currentView() {
    var slug = (location.hash || "").replace(/^#\/?/, "").split("/")[0];
    if (SLUG_TO_VIEW[slug]) return SLUG_TO_VIEW[slug];
    var saved = null;
    try { saved = localStorage.getItem(VIEW_KEY); } catch (e) {}
    return saved || "dashboard";
  }

  function sidebar(collapsed) {
    var item = function (w) {
      return '<div class="nav-btn skx-nav">' + b("18px", 18, "border-radius:5px;flex-shrink:0") +
        (collapsed ? "" : b(w, 12)) + "</div>";
    };
    var widths = ["70px", "60px", "85px", "78px", "52px", "108px", "92px", "100px"];
    return '<aside class="sidebar skx-sidebar">' +
      '<div class="sidebar-brand skx-brand">' +
        (collapsed ? b("30px", 30, "border-radius:9px") : b("34px", 30, "border-radius:9px") + b("78px", 16)) +
      "</div>" +
      '<nav class="main-nav">' + widths.map(item).join("") + "</nav>" +
      '<div class="sidebar-settings">' + item("96px") + "</div>" +
    "</aside>";
  }

  function topbar() {
    return '<header class="topbar skx-topbar">' +
      '<div class="skx-search">' + b("15px", 15, "border-radius:50%") + b("55%", 12) + "</div>" +
      '<div class="topbar-actions skx-actions">' +
        b("38px", 38, "border-radius:50%") +
        '<div class="skx-profile-copy">' + b("96px", 12) + b("52px", 9) + "</div>" +
        b("36px", 36, "border-radius:50%") +
      "</div></header>";
  }

  function dateCtl() { return b("132px", 40, "border-radius:10px"); }
  function titleRow(w) {
    return '<div class="skx-head">' + b(w || "180px", 30, "border-radius:8px") + dateCtl() + "</div>";
  }

  function metricCard() {
    return '<article class="metric skx-card">' +
      '<div class="skx-icon-row">' + b("30px", 30, "border-radius:9px") + b("96px", 12) + "</div>" +
      b("58%", 30, "margin-top:8px;border-radius:8px") +
      '<div class="metric-bottom skx-bottom">' + b("86px", 12) + b("84px", 64, "border-radius:6px;margin-left:auto") + "</div>" +
    "</article>";
  }
  function metricGrid() { return '<section class="metric-grid">' + rep(4, metricCard) + "</section>"; }

  function kpiCard() {
    return '<div class="kpi-card skx-card">' +
      '<div class="skx-icon-row">' + b("30px", 30, "border-radius:9px") + b("84px", 12) + "</div>" +
      b("62%", 28, "margin-top:8px;border-radius:8px") +
      b("45%", 16, "margin-top:8px;border-radius:99px") +
      '<div class="kpi-bottom-row skx-bottom">' + b("70px", 12) + b("84px", 64, "border-radius:6px;margin-left:auto") + "</div>" +
    "</div>";
  }

  function toolbar(withActions) {
    return '<div class="module-controls module-controls-inline skx-toolbar"><div class="module-controls-left">' +
      b("330px", 40, "border-radius:10px;max-width:100%") + b("40px", 40, "border-radius:10px") + b("40px", 40, "border-radius:10px") +
      '</div><div class="module-controls-right">' +
      (withActions ? b("110px", 40, "border-radius:9px") + b("110px", 40, "border-radius:9px") + b("150px", 40, "border-radius:9px") : "") +
      "</div></div>";
  }

  function table(rows) {
    return '<div class="table-wrap skx-table"><div class="skx-th">' +
      rep(7, function (i) { return b(["60px", "80px", "120px", "100px", "70px", "90px", "70px"][i], 11); }) + "</div>" +
      rep(rows, function () {
        return '<div class="skx-tr">' + rep(7, function (i) { return b(["50px", "70px", "130px", "100px", "64px", "80px", "56px"][i], 12); }) + "</div>";
      }) +
    '</div><div class="skx-pag">' + b("70px", 14) + b("220px", 32, "border-radius:8px;margin-left:auto") + "</div>";
  }

  function panel(minH, body) {
    return '<div class="panel skx-panel" style="min-height:' + minH + 'px">' +
      '<div class="skx-icon-row" style="margin-bottom:14px">' + b("34px", 34, "border-radius:10px") +
      '<div style="display:grid;gap:6px">' + b("130px", 14) + b("90px", 10) + "</div></div>" + (body || "") + "</div>";
  }

  function dashboard() {
    return '<div class="skx-head">' + b("160px", 30, "border-radius:8px") + "</div>" +
      '<div class="skx-filterzone">' +
        '<div class="skx-chips">' + b("96px", 14) + b("118px", 38, "border-radius:9px") + b("112px", 38, "border-radius:9px") + "</div>" +
        '<div class="skx-datectl">' + dateCtl() + "</div>" +
      "</div>" +
      '<div class="dash-kpi-grid">' + rep(5, kpiCard) + "</div>" +
      '<div class="dash-kpi-grid">' + rep(5, kpiCard) + "</div>" +
      '<div class="dash-main-grid">' + panel(392, b("100%", 260, "border-radius:10px")) + panel(392, b("100%", 260, "border-radius:10px")) + "</div>" +
      '<div class="dash-mid-grid">' + rep(3, function () { return panel(280, rep(3, function () { return b("100%", 38, "border-radius:8px;margin-bottom:10px"); })); }) + "</div>" +
      '<div class="dash-bottom-grid">' + panel(220) + panel(220) + "</div>" +
      panel(360, rep(4, function () { return b("100%", 30, "border-radius:6px;margin-bottom:8px"); }));
  }

  function listPage(withMetrics, withActions, rows) {
    return (withMetrics ? metricGrid() : "") + titleRow() + toolbar(withActions) + table(rows || 6);
  }

  function finance() {
    return metricGrid() + titleRow("200px") +
      '<div class="skx-tabs">' + rep(4, function () { return b("150px", 34, "border-radius:9px"); }) + "</div>" +
      toolbar(true) + table(4) + table(3);
  }

  function comprobantes() {
    return metricGrid() + titleRow("170px") + toolbar(true) +
      '<div class="panel skx-panel" style="min-height:300px">' + rep(5, function () { return b("100%", 34, "border-radius:6px;margin-bottom:10px"); }) + "</div>" +
      table(4);
  }

  function settings() {
    return titleRow("190px") +
      '<div class="skx-settings"><div class="skx-sidenav">' + rep(7, function () { return b("100%", 38, "border-radius:9px"); }) + "</div>" +
      '<div class="panel skx-panel" style="min-height:420px">' + rep(6, function () { return b("100%", 42, "border-radius:8px;margin-bottom:12px"); }) + "</div></div>";
  }

  function content(view) {
    switch (view) {
      case "dashboard": return dashboard();
      case "quotes": return listPage(true, true, 6);
      case "sales": return listPage(true, true, 6);
      case "collections": return listPage(true, true, 6);
      case "clients": return listPage(true, true, 7);
      case "team": return listPage(true, true, 6);
      case "finance": return finance();
      case "comprobantes": return comprobantes();
      case "settings": return settings();
      default: return dashboard();
    }
  }

  window.skHtml = function (view) {
    var collapsed = false;
    try { collapsed = localStorage.getItem(SIDEBAR_KEY) === "1"; } catch (e) {}
    view = view || currentView();
    return '<div class="app-shell skx-shell' + (collapsed ? " skx-collapsed" : "") + '">' +
      sidebar(collapsed) +
      '<section class="workspace">' + topbar() + '<div class="skx-view">' + content(view) + "</div></section>" +
    "</div>";
  };

  var el = document.getElementById("preloader");
  if (el && !el.firstChild) el.innerHTML = window.skHtml();
})();
