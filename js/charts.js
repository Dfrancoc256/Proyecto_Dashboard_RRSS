/* js/charts.js
   ✅ Mejorado:
   - Porcentajes visibles SIEMPRE dentro en PIES/DOUGHNUT
   - Tooltips muestran CANTIDAD + %
   - Para MUCHOS DATOS: agrupa categorías pequeñas en "Otros" y limita slices
   - Barras muestran % (y tooltip con cantidad)
*/

let datosGlobales = [];
let charts = [];

const normalizarTexto = (valor) => String(valor ?? "").trim().toLowerCase();
const obtenerSentimiento = (row) => row.sentimiento ?? row.sentimientos ?? "";

/* =============================
   ✅ AJUSTES ANTI-DESORDEN
   (para cuando haya muchísimos datos/categorías)
============================= */
const CHART_TUNING = {
  pieMaxSlices: 7,        // máximo de porciones visibles (lo demás -> "Otros")
  pieMinPercent: 2,       // por debajo de 2% se manda a "Otros"
  labelInsideMinPercent: 2, // si un slice es muy pequeño, se oculta el texto (evita que se vea mal)
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
   ✅ PLUGIN: % DENTRO (Canvas, no CSS)
============================= */
const percentLabelsPlugin = {
  id: "percentLabelsPlugin",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx } = chart;
    const opts = pluginOptions || {};
    const fontSize = opts.fontSize || 12;
    const fontFamily = opts.fontFamily || "Poppins, sans-serif";
    const minInside = Number.isFinite(opts.minInsidePercent)
      ? opts.minInsidePercent
      : CHART_TUNING.labelInsideMinPercent;

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
        const percentVal = Number(dataset.data?.[index]) || 0;
        if (percentVal <= 0) return;

        // ✅ Si es muy pequeño, NO pintamos el texto (evita que se vea feo/encimado)
        if (isPie && percentVal < minInside) return;

        const text = (percentVal < 1 && percentVal > 0) ? "<1%" : `${percentVal}%`;

        // ===== PIE / DOUGHNUT: SIEMPRE ADENTRO =====
        if (isPie) {
          const props = element.getProps(
            ["x", "y", "startAngle", "endAngle", "outerRadius", "innerRadius"],
            true
          );

          const { x, y, startAngle, endAngle, outerRadius, innerRadius } = props;
          const mid = (startAngle + endAngle) / 2;

          // punto dentro del slice (más al centro)
          const r = innerRadius + (outerRadius - innerRadius) * 0.55;
          const tx = x + Math.cos(mid) * r;
          const ty = y + Math.sin(mid) * r;

          // stroke para legibilidad
          ctx.save();
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.55)";
          ctx.strokeText(text, tx, ty);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, tx, ty);
          ctx.restore();
        }

        // ===== BARRAS: arriba =====
        if (isBar) {
          const pos = element.tooltipPosition?.();
          if (!pos) return;
          const tx = pos.x;
          const ty = pos.y - 12;

          ctx.save();
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.55)";
          ctx.strokeText(text, tx, ty);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, tx, ty);
          ctx.restore();
        }
      });

      ctx.restore();
    });
  },
};

