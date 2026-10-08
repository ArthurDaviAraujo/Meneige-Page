<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../_core/log_helper.php';

require_method('DELETE');
require_auth();

try {
  $in = input_json();
  $id = (int)($in['id'] ?? 0);

  if (!$id) {
    json_response(false, null, 'ID do aluno ausente.', 400);
  }

  $pdo = pdo();

  // Verifica existência
  $check = $pdo->prepare("
    SELECT a.id, a.nome, a.responsavel, t.nome AS turma_nome, s.nome AS serie_nome
    FROM alunos a
    JOIN turmas t ON a.turma_id = t.id
    JOIN series s ON t.series_id = s.id
    WHERE a.id = ?
  ");
  $check->execute([$id]);
  $aluno = $check->fetch(PDO::FETCH_ASSOC);

  if (!$aluno) {
    json_response(false, null, 'Aluno não encontrado.', 404);
  }

  // Exclui registros de rotina
  $pdo->prepare("DELETE FROM aluno_rotina WHERE aluno_id = ?")->execute([$id]);

  // Exclui o aluno
  $stmt = $pdo->prepare("DELETE FROM alunos WHERE id = ?");
  $stmt->execute([$id]);

  if ($stmt->rowCount() === 0) {
    json_response(false, null, 'Nenhum aluno excluído.', 404);
  }

  // ----- Log compatível com estrutura -----
  $descricao = sprintf(
    'Excluiu o aluno %s (%s - %s)',
    $aluno['nome'],
    $aluno['serie_nome'] ?? 'Série desconhecida',
    $aluno['turma_nome'] ?? 'Turma desconhecida'
  );

  registrar_log($pdo, 'delete', 'alunos', $id, $descricao);

  json_response(true, null, "Aluno '{$aluno['nome']}' excluído com sucesso!");

} catch (Throwable $e) {
  json_response(false, null, 'Erro ao excluir aluno: ' . $e->getMessage(), 500);
}
