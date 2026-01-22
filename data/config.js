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
    credentials: "include",
    body: JSON.stringify({ correo, password }),
  });

  const data = await res.json().catch(() => ({}));

  // Si ya viene en formato {status:...} lo respetamos
  if (data.status) return data;

  // Backend actual: {ok:true}
  if (res.ok && data.ok === true) {
    return { status: "success", usuario: { correo } };
  }

  return { status: "error", message: "Credenciales incorrectas." };
}

// =============================
// ✅ NORMALIZAR HEADERS DE SHEETS
// =============================
function normalizarKey(h) {
  const k = String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[¿?¡!]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // 🔑 Llaves que usa tu frontend (charts.js)
  if (k === "pais") return "pais";
  if (k === "medio") return "medio";
  if (k === "sentimiento" || k === "sentimientos") return "sentimientos";
  if (k === "time" || k === "fecha" || k === "fecha hora" || k === "fecha_hora") return "time";

  // Campos típicos del form
  if (k === "razon" || k === "razon de contacto") return "razon";
  if (k === "ticket" || k === "necesito ticket") return "ticket";
  if (k === "comentario cliente" || k === "comentario_del_cliente") return "comentario_cliente";
  if (k === "link ticket" || k === "link_del_ticket") return "link_ticket";
  if (k === "email" || k === "correo") return "email";
  if (k === "notas") return "notas";

  // fallback: snake_case simple
  return k.replace(/\s+/g, "_");
}

// =============================
// 📊 OBTENER DATOS
// =============================
async function obtenerDatosDashboard() {
  const res = await fetch(`${API_BASE}/responses`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const raw = await res.json().catch(() => ({}));

  // Backend devuelve: { headers:[...], rows:[[...],[...]] }
  const headers = raw.headers || [];
  const rows = raw.rows || [];

  const keys = headers.map(normalizarKey);

  // ✅ rows -> objetos con llaves normalizadas + sin filas vacías
  const data = rows
    .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""))
    .map((r) => {
      const obj = {};
      keys.forEach((k, i) => (obj[k] = r[i] ?? ""));
      return obj;
    });

  // ✅ Mantener formato esperado por tu charts.js:
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

  return res.ok
    ? { status: "success" }
    : { status: "error", message: "No se pudo guardar." };
}
