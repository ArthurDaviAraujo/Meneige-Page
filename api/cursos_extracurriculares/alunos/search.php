<?php
declare(strict_types=1);
require_once __DIR__ . '/../../_core/bootstrap.php';
$pdo = pdo();

$q = trim($_GET['q'] ?? '');
$limit = max(1, min((int)($_GET['limit'] ?? 50), 100));

$sql = "
  SELECT id, nome, responsavel
  FROM alunos
  WHERE status = 'ativo'
";
$params = [];

if ($q !== '') {
  $sql .= " AND nome LIKE :q";
  $params[':q'] = "%$q%";
}
$sql .= " ORDER BY nome LIMIT $limit";

$st = $pdo->prepare($sql);
$st->execute($params);

json_response(true, ['items'=>$st->fetchAll()]);
