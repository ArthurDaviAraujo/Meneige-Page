<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
$pdo = pdo();

$cursoId = isset($_GET['curso_id']) ? (int)$_GET['curso_id'] : 0;

$sql = "
  SELECT 
    mc.id AS matricula_id,
    a.id AS aluno_id,
    a.nome AS aluno_nome,
    c.id AS curso_id,
    c.nome AS curso_nome,
    c.professor_nome,
    c.dias_horarios,
    c.preco_mensal,
    mc.status
  FROM matriculas_curso mc
  INNER JOIN alunos a        ON a.id = mc.aluno_id
  INNER JOIN curso_turmas ct ON ct.id = mc.curso_turma_id
  INNER JOIN cursos c        ON c.id = ct.curso_id
  WHERE a.status = 'ativo'
";

if ($cursoId > 0) {
  $sql .= " AND c.id = :cid";
  $st = $pdo->prepare($sql . " ORDER BY a.nome");
  $st->execute([':cid' => $cursoId]);
} else {
  $st = $pdo->query($sql . " ORDER BY c.nome, a.nome");
}

$rows = $st->fetchAll();
json_response(true, ['items' => $rows]);
