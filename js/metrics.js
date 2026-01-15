// =============================
// 📊 LECTURA DE DATOS DESDE EL BACKEND (/api)
// =============================

// Usa la función global obtenerDatosDashboard() definida en data/config.js
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
