<?php
// /api/config/update_nome.php
require_once __DIR__ . '/../_core/bootstrap.php';
require_method('POST');

$input = input_json();
$nome = trim($input['nome'] ?? '');

if ($nome === '') json_response(false, null, 'Nome inválido', 400);

try {
  $pdo = pdo();
  $stmt = $pdo->prepare("INSERT INTO config (k, v) VALUES ('nome_sistema', ?) 
                         ON DUPLICATE KEY UPDATE v = VALUES(v)");
  $stmt->execute([$nome]);
  json_response(true, ['nome_sistema'=>$nome], 'Nome atualizado com sucesso');
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao salvar: ' . $e->getMessage(), 500);
}
