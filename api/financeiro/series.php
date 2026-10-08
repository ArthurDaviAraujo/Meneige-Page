<?php
// /api/financeiro/series.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
$pdo = pdo();

$method = $_SERVER['REQUEST_METHOD'];

/* =========================================================
   GET — Listar séries e valores (mensalidade, extras, refeições)
   ========================================================= */
if ($method === 'GET') {
  $segmento_id = $_GET['segmento_id'] ?? null;

  $sql = "SELECT 
      s.id,
      s.nome,
      COALESCE(p1.valor,0) AS mensalidade,
      COALESCE(p2.valor,0) AS valor_hora_extra,
      COALESCE(p3.valor,0) AS valor_refeicao,
      COALESCE(p4.valor,0) AS valor_refeicao_jantar
    FROM series s
    LEFT JOIN precos p1 ON p1.chave = CONCAT('mensal.', s.codigo)
    LEFT JOIN precos p2 ON p2.chave = 'hora.extra'
    LEFT JOIN precos p3 ON p3.chave = 'refeicao.almoco'
    LEFT JOIN precos p4 ON p4.chave = 'refeicao.jantar'";

  if ($segmento_id) $sql .= " WHERE s.segment_id = :seg";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($segmento_id ? ['seg' => $segmento_id] : []);
  $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

  json_response(true, ['items' => $items]);
  exit;
}

/* =========================================================
   POST — Atualizar preços sem sobrescrever os globais
   ========================================================= */
if ($method === 'POST') {
  $data = input_json();
  $id = $data['id'] ?? null;
  if (!$id) json_response(false, null, 'ID ausente');

  $stmt = $pdo->prepare("SELECT codigo FROM series WHERE id = ?");
  $stmt->execute([$id]);
  $serie = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$serie) json_response(false, null, 'Série não encontrada');

  $codigo = $serie['codigo'];
  $campos = [];

  // Só atualiza os campos realmente informados
  if (isset($data['mensalidade']) && $data['mensalidade'] !== '') {
    $campos["mensal.$codigo"] = (float)$data['mensalidade'];
  }
  if (isset($data['valor_hora_extra']) && $data['valor_hora_extra'] !== '') {
    $campos["hora.extra"] = (float)$data['valor_hora_extra'];
  }
  if (isset($data['valor_refeicao']) && $data['valor_refeicao'] !== '') {
    $campos["refeicao.almoco"] = (float)$data['valor_refeicao'];
  }
  if (isset($data['valor_refeicao_jantar']) && $data['valor_refeicao_jantar'] !== '') {
    $campos["refeicao.jantar"] = (float)$data['valor_refeicao_jantar'];
  }

  if (!$campos) {
    json_response(true, ['ok' => true], 'Nada para atualizar.');
  }

  $stmt = $pdo->prepare("
    INSERT INTO precos (chave, valor)
    VALUES (:chave, :valor)
    ON DUPLICATE KEY UPDATE valor = VALUES(valor)
  ");

  foreach ($campos as $chave => $valor) {
    $stmt->execute(['chave' => $chave, 'valor' => $valor]);
  }

  json_response(true, ['ok' => true], 'Preço(s) atualizado(s) com sucesso.');
  exit;
}

/* =========================================================
   Método não permitido
   ========================================================= */
http_response_code(405);
json_response(false, null, 'Método não permitido');
