<?php
// /api/relatorios/logs.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
require_auth();

$pdo = pdo();
$in  = input_any();

/*
Payload aceito:
{
  "acao": "create|update|delete|login|export|...",
  "user_id": 123,              // preferível
  "user_q": "Administrador",   // opcional (nome ou email, LIKE)
  "data_ini": "YYYY-MM-DD",    // opcional
  "data_fim": "YYYY-MM-DD"     // opcional (inclusivo)
}
*/

$acao    = trim((string)($in['acao'] ?? ''));          // '' = qualquer
$userId  = (int)($in['user_id'] ?? 0);
$userQ   = trim((string)($in['user_q'] ?? ''));
$dtIni   = trim((string)($in['data_ini'] ?? ''));
$dtFim   = trim((string)($in['data_fim'] ?? ''));

$sql = "
  SELECT 
    a.id,
    a.created_at        AS dt,
    a.acao,
    a.entidade,
    a.entidade_id,
    a.diffs,
    u.id                AS user_id,
    u.nome              AS user_nome,
    u.email             AS user_email
  FROM audit_logs a
  LEFT JOIN users u ON u.id = a.user_id
  WHERE 1=1
";
$params = [];

// Filtro ação (se vier vazio, ignora)
if ($acao !== '') {
  $sql .= " AND a.acao = :acao ";
  $params[':acao'] = $acao;
}

// Filtro por usuário (prioriza user_id)
if ($userId > 0) {
  $sql .= " AND a.user_id = :uid ";
  $params[':uid'] = $userId;
} elseif ($userQ !== '') {
  $sql .= " AND (u.nome LIKE :uq OR u.email LIKE :uq) ";
  $params[':uq'] = '%'.$userQ.'%';
}

// Datas (inclusivo)
if ($dtIni !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dtIni)) {
  $sql .= " AND a.created_at >= :dti ";
  $params[':dti'] = $dtIni . ' 00:00:00';
}
if ($dtFim !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dtFim)) {
  // inclusivo no dia final
  $sql .= " AND a.created_at < :dtf ";
  $params[':dtf'] = date('Y-m-d H:i:s', strtotime($dtFim . ' 23:59:59'));
}

$sql .= " ORDER BY a.created_at DESC LIMIT 1000";

$st = $pdo->prepare($sql);
$st->execute($params);
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

// Mapeia para o formato esperado pelo front
$out = array_map(function($r){
  return [
    'dt'       => date('d/m/Y H:i', strtotime($r['dt'])),
    'user'     => $r['user_nome'] ? ($r['user_nome'].' <'.$r['user_email'].'>') : ($r['user_email'] ?: '—'),
    'acao'     => $r['acao'],
    'detalhes' => $r['entidade'] . ($r['entidade_id'] ? " #".$r['entidade_id'] : ''),
    'origem'   => 'Sistema', // ajuste se você guarda origem separada
  ];
}, $rows);

json_response(true, ['items'=>$out]);
