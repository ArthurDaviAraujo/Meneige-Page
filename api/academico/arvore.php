<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

$pdo = pdo();

/* Monta árvore:
[
  { id, nome, series: [
      { id, nome, codigo, turmas: [ { id, nome } ] }
  ]}
]
*/
$segs = $pdo->query("SELECT id, nome, ordem FROM segments ORDER BY ordem, nome")->fetchAll();
$seriesStmt = $pdo->prepare("SELECT id, nome, codigo FROM series WHERE segment_id=:s ORDER BY ordem, nome");
$turmasStmt = $pdo->prepare("SELECT id, nome FROM turmas WHERE series_id=:sr ORDER BY nome");

foreach ($segs as &$seg) {
  $seriesStmt->execute([':s'=>$seg['id']]);
  $seg['series'] = $seriesStmt->fetchAll();
  foreach ($seg['series'] as &$sr) {
    $turmasStmt->execute([':sr'=>$sr['id']]);
    $sr['turmas'] = $turmasStmt->fetchAll();
  }
}

json_response(true, ['segmentos'=>$segs]);
