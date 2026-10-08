const THEME_STORAGE_KEY = 'systemcollege-theme';

function setupThemeToggle() {
  const toggle = document.getElementById('themeToggleDashboard');
  if (!toggle) return;

  const sync = () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
    toggle.querySelector('i').className = isDark ? 'ri-sun-line' : 'ri-moon-clear-line';
    toggle.querySelector('span').textContent = isDark ? 'Tema claro' : 'Tema escuro';
  };

  toggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_STORAGE_KEY, next);
    sync();
  });

  sync();
}

function setView(viewName) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('is-visible');
    v.style.display = 'none';
  });
  const target = document.querySelector(`#view-${viewName}`);
  if (target) {
    target.classList.add('is-visible');
    target.style.display = '';
  }

  document.querySelectorAll('.nav__item').forEach(b => b.classList.remove('is-active'));
  const btn = document.querySelector(`.nav__item[data-view="${viewName}"]`);
  if (btn) btn.classList.add('is-active');

  const title = document.querySelector('.page__header .title');
  if (title) {
    const labels = {
      dashboard:  '<i class="ri-home-8-line"></i> Visão Geral',
      alunos:     '<i class="ri-user-3-line"></i> Gestão de Alunos',
      calc:       '<i class="ri-calculator-line"></i> Calculadora de Orçamento',
      admin:      '<i class="ri-shield-keyhole-line"></i> Administração & Segurança',
      academico:  '<i class="ri-node-tree"></i> Estrutura Acadêmica',
      integral:   '<i class="ri-time-line"></i> Horário Integral',
      cursos:     '<i class="ri-booklet-line"></i> Cursos Extracurriculares',
      financeiro: '<i class="ri-money-dollar-circle-line"></i> Financeiro',
      relatorios: '<i class="ri-pie-chart-2-line"></i> Relatórios & Análise',
      ferramentas:'<i class="ri-tools-line"></i> Ferramentas de Sistema',
      config:     '<i class="ri-settings-3-line"></i> Configurações',
      logs:       '<i class="ri-history-line"></i> Log de Auditoria'
    };
    title.innerHTML = labels[viewName] || '—';
  }

  if (viewName === 'dashboard')  loadDashboard();
  if (viewName === 'alunos')     loadAcademicoTree();
  if (viewName === 'financeiro') carregarFinanceiro();
  if (viewName === 'academico')  loadAcademicoTree();
}
document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  // Inicia com o dashboard (já é o padrão na função setView)
  setView('dashboard');
  
  document.querySelectorAll('.nav__item').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.documentElement.style.visibility = 'visible';
});

async function loadDashboard() {
  try {
    const arv = await API.get('/academico/arvore.php');
    const segmentos = arv.data?.segmentos || arv.segmentos || [];
    let totSegmentos = 0, totSeries = 0, totTurmas = 0, totAlunos = 0;

    totSegmentos = segmentos.length;
    segmentos.forEach(seg => {
      const series = seg.series || [];
      totSeries += series.length;
      series.forEach(ser => {
        const turmas = ser.turmas || [];
        totTurmas += turmas.length;
        turmas.forEach(t => {
          const alunos = t.alunos || t.items || [];
          totAlunos += Array.isArray(alunos) ? alunos.length : 0;
        });
      });
    });

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v.toLocaleString('pt-BR'); };
    set('kpiAlunos',     totAlunos);
    set('kpiTurmas',     totTurmas);
    set('kpiSeries',     totSeries);
    set('kpiSegmentos',  totSegmentos);

    const resumo = document.getElementById('dashResumo');
    if (resumo) {
      resumo.innerHTML = `
        <li>Total de Segmentos: <strong>${totSegmentos}</strong></li>
        <li>Total de Séries: <strong>${totSeries}</strong></li>
        <li>Total de Turmas: <strong>${totTurmas}</strong></li>
        <li>Total de Alunos: <strong>${totAlunos}</strong></li>
        <li class="muted">Dica: acesse <em>Relatórios</em> para detalhar por série/turma.</li>
      `;
    }

    const logsWrap = document.getElementById('dashLogs');
    if (logsWrap) {
      try {
        const lg = await API.get('/logs_listar.php');
        const items = (lg.data || []).slice(0, 5);
        logsWrap.innerHTML = items.length
          ? items.map(l => `
              <div class="audit__item" style="border-left:4px solid ${ ({create:'#3fb950',update:'#f1c40f',delete:'#e74c3c',import:'#3498db'}[l.acao] || '#777') }">
                <i class="${ ({create:'ri-add-circle-line',update:'ri-edit-line',delete:'ri-delete-bin-line',import:'ri-upload-cloud-line'}[l.acao] || 'ri-information-line') }"></i>
                <div><strong>${l.usuario}</strong> — ${l.texto?.length > 100 ? l.texto.slice(0,100)+'…' : (l.texto || '—')}
                  <small style="display:block;opacity:.7">${l.data || ''}</small>
                </div>
              </div>
            `).join('')
          : '<div class="muted">Sem registros recentes.</div>';
      } catch {
        logsWrap.textContent = 'Não foi possível carregar os logs.';
      }
    }
  } catch (e) {
    console.warn('Dashboard:', e);
    safeAlert('Não foi possível carregar o dashboard.');
  }
}


const API = {
  base: (document.querySelector('meta[name="api-base"]')?.content || '../api').replace(/\/+$/, ''),
  async get(path, opts = {}) {
    const url = `${this.base}${path}`;
    const r = await fetch(url, { credentials: 'include', ...opts });
    const text = await r.text();             // <- pega corpo como texto
    let j = null;
    try { j = JSON.parse(text); } catch {}
    if (!r.ok || j?.ok === false) {
      console.error('[API ERROR]', { url, status: r.status, statusText: r.statusText, body: text });
      // opcional: mostre parte do body numa toast
      throw new Error(`${r.status} ${r.statusText} — GET ${path}`);
    }
    return j ?? {};
  },
  async send(path, method = 'POST', body = null, headers = {}) {
    const url = `${this.base}${path}`;
    const opts = { method, credentials: 'include', headers: { ...headers } };
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }
    const r = await fetch(url, opts);
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch {}
    if (!r.ok || j?.ok === false) {
      console.error('[API ERROR]', { url, status: r.status, statusText: r.statusText, body: text });
      throw new Error(`${r.status} ${r.statusText} — ${method} ${path}`);
    }
    return j ?? {};
  }
};

window.API = API;
/* ================================
   Preços (padrão; sobrescrito pelo back)
================================ */
const PRICES = {
  mensal:   { maternal: 1600, fund1: 1400, fund2: 1350, medio: 1500 },
  hora:     { extra: 25 },
  refeicao: { almoco: 18, jantar: 15 },
  baseHorasDia: 5
};

