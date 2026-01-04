// =============================
// 🌐 CONFIGURACIÓN GLOBAL
// =============================
const GOOGLE_SCRIPT_URL = "https://script.google.com/a/macros/vana.gt/s/AKfycbzT3CxzWImiNNb3mlxEK-09F8l0cBDoS55-H6kEreaJ8O5Dc9KmZiVhNDJb26KVRivD9Q/exec";

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
