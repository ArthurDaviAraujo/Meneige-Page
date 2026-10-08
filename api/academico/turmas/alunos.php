<?php
declare(strict_types=1);
require_once __DIR__ . '/../../_core/bootstrap.php';
$pdo = pdo();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $in = input_json();
  $turma_id = (int)($in['turma_id'] ?? 0);
  $nome = trim($in['nome'] ?? '');
  $responsavel = trim($in['responsavel'] ?? '');

  if ($turma_id <= 0 || $nome === '') {
    json_response(false, null, 'Campos obrigatórios ausentes.', 422);
  }

  $st = $pdo->prepare("
    INSERT INTO alunos (turma_id, nome, responsavel, status)
    VALUES (:t, :n, :r, 'ativo')
  ");
  $st->execute([':t' => $turma_id, ':n' => $nome, ':r' => $responsavel]);

  json_response(true, ['id' => $pdo->lastInsertId()], 'Aluno cadastrado.');
  exit;
}

// Se for GET, lista os alunos da turma
$turmaId = isset($_GET['turma_id']) ? (int)$_GET['turma_id'] : 0;
if ($turmaId <= 0) {
  json_response(false, null, 'turma_id obrigatório', 422);
}

$st = $pdo->prepare("
  SELECT id, nome, responsavel, status
  FROM alunos
  WHERE turma_id = :t
  ORDER BY nome
");
$st->execute([':t' => $turmaId]);
json_response(true, ['alunos' => $st->fetchAll()]);