// ==== ALERTA ÚNICO (substitui todos os outros) ====
window.safeAlert = function (msg, ms = 2200) {
  if (!msg) return;
  document.querySelectorAll('.nice-toast').forEach(el => el.remove());
  const toast = document.createElement('div');
  toast.className = 'nice-toast';
  toast.innerHTML = `<i class="ri-information-line"></i> ${msg}`;
  Object.assign(toast.style, {
    position:'fixed', left:'50%', bottom:'22px', transform:'translateX(-50%)',
    background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px',
    padding:'10px 16px', boxShadow:'0 6px 24px rgba(0,0,0,.15)',
    fontWeight:'600', color:'#111827', zIndex:9999, transition:'opacity .3s ease'
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, ms);
};

/* ================================
   Utils
================================ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reais = (v) => (isNaN(v) ? 0 : v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* Helper de single-bind para evitar listeners duplicados */
function bindOnce(el, type, handler, options) {
  if (!el) return;
  el.__bounds ||= {};
  const key = `${type}::${handler.name || 'anon'}`;
  if (el.__bounds[key]) return;
  el.addEventListener(type, handler, options);
  el.__bounds[key] = true;
}

/* ================================
   Boot: Auth guard + logout
================================ */
(async () => {
  const LOGIN_URL  = '../index.html';
  const ME_URL     = '/auth/me.php';
  const LOGOUT_URL = '/auth/logout.php';

  try {
    const r = await fetch(`${API.base}${ME_URL}`, { credentials: 'include' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) throw new Error('not-auth');

    const u = j.data?.user || j.user || null;
    const span = $('#userName');
    if (span && u?.nome) span.textContent = u.nome;
    else if (span && u?.email) span.textContent = u.email;

    document.documentElement.style.visibility = '';
  } catch {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace(`${LOGIN_URL}?next=${next}`);
    return;
  }

  $('#logoutBtn') && bindOnce($('#logoutBtn'), 'click', async function doLogout(){
    try { await fetch(`${API.base}${LOGOUT_URL}`, { method: 'POST', credentials: 'include' }); } catch {}
    location.href = LOGIN_URL;
  });
})();

/* ================================
   Calculadora (com Segmento + Séries dinâmicos)
================================ */
const segmentoSelect = document.getElementById('segmentoSelect');
const serieSelect    = document.getElementById('serieSelect');
const weekGrid       = document.getElementById('weekGrid');
const btnReplicar    = document.getElementById('btnReplicar');
const btnGerarPDF    = document.getElementById('btnGerar');

const DIAS = [
  { key: 'seg', nome: 'Segunda-feira', abrev: 'SEG' },
  { key: 'ter', nome: 'Terça-feira',   abrev: 'TER' },
  { key: 'qua', nome: 'Quarta-feira',  abrev: 'QUA' },
  { key: 'qui', nome: 'Quinta-feira',  abrev: 'QUI' },
  { key: 'sex', nome: 'Sexta-feira',   abrev: 'SEX' }
];
const HORARIOS = ['', '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];

const semana = {}; 
DIAS.forEach(d => (semana[d.key] = { in: '', out: '', almoco: false, jantar: false }));

/* ---------------------------------------------
   Carregar Segmentos e Séries
--------------------------------------------- */
async function carregarSegmentosCalc() {
  try {
    const r = await API.get('/academico/segmentos.php');
    const segs = r.data?.items || r.segmentos || [];
    segmentoSelect.innerHTML = '<option value="">Selecione o segmento</option>' +
      segs.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
  } catch (err) {
    segmentoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    console.warn('Erro ao carregar segmentos:', err);
  }
}

async function carregarSeriesCalc(segmentoId) {
  try {
    serieSelect.innerHTML = '<option value="">Carregando...</option>';
    const r = await API.get(`/financeiro/series.php?segmento_id=${segmentoId}`);
    const series = r.data?.items || [];

    // guarda preços globais
    window.PRICES = {
      hora: { extra: series[0]?.valor_hora_extra || 0 },
      refeicao: {
        almoco: series[0]?.valor_refeicao || 0,
        jantar: series[0]?.valor_refeicao_jantar || series[0]?.valor_refeicao || 0
      },
      baseHorasDia: 5
    };

    serieSelect.innerHTML = '<option value="">Selecione a série</option>' +
      series.map(s => `
        <option value="${s.id}"
                data-mensal="${s.mensalidade || 0}"
                data-hora-extra="${s.valor_hora_extra || 0}"
                data-almoco="${s.valor_refeicao || 0}"
                data-jantar="${s.valor_refeicao_jantar || s.valor_refeicao || 0}">
          ${s.nome}
        </option>
      `).join('');
  } catch (err) {
    serieSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

/* ---------------------------------------------
   Montar grade semanal
--------------------------------------------- */

function montarSemana(preservar = false) {
  if (!weekGrid) return;
  if (!preservar) weekGrid.innerHTML = '';

  DIAS.forEach(dia => {
    const st = semana[dia.key] || { in: '', out: '', almoco: false, jantar: false };

    let card = weekGrid.querySelector(`.day-card[data-day="${dia.key}"]`);
    if (!card || !preservar) {
      card = document.createElement('div');
      card.className = 'day-card';
      card.dataset.day = dia.key;
      card.innerHTML = `
        <div class="day-head">
          <div class="day-title">
            <i class="ri-calendar-check-line"></i>
            <div><div>${dia.nome}</div><span>${dia.abrev}</span></div>
          </div>
          <span class="badge"><i class="ri-timer-2-line"></i> <b data-resumo="${dia.key}">Sem horário</b></span>
        </div>
        <div class="day-body">
          <div>
            <label class="label small">Entrada</label>
            <div class="select">
              <select data-in="${dia.key}">
                ${HORARIOS.map(h => `<option value="${h}" ${st.in === h ? 'selected' : ''}>${h || 'Selecione'}</option>`).join('')}
              </select>
              <i class="ri-arrow-down-s-line"></i>
            </div>
          </div>
          <div>
            <label class="label small">Saída</label>
            <div class="select">
              <select data-out="${dia.key}">
                ${HORARIOS.map(h => `<option value="${h}" ${st.out === h ? 'selected' : ''}>${h || 'Selecione'}</option>`).join('')}
              </select>
              <i class="ri-arrow-down-s-line"></i>
            </div>
          </div>
          <div class="checks">
            <label class="check"><input type="checkbox" data-almoco="${dia.key}" ${st.almoco ? 'checked' : ''}> Almoço</label>
            <label class="check"><input type="checkbox" data-jantar="${dia.key}" ${st.jantar ? 'checked' : ''}> Jantar</label>
          </div>
          <div class="summary" data-summary="${dia.key}">Selecione horários e refeições</div>
        </div>
      `;
      if (!preservar) weekGrid.appendChild(card);
    }

    atualizarResumo(dia.key);
  });

  // Reanexa listeners sem duplicar
  weekGrid.querySelectorAll('select[data-in], select[data-out], input[data-almoco], input[data-jantar]')
    .forEach(el => {
      if (el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('change', e => {
        const key = el.dataset.in || el.dataset.out || el.dataset.almoco || el.dataset.jantar;
        const st = semana[key];
        if (el.dataset.in) st.in = el.value;
        if (el.dataset.out) st.out = el.value;
        if (el.dataset.almoco) st.almoco = el.checked;
        if (el.dataset.jantar) st.jantar = el.checked;
        atualizarResumo(key);
        calcular();
      });
    });
}

/* ---------------------------------------------
   Botão "Replicar Segunda-feira" (corrigido)
--------------------------------------------- */

btnReplicar && bindOnce(btnReplicar, 'click', function() {
  const base = { ...semana['seg'] };

  // Replica o estado lógico
  ['ter','qua','qui','sex'].forEach(k => {
    semana[k] = { ...base };
  });

  // Atualiza visualmente os selects e checkboxes existentes
  ['ter','qua','qui','sex'].forEach(k => {
    const card = weekGrid.querySelector(`.day-card[data-day="${k}"]`);
    if (!card) return;

    const selectIn  = card.querySelector(`select[data-in="${k}"]`);
    const selectOut = card.querySelector(`select[data-out="${k}"]`);
    const chkAlmoco = card.querySelector(`input[data-almoco="${k}"]`);
    const chkJantar = card.querySelector(`input[data-jantar="${k}"]`);

    if (selectIn)  selectIn.value  = base.in || '';
    if (selectOut) selectOut.value = base.out || '';
    if (chkAlmoco) chkAlmoco.checked = base.almoco || false;
    if (chkJantar) chkJantar.checked = base.jantar || false;

    atualizarResumo(k);
  });

  calcular();
});



/* ---------------------------------------------
   Helpers
--------------------------------------------- */
function mins(hhmm) { if (!hhmm) return 0; const [h,m] = hhmm.split(':').map(Number); return h*60+m; }
function pct(v) { const n = Math.min(100, Math.max(0, parseFloat(v || '0'))); return n/100; }

function atualizarResumo(k) {
  const st = semana[k];
  const elResumo  = document.querySelector(`[data-resumo="${k}"]`);
  const elSummary = document.querySelector(`[data-summary="${k}"]`);
  if (!st.in || !st.out) {
    if (elResumo)  elResumo.textContent  = 'Sem horário';
    if (elSummary) elSummary.textContent = 'Selecione horários e refeições';
    return;
  }
  const minutos = Math.max(0, mins(st.out) - mins(st.in));
  const horas = minutos / 60;
  const refeicoes = [st.almoco && 'Almoço', st.jantar && 'Jantar'].filter(Boolean).join(', ') || 'Sem refeições';
  if (elResumo)  elResumo.textContent  = `${horas.toFixed(1)}h`;
  if (elSummary) elSummary.textContent = `Entrada: ${st.in} • Saída: ${st.out} • ${refeicoes}`;
}

function calcular() {
  const serieId = serieSelect?.value || '';
  if (!serieId) return;

  const selected = serieSelect.selectedOptions[0];
  const mensal      = parseFloat(selected?.dataset.mensal || 0);
  const precoExtra  = parseFloat(selected?.dataset.horaExtra || PRICES?.hora?.extra || 10); // valor semanal já vem do banco
  const precoAlmoco = parseFloat(selected?.dataset.almoco || PRICES?.refeicao?.almoco || 0);
  const precoJantar = parseFloat(selected?.dataset.jantar || PRICES?.refeicao?.jantar || 0);
  const fatorMes    = 1; // continua sendo usado para refeições e mensalidade

  // --------------------------------------
  // 🔹 Cálculo semanal completo
  // --------------------------------------
  let horasTotais = 0, almocos = 0, jantares = 0;
  DIAS.forEach(d => {
    const st = semana[d.key] || {};
    if (st.in && st.out) {
      const horas = Math.max(0, (mins(st.out) - mins(st.in)) / 60);
      horasTotais += horas;
    }
    if (st.almoco) almocos++;
    if (st.jantar) jantares++;
  });

  // --------------------------------------
  // 🔹 Aplicar nova lógica de horas extras
  // --------------------------------------
  const horasExtras = Math.max(0, horasTotais - 20); // sempre subtrai 20h fixas
const valExtras = horasExtras * precoExtra * fatorMes;  // ⛔ Não multiplicar por 4.3 — já é semanal

  const valAlmoco = almocos * precoAlmoco * fatorMes;
  const valJantar = jantares * precoJantar * fatorMes;
  const tabela = mensal + valExtras + valAlmoco + valJantar;

  // --------------------------------------
  // 🔹 Descontos (%)
  // --------------------------------------
  const dMensal = pct($('#descMensalidade')?.value);
  const dExtras = pct($('#descExtras')?.value);
  const dAlmoco = pct($('#descAlmoco')?.value);
  const dJantar = pct($('#descJantar')?.value);

  const mensalDesc = mensal * (1 - dMensal);
  const extrasDesc = valExtras * (1 - dExtras);
  const almocoDesc = valAlmoco * (1 - dAlmoco);
  const jantarDesc = valJantar * (1 - dJantar);
  const final = mensalDesc + extrasDesc + almocoDesc + jantarDesc;

  // --------------------------------------
  // 🔹 Atualiza detalhamento visual
  // --------------------------------------
  $('#totHoras').textContent = horasExtras.toFixed(1);
  $('#totAlmocos').textContent = almocos;
  $('#totJantares').textContent = jantares;

  $('#precoSerie').textContent  = reais(mensal);
  $('#precoExtras').textContent = reais(valExtras);
  $('#precoAlmoco').textContent = reais(valAlmoco);
  $('#precoJantar').textContent = reais(valJantar);
  $('#valorTabela').textContent = reais(tabela);

  $('#mensalFinal').textContent = reais(mensalDesc);
  $('#extrasFinal').textContent = reais(extrasDesc);
  $('#almocoFinal').textContent = reais(almocoDesc);
  $('#jantarFinal').textContent = reais(jantarDesc);
  $('#valorFinal').textContent  = reais(final);

  const descGlobal = tabela > 0 ? (1 - final / tabela) * 100 : 0;
  $('#descGlobal').textContent = `Desconto Global: ${descGlobal.toFixed(1)}% (${reais(tabela - final)})`;
}



/* ---------------------------------------------
   Eventos principais
--------------------------------------------- */
segmentoSelect && bindOnce(segmentoSelect, 'change', e => {
  const segId = e.target.value;
  if (segId) carregarSeriesCalc(segId);
  serieSelect.innerHTML = '<option value="">Selecione o segmento primeiro</option>';
});

serieSelect && bindOnce(serieSelect, 'change', calcular);

btnReplicar && bindOnce(btnReplicar, 'click', function(){
  const base = { ...semana['seg'] };
  ['ter','qua','qui','sex'].forEach(k => semana[k] = { ...base });
  montarSemana();

  // ✅ Repinta os valores replicados visualmente
  DIAS.forEach(d => atualizarResumo(d.key));

  calcular();
});


['descMensalidade','descExtras','descAlmoco','descJantar'].forEach(id => {
  const el = document.getElementById(id);
  el && el.addEventListener('input', calcular);
});

btnGerarPDF && bindOnce(btnGerarPDF, 'click', async function gerarPDF(){
  try {
    const selected = serieSelect.selectedOptions[0];
    const mensal      = parseFloat(selected?.dataset.mensal || 0);
    const precoExtra  = parseFloat(selected?.dataset.horaExtra || PRICES?.hora?.extra || 0);
    const precoAlmoco = parseFloat(selected?.dataset.almoco || PRICES?.refeicao?.almoco || 0);
    const precoJantar = parseFloat(selected?.dataset.jantar || PRICES?.refeicao?.jantar || 0);

    const payload = {
      segmento: segmentoSelect?.value || '',
      serie: serieSelect?.value || '',
      week: semana,
      descontos: {
        mensal: +($('#descMensalidade')?.value || 0),
        extras: +($('#descExtras')?.value || 0),
        almoco: +($('#descAlmoco')?.value || 0),
        jantar: +($('#descJantar')?.value || 0)
      },
      // 🔹 Envia os valores reais da calculadora
      mensalidade: mensal,
      hora_extra: precoExtra,
      refeicao_almoco: precoAlmoco,
      refeicao_jantar: precoJantar
    };

    const r = await fetch(`${API.base}/calc/quote_pdf.php`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!r.ok) throw new Error('Falha ao gerar PDF');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    safeAlert(e.message || 'Erro ao gerar PDF');
  }
});


/* ---------------------------------------------
   Inicialização
--------------------------------------------- */
carregarSegmentosCalc();
montarSemana();

/* ================================
   Menu lateral (off-canvas)
================================ */
(() => {
  const sidebar  = document.querySelector('.sidebar');
  const btnMenu  = document.getElementById('btnMenu');
  const backdrop = document.getElementById('backdrop');
  if (!sidebar || !btnMenu || !backdrop) return;

  const open = () => {
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-visible');
    backdrop.hidden = false;
    btnMenu.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    setTimeout(() => { backdrop.hidden = true; }, 200);
    btnMenu.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
  const toggle = () => (sidebar.classList.contains('is-open') ? close() : open());
  bindOnce(btnMenu, 'click', toggle);
  bindOnce(backdrop, 'click', close);
  document.querySelectorAll('.nav__item').forEach((b) => {
    bindOnce(b, 'click', function onNavClick(){
      if (window.matchMedia('(max-width:1024px)').matches) close();
    });
  });
  bindOnce(document, 'keydown', function onEsc(e){ if (e.key === 'Escape' && sidebar.classList.contains('is-open')) close(); });
})();

/* ================================
   BUSCAS & FILTROS (helper)
================================ */
function attachSearchInput(input, onSearch) {
  if (!input) return;
  const run = () => onSearch(input.value.trim().toLowerCase());
  bindOnce(input, 'input', run);
}

/* ================================
   Administração: senha (força, gerar, ver/ocultar)
================================ */
(function passwordTools() {
  const senha      = $('#contaSenha');
  const lbl        = $('#forcaSenha');
  const btnGerar   = $('#btnGerarSenha');
  const btnToggle  = $('#btnToggleSenha') || (() => {
    const wrap = senha?.closest('.input-append');
    if (!wrap || !senha) return null;
    const b = document.createElement('button');
    b.id = 'btnToggleSenha'; b.type = 'button'; b.className = 'icon-btn'; b.title = 'Mostrar/ocultar senha';
    b.innerHTML = '<i class="ri-eye-line"></i>';
    wrap.insertBefore(b, btnGerar || null);
    return b;
  })();

  if (!senha || !lbl) return;

  const score = (p) => [+(p.length>=8), +/[A-Z]/.test(p), +/[a-z]/.test(p), +/\d/.test(p), +/[^A-Za-z0-9]/.test(p)]
    .reduce((a,b)=>a+b,0);
  const label = (s) => ['Muito fraca','Fraca','Média','Boa','Forte','Excelente'][s] || '—';
  const update = () => { lbl.textContent = `Força: ${label(score(senha.value||''))}`; };

  bindOnce(senha, 'input', update); update();

  btnGerar && bindOnce(btnGerar, 'click', function genPwd(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let p = ''; for (let i=0;i<12;i++) p += chars[Math.floor(Math.random()*chars.length)];
    senha.value = p; update();
    senha.type = 'text'; setTimeout(()=>{ senha.type = 'password'; }, 1200);
  });

  btnToggle && bindOnce(btnToggle, 'click', function togglePwd(){
    const isText = senha.type === 'text';
    senha.type = isText ? 'password' : 'text';
    const ic = btnToggle.querySelector('i'); if (ic) ic.className = isText ? 'ri-eye-line' : 'ri-eye-off-line';
    btnToggle.setAttribute('aria-pressed', String(!isText));
    senha.focus({ preventScroll:true });
  });
})();

/* ================================
   ADMIN: Usuários (Tabela + Modal) — single-bind e alert único
================================ */
(function usersAdmin() {
  const tabela   = document.getElementById('tabelaUsuarios');
  const inpBusca = document.getElementById('buscaUsuarios');

  const btnAbrirModal =
    document.getElementById('btnAddUsuario') ||
    document.getElementById('btnOpenUserModal') ||
    document.querySelector('[data-open="userModal"]');

  const modalWrap   = document.getElementById('userModal');
  const modalClose  = document.getElementById('userModalClose');
  const modalCancel = document.getElementById('userModalCancel');
  const modalSave   = document.getElementById('userModalSave');

  const mNome   = document.getElementById('modalNome');
  const mEmail  = document.getElementById('modalEmail');
  const mPerfil = document.getElementById('modalPerfil');
  const inpSenha = document.getElementById('contaSenha');

  const arvorePerm       = document.getElementById('modalArvorePerm');
  const modalBuscaPerm   = document.getElementById('modalBuscaPerm');
  const modalExpand      = document.getElementById('modalExpand');
  const modalCollapse    = document.getElementById('modalCollapse');
  const modalSelectAll   = document.getElementById('modalSelectAll');
  const modalClear       = document.getElementById('modalClear');

  /* ---------- Lista de usuários ---------- */
  async function fetchUsers() {
    try {
      const r = await API.get('/users/index.php');
      return r.data?.items || [];
    } catch (err) {
      console.warn('Falha ao buscar usuários:', err.message || err);
      return [];
    }
  }

  function rowHTML(u) {
    const papel = u.role === 'admin' ? 'Administrador' : (u.role === 'padrao' ? 'Padrão' : 'Leitor');
    return `
      <div class="table__row" data-id="${u.id}" data-n="${(u.nome||'').toLowerCase()}" data-e="${(u.email||'').toLowerCase()}" data-r="${(u.role||'').toLowerCase()}">
        <span>${u.nome||'-'}</span>
        <span>${u.email||'-'}</span>
        <span>${papel}</span>
        <span class="actions">
          <button class="icon-btn" title="Editar" data-act="edit"><i class="ri-edit-2-line"></i></button>
          <button class="icon-btn" title="Alternar perfil" data-act="role"><i class="ri-shield-user-line"></i></button>
          <button class="icon-btn" title="${u.ativo ? 'Desativar' : 'Ativar'}" data-act="toggle"><i class="ri-user-${u.ativo ? 'unfollow' : 'follow'}-line"></i></button>
          <button class="icon-btn danger" title="Excluir" data-act="delete"><i class="ri-delete-bin-6-line"></i></button>
        </span>
      </div>`;
  }

  async function renderUsers() {
    const tabela = document.getElementById('tabelaUsuarios');
    if (!tabela) return;
    [...tabela.querySelectorAll('.table__row:not(.table__head)')].forEach(n => n.remove());
    const items = await fetchUsers();
    const frag = document.createElement('div');
    items.forEach(u => frag.insertAdjacentHTML('beforeend', rowHTML(u)));
    tabela.appendChild(frag);
  }


  let alertTimeout;
  function safeAlert(msg, ms = 2200) {
    if (!msg) return;
    // Se existir toast antigo, remove
    document.querySelectorAll('.nice-toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = 'nice-toast';
    toast.innerHTML = `<i class="ri-information-line"></i> ${msg}`;
    document.body.appendChild(toast);

    // estilo inline (ou pode ir pro CSS global)
    Object.assign(toast.style, {
      position: 'fixed',
      left: '50%',
      bottom: '22px',
      transform: 'translateX(-50%)',
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '10px 16px',
      boxShadow: '0 6px 24px rgba(0,0,0,.15)',
      fontWeight: '600',
      color: '#111827',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      zIndex: 9999,
      transition: 'opacity .3s ease',
    });

    clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, ms);
  }

  // eventos da tabela — single-bind
  if (tabela && !tabela.dataset.bound) {
    tabela.dataset.bound = '1';
    tabela.addEventListener('click', async (e) => {
      const btn = e.target.closest('.icon-btn[data-act]'); if (!btn) return;
      const tr = btn.closest('.table__row'); const id = tr?.dataset.id; const act = btn.dataset.act; if (!id) return;

      try {
        if (act === 'edit') { openModal(Number(id)); return; }

        if (act === 'toggle') {
          const it = await API.get(`/users/item.php?id=${id}`);
          const ativo = it.data?.item?.ativo ? 1 : 0;
          if (ativo) {
            await fetch(`${API.base}/users/item.php?id=${id}`, { method:'DELETE', credentials:'include' }).then(r=>r.json());
          } else {
            await API.send(`/users/item.php?id=${id}`, 'PUT', { ativo: 1 });
          }
        } else if (act === 'role') {
          const it = await API.get(`/users/item.php?id=${id}`);
          const cur = (it.data?.item?.role || 'padrao').toLowerCase();
          const next = cur === 'admin' ? 'padrao' : (cur === 'padrao' ? 'leitor' : 'admin');
          await API.send(`/users/item.php?id=${id}`, 'PUT', { role: next });
        } else if (act === 'delete') {
          if (!confirm('Excluir este usuário definitivamente?')) return;
          await fetch(`${API.base}/users/item.php?id=${id}&hard=1`, { method:'DELETE', credentials:'include' }).then(r=>r.json());
        }

        await renderUsers();
      } catch (err) {
        safeAlert(err.message || 'Falha ao atualizar usuário');
      }
    });

    if (inpBusca && !inpBusca.dataset.bound) {
      inpBusca.dataset.bound = '1';
      inpBusca.addEventListener('input', () => {
        const q = (inpBusca.value||'').trim().toLowerCase();
        tabela.querySelectorAll('.table__row:not(.table__head)').forEach(r => {
          const n = r.dataset.n || '', e = r.dataset.e || '', ro = r.dataset.r || '';
          r.style.display = !q || n.includes(q) || e.includes(q) || ro.includes(q) ? '' : 'none';
        });
      });
    }
  }

  // Modal
  let EDITING_ID = null;

  const openModal = (editingId = null) => {
    EDITING_ID = editingId;
    if (!modalWrap) return;
    modalWrap.hidden = false; setTimeout(()=>modalWrap.classList.add('is-visible'), 0);

    if (mNome) mNome.value = '';
    if (mEmail) mEmail.value = '';
    if (mPerfil) mPerfil.value = 'padrao';
    if (inpSenha) inpSenha.value = '';
    clearAllPerms(); if (modalBuscaPerm) modalBuscaPerm.value = '';

    if (!EDITING_ID) {
      $('#userModalTitle')?.replaceChildren(...(new DOMParser()).parseFromString(`<span><i class="ri-user-add-line"></i> Cadastrar Usuário</span>`, 'text/html').body.firstChild.childNodes);
      (mNome || mEmail || mPerfil)?.focus?.();
    } else {
      $('#userModalTitle')?.replaceChildren(...(new DOMParser()).parseFromString(`<span><i class="ri-user-settings-line"></i> Editar Usuário</span>`, 'text/html').body.firstChild.childNodes);
      loadUserIntoModal(EDITING_ID);
    }
  };

  async function loadUserIntoModal(id) {
    try {
      const it = await API.get(`/users/item.php?id=${id}`);
      const u = it.data?.item || {};
      if (mNome) mNome.value = u.nome || '';
      if (mEmail) mEmail.value = u.email || '';
      if (mPerfil) mPerfil.value = (u.role || 'padrao');
      if (inpSenha) inpSenha.value = '';

      const codes = Array.isArray(u.permissoes) ? u.permissoes : [];
      setPermissionsInModal(codes);
      (mNome || mEmail || mPerfil).focus?.();
    } catch { safeAlert('Não foi possível carregar o usuário para edição'); }
  }

  const closeModal = () => {
    if (!modalWrap) return;
    modalWrap.classList.remove('is-visible'); setTimeout(()=>{ modalWrap.hidden = true; }, 180);
  };

  btnAbrirModal && !btnAbrirModal.dataset.bound && (btnAbrirModal.dataset.bound='1', btnAbrirModal.addEventListener('click', () => openModal(null)));
  modalClose   && !modalClose.dataset.bound   && (modalClose.dataset.bound='1',   modalClose.addEventListener('click', closeModal));
  modalCancel  && !modalCancel.dataset.bound  && (modalCancel.dataset.bound='1',  modalCancel.addEventListener('click', closeModal));
  modalWrap    && !modalWrap.dataset.bound    && (modalWrap.dataset.bound='1',    modalWrap.addEventListener('click', (e) => { if (e.target === modalWrap) closeModal(); }));

  // Árvore de permissões
  if (arvorePerm && !arvorePerm.dataset.boundInit) {
    arvorePerm.dataset.boundInit = '1';

    arvorePerm.querySelectorAll('.tree__head .tree__toggle').forEach(btn => {
      bindOnce(btn, 'click', function toggle(){ btn.closest('.tree__item').classList.toggle('is-collapsed'); });
    });

    arvorePerm.querySelectorAll('.tree__item').forEach(li => {
      const master = li.querySelector('.title-check input[type="checkbox"]');
      const kids = [...li.querySelectorAll('.tree__children input[type="checkbox"]')];
      const sync = () => {
        const m = kids.filter(k=>k.checked).length;
        if (master){
          master.checked = kids.length>0 && m===kids.length;
          master.indeterminate = m>0 && m<kids.length;
        }
      };
      master && bindOnce(master, 'change', function onM(){ kids.forEach(k=>k.checked = master.checked); sync(); });
      kids.forEach(k=>bindOnce(k, 'change', sync));
      sync();
    });

    modalBuscaPerm && bindOnce(modalBuscaPerm, 'input', function onFilter(){
      const txt = modalBuscaPerm.value.trim().toLowerCase();
      arvorePerm.querySelectorAll('.tree__item').forEach(li => {
        const head = li.querySelector('.tree__toggle')?.textContent.toLowerCase() || '';
        const hitChild = [...li.querySelectorAll('.tree__children .check')].some(l => l.textContent.toLowerCase().includes(txt));
        li.style.display = !txt || head.includes(txt) || hitChild ? '' : 'none';
        if (txt && (head.includes(txt) || hitChild)) li.classList.remove('is-collapsed');
      });
    });

    modalExpand   && bindOnce(modalExpand,   'click', () => arvorePerm.querySelectorAll('.tree__item').forEach(li => li.classList.remove('is-collapsed')));
    modalCollapse && bindOnce(modalCollapse, 'click', () => arvorePerm.querySelectorAll('.tree__item').forEach(li => li.classList.add('is-collapsed')));

    modalSelectAll && bindOnce(modalSelectAll,'click', () => 
      arvorePerm.querySelectorAll('.tree__children input[type="checkbox"]').forEach(c => { 
        c.checked = true; 
        c.dispatchEvent(new Event('change')); 
      })
    );

    modalClear && bindOnce(modalClear, 'click', () =>
      arvorePerm.querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = false; c.indeterminate = false; })
    );
  }

  function clearAllPerms() {
    arvorePerm?.querySelectorAll('input[type="checkbox"]').forEach(c => {
      c.checked = false; c.indeterminate = false;
    });
  }

  function collectPermissions() {
    const list = new Set();
    arvorePerm?.querySelectorAll('input[type="checkbox"]:checked').forEach(c => {
      const perm = c.getAttribute('data-perm');
      if (perm) list.add(perm);
    });
    return Array.from(list);
  }

  function syncGroupMasters(root = arvorePerm) {
    root?.querySelectorAll('.tree__item').forEach(li => {
      const master = li.querySelector('.title-check input[type="checkbox"]');
      const kids = [...li.querySelectorAll('.tree__children input[type="checkbox"]')];
      if (!master || kids.length === 0) return;
      const m = kids.filter(k => k.checked).length;
      master.checked = m === kids.length;
      master.indeterminate = m > 0 && m < kids.length;
    });
  }

  function setPermissionsInModal(codes = []) {
    arvorePerm?.querySelectorAll('.tree__children input[type="checkbox"]').forEach(c => { c.checked = false; });
    codes.forEach(code => {
      const cb = arvorePerm?.querySelector(`.tree__children input[type="checkbox"][data-perm="${CSS.escape(code)}"]`);
      if (cb) cb.checked = true;
    });
    syncGroupMasters();
  }

  // Salvar — SINGLE BIND + alert único
  if (modalSave && !modalSave.dataset.bound) {
    modalSave.dataset.bound = '1';

    modalSave.addEventListener('click', async () => {
      const nome    = (mNome?.value || '').trim();
      const email   = (mEmail?.value || '').trim();
      const role    = (mPerfil?.value || 'padrao').toLowerCase();
      const usuario = (email ? email.split('@')[0] : '').replace(/[^a-z0-9._-]/gi, '').toLowerCase();
      const senha   = (inpSenha?.value || '').trim();
      const permissoes = collectPermissions();

      if (!nome || !email || !usuario) { safeAlert('Preencha Nome e E-mail.'); return; }
      if (!EDITING_ID && !senha)      { safeAlert('Para novo usuário, informe a Senha.'); return; }

      try {
        if (!EDITING_ID) {
          await API.send('/users/create.php', 'POST', { nome, email, usuario, senha, role, permissoes });
        } else {
          const payload = { nome, email, role, permissoes, usuario };
          if (senha) payload.senha = senha;
          await API.send(`/users/item.php?id=${EDITING_ID}`, 'PUT', payload);
        }
        closeModal();
        if (mNome) mNome.value = '';
        if (mEmail) mEmail.value = '';
        if (mPerfil) mPerfil.value = 'padrao';
        if (inpSenha) inpSenha.value = '';
        await renderUsers();
      } catch (err) {
        safeAlert(err.message || 'Falha ao salvar usuário');
      }
    });
  }

  // primeira carga
  renderUsers();
})();

/* ================================
   ACADÊMICO: Drill-down (via API) — versão única (sem duplicações)
================================ */
async function editSegmento(id, currentName = '') {
  const nome = (prompt('Novo nome do Segmento:', currentName || '') || '').trim();
  if (!nome) return;
  await API.send('/academico/segmentos/update.php', 'PUT', { id: Number(id), nome });
  await loadAcademicoTree();
}
async function editSerie(id, currentName = '') {
  const nome = (prompt('Novo nome da Série:', currentName || '') || '').trim();
  if (!nome) return;
  await API.send('/academico/series/update.php', 'PUT', { id: Number(id), nome });
  await loadAcademicoTree();
}
async function editTurma(id, currentName = '') {
  const nome = (prompt('Novo nome da Turma:', currentName || '') || '').trim();
  if (!nome) return;
  await API.send('/academico/turmas/update.php', 'PUT', { id: Number(id), nome });
  await loadAcademicoTree();
}

/* =========================================================
   Atualização inteligente da estrutura acadêmica
========================================================= */

// função global para atualizar árvore
async function refreshAcademicoTree(force = false) {
  try {
    await loadAcademicoTree();
    if (force) console.log('%c[Academico]', 'color:#22c55e', 'Recarregou árvore completa');
  } catch (err) {
    console.warn('Falha ao recarregar árvore:', err);
  }
}

/* =========================================================
   ACADÊMICO: Modal de cadastro (IDs unificados)
========================================================= */
(function acadModal() {
  const openBtn   = document.getElementById('btnAddAcademico');
  const wrap      = document.getElementById('acadModal');
  const closeBtn  = document.getElementById('acadModalClose');
  const cancelBtn = document.getElementById('acadModalCancel');
  const saveBtn   = document.getElementById('acadSalvar'); // <- unificado
  const form      = document.getElementById('acadForm');   // <- agora existe

  if (!openBtn || !wrap) return;

  function open()  { wrap.hidden = false; requestAnimationFrame(()=>wrap.classList.add('is-visible')); }
  function close() {
    wrap.classList.remove('is-visible');
    setTimeout(() => {
      wrap.hidden = true;
      form?.reset?.();
      delete wrap.dataset.editing;
      const btnTxt = document.getElementById('acadSalvar');
      if (btnTxt) btnTxt.textContent = 'Salvar';
      // opcional: atualizar árvore
      if (typeof window.refreshAcademicoTree === 'function') refreshAcademicoTree(true);
    }, 180);
  }

  bindOnce(openBtn,  'click', open);
  bindOnce(closeBtn, 'click', close);
  bindOnce(cancelBtn,'click', close);
  bindOnce(wrap,     'click', (e) => { if (e.target === wrap) close(); });

  // Salvar (reusa seu handler que já está definido no arquivo)
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    // o listener real já está declarado mais abaixo (bindOnce(btnSalvar,...))
    // então aqui não precisamos reanexar nada
  }
})();


async function loadAcademicoTree() {
  const arv   = document.getElementById('arvoreAcademica');
  const tab   = document.getElementById('tabelaAlunos');
  const title = document.getElementById('tituloTurma');
  const qTurmas = document.getElementById('buscaTurmas');
  const qAlunos = document.getElementById('buscaAlunos');
  if (!arv || !tab) return;

  // delegação única na árvore
  if (!arv.__bound) {
    arv.__bound = true;
    arv.addEventListener('click', async (e) => {
      const pill = e.target.closest('.pill--turma');
      const btn  = e.target.closest('[data-act]');

      if (pill && !e.target.closest('.pill-edit')) {
        const turmaId   = pill.dataset.id;
        const turmaNome = pill.dataset.turma || '—';
        if (title) title.textContent = `Turma: ${turmaNome}`;
        const alunos = await fetchAlunosDaTurma(turmaId);
        currentTurmaItems.value = alunos;
        renderAlunos(alunos, (qAlunos?.value || '').trim().toLowerCase());
        return;
      }

      if (btn) {
        const act  = btn.dataset.act;
        const id   = btn.dataset.id;
        const name = btn.dataset.name || '';
        try {
          if (act === 'edit-seg')   { await editSegmento(id, name); return; }
          if (act === 'edit-serie') { await editSerie(id, name);    return; }
          if (act === 'edit-turma') { await editTurma(id, name);    return; }
          if (act === 'toggle')     { btn.closest('.card')?.classList.toggle('is-open'); return; }
        } catch (err) {
          alert(err.message || 'Falha ao executar a ação.');
        }
      }
    });
  }

  const currentTurmaItems = { value: [] };
  const tbodyRowsSel = '.table__row:not(.table__head)';

  function clearAlunosTable() {
    [...tab.querySelectorAll(tbodyRowsSel)].forEach(n => n.remove());
  }
/* =========================================================
   Tabela de Alunos — Editar, Excluir e Transferir
   ========================================================= */
function rowAlunoHTML(a) {
  return `
    <div class="table__row" data-id="${a.id || ''}">
      <span>${a.nome || '-'}</span>
      <span>${a.responsavel || '-'}</span>
      <span>${a.status ? (a.status[0].toUpperCase() + a.status.slice(1)) : '-'}</span>
      <span class="actions">
        <button class="icon-btn" title="Dar presença (dia)" data-act="presenca-dia">
          <i class="ri-calendar-check-line"></i>
        </button>
        <button class="icon-btn" title="Transferir aluno" data-act="transfer">
          <i class="ri-exchange-line"></i>
        </button>
        <button class="icon-btn" title="Editar aluno" data-act="edit">
          <i class="ri-pencil-line"></i>
        </button>
        <button class="icon-btn danger" title="Excluir aluno" data-act="delete">
          <i class="ri-delete-bin-6-line"></i>
        </button>
      </span>
    </div>`;
}


function renderAlunos(items = [], filtroTxt = '') {
  clearAlunosTable();
  const norm = (s) => (s || '').toLowerCase();
  const list = !filtroTxt
    ? items
    : items.filter(a => norm(`${a.nome} ${a.responsavel} ${a.status}`).includes(filtroTxt));
  const frag = document.createElement('div');
  list.forEach(a => frag.insertAdjacentHTML('beforeend', rowAlunoHTML(a)));
  tab.appendChild(frag);

  // === Eventos de ação (editar / excluir / transferir)
  tab.querySelectorAll('[data-act]').forEach(btn => {
    bindOnce(btn, 'click', async () => {
      const act = btn.dataset.act;
      const row = btn.closest('.table__row');
      const alunoId = row?.dataset.id;
      if (!alunoId) return;

      const nome = row.children[0]?.textContent?.trim() || '';
      const responsavel = row.children[1]?.textContent?.trim() || '';

      /* 🔄 TRANSFERIR */
      if (act === 'transfer') {
        const modal = document.getElementById('transferModal');
        modal.hidden = false;
        modal.dataset.alunoId = alunoId;
        document.getElementById('transferTitle').textContent = `Transferir ${nome}`;
        await carregarSegmentosTransferencia();
        return;
      }
if (act === 'edit') {
  try {
    const modal = document.getElementById('acadModal');
    const tipoAluno = modal.querySelector('input[value="aluno"]');
    tipoAluno.checked = true;

    document.querySelectorAll('.acad-fieldset').forEach(el => el.classList.add('hidden'));
    document.querySelector('.acad-aluno')?.classList.remove('hidden');

    // 🔹 1. Busca o aluno e guarda globalmente antes de recarregar selects
    const res = await API.get(`/academico/alunos_get.php?id=${alunoId}`);
    const aluno = res.data || res;
    window.ALUNO_EDITANDO = aluno;

    // 🔹 2. Atualiza selects de Segmento / Série / Turma
    await window.carregarSelects();

    // 🔹 3. Preenche valores
    $('#acadSelSegmentoAluno').value = aluno.segmento_id || '';
    await window.carregarSelects(); // força update séries
    $('#acadSelSerieAluno').value = aluno.serie_id || '';
    await window.carregarSelects(); // força update turmas
    $('#acadSelTurmaAluno').value = aluno.turma_id || '';

    $('#acadNomeAluno').value = aluno.nome || '';
    $('#acadRespAluno').value = aluno.responsavel || '';
    $('#acadHoraEntrada').value = aluno.hora_entrada || '';
    $('#acadHoraSaida').value = aluno.hora_saida || '';
    $('#acadTemAlmoco').checked = aluno.almoco == 1;
    $('#acadTemJantar').checked = aluno.jantar == 1;
    $('#acadCursoExtra').value = aluno.curso_extra_id || '';

    modal.dataset.editing = alunoId;
    $('#acadSalvar').textContent = 'Atualizar';
    modal.hidden = false;

  } catch (err) {
    console.error(err);
    safeAlert('Erro ao carregar dados do aluno.');
  }
}
      if (act === 'delete') {
        if (!confirm(`Excluir aluno "${nome}" permanentemente?`)) return;
        try {
          await API.send(`/academico/alunos_delete.php`, 'DELETE', { id: alunoId });
          safeAlert(`Aluno "${nome}" excluído com sucesso!`);
          const turmaId = document.querySelector('#tituloTurma')?.textContent.match(/\d+/)?.[0];
          if (turmaId) {
            const alunos = await window.fetchAlunosDaTurma(turmaId);
            window.renderAlunos(alunos);
          }
          await atualizarAcademico();
        } catch (e) {
          console.error(e);
          safeAlert('Falha ao excluir aluno.');
        }
      }
    });
  });
}


// ======== PRESENÇA POR DIA (modal) ========
const MPD = {
  wrap:  document.getElementById('modalPresencaDia'),
  close: document.getElementById('mpdClose'),
  cancel:document.getElementById('mpdCancel'),
  prev:  document.getElementById('mpdPrev'),
  next:  document.getElementById('mpdNext'),
  grid:  document.getElementById('mpdGrid'),
  title: document.getElementById('mpdMonthYear'),
  state: { alunoId:null, ano:null, mes:null, presencas:new Set() }
};

function openPresencaDiaModal(aluno){
  if (!MPD.wrap) return;
  const hoje = new Date();
  MPD.state = { alunoId: aluno.id, ano: hoje.getFullYear(), mes: hoje.getMonth(), presencas:new Set() };
  MPD.wrap.hidden = false;
  requestAnimationFrame(()=>MPD.wrap.classList.add('is-visible'));
  carregarPresencasMes();
  bindMpdOnce();
}

function bindMpdOnce(){
  if (MPD._bound) return; MPD._bound = true;

  const fechar = () => { 
    MPD.wrap.classList.remove('is-visible'); 
    setTimeout(()=>MPD.wrap.hidden = true, 180);
  };
  MPD.close && MPD.close.addEventListener('click', fechar);
  MPD.cancel && MPD.cancel.addEventListener('click', fechar);
  MPD.wrap.addEventListener('click', (e)=>{ if (e.target === MPD.wrap) fechar(); });

  MPD.prev && MPD.prev.addEventListener('click', ()=>{ mudarMes(-1); });
  MPD.next && MPD.next.addEventListener('click', ()=>{ mudarMes(+1); });
}

function mudarMes(delta){
  let { ano, mes } = MPD.state;
  mes += delta;
  if (mes < 0)  { mes = 11; ano--; }
  if (mes > 11) { mes = 0;  ano++; }
  MPD.state.mes = mes; MPD.state.ano = ano;
  carregarPresencasMes();
}

async function carregarPresencasMes(){
  const { alunoId, ano, mes } = MPD.state;
  const y = ano, m = mes + 1; // 1..12
  // 🔁 Ajuste o endpoint conforme seu back
  const r = await API.get(`/cursos/presencas.php?aluno_id=${alunoId}&ano=${y}&mes=${m}`);
  const dias = r.data?.dias || r.dias || [];  // ex.: [1,3,7,15,...] (presentes)
  MPD.state.presencas = new Set(dias.map(Number));
  montarCalendario();
}

function montarCalendario(){
  const { ano, mes, presencas } = MPD.state;
  const data = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes+1, 0).getDate();
  const nomeMes = data.toLocaleString('pt-BR', { month:'long' });
  if (MPD.title) MPD.title.textContent = `${nomeMes[0].toUpperCase()+nomeMes.slice(1)} de ${ano}`;

  MPD.grid.innerHTML = '';
  for (let d = 1; d <= ultimoDia; d++){
    const btn = document.createElement('div');
    btn.className = 'calendar-day' + (presencas.has(d) ? ' presente' : '');
    btn.textContent = d;
    btn.dataset.dia = d;
    btn.tabIndex = 0;

    btn.addEventListener('click', ()=>toggleDia(d));
    btn.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key===' ') toggleDia(d); });

    MPD.grid.appendChild(btn);
  }
}

async function toggleDia(dia){
  const { alunoId, ano, mes, presencas } = MPD.state;
  const presente = !presencas.has(dia);
  // 🔁 Ajuste o endpoint conforme seu back
  await API.send('/cursos/presencas.php', 'POST', {
    aluno_id: alunoId,
    data: `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`,
    presente
  });
  if (presente) presencas.add(dia); else presencas.delete(dia);

  const el = MPD.grid.querySelector(`.calendar-day[data-dia="${dia}"]`);
  if (el){
    el.classList.toggle('presente', presente);
    el.classList.toggle('ausente', !presente);
  }
  safeAlert(presente ? 'Presença marcada.' : 'Presença removida.');
}

  async function ensureAcadCache() {
    if (window.ACAD_CACHE?.segmentos?.length) return window.ACAD_CACHE;
    try {
      const r = await API.get('/academico/arvore.php');
      window.ACAD_CACHE = r.data || r;
    } catch (e) {
      console.warn('Falha ao carregar árvore acadêmica:', e.message || e);
      window.ACAD_CACHE = { segmentos: [] };
    }
    return window.ACAD_CACHE;
  }

function renderArvore(segmentos = [], filterTxt = '') {
  const arv = document.getElementById('arvoreAcademica');
  if (!arv) return;
  arv.innerHTML = '';
  const hit = (s) => (s || '').toLowerCase().includes(filterTxt);

  segmentos.forEach(seg => {
    const segCard = document.createElement('li');
    segCard.className = 'branch card';
    segCard.dataset.type = 'segmento';
    segCard.dataset.id = seg.id;
    segCard.innerHTML = `
      <div class="branch__head row" data-toggle>
        <div class="branch__title">
          <i class="ri-node-tree"></i>
          <strong>${seg.nome}</strong>
        </div>
        <div class="branch__actions">
          <button class="ghost-btn" title="Editar segmento" data-act="edit-seg" data-id="${seg.id}" data-name="${seg.nome}">
            <i class="ri-pencil-line"></i>
          </button>
          <button class="ghost-btn danger" title="Excluir segmento" data-act="del-seg" data-id="${seg.id}">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
      <div class="branch__children stack"></div>`;
    const segChildren = segCard.querySelector('.branch__children');

    (seg.series || []).forEach(serie => {
      const serieCard = document.createElement('div');
      serieCard.className = 'series card';
      serieCard.dataset.type = 'serie';
      serieCard.dataset.id = serie.id;
      serieCard.innerHTML = `
        <div class="series__head row" data-toggle>
          <div class="series__title">
            <i class="ri-bookmark-3-line"></i>
            <span>${serie.nome}</span>
          </div>
          <div class="series__actions">
            <button class="ghost-btn" title="Editar série" data-act="edit-serie" data-id="${serie.id}" data-name="${serie.nome}">
              <i class="ri-pencil-line"></i>
            </button>
            <button class="ghost-btn danger" title="Excluir série" data-act="del-serie" data-id="${serie.id}">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
        <div class="series__children pills"></div>`;
      const serieChildren = serieCard.querySelector('.series__children');

      (serie.turmas || []).forEach(t => {
        const line = document.createElement('div');
        line.className = 'pill-line';
        line.innerHTML = `
          <button class="pill pill--turma" data-id="${t.id}" data-turma="${t.nome}">
            <span class="pill__left">
              <i class="ri-team-line"></i>
              <span>${serie.nome} — ${t.nome}</span>
            </span>
          </button>
          <button class="pill-edit danger" title="Excluir turma" data-act="del-turma" data-id="${t.id}" data-name="${t.nome}">
            <i class="ri-delete-bin-line"></i>
          </button>`;
        serieChildren.appendChild(line);
      });

      segChildren.appendChild(serieCard);
    });

    arv.appendChild(segCard);
  });

  // Torna funções acessíveis globalmente (usadas fora daqui)
  window.fetchAlunosDaTurma = fetchAlunosDaTurma;
  window.renderAlunos = renderAlunos;

  // === EXPANDIR/RECOLHER ao clicar no retângulo inteiro ===
  arv.querySelectorAll('.branch__head, .series__head').forEach(head => {
    bindOnce(head, 'click', (e) => {
      if (e.target.closest('[data-act]')) return; // ignora botões de ação
      const card = head.closest('.card');
      if (card) card.classList.toggle('is-open');
    });
  });

  // === EVENTOS DE AÇÃO ===
  arv.querySelectorAll('[data-act]').forEach(btn => {
    bindOnce(btn, 'click', async (e) => {
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      const name = btn.dataset.name || '';

      try {
        if (act === 'edit-seg')   return await editSegmento(id, name);
        if (act === 'edit-serie') return await editSerie(id, name);
        if (act === 'edit-turma') return await editTurma(id, name);

        if (act === 'del-seg') {
          if (!confirm('Excluir este segmento e todas as séries/turmas vinculadas?')) return;
          await API.send(`/academico/segmentos/delete.php`, 'DELETE', { id });
        }
        else if (act === 'del-serie') {
          if (!confirm('Excluir esta série e suas turmas vinculadas?')) return;
          await API.send(`/academico/series/delete.php`, 'DELETE', { id });
        }
        else if (act === 'del-turma') {
          if (!confirm('Excluir esta turma permanentemente?')) return;
          await API.send(`/academico/turmas/delete.php`, 'DELETE', { id });
        }

        // 🔄 Atualiza árvore e selects
        await atualizarAcademico();

        // 🔄 Atualiza tabela de alunos se for a turma atualmente aberta
        const turmaAtiva = document.getElementById('tituloTurma')?.textContent || '';
        if (act === 'del-turma' && turmaAtiva.includes(name) && typeof window.renderAlunos === 'function') {
          window.renderAlunos([]);
        }

        safeAlert('Item excluído com sucesso!');
      } catch (err) {
        safeAlert(err.message || 'Erro ao excluir item.');
      }
    });
  });
}


  async function fetchAlunosDaTurma(turmaId) {
    const tentativas = [
      `/academico/turmas/alunos.php?turma_id=${encodeURIComponent(turmaId)}`,
      `/academico/turmas.php?id=${encodeURIComponent(turmaId)}&alunos=1`
    ];
    for (const path of tentativas) {
      try {
        const r = await API.get(path);
        const items = r.data?.alunos || r.alunos || r.data?.items || [];
        if (Array.isArray(items)) return items;
      } catch {}
    }
    return [];
  }

  // filtros
  qAlunos && attachSearchInput(qAlunos, (txt)=> renderAlunos(currentTurmaItems.value, txt));
  qTurmas && attachSearchInput(qTurmas, async (txt) => {
    const cache = await ensureAcadCache();
    renderArvore(cache.segmentos || [], txt);
  });

  // primeira renderização
  const cache = await ensureAcadCache();
  renderArvore(cache.segmentos || [], (qTurmas?.value || '').trim().toLowerCase());

  // ações na tabela (transferir)
  if (!tab.dataset.bound) {
    tab.dataset.bound = '1';
tab.addEventListener('click', (e) => {
  const btn = e.target.closest('.icon-btn[data-act="transfer"]');
  if (!btn) return;
  const row = btn.closest('.table__row');
  const alunoId = row?.dataset.id;
  const nome = row?.querySelector('span')?.textContent || '';
  if (!alunoId) return alert('Aluno inválido.');

  const aluno = { id: Number(alunoId), nome };
  if (typeof window.openTransferModal === 'function') window.openTransferModal(aluno);
});

  }
}

