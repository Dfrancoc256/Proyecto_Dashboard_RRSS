// form.js (módulo cargado desde sidebar.js)
// ✅ Guarda usando FormData para evitar CORS/preflight

document.addEventListener("submit", async (e) => {
  // ✅ Solo aplica al formulario correcto
  if (!e.target || e.target.id !== "gestionForm") return;

  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: formData, // ✅ sin headers => sin preflight
    });

    const result = await response.json();

    if (result.status === "success") {
      alert("✅ Gestión guardada correctamente en Google Sheets");
      form.reset();
    } else {
      alert("⚠️ Error: " + result.message);
    }
  } catch (err) {
    alert("❌ Error al guardar: " + err.message);
  }
});
