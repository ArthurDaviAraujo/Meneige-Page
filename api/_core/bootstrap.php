<?php
// /api/_core/bootstrap.php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

date_default_timezone_set(defined('APP_TZ') ? APP_TZ : 'America/Sao_Paulo');

/* ---------- Cabeçalhos padrão para APIs JSON ---------- */
/* (evita interferir em PDFs, downloads, relatórios etc) */
if (
  !isset($GLOBALS['_no_json_header'])
  && !preg_match('~/relatorio_|/pdf|/download_~i', $_SERVER['SCRIPT_NAME'] ?? '')
) {
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
  header('Pragma: no-cache');
  header('Expires: 0');
}


/* ---------- Sessão segura ---------- */
if (session_status() !== PHP_SESSION_ACTIVE) {
  $sessName = defined('SESSION_NAME') ? SESSION_NAME : 'GISESSID';
  session_name($sessName);

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


/* ---------- Helpers ---------- */
function json_response(bool $ok, $data = null, string $message = '', int $code = 200): void {
  http_response_code($code);
  echo json_encode(
    array_filter(['ok'=>$ok, 'data'=>$data, 'message'=>$message], fn($v)=>$v!==null && $v!==''),
    JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES
  );
  exit;
}
function require_method(string|array $methods): void {
  $method = $_SERVER['REQUEST_METHOD'] ?? '';
  if (is_array($methods)) {
    if (!in_array($method, $methods, true)) {
      header('Allow: ' . implode(', ', $methods));
      json_response(false, null, 'Método não permitido', 405);
    }
  } elseif ($method !== $methods) {
    header('Allow: ' . $methods);
    json_response(false, null, 'Método não permitido', 405);
  }
}

function input_json(): array {
  $raw = file_get_contents('php://input') ?: '';
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

/* Lê corpo da requisição em qualquer formato comum (JSON, x-www-form-urlencoded, POST, GET) */
function input_any(): array {
  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  $ctype  = $_SERVER['CONTENT_TYPE'] ?? '';

  // 1) JSON explícito
  if (stripos($ctype, 'application/json') !== false) {
    return input_json();
  }

  // 2) POST (multipart/form-data ou x-www-form-urlencoded em POST)
  if (!empty($_POST)) {
    return $_POST;
  }

  // 3) GET puro (se quiser aceitar querystring em endpoints GET)
  if ($method === 'GET' && !empty($_GET)) {
    return $_GET;
  }

  // 4) PUT/PATCH/POST com x-www-form-urlencoded (PHP não popula $_POST nesses casos)
  $raw = file_get_contents('php://input') ?: '';

  // tenta primeiro como JSON (caso cliente esqueça o content-type)
  $j = json_decode($raw, true);
  if (is_array($j)) return $j;

  if (stripos($ctype, 'application/x-www-form-urlencoded') !== false) {
    $out = [];
    parse_str($raw, $out);
    return is_array($out) ? $out : [];
  }

  // fallback: nada reconhecido
  return [];
}