/* ================================
   Inicializações (somente o necessário)
================================ */
     // config + preços
loadAcademicoTree();   // árvore acadêmica


(function transferModalFullVersion() {
  // Elements
  const openButton        = document.getElementById('btnTransferir');
  const modalWrapper      = document.getElementById('transferModal');
  const closeButton       = document.getElementById('transferClose');
  const cancelButton      = document.getElementById('transferCancel');
  const confirmButton     = document.getElementById('transferConfirm');

  const selectSegmento    = document.getElementById('transfSeg');
  const selectSerie       = document.getElementById('transfSerie');
  const selectTurma       = document.getElementById('transfTurma');
  const hintText          = document.getElementById('transfHint');

  if (!modalWrapper) return;

  // Fallback for one-time event binding (uses global bindOnce if available)
  function addEventListenerOnce(target, eventName, handler) {
    if (!target) return;
    if (typeof window.bindOnce === 'function') {
      window.bindOnce(target, eventName, handler);
    } else {
      target.addEventListener(eventName, handler, { once: true });
    }
  }

  function getAlunoAtual() {
    return window.CURRENT_ALUNO_ID || null;
  }

  async function ensureAcademicTreeCache() {
    if (window.ACAD_CACHE?.segmentos?.length) return window.ACAD_CACHE;
    try {
      const response = await API.get('/academico/arvore.php');
      window.ACAD_CACHE = response.data || response;
    } catch (error) {
      console.warn('Falha ao carregar árvore acadêmica:', error.message || error);
      window.ACAD_CACHE = { segmentos: [] };
    }
    return window.ACAD_CACHE;
  }

  function fillSelectOptions(selectElement, items, placeholderText) {
    if (!selectElement) return;
    const optionsHtml = (items || [])
      .map(item => `<option value="${item.id}">${item.nome}</option>`)
      .join('');
    selectElement.innerHTML =
      (placeholderText ? `<option value="">${placeholderText}</option>` : '') +
      optionsHtml;
  }

  function getSeriesBySegment(academicCache, segmentId) {
    const segment = (academicCache.segmentos || [])
      .find(item => String(item.id) === String(segmentId));
    return segment?.series || [];
  }

  function getTurmasBySerie(academicCache, segmentId, serieId) {
    const serie = getSeriesBySegment(academicCache, segmentId)
      .find(item => String(item.id) === String(serieId));
    return serie?.turmas || [];
  }

  function openModal() {
    modalWrapper.hidden = false;
    requestAnimationFrame(() => modalWrapper.classList.add('is-visible'));
  }

  function closeModal() {
    modalWrapper.classList.remove('is-visible');
    setTimeout(() => { modalWrapper.hidden = true; }, 180);
  }

  // Expose open function if needed elsewhere
  window.openTransferModal = openModal;

  // Open modal and preload data
  addEventListenerOnce(openButton, 'click', async function handleOpenClick() {
    hintText.textContent = 'Carregando estrutura acadêmica…';
    confirmButton.disabled = true;
    openModal();

    const academicCache = await ensureAcademicTreeCache();
    const segmentosList = academicCache.segmentos || [];

    fillSelectOptions(selectSegmento, segmentosList, 'Selecione o segmento');
    selectSerie.innerHTML = `<option value="">Selecione a série</option>`;
    selectTurma.innerHTML = `<option value="">Selecione a turma</option>`;

    const hasData = segmentosList.length > 0;
    hintText.textContent = hasData
      ? 'Escolha o Segmento, depois a Série e por fim a Turma de destino.'
      : 'Nenhum dado encontrado. Verifique sua API.';
    confirmButton.disabled = !hasData;
  });

  // Close interactions
  addEventListenerOnce(modalWrapper, 'click', function handleBackdropClick(event) {
    if (event.target === modalWrapper) closeModal();
  });
  if (closeButton)  addEventListenerOnce(closeButton,  'click', closeModal);
  if (cancelButton) addEventListenerOnce(cancelButton, 'click', closeModal);

  // Cascading selects
  if (selectSegmento) {
    addEventListenerOnce(selectSegmento, 'change', async function handleSegmentChange() {
      const academicCache = await ensureAcademicTreeCache();
      const seriesList = getSeriesBySegment(academicCache, selectSegmento.value);
      fillSelectOptions(selectSerie, seriesList, 'Selecione a série');
      selectTurma.innerHTML = `<option value="">Selecione a turma</option>`;
    });
  }

  if (selectSerie) {
    addEventListenerOnce(selectSerie, 'change', async function handleSerieChange() {
      const academicCache = await ensureAcademicTreeCache();
      const turmasList = getTurmasBySerie(
        academicCache,
        selectSegmento.value,
        selectSerie.value
      );
      fillSelectOptions(selectTurma, turmasList, 'Selecione a turma');
    });
  }

  // Confirm action
  if (confirmButton) {
    addEventListenerOnce(confirmButton, 'click', async function handleConfirmClick() {
      const alunoId = getAlunoAtual();
      const segmentId = selectSegmento.value || '';
      const serieId   = selectSerie.value || '';
      const turmaId   = selectTurma.value || '';

      if (!segmentId || !serieId || !turmaId) {
        alert('Selecione Segmento, Série e Turma.');
        return;
      }

      try {
        // Exemplo de chamada real:
        // await API.send('/integral/transferir.php', 'POST', { aluno_id: alunoId, turma_id: turmaId });
        alert(
          `Transferência ${alunoId ? `do aluno #${alunoId}` : ''} para:\n` +
          `${segmentId} › ${serieId} › ${turmaId}\n\n` +
          `(Chame sua API para efetivar.)`
        );
        closeModal();
      } catch (error) {
        alert(error.message || 'Não foi possível aplicar a transferência.');
      }
    });
  }
})();



