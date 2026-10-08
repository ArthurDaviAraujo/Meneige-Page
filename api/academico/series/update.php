<?php
declare(strict_types=1);
require_once __DIR__ . '/../../_core/bootstrap.php';
require_once __DIR__ . '/../../_core/log_helper.php';

require_method(['PUT','POST']);
require_auth();

$pdo = pdo();
$in  = input_json();

$id   = (int)($in['id'] ?? ($_GET['id'] ?? 0));
$nome = trim((string)($in['nome'] ?? ''));

if ($id <= 0)     json_response(false, null, 'ID inválido.', 422);
if ($nome === '') json_response(false, null, 'Informe o nome da Série.', 422);

try {
  $pdo->beginTransaction();

  // Busca dados antigos
  $snap = $pdo->prepare("
    SELECT s.id, s.nome, s.codigo, s.ordem, seg.nome AS segmento
    FROM series s
    JOIN segments seg ON s.segment_id = seg.id
    WHERE s.id = ?
  ");
  $snap->execute([$id]);
  $old = $snap->fetch(PDO::FETCH_ASSOC);

  if (!$old) {
    $pdo->rollBack();
    json_response(false, null, 'Série não encontrada.', 404);
  }

  // Atualiza nome
  $upd = $pdo->prepare("UPDATE series SET nome = ? WHERE id = ?");
  $upd->execute([$nome, $id]);

  // Monta descrição
  $descricao = sprintf(
    'Atualizou a série %s (segmento %s - ordem %d) para %s',
    $old['nome'],
    $old['segmento'] ?? 'Desconhecido',
    $old['ordem'] ?? 0,
    $nome
  );

  // Log
  registrar_log($pdo, 'update', 'series', $id, $descricao);

  $pdo->commit();
  json_response(true, ['item' => ['id' => $id, 'nome' => $nome]], 'Série atualizada com sucesso.');

} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(false, null, 'Erro ao atualizar série: ' . $e->getMessage(), 500);
}
