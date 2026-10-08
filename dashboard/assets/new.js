/* =========================================================
   Cursos Extracurriculares — new.js (CRUD cursos + Inscrição)
   Requer: API helper (dashboard.js) carregado em window.API
   ========================================================= */
(() => {
  if (!window.API || !API.get || !API.send) {
    console.error('API helper não encontrado. Carregue assets/dashboard.js antes de assets/new.js.');
    return;
  }

  /* ---------------------- Utils ---------------------- */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const toBRL = v => Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const escapeHTML = s => (s ?? '').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  window.escapeHTML = escapeHTML;
  const debounce = (fn, ms=300) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };

  function bindOnce(el, type, handler, options){
    if (!el) return;
    el.__bound ||= {};
    const key = `${type}::${handler.name || 'anon'}`;
    if (el.__bound[key]) return;
    el.addEventListener(type, handler, options);
    el.__bound[key] = true;
  }
  let __alertLockUntil = 0;
  const safeAlert = (msg) => { const now = Date.now(); if (now < __alertLockUntil) return; __alertLockUntil = now + 500; alert(msg); };

  /* =======================================================
     A) CATÁLOGO DE CURSOS (usa SOMENTE a tabela de cima)
     ======================================================= */
  function ensureCursosTable() {
    const table = document.getElementById('catalogoCursos');
    return table || null;
  }

  let CURSOS = [];
  let EDITING_ID = null;

  async function apiListCursos() {
    try {
      const r = await API.get('/cursos_extracurriculares/index.php');
      const arr = r.data?.items || r.data?.cursos || r.items || r.cursos || [];
      if (!Array.isArray(arr)) return [];
      return arr.map(x => ({
        id: x.curso_id ?? x.id ?? null,
        nome: x.curso_nome ?? x.nome ?? '',
        professor: x.professor_nome ?? x.professor ?? '',
        horario: x.dias_horarios ?? x.horario ?? '',
        preco: x.curso_preco_mensal ?? x.preco_mensal ?? 0
      }));
    } catch (e) {
      console.warn('Falha ao listar cursos:', e?.message || e);
      return [];
    }
  }
  window.apiListCursos = apiListCursos;
  window.CURSOS = CURSOS;

  async function apiCreateCurso({ nome, professor, horario, preco }){
    const payload = { nome, professor_nome: professor, dias_horarios: horario, preco_mensal: Number(preco) };
    try { return await API.send('/cursos_extracurriculares/create.php', 'POST', payload); } catch {}
    return await API.send('/cursos/create.php', 'POST', payload);
  }
  async function apiUpdateCurso(id, { nome, professor, horario, preco }){
    const payload = { id, nome, professor_nome: professor, dias_horarios: horario, preco_mensal: Number(preco) };
    try { return await API.send(`/cursos_extracurriculares/item.php?id=${id}`, 'PUT', payload); } catch {}
    return await API.send(`/cursos/item.php?id=${id}`, 'PUT', payload);
  }
  async function apiDeleteCurso(id){
    try {
      const r = await fetch(`${API.base}/cursos_extracurriculares/item.php?id=${encodeURIComponent(id)}`, { method:'DELETE', credentials:'include' });
      const j = await r.json().catch(()=> ({}));
      if (r.ok && j?.ok !== false) return j;
    } catch {}
    const rr = await fetch(`${API.base}/cursos/item.php?id=${encodeURIComponent(id)}`, { method:'DELETE', credentials:'include' });
    return rr.json().catch(()=> ({}));
  }

  // linha do catálogo (com botão de Presença)
  function cursosRowHTML(c){
    return `
      <div class="table__row" data-id="${c.id}">
        <div>${escapeHTML(c.nome) || '-'}</div>
        <div>${escapeHTML(c.professor) || '-'}</div>
        <div>${escapeHTML(c.horario) || '-'}</div>
        <div>${toBRL(c.preco)}</div>
        <div class="actions">
          <button class="icon-btn" title="Presenças" data-act="calendar" data-curso-id="${c.id}">
            <i class="ri-calendar-line"></i>
          </button>
          <button class="icon-btn" title="Editar" data-act="edit"><i class="ri-edit-2-line"></i></button>
          <button class="icon-btn danger" title="Excluir" data-act="delete"><i class="ri-delete-bin-6-line"></i></button>
        </div>
      </div>`;
  }

  function renderCursos(){
    const table = ensureCursosTable();
    if (!table) return;
    [...table.querySelectorAll('.table__row:not(.table__head)')].forEach(n => n.remove());
    const frag = document.createElement('div');
    CURSOS.forEach(c => frag.insertAdjacentHTML('beforeend', cursosRowHTML(c)));
    table.appendChild(frag);
  }

  async function reloadCursos(){
    try { CURSOS = await apiListCursos(); }
    catch(e){ console.warn('Falha ao listar cursos:', e?.message || e); CURSOS = []; }
    renderCursos();
    populateCursoSelects();
  }

  // Modal curso (criar/editar)
  const cursoModal   = document.getElementById('cursoModal');
  const cursoTitle   = document.getElementById('cursoModalTitle');
  const cursoClose   = document.getElementById('cursoModalClose');
  const cursoCancel  = document.getElementById('cursoModalCancel');
  const cursoSave    = document.getElementById('cursoModalSave');
  const btnAddCurso  = document.getElementById('btnAddCurso');
  const inpNome      = document.getElementById('cursoNome');
  const inpProf      = document.getElementById('cursoProf');
  const inpHorario   = document.getElementById('cursoHorario');
  const inpPreco     = document.getElementById('cursoPreco');

  function openCursoModal(editId = null){
    EDITING_ID = editId;
    if (!cursoModal) return;
    cursoModal.hidden = false;
    requestAnimationFrame(() => cursoModal.classList.add('is-visible'));

    if (cursoTitle) {
      cursoTitle.innerHTML = EDITING_ID
        ? `<i class="ri-booklet-line"></i> Editar Curso`
        : `<i class="ri-booklet-line"></i> Cadastrar Curso`;
    }
    if (EDITING_ID) {
      const c = CURSOS.find(x => String(x.id) === String(EDITING_ID)) || {};
      inpNome.value    = c.nome || '';
      inpProf.value    = c.professor || '';
      inpHorario.value = c.horario || '';
      inpPreco.value   = c.preco != null ? Number(c.preco) : '';
    } else {
      inpNome.value = inpProf.value = inpHorario.value = '';
      inpPreco.value = '';
    }
    (inpNome || inpProf || inpHorario || inpPreco)?.focus?.();
  }
  function closeCursoModal(){
    if (!cursoModal) return;
    cursoModal.classList.remove('is-visible');
    setTimeout(() => { cursoModal.hidden = true; }, 180);
  }
  btnAddCurso && bindOnce(btnAddCurso, 'click', () => openCursoModal(null));
  cursoClose  && bindOnce(cursoClose,  'click', closeCursoModal);
  cursoCancel && bindOnce(cursoCancel, 'click', closeCursoModal);

  cursoSave && bindOnce(cursoSave, 'click', async () => {
    const nome      = (inpNome?.value || '').trim();
    const professor = (inpProf?.value || '').trim();
    const horario   = (inpHorario?.value || '').trim();
    const preco     = Number((inpPreco?.value || '0').toString().replace(',', '.')) || 0;

    if (!nome)      return safeAlert('Informe o nome do curso.');
    if (!professor) return safeAlert('Informe o professor.');

    try {
      if (!EDITING_ID) await apiCreateCurso({ nome, professor, horario, preco });
      else await apiUpdateCurso(EDITING_ID, { nome, professor, horario, preco });
      closeCursoModal();
      await reloadCursos();
      await loadChamada();
    } catch (err) {
      safeAlert(err.message || 'Não foi possível salvar o curso.');
    }
  });

  // Botão calendário (catálogo e chamada)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act="calendar"]');
    if (!btn) return;

    const alunoId = btn.dataset.alunoId || null;
    const cursoId = btn.dataset.cursoId || null;

    if (cursoId && alunoId) {
      const nome = btn.closest('.table__row')?.querySelector('span,div')?.textContent || 'Aluno';
      openPresencaDia(Number(cursoId), Number(alunoId), nome);
      return;
    }
    if (cursoId) {
      openPresencaDia(Number(cursoId), null, null);
      return;
    }
  });

  (function bindTableActions(){
    const table = ensureCursosTable();
    if (!table || table.dataset.bound) return;
    table.dataset.bound = '1';
    table.addEventListener('click', async (e) => {
      const btn = e.target.closest('.icon-btn[data-act]');
      if (!btn) return;
      const row = btn.closest('.table__row');
      const id  = row?.dataset.id;
      if (!id) return;

      try {
        if (btn.dataset.act === 'edit') {
          openCursoModal(Number(id));
        } else if (btn.dataset.act === 'delete') {
          if (!confirm('Excluir este curso?')) return;
          await apiDeleteCurso(Number(id));
          await reloadCursos();
          await loadChamada();
        }
      } catch (err) {
        safeAlert(err.message || 'Ação não concluída.');
      }
    });
  })();

  /* =======================================================
     B) INSCRIÇÃO — FAB + Modal
     ======================================================= */

  async function apiSearchAlunos(q='', limit=50){
    const url = `/cursos_extracurriculares/alunos/search.php?q=${encodeURIComponent(q)}&limit=${limit}`;
    const r = await API.get(url);
    return r.data?.items || [];
  }
  async function apiMatriculasByAluno(alunoId){
    const url = `/cursos_extracurriculares/matriculas/by-aluno.php?aluno_id=${alunoId}`;
    const r = await API.get(url);
    return r.data?.items || [];
  }
  async function apiCreateMatricula({ aluno_id, curso_id, curso_turma_id=null }){
    const body = { aluno_id: Number(aluno_id) };
    if (curso_turma_id) body.curso_turma_id = Number(curso_turma_id);
    else body.curso_id = Number(curso_id);
    return await API.send('/cursos_extracurriculares/matriculas/create.php','POST', body);
  }
  async function apiDeleteMatricula(id){
    return await API.send('/cursos_extracurriculares/matriculas/delete.php','POST',{ id:Number(id) });
  }

  function ensureInscricaoFab(){
    const view = $('#view-cursos');
    if (!view) return null;
    let fab = $('#btnAddInscricao');
    if (fab) return fab;
    fab = document.createElement('button');
    fab.id = 'btnAddInscricao';
    fab.className = 'fab';
    fab.title = 'Adicionar aluno em curso';
    fab.style.right = '5.5rem';
    fab.innerHTML = `<i class="ri-user-add-line"></i>`;
    view.appendChild(fab);
    return fab;
  }

  function ensureInscricaoModal(){
    let wrap = $('#inscricaoModal');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.id = 'inscricaoModal';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="inscTitle">
        <div class="modal__header">
          <h3 id="inscTitle"><i class="ri-user-add-line"></i> Adicionar aluno em curso</h3>
          <button class="modal__close" id="inscClose" aria-label="Fechar"><i class="ri-close-line"></i></button>
        </div>
        <div class="modal__body">
          <div class="grid grid--two">
            <div class="card">
              <h4 class="block-title">Alunos</h4>
              <div class="toolbar">
                <i class="ri-search-line"></i>
                <input id="inscBuscaAluno" class="input search" placeholder="Buscar aluno pelo nome">
              </div>
              <ul id="inscListaAlunos" class="list" style="max-height:320px;overflow:auto;margin-top:.5rem;"></ul>
              <div class="field-inline" style="justify-content:center;margin-top:.5rem;">
                <button class="btn btn--ghost" id="inscMais" style="display:none;"><i class="ri-add-line"></i> Mostrar mais</button>
              </div>
            </div>
            <div class="card">
              <h4 class="block-title">Inscrever no curso</h4>
              <div class="field">
                <label class="label">Curso</label>
                <div class="select">
                  <select id="inscCurso"></select>
                  <i class="ri-arrow-down-s-line"></i>
                </div>
                <small id="inscCursoHint" class="muted"></small>
              </div>
              <div class="divider"></div>
              <h4 class="block-title" id="inscMatriTitle">Matrículas atuais do aluno</h4>
              <ul id="inscMatriculas" class="list" style="max-height:220px;overflow:auto;"></ul>
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn" id="inscCancel">Fechar</button>
          <button class="btn btn--primary" id="inscAddBtn" disabled><i class="ri-check-line"></i> Matricular</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  const MOD = { alunoSel: null, alunos: [], q: '', limit: 30, loading: false };

  function populateCursoSelects() {
    const filtro = document.querySelector('#filtroCurso');
    if (filtro) {
      const current = filtro.value;
      const opts = [`<option value="">Todos os cursos</option>`]
        .concat(CURSOS.map(c => `<option value="${c.id}">${escapeHTML(c.nome)}</option>`));
      filtro.innerHTML = opts.join('');
      if ([...filtro.options].some(o => o.value === current)) filtro.value = current;
    }
    const sel = document.querySelector('#inscCurso');
    if (sel) {
      const opts = CURSOS.map(c => `<option value="${c.id}">${escapeHTML(c.nome)}</option>`);
      sel.innerHTML = opts.join('');
      const hint = document.querySelector('#inscCursoHint');
      const first = CURSOS.find(c => String(c.id) === String(sel.value));
      if (hint && first) hint.textContent = `${first.professor || '-'} • ${first.horario || '-'} • ${toBRL(first.preco || 0)}`;
    }
  }

  function renderAlunosList(list){
    const ul = document.querySelector('#inscListaAlunos'); if (!ul) return;
    ul.innerHTML = '';
    if (!list?.length){
      ul.innerHTML = `<li class="muted" style="padding:.5rem 0;">Nenhum aluno encontrado.</li>`;
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach(a => {
      const li = document.createElement('li');
      li.className = 'list__item';
      li.innerHTML = `
        <button class="ghost-btn" data-id="${a.id}">
          <i class="ri-user-3-line"></i>
          <span class="aluno-nome">${a.nome}</span>
          <span class="aluno-resp">${a.responsavel || ''}</span>
        </button>`;
      frag.appendChild(li);
    });
    ul.appendChild(frag);
  }

  async function fetchAndRenderAlunos(reset=false){
    if (MOD.loading) return;
    MOD.loading = true;
    const ul = $('#inscListaAlunos');
    if (reset) { ul.innerHTML = `<li class="muted" style="padding:.5rem 0;">Carregando…</li>`; }
    try {
      const items = await apiSearchAlunos(MOD.q, MOD.limit);
      MOD.alunos = items;
      renderAlunosList(MOD.alunos);
    } catch (e) {
      ul.innerHTML = `<li class="muted" style="padding:.5rem 0;">Falha ao buscar alunos.</li>`;
      console.warn(e);
    } finally {
      MOD.loading = false;
    }
  }

  async function openInscricaoModal(){
    ensureInscricaoModal();
    const wrap = $('#inscricaoModal');
    wrap.hidden = false; requestAnimationFrame(()=>wrap.classList.add('is-visible'));

    if (!CURSOS.length) await reloadCursos();
    populateCursoSelects();

    MOD.alunoSel = null;
    MOD.q = '';
    MOD.limit = 30;
    $('#inscAddBtn').disabled = true;
    $('#inscListaAlunos').innerHTML = '';
    $('#inscMatriculas').innerHTML = `<li class="muted" style="padding:.5rem 0;">Selecione um aluno.</li>`;
    await fetchAndRenderAlunos(true);
  }
  function closeInscricaoModal(){
    const wrap = $('#inscricaoModal'); if (!wrap) return;
    wrap.classList.remove('is-visible');
    setTimeout(()=>wrap.hidden = true, 180);
  }

  const fabInsc = ensureInscricaoFab();
  fabInsc && bindOnce(fabInsc, 'click', openInscricaoModal);

  bindOnce(document, 'click', async function inscricaoClickDeleg(e){
    if (e.target?.id === 'inscClose' || e.target?.id === 'inscCancel' || e.target === $('#inscricaoModal')) {
      closeInscricaoModal(); return;
    }
    const pick = e.target.closest('#inscListaAlunos .ghost-btn');
    if (pick) {
      MOD.alunoSel = { id: Number(pick.dataset.id) };
      $('#inscAddBtn').disabled = false;
      await renderMatriculasAluno(MOD.alunoSel.id);
      return;
    }
    const del = e.target.closest('#inscMatriculas [data-del]');
    if (del) {
      if (!confirm('Remover esta matrícula?')) return;
      await apiDeleteMatricula(del.dataset.del);
      if (MOD.alunoSel?.id) await renderMatriculasAluno(MOD.alunoSel.id);
      await loadChamada();
    }
    if (e.target?.id === 'inscMais') {
      MOD.limit = clamp(MOD.limit + 30, 30, 300);
      await fetchAndRenderAlunos(true);
    }
  });

  bindOnce(document, 'input', debounce(async function onBusca(e){
    if (e.target?.id !== 'inscBuscaAluno') return;
    MOD.q = (e.target.value || '').trim();
    MOD.limit = 30;
    await fetchAndRenderAlunos(true);
  }, 300));

  bindOnce(document, 'change', function onCursoSel(e){
    if (e.target?.id !== 'inscCurso') return;
    const c = CURSOS.find(x => String(x.id) === String(e.target.value));
    const hint = $('#inscCursoHint');
    if (c && hint) hint.textContent = `${c.professor||'-'} • ${c.horario||'-'} • ${toBRL(c.preco||0)}`;
  });

  bindOnce(document, 'click', async function onAdd(e){
    if (e.target?.id !== 'inscAddBtn') return;
    const aluno = MOD.alunoSel?.id;
    const curso = Number($('#inscCurso')?.value || 0);
    if (!aluno || !curso) return;
    try {
      await apiCreateMatricula({ aluno_id: aluno, curso_id: curso });
      await renderMatriculasAluno(aluno);
      await loadChamada();
      safeAlert('Matrícula aplicado com sucesso.');
    } catch (err) {
      safeAlert(err.message || 'Falha ao matricular.');
    }
  });

  async function renderMatriculasAluno(alunoId){
    const ul = $('#inscMatriculas'); if (!ul) return;
    ul.innerHTML = `<li class="muted" style="padding:.5rem 0;">Carregando…</li>`;
    const items = await apiMatriculasByAluno(alunoId);
    ul.innerHTML = '';
    if (!items.length) { ul.innerHTML = `<li class="muted" style="padding:.5rem 0;">Sem matrículas em cursos extras.</li>`; return; }
    items.forEach(m => {
      const li = document.createElement('li');
      li.className = 'list__item';
      li.innerHTML = `
        <span><i class="ri-book-2-line"></i> ${escapeHTML(m.curso_nome)} <small class="muted">(${escapeHTML(m.professor_nome || '-') } • ${escapeHTML(m.dias_horarios || '-')})</small></span>
        <button class="icon-btn danger" title="Remover matrícula" data-del="${m.matricula_id}"><i class="ri-delete-bin-6-line"></i></button>`;
      ul.appendChild(li);
    });
  }

  /* =======================================================
     C) LISTA DE CHAMADA
     ======================================================= */
  async function apiInscricoes(cursoId=null){
    const url = cursoId ? `/cursos_extracurriculares/inscricoes.php?curso_id=${cursoId}` : `/cursos_extracurriculares/inscricoes.php`;
    const r = await API.get(url);
    return r.data?.items || [];
  }

  function chamadaRowHTML(it) {
    return `
      <div class="table__row" data-id="${it.aluno_id}">
        <div>${escapeHTML(it.aluno_nome)}</div>
        <div>${escapeHTML(it.curso_nome)}</div>
        <div class="actions">
          <button class="icon-btn" title="Abrir calendário"
                  data-act="calendar"
                  data-aluno-id="${it.aluno_id}"
                  data-curso-id="${it.curso_id}">
            <i class="ri-calendar-line"></i>
          </button>
        </div>
      </div>`;
  }

  async function renderChamada(items, filtroTxt=''){
    const tab = $('#tabelaChamada'); if (!tab) return;
    [...tab.querySelectorAll('.table__row:not(.table__head)')].forEach(n => n.remove());
    const q = (filtroTxt||'').toLowerCase();
    const list = !q ? items : items.filter(it => (`${it.aluno_nome} ${it.curso_nome}`).toLowerCase().includes(q));
    const frag = document.createElement('div');
    list.forEach(it => frag.insertAdjacentHTML('beforeend', chamadaRowHTML(it)));
    tab.appendChild(frag);
    window.__ULT_CHAMADA__ = items;
  }

  async function loadChamada(){
    try {
      const filtro = $('#filtroCurso'); const cursoId = filtro ? (filtro.value || '') : '';
      const items = await apiInscricoes(cursoId || null);
      await renderChamada(items, ($('#buscaChamada')?.value || ''));
    } catch (e) {
      console.warn('Falha ao carregar chamada:', e?.message || e);
    }
  }

  (async () => {
    await reloadCursos();
    await loadChamada();
  })();
})();

