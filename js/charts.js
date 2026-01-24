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
   ✅ Plugin: % dentro del gráfico (sin librerías)
   - Pie/Doughnut: dibuja porcentaje centrado en cada segmento
   - Oculta porcentajes muy pequeños
============================= */
const InsidePercentLabels = {
  id: "InsidePercentLabels",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx } = chart;
    const type = chart.config.type;
    if (type !== "pie" && type !== "doughnut") return;

    const dataset = chart.data.datasets?.[0];
    if (!dataset) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data) return;

    const values = dataset.data || [];
    const total = values.reduce((s, v) => s + (Number(v) || 0), 0);
    if (!total) return;

    // Opciones
    const minPercent = Number(pluginOptions?.minPercent ?? 4); // oculta < 4%
    const fontBase = Number(pluginOptions?.fontBase ?? 12);
    const fontFamily = pluginOptions?.fontFamily ?? "Poppins, Arial, sans-serif";
    const color = pluginOptions?.color ?? "#111";
    const strokeColor = pluginOptions?.strokeColor ?? "rgba(255,255,255,0.85)";
    const strokeWidth = Number(pluginOptions?.strokeWidth ?? 4);

    ctx.save();

    meta.data.forEach((arc, i) => {
      const v = Number(values[i]) || 0;
      if (!v) return;

      const p = (v / total) * 100;
      if (p < minPercent) return;

      // Centro del arco
      const pos = arc.getCenterPoint();

      // Tamaño de fuente dinámico según tamaño del chart
      const area = chart.chartArea;
      const w = area.right - area.left;
      const h = area.bottom - area.top;
      const minSide = Math.min(w, h);

      // Ajuste: si el canvas es chico, baja la fuente
      let fontSize = Math.max(10, Math.min(fontBase, Math.round(minSide / 22)));

      // Si el % es pequeño, baja un poco más
      if (p < 8) fontSize = Math.max(10, fontSize - 1);

      const text = `${Math.round(p)}%`;

      ctx.font = `700 ${fontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Contorno blanco para legibilidad (sin depender del color del slice)
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, pos.x, pos.y);

      // Texto principal
      ctx.fillStyle = color;
      ctx.fillText(text, pos.x, pos.y);
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

  // ISO o Date parseable
  const isoTry = new Date(s);
  if (!isNaN(isoTry)) return isoTry;

  // Formato: dd/mm/yyyy hh:mm:ss
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
  const desde = document.getElementById("filterDesde")?.value || "";
  const hasta = document.getElementById("filterHasta")?.value || "";
  const pais = normalizarTexto(document.getElementById("filterPais")?.value || "todos");
  const medio = normalizarTexto(document.getElementById("filterMedio")?.value || "todos");
  const sentimiento = normalizarTexto(document.getElementById("filterSentimiento")?.value || "todos");
  const usuario = normalizarTexto(document.getElementById("filterUsuario")?.value || "todos");

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
  // destruir gráficos previos
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

function toPercentDataset(datasetObj) {
  const labels = Object.keys(datasetObj);
  const values = Object.values(datasetObj).map(v => Number(v) || 0);
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const perc = values.map(v => (v / total) * 100);
  return { labels, values, perc, total };
}

/* =============================
   ✅ PIE GENÉRICO (con % dentro)
============================= */
function crearGraficoPie(id, datasetObj, colores) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const { labels, values, total } = toPercentDataset(datasetObj);

  return new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colores,
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // ✅ evita que estire el card
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = Number(ctx.raw) || 0;
              const p = total ? ((v / total) * 100) : 0;
              return ` ${ctx.label}: ${v} (${p.toFixed(1)}%)`;
            }
          }
        },
        InsidePercentLabels: {
          minPercent: 4, // oculta porcentajes muy pequeños
          fontBase: 12,
        }
      },
    },
    plugins: [InsidePercentLabels],
  });
}

/* =============================
   ✅ PIE SENTIMIENTO (con % dentro)
============================= */
function crearGraficoPieSentimiento(id, datasetObj, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const labels = Object.keys(datasetObj);
  const values = Object.values(datasetObj).map(v => Number(v) || 0);
  const total = values.reduce((a, b) => a + b, 0) || 1;

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
            label: (ctx) => {
              const v = Number(ctx.raw) || 0;
              const p = total ? ((v / total) * 100) : 0;
              return ` ${ctx.label}: ${v} (${p.toFixed(1)}%)`;
            }
          }
        },
        InsidePercentLabels: {
          minPercent: 4,
          fontBase: 12,
        }
      },
    },
    plugins: [InsidePercentLabels],
  });
}

/* =============================
   ✅ GAUGE (doughnut) con % dentro
============================= */
function crearGraficoGauge(data, id) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const positivas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const neutrales = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;
  const negativas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;

  const values = [positivas, neutrales, negativas];
  const total = values.reduce((a, b) => a + b, 0) || 1;

  return new Chart(canvas, {
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
            label: (ctx) => {
              const v = Number(ctx.raw) || 0;
              const p = total ? ((v / total) * 100) : 0;
              return ` ${ctx.label}: ${v} (${p.toFixed(1)}%)`;
            }
          }
        },
        InsidePercentLabels: {
          minPercent: 8,  // en gauge mejor ocultar los mini
          fontBase: 12,
        }
      }
    },
    plugins: [InsidePercentLabels],
  });
}

/* =============================
   ✅ BARRAS como porcentaje (sin romper)
   - Muestra % en eje Y
   - Tooltip: cantidad + %
============================= */
function crearGraficoBarrasPorcentaje(id, datasetObj, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const { labels, values, perc, total } = toPercentDataset(datasetObj);

  // Si hay muchos labels, reduce tamaño de fuente para que no se vea mal
  const many = labels.length > 10;

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "% de Gestiones",
        data: perc,
        backgroundColor: colors.azul,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => v + "%",
          }
        },
        x: {
          ticks: {
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
            font: { size: many ? 10 : 12 }
          }
        }
      },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex;
              const cantidad = values[i] ?? 0;
              const p = perc[i] ?? 0;
              return ` ${cantidad} (${p.toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });
}
