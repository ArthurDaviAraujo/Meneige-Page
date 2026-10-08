<?php
// /api/cursos/delete.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
require_auth();

$pdo = pdo();

// Lê o corpo JSON enviado
$input = input_json();
$id = isset($input['id']) ? (int)$input['id'] : 0;

if ($id <= 0) {
  json_response(false, ['error' => 'ID do curso inválido.']);
}

// Verifica se o curso existe
$stmt = $pdo->prepare("SELECT id, nome FROM cursos WHERE id = ?");
$stmt->execute([$id]);
$curso = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$curso) {
  json_response(false, ['error' => 'Curso não encontrado.']);
}

try {
  $pdo->beginTransaction();

  // Remove as matrículas associadas a este curso (via curso_turmas)
  $pdo->prepare("
    DELETE mc FROM matriculas_curso mc
    INNER JOIN curso_turmas ct ON mc.curso_turma_id = ct.id
    WHERE ct.curso_id = ?
  ")->execute([$id]);

  // Remove as turmas deste curso
  $pdo->prepare("DELETE FROM curso_turmas WHERE curso_id = ?")->execute([$id]);

  // Remove o curso em si
  $pdo->prepare("DELETE FROM cursos WHERE id = ?")->execute([$id]);

  $pdo->commit();

  json_response(true, ['message' => "Curso '{$curso['nome']}' excluído com sucesso."]);

} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(false, [
    'error' => 'Erro ao excluir curso.',
    'details' => $e->getMessage()
  ]);
}
