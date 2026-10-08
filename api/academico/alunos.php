<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

$pdo = pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $turmaId = isset($_GET['turma_id']) ? (int)$_GET['turma_id'] : null;
  if ($turmaId) {
    $st = $pdo->prepare("SELECT id, turma_id, nome, responsavel, telefone, status, dt_status FROM alunos WHERE turma_id=:t ORDER BY nome");
    $st->execute([':t'=>$turmaId]);
    json_response(true, ['items'=>$st->fetchAll()]);
  }
  $rows = $pdo->query("SELECT id, turma_id, nome, responsavel, telefone, status, dt_status FROM alunos ORDER BY nome")->fetchAll();
  json_response(true, ['items'=>$rows]);
}

if ($method === 'POST') {
  $in = input_json();
  // compat com o seu modal: ele envia segmento_id, serie_id, turma_id, ...
  $turmaId     = (int)($in['turma_id'] ?? 0);
  $nome        = trim((string)($in['nome'] ?? ''));
  $responsavel = trim((string)($in['responsavel'] ?? ''));
  $telefone    = trim((string)($in['telefone'] ?? ''));
  $status      = (string)($in['status'] ?? 'ativo');
  if (!in_array($status, ['ativo','inativo'], true)) $status = 'ativo';

  if ($turmaId <= 0)        json_response(false, null, 'Escolha a Turma.', 422);
  if ($nome === '')         json_response(false, null, 'Informe o nome do Aluno.', 422);
  if ($responsavel === '')  json_response(false, null, 'Informe o Responsável.', 422);

  $pdo->beginTransaction();
  try {
    $st = $pdo->prepare("INSERT INTO alunos (turma_id, nome, responsavel, telefone, status)
                         VALUES (:t,:n,:r,:f,:s)");
    $st->execute([':t'=>$turmaId, ':n'=>$nome, ':r'=>$responsavel, ':f'=>$telefone, ':s'=>$status]);
    $id = (int)$pdo->lastInsertId();

    // audit
    $actor = $_SESSION['user']['id'] ?? null;
    $alog = $pdo->prepare("INSERT INTO audit_logs (user_id, entidade, entidade_id, acao, diffs)
      VALUES (:u,'alunos',:id,'create',CAST(:d AS JSON))");
    $alog->execute([
      ':u'=>$actor, ':id'=>$id,
      ':d'=>json_encode(['after'=>['id'=>$id,'turma_id'=>$turmaId,'nome'=>$nome,'responsavel'=>$responsavel,'telefone'=>$telefone,'status'=>$status]], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)
    ]);

    $pdo->commit();
    json_response(true, ['item'=>[
      'id'=>$id,'turma_id'=>$turmaId,'nome'=>$nome,'responsavel'=>$responsavel,'telefone'=>$telefone,'status'=>$status
    ]], 'Aluno criado', 201);
  } catch (Throwable $e) {
    $pdo->rollBack();
    json_response(false, null, 'Erro ao criar aluno: '.$e->getMessage(), 500);
  }
}

json_response(false, null, 'Método não permitido', 405);
