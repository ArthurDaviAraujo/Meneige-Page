<?php
// /api/config/remove_logo.php
require_once __DIR__ . '/../_core/bootstrap.php';
require_method('POST');

try {
  $pdo = pdo();
  $logo = $pdo->query("SELECT v FROM config WHERE k='logo_escola'")->fetchColumn();

  if ($logo) {
    // Extrai nome do arquivo (última parte da URL)
    $basename = basename(parse_url($logo, PHP_URL_PATH));
    $filePath = __DIR__ . '/../../dashboard/uploads/' . $basename;
    if (file_exists($filePath)) unlink($filePath);
  }

  $pdo->exec("DELETE FROM config WHERE k='logo_escola'");
  json_response(true, null, 'Logo removida');
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao remover: ' . $e->getMessage(), 500);
}
