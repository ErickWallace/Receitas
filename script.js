/* ============================================
   CONFIGURAÇÃO — troque pela URL do seu Apps Script
   ============================================ */
const API_URL = "https://script.google.com/macros/s/AKfycbw6UOMAJ1cAwyRI-MGkMQN6XYnM6NlH7rHMz3v4F-ecmh28xkhnm5oWrFkBbDRObOJJ2g/exec";

/* ============================================
   Estado
   ============================================ */
let receitas = [];
let categoriaAtiva = "todas";
let termoBusca = "";

/* ============================================
   Elementos
   ============================================ */
const statusEl = document.getElementById("status");
const gridEl = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const filtersEl = document.getElementById("filters");
const searchEl = document.getElementById("search");
const overlayEl = document.getElementById("overlay");
const sheetContentEl = document.getElementById("sheetContent");
const closeBtn = document.getElementById("closeBtn");

/* ============================================
   Carregar dados da planilha
   ============================================ */
async function carregarReceitas() {
  mostrarSkeleton();
  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error("Resposta não OK: " + resp.status);
    const dados = await resp.json();

    receitas = dados.filter(r => r.nome && String(r.nome).trim() !== "");

    montarFiltros();
    renderizar();
    statusEl.style.display = "";
    statusEl.hidden = true;
    statusEl.classList.remove("is-error");
    gridEl.hidden = false;
  } catch (err) {
    console.error(err);
    statusEl.style.display = "";
    gridEl.hidden = true;
    statusEl.hidden = false;
    statusEl.classList.add("is-error");
    statusEl.textContent =
      "Não consegui abrir o caderno agora. Verifique se a URL da API está correta e se o Apps Script está publicado como 'Qualquer pessoa'.";
  }
}

/* Skeleton visual enquanto os dados da planilha carregam */
function mostrarSkeleton() {
  statusEl.hidden = false;
  statusEl.classList.remove("is-error");
  statusEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "skeleton-grid";
  for (let i = 0; i < 8; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.innerHTML = `
      <div class="skeleton-block skeleton-photo"></div>
      <div class="skeleton-block skeleton-line w-70"></div>
      <div class="skeleton-block skeleton-line w-40"></div>
    `;
    wrap.appendChild(card);
  }
  statusEl.appendChild(wrap);
  statusEl.style.display = "block";
  gridEl.hidden = true;
}

/* ============================================
   Filtros de categoria
   ============================================ */
function montarFiltros() {
  const categorias = Array.from(
    new Set(receitas.map(r => (r.categoria || "").trim()).filter(Boolean))
  ).sort();

  categorias.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.cat = cat;
    btn.textContent = cat;
    filtersEl.appendChild(btn);
  });

  filtersEl.addEventListener("click", e => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    categoriaAtiva = btn.dataset.cat;
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    renderizar();
  });
}

/* ============================================
   Busca
   ============================================ */
searchEl.addEventListener("input", e => {
  termoBusca = e.target.value.trim().toLowerCase();
  renderizar();
});

function bate(r) {
  const naCategoria = categoriaAtiva === "todas" || r.categoria === categoriaAtiva;
  if (!naCategoria) return false;

  if (!termoBusca) return true;

  const alvo = [
    r.nome,
    r.categoria,
    Array.isArray(r.ingredientes) ? r.ingredientes.join(" ") : r.ingredientes,
    Array.isArray(r.tags) ? r.tags.join(" ") : r.tags
  ]
    .join(" ")
    .toLowerCase();

  return alvo.includes(termoBusca);
}

/* ============================================
   Render da grade
   ============================================ */
function renderizar() {
  const filtradas = receitas.filter(bate);
  gridEl.innerHTML = "";

  if (filtradas.length === 0) {
    gridEl.hidden = true;
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  gridEl.hidden = false;

  filtradas.forEach(r => gridEl.appendChild(criarCard(r)));
}

function criarCard(r) {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", "Abrir receita: " + r.nome);

  const tags = Array.isArray(r.tags) ? r.tags : [];

  card.innerHTML = `
    ${r.foto_url
      ? `<img class="card-photo" src="${escapeAttr(r.foto_url)}" alt="Foto de ${escapeAttr(r.nome)}" loading="lazy">`
      : `<div class="card-photo placeholder">sem foto ainda</div>`
    }
    ${r.categoria ? `<span class="card-cat">${escapeHtml(r.categoria)}</span>` : ""}
    <h3>${escapeHtml(r.nome)}</h3>
    <div class="card-meta">
      ${r.tempo_preparo ? `<span>⏱ ${escapeHtml(r.tempo_preparo)}</span>` : ""}
      ${r.porcoes ? `<span>🍽 ${escapeHtml(String(r.porcoes))}</span>` : ""}
      ${r.dificuldade ? `<span>◆ ${escapeHtml(r.dificuldade)}</span>` : ""}
    </div>
    ${tags.length ? `<div class="card-tags">${tags.slice(0, 3).map(t => "#" + t).join("  ")}</div>` : ""}
  `;

  const abrir = () => abrirReceita(r);
  card.addEventListener("click", abrir);
  card.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); }
  });

  return card;
}

/* ============================================
   Detalhe da receita (overlay)
   ============================================ */
function abrirReceita(r) {
  const ingredientes = Array.isArray(r.ingredientes) ? r.ingredientes : [];
  const passos = Array.isArray(r.modo_preparo) ? r.modo_preparo : [];
  const tags = Array.isArray(r.tags) ? r.tags : [];

  sheetContentEl.innerHTML = `
    ${r.foto_url ? `<img class="sheet-photo" src="${escapeAttr(r.foto_url)}" alt="Foto de ${escapeAttr(r.nome)}">` : ""}
    ${r.categoria ? `<span class="sheet-cat">${escapeHtml(r.categoria)}</span>` : ""}
    <h2 id="sheet-title">${escapeHtml(r.nome)}</h2>
    <div class="sheet-meta">
      ${r.tempo_preparo ? `<span>⏱ ${escapeHtml(r.tempo_preparo)}</span>` : ""}
      ${r.porcoes ? `<span>🍽 ${escapeHtml(String(r.porcoes))} porções</span>` : ""}
      ${r.dificuldade ? `<span>◆ ${escapeHtml(r.dificuldade)}</span>` : ""}
    </div>

    ${ingredientes.length ? `
    <div class="sheet-section">
      <h4>Ingredientes</h4>
      <ul class="ing-list">
        ${ingredientes.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
      </ul>
    </div>` : ""}

    ${passos.length ? `
    <div class="sheet-section">
      <h4>Modo de preparo</h4>
      <ol class="steps-list">
        ${passos.map(p => `<li>${escapeHtml(p.replace(/^\d+\.\s*/, ""))}</li>`).join("")}
      </ol>
    </div>` : ""}

    ${tags.length ? `
    <div class="sheet-section">
      <h4>Tags</h4>
      <div class="sheet-tags">
        ${tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join("")}
      </div>
    </div>` : ""}
  `;

  overlayEl.hidden = false;
  document.body.style.overflow = "hidden";
  closeBtn.focus();
}

function fecharReceita() {
  overlayEl.hidden = true;
  document.body.style.overflow = "";
}

closeBtn.addEventListener("click", fecharReceita);
overlayEl.addEventListener("click", e => { if (e.target === overlayEl) fecharReceita(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !overlayEl.hidden) fecharReceita(); });

/* ============================================
   Utilidades de segurança (evitar HTML injetado)
   ============================================ */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

/* ============================================
   Start
   ============================================ */
carregarReceitas();
