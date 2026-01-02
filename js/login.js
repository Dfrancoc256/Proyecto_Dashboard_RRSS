document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorMsg = document.getElementById("errorMessage");
  const loading = document.getElementById("loadingLogin");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const correo = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!correo || !password) {
      errorMsg.textContent = "Debes ingresar correo y contraseña.";
      errorMsg.style.display = "block";
      return;
    }

    loading.style.display = "block";
    errorMsg.style.display = "none";

    try {
      const res = await realizarLogin(correo, password);
      if (res.status === "success") {
        localStorage.setItem("usuarioActivo", JSON.stringify(res.usuario));
        window.location.href = "../index.html";
      } else {
        errorMsg.textContent = res.message || "Credenciales incorrectas.";
        errorMsg.style.display = "block";
      }
    } catch (err) {
      errorMsg.textContent = "Error de conexión con el servidor.";
      errorMsg.style.display = "block";
    } finally {
      loading.style.display = "none";
    }
  });
});