/* =========================================================
   ACADÊMICO — Cadastro Dinâmico (corrigido p/ IDs do HTML novo)
   ========================================================= */
(function acadCadastro() {
const tipoRadios = $$('input[name="acadTipo"]');
  const form = document.getElementById('acadForm');
  const btnSalvar = document.getElementById('acadSalvar');
  const wrap = document.getElementById('acadModal');

  if (!form || !btnSalvar) return;

  async function ensureAcadCache() {
    if (window.ACAD_CACHE?.segmentos?.length) return window.ACAD_CACHE;
    try {
      const r = await API.get('/academico/arvore.php');
      window.ACAD_CACHE = r.data || r;
    } catch (e) {
      console.warn('Falha ao carregar árvore acadêmica:', e.message || e);
      window.ACAD_CACHE = { segmentos: [] };
    }
    return window.ACAD_CACHE;
  }

  function fillSelect(el, items, placeholder) {
    if (!el) return;
    const opts = (items || []).map(i => `<option value="${i.id}">${i.nome}</option>`).join('');
    el.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') + opts;
  }

  function seriesBySegment(cache, segId) {
    const seg = (cache.segmentos || []).find(s => String(s.id) === String(segId));
    return seg?.series || [];
  }

  function turmasBySerie(cache, segId, serieId) {
    const serie = seriesBySegment(cache, segId).find(s => String(s.id) === String(serieId));
    return serie?.turmas || [];
  }

  /* ---------------------------------------------------- */
  // Atualiza visibilidade de campos
  function atualizarCampos() {
    const tipo = tipoRadios.find(r => r.checked)?.value || 'segmento';
    document.querySelectorAll('.acad-fieldset').forEach(fs => fs.classList.add('hidden'));
    document.querySelectorAll(`.acad-${tipo}`).forEach(fs => fs.classList.remove('hidden'));
  }
  tipoRadios.forEach(r => bindOnce(r, 'change', atualizarCampos));
  atualizarCampos();

  /* ---------------------------------------------------- */
async function carregarSelects() {
  const cache = await ensureAcadCache();
  const segmentos = cache.segmentos || [];

  const selSegSerie = document.getElementById('acadSelSegmentoSerie');
  const selSegTurma = document.getElementById('acadSelSegmentoTurma');
  const selSegAluno = document.getElementById('acadSelSegmentoAluno');

  const selSerieTurma = document.getElementById('acadSelSerieTurma');
  const selSerieAluno = document.getElementById('acadSelSerieAluno');
  const selTurmaAluno = document.getElementById('acadSelTurmaAluno');

  // --- Preenche segmentos base ---
  fillSelect(selSegSerie, segmentos, 'Selecione o Segmento');
  fillSelect(selSegTurma, segmentos, 'Selecione o Segmento');
  fillSelect(selSegAluno, segmentos, 'Selecione o Segmento');

  selSerieTurma.innerHTML = '<option value="">Selecione a Série</option>';
  selSerieAluno.innerHTML = '<option value="">Selecione a Série</option>';
  selTurmaAluno.innerHTML = '<option value="">Selecione a Turma</option>';

  // --- Caso esteja editando aluno ---
  if (window.ALUNO_EDITANDO) {
    const aluno = window.ALUNO_EDITANDO;
    if (selSegAluno && aluno.segmento_id)
      selSegAluno.value = aluno.segmento_id;

    const series = seriesBySegment(cache, aluno.segmento_id);
    fillSelect(selSerieAluno, series, 'Selecione a Série');
    selSerieAluno.value = aluno.serie_id || '';

    const turmas = turmasBySerie(cache, aluno.segmento_id, aluno.serie_id);
    fillSelect(selTurmaAluno, turmas, 'Selecione a Turma');
    selTurmaAluno.value = aluno.turma_id || '';
  }

  /* ---------------------------
     🔁 Recarregar ao clicar
  ---------------------------- */
  const selectsToReload = [selSerieTurma, selSerieAluno, selTurmaAluno];
  selectsToReload.forEach(sel => {
    if (!sel) return;
    sel.addEventListener('focus', async () => {
      // limpa cache e busca dados atualizados
      window.ACAD_CACHE = null;
      const novoCache = await ensureAcadCache();

      if (sel.id === 'acadSelSerieTurma') {
        const seg = selSegTurma?.value;
        const series = seriesBySegment(novoCache, seg);
        fillSelect(sel, series, 'Selecione a Série');
      }

      if (sel.id === 'acadSelSerieAluno') {
        const seg = selSegAluno?.value;
        const series = seriesBySegment(novoCache, seg);
        fillSelect(sel, series, 'Selecione a Série');
      }

      if (sel.id === 'acadSelTurmaAluno') {
        const seg = selSegAluno?.value;
        const serie = selSerieAluno?.value;
        const turmas = turmasBySerie(novoCache, seg, serie);
        fillSelect(sel, turmas, 'Selecione a Turma');
      }
    });
  });

  /* ---------------------------
     🔁 Atualizar turmas ao mudar série
  ---------------------------- */
  if (selSerieAluno) {
    selSerieAluno.addEventListener('change', async () => {
      const seg = selSegAluno?.value;
      const serie = selSerieAluno?.value;
      const novoCache = await ensureAcadCache();
      const turmas = turmasBySerie(novoCache, seg, serie);
      fillSelect(selTurmaAluno, turmas, 'Selecione a Turma');
    });
  }

  if (selSerieTurma) {
    selSerieTurma.addEventListener('change', async () => {
      const seg = selSegTurma?.value;
      const serie = selSerieTurma?.value;
      const novoCache = await ensureAcadCache();
      const turmas = turmasBySerie(novoCache, seg, serie);
      fillSelect(selTurmaAluno, turmas, 'Selecione a Turma');
    });
  }
}

   // 🔽 torne-a global:
  window.carregarSelects = carregarSelects;
  carregarSelects();

  /* ---------------------------------------------------- */
  // Encadeamentos dos selects
  async function bindEncadeamentos() {
  const cache = await ensureAcadCache();

  // Série
  const selSegSerie = document.getElementById('acadSelSegmentoSerie');

  // Turma
  const selSegTurma = document.getElementById('acadSelSegmentoTurma');
  const selSerieTurma = document.getElementById('acadSelSerieTurma');

  // Aluno
  const selSegAluno = document.getElementById('acadSelSegmentoAluno');
  const selSerieAluno = document.getElementById('acadSelSerieAluno');
  const selTurmaAluno = document.getElementById('acadSelTurmaAluno');

  /* ----------- Série ----------- */
  selSegSerie && bindOnce(selSegSerie, 'change', async function () {
    const series = seriesBySegment(cache, selSegSerie.value);
    fillSelect(document.getElementById('acadSelSerieSerie') || selSerieTurma, series, 'Selecione a Série');
  });

  /* ----------- Turma ----------- */
  selSegTurma && bindOnce(selSegTurma, 'change', async function () {
    const series = seriesBySegment(cache, selSegTurma.value);
    fillSelect(selSerieTurma, series, 'Selecione a Série');
  });

  selSerieTurma && bindOnce(selSerieTurma, 'change', async function () {
    const turmas = turmasBySerie(cache, selSegTurma.value, selSerieTurma.value);
    // Nenhum select de turma extra — apenas dependência
  });

  /* ----------- Aluno ----------- */
  selSegAluno && bindOnce(selSegAluno, 'change', async function () {
    const series = seriesBySegment(cache, selSegAluno.value);
    fillSelect(selSerieAluno, series, 'Selecione a Série');
    selTurmaAluno.innerHTML = '<option value="">Selecione a Turma</option>';
  });

  selSerieAluno && bindOnce(selSerieAluno, 'change', async function () {
    const turmas = turmasBySerie(cache, selSegAluno.value, selSerieAluno.value);
    fillSelect(selTurmaAluno, turmas, 'Selecione a Turma');
  });
}

  bindEncadeamentos();

  /* ---------------------------------------------------- */
  // Ação de salvar
   /* ---------------------------------------------------- */
  // Ação de salvar (segmento, série, turma, aluno)
  bindOnce(btnSalvar, 'click', async function (e) {
  e.preventDefault();
  const tipo = tipoRadios.find(r => r.checked)?.value || 'segmento';
  const cache = await ensureAcadCache();
  const editId = wrap.dataset.editing || null;

  try {
    // ---------------- SEGMENTO ----------------
    if (tipo === 'segmento') {
      const nome = (document.getElementById('acadNomeSegmento')?.value || '').trim();
      if (!nome) return safeAlert('Informe o nome do Segmento.');
      await API.send('/academico/segmentos.php', 'POST', { nome });
    }

    // ---------------- SÉRIE ----------------
    else if (tipo === 'serie') {
      const segId = document.getElementById('acadSelSegmentoSerie')?.value;
      const nome = (document.getElementById('acadNomeSerie')?.value || '').trim();
      if (!segId || !nome) return safeAlert('Selecione o Segmento e informe o nome da Série.');
      await API.send('/academico/series.php', 'POST', { nome, segmento_id: segId });
    }

    // ---------------- TURMA ----------------
    else if (tipo === 'turma') {
      const segId = document.getElementById('acadSelSegmentoTurma')?.value;
      const serieId = document.getElementById('acadSelSerieTurma')?.value;
      const nome = (document.getElementById('acadNomeTurma')?.value || '').trim();
      if (!segId || !serieId || !nome)
        return safeAlert('Selecione o Segmento e Série e informe o nome da Turma.');
      await API.send('/academico/turmas.php', 'POST', { nome, segmento_id: segId, serie_id: serieId });
    }

    // ---------------- ALUNO ----------------
    else if (tipo === 'aluno') {
      const segId = $('#acadSelSegmentoAluno')?.value;
      const serieId = $('#acadSelSerieAluno')?.value;
      const turmaId = $('#acadSelTurmaAluno')?.value;
      const nome = $('#acadNomeAluno')?.value.trim();
      const responsavel = $('#acadRespAluno')?.value.trim();
      const horaEntrada = $('#acadHoraEntrada')?.value || null;
      const horaSaida = $('#acadHoraSaida')?.value || null;
      const temAlmoco = $('#acadTemAlmoco')?.checked || false;
      const temJantar = $('#acadTemJantar')?.checked || false;
      const cursoExtra = $('#acadCursoExtra')?.value || null;

      if (!segId || !serieId || !turmaId || !nome)
        return safeAlert('Preencha todos os campos obrigatórios.');

      const payload = {
        id: editId || undefined,
        segmento_id: segId,
        serie_id: serieId,
        turma_id: turmaId,
        nome,
        responsavel,
        hora_entrada: horaEntrada,
        hora_saida: horaSaida,
        almoco: temAlmoco ? 1 : 0,
        jantar: temJantar ? 1 : 0,
        curso_extra_id: cursoExtra || null
      };

      // ✅ Escolhe se cria ou atualiza
      const endpoint = editId ? '/academico/alunos_update.php' : '/academico/alunos_create.php';
      const method = editId ? 'PUT' : 'POST';
      const res = await API.send(endpoint, method, payload);
      if (!res.ok) throw new Error(res.message || 'Erro ao salvar aluno');

      safeAlert(editId ? '✅ Aluno atualizado com sucesso!' : '✅ Aluno cadastrado com sucesso!');

      // 🔄 Atualiza árvore, selects e tabela
      await atualizarAcademico();

      if (typeof window.renderAlunos === 'function' && typeof window.fetchAlunosDaTurma === 'function') {
        const alunos = await window.fetchAlunosDaTurma(turmaId);
        window.renderAlunos(alunos);
      }

      // 🔚 Fecha modal e reseta estado
      wrap.hidden = true;
      delete wrap.dataset.editing;
      $('#acadSalvar').textContent = 'Salvar';
      form.reset();
      atualizarCampos();
      return;
    }

    // 🔄 Atualiza estrutura geral (para segmento/série/turma)
    await atualizarAcademico();
    wrap.hidden = true;
    form.reset();
    atualizarCampos();
    delete wrap.dataset.editing;
    $('#acadSalvar').textContent = 'Salvar';

  } catch (err) {
    safeAlert(err.message || 'Erro ao salvar cadastro.');
  }
});

})();

