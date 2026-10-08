<?php
declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../_core/bootstrap.php';
require_auth();

$pdo = pdo();
$st = $pdo->query("SELECT id, entidade, acao, diffs FROM audit_logs ORDER BY created_at DESC LIMIT 5");
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

echo "<pre>";
var_dump($rows);
