document.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    pais: e.target.pais.value,
    medio: e.target.medio.value,
    razondecontacto: e.target.razon.value,
    necesitoticket: e.target.ticket.value,
    comentariocliente: e.target.comentario_cliente.value,
    linkticket: e.target.link_ticket.value,
    email: e.target.email.value,
    notas: e.target.notas.value,
    sentimientos: e.target.sentimiento.value,
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.status === "success") {
      alert("✅ Gestión guardada correctamente en Google Sheets");
      e.target.reset();
    } else {
      alert("⚠️ Error: " + result.message);
    }

  } catch (err) {
    alert("❌ Error al guardar: " + err.message);
  }
});
