/* js/charts.js */
let datosGlobales = [];
let charts = [];

const normalizarTexto = (valor) => String(valor ?? "").trim().toLowerCase();
const obtenerSentimiento = (row) => row.sentimiento ?? row.sentimientos ?? "";

// ✅ soporte flexible para Producto desde Sheets/backend
const obtenerProducto = (row) =>
  row?.producto ?? row?.Producto ?? row?.["Producto"] ?? row?.productos ?? row?.["productos"] ?? "";

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
function toPercentWithCounts(datasetCounts) {
  const labels = Object.keys(datasetCounts || {});
  const counts = labels.map((k) => Number(datasetCounts[k]) || 0);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const percents = counts.map((v) => +((v / total) * 100).toFixed(1));
  return { labels, counts, percents, total };
}

function fmtPercent(p) {
  const n = Number(p) || 0;
  if (n === 0) return "0%";
  if (n < 1) return "1%";
  return `${n.toFixed(1)}%`;
}


/* =============================
   ✅ PLUGIN: % visible SIEMPRE (dentro del pie y sin salirse)
============================= */
const percentLabelsPlugin = {
  id: "percentLabelsPlugin",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx, chartArea } = chart;
    const opts = pluginOptions || {};

    const fontSize = opts.fontSize || 12;
    const fontFamily = opts.fontFamily || "Poppins, sans-serif";

    const fillColor = opts.fillColor || "#111827";
    const shadowColor = opts.shadowColor || "rgba(0,0,0,0.30)";
    const shadowBlur = typeof opts.shadowBlur === "number" ? opts.shadowBlur : 3;
    const shadowOffsetY = typeof opts.shadowOffsetY === "number" ? opts.shadowOffsetY : 1;

    // ✅ IMPORTANTE: fuerza que en PIE siempre sea dentro (evita que se recorte afuera)
    const forceInsidePie = opts.forceInsidePie !== false; // por defecto TRUE

    // padding para clamping
    const pad = typeof opts.clampPadding === "number" ? opts.clampPadding : 8;

    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      const type = chart.config.type;
      const isPie = type === "pie" || type === "doughnut";
      const isBar = type === "bar";
      if (!isPie && !isBar) return;

      meta.data.forEach((element, index) => {
        const val = Number(dataset.data?.[index]) || 0;
        if (val <= 0) return;

        const text = fmtPercent(val);

        // ===== PIE / DOUGHNUT =====
        if (isPie) {
          const props = element.getProps(
            ["x", "y", "startAngle", "endAngle", "outerRadius", "innerRadius"],
            true
          );

          const { x, y, startAngle, endAngle, outerRadius, innerRadius } = props;
          const mid = (startAngle + endAngle) / 2;
          const arcLen = Math.abs(endAngle - startAngle) * outerRadius;

          // ✅ si es porción pequeña, bajamos un poco el font para que quepa
          const smallSlice = arcLen < 30 || val < 1;
          const fs = smallSlice ? Math.max(10, fontSize - 2) : fontSize;

          // ✅ radio interno: siempre dentro
          const rInside = innerRadius + (outerRadius - innerRadius) * (smallSlice ? 0.40 : 0.55);
          const r = forceInsidePie ? rInside : rInside; // (dejado por claridad)

          let tx = x + Math.cos(mid) * r;
          let ty = y + Math.sin(mid) * r;

          // ✅ Clamp: evita que el texto se salga del canvas/área del chart
          if (chartArea) {
            tx = clamp(tx, chartArea.left + pad, chartArea.right - pad);
            ty = clamp(ty, chartArea.top + pad, chartArea.bottom - pad);
          }

          ctx.save();
          ctx.font = `700 ${fs}px ${fontFamily}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = fillColor;

          // sombra sutil (solo texto)
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = shadowBlur;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = shadowOffsetY;

          ctx.fillText(text, tx, ty);
          ctx.restore();
          return;
        }

        // ===== BAR =====
        if (isBar) {
          const pos = element.tooltipPosition?.();
          if (!pos) return;

          const tx = pos.x;
          const ty = pos.y - 14;

          ctx.save();
          ctx.font = `700 ${fontSize}px ${fontFamily}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = fillColor;

          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = shadowBlur;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = shadowOffsetY;

          ctx.fillText(text, tx, ty);
          ctx.restore();
        }
      });
    });
  },
};

