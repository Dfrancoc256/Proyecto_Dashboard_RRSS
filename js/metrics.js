// js/metrics.js


function normalizarTexto(v) {
  return String(v ?? "").trim().toLowerCase();
}

function obtenerSentimiento(row) {
  return row?.sentimiento ?? row?.sentimientos ?? "";
}

async function obtenerDatosDesdeBackend() {
  try {
    const json = await obtenerDatosDashboard();

    if (json?.status === "success") {
      const lista = json?.data?.data ?? json?.data ?? [];
      return Array.isArray(lista) ? lista : [];
    }

    console.warn("⚠️ Respuesta inesperada del backend:", json);
    return [];
  } catch (err) {
    console.error("❌ Error al leer datos desde backend:", err);
    return [];
  }
}

function contarSentimientos(data) {
  let pos = 0, neg = 0, neu = 0;

  data.forEach(d => {
    const s = normalizarTexto(obtenerSentimiento(d));
    if (s === "positivo") pos++;
    else if (s === "negativo") neg++;
    else if (s === "neutral") neu++;
  });

  const total = data.length || 0;

  return {
    total,
    positivas: pos,
    negativas: neg,
    neutrales: neu,
    pctPositivas: total ? ((pos / total) * 100).toFixed(1) : "0.0",
    pctNegativas: total ? ((neg / total) * 100).toFixed(1) : "0.0",
    pctNeutrales: total ? ((neu / total) * 100).toFixed(1) : "0.0",
  };
}

export { obtenerDatosDesdeBackend, contarSentimientos };
