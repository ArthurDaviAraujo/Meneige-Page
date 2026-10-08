<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/log_helper.php';

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$pdo = pdo();
session_start();
$_SESSION['user'] = ['id' => 1, 'nome' => 'Teste'];

registrar_log($pdo, 'teste', 'diagnostico', 99, [
  'descricao' => 'Teste de inserção direta no audit_logs'
]);

echo "✅ Script executado até o fim.";
