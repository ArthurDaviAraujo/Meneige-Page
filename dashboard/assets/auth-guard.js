// assets/auth-guard.js
(() => {
  // Ajuste os caminhos conforme sua estrutura:
  const LOGIN_URL = '/index.html';   // para onde mandar quem não está logado
  const ME_URL    = '/api/auth/me.php';    // endpoint que retorna 401 quando não logado

  // Evita "piscar" conteúdo antes da checagem
  document.documentElement.style.visibility = 'hidden';

  fetch(ME_URL, { credentials: 'include' })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error('not-auth');
      // Exponha o usuário, se quiser usar no header do painel:
      window.AUTH_USER = data.data?.user || data.user || null;
      document.documentElement.setAttribute('data-auth', 'ok');
      document.documentElement.style.visibility = '';
      // Ex.: preencher nome se existir um span#userName
      const el = document.getElementById('userName');
      if (el && window.AUTH_USER?.nome) el.textContent = window.AUTH_USER.nome;
    })
    .catch(() => {
      // Não autenticado → volta pro login (com ?next= para retorno)
      const next = encodeURIComponent(location.pathname + location.search + location.hash);
      location.replace(`${LOGIN_URL}?next=${next}`);
    });
})();