/* =============================
   INIT
============================= */
export async function initCharts() {
  // ✅ registra plugin 1 sola vez
  if (window.Chart && !Chart.registry.plugins.get("percentLabelsPlugin")) {
    Chart.register(percentLabelsPlugin);
  }

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

  const paisCounts = contarPorCampo(data, "pais");
  const medioCounts = contarPorCampo(data, "medio");
  const sentimientoCounts = contarPorSentimiento(data);

  const colors = {
    azul: "#2F66F5",
    celeste: "#54C0F2",
    verde: "#10B981",
    rojo: "#EF4444",
    amarillo: "#F9B233",
    gris: "#A3A3A3",
  };

  const c1 = crearGraficoPiePercent("chartPais", "Distribución por País", paisCounts, [colors.azul, colors.celeste, colors.amarillo, colors.verde, colors.rojo, colors.gris]);
  const c2 = crearGraficoPiePercent("chartMedio", "Distribución por Medio", medioCounts, [colors.azul, colors.celeste, colors.verde, colors.amarillo, colors.rojo, colors.gris]);
  const c3 = crearGraficoPiePercent("chartSentimiento", "Sentimiento del Contacto", sentimientoCounts, [colors.verde, colors.amarillo, colors.celeste, colors.rojo, colors.gris]);
  const c4 = crearGraficoGaugePercent(data, "chartMedidor"); // mantiene estilo, ahora % en tooltip + labels
  const c5 = crearGraficoBarrasPercent("chartCanales", "Distribución de Canales", medioCounts, colors.azul);

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

/* =============================
   ✅ Convertir conteos -> %
   y agrupar en "Otros" para que no se vea feo con muchas categorías
============================= */
function prepararTopConOtros(countsObj, maxSlices = CHART_TUNING.pieMaxSlices, minPercent = CHART_TUNING.pieMinPercent) {
  const entries = Object.entries(countsObj || {})
    .map(([label, count]) => ({ label, count: Number(count) || 0 }))
    .filter(x => x.count > 0);

  const total = entries.reduce((a, b) => a + b.count, 0);
  if (!total) return { labels: [], counts: [], percents: [] };

  // ordenar desc
  entries.sort((a, b) => b.count - a.count);

  const kept = [];
  let otrosCount = 0;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const pct = (e.count / total) * 100;

    const wouldExceed = kept.length >= maxSlices;
    const tooSmall = pct < minPercent;

    if (wouldExceed || tooSmall) otrosCount += e.count;
    else kept.push(e);
  }

  if (otrosCount > 0) kept.push({ label: "Otros", count: otrosCount });

  const labels = kept.map(x => x.label);
  const counts = kept.map(x => x.count);
  const percents = counts.map(c => +(((c / total) * 100).toFixed(0))); // % entero para verse limpio

  // ajuste: si redondeo deja 99/101, corrige el mayor
  const sumPct = percents.reduce((a, b) => a + b, 0);
  if (sumPct !== 100 && percents.length) {
    const idxMax = counts.indexOf(Math.max(...counts));
    percents[idxMax] = percents[idxMax] + (100 - sumPct);
  }

  return { labels, counts, percents };
}

/* =============================
   ✅ PIE/Doughnut en %
   - data = percents
   - tooltip = cantidad + %
   - labels dentro (plugin)
============================= */
function crearGraficoPiePercent(id, titulo, countsObj, colores) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const { labels, counts, percents } = prepararTopConOtros(countsObj);

  // colores suficientes
  const bg = labels.map((_, i) => colores[i % colores.length]);

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: percents,         // ✅ el gráfico representa % (no cantidad)
        _counts: counts,        // ✅ guardamos conteos reales para tooltip
        backgroundColor: bg,
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
            label: (context) => {
              const label = context.label || "";
              const percent = context.parsed ?? 0;
              const c = context.dataset?._counts?.[context.dataIndex] ?? 0;
              return `${label}: ${c} (${percent}%)`;
            }
          }
        },
        // ✅ porcentaje dentro
        percentLabelsPlugin: {
          fontSize: 12,
          minInsidePercent: CHART_TUNING.labelInsideMinPercent,
        }
      },
    },
  });
}

/* =============================
   ✅ BARRAS en %
   - data = percents
   - tooltip = cantidad + %
============================= */
function crearGraficoBarrasPercent(id, titulo, countsObj, colorBar) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const { labels, counts, percents } = prepararTopConOtros(countsObj, 12, 0); // en barras dejamos más items

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "% de Gestiones",
        data: percents,
        _counts: counts,
        backgroundColor: colorBar,
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
            label: (context) => {
              const percent = context.parsed?.y ?? 0;
              const c = context.dataset?._counts?.[context.dataIndex] ?? 0;
              return ` ${c} (${percent}%)`;
            }
          }
        },
        percentLabelsPlugin: {
          fontSize: 12,
        }
      }
    },
  });
}

/* =============================
   ✅ GAUGE (half doughnut)
   - Mantenemos visual
   - Tooltip = cantidad + %
   - Labels dentro (si son >= minInsidePercent)
============================= */
function crearGraficoGaugePercent(data, id) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const positivas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const neutrales = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;
  const negativas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;

  const total = positivas + neutrales + negativas || 1;

  const counts = [positivas, neutrales, negativas];
  const percents = counts.map(c => +(((c / total) * 100).toFixed(0)));
  const sumPct = percents.reduce((a, b) => a + b, 0);
  if (sumPct !== 100) {
    const idxMax = counts.indexOf(Math.max(...counts));
    percents[idxMax] = percents[idxMax] + (100 - sumPct);
  }

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Positivas", "Neutrales", "Negativas"],
      datasets: [{
        data: percents,
        _counts: counts,
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
            label: (context) => {
              const label = context.label || "";
              const percent = context.parsed ?? 0;
              const c = context.dataset?._counts?.[context.dataIndex] ?? 0;
              return `${label}: ${c} (${percent}%)`;
            }
          }
        },
        percentLabelsPlugin: {
          fontSize: 12,
          minInsidePercent: CHART_TUNING.labelInsideMinPercent,
        }
      }
    },
  });
}
