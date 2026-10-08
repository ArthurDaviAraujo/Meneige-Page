<?php
// /api/cursos_extracurriculares/presencas/get.php
declare(strict_types=1);
require_once __DIR__ . '/../../_core/bootstrap.php';

require_method('GET');
require_auth();

$aluno_id = intval($_GET['aluno_id'] ?? 0);
$curso_id = intval($_GET['curso_id'] ?? 0);
$ano  = intval($_GET['ano'] ?? date('Y'));
$mes  = intval($_GET['mes'] ?? date('n'));

if (!$aluno_id || !$curso_id) {
  json_response(false, null, 'Aluno ou curso inválido', 400);
}

$pdo = pdo();

$stmt = $pdo->prepare("
  SELECT data, status
  FROM presencas_extracurriculares
  WHERE aluno_id = ? AND curso_id = ? 
    AND YEAR(data) = ? AND MONTH(data) = ?
");
$stmt->execute([$aluno_id, $curso_id, $ano, $mes]);

$presencas = [];
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
  $presencas[$row['data']] = $row['status'];
}

json_response(true, ['items' => $presencas]);
