/* =========================================================
   RELATÓRIO GERAL — produção
   - Acadêmico: Segmento > Série > Turma > Aluno (SEM data)
   - Cursos Extracurriculares: por curso | por aluno
   - Financeiro e Logs/Ações
   - Exportações: CSV (front) e PDF (backend via DomPDF)
   ========================================================= */
(() => {
  const ROOT = document.querySelector('#view-relatorios');
  if (!ROOT) return;

  /* =========================
     CONFIG GERAL / ENDPOINTS
     ========================= */
  const API_BASE = (window.API && API.base) ? API.base : '/api';
  const ENDPOINTS = {
    // Acadêmico
    segmentos:     `${API_BASE}/academico/segmentos.php`,
    series:        `${API_BASE}/academico/series.php`,
    turmas:        `${API_BASE}/academico/turmas.php`,
    alunos:        `${API_BASE}/academico/alunos.php`,

    // Relatórios (POST)
    relAcademico:  `${API_BASE}/relatorios/academico.php`,
    relCursos:     `${API_BASE}/relatorios/cursos.php`,
    relFinanceiro: `${API_BASE}/relatorios/financeiro.php`,
    relLogs:       `${API_BASE}/relatorios/logs.php`,

    // Auxiliares
    users:         `${API_BASE}/relatorios/users.php`,
    cursos:        `${API_BASE}/cursos_extracurriculares/index.php`,

    // Exportação PDF
    exportPDF:     `${API_BASE}/relatorios/export_pdf.php`,
  };

  const state = {
    currentTipo: 'academico',
    currentCursosTab: 'curso',
    last: {}
  };

  /* =======================
     HTTP helpers
     ======================= */
  const unbox = (resp) => (resp && typeof resp === 'object' && 'data' in resp ? resp.data : resp) || {};

  async function httpGet(url, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const full = qs ? `${url}?${qs}` : url;
    const resp = await fetch(full, { credentials:'include' });
    if (!resp.ok) throw new Error(`GET ${url} -> ${resp.status}`);
    return await resp.json();
  }

  async function httpPost(url, payload) {
    const resp = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (!resp.ok) throw new Error(`POST ${url} -> ${resp.status}`);
    const ct = resp.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) return await resp.json();
    return await resp.blob(); // PDF
  }

  /* ===============
     DOM helpers
     =============== */
  const $  = (s, r=ROOT) => r.querySelector(s);
  const $$ = (s, r=ROOT) => Array.from(r.querySelectorAll(s));
  const show = el => { if (el) { el.hidden=false; el.style.display=''; } };
  const hide = el => { if (el) { el.hidden=true;  el.style.display='none'; } };
  const setBusy = (btn, label='Processando…') => { if(!btn) return; btn.disabled=true; btn.dataset.old=btn.innerHTML; btn.innerHTML=`<i class="ri-loader-4-line ri-spin"></i> ${label}`; };
  const unsetBusy = (btn) => { if(!btn) return; btn.disabled=false; btn.innerHTML=btn.dataset.old||btn.innerHTML; };
  const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

  /* ===============
     Refs principais
     =============== */
  const refs = {
    tipo:    $('#rgTipo'),
    btnCSV:  $('#rgExportCSV'),
    btnPDF:  $('#rgExportPDF'),
    pAcad:   $('#panel-academico'),
    pCursos: $('#panel-cursos'),
    pFin:    $('#panel-financeiro'),
    pLogs:   $('#panel-logs'),
  };

  // Acadêmico
  const ac = {
    seg:   $('#acSeg'),
    serie: $('#acSerie'),
    turma: $('#acTurma'),
    aluno: $('#acAluno'),
    escopo: $('#acEscopo'),
    dtI:    $('#acDataIni'),  // não usamos
    dtF:    $('#acDataFim'),  // não usamos
    vis:    $('#acVis'),
    hrI:    $('#acHrIni'),
    hrF:    $('#acHrFim'),
    ref:    $('#acRef'),
    filtrosAlunoCard: $('#ac-filtros-aluno'),
    kpis:         $('#ac-kpis'),
    chartsWrap:   $('#ac-charts'),
    chartCanvas:  $('#acChartPizza'),
    table:        $('#ac-table'),
  };

  // Cursos
  const cx = {
    tabs:        $$('.tab', $('#panel-cursos')),
    panes:       $$('.tabpane', $('#panel-cursos')),
    curso:       $('#cxCurso'),
    prof:        $('#cxProf'),
    periodo:     $('#cxPeriodo'),
    tableCurso:  $('#cx-table-curso'),
    totalCurso:  $('#cx-total'),
    aluno:       $('#cxAluno'),
    dataI:       $('#cxDataI'),
    dataF:       $('#cxDataF'),
    chartAluno:  $('#cxChartPizzaAluno'),
    tableAluno:  $('#cx-table-aluno'),
    kpiMat:      $('#cx-kpi-matriculas strong'),
    kpiValor:    $('#cx-kpi-valor strong'),
    kpiAtivos:   $('#cx-kpi-ativos strong'),
    kpiInativos: $('#cx-kpi-inativos strong'),
  };

  // Financeiro
  const fi = {
    periodo: $('#fiPeriodo'),
    dataI:   $('#fiDataI'),
    dataF:   $('#fiDataF'),
    table:   $('#fi-table'),
    kTotPeriodo: $('#fi-kpi-periodo strong'),
    kRecebido:   $('#fi-kpi-recebido strong'),
    kAberto:     $('#fi-kpi-aberto strong'),
    kTicket:     $('#fi-kpi-ticket strong'),
  };

  /* ==================================
     Logs — usuários + filtros
     ================================== */
  const lg = {
    user:  document.getElementById('lgUser'),
    acao:  document.getElementById('lgAcao'),
    ini:   document.getElementById('lgDataIni'),
    fim:   document.getElementById('lgDataFim'),
    q:     document.getElementById('lgBusca'),
    view:  document.getElementById('lgView'),
    lista: document.getElementById('listaLog')
  };

  async function carregarUsuariosLogs() {
    try {
      const r = unbox(await httpGet(ENDPOINTS.users));
      const items = r.items || [];
      if (!lg.user) return;

      if (lg.user.tagName && lg.user.tagName.toUpperCase() === 'SELECT') {
        lg.user.innerHTML = '<option value="">Qualquer</option>';
        items.forEach(u => {
          const opt = document.createElement('option');
          opt.value = String(u.id);
          opt.textContent = u.label || `${u.nome} <${u.email}>`;
          lg.user.appendChild(opt);
        });
      } else {
        const idList = 'lgUserList';
        let dl = document.getElementById(idList);
        if (!dl) {
          dl = document.createElement('datalist');
          dl.id = idList;
          (ROOT || document.body).appendChild(dl);
          lg.user.setAttribute('list', idList);
        }
        dl.innerHTML = '';
        items.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.label || `${u.nome} <${u.email}>`;
          dl.appendChild(opt);
        });
      }
    } catch (e) {
      console.error('Falha ao carregar usuários para logs:', e);
    }
  }

  function renderizarLogs(items) {
    if (!lg.lista) return;
    lg.lista.innerHTML =
      (items.map(item => `
        <div class="audit__item" style="border-left-color:${corDaAcao(item.action)}">
          <i class="ri-history-line"></i>
          <div>
            <strong>${item.user_label || item.user || '—'}</strong> — ${item.action}
            <small>${item.created_at}</small>
            <div class="muted">${item.message || ''}</div>
          </div>
        </div>
      `).join('')) || '<div class="muted">Nenhuma ocorrência.</div>';
  }
  function corDaAcao(action) {
    switch (action) {
      case 'create': return '#22c55e';
      case 'update': return '#eab308';
      case 'delete': return '#ef4444';
      case 'import': return '#3b82f6';
      default: return 'transparent';
    }
  }

  const debouncedApplyLogs = debounce(aplicarFiltrosLog, 250);

  async function aplicarFiltrosLog() {
    try {
      const userId = (lg.user && lg.user.tagName && lg.user.tagName.toUpperCase()==='SELECT' && lg.user.value)
        ? parseInt(lg.user.value,10) : null;

      const payload = {
        acao:     lg.acao?.value || '',
        user_id:  userId,
        data_ini: lg.ini?.value || null,
        data_fim: lg.fim?.value || null,
        q:        lg.q?.value || ''
      };

      const res = unbox(await httpPost(ENDPOINTS.relLogs, payload));
      const items = res.items || [];
      renderizarLogs(items);

      // mantém cache para exportações
      const cols = [
        {key:'dt',       label:'Data/Hora'},
        {key:'user',     label:'Usuário'},
        {key:'acao',     label:'Ação'},
        {key:'detalhes', label:'Detalhes'},
        {key:'origem',   label:'Origem'},
      ];
      // Normaliza para colunas acima
      const rows = items.map(it => ({
        dt: it.created_at || it.dt || '',
        user: it.user_label || it.user || '',
        acao: it.action || it.acao || '',
        detalhes: it.message || it.detalhes || '',
        origem: it.origin || it.origem || ''
      }));
      state.last['logs'] = { columns: cols, rows };
    } catch (e) {
      console.error('Falha ao carregar logs filtrados:', e);
    }
  }

  // Listeners de logs
  ['change'].forEach(evt => {
    [lg.user, lg.acao, lg.ini, lg.fim, lg.view].forEach(el => el?.addEventListener(evt, aplicarFiltrosLog));
  });
  ['input', 'keyup'].forEach(evt => {
    [lg.user, lg.q].forEach(el => el?.addEventListener(evt, debouncedApplyLogs));
  });
  lg.q?.addEventListener('keydown', (e) => { if (e.key === 'Enter') aplicarFiltrosLog(); });

  /* ============================
     Render helpers
     ============================ */
  function renderTable(tableEl, columns, rows) {
    if (!tableEl) return;
    const thead = tableEl.querySelector('thead > tr');
    const tbody = tableEl.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      thead.appendChild(th);
    });
    (rows||[]).forEach(obj => {
      const tr = document.createElement('tr');
      columns.forEach(col => {
        const td = document.createElement('td');
        const v = obj[col.key];
        td.textContent = (v===undefined || v===null || v==='') ? '—' : String(v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  function setKPIsAcad(kpis) {
    const items = $$('.kpi', ac.kpis);
    if (items[0]) items[0].querySelector('strong').textContent = (kpis?.total ?? '--');
    if (items[1]) items[1].querySelector('strong').textContent = (kpis?.presenca_pct != null ? `${kpis.presenca_pct}%` : '--');
    if (items[2]) items[2].querySelector('strong').textContent = (kpis?.refeicoes ?? '--');
    if (items[3]) items[3].querySelector('strong').textContent = (kpis?.med_entrada ?? '--');
    if (items[4]) items[4].querySelector('strong').textContent = (kpis?.med_saida ?? '--');
  }

  /* ==================================
     GERADORES
     ================================== */
  async function gerarAcademico() {
    const payload = {
      segment_id: ac.seg?.value || null,
      series_id:  ac.serie?.value || null,
      turma_id:   ac.turma?.value || null,
      aluno_q:    (ac.aluno?.value || '').trim() || null,
      data_ini:   null, // SEM datas
      data_fim:   null,
      hora_entrada_min: ac.hrI?.value || null,
      hora_saida_max:   ac.hrF?.value || null,
      refeicao:   ac.ref?.value || '',
      escopo:     'por-aluno',
      vis:        'tabela'
    };

    let r;
    try { r = unbox(await httpPost(ENDPOINTS.relAcademico, payload)); }
    catch (e) { console.error('Acadêmico falhou:', e); r = {items: [], kpis: {}}; }

    const cols = [
      {key:'aluno',    label:'Aluno'},
      {key:'serie',    label:'Série'},
      {key:'turma',    label:'Turma'},
      {key:'entrada',  label:'Entrada'},
      {key:'saida',    label:'Saída'},
      {key:'refeicao', label:'Refeição'}
    ];
    renderTable(ac.table, cols, r.items || []);
    state.last['academico'] = { columns: cols, rows: r.items || [] };
    setKPIsAcad(r.kpis || null);
    hide(ac.chartsWrap);
  }

  async function gerarCursos() {
    if (state.currentCursosTab === 'curso') {
      const payload = {
        modo: 'curso',
        curso_id: cx.curso.value || null,
        professor_id: cx.prof.value || null,
        periodo: cx.periodo.value || null,
      };
      let r;
      try { r = unbox(await httpPost(ENDPOINTS.relCursos, payload)); }
      catch (e) { console.error('Cursos/curso falhou:', e); r = {items: [], total: 0}; }

      const cols = [
        {key:'professor', label:'Professor'},
        {key:'aluno', label:'Aluno'},
        {key:'responsavel', label:'Responsável'},
        {key:'status', label:'Status'},
        {key:'valor', label:'Valor Matrícula'},
      ];
      const rows = (r.items||[]).map(i => ({...i, valor:(+i.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}));
      renderTable(cx.tableCurso, cols, rows);
      state.last['cursos-curso'] = { columns: cols, rows };

      const total = r.total || (r.items||[]).reduce((a,b)=>a+(+b.valor||0),0);
      if (cx.totalCurso) cx.totalCurso.textContent = total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

      if (cx.kpiMat)      cx.kpiMat.textContent   = (r.matriculas ?? '--');
      if (cx.kpiValor)    cx.kpiValor.textContent = (total || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      if (cx.kpiAtivos)   cx.kpiAtivos.textContent   = (r.ativos ?? '--');
      if (cx.kpiInativos) cx.kpiInativos.textContent = (r.inativos ?? '--');

    } else {
      const payload = {
        modo: 'aluno',
        aluno_q: (cx.aluno.value||'').trim() || null,
        data_ini: cx.dataI.value || null,
        data_fim: cx.dataF.value || null,
      };
      let r;
      try { r = unbox(await httpPost(ENDPOINTS.relCursos, payload)); }
      catch (e) { console.error('Cursos/aluno falhou:', e); r = {items: []}; }

      const cols = [
        {key:'aluno', label:'Aluno'},
        {key:'responsavel', label:'Responsável'},
        {key:'cursos_presentes', label:'Cursos Presentes'},
        {key:'professor', label:'Professor'},
      ];
      const rows = r.items || [];
      renderTable(cx.tableAluno, cols, rows);
      state.last['cursos-aluno'] = { columns: cols, rows };

      if (r.pizza && cx.chartAluno) {
        upsertDoughnut(cx.chartAluno, r.pizza.labels||[], r.pizza.data||[]);
      }
    }
  }

  async function gerarFinanceiro() {
    let r;
    try {
      r = unbox(await httpPost(ENDPOINTS.relFinanceiro, {
        periodo: fi.periodo.value || null,
        data_ini: fi.dataI.value || null,
        data_fim: fi.dataF.value || null,
      }));
    } catch (e) {
      console.error('Financeiro falhou:', e);
      r = {items: [], totais: {periodo:0, recebido:0, aberto:0, ticket:0}};
    }

    const cols = [
      {key:'origem', label:'Origem'},
      {key:'descricao', label:'Descrição'},
      {key:'data', label:'Data'},
      {key:'valor', label:'Valor'},
      {key:'status', label:'Status'},
    ];
    const rows = (r.items||[]).map(x => ({...x, valor:(+x.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}));
    renderTable(fi.table, cols, rows);
    state.last['financeiro'] = { columns: cols, rows };

    const tot = r.totais || {};
    if (fi.kTotPeriodo) fi.kTotPeriodo.textContent = (tot.periodo ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    if (fi.kRecebido)   fi.kRecebido.textContent   = (tot.recebido ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    if (fi.kAberto)     fi.kAberto.textContent     = (tot.aberto ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    if (fi.kTicket)     fi.kTicket.textContent     = (tot.ticket ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }

  async function gerarLogs() {
    // Apenas reutiliza a função de filtros para obter e renderizar + preencher cache.
    await aplicarFiltrosLog();
  }

  function gerarRelatorioAtual() {
    const t = refs.tipo.value;
    if (t==='academico')  return gerarAcademico();
    if (t==='cursos')     return gerarCursos();
    if (t==='financeiro') return gerarFinanceiro();
    if (t==='logs')       return gerarLogs();
  }

  /* ===========================
     Exportações CSV e PDF
     =========================== */
  function collectCurrentTableEl() {
    let tableWrap;
    const t = refs.tipo.value;
    if (t==='academico') tableWrap = $('#panel-academico .table-wrap');
    if (t==='cursos') {
      tableWrap = (state.currentCursosTab==='curso')
        ? $('#panel-cursos [data-pane="curso"] .table-wrap')
        : $('#panel-cursos [data-pane="aluno"] .table-wrap');
    }
    if (t==='financeiro') tableWrap = $('#panel-financeiro .table-wrap');
    if (t==='logs')       tableWrap = $('#panel-logs .table-wrap'); // pode não existir
    const table = tableWrap ? tableWrap.querySelector('table') : null;
    return table || null;
  }

  function exportCSVFromCurrent() {
    const table = collectCurrentTableEl();
    // Para Logs pode não haver tabela — aí usamos cache no PDF/CSV gerado via refetch abaixo.
    if (!table) {
      // fallback: se houver cache, gera CSV dele
      const key = currentCacheKey();
      const cached = state.last[key];
      if (!cached || !cached.rows?.length) { alert('Nada para exportar.'); return; }
      const headers = cached.columns.map(c => c.label);
      const rows = cached.rows.map(r => cached.columns.map(c => String(r[c.key] ?? '')));
      const csv = [
        '\uFEFF' + headers.join(';'),
        ...rows.map(r => r.map(v => (String(v).includes(';') ? `"${String(v).replace(/"/g,'""')}"` : v)).join(';'))
      ].join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.href = url; a.download = `relatorio-${refs.tipo.value}-${stamp}.csv`; a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
    );
    if (!rows.length) { alert('Nada para exportar.'); return; }

    const csv = [
      '\uFEFF' + headers.join(';'),
      ...rows.map(r => r.map(v => (String(v).includes(';') ? `"${String(v).replace(/"/g,'""')}"` : v)).join(';'))
    ].join('\n');

    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.href = url; a.download = `relatorio-${refs.tipo.value}-${stamp}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function currentCacheKey() {
    const t = refs.tipo.value;
    if (t === 'cursos') return (state.currentCursosTab === 'curso') ? 'cursos-curso' : 'cursos-aluno';
    return t; // 'academico' | 'financeiro' | 'logs'
  }

  async function refetchForCurrentAndCache() {
    const t = refs.tipo.value;
    try {
      if (t === 'academico') {
        const resp = unbox(await httpPost(ENDPOINTS.relAcademico, {
          segment_id: ac.seg?.value || null,
          series_id:  ac.serie?.value || null,
          turma_id:   ac.turma?.value || null,
          aluno_q:    (ac.aluno?.value||'').trim() || null,
          data_ini:   null, data_fim: null,
          hora_entrada_min: ac.hrI?.value || null,
          hora_saida_max:   ac.hrF?.value || null,
          refeicao:   ac.ref?.value || '',
          escopo:     'por-aluno', vis: 'tabela',
        }));
        const cols = [
          {key:'aluno',    label:'Aluno'},
          {key:'serie',    label:'Série'},
          {key:'turma',    label:'Turma'},
          {key:'entrada',  label:'Entrada'},
          {key:'saida',    label:'Saída'},
          {key:'refeicao', label:'Refeição'}
        ];
        state.last['academico'] = { columns: cols, rows: resp.items || [] };
        return state.last['academico'];
      }

      if (t === 'cursos') {
        if (state.currentCursosTab === 'curso') {
          const r = unbox(await httpPost(ENDPOINTS.relCursos, {
            modo: 'curso',
            curso_id: cx.curso.value || null,
            professor_id: cx.prof.value || null,
            periodo: cx.periodo.value || null,
          }));
          const cols = [
            {key:'professor', label:'Professor'},
            {key:'aluno', label:'Aluno'},
            {key:'responsavel', label:'Responsável'},
            {key:'status', label:'Status'},
            {key:'valor', label:'Valor Matrícula'},
          ];
          const rows = (r.items||[]).map(i => ({...i, valor:(+i.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}));
          state.last['cursos-curso'] = { columns: cols, rows };
          return state.last['cursos-curso'];
        } else {
          const r = unbox(await httpPost(ENDPOINTS.relCursos, {
            modo: 'aluno',
            aluno_q: (cx.aluno.value||'').trim() || null,
            data_ini: cx.dataI.value || null,
            data_fim: cx.dataF.value || null,
          }));
          const cols = [
            {key:'aluno', label:'Aluno'},
            {key:'responsavel', label:'Responsável'},
            {key:'cursos_presentes', label:'Cursos Presentes'},
            {key:'professor', label:'Professor'},
          ];
          state.last['cursos-aluno'] = { columns: cols, rows: r.items || [] };
          return state.last['cursos-aluno'];
        }
      }

      if (t === 'financeiro') {
        const r = unbox(await httpPost(ENDPOINTS.relFinanceiro, {
          periodo: fi.periodo.value || null,
          data_ini: fi.dataI.value || null,
          data_fim: fi.dataF.value || null,
        }));
        const cols = [
          {key:'origem', label:'Origem'},
          {key:'descricao', label:'Descrição'},
          {key:'data', label:'Data'},
          {key:'valor', label:'Valor'},
          {key:'status', label:'Status'},
        ];
        const rows = (r.items||[]).map(x => ({...x, valor:(+x.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}));
        state.last['financeiro'] = { columns: cols, rows };
        return state.last['financeiro'];
      }

      if (t === 'logs') {
        const userId = (lg.user && lg.user.tagName && lg.user.tagName.toUpperCase()==='SELECT' && lg.user.value)
          ? parseInt(lg.user.value,10) : null;
        const r = unbox(await httpPost(ENDPOINTS.relLogs, {
          acao:  lg.acao?.value || '',
          user_id: userId,
          data_ini: lg.ini?.value || null,
          data_fim: lg.fim?.value || null,
          q: lg.q?.value || ''
        }));
        const cols = [
          {key:'dt',       label:'Data/Hora'},
          {key:'user',     label:'Usuário'},
          {key:'acao',     label:'Ação'},
          {key:'detalhes', label:'Detalhes'},
          {key:'origem',   label:'Origem'},
        ];
        const rows = (r.items||[]).map(it => ({
          dt: it.created_at || it.dt || '',
          user: it.user_label || it.user || '',
          acao: it.action || it.acao || '',
          detalhes: it.message || it.detalhes || '',
          origem: it.origin || it.origem || ''
        }));
        state.last['logs'] = { columns: cols, rows };
        return state.last['logs'];
      }
    } catch (err) {
      console.error('Refetch para export falhou:', err);
    }
    return { columns: [], rows: [] };
  }

  function collectPDFPayloadFromCurrent() {
    const key = currentCacheKey();
    const cached = state.last[key];
    if (cached && Array.isArray(cached.columns) && cached.columns.length && Array.isArray(cached.rows)) {
      return { columns: cached.columns, rows: cached.rows };
    }
    const table = collectCurrentTableEl();
    if (table) {
      const slug = (s) => (s||'')
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
      const labels = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      const keys   = labels.map(l => slug(l) || 'col');
      const columns = labels.map((label, i) => ({ key: keys[i], label }));
      const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
        const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
        const obj = {}; keys.forEach((k, i) => { obj[k] = (tds[i] ?? ''); });
        return obj;
      });
      if (columns.length && rows.length) return { columns, rows };
    }
    return { columns: [], rows: [] };
  }

  async function exportPDFFromCurrent() {
    let {columns, rows} = collectPDFPayloadFromCurrent();
    if (!columns.length || !rows.length) {
      const fresh = await refetchForCurrentAndCache();
      columns = fresh.columns || [];
      rows    = fresh.rows || [];
    }
    if (!columns.length || !rows.length) { alert('Nada para exportar.'); return; }

    const tipo = refs.tipo.value;
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const filename = `relatorio-${tipo}-${stamp}.pdf`;

    const titleMap = {
      academico: 'Relatório — Estrutura Acadêmica / Alunos',
      cursos: 'Relatório — Cursos Extracurriculares',
      financeiro: 'Relatório — Financeiro',
      logs: 'Relatório — Logs / Ações'
    };

    const userText =
      (lg.user && lg.user.tagName && lg.user.tagName.toUpperCase()==='SELECT')
        ? (lg.user.selectedOptions?.[0]?.text || '—')
        : (lg.user?.value || '—');

    const subtitle =
      (tipo==='academico')  ? `Escopo: Por Aluno  |  Segmento: ${ac.seg?.selectedOptions?.[0]?.text || '—'}  |  Série: ${ac.serie?.selectedOptions?.[0]?.text || '—'}  |  Turma: ${ac.turma?.selectedOptions?.[0]?.text || '—'}`
    : (tipo==='cursos' && state.currentCursosTab==='curso') ? `Curso: ${cx.curso?.selectedOptions?.[0]?.text || '—'}  |  Mês: ${cx.periodo?.value||'—'}`
    : (tipo==='cursos' && state.currentCursosTab!=='curso') ? `Aluno: ${cx.aluno?.value||'—'}`
    : (tipo==='financeiro') ? `Período: ${fi.periodo?.value||'—'} / ${fi.dataI?.value||'—'} a ${fi.dataF?.value||'—'}`
    : (tipo==='logs')       ? `Ação: ${lg.acao?.value||'—'}  |  Usuário: ${userText}  |  ${lg.ini?.value||'—'} a ${lg.fim?.value||'—'}`
    : '';

    const payload = {
      filename,
      title: titleMap[tipo] || 'Relatório',
      subtitle,
      footer: 'Gestão do Horário Integral',
      orientation: 'landscape',
      paper: 'A4',
      download: true,
      columns,
      rows
    };

    try {
      setBusy(refs.btnPDF, 'Gerando PDF…');
      const respBlob = await httpPost(ENDPOINTS.exportPDF, payload);
      const blob = respBlob instanceof Blob ? respBlob : new Blob([respBlob], {type:'application/pdf'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = payload.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export PDF falhou:', err);
      alert('Falha ao gerar PDF.');
    } finally {
      unsetBusy(refs.btnPDF);
    }
  }

  function bindExportButtons() {
    refs.btnCSV?.addEventListener('click', (ev) => {
      setBusy(ev.currentTarget, 'Gerando CSV…');
      setTimeout(() => { exportCSVFromCurrent(); unsetBusy(ev.currentTarget); }, 80);
    });
    refs.btnPDF?.addEventListener('click', exportPDFFromCurrent);
  }

  /* =============
     Inicialização
     ============= */
  async function init() {
    syncPanels();
    if (ac.escopo) ac.escopo.value = 'por-aluno';
    if (ac.vis)    ac.vis.value    = 'tabela';

    await carregarSegmentos();
    await carregarCursosProfessores();
    await carregarUsuariosLogs();

    bindTipoChange();
    bindHierarquia();
    bindTabsCursos();
    bindCursosInputs();
    bindExportButtons();

    gerarRelatorioAtual();

    // Corrigido: campos corretos (ini/fim) e debounce único
    [lg.acao, lg.user, lg.ini, lg.fim].forEach(el => el && el.addEventListener('input', debounce(gerarRelatorioAtual, 250)));
    if (lg.user && lg.user.tagName && lg.user.tagName.toUpperCase()==='SELECT') {
      lg.user.addEventListener('change', gerarRelatorioAtual);
    }
  }

  function syncPanels() {
    const t = refs.tipo.value;
    state.currentTipo = t;

    hide(refs.pAcad); hide(refs.pCursos); hide(refs.pFin); hide(refs.pLogs);
    if (t==='academico')  show(refs.pAcad);
    if (t==='cursos')     show(refs.pCursos);
    if (t==='financeiro') show(refs.pFin);
    if (t==='logs')       show(refs.pLogs);

    if (t==='academico') {
      if (ac.escopo) ac.escopo.value = 'por-aluno';
      if (ac.vis)    ac.vis.value    = 'tabela';
      show(ac.filtrosAlunoCard);
      hide(ac.chartsWrap);
    }
  }
  function bindTipoChange() {
    refs.tipo?.addEventListener('change', () => { syncPanels(); gerarRelatorioAtual(); });
  }

  function popularSelect(sel, arr, emptyLabel='Todos') {
    if (!sel) return;
    sel.innerHTML = `<option value="">${emptyLabel}</option>`;
    (arr||[]).forEach(it => {
      const opt = document.createElement('option');
      opt.value = String(it.id);
      opt.textContent = it.nome;
      sel.appendChild(opt);
    });
  }
  function popularAlunosPlaceholder(arr) {
    if (!ac.aluno) return;
    ac.aluno.placeholder = 'Nome do aluno…';
    ac.aluno.dataset.list = JSON.stringify((arr||[]).map(a=>a.nome));
  }

  async function carregarSegmentos() {
    const r = unbox(await httpGet(ENDPOINTS.segmentos));
    popularSelect(ac.seg, r.items || [], 'Todos');
    if (ac.serie) ac.serie.disabled = true;
    if (ac.turma) ac.turma.disabled = true;
    popularSelect(ac.serie, [], 'Todas');
    popularSelect(ac.turma, [], 'Todas');
    popularAlunosPlaceholder([]);
  }
  async function carregarSeries() {
    const segId = ac.seg?.value || '';
    const r = unbox(await httpGet(ENDPOINTS.series, segId ? {segment_id: segId} : {}));
    popularSelect(ac.serie, r.items || [], 'Todas');
    if (ac.serie) ac.serie.disabled = false;
    if (ac.turma) ac.turma.disabled = true;
    popularSelect(ac.turma, [], 'Todas');
    popularAlunosPlaceholder([]);
    gerarRelatorioAtual();
  }
  async function carregarTurmas() {
    const serieId = ac.serie?.value || '';
    const r = unbox(await httpGet(ENDPOINTS.turmas, serieId ? {series_id: serieId} : {}));
    popularSelect(ac.turma, r.items || [], 'Todas');
    if (ac.turma) ac.turma.disabled = false;
    popularAlunosPlaceholder([]);
    gerarRelatorioAtual();
  }
  async function carregarAlunos() {
    const turmaId = ac.turma?.value || '';
    const r = unbox(await httpGet(ENDPOINTS.alunos, turmaId ? {turma_id: turmaId} : {}));
    popularAlunosPlaceholder(r.items || []);
    gerarRelatorioAtual();
  }
  function bindHierarquia() {
    ac.seg?.addEventListener('change', carregarSeries);
    ac.serie?.addEventListener('change', carregarTurmas);
    ac.turma?.addEventListener('change', carregarAlunos);
    [ac.aluno, ac.hrI, ac.hrF, ac.ref].forEach(el =>
      el && el.addEventListener('input', debounce(gerarRelatorioAtual, 250))
    );
  }

  function bindTabsCursos() {
    cx.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        cx.tabs.forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        state.currentCursosTab = tab.dataset.tab; // 'curso' | 'aluno'
        cx.panes.forEach(p => p.hidden = (p.dataset.pane !== state.currentCursosTab));
        gerarRelatorioAtual();
      });
    });
  }
  async function carregarCursosProfessores() {
    const rc = unbox(await httpGet(ENDPOINTS.cursos));
    const cursos = rc.items || [];

    const normCursos = cursos.map(c => ({
      id:   c.id || c.curso_id,
      nome: c.nome || c.curso_nome || `(${c.id||c.curso_id})`
    })).filter(x => x.id);
    popularSelect(cx.curso, normCursos, 'Selecione…');

    const profSet = new Set(cursos.map(c => (c.professor_nome || '').toString().trim()).filter(Boolean));
    const profs = Array.from(profSet).map((nome, i) => ({ id: nome || `p${i+1}`, nome }));
    popularSelect(cx.prof, profs, 'Qualquer');
  }
  function bindCursosInputs() {
    [cx.curso, cx.prof, cx.periodo, cx.aluno, cx.dataI, cx.dataF].forEach(el =>
      el && el.addEventListener('input', debounce(gerarRelatorioAtual, 250))
    );
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
