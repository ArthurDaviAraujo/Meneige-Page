<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

$pdo = pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $rows = $pdo->query("SELECT id, nome, ordem FROM segments ORDER BY ordem, nome")->fetchAll();
  json_response(true, ['items' => $rows]);
}

if ($method === 'POST') {
  $in = input_json();
  $nome  = trim((string)($in['nome'] ?? ''));
  $ordem = (int)($in['ordem'] ?? 0);
  if ($nome === '') json_response(false, null, 'Informe o nome do Segmento.', 422);

  $pdo->beginTransaction();
  try {
    $st = $pdo->prepare("INSERT INTO segments (nome, ordem) VALUES (:n, :o)");
    $st->execute([':n'=>$nome, ':o'=>$ordem]);
    $id = (int)$pdo->lastInsertId();

    // audit
    $actor = $_SESSION['user']['id'] ?? null;
    $alog = $pdo->prepare("INSERT INTO audit_logs (user_id, entidade, entidade_id, acao, diffs)
      VALUES (:u,'segments',:id,'create',CAST(:d AS JSON))");
    $alog->execute([
      ':u'=>$actor, ':id'=>$id,
      ':d'=>json_encode(['after'=>['id'=>$id,'nome'=>$nome,'ordem'=>$ordem]], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)
    ]);

    $pdo->commit();
    json_response(true, ['item'=>['id'=>$id,'nome'=>$nome,'ordem'=>$ordem]], 'Segmento criado', 201);
  } catch (Throwable $e) {
    $pdo->rollBack();
    json_response(false, null, 'Erro ao criar segmento: '.$e->getMessage(), 500);
  }
}



json_response(false, null, 'Método não permitido', 405);