/* =========================================================
   FINANCEIRO — Preços Dinâmicos (Mensalidade por série)
   ========================================================= */

async function carregarFinanceiro() {
  // Aguarda DOM estar pronto
  await new Promise(r => setTimeout(r, 100));
  await carregarGlobais();
  await carregarSegmentos();
  const grid = document.getElementById('seriesGrid');
  if (grid) grid.innerHTML = '<p class="muted">Selecione um segmento acima.</p>';
}

/* ------------------ Valores Globais ------------------ */
async function carregarGlobais() {
  try {
    const r = await API.get('/precos/index.php');
    const precos = {};
    (r.data?.precos || []).forEach(p => precos[p.key] = p.valor);

const horaEl = document.querySelector('#finPrecoHora');
const almEl  = document.querySelector('#finPrecoAlmoco');
const janEl  = document.querySelector('#finPrecoJanta');

if (horaEl) horaEl.value = precos['hora.extra'] ?? '';
if (almEl)  almEl.value  = precos['refeicao.almoco'] ?? '';
if (janEl)  janEl.value  = precos['refeicao.jantar'] ?? '';

  } catch (err) {
    console.error('Erro ao carregar preços globais', err);
  }
}


/* ----- Salvando os valores globais ----- */
document.addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.id === 'btnSalvarHora') {
    const valor = parseFloat(document.getElementById('finPrecoHora')?.value);
    if (isNaN(valor)) return alert('Valor inválido');
    await salvarPreco('hora.extra', valor, 'Hora Extra atualizada!');
  }

  if (btn.id === 'btnSalvarAlmoco') {
    const valor = parseFloat(document.getElementById('finPrecoAlmoco')?.value);
    if (isNaN(valor)) return alert('Valor inválido');
    await salvarPreco('refeicao.almoco', valor, 'Valor do Almoço atualizado!');
  }

  if (btn.id === 'btnSalvarJanta') {
    const valor = parseFloat(document.getElementById('finPrecoJanta')?.value);
    if (isNaN(valor)) return alert('Valor inválido');
    await salvarPreco('refeicao.jantar', valor, 'Valor do Jantar atualizado!');
  }
});

async function salvarPreco(chave, valor, msgOk) {
  try {
    await API.send('/financeiro/precos.php', 'POST', { chave, valor });
    safeAlert(msgOk);
    await carregarGlobais(); // ✅ força sincronização
  } catch (err) {
    console.error('Erro ao salvar preço', err);
    toast('Erro ao salvar preço', 'erro');
  }
}


/* ------------------ Segmentos / Séries ------------------ */
async function carregarSegmentos() {
  const sel = document.getElementById('selSegmento');
  if (!sel) return;
  sel.innerHTML = '<option>Carregando...</option>';
  try {
    const r = await API.get('/academico/segmentos.php');
    const segs = r.data?.items || r.segmentos || [];
    sel.innerHTML = '<option value="">Selecione o segmento</option>' +
      segs.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

async function carregarSeries(segmentoId) {
  const grid = document.getElementById('seriesGrid');
  if (!grid) return;
  grid.innerHTML = '<p class="muted">Carregando séries...</p>';

  try {
    const r = await API.get(`/financeiro/series.php?segmento_id=${segmentoId}`);
    const series = r.data?.items || [];
    if (!series.length) {
      grid.innerHTML = '<p class="muted">Nenhuma série encontrada para este segmento.</p>';
      return;
    }

    grid.innerHTML = series.map(s => `
      <div class="serie-card">
        <h4>${s.nome}</h4>
        <div class="row">
          <label>Mensalidade:</label>
          <input type="number" value="${s.mensalidade || 0}" step="0.01" data-id="${s.id}">
          <button class="btn-salvar" data-id="${s.id}">
            <i class="ri-save-line"></i> Salvar
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<p class="muted">Erro ao carregar séries: ${err.message}</p>`;
  }
}

/* ------------------ Eventos ------------------ */
document.getElementById('selSegmento')?.addEventListener('change', e => {
  const id = e.target.value;
  if (id) carregarSeries(id);
});

document.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-salvar');
  if (!btn) return;
  const id = btn.dataset.id;
  const input = document.querySelector(`input[data-id="${id}"]`);
  const mensalidade = parseFloat(input.value) || 0;
  try {
    await API.send('/financeiro/series.php', 'POST', { id, mensalidade });
    safeAlert('Mensalidade atualizada!');
  } catch {
    safeAlert('Erro ao salvar.');
  }
});

/* ------------------ Toast utilitário ------------------ */
function toast(msg, tipo = 'ok') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.className = 'toast ' + tipo;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* =========================================================
   Atualização da Estrutura Acadêmica (forçada)
   ========================================================= */
window.atualizarAcademico = async function() {
  try {
    window.ACAD_CACHE = null; // ✅ limpa cache antigo
    await Promise.all([
      loadAcademicoTree(),
      carregarSelects()
    ]);
    console.info('%cEstrutura acadêmica atualizada.', 'color:#22c55e');
  } catch (err) {
    console.error('Erro ao atualizar estrutura acadêmica:', err);
  }
};


async function carregarLogs() {
  const res = await fetch('../api/logs_listar.php');
  const json = await res.json();
  if (!json.ok) return;
  renderLogs(json.data);
}

function renderLogs(logs) {
  const lista = document.getElementById('listaLog');
  lista.innerHTML = '';

  logs.forEach(l => {
    const icon = {
      create: 'ri-add-circle-line',
      update: 'ri-edit-line',
      delete: 'ri-delete-bin-line',
      import: 'ri-upload-cloud-line',
    }[l.acao] || 'ri-information-line';

    const item = document.createElement('div');
    item.className = 'audit__item';
    item.style.borderLeftColor = {
      create: '#3fb950',
      update: '#f1c40f',
      delete: '#e74c3c',
      import: '#3498db'
    }[l.acao] || '#777';

    // Limita texto a 100 caracteres
    const textoCurto = l.texto.length > 100 ? l.texto.slice(0, 100) + '...' : l.texto;

    item.innerHTML = `
      <i class="${icon}"></i>
      <div>
        <strong>${l.usuario}</strong> — ${textoCurto}
        <small>${l.data}</small>
      </div>
    `;

    // Expande ao clicar
    if (l.texto.length > 100) {
      item.title = l.texto;
    }

    lista.appendChild(item);
  });
}

// Busca e filtro
document.getElementById('buscaLog').addEventListener('input', filtrarLogs);
document.getElementById('filtroAcao').addEventListener('change', filtrarLogs);

async function filtrarLogs() {
  const termo = document.getElementById('buscaLog').value.toLowerCase();
  const tipo = document.getElementById('filtroAcao').value;
  const res = await fetch('../api/logs_listar.php');
  const json = await res.json();
  if (!json.ok) return;

  const filtrado = json.data.filter(l =>
    (!tipo || l.acao === tipo) &&
    (l.texto.toLowerCase().includes(termo) || l.usuario.toLowerCase().includes(termo))
  );
  renderLogs(filtrado);
}

carregarLogs();

document.getElementById('btnGerarRelatorio').addEventListener('click', () => {
  const tipo  = document.getElementById('filtroAcao').value;
  const de    = document.getElementById('filtroDataInicio').value;
  const ate   = document.getElementById('filtroDataFim').value;

  const params = new URLSearchParams();
  if (tipo) params.append('tipo', tipo);
  if (de) params.append('de', de);
  if (ate) params.append('ate', ate);

window.open('../api/auditoria/relatorio.php?' + params.toString(), '_blank');
});

// ===== PRESENÇA POR DIA (modal enxuto) =====
(() => {
  const wrap = document.getElementById('modalPresencaDia');
  if (!wrap) return;

  const grid = document.getElementById('mpdGrid');
  const lblMonthYear = document.getElementById('mpdMonthYear');
  const btnPrev = document.getElementById('mpdPrev');
  const btnNext = document.getElementById('mpdNext');
  const btnClose = document.getElementById('mpdClose');
  const btnCancel = document.getElementById('mpdCancel');

  let state = {
    alunoId: null,
    ano: null,
    mes: null, // 1..12
    marcacoes: new Set(), // dias presentes (número do dia)
    nomeAluno: ''
  };

  function ymStr() {
    const m = String(state.mes).padStart(2,'0');
    return `${state.ano}-${m}`;
  }

  function openModal() {
    wrap.hidden = false;
    requestAnimationFrame(()=>wrap.classList.add('is-visible'));
  }
  function closeModal() {
    wrap.classList.remove('is-visible');
    setTimeout(()=>{ wrap.hidden = true; }, 180);
  }

  async function carregarMarcacoes() {
    try {
      // ajuste a rota se necessário
      const r = await API.get(`/cursos/presencas.php?aluno_id=${state.alunoId}&mes=${ymStr()}`);
      const dias = r.data?.dias || r.dias || []; // ex.: [1,2,5,18]
      state.marcacoes = new Set(dias.map(Number));
    } catch {
      state.marcacoes = new Set();
    }
  }

  function renderCalendario() {
    const dt = new Date(state.ano, state.mes - 1, 1);
    const monthName = dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    lblMonthYear.textContent = `${(state.nomeAluno ? state.nomeAluno + ' — ' : '')}${monthName}`;

    const firstDow = (dt.getDay() + 6) % 7; // transforma: dom=0 -> 6; seg=1 -> 0 (começando na segunda)
    const daysInMonth = new Date(state.ano, state.mes, 0).getDate();

    // Cabeçalho dos dias (SEG...DOM)
    const week = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
    grid.innerHTML = week.map(d => `<div style="font-weight:700;opacity:.7">${d}</div>`).join('');

    // Preenche vazios antes do dia 1
    for (let i=0;i<firstDow;i++) grid.insertAdjacentHTML('beforeend', `<div></div>`);

    // Dias
    for (let d=1; d<=daysInMonth; d++) {
      const presente = state.marcacoes.has(d);
      grid.insertAdjacentHTML('beforeend', `
        <div class="calendar-day ${presente?'presente':''}" data-dia="${d}">${d}</div>
      `);
    }
  }

  async function toggleDia(dia) {
    const presente = state.marcacoes.has(dia);
    try {
      // ajuste a rota/contrato conforme seu back
      // Protocolo: POST { aluno_id, data: 'YYYY-MM-DD', presente: 0|1 }
      const dataISO = `${ymStr()}-${String(dia).padStart(2,'0')}`;
      await API.send('/cursos/presencas.php', 'POST', {
        aluno_id: state.alunoId,
        data: dataISO,
        presente: presente ? 0 : 1
      });
      // Atualiza cache local
      if (presente) state.marcacoes.delete(dia); else state.marcacoes.add(dia);
      // Atualiza apenas o dia clicado
      const el = grid.querySelector(`.calendar-day[data-dia="${dia}"]`);
      if (el) el.classList.toggle('presente', !presente);
    } catch (e) {
      safeAlert(e.message || 'Falha ao registrar presença.');
    }
  }

  // Delegação de clique nos dias
  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.calendar-day[data-dia]');
    if (!cell) return;
    const dia = Number(cell.dataset.dia);
    if (dia) toggleDia(dia);
  });

  // Navegação mês
  btnPrev.addEventListener('click', async () => {
    let m = state.mes - 1, y = state.ano;
    if (m < 1) { m = 12; y--; }
    state.mes = m; state.ano = y;
    await carregarMarcacoes(); renderCalendario();
  });
  btnNext.addEventListener('click', async () => {
    let m = state.mes + 1, y = state.ano;
    if (m > 12) { m = 1; y++; }
    state.mes = m; state.ano = y;
    await carregarMarcacoes(); renderCalendario();
  });

  [btnClose, btnCancel].forEach(b => b && b.addEventListener('click', closeModal));
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal(); });

  // Exposta globalmente para você chamar no clique do botão da tabela
  window.openPresencaDiaModal = async function (alunoId, nomeAluno='') {
    const now = new Date();
    state = {
      alunoId,
      ano: now.getFullYear(),
      mes: now.getMonth() + 1,
      marcacoes: new Set(),
      nomeAluno
    };
    await carregarMarcacoes();
    renderCalendario();
    openModal();
  };
})();

