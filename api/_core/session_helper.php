<?php
// /api/_core/session_helper.php
declare(strict_types=1);

/**
 * Retorna os dados do usuário autenticado.
 */
function auth_user(): ?array {
  if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
  }

  return isset($_SESSION['user']) && is_array($_SESSION['user'])
    ? $_SESSION['user']
    : null;
}

/**
 * Exige autenticação ativa.
 * Caso não haja sessão, encerra a requisição com erro 401.
 */
function require_auth(): void {
  if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
  }

  if (empty($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode([
      'ok' => false,
      'message' => 'Sessão expirada ou não autenticada.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
