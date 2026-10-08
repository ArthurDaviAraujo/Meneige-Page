<?php
// /api/relatorios/users.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

require_method('GET');
require_auth();

$pdo = pdo();
$q   = trim((string)($_GET['q'] ?? ''));

$sql = "SELECT id, nome, email FROM users WHERE ativo=1";
$params = [];
if ($q !== '') {
  $sql .= " AND (nome LIKE :q OR email LIKE :q)";
  $params[':q'] = '%'.$q.'%';
}
$sql .= " ORDER BY nome ASC LIMIT 500";

$st = $pdo->prepare($sql);
$st->execute($params);

$items = [];
while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
  $items[] = [
    'id'    => (int)$r['id'],
    'nome'  => $r['nome'],
    'email' => $r['email'],
    'label' => $r['nome'].' <'.$r['email'].'>',
  ];
}
json_response(true, ['items'=>$items]);