// ====== CURSOS EXTRAS — Presença por Dia (Curso/Aluno) ======
(() => {
  const openBtnSelector = '[data-act="presenca-dia"]';

  const ui = {
    wrap:    document.getElementById('modalPresencaDia'),
    close:   document.getElementById('mpdClose'),
    cancel:  document.getElementById('mpdCancel'),
    prev:    document.getElementById('mpdPrev'),
    next:    document.getElementById('mpdNext'),
    grid:    document.getElementById('mpdGrid'),
    title:   document.getElementById('mpdMonthYear'),
    selCurso:document.getElementById('mpdCurso'),
    selAluno:document.getElementById('mpdAluno'),
  };

  if (!ui.wrap) return; // modal não existe na página

  const state = {
    cursoId:  null,
    alunoId:  null,
    ano:      null,
    mes:      null,        // 1..12
    presencas:new Set(),   // dias presentes (números)
    alunoTxt: ''
  };

  // ---------- Abertura via botão (ícone/fab) ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest(openBtnSelector);
    if (!b) return;
    e.preventDefault();
    abrirModal();
  });

  function abrirModal() {
    const hoje = new Date();
    state.ano = hoje.getFullYear();
    state.mes = hoje.getMonth() + 1;
    state.cursoId = null;
    state.alunoId = null;
    state.presencas = new Set();
    state.alunoTxt = '';

    ui.selAluno.innerHTML = `<option value="">Selecione o curso</option>`;
    carregarCursos().then(() => {
      ui.wrap.hidden = false;
      requestAnimationFrame(() => ui.wrap.classList.add('is-visible'));
      renderTitulo();
      ui.grid.innerHTML = ''; // aguarda seleção do aluno para desenhar
    });
  }

  function fecharModal() {
    ui.wrap.classList.remove('is-visible');
    setTimeout(() => { ui.wrap.hidden = true; }, 160);
  }

  [ui.close, ui.cancel].forEach(btn => btn && btn.addEventListener('click', fecharModal));
  ui.wrap.addEventListener('click', (e) => { if (e.target === ui.wrap) fecharModal(); });

  // ---------- Cursos / Alunos ----------
  async function carregarCursos() {
    try {
      const r = await API.get('/cursos/index.php'); // ajuste se necessário
      const cursos = r.data?.items || r.cursos || [];
      ui.selCurso.innerHTML = `<option value="">Selecione o curso</option>` +
        cursos.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    } catch (e) {
      ui.selCurso.innerHTML = `<option value="">Erro ao carregar cursos</option>`;
    }
  }

  async function carregarInscritos(cursoId) {
    try {
      const r = await API.get(`/cursos/inscritos.php?curso_id=${encodeURIComponent(cursoId)}`); // ajuste se necessário
      const alunos = r.data?.items || r.inscritos || r.alunos || [];
      ui.selAluno.innerHTML = alunos.length
        ? `<option value="">Selecione o aluno</option>` +
          alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')
        : `<option value="">Nenhum aluno inscrito</option>`;
    } catch (e) {
      ui.selAluno.innerHTML = `<option value="">Erro ao carregar alunos</option>`;
    }
  }

  ui.selCurso.addEventListener('change', async () => {
    state.cursoId = ui.selCurso.value || null;
    state.alunoId = null;
    state.presencas.clear();
    ui.selAluno.innerHTML = `<option value="">Carregando…</option>`;
    if (state.cursoId) await carregarInscritos(state.cursoId);
    ui.grid.innerHTML = ''; // limpa calendário até escolher aluno
    renderTitulo();
  });

  ui.selAluno.addEventListener('change', async () => {
    state.alunoId = ui.selAluno.value || null;
    state.alunoTxt = ui.selAluno.selectedOptions[0]?.textContent || '';
    await carregarPresencasMes();
    montarCalendario();
  });

  // ---------- Calendário ----------
  function ymStr() {
    return `${state.ano}-${String(state.mes).padStart(2, '0')}`;
  }

  function renderTitulo() {
    const dt = new Date(state.ano, (state.mes || 1) - 1, 1);
    const mesFmt = dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const prefixo = state.alunoTxt ? `${state.alunoTxt} — ` : '';
    ui.title.textContent = `${prefixo}${mesFmt}`;
  }

  async function carregarPresencasMes() {
    if (!state.alunoId) return;
    try {
      const r = await API.get(`/cursos/presencas.php?aluno_id=${state.alunoId}&ano=${state.ano}&mes=${state.mes}`);
      const dias = r.data?.dias || r.dias || [];
      state.presencas = new Set(dias.map(Number));
    } catch {
      state.presencas = new Set();
    }
  }

  function montarCalendario() {
    renderTitulo();
    ui.grid.innerHTML = '';

    if (!state.alunoId) {
      ui.grid.innerHTML = `<div style="grid-column:1/-1;opacity:.7;text-align:center;padding:.5rem">Selecione um aluno para ver/editar presenças.</div>`;
      return;
    }

    const dt1 = new Date(state.ano, state.mes - 1, 1);
    const dow = (dt1.getDay() + 6) % 7; // segunda=0
    const daysInMonth = new Date(state.ano, state.mes, 0).getDate();

    // cabeçalho dos dias
    ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].forEach(d =>
      ui.grid.insertAdjacentHTML('beforeend', `<div style="font-weight:700;opacity:.7">${d}</div>`)
    );

    // vazios antes do dia 1
    for (let i = 0; i < dow; i++) ui.grid.insertAdjacentHTML('beforeend', `<div></div>`);

    for (let d = 1; d <= daysInMonth; d++) {
      const presente = state.presencas.has(d);
      ui.grid.insertAdjacentHTML('beforeend', `
        <button type="button" class="calendar-day ${presente ? 'presente' : ''}" data-dia="${d}">${d}</button>
      `);
    }
  }

  async function toggleDia(dia) {
    if (!state.alunoId) return;
    const presente = !state.presencas.has(dia);
    try {
      await API.send('/cursos/presencas.php', 'POST', {
        aluno_id: state.alunoId,
        data: `${ymStr()}-${String(dia).padStart(2,'0')}`,
        presente
      });
      if (presente) state.presencas.add(dia); else state.presencas.delete(dia);
      const el = ui.grid.querySelector(`.calendar-day[data-dia="${dia}"]`);
      el?.classList.toggle('presente', presente);
      safeAlert(presente ? 'Presença marcada.' : 'Presença removida.');
    } catch (e) {
      safeAlert(e.message || 'Falha ao registrar presença.');
    }
  }

  ui.grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.calendar-day[data-dia]');
    if (!btn) return;
    toggleDia(Number(btn.dataset.dia));
  });

  ui.prev.addEventListener('click', async () => {
    let m = state.mes - 1, y = state.ano;
    if (m < 1) { m = 12; y--; }
    state.mes = m; state.ano = y;
    await carregarPresencasMes();
    montarCalendario();
  });

  ui.next.addEventListener('click', async () => {
    let m = state.mes + 1, y = state.ano;
    if (m > 12) { m = 1; y++; }
    state.mes = m; state.ano = y;
    await carregarPresencasMes();
    montarCalendario();
  });
})();

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act="presenca-dia"]');
  if (!btn) return;

  const cursoId = btn.dataset.cursoId || btn.closest('[data-curso-id]')?.dataset.cursoId;
  const modal = document.getElementById('modalPresencaDia');
  modal.hidden = false;

  // Se você quiser já selecionar o curso no modal:
  const selectCurso = document.getElementById('mpdCurso');
  if (cursoId && selectCurso?.options?.length) {
    selectCurso.value = cursoId;
    selectCurso.dispatchEvent(new Event('change'));
  }
});

function safeAlert(msg, ms = 2000) {
  if (!msg) return;
  document.querySelectorAll('.nice-toast').forEach(n => n.remove());
  const t = document.createElement('div');
  t.className = 'nice-toast';
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', left:'50%', bottom:'22px', transform:'translateX(-50%)',
    background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px',
    padding:'10px 16px', boxShadow:'0 6px 24px rgba(0,0,0,.15)', fontWeight:'600',
    color:'#111827', zIndex:9999
  });
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, ms);
}

/* Helpers fetch (sem o objeto API) */
const apiBase = (document.querySelector('meta[name="api-base"]')?.content || '../api').replace(/\/+$/, '');
async function apiGet(path) {
  const r = await fetch(`${apiBase}${path}`, { credentials:'include' });
  const j = await r.json().catch(()=> ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Falha na API');
  return j;
}
async function apiSend(path, method, body) {
  const r = await fetch(`${apiBase}${path}`, {
    method,
    credentials:'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const j = await r.json().catch(()=> ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Falha ao salvar');
  return j;
}

/* Seletores do modal */
const modalCurso   = document.getElementById('cursoModal');
const btnClose     = document.getElementById('cursoClose');
const btnCancel    = document.getElementById('cursoCancel');
const btnSave      = document.getElementById('cursoSave');
const inpNome      = document.getElementById('cursoNome');
const inpProf      = document.getElementById('cursoProfessor');
const inpHorario   = document.getElementById('cursoHorario');
const inpPreco     = document.getElementById('cursoPreco');
const tituloModal  = document.getElementById('cursoTitulo');

let CURSO_EDIT_ID = null;

/* Abrir/fechar modal */
function openCursoModal(id) {
  CURSO_EDIT_ID = id;
  if (!modalCurso) return;
  modalCurso.hidden = false;
  requestAnimationFrame(()=> modalCurso.classList.add('is-visible'));
}
function closeCursoModal() {
  if (!modalCurso) return;
  modalCurso.classList.remove('is-visible');
  setTimeout(()=> modalCurso.hidden = true, 160);
  CURSO_EDIT_ID = null;
  if (inpNome)    inpNome.value = '';
  if (inpProf)    inpProf.value = '';
  if (inpHorario) inpHorario.value = '';
  if (inpPreco)   inpPreco.value = '';
}

/* Carrega dados do curso e preenche inputs */
async function loadCurso(id) {
  try {
    const r = await apiGet(`/cursos/item.php?id=${encodeURIComponent(id)}`);
    const c = r.data?.item || r.item || r.data || {};
    if (tituloModal)  tituloModal.textContent = `Editar Curso`;
    if (inpNome)      inpNome.value    = c.nome || c.curso || '';
    if (inpProf)      inpProf.value    = c.professor || '';
    if (inpHorario)   inpHorario.value = c.horario || c.dias || '';
    if (inpPreco)     inpPreco.value   = (c.preco ?? c.preco_mensal ?? '').toString().replace(',', '.');
  } catch (e) {
    safeAlert(e.message || 'Não foi possível carregar o curso.');
    closeCursoModal();
  }
}

/* Salvar alterações */
async function saveCurso() {
  if (!CURSO_EDIT_ID) return;
  const payload = {
    id: Number(CURSO_EDIT_ID),
    nome: (inpNome?.value || '').trim(),
    professor: (inpProf?.value || '').trim(),
    horario: (inpHorario?.value || '').trim(),
    preco: parseFloat(inpPreco?.value?.toString().replace(',', '.') || '0')
  };
  if (!payload.nome) { safeAlert('Informe o nome do curso.'); return; }

  try {
    await apiSend(`/cursos/item.php?id=${encodeURIComponent(CURSO_EDIT_ID)}`, 'PUT', payload);
    safeAlert('Curso atualizado!');
    // Atualiza a linha da tabela sem recarregar
    const row = document.querySelector(`.table__row[data-curso-id="${CURSO_EDIT_ID}"]`);
    if (row) {
      const cells = row.querySelectorAll('span, td');
      // espera-se: 0=curso, 1=professor, 2=horário, 3=preço (ajuste se necessário)
      cells[0] && (cells[0].textContent = payload.nome);
      cells[1] && (cells[1].textContent = payload.professor || '—');
      cells[2] && (cells[2].textContent = payload.horario || '—');
      cells[3] && (cells[3].textContent = (payload.preco || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL'}));
    }
    closeCursoModal();
  } catch (e) {
    safeAlert(e.message || 'Erro ao salvar curso.');
  }
}

/* Bind dos botões do modal */
btnClose  && btnClose.addEventListener('click', closeCursoModal);
btnCancel && btnCancel.addEventListener('click', closeCursoModal);
btnSave   && btnSave.addEventListener('click', saveCurso);
modalCurso && modalCurso.addEventListener('click', (e)=>{ if (e.target === modalCurso) closeCursoModal(); });

/* Delegação: ícone de lápis no catálogo */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act="curso-edit"]');
  if (!btn) return;
  const row = btn.closest('[data-curso-id]');
  const id  = row?.dataset.cursoId || btn.dataset.id;
  if (!id) { safeAlert('Curso inválido.'); return; }
  openCursoModal(id);
  await loadCurso(id);
});

document.addEventListener('DOMContentLoaded', function() {
    // Filtro por Segmento (chips)
    const segmentoChips = document.querySelectorAll('.chip');
    segmentoChips.forEach(chip => {
        chip.addEventListener('click', function() {
            const checkbox = this.querySelector('input[type="checkbox"]');
            
            if (checkbox.value === 'todos') {
                // Se clicar em "Todos", desmarca os outros
                segmentoChips.forEach(c => {
                    const cb = c.querySelector('input[type="checkbox"]');
                    cb.checked = false;
                    c.classList.remove('on');
                });
                checkbox.checked = true;
                this.classList.add('on');
            } else {
                // Se clicar em outro, desmarca "Todos"
                const todosChip = document.querySelector('.chip input[value="todos"]');
                todosChip.checked = false;
                todosChip.parentElement.classList.remove('on');
                
                checkbox.checked = !checkbox.checked;
                this.classList.toggle('on', checkbox.checked);
            }
            
            filtrarAlunos();
        });
    });

    // Filtros
    const filtroSerie = document.getElementById('filtroSerie');
    const filtroTurma = document.getElementById('filtroTurma');
    const buscaAlunosFiltro = document.getElementById('buscaAlunosFiltro');
    const buscaAlunos = document.getElementById('buscaAlunos');

    // Adicionar eventos
    filtroSerie.addEventListener('change', filtrarAlunos);
    filtroTurma.addEventListener('change', filtrarAlunos);
    buscaAlunosFiltro.addEventListener('input', filtrarAlunos);
    buscaAlunos.addEventListener('input', filtrarAlunos);

    // Botão Limpar Filtros
    const btnLimparFiltros = document.getElementById('btnLimparFiltros');
    btnLimparFiltros.addEventListener('click', function() {
        // Limpar chips
        segmentoChips.forEach(chip => {
            const checkbox = chip.querySelector('input[type="checkbox"]');
            checkbox.checked = false;
            chip.classList.remove('on');
        });
        
        // Marcar "Todos"
        const todosChip = document.querySelector('.chip input[value="todos"]');
        todosChip.checked = true;
        todosChip.parentElement.classList.add('on');
        
        // Limpar outros filtros
        filtroSerie.value = '';
        filtroTurma.value = '';
        buscaAlunosFiltro.value = '';
        buscaAlunos.value = '';
        
        filtrarAlunos();
    });

    function filtrarAlunos() {
        const segmentosSelecionados = Array.from(document.querySelectorAll('input[name="segmento"]:checked'))
            .map(cb => cb.value);
        
        const serieSelecionada = filtroSerie.value;
        const turmaSelecionada = filtroTurma.value;
        const termoBusca = buscaAlunosFiltro.value.toLowerCase() || buscaAlunos.value.toLowerCase();

        console.log('Filtrando alunos:', {
            segmentos: segmentosSelecionados,
            serie: serieSelecionada,
            turma: turmaSelecionada,
            busca: termoBusca
        });

        // Aqui você implementaria a filtragem real
        // Por enquanto só atualiza o título
        atualizarTitulo();
    }

    function atualizarTitulo() {
        const titulo = document.getElementById('tituloTurma');
        titulo.textContent = 'Todos os Alunos (5 alunos)';
    }
});

// Botão flutuante para cadastro acadêmico
document.addEventListener('DOMContentLoaded', function() {
    const btnAddAcademico = document.getElementById('btnAddAcademico');
    
    if (btnAddAcademico) {
        btnAddAcademico.addEventListener('click', function() {
            // Abre o modal de cadastro acadêmico que já existe no código
            const acadModal = document.getElementById('acadModal');
            if (acadModal) {
                showModal(acadModal);
                
                // Foca no primeiro campo do modal
                 const primeiroCampo = acadModal.querySelector('input, select');
                if (primeiroCampo) {
                    setTimeout(() => primeiroCampo.focus(), 100);
                }
            }
        });
    }

    // Fechar modal quando clicar no X
    const acadModalClose = document.getElementById('acadModalClose');
    if (acadModalClose) {
        acadModalClose.addEventListener('click', function() {
            const acadModal = document.getElementById('acadModal');
            if (acadModal) {
                hideModal(acadModal);
            }
        });
    }

    // Fechar modal quando clicar em Cancelar
    const acadModalCancel = document.getElementById('acadModalCancel');
    if (acadModalCancel) {
        acadModalCancel.addEventListener('click', function() {
            const acadModal = document.getElementById('acadModal');
            if (acadModal) {
                hideModal(acadModal);
            }
        });
    }

    // Fechar modal quando clicar fora dele
    const acadModal = document.getElementById('acadModal');
    if (acadModal) {
        acadModal.addEventListener('click', function(e) {
            if (e.target === acadModal) {
                hideModal(acadModal);
            }
        });
    }

    // Controle dos tipos de cadastro no modal
    const acadTipos = document.querySelectorAll('input[name="acadTipo"]');
    const acadFieldsets = document.querySelectorAll('.acad-fieldset');
    
    acadTipos.forEach(tipo => {
        tipo.addEventListener('change', function() {
            const valor = this.value;
            
            // Esconde todos os fieldsets
            acadFieldsets.forEach(fieldset => {
                fieldset.classList.add('hidden');
            });
            
            // Mostra apenas o fieldset correspondente
            const fieldsetAlvo = document.querySelector(`.acad-${valor}`);
            if (fieldsetAlvo) {
                fieldsetAlvo.classList.remove('hidden');
            }
        });
    });
});

// Funções auxiliares para mostrar/esconder modais
window.showModal = function(el) {
    if (!el) return;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-visible'));
    document.body.style.overflow = 'hidden';
};

window.hideModal = function(el) {
    if (!el) return;
    el.classList.remove('is-visible');
    setTimeout(() => { 
        el.hidden = true;
        document.body.style.overflow = '';
    }, 180);
};

document.addEventListener('DOMContentLoaded', function() {
    // Botão Quick Aluno (na seção de Alunos)
    const btnQuickAluno = document.getElementById('btnQuickAluno');
    
    if (btnQuickAluno) {
        btnQuickAluno.addEventListener('click', function() {
            // Abre o modal específico de alunos
            const alunoModal = document.getElementById('alunoModal');
            if (alunoModal) {
                // Limpa os campos do formulário
                const form = document.getElementById('alunoForm');
                if (form) {
                    form.reset();
                }
                
                // Carrega os selects
                carregarSelectsAluno();
                
                // Mostra o modal
                showModal(alunoModal);
                
                // Foca no primeiro campo
                setTimeout(() => {
                    const primeiroCampo = alunoModal.querySelector('#alunoNome');
                    if (primeiroCampo) {
                        primeiroCampo.focus();
                    }
                }, 100);
            }
        });
    }

    // Configura o modal de alunos
    configurarModalAluno();
});

// Função para carregar selects do modal de alunos
async function carregarSelectsAluno() {
    const cache = await ensureAcadCache();
    const segmentos = cache.segmentos || [];

    const selSeg = document.getElementById('alunoSelSegmento');
    const selSerie = document.getElementById('alunoSelSerie');
    const selTurma = document.getElementById('alunoSelTurma');

    // Preenche segmentos
    fillSelect(selSeg, segmentos, 'Selecione o Segmento');
    selSerie.innerHTML = '<option value="">Selecione a Série</option>';
    selTurma.innerHTML = '<option value="">Selecione a Turma</option>';

    // Encadeamento dos selects
    selSeg.addEventListener('change', async function() {
        const series = seriesBySegment(cache, selSeg.value);
        fillSelect(selSerie, series, 'Selecione a Série');
        selTurma.innerHTML = '<option value="">Selecione a Turma</option>';
    });

    selSerie.addEventListener('change', async function() {
        const turmas = turmasBySerie(cache, selSeg.value, selSerie.value);
        fillSelect(selTurma, turmas, 'Selecione a Turma');
    });
}

// Configurar eventos do modal de alunos
function configurarModalAluno() {
    const modal = document.getElementById('alunoModal');
    const closeBtn = document.getElementById('alunoModalClose');
    const cancelBtn = document.getElementById('alunoModalCancel');
    const saveBtn = document.getElementById('alunoSalvar');

    // Fechar modal
    [closeBtn, cancelBtn].forEach(btn => {
        btn && btn.addEventListener('click', () => hideModal(modal));
    });

    // Fechar ao clicar no backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal(modal);
    });

    // Salvar aluno
    saveBtn && saveBtn.addEventListener('click', salvarAluno);
}

