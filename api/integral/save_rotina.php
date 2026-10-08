<?php
require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
require_auth();

$in = input_json();
$aluno_id = (int)($in['aluno_id'] ?? 0);
$rotina = $in['rotina'] ?? [];
if (!$aluno_id || !is_array($rotina)) json_response(false, null, 'Dados inválidos', 400);

try {
  $pdo = pdo();
  $pdo->beginTransaction();

  $del = $pdo->prepare("DELETE FROM aluno_rotina WHERE aluno_id = ?");
  $del->execute([$aluno_id]);

  $ins = $pdo->prepare("INSERT INTO aluno_rotina (aluno_id, dia_semana, entrada, saida, almoco, jantar)
                        VALUES (?, ?, ?, ?, ?, ?)");

  foreach ($rotina as $dia => $dados) {
    $entrada = $dados['entrada'] ?? null;
    $saida   = $dados['saida'] ?? null;
    $almoco  = !empty($dados['almoco']) ? 1 : 0;
    $jantar  = !empty($dados['jantar']) ? 1 : 0;

    $ins->execute([$aluno_id, $dia, $entrada, $saida, $almoco, $jantar]);
  }

  $pdo->commit();
  json_response(true, null, 'Rotina salva com sucesso!');
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  json_response(false, null, 'Erro ao salvar rotina: ' . $e->getMessage());
}
