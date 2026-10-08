<?php
declare(strict_types=1);
require_once __DIR__ . '/../../_core/bootstrap.php';
require_once __DIR__ . '/../../_core/log_helper.php';

require_method('DELETE');
require_auth();

$pdo = pdo();
$id  = (int)($_GET['id'] ?? 0);

if ($id <= 0) {
  json_response(false, null, 'ID inválido.', 400);
}

try {
  // Busca dados para log
  $stmt = $pdo->prepare("
    SELECT m.id, a.nome AS aluno_nome, c.nome AS curso_nome
    FROM matriculas_curso m
    JOIN alunos a ON a.id = m.aluno_id
    JOIN curso_turmas ct ON ct.id = m.curso_turma_id
    JOIN cursos c ON c.id = ct.curso_id
    WHERE m.id = ?
  ");
  $stmt->execute([$id]);
  $matricula = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$matricula) {
    json_response(false, null, 'Matrícula não encontrada.', 404);
  }

  // Cancela a matrícula (soft delete)
  $pdo->prepare("UPDATE matriculas_curso SET status = 'cancelada' WHERE id = ?")->execute([$id]);

  // Log
  $descricao = sprintf(
    'Cancelou a matrícula do aluno "%s" no curso "%s"',
    $matricula['aluno_nome'],
    $matricula['curso_nome']
  );
  registrar_log($pdo, 'delete', 'matriculas_curso', $id, $descricao);

  json_response(true, ['id' => $id], 'Matrícula cancelada com sucesso.');

} catch (Throwable $e) {
  json_response(false, null, 'Erro ao cancelar matrícula: ' . $e->getMessage(), 500);
}
