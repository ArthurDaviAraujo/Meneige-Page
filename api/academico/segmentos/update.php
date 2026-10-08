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
if ($nome === '') json_response(false, null, 'Informe o nome do Segmento.', 422);

try {
  $pdo->beginTransaction();

  // Busca antes de alterar
  $before = $pdo->prepare("SELECT id, nome, ordem FROM segments WHERE id = ?");
  $before->execute([$id]);
  $old = $before->fetch(PDO::FETCH_ASSOC);

  if (!$old) {
    $pdo->rollBack();
    json_response(false, null, 'Segmento não encontrado.', 404);
  }

  // Atualiza o nome
  $upd = $pdo->prepare("UPDATE segments SET nome = ? WHERE id = ?");
  $upd->execute([$nome, $id]);

  // Monta descrição amigável
  $descricao = sprintf(
    'Atualizou o segmento %s (ordem %d) para %s',
    $old['nome'],
    $old['ordem'] ?? 0,
    $nome
  );

  // Registra log de atualização
  registrar_log($pdo, 'update', 'segments', $id, $descricao);

  $pdo->commit();
  json_response(true, ['item' => ['id' => $id, 'nome' => $nome]], 'Segmento atualizado com sucesso.');

} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(false, null, 'Erro ao atualizar segmento: ' . $e->getMessage(), 500);
}
