<?php
require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
require_auth();

$in = input_json();
$aluno_id = (int)($in['aluno_id'] ?? 0);
if (!$aluno_id) json_response(false, null, 'Aluno inválido', 400);

try {
  $pdo = pdo();
  $st = $pdo->prepare("SELECT dia_semana, entrada, saida, almoco, jantar
                       FROM aluno_rotina
                       WHERE aluno_id = ?
                       ORDER BY dia_semana ASC");
  $st->execute([$aluno_id]);
  $dados = $st->fetchAll(PDO::FETCH_ASSOC);
  json_response(true, $dados);
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao carregar rotina: ' . $e->getMessage());
}
