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

/* ======================================================
   ✅ Plugin interno: porcentajes visibles SIN hover
   - Pie/Doughnut: % dentro del slice
   - Bar: % dentro de la barra (si cabe) o arriba (si es muy pequeña)
   - Mantiene tooltip con cantidad
====================================================== */
const PercentLabelsPlugin = {
  id: "percentLabels",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const opts = pluginOptions || {};
    const type = chart.config.type;

    if (!opts.enabled) return;

    const ctx = chart.ctx;
    const dataset = chart.data.datasets?.[0];
    if (!dataset) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta || meta.hidden) return;

    // Valores
    const values = (dataset.data || []).map(v => Number(v) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) return;

    const fontFamily = opts.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const baseFont = Number(opts.fontSize || 12);
    const minPercentToShow = Number(opts.minPercentToShow ?? 0); // 0 = mostrar todos

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = opts.color || "#111";
    ctx.font = `700 ${baseFont}px ${fontFamily}`;

    // Borde blanco para que se lea sobre colores
    const stroke = opts.stroke ?? true;
    if (stroke) {
      ctx.lineWidth = opts.strokeWidth ?? 4;
      ctx.strokeStyle = opts.strokeColor || "rgba(255,255,255,0.95)";
    }

    // -------- PIE / DOUGHNUT --------
    if (type === "pie" || type === "doughnut") {
      meta.data.forEach((arc, i) => {
        const v = values[i];
        if (!v) return;

        const percent = (v / total) * 100;
        if (percent < minPercentToShow) return;

        // Texto (redondeo bonito)
        const label = percent >= 10 ? `${Math.round(percent)}%` : `${percent.toFixed(1)}%`;

        // Centro del arco
        const { x, y } = arc.getCenterPoint();

        // Ajuste de tamaño para slices muy pequeños (pero siempre dentro)
        let fontSize = baseFont;
        if (percent < 3) fontSize = Math.max(9, baseFont - 3);
        else if (percent < 6) fontSize = Math.max(10, baseFont - 2);
        else if (percent < 10) fontSize = Math.max(11, baseFont - 1);

        ctx.font = `800 ${fontSize}px ${fontFamily}`;

        if (stroke) ctx.strokeText(label, x, y);
        ctx.fillText(label, x, y);
      });

      ctx.restore();
      return;
    }

    // -------- BAR --------
    if (type === "bar") {
      const yScale = chart.scales?.y;
      meta.data.forEach((bar, i) => {
        const v = values[i];
        if (!v) return;

        const percent = (v / total) * 100;
        if (percent < minPercentToShow) return;

        const label = percent >= 10 ? `${Math.round(percent)}%` : `${percent.toFixed(1)}%`;

        // Centro X de la barra
        const x = bar.x;

        // Altura disponible (para decidir si va dentro o arriba)
        const topY = bar.y;               // parte superior de la barra
        const baseY = bar.base;           // base de la barra
        const height = Math.abs(baseY - topY);

        // Si la barra es alta, ponemos label dentro (un poco abajo del top)
        // Si es muy pequeña, la ponemos arriba para que NO se encime
        const inside = height >= 22;

        const y = inside ? (topY + 12) : (topY - 10);

        // Color dentro/afuera
        const insideFill = opts.barInsideColor || "#111";
        const outsideFill = opts.barOutsideColor || "#111";

        ctx.font = `800 ${baseFont}px ${fontFamily}`;

        // si va dentro, mejor con borde blanco sí o sí
        if (stroke) {
          ctx.strokeText(label, x, y);
        }

        ctx.fillStyle = inside ? insideFill : outsideFill;
        ctx.fillText(label, x, y);

        // restaurar fill
        ctx.fillStyle = opts.color || "#111";
      });

      ctx.restore();
      return;
    }

    ctx.restore();
  }
};

