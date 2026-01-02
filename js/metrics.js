// =============================
// 📊 LECTURA DE DATOS DESDE GOOGLE SHEETS
// =============================

// Usa directamente la constante global GOOGLE_SCRIPT_URL desde config.js
async function obtenerDatosDesdeSheets() {
  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get`);

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.status !== "success" || !json.data) {
      console.warn("⚠️ Respuesta inesperada de Google Script:", json);
      return [];
    }

    return json.data;
  } catch (err) {
    console.error("❌ Error al leer datos de Sheets:", err);
    return [];
  }
}
