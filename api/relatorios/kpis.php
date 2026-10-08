<?php
// /api/relatorios/kpis.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_method('GET');
require_auth();

$pdo = pdo();

/* =========================================================
   1️⃣ Total de alunos ativos
   ========================================================= */
$totalAlunos = (int) $pdo->query("
  SELECT COUNT(*) 
  FROM alunos 
  WHERE status = 'ativo'
")->fetchColumn();

/* =========================================================
   2️⃣ Receita por séries (mensalidades)
   ========================================================= */
$sqlSeries = "
  SELECT 
    s.codigo,
    s.nome,
    COUNT(a.id) AS total_alunos,
    COALESCE(p.valor, 0) AS preco_mensal
  FROM series s
  LEFT JOIN turmas t ON t.series_id = s.id
  LEFT JOIN alunos a ON a.turma_id = t.id AND a.status = 'ativo'
  LEFT JOIN precos p ON p.chave = CONCAT('mensal.', s.codigo)
  GROUP BY s.id, s.codigo, s.nome, p.valor
";
$series = $pdo->query($sqlSeries)->fetchAll(PDO::FETCH_ASSOC);

$totalSeries = 0;
foreach ($series as $s) {
  $preco = (float)$s['preco_mensal'];
  $qtd   = (int)$s['total_alunos'];
  $totalSeries += $preco * $qtd;
}

/* =========================================================
   3️⃣ Cursos extracurriculares (corrigido)
   ========================================================= */
$sqlCursos = "
  SELECT 
    c.id,
    c.nome,
    COALESCE(c.preco_mensal, 0) AS preco_mensal,
    (
      SELECT COUNT(mc.id)
      FROM curso_turmas ct
      LEFT JOIN matriculas_curso mc 
        ON mc.curso_turma_id = ct.id
       AND mc.status = 'ativa'
      WHERE ct.curso_id = c.id
    ) AS total_matriculas
  FROM cursos c
  WHERE c.ativo = 1
";
$cursos = $pdo->query($sqlCursos)->fetchAll(PDO::FETCH_ASSOC);

$totalCursos = 0;
foreach ($cursos as $c) {
  $preco = (float)$c['preco_mensal'];
  $qtd   = (int)$c['total_matriculas'];
  if ($preco > 0 && $qtd > 0) {
    $totalCursos += $preco * $qtd;
  }
}

/* =========================================================
   4️⃣ Refeições de HOJE (somente o dia atual)
   ========================================================= */
$hoje = (int) date('N'); // 1=Segunda, ..., 7=Domingo
if ($hoje > 5) $hoje = 5; // limita até sexta

$sqlRefeicoesHoje = "
  SELECT 
    SUM(CASE WHEN almoco = 1 THEN 1 ELSE 0 END) AS almocos,
    SUM(CASE WHEN jantar = 1 THEN 1 ELSE 0 END) AS jantares
  FROM aluno_rotina
  WHERE dia_semana = $hoje
";
$ref = $pdo->query($sqlRefeicoesHoje)->fetch(PDO::FETCH_ASSOC);

$totalAlmocos = (int)($ref['almocos'] ?? 0);
$totalJantares = (int)($ref['jantares'] ?? 0);
$totalRefeicoesHoje = $totalAlmocos + $totalJantares;

$valorAlmoco = (float) ($pdo->query("SELECT valor FROM precos WHERE chave = 'refeicao.almoco'")->fetchColumn() ?: 0);
$valorJantar = (float) ($pdo->query("SELECT valor FROM precos WHERE chave = 'refeicao.jantar'")->fetchColumn() ?: 0);
$totalRefeicoesValor = ($totalAlmocos * $valorAlmoco) + ($totalJantares * $valorJantar);

/* =========================================================
   5️⃣ Horas extras semanais
   ========================================================= */
$totalHoras = (float) ($pdo->query("
  SELECT SUM(GREATEST(TIMESTAMPDIFF(HOUR, entrada, saida) - 6, 0))
  FROM aluno_rotina
  WHERE entrada IS NOT NULL AND saida IS NOT NULL
")->fetchColumn() ?: 0);

$valorHora = (float) $pdo->query("SELECT valor FROM precos WHERE chave = 'hora.extra'")->fetchColumn() ?: 0;
$totalHorasValor = $totalHoras * $valorHora;

/* =========================================================
   6️⃣ Monta resposta final
   ========================================================= */
$totalGeral = $totalSeries + $totalCursos + $totalRefeicoesValor + $totalHorasValor;

json_response(true, [
  'kpis' => [
    'alunos'    => $totalAlunos,
    'receita'   => $totalGeral,
    'refeicoes' => $totalRefeicoesHoje, // agora conta só as de hoje
    'horas'     => $totalHoras
  ],
  'detalhamento' => [
    'total_series'    => $totalSeries,
    'total_cursos'    => $totalCursos,
    'total_refeicoes' => $totalRefeicoesValor,
    'total_horas'     => $totalHorasValor,
    'total_geral'     => $totalGeral,
    'hoje' => [
      'dia_semana' => $hoje,
      'almocos'    => $totalAlmocos,
      'jantares'   => $totalJantares,
      'ref_total'  => $totalRefeicoesHoje
    ]
  ]
]);
