<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../_core/log_helper.php';

require_method('PUT');
require_auth();

try {
  $in = input_json();
  $id = (int)($in['id'] ?? 0);

  if (!$id) {
    json_response(false, null, 'ID do aluno inválido.', 400);
  }

  $pdo = pdo();

  // Busca aluno atual para exibir no log depois
  $check = $pdo->prepare("
    SELECT a.id, a.nome, a.responsavel, t.nome AS turma_nome, s.nome AS serie_nome
    FROM alunos a
    JOIN turmas t ON a.turma_id = t.id
    JOIN series s ON t.series_id = s.id
    WHERE a.id = ?
  ");
  $check->execute([$id]);
  $alunoAntigo = $check->fetch(PDO::FETCH_ASSOC);

  if (!$alunoAntigo) {
    json_response(false, null, 'Aluno não encontrado.', 404);
  }

  // Atualiza informações principais
  $stmt = $pdo->prepare("
    UPDATE alunos SET nome=?, responsavel=?, turma_id=? WHERE id=?
  ");
  $stmt->execute([
    $in['nome'] ?? '',
    $in['responsavel'] ?? '',
    $in['turma_id'] ?? null,
    $id
  ]);

  // Atualiza rotina (se enviada)
  $pdo->prepare("
    UPDATE aluno_rotina
    SET entrada=?, saida=?, almoco=?, jantar=?
    WHERE aluno_id=? AND dia_semana=1
  ")->execute([
    $in['hora_entrada'] ?? null,
    $in['hora_saida'] ?? null,
    $in['almoco'] ?? 0,
    $in['jantar'] ?? 0,
    $id
  ]);

  // Busca dados atualizados
  $check->execute([$id]);
  $alunoNovo = $check->fetch(PDO::FETCH_ASSOC);

  // Monta descrição para log
  $descricao = sprintf(
    'Atualizou o aluno %s (%s - %s)',
    $alunoNovo['nome'] ?? $alunoAntigo['nome'],
    $alunoNovo['serie_nome'] ?? 'Série desconhecida',
    $alunoNovo['turma_nome'] ?? 'Turma desconhecida'
  );

  // Registra log no banco
  registrar_log($pdo, 'update', 'alunos', $id, $descricao);

  json_response(true, null, 'Aluno atualizado com sucesso!');

} catch (Throwable $e) {
  json_response(false, null, 'Erro ao atualizar aluno: ' . $e->getMessage(), 500);
}
