<?php
declare(strict_types=1);
require_once __DIR__ . '/../../_core/bootstrap.php';
require_once __DIR__ . '/../../_core/log_helper.php';

require_method('POST');
require_auth();

$pdo = pdo();
$in = input_json();

$alunoId   = (int)($in['aluno_id'] ?? 0);
$novaTurma = (int)($in['nova_turma_id'] ?? 0);

if ($alunoId <= 0 || $novaTurma <= 0) {
  json_response(false, null, 'Aluno e turma de destino obrigatórios.', 422);
}

try {
  // Busca dados do aluno e turma atual
  $check = $pdo->prepare("
    SELECT a.id, a.nome, t.id AS turma_antiga_id, t.nome AS turma_antiga_nome, s.nome AS serie_antiga
    FROM alunos a
    JOIN turmas t ON a.turma_id = t.id
    JOIN series s ON t.series_id = s.id
    WHERE a.id = ?
    LIMIT 1
  ");
  $check->execute([$alunoId]);
  $aluno = $check->fetch(PDO::FETCH_ASSOC);

  if (!$aluno) {
    json_response(false, null, 'Aluno não encontrado.', 404);
  }

  // Busca informações da nova turma
  $nova = $pdo->prepare("
    SELECT t.id AS turma_nova_id, t.nome AS turma_nova_nome, s.nome AS serie_nova
    FROM turmas t
    JOIN series s ON t.series_id = s.id
    WHERE t.id = ?
    LIMIT 1
  ");
  $nova->execute([$novaTurma]);
  $turmaNova = $nova->fetch(PDO::FETCH_ASSOC);

  if (!$turmaNova) {
    json_response(false, null, 'Turma de destino não encontrada.', 404);
  }

  // Atualiza a turma do aluno
  $upd = $pdo->prepare("UPDATE alunos SET turma_id = ? WHERE id = ?");
  $upd->execute([$novaTurma, $alunoId]);

  // Log amigável
  $descricao = sprintf(
    'Transferiu o aluno %s (%s - %s) para %s (%s)',
    $aluno['nome'],
    $aluno['serie_antiga'] ?? 'Série desconhecida',
    $aluno['turma_antiga_nome'] ?? 'Turma antiga desconhecida',
    $turmaNova['turma_nova_nome'] ?? 'Turma nova desconhecida',
    $turmaNova['serie_nova'] ?? 'Série desconhecida'
  );

  // Registra log na tabela audit_logs
  registrar_log($pdo, 'update', 'alunos', $alunoId, $descricao);

  // Retorna sucesso
  json_response(true, [
    'aluno_id'      => $alunoId,
    'turma_antiga'  => $aluno['turma_antiga_id'],
    'turma_nova'    => $turmaNova['turma_nova_id']
  ], 'Aluno transferido com sucesso.');

} catch (Throwable $e) {
  json_response(false, null, 'Erro ao transferir aluno: ' . $e->getMessage(), 500);
}
