<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../_core/log_helper.php';
require_method('POST');
require_auth();

$in  = input_json();
$pdo = pdo();

try {
  $turma_id = (int)($in['turma_id'] ?? 0);
  $nome     = trim((string)($in['nome'] ?? ''));
  $resp     = trim((string)($in['responsavel'] ?? ''));

  $horaEnt  = $in['hora_entrada'] ?? null;
  $horaSai  = $in['hora_saida'] ?? null;
  $almoco   = !empty($in['almoco']) ? 1 : 0;
  $jantar   = !empty($in['jantar']) ? 1 : 0;
  $cursoId  = $in['curso_extra_id'] ?? null;

  if (!$turma_id || $nome === '') {
    json_response(false, null, 'Preencha todos os campos obrigatórios.');
  }

  // 1) Cria o aluno
  $stmt = $pdo->prepare("
    INSERT INTO alunos (turma_id, nome, responsavel, status)
    VALUES (?, ?, ?, 'ativo')
  ");
  $stmt->execute([$turma_id, $nome, $resp ?: null]);
  $alunoId = (int)$pdo->lastInsertId();

  // 2) Cria rotina semanal (Seg–Sex)
  $stmtRotina = $pdo->prepare("
    INSERT INTO aluno_rotina (aluno_id, dia_semana, entrada, saida, almoco, jantar)
    VALUES (?, ?, ?, ?, ?, ?)
  ");
  for ($dia = 1; $dia <= 5; $dia++) {
    $stmtRotina->execute([$alunoId, $dia, $horaEnt, $horaSai, $almoco, $jantar]);
  }

  // 3) Curso extracurricular
  if (!empty($cursoId)) {
    $stmtCT = $pdo->prepare("SELECT id FROM curso_turmas WHERE curso_id = ? LIMIT 1");
    $stmtCT->execute([$cursoId]);
    $cursoTurmaId = $stmtCT->fetchColumn();

    if (!$cursoTurmaId) {
      $pdo->prepare("INSERT INTO curso_turmas (curso_id, ativo) VALUES (?, 1)")
          ->execute([$cursoId]);
      $cursoTurmaId = (int)$pdo->lastInsertId();
    }

    $pdo->prepare("
      INSERT INTO matriculas_curso (aluno_id, curso_turma_id, status)
      VALUES (?, ?, 'ativa')
    ")->execute([$alunoId, $cursoTurmaId]);
  }

  // 4) Busca informações da turma/série para log
  $info = $pdo->prepare("
    SELECT t.nome AS turma_nome, s.nome AS serie_nome
    FROM turmas t
    JOIN series s ON t.series_id = s.id
    WHERE t.id = ?
  ");
  $info->execute([$turma_id]);
  $dados = $info->fetch(PDO::FETCH_ASSOC);

  // 5) Descrição detalhada para log
  $descricao = sprintf(
    'Criou o aluno %s (%s - %s)',
    $nome,
    $dados['serie_nome'] ?? 'Série desconhecida',
    $dados['turma_nome'] ?? 'Turma desconhecida'
  );

  // 6) Registra log no banco (estrutura compatível)
  registrar_log($pdo, 'create', 'alunos', $alunoId, $descricao);

  // 7) Retorna sucesso
  json_response(true, [
    'id' => $alunoId,
    'nome' => $nome,
    'responsavel' => $resp,
    'hora_entrada' => $horaEnt,
    'hora_saida' => $horaSai,
    'almoco' => $almoco,
    'jantar' => $jantar,
    'curso_extra_id' => $cursoId
  ]);

} catch (Throwable $e) {
  json_response(false, null, 'Erro ao cadastrar aluno: ' . $e->getMessage(), 500);
}
