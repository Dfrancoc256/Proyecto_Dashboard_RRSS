// js/comentarios.js
let rawData = [];
let filtered = [];
let page = 1;
let limit = 50;
let pies = { pais: null, medio: null };

const norm = (v) => String(v ?? "").trim().toLowerCase();
const isPos = (row) => norm(row.sentimientos) === "positivo" || norm(row.sentimiento) === "positivo";

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseFechaSheets(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;

  const s = String(valor).trim();
  const isoTry = new Date(s);
  if (!isNaN(isoTry)) return isoTry;

  const parts = s.split(" ");
  const fecha = parts[0];
  const hora = parts[1] || "00:00:00";

  const [a, b, c] = fecha.split("/").map(n => parseInt(n, 10));
  if (!a || !b || !c) return null;

  const dd = a, mm = b - 1, yyyy = c;
  const [hh, mi, ss] = hora.split(":").map(n => parseInt(n, 10) || 0);
  const d = new Date(yyyy, mm, dd, hh, mi, ss);
  return isNaN(d) ? null : d;
}

function inicioDia(v) { return new Date(v + "T00:00:00"); }
function finDia(v) { return new Date(v + "T23:59:59.999"); }

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>a.localeCompare(b));
}

function topNWithOthers(mapObj, n=6) {
  const entries = Object.entries(mapObj).sort((a,b)=>b[1]-a[1]);
  const top = entries.slice(0, n);
  const rest = entries.slice(n);
  const others = rest.reduce((s, [,v]) => s + v, 0);
  if (others > 0) top.push(["Otros", others]);
  return top;
}

function contar(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function debounce(fn, ms=300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export async function initComentarios() {
  // 1) Cargar data
  const res = await obtenerDatosDashboard();
  const lista = res?.data?.data ?? [];
  rawData = Array.isArray(lista) ? lista : [];

  // 2) UI refs
  const cPais = document.getElementById("cPais");
  const cMedio = document.getElementById("cMedio");
  const cUsuario = document.getElementById("cUsuario");
  const cAplicar = document.getElementById("cAplicar");
  const cBuscar = document.getElementById("cBuscar");
  const cLimit = document.getElementById("cLimit");
  const cPrev = document.getElementById("cPrev");
  const cNext = document.getElementById("cNext");

  // 3) Poblar selects (rápido)
  const paises = uniqueSorted(rawData.map(d => String(d.pais || "").trim()).map(v=>v));
  const medios = uniqueSorted(rawData.map(d => String(d.medio || "").trim()).map(v=>v));
  const usuarios = uniqueSorted(rawData.map(d => String(d.email || "").trim().toLowerCase()).map(v=>v));

  cPais.innerHTML = `<option value="todos">Todos</option>` + paises.map(p=>`<option>${escapeHtml(p)}</option>`).join("");
  cMedio.innerHTML = `<option value="todos">Todos</option>` + medios.map(m=>`<option>${escapeHtml(m)}</option>`).join("");
  cUsuario.innerHTML = `<option value="todos">Todos</option>` + usuarios.map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");

  // 4) Listeners (idempotentes porque esta vista se recrea)
  cAplicar.onclick = () => { page = 1; aplicar(); };
  cLimit.onchange = () => { limit = parseInt(cLimit.value, 10) || 50; page = 1; renderTabla(); };
  cPrev.onclick = () => { if (page > 1) { page--; renderTabla(); } };
  cNext.onclick = () => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / limit));
    if (page < maxPage) { page++; renderTabla(); }
  };

  cBuscar.addEventListener("input", debounce(() => { page = 1; aplicar(); }, 250));

  // 5) Render inicial
  aplicar();
}

function aplicar() {
  const desde = document.getElementById("cDesde").value;
  const hasta = document.getElementById("cHasta").value;
  const pais = norm(document.getElementById("cPais").value);
  const medio = norm(document.getElementById("cMedio").value);
  const usuario = norm(document.getElementById("cUsuario").value);
  const q = norm(document.getElementById("cBuscar").value);

  const dDesde = desde ? inicioDia(desde) : null;
  const dHasta = hasta ? finDia(hasta) : null;

  filtered = rawData.filter(item => {
    let ok = true;

    // fecha
    const dItem = parseFechaSheets(item.time);
    if ((dDesde || dHasta) && !dItem) ok = false;
    if (dDesde && dItem && dItem < dDesde) ok = false;
    if (dHasta && dItem && dItem > dHasta) ok = false;

    // filtros
    if (pais !== "todos" && norm(item.pais) !== pais) ok = false;
    if (medio !== "todos" && norm(item.medio) !== medio) ok = false;
    if (usuario !== "todos" && norm(item.email) !== usuario) ok = false;

    // búsqueda texto
    if (q) {
      const texto = norm(item.comentario_cliente) + " " + norm(item.notas);
      if (!texto.includes(q)) ok = false;
    }

    return ok;
  });

  renderKPIs();
  renderEjePaisCanal();
  renderPies();
  renderTabla();
}

function renderKPIs() {
  const total = filtered.length;
  const pos = filtered.filter(isPos).length;
  const posPct = total ? ((pos / total) * 100).toFixed(1) + "%" : "0%";

  document.getElementById("kTotal").textContent = total;
  document.getElementById("kPos").textContent = posPct;

  // top país / top canal por volumen (filtrado)
  const byPais = {};
  const byMedio = {};
  for (const r of filtered) {
    contar(byPais, String(r.pais || "Sin dato").trim() || "Sin dato");
    contar(byMedio, String(r.medio || "Sin dato").trim() || "Sin dato");
  }
  const topPais = Object.entries(byPais).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
  const topMedio = Object.entries(byMedio).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";

  document.getElementById("kTopPais").textContent = topPais;
  document.getElementById("kTopMedio").textContent = topMedio;
}

