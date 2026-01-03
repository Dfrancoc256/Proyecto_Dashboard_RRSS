/* sidebar.js */

loadPage("home");
setActiveButton("home");

document.querySelectorAll(".sidebar button").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;

    // ✅ Si no tiene data-page (ej: Cerrar sesión), no intenta cargar nada
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

function loadPage(page) {
  fetch(`pages/${page}.html`)
    .then(res => res.text())
    .then(html => {
      document.getElementById("content").innerHTML = html;

      if (page === "home") {
        import("./charts.js").then(module => module.initCharts());
      } else if (page === "form") {
        import("./form.js"); // ✅ NO rompe dashboard
      }
    })
    .catch(err => console.error("Error al cargar la página:", err));
}
