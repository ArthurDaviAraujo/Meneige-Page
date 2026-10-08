<?php
require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
require_auth();

$in = input_json();
$turma_id = (int)($in['turma_id'] ?? 0);
if (!$turma_id) json_response(false, null, 'Turma inválida', 400);

try {
  $pdo = pdo();
  $st = $pdo->prepare("SELECT id, nome, responsavel, status FROM alunos WHERE turma_id = ? ORDER BY nome");
  $st->execute([$turma_id]);
  $alunos = $st->fetchAll(PDO::FETCH_ASSOC);
  json_response(true, $alunos);
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao listar alunos: ' . $e->getMessage());
}
