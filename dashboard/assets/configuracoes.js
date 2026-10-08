/* =========================================================
   Meneiger Page – Configurações Gerais
   (Integrado ao HTML principal com atualização do título)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "../api/config";

  // Elementos
  const nomeInput = document.querySelector("#cfgNomeSistema");
  const logoPreview = document.querySelector("#cfgLogoPreview");
  const uploadBtn = document.querySelector("#cfgLogoUploadBtn");
  const removeBtn = document.querySelector("#cfgLogoRemoveBtn");
  const fileInput = document.querySelector("#cfgLogoInput");
  const statusMsg = document.querySelector("#cfgStatus");
  const buscaInput = document.querySelector("#buscaConfig");

  // Elementos globais a atualizar
  const brandTitle = document.querySelector("#systemName");
  const headTitle = document.querySelector("title");
  const headerTitle = document.querySelector(".page__header .title");

  /* ---------- Helpers ---------- */
  const msg = (text, ok = true) => {
    statusMsg.textContent = text;
    statusMsg.style.color = ok ? "var(--muted,#666)" : "#d33";
    if (text) {
      statusMsg.style.opacity = 1;
      setTimeout(() => (statusMsg.style.opacity = 0), 3000);
    }
  };

  const fetchJSON = async (url, opts = {}) => {
    const r = await fetch(url, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.message || "Erro inesperado");
    return j.data || {};
  };

  /* ---------- Carregar configs ---------- */
  async function carregarConfig() {
    try {
      const data = await fetchJSON(`${API_BASE}/get.php`);
      const nome = data.nome_sistema || "Meneiger Page";
      nomeInput.value = nome;

      // Atualiza o título global
      atualizarTitulo(nome);

      if (data.logo_escola) {
        logoPreview.src = data.logo_escola;
        logoPreview.hidden = false;
        removeBtn.disabled = false;
      } else {
        logoPreview.hidden = true;
        removeBtn.disabled = true;
      }
    } catch (err) {
      msg(err.message, false);
    }
  }

  /* ---------- Atualizar nome ---------- */
  nomeInput.addEventListener("blur", async () => {
    const nome = nomeInput.value.trim();
    if (!nome) return;
    try {
      await fetchJSON(`${API_BASE}/update_nome.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      atualizarTitulo(nome);
      msg("Nome atualizado com sucesso!");
    } catch (err) {
      msg(err.message, false);
    }
  });

  /* ---------- Atualizar título visual ---------- */
  function atualizarTitulo(nome) {
    if (brandTitle) brandTitle.textContent = nome;
    if (headTitle) headTitle.textContent = `SystemCollege — ${nome}`;
    if (headerTitle) headerTitle.querySelector("i")
      ? (headerTitle.innerHTML = `<i class="ri-calculator-line"></i> ${nome}`)
      : (headerTitle.textContent = nome);
  }

  /* ---------- Upload de logo ---------- */
  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      msg("Arquivo excede 2 MB.", false);
      return;
    }

    const fd = new FormData();
    fd.append("logo", file);
    msg("Enviando logo...");

    try {
      const data = await fetchJSON(`${API_BASE}/upload_logo.php`, {
        method: "POST",
        body: fd,
      });
      logoPreview.src = data.logo_escola;
      logoPreview.hidden = false;
      removeBtn.disabled = false;
      msg("Logo atualizada!");
    } catch (err) {
      msg(err.message, false);
    } finally {
      fileInput.value = "";
    }
  });

  /* ---------- Remover logo ---------- */
  removeBtn.addEventListener("click", async () => {
    if (!confirm("Deseja remover a logomarca atual?")) return;
    try {
      await fetchJSON(`${API_BASE}/remove_logo.php`, { method: "POST" });
      logoPreview.hidden = true;
      removeBtn.disabled = true;
      msg("Logo removida.");
    } catch (err) {
      msg(err.message, false);
    }
  });

  /* ---------- Busca de campo (filtro simples) ---------- */
  buscaInput.addEventListener("input", () => {
    const termo = buscaInput.value.toLowerCase();
    document.querySelectorAll(".config-item").forEach((item) => {
      const texto = item.innerText.toLowerCase();
      item.style.display = texto.includes(termo) ? "" : "none";
    });
  });

  carregarConfig();
});
