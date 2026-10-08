<?php
// /api/_core/auth.php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

/** Retorna usuário logado (array) ou null */
function current_user(): ?array {
  return $_SESSION['user'] ?? null;
}

/** Exige usuário logado (e opcionalmente role) */
function require_auth(?array $roles = null): array {
  $u = current_user();
  if (!$u) json_response(false, null, 'Não autenticado', 401);
  if ($roles && !in_array($u['role'], $roles, true)) {
    json_response(false, null, 'Sem permissão', 403);
  }
  return $u;
}

/** Login por usuario (case-insensitive). Fallback opcional: email exato */
function login_with_credentials(string $identifier, string $password): ?array {
  $pdo = pdo();

  // 1) tenta por "usuario"
  $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(usuario) = LOWER(?) LIMIT 1');
  $stmt->execute([$identifier]);
  $user = $stmt->fetch();

  // 2) fallback: email exato (se você quiser manter)
  if (!$user) {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$identifier]);
    $user = $stmt->fetch();
  }

  if (!$user || !$user['ativo']) return null;
  if (!password_verify($password, (string)$user['senha_hash'])) return null;

  $sessionUser = [
    'id'       => (int)$user['id'],
    'nome'     => (string)$user['nome'],
    'usuario'  => (string)($user['usuario'] ?? ''),
    'email'    => (string)$user['email'],
    'role'     => (string)$user['role'],
  ];
  $_SESSION['user'] = $sessionUser;
  return $sessionUser;
}

/** Faz logout limpando a sessão */
function do_logout(): void {
  $_SESSION = [];
  if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time()-42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
  }
  session_destroy();
}
