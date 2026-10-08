<?php
declare(strict_types=1);
require_once __DIR__ . '/../../_core/bootstrap.php';
require_once __DIR__ . '/../../_core/log_helper.php';

require_method('POST');
require_auth();

$pdo = pdo();
$in  = input_json();

$alunoId = (int)($in['aluno_id'] ?? 0);
$cursoId = (int)($in['curso_id'] ?? 0);
$cursoTurmaId = isset($in['curso_turma_id']) ? (int)$in['curso_turma_id'] : 0;

if ($alunoId <= 0 || ($cursoId <= 0 && $cursoTurmaId <= 0)) {
  json_response(false, null, 'Campos obrigatórios ausentes.', 422);
}

try {
  // Busca nomes para log
  $alunoNome = $pdo->query("SELECT nome FROM alunos WHERE id = {$alunoId}")->fetchColumn() ?: 'Aluno desconhecido';
  $cursoNome = $pdo->query("SELECT nome FROM cursos WHERE id = {$cursoId}")->fetchColumn() ?: 'Curso desconhecido';

  // Se não veio curso_turma_id, cria ou busca um curso_turma simples
  if ($cursoTurmaId <= 0) {
    $st = $pdo->prepare("SELECT id FROM curso_turmas WHERE curso_id = :c LIMIT 1");
    $st->execute([':c' => $cursoId]);
    $cursoTurmaId = (int)$st->fetchColumn();

    if ($cursoTurmaId <= 0) {
      $st2 = $pdo->prepare("INSERT INTO curso_turmas (curso_id, ativo) VALUES (:c, 1)");
      $st2->execute([':c' => $cursoId]);
      $cursoTurmaId = (int)$pdo->lastInsertId();
    }
  }

  // Impede duplicidade
  $check = $pdo->prepare("SELECT id FROM matriculas_curso WHERE aluno_id = :a AND curso_turma_id = :ct");
  $check->execute([':a' => $alunoId, ':ct' => $cursoTurmaId]);
  if ($check->fetch()) {
    json_response(false, null, 'Aluno já matriculado neste curso.', 409);
  }

  // Cria matrícula
  $st = $pdo->prepare("
    INSERT INTO matriculas_curso (aluno_id, curso_turma_id, status)
    VALUES (:a, :ct, 'ativa')
  ");
  $st->execute([':a' => $alunoId, ':ct' => $cursoTurmaId]);
  $matriculaId = (int)$pdo->lastInsertId();

  // Log de criação
  $descricao = sprintf('Matriculou o aluno "%s" no curso "%s"', $alunoNome, $cursoNome);
  registrar_log($pdo, 'create', 'matriculas_curso', $matriculaId, $descricao);

  json_response(true, ['id' => $matriculaId], 'Matrícula criada com sucesso.');

} catch (Throwable $e) {
  json_response(false, null, 'Erro ao criar matrícula: ' . $e->getMessage(), 500);
}