/* =========================================================
   D) MODAL CORRETO — Presença por Dia (#modalPresencaDia)
   ========================================================= */
// estado do calendário
let MPD_month = new Date().getMonth();
let MPD_year  = new Date().getFullYear();
let MPD_courseId = null;
let MPD_alunoId  = null;
let MPD_pendingTimer = null;

// API presenças
async function carregarPresencas(alunoId, cursoId, ano, mes) {
  const res = await API.get(`/cursos_extracurriculares/presencas/get.php?aluno_id=${alunoId}&curso_id=${cursoId}&ano=${ano}&mes=${mes}`);
  return res.data?.items || {};
}
async function salvarPresencas(alunoId, cursoId, dados) {
  return await API.send('/cursos_extracurriculares/presencas/save.php', 'POST', {
    aluno_id: alunoId, curso_id: cursoId, presencas: dados
  });
}

// ajuda: obtém inscritos do curso (para popular select de alunos)
async function apiInscritosDoCurso(cursoId){
  const items = await (async () => {
    const r = await API.get(`/cursos_extracurriculares/inscricoes.php?curso_id=${cursoId}`);
    return r.data?.items || [];
  })();
  // normaliza: [{aluno_id, aluno_nome}]
  return items.map(x => ({
    id: Number(x.aluno_id ?? x.id),
    nome: x.aluno_nome ?? x.nome ?? ''
  }));
}

