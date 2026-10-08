<?php
// /api/relatorios/cursos.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
$auth = function_exists('require_auth') ? require_auth() : null;

try { $pdo = pdo(); }
catch (Throwable $e) { json_response(false, null, 'Falha ao conectar no banco', 500); }

/* ========= Config/Constantes (ajuste se o nome da tabela for outro) ========= */
const TBL_CURSO_PRESENCAS = 'curso_presencas'; // cols: id, aluno_id, curso_id, data (DATE), status('presente'|'ausente'), created_at, updated_at

$in = input_any();
$modo = ($in['modo'] ?? 'curso') === 'aluno' ? 'aluno' : 'curso';

/* ===================== MODO: POR CURSO ===================== */
if ($modo === 'curso') {
  $cursoId     = isset($in['curso_id']) && $in['curso_id'] !== '' ? (int)$in['curso_id'] : null;
  $professorId = isset($in['professor_id']) && $in['professor_id'] !== '' ? (int)$in['professor_id'] : null;
  $periodo     = isset($in['periodo']) ? (string)$in['periodo'] : ''; // YYYY-MM

  // Base: matriculas_curso (ativa|trancada|cancelada) + cursos + curso_turmas + professores + alunos
  $sql = "
    SELECT
      p.nome   AS professor,
      a.nome   AS aluno,
      a.responsavel AS responsavel,
      m.status AS status,
      COALESCE(c.preco_mensal, 0) AS valor
    FROM matriculas_curso m
    INNER JOIN alunos a        ON a.id = m.aluno_id
    INNER JOIN curso_turmas ct ON ct.id = m.curso_turma_id
    INNER JOIN cursos c        ON c.id  = ct.curso_id
    LEFT  JOIN professores p   ON p.id  = ct.professor_id
    WHERE 1=1
  ";
  $params = [];
  if (!empty($cursoId))     { $sql .= " AND ct.curso_id = :cid ";   $params[':cid'] = $cursoId; }
  if (!empty($professorId)) { $sql .= " AND ct.professor_id = :pid "; $params[':pid'] = $professorId; }

  $sql .= " ORDER BY p.nome, a.nome ";

  try {
    $st = $pdo->prepare($sql);
    foreach ($params as $k=>$v) $st->bindValue($k, $v);
    $st->execute();
    $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
  } catch (Throwable $e) {
    json_response(false, null, 'Erro ao consultar matrículas', 500);
  }

  // Formatação + total
  $total = 0.0;
  foreach ($rows as &$r) {
    $total += (float)$r['valor'];
    // valor monetário sai "cru" para o front formatar; se quiser, converta aqui
  }

  // Se foi informado período (YYYY-MM), podemos apurar presenças do mês para pizza no front se necessário
  $pizza = null;
  if ($periodo && preg_match('/^\d{4}-\d{2}$/', $periodo)) {
    $ini = $periodo . '-01';
    $fim = date('Y-m-t', strtotime($ini)); // último dia do mês
    // Distribuição de presenças por status no mês (somente do curso filtrado, se houver)
    $sqlP = "
      SELECT status, COUNT(*) AS qtd
      FROM ".TBL_CURSO_PRESENCAS."
      WHERE data BETWEEN :di AND :df
    ";
    $paramsP = [':di'=>$ini, ':df'=>$fim];
    if (!empty($cursoId)) { $sqlP .= " AND curso_id = :cid "; $paramsP[':cid'] = $cursoId; }
    try {
      $stp = $pdo->prepare($sqlP);
      foreach ($paramsP as $k=>$v) $stp->bindValue($k, $v);
      $stp->execute();
      $pizzaRaw = $stp->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
      if ($pizzaRaw) {
        $labels = array_keys($pizzaRaw);
        $data   = array_values(array_map('intval', $pizzaRaw));
        $pizza = ['labels'=>$labels, 'data'=>$data];
      }
    } catch (Throwable $e) { /* silencioso */ }
  }

  json_response(true, [
    'items' => $rows,
    'total' => round($total, 2),
    'pizza' => $pizza
  ]);
  exit;
}

/* ===================== MODO: POR ALUNO ===================== */
$alunoQ  = isset($in['aluno_q']) ? trim((string)$in['aluno_q']) : '';
$dataIni = isset($in['data_ini']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$in['data_ini']) ? (string)$in['data_ini'] : null;
$dataFim = isset($in['data_fim']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$in['data_fim']) ? (string)$in['data_fim'] : null;

$sql = "
  SELECT
    a.id     AS aluno_id,
    a.nome   AS aluno,
    a.responsavel AS responsavel,
    COUNT(DISTINCT m.curso_turma_id) AS cursos_presentes,
    COALESCE(p.nome, '') AS professor
  FROM alunos a
  LEFT JOIN matriculas_curso m ON m.aluno_id = a.id AND m.status = 'ativa'
  LEFT JOIN curso_turmas ct    ON ct.id = m.curso_turma_id
  LEFT JOIN professores p      ON p.id = ct.professor_id
  WHERE 1=1
";
$params = [];
if ($alunoQ !== '') { $sql .= " AND a.nome LIKE :aq "; $params[':aq'] = '%'.$alunoQ.'%'; }
$sql .= " GROUP BY a.id, a.nome, a.responsavel, p.nome
          ORDER BY a.nome ";

try {
  $st = $pdo->prepare($sql);
  foreach ($params as $k=>$v) $st->bindValue($k, $v);
  $st->execute();
  $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {
  json_response(false, null, 'Erro ao buscar alunos', 500);
}

/* Pizza de presenças por curso para o intervalo (opcional) */
$pizza = null;
if ($dataIni && $dataFim) {
  $sqlP = "
    SELECT c.nome AS curso, COUNT(*) AS qtd
    FROM ".TBL_CURSO_PRESENCAS." pc
    INNER JOIN cursos c ON c.id = pc.curso_id
    WHERE pc.status = 'presente' AND pc.data BETWEEN :di AND :df
  ";
  $paramsP = [':di'=>$dataIni, ':df'=>$dataFim];
  if ($alunoQ !== '') {
    // restringe por alunos que batem com o filtro
    $sqlP .= " AND pc.aluno_id IN (SELECT id FROM alunos WHERE nome LIKE :aq) ";
    $paramsP[':aq'] = '%'.$alunoQ.'%';
  }
  $sqlP .= " GROUP BY c.id, c.nome ORDER BY c.nome ";

  try {
    $stp = $pdo->prepare($sqlP);
    foreach ($paramsP as $k=>$v) $stp->bindValue($k, $v);
    $stp->execute();
    $raw = $stp->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
    if ($raw) {
      $pizza = ['labels'=>array_keys($raw), 'data'=>array_values(array_map('intval',$raw))];
    }
  } catch (Throwable $e) { /* ignora */ }
}

json_response(true, ['items'=>$rows, 'pizza'=>$pizza]);
