<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../_core/log_helper.php';

require_auth();
$pdo = pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = (int)($_GET['id'] ?? 0);

if ($id <= 0) json_response(false, null, 'ID inválido.', 400);

/* ===========================
   1) OBTÉM CURSO (GET)
=========================== */
if ($method === 'GET') {
  $stmt = $pdo->prepare("SELECT * FROM cursos WHERE id = ?");
  $stmt->execute([$id]);
  $item = $stmt->fetch(PDO::FETCH_ASSOC);
  json_response(true, ['item' => $item]);
  exit;
}

/* ===========================
   2) ATUALIZA CURSO (PUT/PATCH)
=========================== */
if (in_array($method, ['PUT','PATCH'], true)) {
  $in = input_any();

  $sets = [];
  $params = [':id' => $id];

  if (isset($in['nome'])) {
    $sets[] = 'nome = :nome';
    $params[':nome'] = trim((string)$in['nome']) ?: null;
  }
  if (isset($in['preco_mensal']) || isset($in['preco'])) {
    $valor = $in['preco_mensal'] ?? $in['preco'];
    $sets[] = 'preco_mensal = :preco';
    $params[':preco'] = ($valor === '' ? null : (float)$valor);
  }
  if (isset($in['professor']) || isset($in['professor_nome'])) {
    $p = $in['professor'] ?? $in['professor_nome'];
    $sets[] = 'professor_nome = :prof';
    $params[':prof'] = trim((string)$p) ?: null;
  }
  if (isset($in['horario']) || isset($in['dias_horarios'])) {
    $h = $in['horario'] ?? $in['dias_horarios'];
    $sets[] = 'dias_horarios = :hor';
    $params[':hor'] = trim((string)$h) ?: null;
  }
  if (isset($in['ativo'])) {
    $sets[] = 'ativo = :ativo';
    $params[':ativo'] = (int)((bool)$in['ativo']);
  }

  if (!$sets) json_response(true, ['updated' => 0], 'Nada para atualizar.');

  // Busca antes e depois
  $old = $pdo->prepare("SELECT * FROM cursos WHERE id = ?");
  $old->execute([$id]);
  $before = $old->fetch(PDO::FETCH_ASSOC);

  $sql = "UPDATE cursos SET " . implode(', ', $sets) . " WHERE id = :id";
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);

  $new = $pdo->prepare("SELECT * FROM cursos WHERE id = ?");
  $new->execute([$id]);
  $after = $new->fetch(PDO::FETCH_ASSOC);

  // Log
  $descricao = sprintf('Atualizou o curso "%s"', $before['nome']);
  registrar_log($pdo, 'update', 'cursos', $id, $descricao);

  json_response(true, ['updated' => $stmt->rowCount()], 'Curso atualizado com sucesso.');
  exit;
}

/* ===========================
   3) EXCLUI CURSO (DELETE)
=========================== */
if ($method === 'DELETE') {
  // Busca nome antes de excluir
  $check = $pdo->prepare("SELECT nome FROM cursos WHERE id = ?");
  $check->execute([$id]);
  $curso = $check->fetch(PDO::FETCH_ASSOC);

  if (!$curso) {
    json_response(false, null, 'Curso não encontrado.', 404);
  }

  // Soft delete
  $pdo->prepare("UPDATE cursos SET ativo = 0 WHERE id = ?")->execute([$id]);

  // Log
  $descricao = sprintf('Excluiu o curso "%s"', $curso['nome']);
  registrar_log($pdo, 'delete', 'cursos', $id, $descricao);

  json_response(true, ['deleted' => 1], 'Curso excluído com sucesso.');
  exit;
}

json_response(false, null, 'Método não suportado.', 405);
