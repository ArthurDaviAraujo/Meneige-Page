<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

$pdo = pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function slug_codigo(string $nome, PDO $pdo): string {
  $slug = strtolower(trim(preg_replace('~[^a-z0-9]+~i', '-', iconv('UTF-8','ASCII//TRANSLIT',$nome)), '-'));
  if ($slug === '') $slug = 'serie';
  // garante único (tenta -2, -3, ...)
  $base = $slug; $i=2;
  $st = $pdo->prepare("SELECT 1 FROM series WHERE codigo = :c LIMIT 1");
  while (true) {
    $st->execute([':c'=>$slug]);
    if (!$st->fetch()) return $slug;
    $slug = $base.'-'.$i++;
  }
}

if ($method === 'GET') {
$segmentId = isset($_GET['segmento_id']) ? (int)$_GET['segmento_id'] : (isset($_GET['segment_id']) ? (int)$_GET['segment_id'] : null);
  if ($segmentId) {
    $st = $pdo->prepare("SELECT id, segment_id, nome, codigo, ordem FROM series WHERE segment_id = :s ORDER BY ordem, nome");
    $st->execute([':s'=>$segmentId]);
    $rows = $st->fetchAll();
  } else {
    $rows = $pdo->query("SELECT id, segment_id, nome, codigo, ordem FROM series ORDER BY segment_id, ordem, nome")->fetchAll();
  }
  json_response(true, ['items'=>$rows]);
}

if ($method === 'POST') {
  $in = input_json();
  $segmentId = (int)($in['segmento_id'] ?? $in['segment_id'] ?? 0);
  $nome  = trim((string)($in['nome'] ?? ''));
  $ordem = (int)($in['ordem'] ?? 0);
  $codigo = trim((string)($in['codigo'] ?? ''));

  if ($segmentId <= 0) json_response(false, null, 'Escolha o Segmento.', 422);
  if ($nome === '')    json_response(false, null, 'Informe o nome da Série.', 422);
  if ($codigo === '')  $codigo = slug_codigo($nome, $pdo);

  $pdo->beginTransaction();
  try {
    $st = $pdo->prepare("INSERT INTO series (segment_id, nome, codigo, ordem) VALUES (:s,:n,:c,:o)");
    $st->execute([':s'=>$segmentId, ':n'=>$nome, ':c'=>$codigo, ':o'=>$ordem]);
    $id = (int)$pdo->lastInsertId();

    // audit
    $actor = $_SESSION['user']['id'] ?? null;
    $alog = $pdo->prepare("INSERT INTO audit_logs (user_id, entidade, entidade_id, acao, diffs)
      VALUES (:u,'series',:id,'create',CAST(:d AS JSON))");
    $alog->execute([
      ':u'=>$actor, ':id'=>$id,
      ':d'=>json_encode(['after'=>['id'=>$id,'segment_id'=>$segmentId,'nome'=>$nome,'codigo'=>$codigo,'ordem'=>$ordem]], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)
    ]);

    $pdo->commit();
    json_response(true, ['item'=>['id'=>$id,'segment_id'=>$segmentId,'nome'=>$nome,'codigo'=>$codigo,'ordem'=>$ordem]], 'Série criada', 201);
  } catch (PDOException $e) {
    $pdo->rollBack();
    if ($e->getCode()==='23000') json_response(false, null, 'Código de série já existe.', 409);
    json_response(false, null, 'Erro ao criar série: '.$e->getMessage(), 500);
  } catch (Throwable $e) {
    $pdo->rollBack();
    json_response(false, null, 'Erro ao criar série: '.$e->getMessage(), 500);
  }
}

json_response(false, null, 'Método não permitido', 405);
