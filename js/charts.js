/* js/charts.js */
let datosGlobales = [];
let charts = [];

const normalizarTexto = (valor) => String(valor ?? "").trim().toLowerCase();
const obtenerSentimiento = (row) => row.sentimiento ?? row.sentimientos ?? "";

/* =============================
   ✅ STATUS BAR (arriba)
============================= */
function mostrarEstado(mensaje, tipo = "ok") {
  const bar = document.getElementById("statusBar");
  const txt = document.getElementById("statusText");
  if (!bar || !txt) return;

  txt.textContent = mensaje;
  bar.classList.remove("ok", "info", "error");
  bar.classList.add(tipo);
  bar.style.display = "flex";
}

function ocultarEstado() {
  const bar = document.getElementById("statusBar");
  if (!bar) return;
  bar.style.display = "none";
}

/* =============================
   ✅ PLUGIN: % dentro de PIE/DOUGHNUT + % PRO en BARRAS
   - No toca tamaño/canvas => no bucles raros
============================= */
const PercentLabelsPlugin = {
  id: "percentLabels",

  afterDatasetsDraw(chart, args, pluginOptions) {
    const opts = pluginOptions || {};
    const type = chart?.config?.type || "";
    const ctx = chart.ctx;
    if (!ctx) return;

    const meta0 = chart.getDatasetMeta(0);
    if (!meta0 || meta0.hidden) return;

    const dataset = chart.data.datasets?.[0];
    if (!dataset) return;

    const raw = Array.isArray(dataset._rawCounts) ? dataset._rawCounts : dataset.data;
    const values = (raw || []).map(v => Number(v) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) return;

    // Fuente dinámica (se adapta bonito a tamaños reales)
    const base = Math.max(10, Math.min(13, Math.round((chart.width || 400) / 35)));
    const fontPie = opts.fontPie || `700 ${base}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const fontBar = opts.fontBar || `700 ${Math.max(10, base - 1)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const minPercent = Number.isFinite(opts.minPercent) ? opts.minPercent : 4;
    const decimals = Number.isFinite(opts.decimals) ? opts.decimals : 0;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // ===== PIE / DOUGHNUT: % DENTRO =====
    if (type === "pie" || type === "doughnut") {
      ctx.font = fontPie;

      meta0.data.forEach((element, i) => {
        const v = values[i] || 0;
        if (!v) return;

        const pct = (v / total) * 100;
        if (pct < minPercent) return;

        const pos = typeof element.tooltipPosition === "function"
          ? element.tooltipPosition()
          : (element.getCenterPoint ? element.getCenterPoint() : null);

        if (!pos) return;

        const label = `${pct.toFixed(decimals)}%`;

        // Borde suave para legibilidad en colores claros/oscuros
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.strokeText(label, pos.x, pos.y);

        ctx.fillStyle = opts.colorPie || "#111";
        ctx.fillText(label, pos.x, pos.y);
      });

      ctx.restore();
      return;
    }

    // ===== BAR: % BONITO (dentro si hay espacio, sino arriba) =====
    if (type === "bar") {
      ctx.font = fontBar;

      meta0.data.forEach((bar, i) => {
        const v = values[i] || 0;
        if (!v) return;

        const pct = (v / total) * 100;
        if (pct < (opts.minPercentBar ?? 0)) return;

        const label = `${pct.toFixed(decimals)}%`;

        const x = bar.x;

        // Altura disponible del gráfico (para decidir dentro/afuera)
        const yTop = Math.min(bar.y, bar.base);
        const yBase = Math.max(bar.y, bar.base);
        const barHeight = yBase - yTop;

        // Si la barra es suficientemente alta -> dentro (arribita)
        // Si no -> encima (pero sin salirse)
        let y;
        const inside = barHeight >= 28;
        if (inside) {
          y = yTop + 14; // dentro
        } else {
          y = yTop - 10; // encima
          y = Math.max(y, 12); // no se sale arriba
        }

        // En barras: SIN borde grueso (se veía feo)
        ctx.fillStyle = opts.colorBar || "#111";
        ctx.fillText(label, x, y);
      });

      ctx.restore();
      return;
    }

    ctx.restore();
  },
};

/* =============================
   INIT
============================= */
export async function initCharts() {
  await cargarDatos();

  const btnAplicarFiltros = document.getElementById("btnAplicarFiltros");
  if (btnAplicarFiltros) {
    btnAplicarFiltros.onclick = aplicarFiltros;
  }
}

/* =============================
   CARGA DE DATOS
============================= */
async function cargarDatos() {
  try {
    mostrarEstado("Cargando datos...", "ok");

    const res = await obtenerDatosDashboard();

    if (res.status === "success") {
      const lista = res?.data?.data ?? res?.data ?? [];
      datosGlobales = Array.isArray(lista) ? lista : [];

      poblarFiltroUsuarios(datosGlobales);

      renderDashboard(datosGlobales);
      ocultarEstado();
      return;
    }

    mostrarEstado("Error al cargar datos", "error");
  } catch (err) {
    mostrarEstado("Error: " + err.message, "error");
  }
}

/* =============================
   ✅ FECHAS (FIX PARA SHEETS)
============================= */
function parseFechaSheets(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;

  const s = String(valor).trim();

  const isoTry = new Date(s);
  if (!isNaN(isoTry)) return isoTry;

  const parts = s.split(" ");
  const fecha = parts[0];
  const hora = parts[1] || "00:00:00";

  const [a, b, c] = fecha.split("/").map(n => parseInt(n, 10));
  if (!a || !b || !c) return null;

  const dd = a;
  const mm = b - 1;
  const yyyy = c;

  const [hh, mi, ss] = hora.split(":").map(n => parseInt(n, 10) || 0);

  const d = new Date(yyyy, mm, dd, hh, mi, ss);
  return isNaN(d) ? null : d;
}

function inicioDelDia(yyyy_mm_dd) {
  return new Date(yyyy_mm_dd + "T00:00:00");
}

function finDelDia(yyyy_mm_dd) {
  return new Date(yyyy_mm_dd + "T23:59:59.999");
}

/* =============================
   ✅ FILTRO USUARIOS (Email)
============================= */
function poblarFiltroUsuarios(data) {
  const sel = document.getElementById("filterUsuario");
  if (!sel) return;

  const actual = sel.value || "todos";
  sel.innerHTML = `<option value="todos">Todos</option>`;

  const emails = Array.from(
    new Set(
      data
        .map(d => String(d.email || "").trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  emails.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    sel.appendChild(opt);
  });

  sel.value = emails.includes(actual) ? actual : "todos";
}

/* =============================
   FILTROS
============================= */
function aplicarFiltros() {
  const desdeEl = document.getElementById("filterDesde");
  const hastaEl = document.getElementById("filterHasta");
  const paisEl = document.getElementById("filterPais");
  const medioEl = document.getElementById("filterMedio");
  const sentimientoEl = document.getElementById("filterSentimiento");
  const usuarioEl = document.getElementById("filterUsuario");

  const desde = desdeEl ? desdeEl.value : "";
  const hasta = hastaEl ? hastaEl.value : "";
  const pais = paisEl ? normalizarTexto(paisEl.value) : "todos";
  const medio = medioEl ? normalizarTexto(medioEl.value) : "todos";
  const sentimiento = sentimientoEl ? normalizarTexto(sentimientoEl.value) : "todos";
  const usuario = usuarioEl ? normalizarTexto(usuarioEl.value) : "todos";

  const dDesde = desde ? inicioDelDia(desde) : null;
  const dHasta = hasta ? finDelDia(hasta) : null;

  const filtrados = datosGlobales.filter(item => {
    let valido = true;

    const dItem = parseFechaSheets(item.time);

    if ((dDesde || dHasta) && !dItem) valido = false;
    if (dDesde && dItem && dItem < dDesde) valido = false;
    if (dHasta && dItem && dItem > dHasta) valido = false;

    if (pais !== "todos" && normalizarTexto(item.pais) !== pais) valido = false;
    if (medio !== "todos" && normalizarTexto(item.medio) !== medio) valido = false;
    if (sentimiento !== "todos" && normalizarTexto(obtenerSentimiento(item)) !== sentimiento) valido = false;
    if (usuario !== "todos" && normalizarTexto(item.email) !== usuario) valido = false;

    return valido;
  });

  renderDashboard(filtrados);
}

/* =============================
   DASHBOARD
============================= */
function renderDashboard(data) {
  renderMetrics(data);
  renderCharts(data);
  renderResumen(data);
}

/* =============================
   MÉTRICAS
============================= */
function renderMetrics(data) {
  const total = data.length;

  const positivas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const negativas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;
  const neutrales = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;

  const elTotal = document.getElementById("metricTotal");
  const elPos = document.getElementById("metricPositivas");
  const elNeg = document.getElementById("metricNegativas");
  const elNeu = document.getElementById("metricNeutrales");

  if (elTotal) elTotal.textContent = total;
  if (elPos) elPos.textContent = total ? ((positivas / total) * 100).toFixed(1) + "%" : "0%";
  if (elNeg) elNeg.textContent = total ? ((negativas / total) * 100).toFixed(1) + "%" : "0%";
  if (elNeu) elNeu.textContent = total ? ((neutrales / total) * 100).toFixed(1) + "%" : "0%";
}

/* =============================
   RESUMEN
============================= */
function renderResumen(data) {
  const resumen = document.getElementById("summary");
  if (!resumen) return;

  if (!data.length) {
    resumen.textContent = "No hay datos disponibles en el rango seleccionado.";
    return;
  }

  const paises = contarPorCampo(data, "pais");
  resumen.innerHTML = `<b>${data.length}</b> gestiones registradas en <b>${Object.keys(paises).length}</b> países.`;
}

/* =============================
   GRÁFICOS
============================= */
function renderCharts(data) {
  charts.forEach(c => c?.destroy?.());
  charts = [];

  const pais = contarPorCampo(data, "pais");
  const medio = contarPorCampo(data, "medio");
  const sentimiento = contarPorSentimiento(data);

  const colors = {
    azul: "#2F66F5",
    celeste: "#54C0F2",
    verde: "#10B981",
    rojo: "#EF4444",
    amarillo: "#F9B233",
    gris: "#A3A3A3",
  };

  const c1 = crearGraficoPie("chartPais", pais, [colors.azul, colors.celeste, colors.amarillo, colors.verde, colors.gris]);
  const c2 = crearGraficoPie("chartMedio", medio, [colors.azul, colors.celeste, colors.verde, colors.amarillo, colors.gris]);
  const c3 = crearGraficoPieSentimiento("chartSentimiento", sentimiento, colors);
  const c4 = crearGraficoGauge(data, "chartMedidor");
  const c5 = crearGraficoBarras("chartCanales", medio, colors);

  [c1, c2, c3, c4, c5].forEach(c => { if (c) charts.push(c); });
}

/* =============================
   UTILIDADES
============================= */
function contarPorCampo(data, campo) {
  const conteo = {};
  data.forEach(row => {
    const valor = String(row[campo] ?? "Sin dato").trim() || "Sin dato";
    conteo[valor] = (conteo[valor] || 0) + 1;
  });
  return conteo;
}

function contarPorSentimiento(data) {
  const conteo = {};
  data.forEach(row => {
    const raw = String(obtenerSentimiento(row) ?? "Sin dato").trim() || "Sin dato";
    const s = raw.toLowerCase();

    const etiqueta =
      s === "positivo" ? "Positivo" :
      s === "negativo" ? "Negativo" :
      s === "neutral" ? "Neutral" :
      "Sin dato";

    conteo[etiqueta] = (conteo[etiqueta] || 0) + 1;
  });
  return conteo;
}

function datasetDesdeConteo(conteoObj) {
  const labels = Object.keys(conteoObj);
  const counts = labels.map(l => Number(conteoObj[l]) || 0);
  return { labels, counts };
}

function tooltipCantidadYPorcentaje() {
  return {
    callbacks: {
      label: (ctx) => {
        const chart = ctx.chart;
        const ds = chart.data.datasets?.[0];
        const counts = Array.isArray(ds?._rawCounts) ? ds._rawCounts : (ds?.data || []);
        const i = ctx.dataIndex;

        const count = Number(counts[i]) || 0;
        const total = (counts || []).reduce((a, b) => a + (Number(b) || 0), 0) || 0;

        const pct = total ? (count / total) * 100 : 0;
        const label = ctx.label ? `${ctx.label}: ` : "";
        return `${label}${count} (${pct.toFixed(1)}%)`;
      }
    }
  };
}

/* =============================
   PIE GENÉRICO (con % dentro)
============================= */
function crearGraficoPie(id, conteoObj, colores) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const { labels, counts } = datasetDesdeConteo(conteoObj);

  return new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: counts,
        _rawCounts: counts,
        backgroundColor: colores,
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: tooltipCantidadYPorcentaje(),
        percentLabels: {
          minPercent: 4,
          decimals: 0,
          colorPie: "#111",
        }
      },
    },
    plugins: [PercentLabelsPlugin],
  });
}

