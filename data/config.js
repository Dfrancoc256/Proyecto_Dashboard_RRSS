// =============================
// 🌐 CONFIGURACIÓN GLOBAL
// =============================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxyzseoP2EnZ1YLXtRf7iGvzFpH1krvdrZp12smi3C3ebFiLCdjRUliU2L9mF7tly6-tg/exec";

// =============================
// 🔐 LOGIN
// =============================
async function realizarLogin(correo, password) {
  const url = `${GOOGLE_SCRIPT_URL}?action=login&correo=${encodeURIComponent(
    correo
  )}&password=${encodeURIComponent(password)}`;
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
// 💾 GUARDAR GESTIÓN (SIN JSON, SIN CORS)
// =============================
async function guardarGestion(gestionData) {
  const formBody = new URLSearchParams();
  Object.entries(gestionData).forEach(([k, v]) => formBody.append(k, v ?? ""));

  const res = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: formBody, // 👈 sin headers => sin preflight
  });

  return await res.json();
}
