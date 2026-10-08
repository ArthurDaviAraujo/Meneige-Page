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
if ($nome === '') json_response(false, null, 'Informe o nome da Turma.', 422);

try {
  $pdo->beginTransaction();

  // Busca turma original
  $snap = $pdo->prepare("
    SELECT t.id, t.nome, t.entrada_parcial, t.saida_parcial, t.ativo,
           s.nome AS serie_nome, seg.nome AS segmento_nome
    FROM turmas t
    JOIN series s ON t.series_id = s.id
    JOIN segments seg ON s.segment_id = seg.id
    WHERE t.id = ?
  ");
  $snap->execute([$id]);
  $old = $snap->fetch(PDO::FETCH_ASSOC);

  if (!$old) {
    $pdo->rollBack();
    json_response(false, null, 'Turma não encontrada.', 404);
  }

  // Atualiza o nome
  $upd = $pdo->prepare("UPDATE turmas SET nome = ? WHERE id = ?");
  $upd->execute([$nome, $id]);

  // Descrição amigável para log
  $descricao = sprintf(
    'Atualizou a turma %s (%s - %s) para %s',
    $old['nome'],
    $old['serie_nome'] ?? 'Série desconhecida',
    $old['segmento_nome'] ?? 'Segmento desconhecido',
    $nome
  );

  // Registra log
  registrar_log($pdo, 'update', 'turmas', $id, $descricao);

  $pdo->commit();
  json_response(true, ['item' => ['id' => $id, 'nome' => $nome]], 'Turma atualizada com sucesso.');

} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(false, null, 'Erro ao atualizar turma: ' . $e->getMessage(), 500);
}
