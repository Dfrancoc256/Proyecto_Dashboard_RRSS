let datosGlobales = [];
let charts = [];

export async function initCharts() {
  await cargarDatos();

  const btnAplicarFiltros = document.getElementById("btnAplicarFiltros");
  if (btnAplicarFiltros) {
    btnAplicarFiltros.addEventListener("click", aplicarFiltros);
  }
}

async function cargarDatos() {
  const res = await obtenerDatosDashboard();
  if (res.status === "success" && res.data) {
    datosGlobales = res.data;
    renderDashboard(datosGlobales);
  }
}

// ======== APLICAR FILTROS ========
function aplicarFiltros() {
  const desde = document.getElementById("filterDesde").value;
  const hasta = document.getElementById("filterHasta").value;
  const pais = document.getElementById("filterPais").value.toLowerCase();
  const medio = document.getElementById("filterMedio").value.toLowerCase();
  const sentimiento = document.getElementById("filterSentimiento").value.toLowerCase();

  let filtrados = datosGlobales.filter(item => {
    let valido = true;

    if (desde && new Date(item.time) < new Date(desde)) valido = false;
    if (hasta && new Date(item.time) > new Date(hasta)) valido = false;
    if (pais !== "todos" && (item.pais || "").toLowerCase() !== pais) valido = false;
    if (medio !== "todos" && (item.medio || "").toLowerCase() !== medio) valido = false;
    if (sentimiento !== "todos" && (item.sentimientos || "").toLowerCase() !== sentimiento) valido = false;

    return valido;
  });

  renderDashboard(filtrados);
}

// ======== DASHBOARD ========
function renderDashboard(data) {
  renderMetrics(data);
  renderCharts(data);
  renderResumen(data);
}

// ======== MÉTRICAS ========
function renderMetrics(data) {
  const total = data.length;
  const positivas = data.filter(d => (d.sentimientos || "").toLowerCase() === "positivo").length;
  const negativas = data.filter(d => (d.sentimientos || "").toLowerCase() === "negativo").length;
  const neutrales = data.filter(d => (d.sentimientos || "").toLowerCase() === "neutral").length;

  const positivasPct = total ? ((positivas / total) * 100).toFixed(1) : 0;
  const negativasPct = total ? ((negativas / total) * 100).toFixed(1) : 0;
  const neutralesPct = total ? ((neutrales / total) * 100).toFixed(1) : 0;

  document.getElementById("metricTotal").textContent = total;
  document.getElementById("metricPositivas").textContent = `${positivasPct}%`;
  document.getElementById("metricNegativas").textContent = `${negativasPct}%`;
  document.getElementById("metricNeutrales").textContent = `${neutralesPct}%`;
}

// ======== RESUMEN ========
function renderResumen(data) {
  const resumen = document.getElementById("summary");
  resumen.innerHTML = `Cargando resumen de gestiones...`;

  if (!data.length) {
    resumen.textContent = "No hay datos disponibles en el rango seleccionado.";
    return;
  }

  const paises = contarPorCampo(data, "pais");
  const totalPaises = Object.keys(paises).length;

  resumen.innerHTML = `
    <b>${data.length}</b> gestiones registradas en <b>${totalPaises}</b> países.
  `;
}

// ======== GRÁFICOS ========
function renderCharts(data) {
  charts.forEach(chart => chart.destroy());
  charts = [];

  const pais = contarPorCampo(data, "pais");
  const medio = contarPorCampo(data, "medio");
  const sentimiento = contarPorCampo(data, "sentimientos");

  const colors = {
    azul: "#2F66F5",
    celeste: "#54C0F2",
    verde: "#10B981",
    rojo: "#EF4444",
    gris: "#A3A3A3",
    amarillo: "#F9B233",
  };

  charts.push(crearGraficoPie("chartPais", pais, [colors.azul, colors.celeste, colors.amarillo]));
  charts.push(crearGraficoPie("chartMedio", medio, [colors.azul, colors.celeste, colors.verde, colors.amarillo]));
  charts.push(crearGraficoPie("chartSentimiento", sentimiento, [colors.verde, colors.amarillo, colors.rojo]));
  charts.push(crearGraficoGauge(data, "chartMedidor"));
  charts.push(crearGraficoBarras("chartCanales", medio, colors));
}

// ======== UTILIDADES ========
function contarPorCampo(data, campo) {
  const conteo = {};
  data.forEach(row => {
    const valor = row[campo] || "Sin dato";
    conteo[valor] = (conteo[valor] || 0) + 1;
  });
  return conteo;
}

// PIE
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
      animation: { duration: 900, easing: "easeOutQuart" },
    },
  });
}

// BARRAS
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

// GAUGE
function crearGraficoGauge(data, id) {
  const ctx = document.getElementById(id);
  if (!ctx) return;

  const positivas = data.filter(d => (d.sentimientos || "").toLowerCase() === "positivo").length;
  const neutrales = data.filter(d => (d.sentimientos || "").toLowerCase() === "neutral").length;
  const negativas = data.filter(d => (d.sentimientos || "").toLowerCase() === "negativo").length;

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Positivas", "Neutrales", "Negativas"],
      datasets: [{
        data: [positivas, neutrales, negativas],
        backgroundColor: ["#10B981", "#A3A3A3", "#EF4444"],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }],
    },
    options: { cutout: "70%", plugins: { legend: { display: false } } },
  });
}
