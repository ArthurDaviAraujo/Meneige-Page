<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
$pdo = pdo();

try {
  // Busca segmentos (tabela segments)
  $sqlSeg = $pdo->query("SELECT id, nome FROM segments ORDER BY nome");
  $segmentos = [];

  while ($seg = $sqlSeg->fetch(PDO::FETCH_ASSOC)) {
    $segId = (int)$seg['id'];

    // Busca séries do segmento (tabela series)
    $stSerie = $pdo->prepare("SELECT id, nome FROM series WHERE segment_id = :sid ORDER BY nome");
    $stSerie->execute([':sid' => $segId]);
    $series = [];

    while ($serie = $stSerie->fetch(PDO::FETCH_ASSOC)) {
      $serieId = (int)$serie['id'];

      // Busca turmas da série (tabela turmas)
      $stTurma = $pdo->prepare("SELECT id, nome FROM turmas WHERE series_id = :sid ORDER BY nome");
      $stTurma->execute([':sid' => $serieId]);
      $turmas = $stTurma->fetchAll(PDO::FETCH_ASSOC);

      $series[] = [
        'id'     => $serieId,
        'nome'   => $serie['nome'],
        'turmas' => $turmas
      ];
    }

    $segmentos[] = [
      'id'     => $segId,
      'nome'   => $seg['nome'],
      'series' => $series
    ];
  }

  json_response(true, ['segmentos' => $segmentos]);
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao carregar estrutura: ' . $e->getMessage());
}
