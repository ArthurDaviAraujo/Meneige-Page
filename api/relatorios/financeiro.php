<?php
// /api/relatorios/financeiro.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
$auth = function_exists('require_auth') ? require_auth() : null;

try { $pdo = pdo(); }
catch (Throwable $e) { json_response(false, null, 'Falha ao conectar no banco', 500); }

$in = input_any();
$periodo = isset($in['periodo']) ? (string)$in['periodo'] : ''; // YYYY-MM
$dataIni = isset($in['data_ini']) && preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)$in['data_ini']) ? (string)$in['data_ini'] : null;
$dataFim = isset($in['data_fim']) && preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)$in['data_fim']) ? (string)$in['data_fim'] : null;

if ($periodo && preg_match('/^\d{4}-\d{2}$/', $periodo)) {
  $dataIni = $periodo.'-01';
  $dataFim = date('Y-m-t', strtotime($dataIni));
}
if (!$dataIni || !$dataFim) {
  // padrão: mês atual
  $dataIni = date('Y-m-01');
  $dataFim = date('Y-m-t');
}

/* ====== Mensalidades estimadas por série ======
   alunos ativos -> series.codigo -> precos.chave = 'mensal.'||codigo
*/
$sqlMens = "
  SELECT s.codigo, s.nome AS serie, COUNT(a.id) AS qtd
  FROM alunos a
  INNER JOIN turmas t ON t.id = a.turma_id
  INNER JOIN series s ON s.id = t.series_id
  WHERE a.status = 'ativo'
  GROUP BY s.id, s.codigo, s.nome
  ORDER BY s.ordem, s.nome
";
try {
  $mensRows = $pdo->query($sqlMens)->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao calcular mensalidades', 500);
}

// busca preços (mapa)
try {
  $precos = $pdo->query("SELECT chave, valor FROM precos")->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
} catch (Throwable $e) {
  $precos = [];
}

$items = [];
$totalMensalidades = 0.0;

foreach ($mensRows as $r) {
  $codigo = (string)$r['codigo'];
  $qtd    = (int)$r['qtd'];
  $chave  = 'mensal.'.$codigo;
  $preco  = isset($precos[$chave]) ? (float)$precos[$chave] : 0.0;
  $valor  = $qtd * $preco;
  $totalMensalidades += $valor;

  $items[] = [
    'origem'    => 'Mensalidade',
    'descricao' => 'Série '.$r['serie'].' ('.$qtd.' aluno(s) × R$'.number_format($preco,2,',','.').')',
    'data'      => $dataIni,  // referência do mês
    'valor'     => $valor,
    'status'    => 'Estimado'
  ];
}

/* ====== Cursos extracurriculares (estimado) ======
   matriculas_curso ativas × cursos.preco_mensal
*/
$sqlCursos = "
  SELECT c.nome AS curso, COUNT(m.id) AS qtd, COALESCE(c.preco_mensal,0) AS preco
  FROM matriculas_curso m
  INNER JOIN curso_turmas ct ON ct.id = m.curso_turma_id
  INNER JOIN cursos c        ON c.id = ct.curso_id
  WHERE m.status = 'ativa'
  GROUP BY c.id, c.nome, c.preco_mensal
  ORDER BY c.nome
";
try {
  $curRows = $pdo->query($sqlCursos)->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao calcular cursos', 500);
}

$totalCursos = 0.0;
foreach ($curRows as $r) {
  $qtd   = (int)$r['qtd'];
  $preco = (float)$r['preco'];
  $valor = $qtd * $preco;
  $totalCursos += $valor;

  $items[] = [
    'origem'    => 'Curso',
    'descricao' => $r['curso'].' ('.$qtd.' matrícula(s) × R$'.number_format($preco,2,',','.') .')',
    'data'      => $dataIni,
    'valor'     => $valor,
    'status'    => 'Estimado'
  ];
}

// Totais
$totais = [
  'periodo'       => $periodo ?: (date('Y-m', strtotime($dataIni))),
  'mensalidades'  => round($totalMensalidades, 2),
  'cursos'        => round($totalCursos, 2),
  'geral'         => round($totalMensalidades + $totalCursos, 2),
];

// Ordena itens por origem/nome
usort($items, fn($a,$b)=>strcmp($a['origem'].$a['descricao'], $b['origem'].$b['descricao']));

// Saída
json_response(true, ['items'=>$items, 'totais'=>$totais]);
