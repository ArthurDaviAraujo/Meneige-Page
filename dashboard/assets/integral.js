/* =========================================================
   MENEIGER PAGE — FUNÇÕES DO ALUNO (Horários + Curso Extra)
   ========================================================= */

(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const selCurso  = $('#acadCursoExtra');
  const horaEnt   = $('#acadHoraEntrada');
  const horaSai   = $('#acadHoraSaida');
  const chkAlmoco = $('#acadTemAlmoco');
  const chkJantar = $('#acadTemJantar');

  // =====================================================
  // Carregar cursos extracurriculares no select
  // =====================================================
  async function carregarCursosExtras() {
    try {
      const res = await API.get('/cursos_extracurriculares/index.php');
      const cursos = res.data?.items || res.data?.cursos || [];
      selCurso.innerHTML =
        `<option value="">Não</option>` +
        cursos.map(c => `
          <option value="${c.curso_id}">
            ${c.curso_nome || 'Curso sem nome'} — ${c.professor_nome || 'Professor não definido'}
          </option>
        `).join('');
    } catch (err) {
      console.warn('Falha ao carregar cursos extras', err);
    }
  }

  // =====================================================
  // Inicializa cursos ao abrir o modal acadêmico
  // =====================================================
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btnAddAcademico') {
      setTimeout(carregarCursosExtras, 200);
    }
  });

  // =====================================================
  // Helper para evitar múltiplos binds duplicados
  // =====================================================
  function bindOnce(el, evt, fn) {
    if (!el) return;
    if (!el.__bound) el.__bound = {};
    if (el.__bound[evt]) return;
    el.addEventListener(evt, fn);
    el.__bound[evt] = true;
  }
})();
