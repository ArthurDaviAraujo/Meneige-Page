<?php
declare(strict_types=1);
require_once __DIR__ . '/../../_core/bootstrap.php';
$pdo = pdo();

$alunoId = isset($_GET['aluno_id']) ? (int)$_GET['aluno_id'] : 0;
if ($alunoId <= 0) json_response(false, null, 'aluno_id obrigatório', 422);

$sql = "
  SELECT 
    mc.id AS matricula_id,
    c.id AS curso_id,
    c.nome AS curso_nome,
    c.professor_nome,
    c.dias_horarios,
    c.preco_mensal,
    mc.status
  FROM matriculas_curso mc
  INNER JOIN curso_turmas ct ON ct.id = mc.curso_turma_id
  INNER JOIN cursos c        ON c.id = ct.curso_id
  WHERE mc.aluno_id = :aid
";
$st = $pdo->prepare($sql);
$st->execute([':aid' => $alunoId]);

json_response(true, ['items' => $st->fetchAll()]);
