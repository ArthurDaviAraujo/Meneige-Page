<?php
// /api/auth/login.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');

if ((int)pdo()->query('SELECT COUNT(*) FROM users')->fetchColumn() === 0) {
  json_response(false, null, 'Nenhum administrador configurado. Execute scripts/create_admin.php no servidor.', 503);
}

$in = input_json();
$identifier = trim((string)($in['user'] ?? ''));   // <— agora é usuário
$password   = (string)($in['pass'] ?? '');

if ($identifier === '' || $password === '') {
  json_response(false, null, 'Informe usuário e senha', 400);
}

$user = login_with_credentials($identifier, $password);
if (!$user) {
  json_response(false, null, 'Usuário ou senha inválidos', 401);
}

json_response(true, ['user'=>$user], 'Autenticado');