// registrar 1 vez
try {
  const exists = Chart?.registry?.plugins?.get?.("percentLabelsPlugin");
  if (!exists) Chart.register(percentLabelsPlugin);
} catch {
  try { Chart.register(percentLabelsPlugin); } catch {}
}


/* =============================
   ✅ Leyenda abajo (estable)
============================= */
function legendBottomConfig() {
  return {
    position: "bottom",
    align: "center",
    labels: {
      boxWidth: 14,
      boxHeight: 10,
      padding: 10,
      font: { size: 12, weight: "500" },
    },
  };
}

/* =============================
   ✅ BASE OPTIONS (anti-loop)
============================= */
function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 150,
  };
}

/* =============================
   INIT
============================= */
export async function initCharts() {
  await cargarDatos();

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
      poblarFiltroProducto(datosGlobales); // ✅ nuevo
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

  sel.value = emails.includes(actual) ? actual : "todos";
}

/* =============================
   ✅ FILTRO PRODUCTO (nuevo)
============================= */
function poblarFiltroProducto(data) {
  const sel = document.getElementById("filterProducto");
  if (!sel) return;

  const actual = normalizarTexto(sel.value || "todos");
  sel.innerHTML = `<option value="todos">Todos</option>`;

  const productos = Array.from(
    new Set(
      data
        .map((d) => String(obtenerProducto(d) || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  productos.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });

  // preserva selección si existe
  const found = productos.find((p) => normalizarTexto(p) === actual);
  sel.value = found ? found : "todos";
}

/* =============================
   FILTROS
============================= */
function aplicarFiltros() {
  const desdeEl = document.getElementById("filterDesde");
  const hastaEl = document.getElementById("filterHasta");
  const paisEl = document.getElementById("filterPais");
  const medioEl = document.getElementById("filterMedio");
  const productoEl = document.getElementById("filterProducto"); // ✅ nuevo
  const sentimientoEl = document.getElementById("filterSentimiento");
  const usuarioEl = document.getElementById("filterUsuario");

  const desde = desdeEl ? desdeEl.value : "";
  const hasta = hastaEl ? hastaEl.value : "";
  const pais = paisEl ? normalizarTexto(paisEl.value) : "todos";
  const medio = medioEl ? normalizarTexto(medioEl.value) : "todos";
  const producto = productoEl ? normalizarTexto(productoEl.value) : "todos"; // ✅ nuevo
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

    // ✅ filtro producto
    if (producto !== "todos" && normalizarTexto(obtenerProducto(item)) !== producto) valido = false;

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
  const productoCount = contarPorProducto(data); // ✅ nuevo

  const pais = toPercentWithCounts(paisCount);
  const medio = toPercentWithCounts(medioCount);
  const sentimiento = toPercentWithCounts(sentimientoCount);
  const producto = toPercentWithCounts(productoCount); // ✅ nuevo

  const colors = {
    azul: "#2F66F5",
    celeste: "#54C0F2",
    verde: "#10B981",
    rojo: "#EF4444",
    amarillo: "#F9B233",
    gris: "#A3A3A3",
  };

  const c1 = crearGraficoPie("chartPais", pais, [colors.azul, colors.celeste, colors.amarillo, colors.gris]);
  const c2 = crearGraficoPie("chartMedio", medio, [colors.azul, colors.celeste, colors.verde, colors.amarillo, colors.gris]);
  const c3 = crearGraficoPieSentimiento("chartSentimiento", sentimiento, colors);
  const c4 = crearGraficoGauge(data, "chartMedidor");
  const c5 = crearGraficoBarras("chartCanales", medio, colors);
  const c6 = crearGraficoPie("chartProducto", producto, [colors.azul, colors.celeste, colors.verde, colors.amarillo, colors.gris]); // ✅ nuevo

  [c1, c2, c3, c4, c6, c5].forEach((c) => c && charts.push(c));
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

function contarPorProducto(data) {
  const conteo = {};
  data.forEach((row) => {
    const valor = String(obtenerProducto(row) ?? "Sin dato").trim() || "Sin dato";
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
   - padding mayor para que no se corten % afuera
============================= */
function crearGraficoPie(id, pack, colores) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  return new Chart(canvas, {
    type: "pie",
    data: {
      labels: pack.labels,
      datasets: [{
        data: pack.percents,
        _counts: pack.counts,
        backgroundColor: colores,
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      ...baseChartOptions(),
      layout: { padding: 18 }, // ✅ evita recorte de <1% afuera
      plugins: {
        legend: legendBottomConfig(),
        tooltip: {
          callbacks: {
            label: (context) => {
              const idx = context.dataIndex;
              const n = context.dataset._counts?.[idx] ?? 0;
              const p = context.raw;
              return `${context.label}: ${n} (${fmtPercent(p)})`;
            },
          },
        },
        percentLabelsPlugin: {
          outsideThreshold: 4,
          outsideOffset: 22,
          minArcPx: 26,
          fontSize: 12,
          fillColor: "#111827",
        },
      },
    },
  });
}

/* =============================
   PIE SENTIMIENTO
============================= */
function crearGraficoPieSentimiento(id, pack, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const colorPorEtiqueta = {
    "Positivo": colors.verde,
    "Negativo": colors.amarillo,
    "Neutral": colors.celeste,
    "Sin dato": colors.rojo,
    "Sin Dato": colors.rojo,
  };

  const background = pack.labels.map((l) => colorPorEtiqueta[l] || colors.gris);

  return new Chart(canvas, {
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
      ...baseChartOptions(),
      layout: { padding: 18 }, // ✅ evita recorte de <1%
      plugins: {
        legend: legendBottomConfig(),
        tooltip: {
          callbacks: {
            label: (context) => {
              const idx = context.dataIndex;
              const n = context.dataset._counts?.[idx] ?? 0;
              const p = context.raw;
              return `${context.label}: ${n} (${fmtPercent(p)})`;
            },
          },
        },
        percentLabelsPlugin: {
          outsideThreshold: 4,
          outsideOffset: 22,
          minArcPx: 26,
          fontSize: 12,
          fillColor: "#111827",
        },
      },
    },
  });
}

/* =============================
   BARRAS
============================= */
function crearGraficoBarras(id, pack, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  return new Chart(canvas, {
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
      ...baseChartOptions(),
      layout: { padding: 10 },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (value) => value + "%" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const n = ctx.dataset._counts?.[idx] ?? 0;
              const p = ctx.raw;
              return `${n} (${fmtPercent(p)})`;
            },
          },
        },
        percentLabelsPlugin: { fontSize: 12, fillColor: "#111827" },
      },
    },
  });
}

/* =============================
   GAUGE (%)
   - padding mayor para que no se corte etiqueta
============================= */
function crearGraficoGauge(data, id) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const positivas = data.filter((d) => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const neutrales = data.filter((d) => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;
  const negativas = data.filter((d) => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;

  const total = positivas + neutrales + negativas || 1;
  const pPos = +((positivas / total) * 100).toFixed(1);
  const pNeu = +((neutrales / total) * 100).toFixed(1);
  const pNeg = +((negativas / total) * 100).toFixed(1);

  return new Chart(canvas, {
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
      ...baseChartOptions(),
      cutout: "70%",
      layout: { padding: 18 }, // ✅ evita recorte
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const n = ctx.dataset._counts?.[idx] ?? 0;
              const p = ctx.raw;
              return `${ctx.label}: ${n} (${fmtPercent(p)})`;
            },
          },
        },
        percentLabelsPlugin: {
          outsideThreshold: 3,
          outsideOffset: 18,
          minArcPx: 22,
          fontSize: 12,
          fillColor: "#111827",
        },
      },
    },
  });
}
