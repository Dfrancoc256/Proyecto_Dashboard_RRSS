 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/js/form.js b/js/form.js
index 7a3a91ad2666c9a3bdaaee62f19949628fb26b5c..8c297b69c21cfca1354377c16801dcf885ad2f29 100644
--- a/js/form.js
+++ b/js/form.js
@@ -1,34 +1,34 @@
 document.addEventListener("submit", async (e) => {
   e.preventDefault();
 
   const data = {
     pais: e.target.pais.value,
     medio: e.target.medio.value,
-    razondecontacto: e.target.razon.value,
-    necesitoticket: e.target.ticket.value,
-    comentariocliente: e.target.comentario_cliente.value,
-    linkticket: e.target.link_ticket.value,
+    razon: e.target.razon.value,
+    ticket: e.target.ticket.value,
+    comentario_cliente: e.target.comentario_cliente.value,
+    link_ticket: e.target.link_ticket.value,
     email: e.target.email.value,
     notas: e.target.notas.value,
-    sentimientos: e.target.sentimiento.value,
+    sentimiento: e.target.sentimiento.value,
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
 
EOF
)