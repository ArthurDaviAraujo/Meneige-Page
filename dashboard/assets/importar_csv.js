(() => {
  const drop = document.getElementById('impDrop');
  const input = document.getElementById('impInput');
  const fileInfo = document.getElementById('impFileInfo');
  const fileName = document.getElementById('impFileName');
  const fileSize = document.getElementById('impFileSize');
  const btnValidar = document.getElementById('impValidar');
  const btnImportar = document.getElementById('impImportar');
  const chkDry = document.getElementById('impDryRun');
  const preview = document.getElementById('impPreview').querySelector('tbody');
  const sumLinhas = document.getElementById('sumLinhas');
  const sumSeries = document.getElementById('sumSeries');   // séries criadas
  const sumTurmas = document.getElementById('sumTurmas');   // turmas criadas
  const sumAlunos = document.getElementById('sumAlunos');   // alunos (criados+atualizados)
  const sumErros = document.getElementById('sumErros');
  const sumErrosWrap = document.getElementById('sumErrosWrap');
  const errList = document.getElementById('impErros');
  const status = document.getElementById('impStatus');
  const bar = document.getElementById('impBar');

  // === Modelo oficial (9 colunas, ordem pode variar; nomes exatos) ===
const REQUIRED = [
  'segmento','serie','turma',
  'aluno_nome','responsavel_nome',
  'hora_entrada','hora_saida','almoco','jantar'
];
  const REQUIRED_COUNT = REQUIRED.length;

  let currentFile = null;
  let detectedDelimiter = ',';

  // Utils
  const norm = s => (s ?? '').toString().trim().toLowerCase();
  const stripBOM = s => s.replace(/^\uFEFF/, '');
  function setBusy(msg, pct = 20) { status.textContent = msg; bar.style.width = pct + '%'; }
  function disableActions(){ btnValidar.disabled = true; btnImportar.disabled = true; }
  function enableValidate(){ btnValidar.disabled = false; }
  function clearErrors(){ sumErrosWrap.hidden = true; errList.hidden = true; errList.innerHTML = ''; }
  function showErrors(errors){
    if (errors && errors.length){
      sumErros.textContent = errors.length;
      sumErrosWrap.hidden = false;
      errList.hidden = false;
      errList.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
    } else { clearErrors(); }
  }

  // Detecta delimitador e valida cabeçalho
  function detectDelimiterAndValidateHeader(csvText) {
  const lines = csvText.split(/\r?\n/);
  let firstLine = (lines[0] || '').replace(/^\uFEFF/, ''); // strip BOM

  // Detecta vírgula, ponto-e-vírgula ou TAB – escolhe o que mais aparece
  const candidates = [',',';','\t'];
  let best = ',', bestCount = -1;
  for (const d of candidates) {
    const c = (firstLine.match(new RegExp(escapeRegExp(d), 'g')) || []).length;
    if (c > bestCount) { best = d; bestCount = c; }
  }
  // fallback se não achar nenhum separador
  detectedDelimiter = bestCount > 0 ? best : ',';

  const header = firstLine
    .split(detectedDelimiter)
    .map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase());

  if (header.length !== REQUIRED.length) {
    throw new Error(`Cabeçalho inválido. Use exatamente as ${REQUIRED.length} colunas do modelo oficial.`);
  }
  const diffA = header.filter(h => !REQUIRED.includes(h));
  const diffB = REQUIRED.filter(h => !header.includes(h));
  if (diffA.length || diffB.length) {
    throw new Error('Cabeçalho inválido. Baixe o modelo oficial e não altere os nomes das colunas.');
  }
}

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }


  // Pré-visualização (até 30 linhas)
  function previewCSV(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const textRaw = e.target.result || '';
        const text = stripBOM(textRaw);
        detectDelimiterAndValidateHeader(text);

        const lines = text.split(/\r?\n/).slice(0, 30);
        preview.innerHTML = '';
        lines.forEach(line => {
          if (!line.trim()) return;
          const row = document.createElement('tr');
          line.split(detectedDelimiter).forEach(c => {
            const td = document.createElement('td');
            td.textContent = stripBOM(c).trim();
            row.appendChild(td);
          });
          preview.appendChild(row);
        });

        status.textContent = 'Arquivo válido. Clique em Validar para simular.';
        enableValidate();
        clearErrors();
      } catch (err) {
        preview.innerHTML = '<tr><td class="muted-imp">— erro na leitura do CSV</td></tr>';
        status.textContent = err.message;
        disableActions();
        showErrors([err.message]);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  // Drag & drop
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('is-over');
    if (e.dataTransfer.files.length) {
      currentFile = e.dataTransfer.files[0];
      showFileInfo(currentFile);
      previewCSV(currentFile);
    }
  });

  // Seleção manual
  input.addEventListener('change', e => {
    if (e.target.files.length) {
      currentFile = e.target.files[0];
      showFileInfo(currentFile);
      previewCSV(currentFile);
    }
  });

  function showFileInfo(file) {
    fileInfo.hidden = false;
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  }

  // Enviar (snapshot + credentials)
  btnValidar.addEventListener('click', () => sendCSV(true));
  btnImportar.addEventListener('click', () => sendCSV(false));

  async function sendCSV(isDryRun) {
    if (!currentFile) { alert('Selecione um arquivo primeiro.'); return; }
    setBusy('Enviando...', 20);

    try {
      const blob = currentFile.slice(0, currentFile.size, currentFile.type);
      const fileSnap = new File([blob], currentFile.name, { type: currentFile.type });

      const fd = new FormData();
      fd.append('arquivo', fileSnap, fileSnap.name);
      fd.append('dry_run', isDryRun ? '1' : '0');

      const res = await fetch('importar_csv.php', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin'
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt?.slice(0, 300) || 'falha no servidor'}`);
      }

      const data = await res.json().catch(async () => {
        const txt = await res.text();
        throw new Error(`Resposta inválida do servidor: ${txt?.slice(0, 300)}`);
      });

      bar.style.width = '100%';

      if (data.erro) {
        status.textContent = `Erro: ${data.erro}`;
        showErrors([data.erro]);
        return;
      }

      // Resumos principais (campos novos do backend)
      sumLinhas.textContent = data.linhas ?? 0;
      sumSeries.textContent = data.series_criadas ?? 0;
      sumTurmas.textContent = data.turmas_criadas ?? 0;
      sumAlunos.textContent = data.alunos ?? 0;

      showErrors(data.erros || []);

      if (isDryRun) {
        status.textContent = 'Validação concluída. Se estiver tudo certo, clique em Importar.';
        btnImportar.disabled = false;
      } else {
        const criados = data.alunos_criados ?? 0;
        const atualiz  = data.alunos_atualizados ?? 0;
        status.textContent = `Importação concluída! Criados: ${criados}, Atualizados: ${atualiz}.`;
      }
    } catch (err) {
      status.textContent = 'Falha no envio.';
      showErrors([String(err.message || err)]);
      console.error(err);
    }
  }

  // Reset
  document.getElementById('impReset').addEventListener('click', () => {
    currentFile = null;
    detectedDelimiter = ',';
    fileInfo.hidden = true;
    preview.innerHTML = '<tr><td class="muted-imp">— carregue um CSV para visualizar</td></tr>';
    status.textContent = 'Selecione um arquivo para começar.';
    sumLinhas.textContent = '--';
    sumSeries.textContent = '--';
    sumTurmas.textContent = '--';
    sumAlunos.textContent = '--';
    clearErrors();
    btnImportar.disabled = true;
    btnValidar.disabled = true;
    bar.style.width = '0%';
    if (chkDry) chkDry.checked = true;
  });

  // estado inicial
  disableActions();
})();
