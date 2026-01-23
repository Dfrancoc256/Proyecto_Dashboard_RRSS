/* js/sidebar.js */

loadPage("home");
setActiveButton("home");

document.querySelectorAll(".sidebar button").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (!page) return;

    setActiveButton(page);
    loadPage(page);
  });
});

function setActiveButton(page) {
  document.querySelectorAll(".sidebar button").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`.sidebar button[data-page="${page}"]`);
  if (btn) btn.classList.add("active");
}

async function loadPage(page) {
  try {
    const res = await fetch(`pages/${page}.html`, { cache: "no-store" });
    const html = await res.text();
    document.getElementById("content").innerHTML = html;

    if (page === "home") {
      const m = await import("./charts.js");
      await m.initCharts();
    } else if (page === "form") {
      const m = await import("./form.js");
      m.initForm(); // ✅ reinit combos
    } else if (page === "comentarios") {
      const m = await import("./comentarios.js");
      await m.initComentarios();
    }
  } catch (err) {
    console.error("Error al cargar la página:", err);
  }
}
