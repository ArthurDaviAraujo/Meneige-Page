<?php
// /api/users/change-password.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
$me = require_auth();

$in = input_json();
$old = (string)($in['old'] ?? '');
$new = (string)($in['new'] ?? '');

if ($old === '' || $new === '' || strlen($new) < 6) {
  json_response(false, null, 'Senha inválida (mín. 6)', 400);
}

$pdo = pdo();
$stmt = $pdo->prepare('SELECT senha_hash FROM users WHERE id=?');
$stmt->execute([(int)$me['id']]);
$row = $stmt->fetch();
if (!$row || !password_verify($old, (string)$row['senha_hash'])) {
  json_response(false, null, 'Senha atual incorreta', 400);
}

$hash = password_hash($new, PASSWORD_BCRYPT);
$upd = $pdo->prepare('UPDATE users SET senha_hash=? WHERE id=?');
$upd->execute([$hash, (int)$me['id']]);

json_response(true, null, 'Senha alterada');
