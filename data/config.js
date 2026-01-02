// =============================
// 🌐 CONFIGURACIÓN GLOBAL
// =============================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxmqBotfgEFuh5EH5A97SKpqsi9v5nNYjkpi2d8v42xM_hjw4XImRcP5BSCMVL_lz6Bxg/exec";

// =============================
// 🔐 LOGIN
// =============================
async function realizarLogin(correo, password) {
  const url = `${GOOGLE_SCRIPT_URL}?action=login&correo=${encodeURIComponent(correo)}&password=${encodeURIComponent(password)}`;
  const res = await fetch(url);
  return await res.json();
}

// =============================
// 📊 OBTENER DATOS
// =============================
async function obtenerDatosDashboard() {
  const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=get`);
  return await res.json();
}

// =============================
// 💾 GUARDAR GESTIÓN
// =============================
async function guardarGestion(gestionData) {
  const res = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gestionData),
  });
  return await res.json();
}