// Registrar plugin 1 vez
if (typeof Chart !== "undefined" && Chart?.register) {
  Chart.register(PercentLabelsPlugin);
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

  // mantener opción "Todos"
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

  // intentar restaurar selección previa
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

  const filtrados = datosGlobales.filter(item => {
    let valido = true;

    const dItem = parseFechaSheets(item.time);

    if ((dDesde || dHasta) && !dItem) valido = false;

    if (dDesde && dItem && dItem < dDesde) valido = false;
    if (dHasta && dItem && dItem > dHasta) valido = false;

    if (pais !== "todos" && normalizarTexto(item.pais) !== pais) valido = false;
    if (medio !== "todos" && normalizarTexto(item.medio) !== medio) valido = false;
    if (sentimiento !== "todos" && normalizarTexto(obtenerSentimiento(item)) !== sentimiento) valido = false;

    // ✅ filtro por usuario (email)
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
  const c5 = crearGraficoBarrasPorcentaje("chartCanales", medio, colors);

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

function toPercentDataset(conteoObj) {
  const labels = Object.keys(conteoObj);
  const values = labels.map(l => Number(conteoObj[l]) || 0);
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const perc = values.map(v => (v / total) * 100);
  return { labels, values, perc, total };
}

/* =============================
   PIE GENÉRICO (con % dentro)
============================= */
function crearGraficoPie(id, dataset, colores) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const { labels, values } = toPercentDataset(dataset);

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,                 // ✅ valores reales (para tooltip cantidad)
        backgroundColor: colores,
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,     // ✅ evita estiramiento raro
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (tt) => {
              const v = tt.raw ?? 0;
              const total = values.reduce((a, b) => a + b, 0) || 1;
              const p = (v / total) * 100;
              return ` ${tt.label}: ${v} (${p.toFixed(1)}%)`;
            }
          }
        },
        percentLabels: {
          enabled: true,
          fontSize: 12,
          stroke: true,
          // 0 = intentar mostrarlos todos (si hay muchísimos, puede encimar, pero NO los manda afuera)
          minPercentToShow: 0
        }
      }
    },
  });
}

/* =============================
   PIE SENTIMIENTO (con % dentro)
============================= */
function crearGraficoPieSentimiento(id, dataset, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const labels = Object.keys(dataset);
  const values = Object.values(dataset).map(v => Number(v) || 0);

  const colorPorEtiqueta = {
    "Positivo": colors.verde,
    "Negativo": colors.amarillo,
    "Neutral": colors.celeste,
    "Sin dato": colors.rojo,
    "Sin Dato": colors.rojo,
  };

  const background = labels.map(l => colorPorEtiqueta[l] || colors.gris);

  return new Chart(ctx, {
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
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (tt) => {
              const v = tt.raw ?? 0;
              const total = values.reduce((a, b) => a + b, 0) || 1;
              const p = (v / total) * 100;
              return ` ${tt.label}: ${v} (${p.toFixed(1)}%)`;
            }
          }
        },
        percentLabels: {
          enabled: true,
          fontSize: 12,
          stroke: true,
          minPercentToShow: 0
        }
      }
    },
  });
}

/* =============================
   BARRAS (porcentaje + label)
   - Valores reales -> convertimos a % para el eje
   - Label de % visible siempre
============================= */
function crearGraficoBarrasPorcentaje(id, dataset, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const { labels, values, perc } = toPercentDataset(dataset);

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "% de Gestiones",
        data: perc, // ✅ ahora el gráfico es porcentual
        backgroundColor: colors.azul,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (v) => `${v}%`
          }
        }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (tt) => {
              const i = tt.dataIndex;
              const cantidad = values[i] ?? 0;
              const p = perc[i] ?? 0;
              return ` ${tt.label}: ${cantidad} (${p.toFixed(1)}%)`;
            }
          }
        },
        percentLabels: {
          enabled: true,
          fontSize: 12,
          stroke: true,
          // Para barras: si la barra es muy pequeña, el plugin la pone arriba automáticamente
          minPercentToShow: 0
        }
      }
    },
  });
}

/* =============================
   GAUGE (doughnut) con % dentro
============================= */
function crearGraficoGauge(data, id) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const positivas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const neutrales = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;
  const negativas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;

  const values = [positivas, neutrales, negativas];

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Positivas", "Neutrales", "Negativas"],
      datasets: [{
        data: values,
        backgroundColor: ["#10B981", "#54C0F2", "#EF4444"],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (tt) => {
              const v = tt.raw ?? 0;
              const total = values.reduce((a, b) => a + b, 0) || 1;
              const p = (v / total) * 100;
              return ` ${tt.label}: ${v} (${p.toFixed(1)}%)`;
            }
          }
        },
        percentLabels: {
          enabled: true,
          fontSize: 12,
          stroke: true,
          minPercentToShow: 0
        }
      }
    },
  });
}
