<?php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';
// opcional: require_login();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'GET') {
  header('Allow: GET');
  json_response(false, null, 'Método não permitido', 405);
}

try {
  $pdo = pdo();

  // Filtros opcionais: ?curso_turma_id=123&data=YYYY-MM-DD
  $cursoTurmaId = isset($_GET['curso_turma_id']) ? (int)$_GET['curso_turma_id'] : null;
  $dataRef = $_GET['data'] ?? date('Y-m-d');

  // ---------- BASE: alunos matriculados em curso_turmas ativas ----------
  $sql = "
    SELECT 
      a.id   AS aluno_id,
      a.nome AS aluno,
      ct.id  AS curso_turma_id,
      c.nome AS curso
    FROM matriculas_curso mc
    INNER JOIN alunos a        ON a.id = mc.aluno_id
    INNER JOIN curso_turmas ct ON ct.id = mc.curso_turma_id AND ct.ativo = 1
    INNER JOIN cursos c        ON c.id = ct.curso_id AND c.ativo = 1
    WHERE mc.status = 'ativa'
  ";
  $params = []; // <<< NÃO inclua :dataref aqui (não existe placeholder)
  if ($cursoTurmaId) {
    $sql .= " AND ct.id = :ctid";
    $params[':ctid'] = $cursoTurmaId;
  }
  $sql .= " ORDER BY c.nome ASC, a.nome ASC";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $base = $stmt->fetchAll();

  // ---------- PRESENÇAS DO DIA (se a tabela existir) ----------
  $statusByKey = []; // chave: "{$aluno_id}-{$curso_turma_id}"
  try {
    $whereCT = $cursoTurmaId ? " AND p.curso_turma_id = :ctid2" : "";
    $stmtP = $pdo->prepare("
      SELECT p.aluno_id, p.curso_turma_id, p.status
      FROM curso_presencas p
      WHERE p.data = :dataref {$whereCT}
    ");
    $bind = [':dataref' => $dataRef];
    if ($cursoTurmaId) { $bind[':ctid2'] = $cursoTurmaId; }
    $stmtP->execute($bind);
    foreach ($stmtP->fetchAll() as $r) {
      $statusByKey[$r['aluno_id'].'-'.$r['curso_turma_id']] = $r['status']; // 'P','F','J'
    }
  } catch (Throwable $ignore) {
    // tabela pode não existir ainda — ignora
  }

  // ---------- Monta payload para o front ----------
  $linhas = [];
  foreach ($base as $r) {
    $key = $r['aluno_id'].'-'.$r['curso_turma_id'];
    $linhas[] = [
      // id fica vazio (PUT opcional ainda)
      'id'             => null,
      'aluno'          => $r['aluno'],
      'curso'          => $r['curso'],
      'data'           => $dataRef,
      'status'         => $statusByKey[$key] ?? null,
      'aluno_id'       => (int)$r['aluno_id'],
      'curso_turma_id' => (int)$r['curso_turma_id'],
    ];
  }

  // lista de cursos (para popular o <select>)
  $cursos = array_values(array_unique(array_map(fn($r) => $r['curso'], $base)));

  json_response(true, [
    'linhas' => $linhas,
    'cursos' => array_map(fn($n) => ['nome' => $n], $cursos),
    'data'   => $dataRef
  ]);
} catch (Throwable $e) {
  json_response(false, null, 'Falha ao carregar chamada: ' . $e->getMessage(), 500);
}
