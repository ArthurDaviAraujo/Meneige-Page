<?php
declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../_core/bootstrap.php';
require_auth();

// Dependências do projeto.
require_once __DIR__ . '/../../../vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;

$pdo = pdo();

// ----------------------
// Parâmetros GET
// ----------------------
$tipo = trim($_GET['tipo'] ?? '');
$de   = trim($_GET['de'] ?? '');
$ate  = trim($_GET['ate'] ?? '');

// ----------------------
// Filtros dinâmicos
// ----------------------
$where = [];
$params = [];

if ($tipo !== '') {
  $where[] = 'a.acao = :acao';
  $params[':acao'] = $tipo;
}
if ($de !== '') {
  $where[] = 'a.created_at >= :de';
  $params[':de'] = $de . ' 00:00:00';
}
if ($ate !== '') {
  $where[] = 'a.created_at <= :ate';
  $params[':ate'] = $ate . ' 23:59:59';
}

$sql = "
  SELECT 
    u.nome AS usuario,
    a.acao,
    a.entidade,
    a.entidade_id,
    a.diffs,
    a.created_at
  FROM audit_logs a
  LEFT JOIN users u ON u.id = a.user_id
";

if ($where) {
  $sql .= " WHERE " . implode(' AND ', $where);
}

$sql .= " ORDER BY a.created_at DESC";

// ----------------------
// Execução segura
// ----------------------
try {
  $st = $pdo->prepare($sql);
  $st->execute($params);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
  echo '<pre>Erro SQL: ' . $e->getMessage() . '</pre>';
  exit;
}

// ----------------------
// Montagem do HTML
// ----------------------
$periodo = ($de && $ate)
  ? "De " . date('d/m/Y', strtotime($de)) . " até " . date('d/m/Y', strtotime($ate))
  : "Período completo";

$tipoLabel = match($tipo) {
  'create' => 'Criações',
  'update' => 'Atualizações',
  'delete' => 'Exclusões',
  'import' => 'Importações',
  default  => 'Todos os tipos'
};

$html = '
<style>
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #333; }
  h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
  h3 { text-align: center; color: #555; font-weight: normal; margin-top: 0; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #ccc; padding: 5px 6px; vertical-align: top; }
  th { background: #f0f0f0; font-weight: bold; }
  tr:nth-child(even) { background: #fafafa; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-size: 9px; line-height: 1.2; color:#333; margin:0; }
  .footer { text-align: right; margin-top: 20px; font-size: 9px; color: #888; }
</style>

<h1>Relatório de Auditoria</h1>
<h3>' . htmlspecialchars($tipoLabel, ENT_QUOTES, 'UTF-8') . ' — ' . htmlspecialchars($periodo, ENT_QUOTES, 'UTF-8') . '</h3>

<table>
  <thead>
    <tr>
      <th style="width:18%">Usuário</th>
      <th style="width:10%">Ação</th>
      <th style="width:14%">Entidade</th>
      <th style="width:8%">ID</th>
      <th style="width:40%">Resumo</th>
      <th style="width:10%">Data/Hora</th>
    </tr>
  </thead>
  <tbody>';

// ----------------------
// Conteúdo da tabela
// ----------------------
if (!$rows) {
  $html .= '<tr><td colspan="6" style="text-align:center;color:#999">Nenhuma ocorrência encontrada</td></tr>';
} else {
  foreach ($rows as $r) {
    $diff = '';
    if (!empty($r['diffs'])) {
      try {
        $decoded = json_decode((string)$r['diffs'], true, 512, JSON_THROW_ON_ERROR);
        $diff = substr(print_r($decoded, true), 0, 800);
      } catch (Throwable $e) {
        $diff = substr(strip_tags((string)$r['diffs']), 0, 800);
      }
    }

    $html .= '<tr>
      <td>' . htmlspecialchars($r['usuario'] ?: '—', ENT_QUOTES, 'UTF-8') . '</td>
      <td>' . htmlspecialchars(ucfirst($r['acao']), ENT_QUOTES, 'UTF-8') . '</td>
      <td>' . htmlspecialchars($r['entidade'], ENT_QUOTES, 'UTF-8') . '</td>
      <td>' . htmlspecialchars((string)$r['entidade_id'], ENT_QUOTES, 'UTF-8') . '</td>
      <td><pre>' . htmlspecialchars($diff, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</pre></td>
      <td>' . date('d/m/Y H:i', strtotime($r['created_at'])) . '</td>
    </tr>';
  }
}

$html .= '</tbody></table>
<div class="footer">Gerado em ' . date('d/m/Y H:i') . '</div>';

// ----------------------
// DOMPDF (com try/catch)
// ----------------------
try {
  $options = new Options();
  $options->set('isHtml5ParserEnabled', true);
  $options->set('isRemoteEnabled', true);
  $options->set('defaultFont', 'DejaVu Sans');

  $dompdf = new Dompdf($options);
  $dompdf->loadHtml(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
  $dompdf->setPaper('A4', 'landscape');
  $dompdf->render();
  $dompdf->stream('relatorio_auditoria.pdf', ['Attachment' => false]);
} catch (Throwable $e) {
  echo "<pre>Erro ao gerar PDF:\n" . $e->getMessage() . "\n\nTrace:\n" . $e->getTraceAsString() . "</pre>";
}
exit;
