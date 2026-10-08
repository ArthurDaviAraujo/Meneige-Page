<?php
// /api/_core/require_login.php
declare(strict_types=1);

require_once __DIR__ . '/session_boot.php';

/**
 * Bloqueia acesso se não estiver logado.
 * Opcional: exija roles específicas.
 *
 * @param array<string>|null $roles ex.: ['admin','padrao']
 * @param string $loginUrl URL da página de login (ajuste se necessário)
 * @return array dados do usuário em sessão
 */
function require_login(?array $roles = null, string $loginUrl = '/login/index.html'): array {
  $u = $_SESSION['user'] ?? null;

  if (!$u) {
    // redireciona não logados para o login
    header('Location: ' . $loginUrl);
    http_response_code(302);
    exit;
  }

  if ($roles && !in_array($u['role'] ?? '', $roles, true)) {
    // sem permissão -> pode redirecionar ou exibir 403
    header('Location: ' . $loginUrl . '?denied=1');
    http_response_code(302);
    exit;
  }

  return $u;
}
