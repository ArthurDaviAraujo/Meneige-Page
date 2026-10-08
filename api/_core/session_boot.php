<?php
// /api/_core/session_boot.php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

date_default_timezone_set(defined('APP_TZ') ? APP_TZ : 'America/Sao_Paulo');

// Inicia a sessão (mesma SESSION_NAME do seu config)
if (session_status() !== PHP_SESSION_ACTIVE) {
  session_name(SESSION_NAME ?? 'GISESSID');
  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
  session_set_cookie_params([
    'lifetime' => 60*60*24*7, // 7 dias
    'path'     => '/',
    'domain'   => '',
    'secure'   => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
  session_start();
}
