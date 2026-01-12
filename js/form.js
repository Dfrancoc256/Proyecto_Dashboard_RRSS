// form.js (módulo cargado desde sidebar.js)
// ✅ Guardar por API /api/responses (JSON)

function getUsuarioCorreo() {
  try {
    const raw = localStorage.getItem("usuarioActivo");
    if (!raw) return "";

    if (raw.includes("{")) {
      const obj = JSON.parse(raw);
      return obj?.correo || obj?.email || obj?.usuario?.correo || "";
    }
    return raw;
  } catch {
    return "";
  }
}

function normalizar(v) {
  return String(v ?? "").trim().toLowerCase();
}

function esOtro(v) {
  const t = normalizar(v);
  return t === "otro" || t === "other";
}

// ✅ crea/actualiza input hidden para enviar name=...
function setHidden(form, name, value) {
  let inp = form.querySelector(`input[type="hidden"][name="${name}"]`);
  if (!inp) {
    inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = name;
    form.appendChild(inp);
  }
  inp.value = value || "";
}

// ✅ Combobox: dropdown + filtro por escritura
function initCombo(combo) {
  const input = combo.querySelector(".combo-input");
  const btn = combo.querySelector(".combo-btn");
  const list = combo.querySelector(".combo-list");
  const items = Array.from(list.querySelectorAll("li"));

  if (!input || !btn || !list) return;

  const open = () => { list.style.display = "block"; };
  const close = () => { list.style.display = "none"; };

  btn.addEventListener("click", () => {
    if (list.style.display === "block") close();
    else open();
    input.focus();
  });

  input.addEventListener("focus", open);

  input.addEventListener("input", () => {
    const q = normalizar(input.value);
    items.forEach(li => {
      const show = normalizar(li.textContent).includes(q);
      li.style.display = show ? "block" : "none";
    });
    open();
  });

  items.forEach(li => {
    li.addEventListener("click", () => {
      input.value = li.textContent.trim();
      close();
      input.dispatchEvent(new Event("change"));
    });
  });

  document.addEventListener("click", (e) => {
    if (!combo.contains(e.target)) close();
  });
}

function setDefaultEmailAgente() {
  // ✅ Email del agente se guarda en el campo email
  const email = document.getElementById("emailAgente") || document.querySelector('input[name="email"]');
  if (!email) return;

  const correo = getUsuarioCorreo();
  if (correo && !email.value) email.value = correo;
}

function validarSentimiento(form) {
  const sel = form.querySelector("#sentimiento");
  if (!sel) return true;

  if (!sel.value || sel.value.trim() === "") {
    alert("⚠️ Debes seleccionar un sentimiento (obligatorio).");
    sel.focus();
    return false;
  }
  return true;
}

// ✅ Muestra/Oculta inputs "Otro" según lo elegido en combos
function setupOtros() {
  const map = [
    { name: "pais", wrap: "paisOtroWrap", other: "paisOtro" },
    { name: "medio", wrap: "medioOtroWrap", other: "medioOtro" },
    { name: "razon", wrap: "razonOtroWrap", other: "razonOtro" },
    { name: "ticket", wrap: "ticketOtroWrap", other: "ticketOtro" },
  ];

  map.forEach(cfg => {
    const combo = document.querySelector(`.combo[data-name="${cfg.name}"]`);
    if (!combo) return;

    const input = combo.querySelector(".combo-input");
    const wrap = document.getElementById(cfg.wrap);
    const otherInput = document.getElementById(cfg.other);

    if (!input || !wrap || !otherInput) return;

    const toggle = () => {
      if (esOtro(input.value)) {
        wrap.style.display = "block";
        otherInput.required = true;
        otherInput.focus();
      } else {
        wrap.style.display = "none";
        otherInput.required = false;
        otherInput.value = "";
      }
    };

    input.addEventListener("change", toggle);
    input.addEventListener("input", toggle);
    toggle();
  });
}

function prepararForm() {
  const form = document.getElementById("gestionForm");
  if (!form) return;

  setDefaultEmailAgente();

  // init combos
  document.querySelectorAll(".combo").forEach(initCombo);

  // setup "Otro"
  setupOtros();
}

// Se prepara cuando el módulo se importa (porque sidebar lo carga dinámico)
prepararForm();

// ✅ SUBMIT
document.addEventListener("submit", async (e) => {
  if (!e.target || e.target.id !== "gestionForm") return;

  e.preventDefault();
  const form = e.target;

  if (!validarSentimiento(form)) return;

  // ✅ tomar valores de combos y guardarlos en hidden inputs
  document.querySelectorAll(".combo").forEach(combo => {
    const name = combo.getAttribute("data-name");
    const val = combo.querySelector(".combo-input")?.value || "";
    setHidden(form, name, val);
  });

  const formData = new FormData(form);

  // ✅ Si es "Otro", reemplazar por el texto escrito
  const pais = formData.get("pais");
  const medio = formData.get("medio");
  const razon = formData.get("razon");
  const ticket = formData.get("ticket");

  if (esOtro(pais)) formData.set("pais", String(formData.get("pais_otro") || "").trim() || "Otro");
  if (esOtro(medio)) formData.set("medio", String(formData.get("medio_otro") || "").trim() || "Otro");
  if (esOtro(razon)) formData.set("razon", String(formData.get("razon_otro") || "").trim() || "Otro");
  if (esOtro(ticket)) formData.set("ticket", String(formData.get("ticket_otro") || "").trim() || "Otro");

  // ✅ Email del agente obligatorio
  const emailActual = String(formData.get("email") || "").trim();
  if (!emailActual) {
    alert("⚠️ El correo del agente (Email) es obligatorio.");
    const emailInput = document.getElementById("emailAgente") || form.querySelector('input[name="email"]');
    if (emailInput) emailInput.focus();
    return;
  }

  // ✅ Convertir FormData a objeto (para enviar JSON al backend)
  const obj = {};
  for (const [k, v] of formData.entries()) obj[k] = v;

  try {
    const response = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ object: obj }),
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok && result.ok === true) {
      alert("✅ Gestión guardada correctamente");
      form.reset();

      // Re-poner email del agente y rearmar combos/otros
      setDefaultEmailAgente();
      prepararForm();
    } else {
      alert("⚠️ Error: " + (result.message || result.error || "No se pudo guardar"));
    }
  } catch (err) {
    alert("❌ Error al guardar: " + err.message);
  }
});
