// js/comentarios.js
let dataAll = [];
let dataFiltered = [];
let chartCanal = null;

const norm = (v) => String(v ?? "").trim().toLowerCase();

function obtenerFecha(valor) {
  if (!valor) return null;
  const s = String(valor).trim();

  const isoTry = new Date(s);
  if (!isNaN(isoTry)) return isoTry;

  // dd/mm/yyyy hh:mm:ss
  const parts = s.split(" ");
  const fecha = parts[0];
  const hora = parts[1] || "00:00:00";

  const [a, b, c] = fecha.split("/").map(n => parseInt(n, 10));
  if (!a || !b || !c) return null;

  const dd = a, mm = b - 1, yyyy = c;
  const [hh, mi, ss] = hora.split(":").map(n => parseInt(n, 10) || 0);

  const d = new Date(yyyy, mm, dd, hh, mi, ss);
  return isNaN(d) ? null : d;
}

function inicioDia(yyyy_mm_dd) { return new Date(yyyy_mm_dd + "T00:00:00"); }
function finDia(yyyy_mm_dd) { return new Date(yyyy_mm_dd + "T23:59:59.999"); }

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function setOptions(selectId, values) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const current = sel.value || "todos";
  sel.innerHTML = `<option value="todos">Todos</option>`;

  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });

  if (values.includes(current)) sel.value = current;
}

function contarPorCampo(data, key) {
  const m = {};
  data.forEach(r => {
    const v = String(r[key] ?? "Sin dato").trim() || "Sin dato";
    m[v] = (m[v] || 0) + 1;
  });
  return m;
}

function topKey(conteo) {
  let bestK = "—", bestV = -1;
  Object.entries(conteo).forEach(([k, v]) => {
    if (v > bestV) { bestV = v; bestK = k; }
  });
  return bestK;
}

function porcentajePositivos(data) {
  const getSent = (row) => row.sentimientos ?? row.sentimiento ?? "";
  const total = data.length;
  if (!total) return 0;
  const pos = data.filter(d => norm(getSent(d)) === "positivo").length;
  return (pos / total) * 100;
}

/* ========= tablas ========= */
function renderTablaRazones(data) {
  const tb = document.querySelector("#anaTablaRazones tbody");
  if (!tb) return;

  const conteo = contarPorCampo(data, "razon");
  const items = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 20);

  tb.innerHTML = items.length ? items.map(([k, v]) => `
    <tr>
      <td>${escapeHtml(k)}</td>
      <td class="ana-right">${v}</td>
    </tr>
  `).join("") : `<tr><td colspan="2" class="ana-muted">Sin datos</td></tr>`;
}

function renderTablaRazonCanal(data) {
  const tb = document.querySelector("#anaTablaRazonCanal tbody");
  if (!tb) return;

  const map = {};
  data.forEach(r => {
    const canal = String(r.medio ?? "Sin dato").trim() || "Sin dato";
    const razon = String(r.razon ?? "Sin dato").trim() || "Sin dato";
    const key = canal + "||" + razon;
    map[key] = (map[key] || 0) + 1;
  });

  const items = Object.entries(map)
    .map(([k, v]) => {
      const [canal, razon] = k.split("||");
      return { canal, razon, v };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 40);

  tb.innerHTML = items.length ? items.map(x => `
    <tr>
      <td>${escapeHtml(x.canal)}</td>
      <td>${escapeHtml(x.razon)}</td>
      <td class="ana-right">${x.v}</td>
    </tr>
  `).join("") : `<tr><td colspan="3" class="ana-muted">Sin datos</td></tr>`;
}

/* ========= detalle con paginación ========= */
let page = 1;

function getPageSize() {
  const sel = document.getElementById("anaPageSize");
  return parseInt(sel?.value || "30", 10);
}

function renderDetalle(data) {
  const tb = document.querySelector("#anaTablaDetalle tbody");
  if (!tb) return;

  const size = getPageSize();
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / size));
  if (page > pages) page = pages;

  const start = (page - 1) * size;
  const slice = data.slice(start, start + size);

  tb.innerHTML = slice.length ? slice.map(r => `
    <tr>
      <td>${escapeHtml(String(r.time ?? ""))}</td>
      <td>${escapeHtml(String(r.email ?? ""))}</td>
      <td>${escapeHtml(String(r.pais ?? ""))}</td>
      <td>${escapeHtml(String(r.medio ?? ""))}</td>
      <td>${escapeHtml(String(r.razon ?? ""))}</td>
      <td>${escapeHtml(String(r.comentario_cliente ?? ""))}</td>
      <td>${escapeHtml(String(r.notas ?? ""))}</td>
    </tr>
  `).join("") : `<tr><td colspan="7" class="ana-muted">Sin datos</td></tr>`;

  const info = document.getElementById("anaPageInfo");
  if (info) info.textContent = `Página ${page} de ${pages} (Total: ${total})`;

  const prev = document.getElementById("anaPrev");
  const next = document.getElementById("anaNext");
  if (prev) prev.disabled = page <= 1;
  if (next) next.disabled = page >= pages;
}

