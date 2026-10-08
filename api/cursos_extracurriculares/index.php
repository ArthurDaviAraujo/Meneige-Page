<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

try {
  $pdo = pdo();
  $stmt = $pdo->query("
    SELECT
      c.id              AS curso_id,
      c.nome            AS curso_nome,
      c.preco_mensal    AS curso_preco_mensal,
      c.ativo           AS curso_ativo,
      c.professor_nome  AS professor_nome,
      c.dias_horarios   AS dias_horarios
    FROM cursos c
    ORDER BY c.id DESC
    LIMIT 200
  ");
  $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

  json_response(true, ['items' => $items, 'limit'=>200, 'offset'=>0]);
} catch (Throwable $e) {
  json_response(false, null, 'Falha ao listar cursos', 500);
}
