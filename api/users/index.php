<?php
// /api/users/index.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';

require_method('GET');

$pdo = pdo();

/* --------- Filtros & paginação --------- */
$q       = trim((string)($_GET['q'] ?? ''));
$role    = trim((string)($_GET['role'] ?? ''));            // admin|padrao|leitor (opcional)
$ativo   = $_GET['ativo'] ?? null;                         // '0' | '1' (opcional)

$limit   = (int)($_GET['limit'] ?? 200);
$limit   = max(1, min($limit, 500));

$offset  = (int)($_GET['offset'] ?? 0);
$offset  = max(0, $offset);

/* --------- Ordenação segura --------- */
$sort    = strtolower((string)($_GET['sort'] ?? 'id'));    // id|nome|usuario|email|role|ativo|created_at|updated_at
$dir     = strtoupper((string)($_GET['dir'] ?? 'DESC'));   // ASC|DESC

$sortable = ['id','nome','usuario','email','role','ativo','created_at','updated_at'];
if (!in_array($sort, $sortable, true)) $sort = 'id';
$dir = ($dir === 'ASC') ? 'ASC' : 'DESC';

/* Mapa p/ ORDER BY com escape */
$sortCols = [
  'id'          => '`u`.`id`',
  'nome'        => '`u`.`nome`',
  'usuario'     => '`u`.`usuario`',
  'email'       => '`u`.`email`',
  'role'        => '`u`.`role`',        // role é palavra reservada; usa escape
  'ativo'       => '`u`.`ativo`',
  'created_at'  => '`u`.`created_at`',
  'updated_at'  => '`u`.`updated_at`',
];
$sortExpr = $sortCols[$sort] ?? '`u`.`id`';

/* --------- WHERE --------- */
$w   = [];
$arg = [];

if ($q !== '') {
  $w[]  = '(u.nome LIKE ? OR u.usuario LIKE ? OR u.email LIKE ?)';
  $like = "%{$q}%";
  array_push($arg, $like, $like, $like);
}
if ($role !== '' && in_array($role, ['admin','padrao','leitor'], true)) {
  $w[]   = 'u.role = ?';
  $arg[] = $role;
}
if ($ativo !== null && ($ativo === '0' || $ativo === '1')) {
  $w[]   = 'u.ativo = ?';
  $arg[] = (int)$ativo;
}
$where = $w ? (' WHERE ' . implode(' AND ', $w)) : '';

/* --------- Total (para paginação) --------- */
try {
  $sqlCount = 'SELECT COUNT(*) FROM users u' . $where;
  $stCount  = $pdo->prepare($sqlCount);
  $stCount->execute($arg);
  $total = (int)$stCount->fetchColumn();
} catch (Throwable $e) {
  json_response(false, null, 'Falha ao contar usuários: ' . $e->getMessage(), 500);
}

/* --------- Consulta principal --------- */
/*
  ⚠ MySQL não aceita placeholder em LIMIT/OFFSET com emulate_prepares=false.
  Como já validamos que são inteiros, é seguro interpolar.
*/
$sql = <<<SQL
  SELECT
    u.id,
    u.nome,
    u.usuario,
    u.email,
    u.role,
    u.ativo,
    u.created_at,
    u.updated_at
  FROM users u
  {$where}
  ORDER BY {$sortExpr} {$dir}
  LIMIT {$limit} OFFSET {$offset}
SQL;

try {
  $st = $pdo->prepare($sql);
  $st->execute($arg);
  $items = $st->fetchAll(PDO::FETCH_ASSOC);

  $hasMore    = ($offset + $limit) < $total;
  $nextOffset = $hasMore ? ($offset + $limit) : null;

  json_response(true, [
    'items'       => $items,
    'total'       => $total,
    'limit'       => $limit,
    'offset'      => $offset,
    'has_more'    => $hasMore,
    'next_offset' => $nextOffset,
    'sort'        => $sort,
    'dir'         => $dir,
  ]);
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao listar usuários: ' . $e->getMessage(), 500);
}
