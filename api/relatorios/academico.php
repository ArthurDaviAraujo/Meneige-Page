<?php
// /api/relatorios/academico.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
$auth = function_exists('require_auth') ? require_auth() : null; // ['id','name','email','role']

try {
  $pdo = pdo();
} catch (Throwable $e) {
  json_response(false, null, 'Falha ao conectar no banco', 500);
}

/* =========================================================
   Entrada esperada (JSON), alinhada ao seu front:
   {
     "segment_id": "...",
     "series_id":  "...",
     "turma_id":   "...",
     "aluno_q":    "texto",
     "data_ini":   "YYYY-MM-DD",
     "data_fim":   "YYYY-MM-DD",
     "hora_entrada_min": "HH:MM",
     "hora_saida_max":   "HH:MM",
     "refeicao":   "almoco|jantar|ambos|nenhum|''",
     "escopo":     "resumo|por-segmento|por-serie|por-turma|por-aluno",
     "vis":        "tabela|pizza"
   }
   ========================================================= */
$in = input_any();

$segmentId = isset($in['segment_id']) && $in['segment_id'] !== '' ? (int)$in['segment_id'] : null;
$seriesId  = isset($in['series_id'])  && $in['series_id']  !== '' ? (int)$in['series_id']  : null;
$turmaId   = isset($in['turma_id'])   && $in['turma_id']   !== '' ? (int)$in['turma_id']   : null;
$alunoQ    = isset($in['aluno_q'])    && trim((string)$in['aluno_q']) !== '' ? trim((string)$in['aluno_q']) : null;

$dataIni   = isset($in['data_ini']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$in['data_ini']) ? (string)$in['data_ini'] : null;
$dataFim   = isset($in['data_fim']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$in['data_fim']) ? (string)$in['data_fim'] : null;

$hEntMin   = isset($in['hora_entrada_min']) && preg_match('/^\d{2}:\d{2}$/', (string)$in['hora_entrada_min']) ? (string)$in['hora_entrada_min'] : null;
$hSaiMax   = isset($in['hora_saida_max'])   && preg_match('/^\d{2}:\d{2}$/', (string)$in['hora_saida_max'])   ? (string)$in['hora_saida_max']   : null;

$refeicao  = isset($in['refeicao']) ? (string)$in['refeicao'] : '';
$escopo    = isset($in['escopo'])   ? (string)$in['escopo']   : 'por-aluno';
$vis       = isset($in['vis'])      ? (string)$in['vis']      : 'tabela';

/* =========================================================
   Período padrão: mês atual (se não vier no payload)
   Limite de segurança: no máx. 92 dias de intervalo
   ========================================================= */
$tz = new DateTimeZone(date_default_timezone_get() ?: 'America/Sao_Paulo');

if (!$dataIni || !$dataFim) {
  $today = new DateTime('now', $tz);
  $first = (clone $today)->modify('first day of this month')->format('Y-m-d');
  $last  = (clone $today)->modify('last day of this month')->format('Y-m-d');
  $dataIni = $dataIni ?: $first;
  $dataFim = $dataFim ?: $last;
}

$dtIni = DateTime::createFromFormat('Y-m-d', $dataIni, $tz);
$dtFim = DateTime::createFromFormat('Y-m-d', $dataFim, $tz);
if (!$dtIni || !$dtFim || $dtFim < $dtIni) {
  json_response(false, null, 'Período inválido', 422);
}

$intervalDays = (int)$dtIni->diff($dtFim)->format('%a') + 1;
if ($intervalDays > 92) {
  json_response(false, null, 'Período muito longo (máx. 92 dias).', 422);
}

/* =========================================================
   Busca base:
   - alunos a
   - turmas t
   - series s
   - segments g
   - aluno_rotina r   (1..5 = seg..sex)
   Observação: r.entrada/saida podem ser NULL (sem rotina neste dia).
   ========================================================= */