// salva com debounce (auto-save)
function mpdScheduleSave(){
  clearTimeout(MPD_pendingTimer);
  MPD_pendingTimer = setTimeout(async () => {
    const grid = document.getElementById('mpdGrid');
    if (!grid || !MPD_alunoId || !MPD_courseId) return;
    const dias = {};
    grid.querySelectorAll('.calendar-day').forEach(d => {
      const t = d.textContent.trim();
      if (!t || d.classList.contains('other-month')) return;
      const dia = String(t).padStart(2,'0');
      const key = `${MPD_year}-${String(MPD_month+1).padStart(2,'0')}-${dia}`;
      if (d.classList.contains('presente')) dias[key] = 'presente';
      if (d.classList.contains('ausente'))  dias[key] = 'ausente';
    });
    try { await salvarPresencas(MPD_alunoId, MPD_courseId, dias); } catch(e){ console.warn(e); }
  }, 600);
}

// render do calendário no modal correto
async function mpdRenderCalendar(){
  const grid = document.getElementById('mpdGrid');
  const monthYear = document.getElementById('mpdMonthYear');
  if (!grid || !monthYear) return;

  grid.querySelectorAll('.calendar-day').forEach(e => e.remove());

  const firstDay = new Date(MPD_year, MPD_month, 1);
  const lastDay  = new Date(MPD_year, MPD_month + 1, 0);
  const start    = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // começando na segunda
  const daysInMonth = lastDay.getDate();
  const prevLastDay = new Date(MPD_year, MPD_month, 0).getDate();

  monthYear.textContent = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  for (let x = start; x > 0; x--) {
    const d = document.createElement('div');
    d.className = 'calendar-day other-month';
    d.textContent = prevLastDay - x + 1;
    grid.appendChild(d);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = document.createElement('div');
    d.className = 'calendar-day';
    d.textContent = i;
    d.onclick = () => {
      if (!MPD_alunoId || !MPD_courseId) return;
      if (d.classList.contains('presente')) { d.classList.remove('presente'); d.classList.add('ausente'); }
      else if (d.classList.contains('ausente')) { d.classList.remove('ausente'); }
      else { d.classList.add('presente'); }
      mpdScheduleSave();
    };
    grid.appendChild(d);
  }
  const totalCells = grid.querySelectorAll('.calendar-day').length;
  const nextDays = 42 - totalCells;
  for (let i = 1; i <= nextDays; i++) {
    const d = document.createElement('div');
    d.className = 'calendar-day other-month';
    d.textContent = i;
    grid.appendChild(d);
  }

  // carrega marcações
  if (MPD_alunoId && MPD_courseId) {
    try {
      const presencas = await carregarPresencas(MPD_alunoId, MPD_courseId, MPD_year, MPD_month+1);
      for (const [data, status] of Object.entries(presencas)) {
        const dia = new Date(data).getDate();
        const cell = [...grid.querySelectorAll('.calendar-day')]
          .find(d => parseInt(d.textContent) === dia && !d.classList.contains('other-month'));
        if (cell && status) cell.classList.add(status);
      }
    } catch(e){ console.warn(e); }
  }
}

