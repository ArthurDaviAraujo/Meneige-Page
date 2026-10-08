<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../_core/log_helper.php';

require_method('POST');
require_auth();

$in = input_any(); // aceita JSON ou form-data

$nome      = trim((string)($in['nome'] ?? ''));
$preco     = $in['preco_mensal'] ?? ($in['preco'] ?? null);
$prof      = trim((string)($in['professor'] ?? ($in['professor_nome'] ?? '')));
$horario   = trim((string)($in['horario'] ?? ($in['dias_horarios'] ?? '')));

if ($nome === '') {
  json_response(false, null, 'O campo nome do curso é obrigatório.', 400);
}

try {
  $pdo = pdo();

  // Cria o curso
  $sql = "INSERT INTO cursos (nome, professor_nome, dias_horarios, preco_mensal, ativo)
          VALUES (:nome, :prof, :hor, :preco, 1)";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([
    ':nome'  => $nome,
    ':prof'  => ($prof !== '' ? $prof : null),
    ':hor'   => ($horario !== '' ? $horario : null),
    ':preco' => ($preco !== '' && $preco !== null ? (float)$preco : null),
  ]);

  $id = (int)$pdo->lastInsertId();

  // --- Descrição do log ---
  $descricao = sprintf(
    'Criou o curso "%s"%s%s',
    $nome,
    $prof ? " (Professor: {$prof})" : '',
    $horario ? " — Horário: {$horario}" : ''
  );

  // --- Registra no log ---
  registrar_log($pdo, 'create', 'cursos', $id, $descricao);

  json_response(true, ['id' => $id], 'Curso criado com sucesso.');

} catch (Throwable $e) {
  json_response(false, null, 'Falha ao criar curso: ' . $e->getMessage(), 500);
}
