<?php
// /api/config/upload_logo.php
require_once __DIR__ . '/../_core/bootstrap.php';
require_method('POST');

if (empty($_FILES['logo']['tmp_name'])) {
  json_response(false, null, 'Arquivo não recebido', 400);
}

$file = $_FILES['logo'];
$allowed = ['image/png','image/jpeg','image/webp','image/svg+xml'];
if (!in_array($file['type'], $allowed)) {
  json_response(false, null, 'Formato inválido', 415);
}
if ($file['size'] > 2 * 1024 * 1024) {
  json_response(false, null, 'Tamanho máximo: 2 MB', 413);
}

/* Caminho físico do dashboard, relativo à instalação atual. */
$basePath = realpath(__DIR__ . '/../../dashboard');
if (!$basePath) {
  json_response(false, null, 'Caminho base não encontrado.', 500);
}

$uploadsDir = $basePath . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR;

// Cria pasta se não existir
if (!is_dir($uploadsDir)) {
  if (!mkdir($uploadsDir, 0755, true)) {
    json_response(false, null, 'Falha ao criar pasta: ' . $uploadsDir, 500);
  }
}

// Gera nome único e destino
$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$destName = 'logo_escola_' . time() . '.' . $ext;
$destPath = $uploadsDir . $destName;

// Move o arquivo para o destino correto
if (!move_uploaded_file($file['tmp_name'], $destPath)) {
  json_response(false, null, 'Falha ao mover arquivo para ' . $destPath, 500);
}

// Monta URL final pública
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$appBase = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'], 3)), '/');
$url = "$scheme://$host{$appBase}/dashboard/uploads/" . rawurlencode($destName);

try {
  $pdo = pdo();
  $stmt = $pdo->prepare("INSERT INTO config (k,v) VALUES ('logo_escola', ?) 
                         ON DUPLICATE KEY UPDATE v = VALUES(v)");
  $stmt->execute([$url]);
  json_response(true, ['logo_escola'=>$url, 'saved_to'=>$destPath], 'Logo atualizada com sucesso!');
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao salvar no banco: ' . $e->getMessage(), 500);
}
