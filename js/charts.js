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
   ✅ HELPERS
============================= */
function sumDataset(dataset) {
  return Object.values(dataset || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

function toPercentWithCounts(datasetCounts) {
  const labels = Object.keys(datasetCounts || {});
  const counts = labels.map((k) => Number(datasetCounts[k]) || 0);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const percents = counts.map((v) => +((v / total) * 100).toFixed(1));
  return { labels, counts, percents, total };
}

/* =============================
   ✅ PLUGIN: dibujar % visible siempre
   - Pie/Doughnut: % dentro de cada slice
   - Bar: % arriba de cada barra
============================= */
const percentLabelsPlugin = {
  id: "percentLabelsPlugin",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx } = chart;
    const opts = pluginOptions || {};
    const minPercent = typeof opts.minPercent === "number" ? opts.minPercent : 3; // no dibujar pedazos muy pequeños
    const fontSize = opts.fontSize || 12;
    const fontFamily = opts.fontFamily || "Poppins, sans-serif";
    const textColor = opts.color || "#111";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      const type = chart.config.type;
      const isPie = type === "pie" || type === "doughnut";
      const isBar = type === "bar";

      // Solo pintamos labels en:
      if (!isPie && !isBar) return;

      ctx.save();
      ctx.font = `600 ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      meta.data.forEach((element, index) => {
        const val = Number(dataset.data?.[index]) || 0; // aquí viene el %
        if (val < minPercent) return;

        let pos = null;

        // pie/doughnut -> usar centro del slice
        if (isPie) {
          if (typeof element.tooltipPosition === "function") {
            pos = element.tooltipPosition();
          }
        }

        // bar -> usar punto arriba del rectángulo
        if (isBar) {
          if (typeof element.tooltipPosition === "function") {
            pos = element.tooltipPosition();
            // subimos un poquito para que quede encima
            pos = { x: pos.x, y: pos.y - 12 };
          }
        }

        if (!pos) return;

        const text = `${val}%`;
        ctx.fillText(text, pos.x, pos.y);
      });

      ctx.restore();
    });
  },
};

// Registrar plugin solo 1 vez (por si vuelves a entrar a Inicio)
try {
  const exists = Chart?.registry?.plugins?.get?.("percentLabelsPlugin");
  if (!exists) Chart.register(percentLabelsPlugin);
} catch {
  try { Chart.register(percentLabelsPlugin); } catch {}
}

/* =============================
   INIT
============================= */
export async function initCharts() {
  await cargarDatos();

  // ✅ evita listeners duplicados al volver a "Inicio"
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

      // ✅ llena filtro usuario con los emails únicos
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

  const [a, b, c] = fecha.split("/").map((n) => parseInt(n, 10));
  if (!a || !b || !c) return null;

  const dd = a;
  const mm = b - 1;
  const yyyy = c;

  const [hh, mi, ss] = hora.split(":").map((n) => parseInt(n, 10) || 0);

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
        .map((d) => String(d.email || "").trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  emails.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    sel.appendChild(opt);
  });

  if (emails.includes(actual)) sel.value = actual;
  else sel.value = "todos";
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

  const filtrados = datosGlobales.filter((item) => {
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

  const positivas = data.filter((d) => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const negativas = data.filter((d) => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;
  const neutrales = data.filter((d) => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;

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
  charts.forEach((c) => c?.destroy?.());
  charts = [];

  const paisCount = contarPorCampo(data, "pais");
  const medioCount = contarPorCampo(data, "medio");
  const sentimientoCount = contarPorSentimiento(data);

  const pais = toPercentWithCounts(paisCount);
  const medio = toPercentWithCounts(medioCount);
  const sentimiento = toPercentWithCounts(sentimientoCount);

  const colors = {
    azul: "#2F66F5",
    celeste: "#54C0F2",
    verde: "#10B981",
    rojo: "#EF4444",
    amarillo: "#F9B233",
    gris: "#A3A3A3",
  };

  const c1 = crearGraficoPie("chartPais", pais, [colors.azul, colors.celeste, colors.amarillo]);
  const c2 = crearGraficoPie("chartMedio", medio, [colors.azul, colors.celeste, colors.verde, colors.amarillo]);
  const c3 = crearGraficoPieSentimiento("chartSentimiento", sentimiento, colors);
  const c4 = crearGraficoGauge(data, "chartMedidor");
  const c5 = crearGraficoBarras("chartCanales", medio, colors);

  [c1, c2, c3, c4, c5].forEach((c) => c && charts.push(c));
}

/* =============================
   UTILIDADES
============================= */
function contarPorCampo(data, campo) {
  const conteo = {};
  data.forEach((row) => {
    const valor = String(row[campo] ?? "Sin dato").trim() || "Sin dato";
    conteo[valor] = (conteo[valor] || 0) + 1;
  });
  return conteo;
}

function contarPorSentimiento(data) {
  const conteo = {};
  data.forEach((row) => {
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

/* =============================
   PIE GENÉRICO
   - Muestra % dentro (plugin)
   - Tooltip muestra cantidad (n) siempre
============================= */
function crearGraficoPie(id, pack, colores) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: pack.labels,
      datasets: [{
        // Lo visible: %
        data: pack.percents,
        // Para tooltip: cantidades
        _counts: pack.counts,
        backgroundColor: colores,
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => {
              const idx = context.dataIndex;
              const n = context.dataset._counts?.[idx] ?? 0;
              const p = context.raw;
              return `${context.label}: ${n} (${p}%)`;
            },
          },
        },
        // plugin propio
        percentLabelsPlugin: { minPercent: 3, fontSize: 12 },
      },
    },
  });
}

/* =============================
   PIE SENTIMIENTO
============================= */
function crearGraficoPieSentimiento(id, pack, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const colorPorEtiqueta = {
    "Positivo": colors.verde,
    "Negativo": colors.amarillo,
    "Neutral": colors.celeste,
    "Sin dato": colors.rojo,
    "Sin Dato": colors.rojo,
  };

  const background = pack.labels.map((l) => colorPorEtiqueta[l] || colors.gris);

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: pack.labels,
      datasets: [{
        data: pack.percents,
        _counts: pack.counts,
        backgroundColor: background,
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => {
              const idx = context.dataIndex;
              const n = context.dataset._counts?.[idx] ?? 0;
              const p = context.raw;
              return `${context.label}: ${n} (${p}%)`;
            },
          },
        },
        percentLabelsPlugin: { minPercent: 3, fontSize: 12 },
      },
    },
  });
}

/* =============================
   BARRAS
   - Muestra % encima (plugin)
   - Tooltip muestra cantidad (n) y %
============================= */
function crearGraficoBarras(id, pack, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: pack.labels,
      datasets: [{
        label: "% de gestiones",
        data: pack.percents,
        _counts: pack.counts,
        backgroundColor: colors.azul,
      }],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value) => value + "%",
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const n = ctx.dataset._counts?.[idx] ?? 0;
              const p = ctx.raw;
              return `${n} (${p}%)`;
            },
          },
        },
        percentLabelsPlugin: { minPercent: 3, fontSize: 12 },
      },
    },
  });
}

/* =============================
   GAUGE (%)
   - Tooltip muestra % y count
   - Labels % dentro via plugin
============================= */
function crearGraficoGauge(data, id) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const positivas = data.filter((d) => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const neutrales = data.filter((d) => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;
  const negativas = data.filter((d) => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;

  const total = positivas + neutrales + negativas || 1;

  const pPos = +((positivas / total) * 100).toFixed(1);
  const pNeu = +((neutrales / total) * 100).toFixed(1);
  const pNeg = +((negativas / total) * 100).toFixed(1);

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Positivas", "Neutrales", "Negativas"],
      datasets: [{
        data: [pPos, pNeu, pNeg],
        _counts: [positivas, neutrales, negativas],
        backgroundColor: ["#10B981", "#54C0F2", "#EF4444"],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }],
    },
    options: {
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const n = ctx.dataset._counts?.[idx] ?? 0;
              const p = ctx.raw;
              return `${ctx.label}: ${n} (${p}%)`;
            },
          },
        },
        percentLabelsPlugin: { minPercent: 5, fontSize: 12 },
      },
    },
  });
}
