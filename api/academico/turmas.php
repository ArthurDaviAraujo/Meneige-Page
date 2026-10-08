<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

$pdo = pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* =========================================================
   GET — Listagem / Alunos por turma
   ========================================================= */
if ($method === 'GET') {

  // Caso especial: ?id=..&alunos=1 → listar alunos da turma
  $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
  $wantAlunos = isset($_GET['alunos']) && (int)$_GET['alunos'] === 1;
  if ($id && $wantAlunos) {
    $st = $pdo->prepare("
      SELECT id, nome, responsavel, status 
      FROM alunos 
      WHERE turma_id = :t 
      ORDER BY nome
    ");
    $st->execute([':t' => $id]);
    json_response(true, ['alunos' => $st->fetchAll()]);
  }

  // 🔹 CORREÇÃO: aceitar tanto serie_id quanto series_id
  $seriesId = (int)($_GET['series_id'] ?? $_GET['serie_id'] ?? 0);

  if ($seriesId > 0) {
    $st = $pdo->prepare("
      SELECT id, series_id, nome, entrada_parcial, saida_parcial, ativo
      FROM turmas
      WHERE series_id = :s
      ORDER BY nome
    ");
    $st->execute([':s' => $seriesId]);
    $rows = $st->fetchAll();
  } else {
    $rows = $pdo->query("
      SELECT id, series_id, nome, entrada_parcial, saida_parcial, ativo
      FROM turmas
      ORDER BY series_id, nome
    ")->fetchAll();
  }

  json_response(true, ['items' => $rows]);
}


/* =========================================================
   POST — Criar nova turma
   ========================================================= */
if ($method === 'POST') {
  $in = input_json();
  $segmentId = (int)($in['segmento_id'] ?? $in['segment_id'] ?? 0); // compatibilidade com modal
  $serieId   = (int)($in['serie_id'] ?? $in['series_id'] ?? 0);
  $nome      = trim((string)($in['nome'] ?? ''));
  $entrada   = trim((string)($in['entrada_parcial'] ?? '08:00'));
  $saida     = trim((string)($in['saida_parcial']   ?? '13:00'));

  if ($serieId <= 0) json_response(false, null, 'Escolha a Série.', 422);
  if ($nome === '')  json_response(false, null, 'Informe o nome da Turma.', 422);

  $pdo->beginTransaction();
  try {
    $st = $pdo->prepare("
      INSERT INTO turmas (series_id, nome, entrada_parcial, saida_parcial, ativo)
      VALUES (:s, :n, :e, :x, 1)
    ");
    $st->execute([
      ':s' => $serieId,
      ':n' => $nome,
      ':e' => $entrada,
      ':x' => $saida
    ]);

    $id = (int)$pdo->lastInsertId();

    // Auditoria
    $actor = $_SESSION['user']['id'] ?? null;
    $alog = $pdo->prepare("
      INSERT INTO audit_logs (user_id, entidade, entidade_id, acao, diffs)
      VALUES (:u, 'turmas', :id, 'create', CAST(:d AS JSON))
    ");
    $alog->execute([
      ':u' => $actor,
      ':id' => $id,
      ':d' => json_encode([
        'after' => [
          'id' => $id,
          'series_id' => $serieId,
          'nome' => $nome,
          'entrada_parcial' => $entrada,
          'saida_parcial' => $saida,
          'ativo' => 1
        ]
      ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    ]);

    $pdo->commit();
    json_response(true, [
      'item' => [
        'id' => $id,
        'series_id' => $serieId,
        'nome' => $nome,
        'entrada_parcial' => $entrada,
        'saida_parcial' => $saida,
        'ativo' => 1
      ]
    ], 'Turma criada', 201);

  } catch (Throwable $e) {
    $pdo->rollBack();
    json_response(false, null, 'Erro ao criar turma: ' . $e->getMessage(), 500);
  }
}


/* =========================================================
   Método não permitido
   ========================================================= */
json_response(false, null, 'Método não permitido', 405);
