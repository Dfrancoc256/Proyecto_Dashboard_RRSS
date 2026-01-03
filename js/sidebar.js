/* sidebar.js */
loadPage("home");

document.querySelectorAll(".sidebar button").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    loadPage(page);
  });
});

function loadPage(page) {
  fetch(`pages/${page}.html`)
    .then(res => res.text())
    .then(html => {
      document.getElementById("content").innerHTML = html;

      if (page === "home") {
        import("./charts.js").then(module => module.initCharts());
      } else if (page === "form") {
        import("./form.js"); // form.js usa FormData y NO rompe dashboard
      }
    })
    .catch(err => console.error("Error al cargar la página:", err));
}