/* =============================
   PIE SENTIMIENTO (con % dentro)
============================= */
function crearGraficoPieSentimiento(id, conteoObj, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const labels = Object.keys(conteoObj);
  const counts = labels.map(l => Number(conteoObj[l]) || 0);

  const colorPorEtiqueta = {
    "Positivo": colors.verde,
    "Negativo": colors.amarillo,
    "Neutral": colors.celeste,
    "Sin dato": colors.rojo,
    "Sin Dato": colors.rojo,
  };

  const background = labels.map(l => colorPorEtiqueta[l] || colors.gris);

  return new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: counts,
        _rawCounts: counts,
        backgroundColor: background,
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: tooltipCantidadYPorcentaje(),
        percentLabels: { minPercent: 4, decimals: 0, colorPie: "#111" }
      },
    },
    plugins: [PercentLabelsPlugin],
  });
}

/* =============================
   BARRAS (% arriba/dentro, limpio)
============================= */
function crearGraficoBarras(id, conteoObj, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const { labels, counts } = datasetDesdeConteo(conteoObj);
  const total = counts.reduce((a, b) => a + b, 0) || 0;
  const percents = counts.map(v => total ? (v / total) * 100 : 0);

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "% de Gestiones",
        data: percents,
        _rawCounts: counts,
        backgroundColor: colors.azul,
        borderRadius: 8,
        maxBarThickness: 52,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (v) => `${v}%` }
        }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const ds = ctx.dataset;
              const countsLocal = Array.isArray(ds._rawCounts) ? ds._rawCounts : [];
              const i = ctx.dataIndex;

              const count = Number(countsLocal[i]) || 0;
              const pct = Number(ctx.parsed.y) || 0;
              return `${count} (${pct.toFixed(1)}%)`;
            }
          }
        },
        percentLabels: {
          decimals: 0,
          colorBar: "#111",
          minPercentBar: 0
        }
      }
    },
    plugins: [PercentLabelsPlugin],
  });
}

/* =============================
   GAUGE (doughnut) con % dentro
============================= */
function crearGraficoGauge(data, id) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const positivas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const neutrales = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;
  const negativas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;

  const counts = [positivas, neutrales, negativas];

  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Positivas", "Neutrales", "Negativas"],
      datasets: [{
        data: counts,
        _rawCounts: counts,
        backgroundColor: ["#10B981", "#54C0F2", "#EF4444"],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: tooltipCantidadYPorcentaje(),
        percentLabels: {
          minPercent: 8,
          decimals: 0,
          colorPie: "#111"
        }
      },
    },
    plugins: [PercentLabelsPlugin],
  });
}
