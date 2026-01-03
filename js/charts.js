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
   INIT
============================= */
export async function initCharts() {
  await cargarDatos();

  const btnAplicarFiltros = document.getElementById("btnAplicarFiltros");
  if (btnAplicarFiltros) {
    btnAplicarFiltros.addEventListener("click", aplicarFiltros);
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

  // Si ya es Date
  if (valor instanceof Date) return valor;

  const s = String(valor).trim();

  // Intento ISO / formatos que el navegador soporte
  const isoTry = new Date(s);
  if (!isNaN(isoTry)) return isoTry;

  // dd/mm/yyyy o dd/mm/yyyy hh:mm:ss (asumimos dd/mm por tu región)
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
   FILTROS
============================= */
function aplicarFiltros() {
  const desde = document.getElementById("filterDesde").value;
  const hasta = document.getElementById("filterHasta").value;
  const pais = normalizarTexto(document.getElementById("filterPais").value);
  const medio = normalizarTexto(document.getElementById("filterMedio").value);
  const sentimiento = normalizarTexto(document.getElementById("filterSentimiento").value);

  const dDesde = desde ? inicioDelDia(desde) : null;
  const dHasta = hasta ? finDelDia(hasta) : null;

  const filtrados = datosGlobales.filter(item => {
    let valido = true;

    // ✅ Fecha del item (viene de Sheets)
    const dItem = parseFechaSheets(item.time);

    // Si el usuario está filtrando por fecha y no se pudo leer la fecha del registro -> descartar
    if ((dDesde || dHasta) && !dItem) valido = false;

    // ✅ Comparación correcta por rango
    if (dDesde && dItem && dItem < dDesde) valido = false;
    if (dHasta && dItem && dItem > dHasta) valido = false;

    // Otros filtros
    if (pais !== "todos" && normalizarTexto(item.pais) !== pais) valido = false;
    if (medio !== "todos" && normalizarTexto(item.medio) !== medio) valido = false;
    if (sentimiento !== "todos" && normalizarTexto(obtenerSentimiento(item)) !== sentimiento) valido = false;

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

  document.getElementById("metricTotal").textContent = total;
  document.getElementById("metricPositivas").textContent = total ? ((positivas / total) * 100).toFixed(1) + "%" : "0%";
  document.getElementById("metricNegativas").textContent = total ? ((negativas / total) * 100).toFixed(1) + "%" : "0%";
  document.getElementById("metricNeutrales").textContent = total ? ((neutrales / total) * 100).toFixed(1) + "%" : "0%";
}

/* =============================
   RESUMEN
============================= */
function renderResumen(data) {
  const resumen = document.getElementById("summary");

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
  charts.forEach(c => c.destroy());
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

  charts.push(crearGraficoPie("chartPais", pais, [colors.azul, colors.celeste, colors.amarillo]));
  charts.push(crearGraficoPie("chartMedio", medio, [colors.azul, colors.celeste, colors.verde, colors.amarillo]));
  charts.push(crearGraficoPieSentimiento("chartSentimiento", sentimiento, colors));
  charts.push(crearGraficoGauge(data, "chartMedidor"));
  charts.push(crearGraficoBarras("chartCanales", medio, colors));
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
    const valor = String(obtenerSentimiento(row) ?? "Sin dato").trim() || "Sin dato";
    conteo[valor] = (conteo[valor] || 0) + 1;
  });
  return conteo;
}

/* =============================
   PIE GENÉRICO
============================= */
function crearGraficoPie(id, dataset, colores) {
  const ctx = document.getElementById(id);
  if (!ctx) return;

  return new Chart(ctx, {
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
      plugins: { legend: { position: "bottom" } },
    },
  });
}

/* =============================
   PIE SENTIMIENTO (CORREGIDO)
============================= */
function crearGraficoPieSentimiento(id, dataset, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return;

  const labels = Object.keys(dataset);
  const values = Object.values(dataset);

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
      plugins: { legend: { position: "bottom" } },
    },
  });
}

/* =============================
   BARRAS
============================= */
function crearGraficoBarras(id, dataset, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return;

  return new Chart(ctx, {
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
      scales: { y: { beginAtZero: true } },
    },
  });
}

/* =============================
   GAUGE
============================= */
function crearGraficoGauge(data, id) {
  const ctx = document.getElementById(id);
  if (!ctx) return;

  const positivas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "positivo").length;
  const neutrales = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "neutral").length;
  const negativas = data.filter(d => normalizarTexto(obtenerSentimiento(d)) === "negativo").length;

  return new Chart(ctx, {
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
    options: { cutout: "70%", plugins: { legend: { display: false } } },
  });
}
