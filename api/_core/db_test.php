<?php
// /api/_dev/db_test.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/config.php';
require_once __DIR__ . '/../_core/db.php';

header('Content-Type: application/json; charset=utf-8');

function table_exists(PDO $pdo, string $table, string $dbName): bool {
  $st = $pdo->prepare("
    SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = :db
       AND TABLE_NAME   = :tb
     LIMIT 1
  ");
  $st->execute([':db' => $dbName, ':tb' => $table]);
  return (bool)$st->fetchColumn();
}

try {
  $pdo = pdo();

  // Infos básicas
  $dbVersion = $pdo->query('SELECT VERSION()')->fetchColumn();
  $nowSql    = $pdo->query('SELECT NOW()')->fetchColumn();
  $tzSql     = $pdo->query('SELECT @@session.time_zone')->fetchColumn();
  $charSet   = $pdo->query('SHOW VARIABLES LIKE "character_set_connection"')->fetch(PDO::FETCH_ASSOC)['Value'] ?? null;
  $collation = $pdo->query('SHOW VARIABLES LIKE "collation_connection"')->fetch(PDO::FETCH_ASSOC)['Value'] ?? null;

  // Lista de tabelas do schema atual
  $tables = [];
  $stTbl = $pdo->prepare("
    SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = :db
     ORDER BY TABLE_NAME
  ");
  $stTbl->execute([':db' => DB_NAME]);
  $tables = array_map(fn($r) => $r['TABLE_NAME'], $stTbl->fetchAll(PDO::FETCH_ASSOC));

  // Amostra de usuários + qtd de permissões (se as tabelas existirem)
  $usersSample = null;
  if (table_exists($pdo, 'users', DB_NAME)) {
    // tenta contar permissões se houver user_permissions
    $hasUserPerm = table_exists($pdo, 'user_permissions', DB_NAME);

    $sql = "
      SELECT
        u.id, u.nome, u.usuario, u.email, u.role, u.ativo,
        u.created_at, u.updated_at" .
        ($hasUserPerm ? ",
        COALESCE(up.qtd, 0) AS perms_qtd" : "") . "
      FROM users u " .
      ($hasUserPerm ? "
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS qtd
          FROM user_permissions
         WHERE granted = 1
         GROUP BY user_id
      ) up ON up.user_id = u.id" : "") . "
      ORDER BY u.id DESC
      LIMIT 5
    ";
    $usersSample = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
  }

  echo json_encode([
    'ok'   => true,
    'env'  => [
      'host'      => DB_HOST,
      'name'      => DB_NAME,
      'charset'   => DB_CHARSET,
      'app_tz'    => (defined('APP_TZ') ? APP_TZ : null),
    ],
    'db'   => [
      'version'   => $dbVersion,
      'now_sql'   => $nowSql,
      'tz_sql'    => $tzSql,
      'charset'   => $charSet,
      'collation' => $collation,
      'tables'    => $tables,
    ],
    'samples' => [
      'users' => $usersSample,
    ],
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode([
    'ok'   => false,
    'err'  => $e->getMessage(),
    'file' => $e->getFile(),
    'line' => $e->getLine(),
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
