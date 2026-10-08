<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../_core/log_helper.php';

$pdo = pdo();
require_auth();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $stmt = $pdo->query("SELECT id, chave, valor, obs FROM precos ORDER BY chave");
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  json_response(true, ['items' => $rows]);
  exit;
}

if ($method === 'POST') {
  $data = input_json();
  if (!isset($data['chave'], $data['valor'])) {
    json_response(false, null, 'Parâmetros ausentes.');
  }

  $chave = trim((string)$data['chave']);
  $valor = (float)$data['valor'];
  $obs   = trim((string)($data['obs'] ?? ''));

  // Verifica se já existe
  $check = $pdo->prepare("SELECT valor FROM precos WHERE chave = :chave LIMIT 1");
  $check->execute([':chave' => $chave]);
  $existe = $check->fetch(PDO::FETCH_ASSOC);

  // Insere ou atualiza
  $stmt = $pdo->prepare("
    INSERT INTO precos (chave, valor, obs)
    VALUES (:chave, :valor, :obs)
    ON DUPLICATE KEY UPDATE valor = VALUES(valor), obs = VALUES(obs)
  ");
  $stmt->execute([':chave'=>$chave,':valor'=>$valor,':obs'=>$obs !== '' ? $obs : null]);

  // Log: criação ou atualização
  $acao = $existe ? 'update' : 'create';
  $descricao = $existe
    ? sprintf('Atualizou o preço de "%s" para R$ %.2f', $chave, $valor)
    : sprintf('Cadastrou o preço "%s" com valor de R$ %.2f', $chave, $valor);

  registrar_log($pdo, $acao, 'precos', null, $descricao);

  json_response(true, ['chave' => $chave, 'valor' => $valor], 'Preço salvo com sucesso.');
  exit;
}

http_response_code(405);
echo json_encode(['ok'=>false,'message'=>'Método não permitido']);
