<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_core/bootstrap.php';
require_once __DIR__ . '/../../_core/log_helper.php';

require_method(['DELETE','POST']);
require_auth();

$pdo = pdo();

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) {
  $in = input_json(false);
  if ($in && isset($in['id'])) $id = (int)$in['id'];
}
if ($id <= 0) json_response(false, null, 'ID inválido.', 422);

try {
  $pdo->beginTransaction();

  // --- Busca dados da turma antes de excluir ---
  $snap = $pdo->prepare("
    SELECT t.id, t.nome, t.entrada_parcial, t.saida_parcial, t.ativo,
           s.nome AS serie_nome, seg.nome AS segmento_nome
    FROM turmas t
    JOIN series s ON t.series_id = s.id
    JOIN segments seg ON s.segment_id = seg.id
    WHERE t.id = ?
  ");
  $snap->execute([$id]);
  $turma = $snap->fetch(PDO::FETCH_ASSOC);

  if (!$turma) {
    $pdo->rollBack();
    json_response(false, null, 'Turma não encontrada.', 404);
  }

  // --- Exclui a turma ---
  $del = $pdo->prepare("DELETE FROM turmas WHERE id = ?");
  $del->execute([$id]);

  // --- Descrição detalhada para o log ---
  $descricao = sprintf(
    'Excluiu a turma %s (%s - %s)',
    $turma['nome'],
    $turma['serie_nome'] ?? 'Série desconhecida',
    $turma['segmento_nome'] ?? 'Segmento desconhecido'
  );

  // --- Registra no log ---
  registrar_log($pdo, 'delete', 'turmas', $id, $descricao);

  $pdo->commit();
  json_response(true, null, 'Turma removida com sucesso.');

} catch (PDOException $e) {
  $pdo->rollBack();
  if ($e->getCode() === '23000') {
    json_response(false, null, 'Não é possível excluir: há alunos vinculados a esta turma.', 409);
  }
  json_response(false, null, 'Erro ao excluir turma: ' . $e->getMessage(), 500);

} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(false, null, 'Erro ao excluir turma: ' . $e->getMessage(), 500);
}
