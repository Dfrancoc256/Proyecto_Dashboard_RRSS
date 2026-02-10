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
function esSi(v) { const t = normalizar(v); return t === "sí" || t === "si"; }

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

/**
 * ✅ initCombo:
 * - Flechas ↑↓ para navegar
 * - Enter para seleccionar
 * - Escribir SOLO filtra (no guarda)
 * - Si no selecciona una opción válida, revierte al último valor válido
 */
function initCombo(combo) {
  if (!combo || combo.dataset.inited === "1") return;
  combo.dataset.inited = "1";

  const input = combo.querySelector(".combo-input");
  const btn = combo.querySelector(".combo-btn");
  const list = combo.querySelector(".combo-list");
  const items = Array.from(list?.querySelectorAll("li") || []);

  if (!input || !btn || !list) return;

  // ✅ Valor válido (solo cambia cuando se selecciona una opción real)
  let lastValid = (input.value || "").trim();
  let activeIndex = -1;

  const open = () => { list.style.display = "block"; };
  const close = () => { list.style.display = "none"; clearActive(); };

  function visibleItems() {
    return items.filter(li => li.style.display !== "none");
  }

  function clearActive() {
    items.forEach(li => li.classList.remove("active"));
    activeIndex = -1;
  }

  function setActive(i) {
    const vis = visibleItems();
    clearActive();
    if (!vis.length) return;

    activeIndex = Math.max(0, Math.min(i, vis.length - 1));
    vis[activeIndex].classList.add("active");
    vis[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function filter() {
    const q = normalizar(input.value);
    items.forEach(li => {
      const show = normalizar(li.textContent).includes(q);
      li.style.display = show ? "block" : "none";
    });
    open();
    const vis = visibleItems();
    if (vis.length) setActive(0);
    else clearActive();
  }

  function findExact() {
    const t = normalizar(input.value);
    return items.find(li => normalizar(li.textContent) === t);
  }

  function selectValue(value) {
    input.value = value;
    lastValid = value; // ✅ solo aquí se “guarda”
    close();
    input.dispatchEvent(new Event("change"));
  }

  // ---- botón ▾ ----
  btn.addEventListener("click", () => {
    if (list.style.display === "block") close();
    else {
      items.forEach(li => li.style.display = "block");
      open();
      const vis = visibleItems();
      if (vis.length) setActive(0);
    }
    input.focus();
  });

  // ---- focus ----
  input.addEventListener("focus", () => {
    items.forEach(li => li.style.display = "block");
    open();
    const vis = visibleItems();
    if (vis.length) setActive(0);
  });

  // ---- escribir SOLO filtra (NO guarda) ----
  input.addEventListener("input", () => {
    filter();
  });

  // ---- click en opción ----
  items.forEach(li => {
    li.addEventListener("mousedown", (e) => {
      e.preventDefault(); // evita perder foco antes de seleccionar
      selectValue(li.textContent.trim());
    });
  });

  // ---- teclado: flechas + enter ----
  input.addEventListener("keydown", (e) => {
    const vis = visibleItems();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (list.style.display !== "block") open();
      if (!vis.length) return;
      if (activeIndex < 0) setActive(0);
      else setActive(activeIndex + 1);
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (list.style.display !== "block") open();
      if (!vis.length) return;
      if (activeIndex < 0) setActive(0);
      else setActive(activeIndex - 1);
    }

    if (e.key === "Enter") {
      e.preventDefault();

      // Enter selecciona opción activa o exacta
      if (list.style.display === "block" && vis.length && activeIndex >= 0) {
        selectValue(vis[activeIndex].textContent.trim());
      } else {
        const exact = findExact();
        if (exact) selectValue(exact.textContent.trim());
        else input.value = lastValid; // ✅ no guardar lo escrito
      }
    }

    if (e.key === "Escape") {
      e.preventDefault();
      input.value = lastValid; // ✅ revierte
      close();
    }

    if (e.key === "Tab") {
      // al salir: si lo escrito no es opción válida, revertir
      const exact = findExact();
      if (!exact) input.value = lastValid;
      close();
    }
  });

  // ---- blur: si lo escrito no es opción válida, revertir ----
  input.addEventListener("blur", () => {
    setTimeout(() => {
      const exact = findExact();
      if (!exact) input.value = lastValid; // ✅ no guardar lo escrito
      close();
    }, 120);
  });

  // Oculta lista por defecto
  list.style.display = "none";
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
    { name: "producto", wrap: "productoOtroWrap", other: "productoOtro" },
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

function setupProductoDefault() {
  const prod = document.querySelector('.combo[data-name="producto"] .combo-input');
  if (!prod) return;
  if (!prod.value || !prod.value.trim()) prod.value = "Presta";
}

function setupTicketDetalles() {
  const combo = document.querySelector('.combo[data-name="ticket"]');
  const input = combo?.querySelector(".combo-input");
  const wrap = document.getElementById("ticketDetallesWrap");
  if (!input || !wrap) return;

  const link = document.querySelector('input[name="link_ticket"]');
  const notas = document.querySelector('textarea[name="notas"]');

  const toggle = () => {
    const show = esSi(input.value);
    wrap.style.display = show ? "block" : "none";

    // Limpia campos si no se requiere ticket
    if (!show) {
      if (link) link.value = "";
      if (notas) notas.value = "";
    }
  };

  input.addEventListener("change", toggle);
  input.addEventListener("input", toggle);
  toggle();
}

function prepararForm() {
  const form = document.getElementById("gestionForm");
  if (!form) return;

  bindComboCloserOnce();
  document.querySelectorAll(".combo").forEach(initCombo);

  setupProductoDefault();
  setupOtros();
  setupTicketDetalles();
}

async function onSubmit(e) {
  if (!e.target || e.target.id !== "gestionForm") return;

  e.preventDefault();
  const form = e.target;

  if (!validarSentimiento(form)) return;

  // ✅ fuerza blur para validar combos antes de leer valores (no guardar lo escrito)
  document.activeElement?.blur?.();

  // ✅ Botón: loading + bloqueo (mejor UX)
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.textContent : "";
  const t0 = performance.now();

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");
    submitBtn.textContent = "Guardando gestión...";
  }

  // Convierte combos a hidden inputs (para FormData)
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

  let producto = String(fd.get("producto") || "").trim();
  if (!producto) producto = "Presta"; // default seguro al enviar

  const paisFinal = esOtro(pais) ? (String(fd.get("pais_otro") || "").trim() || "Otro") : pais;
  const medioFinal = esOtro(medio) ? (String(fd.get("medio_otro") || "").trim() || "Otro") : medio;
  const razonFinal = esOtro(razon) ? (String(fd.get("razon_otro") || "").trim() || "Otro") : razon;
  const ticketFinal = esOtro(ticket) ? (String(fd.get("ticket_otro") || "").trim() || "Otro") : ticket;

  // Validación producto "Otro"
  if (esOtro(producto)) {
    const escrito = String(fd.get("producto_otro") || "").trim();
    if (!escrito) {
      alert("⚠️ Debes especificar el producto cuando seleccionas 'Otro'.");
      document.getElementById("productoOtro")?.focus();
      return;
    }
  }

  const productoFinal = esOtro(producto)
    ? (String(fd.get("producto_otro") || "").trim() || "Otro")
    : (producto || "Presta");

  // Correo del agente desde sesión (sidebar)
  const emailActual = String(getUsuarioCorreo() || "").trim();
  if (!emailActual) {
    alert("⚠️ No se encontró el correo del agente en sesión (usuarioActivo).");
    return;
  }

  // Si NO selecciona "Sí", por seguridad mandamos vacío
  const enviarDetalles = esSi(ticketFinal);
  const linkTicket = enviarDetalles ? String(fd.get("link_ticket") || "").trim() : "";
  const notas = enviarDetalles ? String(fd.get("notas") || "").trim() : "";

  // Validación ticket si es "Sí" (al menos link o nota)
  if (enviarDetalles && !linkTicket && !notas) {
    alert("⚠️ Si seleccionas 'Sí', ingresa el link del ticket o una nota.");
    (document.querySelector('input[name="link_ticket"]') || document.querySelector('textarea[name="notas"]'))?.focus();
    return;
  }

  const payload = {
    "Pais": paisFinal,
    "Medio": medioFinal,
    "Producto": productoFinal,
    "Razon de contacto": razonFinal,
    "¿Necesitó ticket?": ticketFinal,
    "Comentario cliente": String(fd.get("comentario_cliente") || "").trim(),
    "Link ticket": linkTicket,
    "Email": emailActual,
    "Notas": notas,
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
      const ms = Math.round(performance.now() - t0);
      alert(`✅ Gestión guardada correctamente (${ms} ms)`);

      form.reset();
      prepararForm();
      setupProductoDefault();
    } else {
      alert("⚠️ Error: " + (result.message || result.error || "No se pudo guardar"));
    }
  } catch (err) {
    alert("❌ Error al guardar: " + err.message);
  } finally {
    // ✅ Restituye botón sí o sí
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
      submitBtn.textContent = originalBtnText;
    }
  }
}

export function initForm() {
  prepararForm();
  if (!submitBound) {
    submitBound = true;
    document.addEventListener("submit", onSubmit);
  }
}
