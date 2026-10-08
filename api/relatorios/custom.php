<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_method('POST');
require_auth();

$pdo = pdo();
$in = input_json();

$filtros = $in['filtros'] ?? [];
$cols    = $in['colunas'] ?? [];

/* =========================================================
   Mapeamento das colunas disponíveis
   ========================================================= */
$mapCols = [
  'aluno'    => 'a.nome AS aluno',
  'serie'    => 's.nome AS serie',
  'turma'    => 't.nome AS turma',
  'entrada'  => "MIN(TIME_FORMAT(r.entrada, '%H:%i')) AS entrada",
  'saida'    => "MAX(TIME_FORMAT(r.saida, '%H:%i')) AS saida",
  'refeicao' => "CASE
                    WHEN MAX(r.almoco)=1 AND MAX(r.jantar)=1 THEN 'Almoço, Jantar'
                    WHEN MAX(r.almoco)=1 THEN 'Almoço'
                    WHEN MAX(r.jantar)=1 THEN 'Jantar'
                    ELSE ''
                 END AS refeicao"
];

/* =========================================================
   Define colunas do SELECT
   ========================================================= */
$selectCols = [];
foreach ($cols as $c) {
  if (isset($mapCols[$c])) $selectCols[] = $mapCols[$c];
}
if (!$selectCols) $selectCols[] = 'a.nome AS aluno';

/* =========================================================
   SQL base — com todas as relações
   ========================================================= */
$sql = "
  SELECT " . implode(', ', $selectCols) . "
  FROM alunos a
  INNER JOIN turmas t ON t.id = a.turma_id
  INNER JOIN series s ON s.id = t.series_id
  INNER JOIN segments sg ON sg.id = s.segment_id
  LEFT JOIN aluno_rotina r ON r.aluno_id = a.id
  WHERE a.status = 'ativo'
";

$params = [];

/* =========================================================
   Filtros dinâmicos
   ========================================================= */

// 🔹 Segmento
if (!empty($filtros['segmento'])) {
  $sql .= " AND sg.id = :segmento";
  $params[':segmento'] = (int)$filtros['segmento'];
}

// 🔹 Série
if (!empty($filtros['serie'])) {
  $sql .= " AND s.id = :serie";
  $params[':serie'] = (int)$filtros['serie'];
}

// 🔹 Turma
if (!empty($filtros['turma'])) {
  $sql .= " AND t.id = :turma";
  $params[':turma'] = (int)$filtros['turma'];
}

/* =========================================================
   Agrupamento (evita duplicações)
   ========================================================= */
$sql .= " GROUP BY a.id, a.nome, s.nome, t.nome ORDER BY a.nome ASC";

/* =========================================================
   Execução segura
   ========================================================= */
try {
  $st = $pdo->prepare($sql);
  $st->execute($params);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
  json_response(false, [
    'msg' => 'Erro SQL: ' . $e->getMessage(),
    'sql' => $sql,
    'params' => $params
  ]);
  exit;
}

/* =========================================================
   Geração de CSV compatível com Excel
   ========================================================= */
header('Content-Type: text/csv; charset=ISO-8859-1');
header('Content-Disposition: attachment; filename="Relatorio_Personalizado.csv"');

if (!$rows) {
  echo "Nenhum registro encontrado.\n";
  exit;
}

$header = implode(';', array_keys($rows[0])) . "\n";
$csv = $header;
foreach ($rows as $r) {
  $csv .= implode(';', array_map(fn($v) => str_replace(';', ',', (string)$v), $r)) . "\n";
}

echo mb_convert_encoding($csv, 'ISO-8859-1', 'UTF-8');
exit;
