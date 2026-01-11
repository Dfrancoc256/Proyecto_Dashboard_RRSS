// =============================
// 🌐 CONFIGURACIÓN GLOBAL
// =============================
// Base de la API (pasa por Nginx). No pongas dominio ni puerto.
const API_BASE = "/api";

// =============================
// 🔐 LOGIN
// =============================
async function realizarLogin(correo, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // IMPORTANTE: para cookies JWT después (no estorba ahora)
    credentials: "include",
    body: JSON.stringify({ correo, password }),
  });

  // Intentamos leer JSON siempre
  const data = await res.json().catch(() => ({}));

  // Si el backend aún devuelve {ok:true}, aquí lo normalizamos al formato del frontend
  if (data.status) return data;

  if (res.ok && data.ok === true) {
    return { status: "success", usuario: { correo } };
  }

  return { status: "error", message: "Credenciales incorrectas." };
}

// =============================
// 📊 OBTENER DATOS
// =============================
async function obtenerDatosDashboard() {
  const res = await fetch(`${API_BASE}/responses`, {
    method: "GET",
    credentials: "include",
  });

  const raw = await res.json().catch(() => ({}));

  // Tu backend devuelve: { headers: [...], rows: [[...],[...]] }
  const headers = raw.headers || [];
  const rows = raw.rows || [];

  const data = rows.map((r) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = r[i]));
    return obj;
  });

  // Mantengo el formato que tu charts.js espera:
  // res.status === "success" y res.data.data (o res.data)
  return { status: "success", data: { data } };
}

// =============================
// 💾 GUARDAR GESTIÓN
// =============================
async function guardarGestion(gestionData) {
  const res = await fetch(`${API_BASE}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ object: gestionData }),
  });

  const data = await res.json().catch(() => ({}));
  if (data.status) return data;
  return res.ok ? { status: "success" } : { status: "error", message: "No se pudo guardar." };
}