/* ========= chart ========= */
function renderChartCanal(data) {
  const ctx = document.getElementById("anaChartCanal");
  if (!ctx) return;

  const conteo = contarPorCampo(data, "medio");
  const labels = Object.keys(conteo);
  const values = Object.values(conteo);

  if (chartCanal) chartCanal.destroy();

  chartCanal = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ["#2F66F5", "#54C0F2", "#10B981", "#F9B233", "#A3A3A3", "#4F46E5", "#111827"],
        borderColor: "#fff",
        borderWidth: 2
      }]
    },
    options: {
      plugins: { legend: { position: "right" } }
    }
  });
}

/* ========= KPIs ========= */
function renderKPIs(data) {
  const total = data.length;
  const pctPos = porcentajePositivos(data);

  const paisCount = contarPorCampo(data, "pais");
  const canalCount = contarPorCampo(data, "medio");

  const elTotal = document.getElementById("anaTotal");
  const elPct = document.getElementById("anaPctPos");
  const elTopPais = document.getElementById("anaTopPais");
  const elTopCanal = document.getElementById("anaTopCanal");

  if (elTotal) elTotal.textContent = total;
  if (elPct) elPct.textContent = total ? pctPos.toFixed(1) + "%" : "0%";
  if (elTopPais) elTopPais.textContent = total ? topKey(paisCount) : "—";
  if (elTopCanal) elTopCanal.textContent = total ? topKey(canalCount) : "—";
}

function renderAll(data) {
  renderKPIs(data);
  renderChartCanal(data);
  renderTablaRazones(data);
  renderTablaRazonCanal(data);

  // orden por fecha desc
  const sorted = [...data].sort((a, b) => {
    const da = obtenerFecha(a.time);
    const db = obtenerFecha(b.time);
    return (db?.getTime?.() || 0) - (da?.getTime?.() || 0);
  });

  renderDetalle(sorted);
}

/* ========= aplicar filtros ========= */
function applyFilters() {
  const desde = document.getElementById("anaDesde")?.value || "";
  const hasta = document.getElementById("anaHasta")?.value || "";
  const pais = norm(document.getElementById("anaPais")?.value || "todos");
  const canal = norm(document.getElementById("anaCanal")?.value || "todos");
  const usuario = norm(document.getElementById("anaUsuario")?.value || "todos");
  const q = norm(document.getElementById("anaBuscar")?.value || "");

  const dDesde = desde ? inicioDia(desde) : null;
  const dHasta = hasta ? finDia(hasta) : null;

  dataFiltered = dataAll.filter(r => {
    const d = obtenerFecha(r.time);

    if ((dDesde || dHasta) && !d) return false;
    if (dDesde && d < dDesde) return false;
    if (dHasta && d > dHasta) return false;

    if (pais !== "todos" && norm(r.pais) !== pais) return false;
    if (canal !== "todos" && norm(r.medio) !== canal) return false;
    if (usuario !== "todos" && norm(r.email) !== usuario) return false;

    if (q) {
      const blob = norm(`${r.comentario_cliente || ""} ${r.notas || ""}`);
      if (!blob.includes(q)) return false;
    }

    return true;
  });

  page = 1;
  renderAll(dataFiltered);
}

/* ========= INIT ========= */
export async function initComentarios() {
  const res = await obtenerDatosDashboard();
  const lista = res?.data?.data ?? res?.data ?? [];
  dataAll = Array.isArray(lista) ? lista : [];

  // poblar selects con data real
  setOptions("anaPais", uniqueSorted(dataAll.map(x => String(x.pais || "").trim()).filter(Boolean)));
  setOptions("anaCanal", uniqueSorted(dataAll.map(x => String(x.medio || "").trim()).filter(Boolean)));
  setOptions("anaUsuario", uniqueSorted(dataAll.map(x => String(x.email || "").trim().toLowerCase()).filter(Boolean)));

  // listeners (sin duplicar)
  const btn = document.getElementById("anaAplicar");
  if (btn) btn.onclick = applyFilters;

  const prev = document.getElementById("anaPrev");
  const next = document.getElementById("anaNext");
  const pageSize = document.getElementById("anaPageSize");

  if (prev) prev.onclick = () => {
    if (page > 1) {
      page--;
      renderDetalle((dataFiltered.length ? dataFiltered : dataAll));
    }
  };

  if (next) next.onclick = () => {
    const size = getPageSize();
    const total = (dataFiltered.length ? dataFiltered : dataAll).length;
    const pages = Math.max(1, Math.ceil(total / size));
    if (page < pages) {
      page++;
      renderDetalle((dataFiltered.length ? dataFiltered : dataAll));
    }
  };

  if (pageSize) pageSize.onchange = () => {
    page = 1;
    renderDetalle((dataFiltered.length ? dataFiltered : dataAll));
  };

  // primer render
  dataFiltered = dataAll;
  renderAll(dataAll);
}

/* ========= seguridad html ========= */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
