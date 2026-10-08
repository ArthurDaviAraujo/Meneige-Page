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

  // Busca série antes da exclusão
  $snap = $pdo->prepare("
    SELECT s.id, s.nome, s.codigo, s.ordem, seg.nome AS segmento
    FROM series s
    JOIN segments seg ON s.segment_id = seg.id
    WHERE s.id = ?
  ");
  $snap->execute([$id]);
  $serie = $snap->fetch(PDO::FETCH_ASSOC);

  if (!$serie) {
    $pdo->rollBack();
    json_response(false, null, 'Série não encontrada.', 404);
  }

  // Exclui a série
  $del = $pdo->prepare("DELETE FROM series WHERE id = ?");
  $del->execute([$id]);

  // Monta descrição para o log
  $descricao = sprintf(
    'Excluiu a série %s (%s - ordem %d)',
    $serie['nome'],
    $serie['segmento'] ?? 'Segmento desconhecido',
    $serie['ordem'] ?? 0
  );

  // Registra log compatível
  registrar_log($pdo, 'delete', 'series', $id, $descricao);

  $pdo->commit();
  json_response(true, null, 'Série removida com sucesso.');

} catch (PDOException $e) {
  $pdo->rollBack();
  if ($e->getCode() === '23000') {
    json_response(false, null, 'Não é possível excluir: há turmas vinculadas a esta série.', 409);
  }
  json_response(false, null, 'Erro ao excluir série: ' . $e->getMessage(), 500);

} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(false, null, 'Erro ao excluir série: ' . $e->getMessage(), 500);
}
