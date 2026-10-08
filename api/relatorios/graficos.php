<?php
// /api/relatorios/graficos.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_method('GET');
require_auth();

$pdo = pdo();

/* =========================================================
   1️⃣ Matrículas por Série
   ========================================================= */
$sqlSeries = "
  SELECT 
    s.nome AS serie,
    COUNT(a.id) AS alunos
  FROM series s
  LEFT JOIN turmas t ON t.series_id = s.id
  LEFT JOIN alunos a ON a.turma_id = t.id AND a.status = 'ativo'
  GROUP BY s.id, s.nome
  ORDER BY s.ordem ASC
";
$series = $pdo->query($sqlSeries)->fetchAll(PDO::FETCH_ASSOC);

$chartSeries = [
  'labels' => array_column($series, 'serie'),
  'data'   => array_column($series, 'alunos')
];

/* =========================================================
   2️⃣ Receita por Setor
   ========================================================= */
function getValor($pdo, $key) {
  return (float) ($pdo->query("SELECT valor FROM precos WHERE chave = '$key'")->fetchColumn() ?: 0);
}

// Séries
$sqlSeriesReceita = "
  SELECT 
    s.id, s.codigo,
    COUNT(a.id) AS total_alunos,
    COALESCE(MAX(p.valor), 0) AS preco_mensal
  FROM series s
  LEFT JOIN turmas t ON t.series_id = s.id
  LEFT JOIN alunos a ON a.turma_id = t.id AND a.status = 'ativo'
  LEFT JOIN precos p ON p.chave = CONCAT('mensal.', s.codigo)
  GROUP BY s.id, s.codigo
";
$totalSeries = 0;
foreach ($pdo->query($sqlSeriesReceita) as $row)
  $totalSeries += (float)$row['preco_mensal'] * (int)$row['total_alunos'];

// Cursos
$sqlCursos = "
  SELECT 
    c.id, COALESCE(c.preco_mensal,0) AS preco,
    COUNT(DISTINCT mc.aluno_id) AS alunos
  FROM cursos c
  LEFT JOIN curso_turmas ct ON ct.curso_id = c.id
  LEFT JOIN matriculas_curso mc ON mc.curso_turma_id = ct.id AND mc.status = 'ativa'
  WHERE c.ativo = 1
  GROUP BY c.id
";
$totalCursos = 0;
foreach ($pdo->query($sqlCursos) as $row)
  $totalCursos += (float)$row['preco'] * (int)$row['alunos'];

// Refeições
$sqlRefeicoes = "
  SELECT 
    SUM(CASE WHEN almoco = 1 THEN 1 ELSE 0 END) AS total_almoco,
    SUM(CASE WHEN jantar = 1 THEN 1 ELSE 0 END) AS total_jantar
  FROM aluno_rotina
";
$ref = $pdo->query($sqlRefeicoes)->fetch(PDO::FETCH_ASSOC);
$totalAlmocos  = (int)($ref['total_almoco'] ?? 0);
$totalJantares = (int)($ref['total_jantar'] ?? 0);
$valorAlmoco   = getValor($pdo, 'refeicao.almoco');
$valorJantar   = getValor($pdo, 'refeicao.jantar');
$totalRefeicoesValor = ($totalAlmocos * $valorAlmoco) + ($totalJantares * $valorJantar);

// Horas extras
$sqlHoras = "
  SELECT SUM(GREATEST(TIMESTAMPDIFF(HOUR, entrada, saida) - 6, 0))
  FROM aluno_rotina
  WHERE entrada IS NOT NULL AND saida IS NOT NULL
";
$totalHoras = (float)$pdo->query($sqlHoras)->fetchColumn();
$valorHora = getValor($pdo, 'hora.extra');
$totalHorasValor = $totalHoras * $valorHora;

$chartReceita = [
  'labels' => ['Séries', 'Cursos', 'Refeições', 'Horas Extras'],
  'data'   => [$totalSeries, $totalCursos, $totalRefeicoesValor, $totalHorasValor]
];

/* =========================================================
   3️⃣ Refeições de Hoje (Almoço e Jantar)
   ========================================================= */
$hoje = date('N'); // 1 = Segunda, 7 = Domingo

$sqlRefeicoesHoje = "
  SELECT 
    SUM(CASE WHEN almoco = 1 THEN 1 ELSE 0 END) AS almocos,
    SUM(CASE WHEN jantar = 1 THEN 1 ELSE 0 END) AS jantares
  FROM aluno_rotina
  WHERE dia_semana = $hoje
";
$dadosHoje = $pdo->query($sqlRefeicoesHoje)->fetch(PDO::FETCH_ASSOC);

$almocos  = (int)($dadosHoje['almocos'] ?? 0);
$jantares = (int)($dadosHoje['jantares'] ?? 0);
$totalGeral = $almocos + $jantares;

$chartRefeicoes = [
  'labels' => ['Hoje'],
  'datasets' => [
    [
      'label' => 'Almoço',
      'data'  => [$almocos],
      'backgroundColor' => '#4e79a7cc',
      'borderColor' => '#4e79a7',
      'borderWidth' => 1.4,
      'borderRadius' => 8
    ],
    [
      'label' => 'Jantar',
      'data'  => [$jantares],
      'backgroundColor' => '#f28e2bcc',
      'borderColor' => '#f28e2b',
      'borderWidth' => 1.4,
      'borderRadius' => 8
    ]
  ],
  'total_geral' => $totalGeral
];

/* =========================================================
   Retorna JSON
   ========================================================= */
json_response(true, [
  'graficos' => [
    'matriculas' => $chartSeries,
    'receita'    => $chartReceita,
    'refeicoes'  => $chartRefeicoes
  ]
]);