$sql = "
  SELECT
    a.id          AS aluno_id,
    a.nome        AS aluno_nome,
    a.responsavel AS responsavel,
    t.id          AS turma_id,
    t.nome        AS turma_nome,
    s.id          AS serie_id,
    s.nome        AS serie_nome,
    g.id          AS segment_id,
    g.nome        AS segment_nome,
    r.dia_semana  AS dow,                -- 1..5 (seg..sex)
    r.entrada     AS entrada,            -- TIME
    r.saida       AS saida,              -- TIME
    r.almoco      AS almoco,             -- TINYINT 0/1
    r.jantar      AS jantar              -- TINYINT 0/1
  FROM alunos a
  INNER JOIN turmas   t ON t.id = a.turma_id
  INNER JOIN series   s ON s.id = t.series_id
  INNER JOIN segments g ON g.id = s.segment_id
  LEFT  JOIN aluno_rotina r ON r.aluno_id = a.id
  WHERE a.status = 'ativo'
";

$params = [];
if (!empty($segmentId)) { $sql .= " AND g.id = :seg "; $params[':seg'] = $segmentId; }
if (!empty($seriesId))  { $sql .= " AND s.id = :ser ";  $params[':ser'] = $seriesId; }
if (!empty($turmaId))   { $sql .= " AND t.id = :tur ";  $params[':tur'] = $turmaId; }
if (!empty($alunoQ))    { $sql .= " AND a.nome LIKE :aq "; $params[':aq'] = '%'.$alunoQ.'%'; }

$sql .= " ORDER BY a.nome, r.dia_semana ";

/* =========================================================
   Execução e materialização
   ========================================================= */
try {
  $st = $pdo->prepare($sql);
  foreach ($params as $k=>$v) $st->bindValue($k, $v);
  $st->execute();
  $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao consultar dados', 500);
}

/* =========================================================
   Expansão por datas: usamos r.dia_semana (1..5 seg..sex)
   Cada data útil que casar com a rotina gera 1 linha.
   Filtros de hora e refeição aplicados abaixo.
   ========================================================= */
function fmt_time(?string $t): ?string {
  if ($t === null || $t === '') return null;
  // normaliza para HH:MM
  if (preg_match('/^(\d{2}):(\d{2})/', $t, $m)) {
    return sprintf('%02d:%02d', (int)$m[1], (int)$m[2]);
  }
  return $t;
}

function refeicaoLabel(int $almoco, int $jantar): string {
  if ($almoco && $jantar) return 'Almoço,Jantar';
  if ($almoco) return 'Almoço';
  if ($jantar) return 'Jantar';
  return '';
}

function weekdayIso(DateTime $d): int {
  // ISO-8601: 1 = Monday ... 7 = Sunday
  return (int)$d->format('N');
}

function timeCmp(?string $a, ?string $b, string $op): bool {
  // compara HH:MM de forma segura
  if (!$a || !$b) return true; // sem dado, não reprova por hora
  $a = substr($a, 0, 5);
  $b = substr($b, 0, 5);
  if (!preg_match('/^\d{2}:\d{2}$/', $a) || !preg_match('/^\d{2}:\d{2}$/', $b)) return true;
  return match ($op) {
    '>=' => $a >= $b,
    '<=' => $a <= $b,
    '>'  => $a >  $b,
    '<'  => $a <  $b,
    '==' => $a === $b,
    default => true
  };
}

/** Aplica filtro de refeicao:
 *  ''    -> aceita todas
 *  'almoco' -> requer almoco=1
 *  'jantar' -> requer jantar=1
 *  'ambos'  -> requer almoco=1 AND jantar=1
 *  'nenhum' -> requer almoco=0 AND jantar=0
 */
function refeicaoPassa(string $mode, int $almoco, int $jantar): bool {
  return match ($mode) {
    ''        => true,
    'almoco'  => (bool)$almoco,
    'jantar'  => (bool)$jantar,
    'ambos'   => (bool)$almoco && (bool)$jantar,
    'nenhum'  => !(bool)$almoco && !(bool)$jantar,
    default   => true
  };
}

// índice por aluno e dia_semana, para acesso rápido
$byAlunoDow = [];
foreach ($rows as $r) {
  $aid = (int)$r['aluno_id'];
  $dow = (int)($r['dow'] ?? 0);
  if ($dow < 1 || $dow > 5) continue; // só seg..sex
  $byAlunoDow[$aid][$dow][] = $r;
}

/* =========================================================
   Montagem das linhas finais
   ========================================================= */
$MAX_ROWS = 5000;
$out = [];
$refeicoesCount = 0;

