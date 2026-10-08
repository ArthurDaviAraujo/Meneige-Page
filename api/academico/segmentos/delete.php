<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_core/bootstrap.php';
require_once __DIR__ . '/../../_core/log_helper.php';

require_method(['DELETE','POST']);
require_auth();

$pdo = pdo();
$id  = (int)($_GET['id'] ?? 0);

if ($id <= 0) {
  $in = input_json(false);
  if ($in && isset($in['id'])) $id = (int)$in['id'];
}
if ($id <= 0) json_response(false, null, 'ID inválido.', 422);

try {
  $pdo->beginTransaction();

  // Busca nome do segmento antes de excluir
  $snap = $pdo->prepare("SELECT id, nome, ordem FROM segments WHERE id = ?");
  $snap->execute([$id]);
  $segmento = $snap->fetch(PDO::FETCH_ASSOC);

  if (!$segmento) {
    $pdo->rollBack();
    json_response(false, null, 'Segmento não encontrado.', 404);
  }

  // Exclui
  $del = $pdo->prepare("DELETE FROM segments WHERE id = ?");
  $del->execute([$id]);

  // Descrição amigável do log
  $descricao = sprintf(
    'Excluiu o segmento %s (ordem %d)',
    $segmento['nome'],
    $segmento['ordem'] ?? 0
  );

  // Registra log na tabela audit_logs
  registrar_log($pdo, 'delete', 'segments', $id, $descricao);

  $pdo->commit();
  json_response(true, null, 'Segmento removido com sucesso.');

} catch (PDOException $e) {
  $pdo->rollBack();
  if ($e->getCode() === '23000') {
    json_response(false, null, 'Não é possível excluir: há séries vinculadas a este segmento.', 409);
  }
  json_response(false, null, 'Erro ao excluir segmento: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(false, null, 'Erro ao excluir segmento: ' . $e->getMessage(), 500);
}
