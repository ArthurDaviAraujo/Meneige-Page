<?php
declare(strict_types=1);
require_once __DIR__ . '/_core/bootstrap.php';
require_auth();

$pdo = pdo();

// Obtém filtros da query string (?acao=update&busca=turma)
$acao  = $_GET['acao']  ?? '';
$busca = trim($_GET['busca'] ?? '');

// Monta SQL base
$sql = "
  SELECT a.id, a.acao, a.entidade, a.entidade_id, a.diffs, a.created_at,
         u.nome AS usuario
  FROM audit_logs a
  LEFT JOIN users u ON u.id = a.user_id
  WHERE 1
";

// Filtro por tipo de ação
$params = [];
if ($acao !== '') {
  $sql .= " AND a.acao = :acao";
  $params[':acao'] = $acao;
}

// Filtro por texto (busca)
if ($busca !== '') {
  $sql .= " AND (
    a.entidade LIKE :b OR
    u.nome LIKE :b OR
    JSON_EXTRACT(a.diffs, '$.descricao') LIKE :b
  )";
  $params[':b'] = "%{$busca}%";
}

$sql .= " ORDER BY a.id DESC LIMIT 200";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$logs = [];
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
  // Tenta extrair a descrição do JSON
  $diffs = json_decode($row['diffs'] ?? '{}', true);
  $descricao = $diffs['descricao'] ?? (
    is_string($diffs) ? $diffs : json_encode($diffs, JSON_UNESCAPED_UNICODE)
  );

  // Define texto padrão com base na ação
  $textoBase = match($row['acao']) {
    'create' => 'criou registro em',
    'update' => 'atualizou informações em',
    'delete' => 'excluiu registro de',
    'import' => 'importou dados para',
    default  => 'executou ação em'
  };

  $logs[] = [
    'usuario' => $row['usuario'] ?? 'Sistema',
    'acao'    => $row['acao'],
    'texto'   => $descricao ? $descricao : "{$row['usuario']} {$textoBase} {$row['entidade']}",
    'data'    => date('d/m H:i', strtotime($row['created_at']))
  ];
}

json_response(true, $logs);
