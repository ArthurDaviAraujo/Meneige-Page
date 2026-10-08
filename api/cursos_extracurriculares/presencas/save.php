<?php
// /api/cursos_extracurriculares/presencas/save.php
declare(strict_types=1);
require_once __DIR__ . '/../../_core/bootstrap.php';

require_method('POST');
require_auth();

$in = input_json();
$aluno_id = intval($in['aluno_id'] ?? 0);
$curso_id = intval($in['curso_id'] ?? 0);
$presencas = $in['presencas'] ?? [];

if (!$aluno_id || !$curso_id || !is_array($presencas)) {
  json_response(false, null, 'Dados inválidos.', 400);
}

$pdo = pdo();
$pdo->beginTransaction();

try {
  $stmt = $pdo->prepare("
    INSERT INTO presencas_extracurriculares (aluno_id, curso_id, data, status)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  ");
  foreach ($presencas as $data => $status) {
    $stmt->execute([$aluno_id, $curso_id, $data, $status ?: null]);
  }

  $pdo->commit();
  json_response(true, null, 'Presenças salvas com sucesso.');
} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(false, null, 'Erro ao salvar presenças: '.$e->getMessage());
}