// Função para salvar aluno
async function salvarAluno() {
    const segId = document.getElementById('alunoSelSegmento')?.value;
    const serieId = document.getElementById('alunoSelSerie')?.value;
    const turmaId = document.getElementById('alunoSelTurma')?.value;
    const nome = document.getElementById('alunoNome')?.value.trim();
    const responsavel = document.getElementById('alunoResp')?.value.trim();
    const horaEntrada = document.getElementById('alunoHoraEntrada')?.value || null;
    const horaSaida = document.getElementById('alunoHoraSaida')?.value || null;
    const temAlmoco = document.getElementById('alunoTemAlmoco')?.checked || false;
    const temJantar = document.getElementById('alunoTemJantar')?.checked || false;
    const cursoExtra = document.getElementById('alunoCursoExtra')?.value || null;

    if (!segId || !serieId || !turmaId || !nome) {
        safeAlert('Preencha todos os campos obrigatórios (Segmento, Série, Turma e Nome).');
        return;
    }

    try {
        const payload = {
            segmento_id: segId,
            serie_id: serieId,
            turma_id: turmaId,
            nome,
            responsavel,
            hora_entrada: horaEntrada,
            hora_saida: horaSaida,
            almoco: temAlmoco ? 1 : 0,
            jantar: temJantar ? 1 : 0,
            curso_extra_id: cursoExtra || null
        };

        await API.send('/academico/alunos_create.php', 'POST', payload);
        safeAlert('Aluno cadastrado com sucesso!');

        // Fecha o modal
        hideModal(document.getElementById('alunoModal'));

        // Atualiza a estrutura acadêmica se estiver visível
        await atualizarAcademico();

    } catch (err) {
        safeAlert(err.message || 'Erro ao cadastrar aluno.');
    }
}

// Configuração do Modal de Aluno
document.addEventListener('DOMContentLoaded', function() {
    // Botão Quick Aluno (na seção de Alunos)
    const btnQuickAluno = document.getElementById('btnQuickAluno');
    
    if (btnQuickAluno) {
        btnQuickAluno.addEventListener('click', function() {
            abrirModalAluno();
        });
    }

    // Configurar eventos do modal de alunos
    configurarModalAluno();
});

// Função para abrir o modal de aluno
async function abrirModalAluno() {
    const alunoModal = document.getElementById('alunoModal');
    if (alunoModal) {
        // Limpa os campos do formulário
        const form = document.getElementById('alunoForm');
        if (form) {
            form.reset();
        }
        
        // Carrega os selects
        await carregarSelectsAluno();
        
        // Mostra o modal
        showModal(alunoModal);
        
        // Foca no primeiro campo
        setTimeout(() => {
            const primeiroCampo = alunoModal.querySelector('#alunoNome');
            if (primeiroCampo) {
                primeiroCampo.focus();
            }
        }, 100);
    }
}

// Função para carregar selects do modal de alunos
async function carregarSelectsAluno() {
    try {
        const cache = await ensureAcadCache();
        const segmentos = cache.segmentos || [];

        const selSeg = document.getElementById('alunoSelSegmento');
        const selSerie = document.getElementById('alunoSelSerie');
        const selTurma = document.getElementById('alunoSelTurma');

        // Preenche segmentos
        fillSelect(selSeg, segmentos, 'Selecione o Segmento');
        selSerie.innerHTML = '<option value="">Selecione a Série</option>';
        selTurma.innerHTML = '<option value="">Selecione a Turma</option>';

        // Carrega cursos extras
        await carregarCursosExtras();

    } catch (error) {
        console.error('Erro ao carregar selects:', error);
        safeAlert('Erro ao carregar dados do formulário.');
    }
}

// Função para carregar cursos extras
async function carregarCursosExtras() {
    try {
        const selCursoExtra = document.getElementById('alunoCursoExtra');
        if (!selCursoExtra) return;

        const response = await API.get('/cursos/index.php');
        const cursos = response.data?.items || response.cursos || [];
        
        let options = '<option value="">Nenhum</option>';
        cursos.forEach(curso => {
            options += `<option value="${curso.id}">${curso.nome}</option>`;
        });
        
        selCursoExtra.innerHTML = options;
    } catch (error) {
        console.error('Erro ao carregar cursos extras:', error);
    }
}

// Configurar eventos do modal de alunos
function configurarModalAluno() {
    const modal = document.getElementById('alunoModal');
    const closeBtn = document.getElementById('alunoModalClose');
    const cancelBtn = document.getElementById('alunoModalCancel');
    const saveBtn = document.getElementById('alunoSalvar');
    const selSeg = document.getElementById('alunoSelSegmento');
    const selSerie = document.getElementById('alunoSelSerie');
    const selTurma = document.getElementById('alunoSelTurma');

    // Fechar modal
    [closeBtn, cancelBtn].forEach(btn => {
        btn && btn.addEventListener('click', () => hideModal(modal));
    });

    // Fechar ao clicar no backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal(modal);
    });

    // Encadeamento dos selects
    selSeg.addEventListener('change', async function() {
        const cache = await ensureAcadCache();
        const series = seriesBySegment(cache, selSeg.value);
        fillSelect(selSerie, series, 'Selecione a Série');
        selTurma.innerHTML = '<option value="">Selecione a Turma</option>';
    });

    selSerie.addEventListener('change', async function() {
        const cache = await ensureAcadCache();
        const turmas = turmasBySerie(cache, selSeg.value, selSerie.value);
        fillSelect(selTurma, turmas, 'Selecione a Turma');
    });

    // Salvar aluno
    saveBtn && saveBtn.addEventListener('click', salvarAluno);
}

// Função para salvar aluno
async function salvarAluno() {
    const segId = document.getElementById('alunoSelSegmento')?.value;
    const serieId = document.getElementById('alunoSelSerie')?.value;
    const turmaId = document.getElementById('alunoSelTurma')?.value;
    const nome = document.getElementById('alunoNome')?.value.trim();
    const responsavel = document.getElementById('alunoResp')?.value.trim();
    const horaEntrada = document.getElementById('alunoHoraEntrada')?.value || null;
    const horaSaida = document.getElementById('alunoHoraSaida')?.value || null;
    const temAlmoco = document.getElementById('alunoTemAlmoco')?.checked || false;
    const temJantar = document.getElementById('alunoTemJantar')?.checked || false;
    const cursoExtra = document.getElementById('alunoCursoExtra')?.value || null;

    // Validação
    if (!segId || !serieId || !turmaId || !nome) {
        safeAlert('Preencha todos os campos obrigatórios (Segmento, Série, Turma e Nome).');
        return;
    }

    try {
        const payload = {
            segmento_id: segId,
            serie_id: serieId,
            turma_id: turmaId,
            nome,
            responsavel: responsavel || null,
            hora_entrada: horaEntrada,
            hora_saida: horaSaida,
            almoco: temAlmoco ? 1 : 0,
            jantar: temJantar ? 1 : 0,
            curso_extra_id: cursoExtra || null
        };

        await API.send('/academico/alunos_create.php', 'POST', payload);
        safeAlert('Aluno cadastrado com sucesso!');

        // Fecha o modal
        hideModal(document.getElementById('alunoModal'));

        // Atualiza a estrutura acadêmica
        await atualizarAcademico();

        if (document.getElementById('view-alunos').classList.contains('is-visible')) {
            await loadAcademicoTree();
        }

    } catch (err) {
        safeAlert(err.message || 'Erro ao cadastrar aluno.');
    }
}

// Funções auxiliares para mostrar/esconder modais (se não existirem)
if (typeof showModal === 'undefined') {
    window.showModal = function(el) {
        if (!el) return;
        el.hidden = false;
        requestAnimationFrame(() => el.classList.add('is-visible'));
        document.body.style.overflow = 'hidden';
    };
}

if (typeof hideModal === 'undefined') {
    window.hideModal = function(el) {
        if (!el) return;
        el.classList.remove('is-visible');
        setTimeout(() => { 
            el.hidden = true;
            document.body.style.overflow = '';
        }, 180);
    };
}

// Configuração do Modal de Aluno
document.addEventListener('DOMContentLoaded', function() {
    // Botão Quick Aluno (na seção de Alunos)
    const btnAddAluno = document.getElementById('btnAddAluno');
    
    if (btnAddAluno) {
        btnAddAluno.addEventListener('click', function() {
            abrirModalAluno();
        });
    }

    // Configurar eventos do modal de alunos
    configurarModalAluno();
});

// Função para abrir o modal de aluno
async function abrirModalAluno() {
    const alunoModal = document.getElementById('alunoModal');
    if (alunoModal) {
        // Limpa os campos do formulário
        const form = document.getElementById('alunoForm');
        if (form) {
            form.reset();
        }
        
        // Carrega os selects
        await carregarSelectsAluno();
        
        // Mostra o modal
        showModal(alunoModal);
        
        // Foca no primeiro campo
        setTimeout(() => {
            const primeiroCampo = alunoModal.querySelector('#alunoNome');
            if (primeiroCampo) {
                primeiroCampo.focus();
            }
        }, 100);
    }
}

// Função para carregar selects do modal de alunos
async function carregarSelectsAluno() {
    try {
        const cache = await ensureAcadCache();
        const segmentos = cache.segmentos || [];

        const selSeg = document.getElementById('alunoSelSegmento');
        const selSerie = document.getElementById('alunoSelSerie');
        const selTurma = document.getElementById('alunoSelTurma');

        // Preenche segmentos
        fillSelect(selSeg, segmentos, 'Selecione o Segmento');
        selSerie.innerHTML = '<option value="">Selecione a Série</option>';
        selTurma.innerHTML = '<option value="">Selecione a Turma</option>';

        // Carrega cursos extras
        await carregarCursosExtras();

        // Encadeamento dos selects
        selSeg.addEventListener('change', async function() {
            const series = seriesBySegment(cache, selSeg.value);
            fillSelect(selSerie, series, 'Selecione a Série');
            selTurma.innerHTML = '<option value="">Selecione a Turma</option>';
        });

        selSerie.addEventListener('change', async function() {
            const turmas = turmasBySerie(cache, selSeg.value, selSerie.value);
            fillSelect(selTurma, turmas, 'Selecione a Turma');
        });

    } catch (error) {
        console.error('Erro ao carregar selects:', error);
        safeAlert('Erro ao carregar dados do formulário.');
    }
}

// Função para carregar cursos extras
async function carregarCursosExtras() {
    try {
        const selCursoExtra = document.getElementById('alunoCursoExtra');
        if (!selCursoExtra) return;

        const response = await API.get('/cursos/index.php');
        const cursos = response.data?.items || response.cursos || [];
        
        let options = '<option value="">Nenhum</option>';
        cursos.forEach(curso => {
            options += `<option value="${curso.id}">${curso.nome}</option>`;
        });
        
        selCursoExtra.innerHTML = options;
    } catch (error) {
        console.error('Erro ao carregar cursos extras:', error);
    }
}

// Configurar eventos do modal de alunos
function configurarModalAluno() {
    const modal = document.getElementById('alunoModal');
    const closeBtn = document.getElementById('alunoModalClose');
    const cancelBtn = document.getElementById('alunoModalCancel');
    const saveBtn = document.getElementById('alunoSalvar');

    // Fechar modal
    [closeBtn, cancelBtn].forEach(btn => {
        btn && btn.addEventListener('click', () => hideModal(modal));
    });

    // Fechar ao clicar no backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal(modal);
    });

    // Salvar aluno
    saveBtn && saveBtn.addEventListener('click', salvarAluno);
}

// Função para salvar aluno
async function salvarAluno() {
    const segId = document.getElementById('alunoSelSegmento')?.value;
    const serieId = document.getElementById('alunoSelSerie')?.value;
    const turmaId = document.getElementById('alunoSelTurma')?.value;
    const nome = document.getElementById('alunoNome')?.value.trim();
    const responsavel = document.getElementById('alunoResp')?.value.trim();
    const horaEntrada = document.getElementById('alunoHoraEntrada')?.value || null;
    const horaSaida = document.getElementById('alunoHoraSaida')?.value || null;
    const temAlmoco = document.getElementById('alunoTemAlmoco')?.checked || false;
    const temJantar = document.getElementById('alunoTemJantar')?.checked || false;
    const cursoExtra = document.getElementById('alunoCursoExtra')?.value || null;

    // Validação
    if (!segId || !serieId || !turmaId || !nome) {
        safeAlert('Preencha todos os campos obrigatórios (Segmento, Série, Turma e Nome).');
        return;
    }

    try {
        const payload = {
            segmento_id: segId,
            serie_id: serieId,
            turma_id: turmaId,
            nome,
            responsavel: responsavel || null,
            hora_entrada: horaEntrada,
            hora_saida: horaSaida,
            almoco: temAlmoco ? 1 : 0,
            jantar: temJantar ? 1 : 0,
            curso_extra_id: cursoExtra || null
        };

        await API.send('/academico/alunos_create.php', 'POST', payload);
        safeAlert('Aluno cadastrado com sucesso!');

        // Fecha o modal
        hideModal(document.getElementById('alunoModal'));

        // Atualiza a estrutura acadêmica
        await atualizarAcademico();

        // Recarrega a lista de alunos se estiver na view de alunos
        if (document.getElementById('view-alunos').classList.contains('is-visible')) {
            await loadAcademicoTree();
        }

    } catch (err) {
        safeAlert(err.message || 'Erro ao cadastrar aluno.');
    }
}

// Variáveis para a grade semanal do aluno
const alunoSemana = {};
const alunoHORARIOS = ['', '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];

// Inicializar estrutura da semana
DIAS.forEach(d => (alunoSemana[d.key] = { in: '', out: '', almoco: false, jantar: false }));

// Função para montar a grade semanal no modal do aluno
function montarSemanaAluno() {
    const weekGrid = document.getElementById('alunoWeekGrid');
    if (!weekGrid) return;

    weekGrid.innerHTML = '';

    DIAS.forEach(dia => {
        const st = alunoSemana[dia.key] || { in: '', out: '', almoco: false, jantar: false };

        const card = document.createElement('div');
        card.className = 'day-card';
        card.dataset.day = dia.key;
        card.innerHTML = `
            <div class="day-head">
                <div class="day-title">
                    <i class="ri-calendar-check-line"></i>
                    <div><div>${dia.nome}</div><span>${dia.abrev}</span></div>
                </div>
                <span class="badge"><i class="ri-timer-2-line"></i> <b data-aluno-resumo="${dia.key}">Sem horário</b></span>
            </div>
            <div class="day-body">
                <div>
                    <label class="label small">Entrada</label>
                    <div class="select">
                        <select data-aluno-in="${dia.key}">
                            ${alunoHORARIOS.map(h => `<option value="${h}" ${st.in === h ? 'selected' : ''}>${h || 'Selecione'}</option>`).join('')}
                        </select>
                        <i class="ri-arrow-down-s-line"></i>
                    </div>
                </div>
                <div>
                    <label class="label small">Saída</label>
                    <div class="select">
                        <select data-aluno-out="${dia.key}">
                            ${alunoHORARIOS.map(h => `<option value="${h}" ${st.out === h ? 'selected' : ''}>${h || 'Selecione'}</option>`).join('')}
                        </select>
                        <i class="ri-arrow-down-s-line"></i>
                    </div>
                </div>
                <div class="checks">
                    <label class="check"><input type="checkbox" data-aluno-almoco="${dia.key}" ${st.almoco ? 'checked' : ''}> Almoço</label>
                    <label class="check"><input type="checkbox" data-aluno-jantar="${dia.key}" ${st.jantar ? 'checked' : ''}> Jantar</label>
                </div>
                <div class="summary" data-aluno-summary="${dia.key}">Selecione horários e refeições</div>
            </div>
        `;
        weekGrid.appendChild(card);
    });

    // Adicionar event listeners
    weekGrid.querySelectorAll('select[data-aluno-in], select[data-aluno-out], input[data-aluno-almoco], input[data-aluno-jantar]')
        .forEach(el => {
            el.addEventListener('change', e => {
                const key = el.dataset.alunoIn || el.dataset.alunoOut || el.dataset.alunoAlmoco || el.dataset.alunoJantar;
                const st = alunoSemana[key];
                if (el.dataset.alunoIn) st.in = el.value;
                if (el.dataset.alunoOut) st.out = el.value;
                if (el.dataset.alunoAlmoco) st.almoco = el.checked;
                if (el.dataset.alunoJantar) st.jantar = el.checked;
                atualizarResumoAluno(key);
            });
        });

    DIAS.forEach(d => atualizarResumoAluno(d.key));
}

// Função para atualizar resumo diário
function atualizarResumoAluno(k) {
    const st = alunoSemana[k];
    const elResumo = document.querySelector(`[data-aluno-resumo="${k}"]`);
    const elSummary = document.querySelector(`[data-aluno-summary="${k}"]`);
    
    if (!st.in || !st.out) {
        if (elResumo) elResumo.textContent = 'Sem horário';
        if (elSummary) elSummary.textContent = 'Selecione horários e refeições';
        return;
    }
    
    const minutos = Math.max(0, mins(st.out) - mins(st.in));
    const horas = minutos / 60;
    const refeicoes = [st.almoco && 'Almoço', st.jantar && 'Jantar'].filter(Boolean).join(', ') || 'Sem refeições';
    
    if (elResumo) elResumo.textContent = `${horas.toFixed(1)}h`;
    if (elSummary) elSummary.textContent = `Entrada: ${st.in} • Saída: ${st.out} • ${refeicoes}`;
}

// Função para replicar segunda-feira nos outros dias
function configurarReplicacaoAluno() {
    const btnReplicar = document.getElementById('alunoBtnReplicar');
    if (!btnReplicar) return;

    btnReplicar.addEventListener('click', function() {
        const base = { ...alunoSemana['seg'] };

        // Replica o estado lógico
        ['ter','qua','qui','sex'].forEach(k => {
            alunoSemana[k] = { ...base };
        });

        // Atualiza visualmente os selects e checkboxes existentes
        ['ter','qua','qui','sex'].forEach(k => {
            const card = document.querySelector(`#alunoWeekGrid .day-card[data-day="${k}"]`);
            if (!card) return;

            const selectIn = card.querySelector(`select[data-aluno-in="${k}"]`);
            const selectOut = card.querySelector(`select[data-aluno-out="${k}"]`);
            const chkAlmoco = card.querySelector(`input[data-aluno-almoco="${k}"]`);
            const chkJantar = card.querySelector(`input[data-aluno-jantar="${k}"]`);

            if (selectIn) selectIn.value = base.in || '';
            if (selectOut) selectOut.value = base.out || '';
            if (chkAlmoco) chkAlmoco.checked = base.almoco || false;
            if (chkJantar) chkJantar.checked = base.jantar || false;

            atualizarResumoAluno(k);
        });

        safeAlert('Horários da segunda-feira replicados para os outros dias!');
    });
}

// Função para aplicar horários padrão
function configurarHorariosPadrao() {
    const horaEntrada = document.getElementById('alunoHoraEntrada');
    const horaSaida = document.getElementById('alunoHoraSaida');
    const checkAlmoco = document.getElementById('alunoTemAlmoco');
    const checkJantar = document.getElementById('alunoTemJantar');

    if (horaEntrada && horaSaida) {
        // Aplicar horários padrão quando alterados
        [horaEntrada, horaSaida].forEach(input => {
            input.addEventListener('change', function() {
                if (this.value) {
                    DIAS.forEach(dia => {
                        if (this.id === 'alunoHoraEntrada') {
                            alunoSemana[dia.key].in = this.value;
                            const select = document.querySelector(`select[data-aluno-in="${dia.key}"]`);
                            if (select) select.value = this.value;
                        } else {
                            alunoSemana[dia.key].out = this.value;
                            const select = document.querySelector(`select[data-aluno-out="${dia.key}"]`);
                            if (select) select.value = this.value;
                        }
                        atualizarResumoAluno(dia.key);
                    });
                }
            });
        });
    }

    if (checkAlmoco && checkJantar) {
        // Aplicar refeições padrão quando alteradas
        [checkAlmoco, checkJantar].forEach(check => {
            check.addEventListener('change', function() {
                DIAS.forEach(dia => {
                    if (this.id === 'alunoTemAlmoco') {
                        alunoSemana[dia.key].almoco = this.checked;
                        const checkbox = document.querySelector(`input[data-aluno-almoco="${dia.key}"]`);
                        if (checkbox) checkbox.checked = this.checked;
                    } else {
                        alunoSemana[dia.key].jantar = this.checked;
                        const checkbox = document.querySelector(`input[data-aluno-jantar="${dia.key}"]`);
                        if (checkbox) checkbox.checked = this.checked;
                    }
                    atualizarResumoAluno(dia.key);
                });
            });
        });
    }
}

// Modificar a função salvarAluno para incluir os horários semanais
async function salvarAluno() {
    const segId = document.getElementById('alunoSelSegmento')?.value;
    const serieId = document.getElementById('alunoSelSerie')?.value;
    const turmaId = document.getElementById('alunoSelTurma')?.value;
    const nome = document.getElementById('alunoNome')?.value.trim();
    const responsavel = document.getElementById('alunoResp')?.value.trim();
    const horaEntrada = document.getElementById('alunoHoraEntrada')?.value || null;
    const horaSaida = document.getElementById('alunoHoraSaida')?.value || null;
    const temAlmoco = document.getElementById('alunoTemAlmoco')?.checked || false;
    const temJantar = document.getElementById('alunoTemJantar')?.checked || false;
    const cursoExtra = document.getElementById('alunoCursoExtra')?.value || null;

    // Validação
    if (!segId || !serieId || !turmaId || !nome) {
        safeAlert('Preencha todos os campos obrigatórios (Segmento, Série, Turma e Nome).');
        return;
    }

    try {
        const payload = {
            segmento_id: segId,
            serie_id: serieId,
            turma_id: turmaId,
            nome,
            responsavel: responsavel || null,
            hora_entrada: horaEntrada,
            hora_saida: horaSaida,
            almoco: temAlmoco ? 1 : 0,
            jantar: temJantar ? 1 : 0,
            curso_extra_id: cursoExtra || null,
            // Adicionar horários semanais
            horarios_semanais: alunoSemana
        };

        await API.send('/academico/alunos_create.php', 'POST', payload);
        safeAlert('Aluno cadastrado com sucesso!');

        // Fecha o modal
        hideModal(document.getElementById('alunoModal'));

        // Limpar a semana para o próximo cadastro
        DIAS.forEach(d => (alunoSemana[d.key] = { in: '', out: '', almoco: false, jantar: false }));

        // Atualiza a estrutura acadêmica
        await atualizarAcademico();

        // Recarrega a lista de alunos se estiver na view de alunos
        if (document.getElementById('view-alunos').classList.contains('is-visible')) {
            await loadAcademicoTree();
        }

    } catch (err) {
        safeAlert(err.message || 'Erro ao cadastrar aluno.');
    }
}

// Inicializar quando o modal for aberto
function configurarModalAluno() {
    const modal = document.getElementById('alunoModal');
    const closeBtn = document.getElementById('alunoModalClose');
    const cancelBtn = document.getElementById('alunoModalCancel');
    const saveBtn = document.getElementById('alunoSalvar');

    // Fechar modal
    [closeBtn, cancelBtn].forEach(btn => {
        btn && btn.addEventListener('click', () => {
            hideModal(modal);
            // Resetar semana ao fechar
            DIAS.forEach(d => (alunoSemana[d.key] = { in: '', out: '', almoco: false, jantar: false }));
        });
    });

    // Fechar ao clicar no backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal(modal);
            // Resetar semana ao fechar
            DIAS.forEach(d => (alunoSemana[d.key] = { in: '', out: '', almoco: false, jantar: false }));
        }
    });

    // Quando o modal é aberto, inicializar a grade semanal
    modal.addEventListener('click', (e) => {
        if (e.target === modal || modal.hidden === false) {
            setTimeout(() => {
                montarSemanaAluno();
                configurarReplicacaoAluno();
                configurarHorariosPadrao();
            }, 100);
        }
    });

    // Salvar aluno
    saveBtn && saveBtn.addEventListener('click', salvarAluno);
}

