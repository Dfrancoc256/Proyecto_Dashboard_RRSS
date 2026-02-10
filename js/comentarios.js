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

/* =============================
   ✅ helpers % + tooltip
============================= */
function toPercentWithCounts(datasetCounts) {
  const labels = Object.keys(datasetCounts || {});
  const counts = labels.map(k => Number(datasetCounts[k]) || 0);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const percents = counts.map(v => +((v / total) * 100).toFixed(1));
  return { labels, counts, percents, total };
}

function fmtPercent(p) {
  const n = Number(p) || 0;
  if (n === 0) return "0%";
  if (n < 1) return "<1%";
  return `${n}%`;
}

/* =============================
   ✅ Plugin % con contorno blanco (por si charts.js no se carga aquí)
============================= */
const percentLabelsPlugin = {
  id: "percentLabelsPlugin",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx } = chart;
    const opts = pluginOptions || {};

    const fontSize = opts.fontSize || 12;
    const fontFamily = opts.fontFamily || "Poppins, sans-serif";

    const outsideThreshold =
      typeof opts.outsideThreshold === "number" ? opts.outsideThreshold : 4;
    const outsideOffset =
      typeof opts.outsideOffset === "number" ? opts.outsideOffset : 20;

    const minArcPx =
      typeof opts.minArcPx === "number" ? opts.minArcPx : 26;

    const strokeWidth =
      typeof opts.strokeWidth === "number" ? opts.strokeWidth : 4;
    const strokeColor = opts.strokeColor || "#ffffff";
    const fillColor = opts.fillColor || "#111827";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      const type = chart.config.type;
      const isPie = type === "pie" || type === "doughnut";
      const isBar = type === "bar";
      if (!isPie && !isBar) return;

      ctx.save();
      ctx.font = `700 ${fontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      meta.data.forEach((element, index) => {
        const val = Number(dataset.data?.[index]) || 0;
        if (val <= 0) return;

        const text = fmtPercent(val);

        if (isPie) {
          const props = element.getProps(
            ["x", "y", "startAngle", "endAngle", "outerRadius", "innerRadius"],
            true
          );
          const { x, y, startAngle, endAngle, outerRadius, innerRadius } = props;
          const mid = (startAngle + endAngle) / 2;

          const arcLen = Math.abs(endAngle - startAngle) * outerRadius;
          const rInside = innerRadius + (outerRadius - innerRadius) * 0.55;

          const useOutside = val < outsideThreshold || arcLen < minArcPx;

          const r = useOutside ? outerRadius + outsideOffset : rInside;

          let tx = x + Math.cos(mid) * r;
          let ty = y + Math.sin(mid) * r;

          if (useOutside) {
            const lx1 = x + Math.cos(mid) * (outerRadius - 2);
            const ly1 = y + Math.sin(mid) * (outerRadius - 2);
            const lx2 = x + Math.cos(mid) * (outerRadius + outsideOffset - 8);
            const ly2 = y + Math.sin(mid) * (outerRadius + outsideOffset - 8);

            ctx.save();
            ctx.strokeStyle = "rgba(17,24,39,0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lx1, ly1);
            ctx.lineTo(lx2, ly2);
            ctx.stroke();
            ctx.restore();

            const side = Math.cos(mid) >= 0 ? 1 : -1;
            tx += side * 10;
            ctx.textAlign = side === 1 ? "left" : "right";
          } else {
            ctx.textAlign = "center";
          }

          ctx.save();
          ctx.lineWidth = strokeWidth;
          ctx.strokeStyle = strokeColor;
          ctx.strokeText(text, tx, ty);
          ctx.fillStyle = fillColor;
          ctx.fillText(text, tx, ty);
          ctx.restore();
        }

        if (isBar) {
          const pos = element.tooltipPosition?.();
          if (!pos) return;

          const tx = pos.x;
          const ty = pos.y - 14;

          ctx.save();
          ctx.textAlign = "center";
          ctx.lineWidth = strokeWidth;
          ctx.strokeStyle = strokeColor;
          ctx.strokeText(text, tx, ty);
          ctx.fillStyle = fillColor;
          ctx.fillText(text, tx, ty);
          ctx.restore();
        }
      });

      ctx.restore();
    });
  },
};

try {
  const exists = Chart?.registry?.plugins?.get?.("percentLabelsPlugin");
  if (!exists) Chart.register(percentLabelsPlugin);
} catch {
  try { Chart.register(percentLabelsPlugin); } catch {}
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
  const pack = toPercentWithCounts(conteo);

  if (chartCanal) chartCanal.destroy();

  chartCanal = new Chart(ctx, {
    type: "pie",
    data: {
      labels: pack.labels,
      datasets: [{
        data: pack.percents,   // ✅ visible: %
        _counts: pack.counts,  // tooltip: counts
        backgroundColor: ["#2F66F5", "#54C0F2", "#10B981", "#F9B233", "#A3A3A3", "#4F46E5", "#111827"],
        borderColor: "#fff",
        borderWidth: 2
      }]
    },
    options: {
      plugins: {
        legend: { position: "right" },
        tooltip: {
          callbacks: {
            label: (context) => {
              const idx = context.dataIndex;
              const n = context.dataset._counts?.[idx] ?? 0;
              const p = context.raw;
              return `${context.label}: ${n} (${fmtPercent(p)})`;
            }
          }
        },
        percentLabelsPlugin: {
          outsideThreshold: 4,
          outsideOffset: 22,
          minArcPx: 26,
          fontSize: 12,
          strokeColor: "#ffffff",
          strokeWidth: 4,
          fillColor: "#111827",
        }
      }
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

  // poblar selects con data 
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
