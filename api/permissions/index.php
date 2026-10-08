<?php
// /api/permissions/index.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../_core/roles.php';

require_method('GET');
require_cap('user.read'); // ou outra capability

$pdo = pdo();
$stmt = $pdo->query('SELECT id, code, nome, area FROM permissions ORDER BY area, code');
$items = $stmt->fetchAll();

json_response(true, ['items'=>$items]);
