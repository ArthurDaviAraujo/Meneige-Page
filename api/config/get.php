<?php
// /api/config/get.php
require_once __DIR__ . '/../_core/bootstrap.php';
require_method('GET');

try {
  $pdo = pdo();
  $stmt = $pdo->query("SELECT k, v FROM config WHERE k IN ('nome_sistema','logo_escola')");
  $data = [];
  foreach ($stmt as $row) $data[$row['k']] = $row['v'];
  json_response(true, $data);
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao carregar configurações: ' . $e->getMessage(), 500);
}
