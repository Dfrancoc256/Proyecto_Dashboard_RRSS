// js/form.js
let submitBound = false;
let comboCloserBound = false;

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

function normalizar(v) { return String(v ?? "").trim().toLowerCase(); }
function esOtro(v) { const t = normalizar(v); return t === "otro" || t === "other"; }

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

function bindComboCloserOnce() {
  if (comboCloserBound) return;
  comboCloserBound = true;

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".combo")) {
      document.querySelectorAll(".combo .combo-list").forEach(list => {
        list.style.display = "none";
      });
    }
  });
}

function initCombo(combo) {
  if (!combo || combo.dataset.inited === "1") return;
  combo.dataset.inited = "1";

  const input = combo.querySelector(".combo-input");
  const btn = combo.querySelector(".combo-btn");
  const list = combo.querySelector(".combo-list");
  const items = Array.from(list?.querySelectorAll("li") || []);

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
}

function setDefaultEmailAgente() {
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

  bindComboCloserOnce();
  setDefaultEmailAgente();
  document.querySelectorAll(".combo").forEach(initCombo);
  setupOtros();
}

async function onSubmit(e) {
  if (!e.target || e.target.id !== "gestionForm") return;

  e.preventDefault();
  const form = e.target;

  if (!validarSentimiento(form)) return;

  document.querySelectorAll(".combo").forEach(combo => {
    const name = combo.getAttribute("data-name");
    const val = combo.querySelector(".combo-input")?.value || "";
    setHidden(form, name, val);
  });

  const fd = new FormData(form);

  const pais = String(fd.get("pais") || "").trim();
  const medio = String(fd.get("medio") || "").trim();
  const razon = String(fd.get("razon") || "").trim();
  const ticket = String(fd.get("ticket") || "").trim();

  const paisFinal = esOtro(pais) ? (String(fd.get("pais_otro") || "").trim() || "Otro") : pais;
  const medioFinal = esOtro(medio) ? (String(fd.get("medio_otro") || "").trim() || "Otro") : medio;
  const razonFinal = esOtro(razon) ? (String(fd.get("razon_otro") || "").trim() || "Otro") : razon;
  const ticketFinal = esOtro(ticket) ? (String(fd.get("ticket_otro") || "").trim() || "Otro") : ticket;

  const emailActual = String(fd.get("email") || "").trim();
  if (!emailActual) {
    alert("⚠️ El correo del agente (Email) es obligatorio.");
    (document.getElementById("emailAgente") || form.querySelector('input[name="email"]'))?.focus();
    return;
  }

  const payload = {
    "Pais": paisFinal,
    "Medio": medioFinal,
    "Razon de contacto": razonFinal,
    "¿Necesitó ticket?": ticketFinal,
    "Comentario cliente": String(fd.get("comentario_cliente") || "").trim(),
    "Link ticket": String(fd.get("link_ticket") || "").trim(),
    "Email": emailActual,
    "Notas": String(fd.get("notas") || "").trim(),
    "Sentimientos": String(fd.get("sentimiento") || "").trim(),
  };

  try {
    const response = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ object: payload }),
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok && result.ok === true) {
      alert("✅ Gestión guardada correctamente");
      form.reset();
      setDefaultEmailAgente();
      prepararForm();
    } else {
      alert("⚠️ Error: " + (result.message || result.error || "No se pudo guardar"));
    }
  } catch (err) {
    alert("❌ Error al guardar: " + err.message);
  }
}

export function initForm() {
  prepararForm();
  if (!submitBound) {
    submitBound = true;
    document.addEventListener("submit", onSubmit);
  }
}
