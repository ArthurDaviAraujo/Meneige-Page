<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

$id = (int)($_GET['id'] ?? 0);
if (!$id) json_response(false, null, 'ID inválido.', 400);

try {
  $pdo = pdo();

  $sql = "
    SELECT
      a.id,
      a.nome,
      a.responsavel,
      a.turma_id,
      t.series_id     AS serie_id,
      s.segment_id    AS segmento_id,
      COALESCE(ar.entrada, '') AS hora_entrada,
      COALESCE(ar.saida, '')   AS hora_saida,
      COALESCE(ar.almoco, 0)   AS almoco,
      COALESCE(ar.jantar, 0)   AS jantar,
      COALESCE(mc.curso_turma_id, NULL) AS curso_extra_id
    FROM alunos a
      LEFT JOIN turmas t         ON t.id = a.turma_id
      LEFT JOIN series s         ON s.id = t.series_id
      LEFT JOIN aluno_rotina ar  ON ar.aluno_id = a.id
      LEFT JOIN matriculas_curso mc ON mc.aluno_id = a.id AND mc.status = 'ativa'
    WHERE a.id = ?
    ORDER BY ar.dia_semana ASC
    LIMIT 1
  ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute([$id]);
  $data = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$data) {
    json_response(false, null, 'Aluno não encontrado.', 404);
  }

  json_response(true, $data);

} catch (Throwable $e) {
  json_response(false, null, 'Erro ao buscar aluno: ' . $e->getMessage(), 500);
}