function renderEjePaisCanal() {
  // Agrupar por (pais, medio): total, positivos, %positivos
  const map = new Map();

  for (const r of filtered) {
    const p = String(r.pais || "Sin dato").trim() || "Sin dato";
    const m = String(r.medio || "Sin dato").trim() || "Sin dato";
    const key = p + "||" + m;

    if (!map.has(key)) map.set(key, { pais: p, medio: m, total: 0, pos: 0 });
    const obj = map.get(key);
    obj.total++;
    if (isPos(r)) obj.pos++;
  }

  const rows = Array.from(map.values())
    .map(x => ({ ...x, pct: x.total ? (x.pos / x.total) : 0 }))
    .sort((a,b) => b.pct - a.pct); // mayor positividad arriba

  // Generar frases tipo: "Guatemala — TikTok: 89% positivos (n=123)"
  const top = rows.slice(0, 15);
  if (!top.length) {
    document.getElementById("ejeResumen").textContent = "No hay datos con los filtros actuales.";
    return;
  }

  const html = top.map(x => {
    const pct = (x.pct * 100).toFixed(1);
    return `<div class="c-eje-item">
      <b>${escapeHtml(x.pais)}</b> — <b>${escapeHtml(x.medio)}</b>:
      <span>${pct}% positivos</span> <small>(n=${x.total})</small>
    </div>`;
  }).join("");

  document.getElementById("ejeResumen").innerHTML = html;
}

function renderPies() {
  // Pie % positivos por País / Canal (Top + Otros)
  const byPais = {};
  const byPaisPos = {};
  const byMedio = {};
  const byMedioPos = {};

  for (const r of filtered) {
    const p = String(r.pais || "Sin dato").trim() || "Sin dato";
    const m = String(r.medio || "Sin dato").trim() || "Sin dato";

    contar(byPais, p);
    contar(byMedio, m);

    if (isPos(r)) {
      contar(byPaisPos, p);
      contar(byMedioPos, m);
    }
  }

  // Convertimos a “% positivos” por label
  const paisPct = {};
  for (const [p, total] of Object.entries(byPais)) {
    const pos = byPaisPos[p] || 0;
    paisPct[p] = total ? Math.round((pos / total) * 1000) / 10 : 0; // 1 decimal
  }
  const medioPct = {};
  for (const [m, total] of Object.entries(byMedio)) {
    const pos = byMedioPos[m] || 0;
    medioPct[m] = total ? Math.round((pos / total) * 1000) / 10 : 0;
  }

  // Top N por % (no por volumen) para “más positivos”
  const paisTop = topNWithOthers(paisPct, 6);
  const medioTop = topNWithOthers(medioPct, 6);

  // Chart.js
  pies.pais?.destroy?.();
  pies.medio?.destroy?.();

  const ctxPais = document.getElementById("piePaisPos");
  const ctxMedio = document.getElementById("pieMedioPos");

  pies.pais = new Chart(ctxPais, {
    type: "pie",
    data: {
      labels: paisTop.map(x => x[0]),
      datasets: [{
        data: paisTop.map(x => x[1]),
      }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}%` }
        }
      }
    }
  });

  pies.medio = new Chart(ctxMedio, {
    type: "pie",
    data: {
      labels: medioTop.map(x => x[0]),
      datasets: [{
        data: medioTop.map(x => x[1]),
      }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}%` }
        }
      }
    }
  });
}

function renderTabla() {
  const tbody = document.getElementById("cTbody");
  const pageInfo = document.getElementById("cPageInfo");

  const maxPage = Math.max(1, Math.ceil(filtered.length / limit));
  if (page > maxPage) page = maxPage;

  const start = (page - 1) * limit;
  const end = start + limit;
  const slice = filtered.slice(start, end);

  pageInfo.textContent = `Página ${page} de ${maxPage} (Total: ${filtered.length})`;

  // Render eficiente
  const frag = document.createDocumentFragment();

  for (const r of slice) {
    const tr = document.createElement("tr");

    const d = parseFechaSheets(r.time);
    const fecha = d ? d.toLocaleString() : String(r.time || "");

    const tdFecha = document.createElement("td");
    tdFecha.textContent = fecha;

    const tdEmail = document.createElement("td");
    tdEmail.textContent = String(r.email || "").trim();

    const tdPais = document.createElement("td");
    tdPais.textContent = String(r.pais || "").trim();

    const tdMedio = document.createElement("td");
    tdMedio.textContent = String(r.medio || "").trim();

    const tdSent = document.createElement("td");
    tdSent.textContent = String(r.sentimientos || r.sentimiento || "").trim();

    const tdCom = document.createElement("td");
    // seguridad: texto plano
    const com = String(r.comentario_cliente || "").trim();
    tdCom.textContent = com.length > 160 ? (com.slice(0, 160) + "…") : com;

    tr.appendChild(tdFecha);
    tr.appendChild(tdEmail);
    tr.appendChild(tdPais);
    tr.appendChild(tdMedio);
    tr.appendChild(tdSent);
    tr.appendChild(tdCom);

    frag.appendChild(tr);
  }

  tbody.innerHTML = "";
  tbody.appendChild(frag);
}