// percorre dias do intervalo
$cursor = clone $dtIni;
while ($cursor <= $dtFim) {
  $isoDow = weekdayIso($cursor); // 1..7
  if ($isoDow >= 1 && $isoDow <= 5) {
    // para cada aluno com rotina nesse weekday
    foreach ($byAlunoDow as $aid => $rotinasByDow) {
      if (empty($rotinasByDow[$isoDow])) continue;
      foreach ($rotinasByDow[$isoDow] as $r) {
        $entrada = fmt_time($r['entrada'] ?? null);
        $saida   = fmt_time($r['saida']   ?? null);
        $almoco  = (int)($r['almoco'] ?? 0);
        $jantar  = (int)($r['jantar'] ?? 0);

        // se a rotina não tiver entrada/saída, não gera linha
        if (!$entrada || !$saida) continue;

        // filtro hora mínima/máxima
        if ($hEntMin && !timeCmp($entrada, $hEntMin, '>=')) continue;
        if ($hSaiMax && !timeCmp($saida,   $hSaiMax, '<=')) continue;

        // filtro refeição
        if (!refeicaoPassa($refeicao, $almoco, $jantar)) continue;

        $refLabel = refeicaoLabel($almoco, $jantar);

        $out[] = [
          'aluno'    => (string)$r['aluno_nome'],
          'serie'    => (string)$r['serie_nome'],
          'turma'    => (string)$r['turma_nome'],
          'data'     => $cursor->format('Y-m-d'),
          'entrada'  => $entrada,
          'saida'    => $saida,
          'refeicao' => $refLabel,
        ];

        if ($almoco) $refeicoesCount++;
        if ($jantar) $refeicoesCount++;

        if (count($out) >= $MAX_ROWS) {
          // corta silenciosamente para proteger o servidor
          break 3;
        }
      }
    }
  }
  $cursor->modify('+1 day');
}

/* =========================================================
   KPIs: total, refeições, média de horários
   ========================================================= */
function avgTime(array $vals): ?string {
  if (!$vals) return null;
  $sum = 0; $n = 0;
  foreach ($vals as $t) {
    if (!$t) continue;
    [$H, $M] = array_map('intval', explode(':', substr($t,0,5)));
    $sum += $H*60 + $M; $n++;
  }
  if ($n === 0) return null;
  $m = intdiv($sum, $n);
  $H = intdiv($m, 60); $M = $m % 60;
  return sprintf('%02d:%02d', $H, $M);
}

$medEntrada = avgTime(array_column($out, 'entrada'));
$medSaida   = avgTime(array_column($out, 'saida'));

// Como não há presenças reais, não inferimos % presença.
// Devolvemos null (o front trata como "--")
$kpis = [
  'total'       => count($out),
  'presenca_pct'=> null,
  'refeicoes'   => $refeicoesCount,
  'med_entrada' => $medEntrada,
  'med_saida'   => $medSaida,
];

/* =========================================================
   Escopos agregados (opcional)
   - O front hoje usa tabela plana; mas, se desejar,
     aqui já entregamos agrupamentos quando escopo != 'por-aluno'.
   ========================================================= */
if ($escopo !== 'por-aluno') {
  // agrupamento simples conforme escopo
  $grpKey = match ($escopo) {
    'por-segmento' => 'serie',       // (ou 'segmento' se quiser trocar a coluna exibida)
    'por-turma'    => 'turma',
    'resumo'       => null,
    default        => 'serie'
  };

  if ($grpKey) {
    $agg = [];
    foreach ($out as $r) {
      $k = $r[$grpKey] ?? '(n/d)';
      if (!isset($agg[$k])) $agg[$k] = ['grupo'=>$k, 'linhas'=>0, 'refeicoes'=>0];
      $agg[$k]['linhas']++;
      if (strpos($r['refeicao'], 'Almoço') !== false) $agg[$k]['refeicoes']++;
      if (strpos($r['refeicao'], 'Jantar') !== false) $agg[$k]['refeicoes']++;
    }
    $out = array_values($agg);
  } elseif ($escopo === 'resumo') {
    $out = [[
      'periodo'    => $dtIni->format('Y-m-d') . ' a ' . $dtFim->format('Y-m-d'),
      'linhas'     => $kpis['total'],
      'refeicoes'  => $kpis['refeicoes'],
      'medEntrada' => $kpis['med_entrada'] ?? '--',
      'medSaida'   => $kpis['med_saida']   ?? '--',
    ]];
  }
}

/* =========================================================
   Saída
   ========================================================= */
json_response(true, ['items' => $out, 'kpis' => $kpis]);