// abre o modal correto
async function openPresencaDia(cursoId=null, alunoId=null, alunoNomeFallback=null){
  const modal = document.getElementById('modalPresencaDia');
  const selCurso = document.getElementById('mpdCurso');
  const selAluno = document.getElementById('mpdAluno');
  const btnPrev  = document.getElementById('mpdPrev');
  const btnNext  = document.getElementById('mpdNext');
  const btnClose = document.getElementById('mpdClose');
  const btnCancel= document.getElementById('mpdCancel');

  if (!modal || !selCurso || !selAluno) {
    console.error('Estrutura do modalPresencaDia não encontrada no DOM.');
    return;
  }

  // popula cursos (com base no cache CURSOS)
  if (!window.CURSOS || !window.CURSOS.length) {
    try { window.CURSOS = await window.apiListCursos(); } catch(e){}
  }
  selCurso.innerHTML = window.CURSOS.length
    ? window.CURSOS.map(c => `<option value="${c.id}">${escapeHTML(c.nome)}</option>`).join('')
    : `<option value="">Erro ao carregar cursos</option>`;

  // estado inicial
  MPD_courseId = cursoId || (window.CURSOS[0]?.id ?? null);
  if (MPD_courseId) selCurso.value = String(MPD_courseId);

  selAluno.disabled = true;
  selAluno.innerHTML = `<option value="">Carregando...</option>`;

  // abre
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('is-visible'));

  // carregar alunos inscritos no curso selecionado
  async function loadAlunosDoCurso(selectAlunoId=null){
    selAluno.disabled = true;
    selAluno.innerHTML = `<option value="">Carregando...</option>`;
    const inscritos = MPD_courseId ? await apiInscritosDoCurso(MPD_courseId) : [];
    if (!inscritos.length) {
      selAluno.innerHTML = `<option value="">Sem inscritos</option>`;
      MPD_alunoId = null;
      await mpdRenderCalendar();
      return;
    }
    selAluno.innerHTML = inscritos.map(a => `<option value="${a.id}">${escapeHTML(a.nome)}</option>`).join('');
    selAluno.disabled = false;
    MPD_alunoId = selectAlunoId ? Number(selectAlunoId) : Number(inscritos[0].id);
    selAluno.value = String(MPD_alunoId);
    await mpdRenderCalendar();
  }

  await loadAlunosDoCurso(alunoId || null);

  // handlers
  btnPrev.onclick = () => { MPD_month--; if (MPD_month < 0) { MPD_month = 11; MPD_year--; } mpdRenderCalendar(); };
  btnNext.onclick = () => { MPD_month++; if (MPD_month > 11) { MPD_month = 0; MPD_year++; } mpdRenderCalendar(); };
  btnClose.onclick = btnCancel.onclick = () => { const m = document.getElementById('modalPresencaDia'); m.classList.remove('is-visible'); setTimeout(()=>m.hidden=true,180); };

  selCurso.onchange = async () => {
    MPD_courseId = selCurso.value ? Number(selCurso.value) : null;
    await loadAlunosDoCurso(null);
  };
  selAluno.onchange = async () => {
    MPD_alunoId = selAluno.value ? Number(selAluno.value) : null;
    await mpdRenderCalendar();
  };
}
