<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../_core/log_helper.php';

require_method(['POST', 'PUT']);
require_auth();

$pdo = pdo();

try {
  // Lê JSON ou form-data
  $raw = file_get_contents('php://input');
  $in = json_decode($raw, true);
  if (!is_array($in) || empty($in)) {
    $in = $_POST; // fallback
  }

  $alteracoes = [];

  // Caso venha um único item (com chave e valor)
  if (isset($in['chave'], $in['valor'])) {
    $key = trim((string)$in['chave']);
    $val = (float)$in['valor'];

    if ($key !== '') {
      $stmt = $pdo->prepare("
        INSERT INTO precos (chave, valor, vigente_desde)
        VALUES (:chave, :valor, CURRENT_DATE)
        ON DUPLICATE KEY UPDATE valor = VALUES(valor), vigente_desde = VALUES(vigente_desde)
      ");
      $stmt->execute([':chave' => $key, ':valor' => $val]);
      $alteracoes[] = [$key, $val];
    }
  } 
  // Caso venha um array de chaves => valores
  else {
    foreach ($in as $key => $val) {
      if (!$key || !is_numeric($val)) continue;
      $stmt = $pdo->prepare("
        INSERT INTO precos (chave, valor, vigente_desde)
        VALUES (:chave, :valor, CURRENT_DATE)
        ON DUPLICATE KEY UPDATE valor = VALUES(valor), vigente_desde = VALUES(vigente_desde)
      ");
      $stmt->execute([':chave' => trim((string)$key), ':valor' => (float)$val]);
      $alteracoes[] = [$key, (float)$val];
    }
  }

  // Registra log com resumo
  if ($alteracoes) {
    $descricoes = array_map(fn($a) => "{$a[0]} = R$ " . number_format($a[1], 2, ',', '.'), $alteracoes);
    $texto = 'Atualizou valores de preços: ' . implode(', ', $descricoes);
    registrar_log($pdo, 'update', 'precos', null, $texto);
  }

  json_response(true, null, 'Preço atualizado com sucesso.');

} catch (Throwable $e) {
  json_response(false, null, 'Erro ao salvar preço: ' . $e->getMessage(), 500);
}
