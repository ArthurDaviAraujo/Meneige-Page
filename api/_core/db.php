<?php
// /api/_core/db.php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function pdo(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;

  // Se DB_HOST vier com "host:port", separe a porta
  $host = DB_HOST;
  $port = 3308;
  if (strpos(DB_HOST, ':') !== false) {
    [$h, $p] = explode(':', DB_HOST, 2);
    $host = $h;
    $port = (int)$p;
  }

  $dsn = "mysql:host={$host};port={$port};dbname=" . DB_NAME . ";charset=" . DB_CHARSET;

  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
  ]);

  // Opcional: timezone da conexão
  if (defined('APP_TZ')) {
    $stmt = $pdo->prepare("SET time_zone = :tz");
    $stmt->execute([':tz' => '-03:00']); // America/Sao_Paulo
  }

  return $pdo;
}
