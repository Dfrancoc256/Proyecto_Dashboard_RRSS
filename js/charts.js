/* js/charts.js */
let datosGlobales = [];
let charts = [];

const normalizarTexto = (valor) => String(valor ?? "").trim().toLowerCase();
const obtenerSentimiento = (row) => row.sentimiento ?? row.sentimientos ?? "";

/* =============================
   ✅ TUNING VISUAL (ANTI-CAOS)
============================= */
const CHART_TUNING = {
  pieMaxSlices: 7,          // máximo de categorías visibles (resto -> "Otros")
  pieMinPercentToShow: 2.0, // debajo de esto NO dibuja texto dentro (evita encime)
  pieMinPercentToKeep: 1.5, // debajo de esto se manda a "Otros"
  fontSize: 12,
  strokeWidth: 3,
};

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
   ✅ PLUGIN: % DENTRO DEL PIE
   (NO afuera, NO CSS)
============================= */
const percentInsidePlugin = {
  id: "percentInsidePlugin",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    if (!meta?.data?.length) return;

    const data = dataset.data || [];
    const total = data.reduce((a, b) => a + (Number(b) || 0), 0);
    if (!total) return;

    ctx.save();
    ctx.font = `600 ${CHART_TUNING.fontSize}px Poppins, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    meta.data.forEach((arc, i) => {
      const value = Number(data[i] || 0);
      if (!value) return;

      const pct = (value / total) * 100;
      if (pct < CHART_TUNING.pieMinPercentToShow) return;

      // centro del arco (dentro)
      const pos = arc.tooltipPosition();
      const txt = `${pct.toFixed(0)}%`;

      // borde blanco + texto negro para legibilidad
      ctx.lineWidth = CHART_TUNING.strokeWidth;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.strokeText(txt, pos.x, pos.y);

      ctx.fillStyle = "#111";
      ctx.fillText(txt, pos.x, pos.y);
    });

    ctx.restore();
  }
};

/* =============================
   INIT
============================= */
export async function initCharts() {
  await cargarDatos();

  // ✅ evita listeners duplicados al volver a "Inicio"
  const btnAplicarFiltros = document.getElementById("btnAplicarFiltros");
  if (btnAplicarFiltros) btnAplicarFiltros.onclick = aplicarFiltros;
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
   ✅ ANTI-LOOP: fijar alto del canvas
   (esto rompe el ResizeObserver loop)
============================= */
function asegurarAltoCanvas(canvasId, heightPx = 320) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;

  // 🔒 Altura estable del contenedor del canvas
  parent.style.height = `${heightPx}px`;
  parent.style.minHeight = `${heightPx}px`;

  // 🔒 Canvas se ajusta al contenedor, sin crecer infinito
  canvas.style.width = "100%";
  canvas.style.height = "100%";
}

/* =============================
   GRÁFICOS
============================= */
function renderCharts(data) {
  charts.forEach(c => c?.destroy?.());
  charts = [];

  // 🔒 fija alto estable para evitar loop
  asegurarAltoCanvas("chartPais", 320);
  asegurarAltoCanvas("chartMedio", 320);
  asegurarAltoCanvas("chartSentimiento", 320);
  asegurarAltoCanvas("chartMedidor", 320);
  asegurarAltoCanvas("chartCanales", 320);

  const pais = agruparTopN(contarPorCampo(data, "pais"), CHART_TUNING.pieMaxSlices);
  const medio = agruparTopN(contarPorCampo(data, "medio"), CHART_TUNING.pieMaxSlices);
  const sentimiento = agruparTopN(contarPorSentimiento(data), CHART_TUNING.pieMaxSlices);

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

// ✅ agrupa categorías pequeñas a "Otros" + limita el total de slices visibles
function agruparTopN(conteo, maxSlices) {
  const entries = Object.entries(conteo || {});
  if (!entries.length) return {};

  // ordenar desc
  entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));

  const total = entries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
  if (!total) return {};

  // separar pequeñas (min %)
  const grandes = [];
  let otros = 0;

  entries.forEach(([k, v]) => {
    const pct = (Number(v) || 0) / total * 100;
    if (pct < CHART_TUNING.pieMinPercentToKeep) otros += (Number(v) || 0);
    else grandes.push([k, Number(v) || 0]);
  });

  // limitar top N
  const top = grandes.slice(0, Math.max(1, maxSlices - 1));
  const resto = grandes.slice(top.length);
  resto.forEach(([, v]) => otros += (Number(v) || 0));

  const obj = {};
  top.forEach(([k, v]) => (obj[k] = v));
  if (otros > 0) obj["Otros"] = otros;

  return obj;
}

/* =============================
   PIE GENÉRICO
============================= */
function crearGraficoPie(id, dataset, colores) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  return new Chart(canvas, {
    type: "pie",
    data: {
      labels: Object.keys(dataset),
      datasets: [{
        data: Object.values(dataset),
        backgroundColor: colores,
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,  // ok porque fijamos height del contenedor arriba
      resizeDelay: 150,            // ✅ baja la frecuencia de resize (anti-loop)
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const arr = ctx.dataset.data || [];
              const total = arr.reduce((a, b) => a + (Number(b) || 0), 0);
              const val = Number(ctx.raw || 0);
              const pct = total ? (val / total * 100) : 0;
              return `${ctx.label}: ${val} (${pct.toFixed(1)}%)`;
            }
          }
        }
      }
    },
    plugins: [percentInsidePlugin],
  });
}

/* =============================
   PIE SENTIMIENTO
============================= */
function crearGraficoPieSentimiento(id, dataset, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const labels = Object.keys(dataset);
  const values = Object.values(dataset);

  const colorPorEtiqueta = {
    "Positivo": colors.verde,
    "Negativo": colors.amarillo,
    "Neutral": colors.celeste,
    "Sin dato": colors.rojo,
    "Sin Dato": colors.rojo,
    "Otros": colors.gris,
  };

  const background = labels.map(l => colorPorEtiqueta[l] || colors.gris);

  return new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: background,
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 150,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const arr = ctx.dataset.data || [];
              const total = arr.reduce((a, b) => a + (Number(b) || 0), 0);
              const val = Number(ctx.raw || 0);
              const pct = total ? (val / total * 100) : 0;
              return `${ctx.label}: ${val} (${pct.toFixed(1)}%)`;
            }
          }
        }
      }
    },
    plugins: [percentInsidePlugin],
  });
}

/* =============================
   BARRAS (puedes dejar conteo o %)
============================= */
function crearGraficoBarras(id, dataset, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: Object.keys(dataset),
      datasets: [{
        label: "Gestiones",
        data: Object.values(dataset),
        backgroundColor: colors.azul,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 150,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: true } }
    },
  });
}

/* =============================
   GAUGE
============================= */
function crearGraficoGauge(data, id) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const positivas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const neutrales = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;
  const negativas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;

  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Positivas", "Neutrales", "Negativas"],
      datasets: [{
        data: [positivas, neutrales, negativas],
        backgroundColor: ["#10B981", "#54C0F2", "#EF4444"],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 150,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const arr = ctx.dataset.data || [];
              const total = arr.reduce((a, b) => a + (Number(b) || 0), 0);
              const val = Number(ctx.raw || 0);
              const pct = total ? (val / total * 100) : 0;
              return `${ctx.label}: ${val} (${pct.toFixed(1)}%)`;
            }
          }
        }
      }
    },
    plugins: [percentInsidePlugin], // también funciona aquí (si quieres % adentro)
  });
}