// Adicionar ao carregamento da página
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar a grade semanal do aluno
    montarSemanaAluno();
    configurarReplicacaoAluno();
    configurarHorariosPadrao();
});

// No arquivo JavaScript principal (dashboard.js ou similar)
document.addEventListener('DOMContentLoaded', function() {
    // Inicialmente esconde a tabela
    const tabelaAlunos = document.getElementById('tabelaAlunos');
    const cardTabela = tabelaAlunos?.closest('.card');
    if (cardTabela) {
        cardTabela.style.display = 'none';
    }

    // Função para mostrar a tabela quando os filtros forem aplicados
    function mostrarTabelaAlunos() {
        if (cardTabela) {
            cardTabela.style.display = 'block';
            
            // Atualiza o título com informações da turma selecionada
            const tituloTurma = document.getElementById('tituloTurma');
            const serieSelecionada = document.getElementById('filtroSerie').value;
            const turmaSelecionada = document.getElementById('filtroTurma').value;
            
            if (serieSelecionada && turmaSelecionada) {
                tituloTurma.textContent = `Turma: ${serieSelecionada} - ${turmaSelecionada}`;
            } else {
                tituloTurma.textContent = 'Todos os Alunos';
            }
        }
    }

    // Event listeners para os filtros
    document.getElementById('filtroSerie')?.addEventListener('change', mostrarTabelaAlunos);
    document.getElementById('filtroTurma')?.addEventListener('change', mostrarTabelaAlunos);
    document.getElementById('buscaAlunosFiltro')?.addEventListener('input', mostrarTabelaAlunos);

    // Botão limpar filtros
    document.getElementById('btnLimparFiltros')?.addEventListener('click', function() {
        if (cardTabela) {
            cardTabela.style.display = 'none';
        }
    });

    // Configurar botões de edição para abrir o modal de cadastro
    function configurarBotoesEdicao() {
        document.querySelectorAll('#tabelaAlunos .icon-btn[title="Editar"]').forEach(btn => {
            btn.onclick = function() {
                // Abre o modal de cadastro (o mesmo do botão flutuante)
                const alunoModal = document.getElementById('alunoModal');
                if (alunoModal) {
                    alunoModal.hidden = false;
                    
                    // Aqui você pode preencher os dados do aluno no modal
                    // baseado na linha da tabela clicada
                    const linha = this.closest('.table__row');
                    const nomeAluno = linha.querySelector('span:nth-child(1)').textContent;
                    const responsavel = linha.querySelector('span:nth-child(2)').textContent;
                    
                    // Preenche os campos do modal
                    document.getElementById('alunoNome').value = nomeAluno;
                    document.getElementById('alunoResp').value = responsavel;
                    
                    // Muda o título do modal para "Editar Aluno"
                    document.getElementById('alunoModalTitle').innerHTML = 
                        '<i class="ri-user-add-line"></i> Editar Aluno';
                }
            };
        });
    }

    // Configura os botões quando a tabela é mostrada
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                configurarBotoesEdicao();
            }
        });
    });

    if (tabelaAlunos) {
        observer.observe(tabelaAlunos, { childList: true, subtree: true });
    }

    // Configuração inicial dos botões
    configurarBotoesEdicao();
});

function configurarBotoesTransferencia() {
    // Use delegação de eventos em vez de atribuir onclick individualmente
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('#tabelaAlunos .icon-btn[title="Transferir"]');
        if (!btn) return;
        
        const transferModal = document.getElementById('transferModal');
        if (transferModal) {
            transferModal.hidden = false;
            
            const linha = btn.closest('.table__row');
            const nomeAluno = linha.querySelector('span:nth-child(1)').textContent;
            
            document.getElementById('transferTitle').innerHTML = 
                `<i class="ri-exchange-line"></i> Transferir ${nomeAluno}`;
        }
    });
}

// E chame a função uma vez
configurarBotoesTransferencia();

/* ================================
   ALUNOS: Modal "Cadastrar Aluno"
================================ */
(function alunoModal() {
  const wrap       = document.getElementById('alunoModal');
  const openBtn1   = document.getElementById('btnAddAluno');
  const openBtn2   = document.getElementById('fabAlunos');
  const closeBtn   = document.getElementById('alunoModalClose');
  const cancelBtn  = document.getElementById('alunoModalCancel');
  const form       = document.getElementById('alunoForm');

  if (!wrap) return;

  function open() {
    wrap.hidden = false;
    requestAnimationFrame(() => wrap.classList.add('is-visible'));

    // se precisar preparar a grade semanal do aluno na abertura:
    if (typeof window.montarAlunoSemana === 'function') {
      window.montarAlunoSemana();
    } else {
      // fallback simples: se existir o grid, só garante que está vazio uma vez
      const grid = document.getElementById('alunoWeekGrid');
      if (grid && !grid.dataset.ready) {
        grid.dataset.ready = '1';
        grid.innerHTML = ''; // aqui você pode montar algo básico se quiser
      }
    }
  }

  function close() {
    wrap.classList.remove('is-visible');
    setTimeout(() => {
      wrap.hidden = true;
      try { form?.reset?.(); } catch {}
    }, 180);
  }

  // Abertura (ambos os botões)
  openBtn1 && bindOnce(openBtn1, 'click', open);
  openBtn2 && bindOnce(openBtn2, 'click', open);

  // Fechamento
  closeBtn  && bindOnce(closeBtn,  'click', close);
  cancelBtn && bindOnce(cancelBtn, 'click', close);
  bindOnce(wrap, 'click', (e) => { if (e.target === wrap) close(); });
})();

/* ========= MODAL: Cadastrar Aluno ========= */
(function alunoModalWiring(){
  const openBtns = [
    document.getElementById('btnAddAluno'), // botão na toolbar da tabela
    document.getElementById('fabAlunos')    // FAB flutuante
  ].filter(Boolean);

  const wrap      = document.getElementById('alunoModal');      // <div class="modal-backdrop" id="alunoModal">
  const closeBtn  = document.getElementById('alunoModalClose'); // X no cabeçalho
  const cancelBtn = document.getElementById('alunoModalCancel'); // botão Cancelar
  const saveBtn   = document.getElementById('alunoSalvar');     // botão Salvar (mantém o seu handler)

  if (!wrap) return;

  function open() {
    wrap.hidden = false;
    requestAnimationFrame(() => wrap.classList.add('is-visible'));
    // foco inicial opcional:
    const first = document.getElementById('alunoNome');
    first && first.focus({ preventScroll: true });
  }
  function close() {
    wrap.classList.remove('is-visible');
    setTimeout(() => { wrap.hidden = true; }, 180);
  }

  openBtns.forEach(btn => bindOnce(btn, 'click', open));
  closeBtn  && bindOnce(closeBtn,  'click', close);
  cancelBtn && bindOnce(cancelBtn, 'click', close);
  bindOnce(wrap, 'click', (e) => { if (e.target === wrap) close(); });

  // Evita abrir modal quando a view "alunos" não está visível
  openBtns.forEach(btn => bindOnce(btn, 'click', () => {
    const view = document.getElementById('view-alunos');
    if (view && !view.classList.contains('is-visible')) {
      // garante que a view de alunos esteja ativa
      typeof setView === 'function' && setView('alunos');
      // abre no frame seguinte para evitar "piscar"
      setTimeout(open, 0);
    }
  }, { capture:false }));
})();

/* ========= MODAL: Cadastrar Curso ========= */
(function cursoModalWiring(){
  const openBtn   = document.getElementById('btnAddCurso'); // seu botão já existe
  if (!openBtn) return;

  // Tente localizar um modal já existente
  let wrap = document.getElementById('cursoModal');
  // Se não existir, cria um modal básico compatível com seu CSS (fallback rápido)
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'cursoModal';
    wrap.className = 'modal-backdrop';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cursoModalTitle">
        <div class="modal__header">
          <h3 id="cursoModalTitle"><i class="ri-booklet-line"></i> Cadastrar Curso</h3>
          <button class="modal__close" id="cursoModalClose" aria-label="Fechar"><i class="ri-close-line"></i></button>
        </div>
        <div class="modal__body">
          <form id="cursoForm" class="grid grid--form">
            <div class="field">
              <label class="label" for="cursoNome">Nome do Curso</label>
              <input id="cursoNome" class="input" type="text" placeholder="Ex.: Robótica" required>
            </div>
            <div class="field">
              <label class="label" for="cursoProf">Professor</label>
              <input id="cursoProf" class="input" type="text" placeholder="Ex.: Victor">
            </div>
            <div class="field">
              <label class="label" for="cursoHorario">Horário</label>
              <input id="cursoHorario" class="input" type="text" placeholder="Ex.: seg/sex 14:00">
            </div>
            <div class="field">
              <label class="label" for="cursoPreco">Preço (R$)</label>
              <input id="cursoPreco" class="input" type="number" step="0.01" placeholder="Ex.: 100.00">
            </div>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn" id="cursoModalCancel">Cancelar</button>
          <button class="btn btn--primary" id="cursoSalvar"><i class="ri-check-line"></i> Salvar</button>
        </div>
      </div>
    `;
    // insere o modal próximo da seção de cursos para manter z-index e contexto visual
    const cursosView = document.getElementById('view-cursos') || document.body;
    cursosView.appendChild(wrap);
  }

  const closeBtn  = wrap.querySelector('#cursoModalClose');
  const cancelBtn = wrap.querySelector('#cursoModalCancel');
  const saveBtn   = wrap.querySelector('#cursoSalvar');

  function open() {
    // se a view de cursos não estiver visível, ativa
    const cursosView = document.getElementById('view-cursos');
    if (cursosView && !cursosView.classList.contains('is-visible') && typeof setView === 'function') {
      setView('cursos');
      // abre no próximo frame para não "piscar"
      requestAnimationFrame(open);
      return;
    }
    wrap.hidden = false;
    requestAnimationFrame(() => wrap.classList.add('is-visible'));
    wrap.querySelector('#cursoNome')?.focus({ preventScroll: true });
  }
  function close() {
    wrap.classList.remove('is-visible');
    setTimeout(() => { wrap.hidden = true; }, 180);
  }

  bindOnce(openBtn, 'click', open);
  closeBtn  && bindOnce(closeBtn,  'click', close);
  cancelBtn && bindOnce(cancelBtn, 'click', close);
  bindOnce(wrap, 'click', (e) => { if (e.target === wrap) close(); });

  // Handler de salvar (chame seu endpoint real)
  saveBtn && bindOnce(saveBtn, 'click', async () => {
    try {
      const nome    = (wrap.querySelector('#cursoNome')?.value || '').trim();
      const prof    = (wrap.querySelector('#cursoProf')?.value || '').trim();
      const horario = (wrap.querySelector('#cursoHorario')?.value || '').trim();
      const preco   = parseFloat(wrap.querySelector('#cursoPreco')?.value || '0') || 0;

      if (!nome) { safeAlert('Informe o nome do curso.'); return; }

      await API.send('/cursos/create.php', 'POST', { nome, professor: prof, horario, preco });
      safeAlert('Curso cadastrado com sucesso!');
      close();

    } catch (e) {
      console.error(e);
      safeAlert('Falha ao salvar o curso.');
    }
  });
})();

(function setupSegmentoSingleSelect(){
  const chipsWrap = document.querySelector('#view-alunos .chips'); // o container dos chips de Segmento
  if (!chipsWrap) return;

  // Garante que todos inputs tenham o mesmo name (importante para semântica)
  chipsWrap.querySelectorAll('input[name="segmento"]').forEach(i => { i.name = 'segmento'; });

  // Clique no label/checkbox: desmarca os demais e marca só o clicado
  chipsWrap.addEventListener('click', (e) => {
    const label = e.target.closest('label.chip');
    if (!label || !chipsWrap.contains(label)) return;

    const input = label.querySelector('input[type="checkbox"], input[type="radio"]');
    if (!input) return;

    // Impede multi-seleção: desmarca todos antes
    const allInputs = [...chipsWrap.querySelectorAll('input[name="segmento"]')];
    allInputs.forEach(i => {
      i.checked = false;
      i.dispatchEvent(new Event('change', { bubbles: true })); // se você escuta 'change' em algum lugar
    });

    // Marca apenas o clicado
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));


  });

  // Estado inicial: se nada estiver marcado, marca "Todos"
  const anyChecked = chipsWrap.querySelector('input[name="segmento"]:checked');
  if (!anyChecked) {
    const todos = chipsWrap.querySelector('input[name="segmento"][value="todos"]');
    if (todos) {
      todos.checked = true;
      todos.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
})();

(function(){
  const wrap = document.getElementById('chips-segmento');
  if(!wrap) return;

  function syncActive(){
    // limpa
    wrap.querySelectorAll('.chip').forEach(l => l.classList.remove('is-active'));
    // marca o atual
    const checked = wrap.querySelector('.chip-control:checked');
    if(!checked) return;
    const activeLabel = wrap.querySelector(`label.chip[for="${checked.id}"]`);
    if(activeLabel) activeLabel.classList.add('is-active');
  }

  wrap.addEventListener('change', syncActive);
  syncActive(); // estado inicial
})();
