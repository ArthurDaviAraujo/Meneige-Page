<?php
// /api/calc/quote_pdf.php
declare(strict_types=1);

require_once __DIR__ . '/_calc.php';

// === Autoload do Composer (raiz/vendor/autoload.php) ===
$autoload = realpath(__DIR__ . '/../../vendor/autoload.php');
if ($autoload && is_file($autoload)) {
  require_once $autoload;
}

require_method('POST');
require_auth();

if (!class_exists(\Dompdf\Dompdf::class)) {
  header('Content-Type: application/json', true, 501);
  echo json_encode(['ok'=>false, 'message'=>'PDF indisponível: instale dompdf/dompdf (composer require dompdf/dompdf)']);
  exit;
}

function brl($v){ return 'R$ '.number_format((float)$v, 2, ',', '.'); }

$in  = input_json();
$pdo = pdo();

try {
  $data = calc_quote($in, $pdo);
} catch (Throwable $e) {
  json_response(false, null, $e->getMessage(), 400);
}

$h   = $data['totais'];
$hd  = $data['totais_com_desconto'];
$serie   = htmlspecialchars($data['serie']);
$descPct = (string)$hd['desconto_global_pct'];
$descVal = brl($hd['desconto_global_val']);

$projectRoot = realpath(__DIR__ . '/../../');
$logoPathAbs = $projectRoot . '/uploads/logo.png';
$logoExists  = is_file($logoPathAbs);

$logoTag = $logoExists
  ? '<img src="/uploads/logo.png" style="height:42px">'
  : '<strong>Meneiger Page</strong>';

/* ================================
   Pré-formatar valores BRL
================================ */
$fmt = [
  'mensal'           => brl($h['mensal']),
  'extras'           => brl($h['extras']),
  'almoco'           => brl($h['almoco']),
  'jantar'           => brl($h['jantar']),
  'tabela'           => brl($h['tabela']),
  'mensal_d'         => brl($hd['mensal']),
  'extras_d'         => brl($hd['extras']),
  'almoco_d'         => brl($hd['almoco']),
  'jantar_d'         => brl($hd['jantar']),
  'final'            => brl($hd['final']),
  'hora_extra'       => brl($data['valores']['hora_extra'] ?? 0),
  'refeicao_almoco'  => brl($data['valores']['refeicao_almoco'] ?? 0),
  'refeicao_jantar'  => brl($data['valores']['refeicao_jantar'] ?? 0),
];

/* ================================
   HTML do relatório (atualizado)
================================ */
$html = <<<HTML
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  body{font-family:'DejaVu Sans', Arial, sans-serif;font-size:12px;color:#111;margin:26px;}
  .head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:16px}
  .ttl{font-size:20px;font-weight:700}
  .muted{color:#666}
  h3{margin:14px 0 6px;font-size:14px;color:#111;border-bottom:1px solid #ddd;padding-bottom:3px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th,td{padding:7px 8px;border-bottom:1px solid #eee;text-align:right;vertical-align:middle}
  th:first-child, td:first-child{text-align:left}
  .sum{font-weight:700;background:#f9f9f9}
  .grand{font-weight:700;font-size:15px;background:#f2f2f2}
  .small{font-size:11px;color:#555}
  .right{text-align:right}
  .per-month{font-size:11px;color:#777;margin-top:-3px}
</style>
</head>
<body>
  <div class="head">
    <div>{$logoTag}</div>
    <div>
      <div class="ttl">Proposta — Horário Integral</div>
      <div class="muted">Série: <strong>{$serie}</strong> • Base diária: {$data['base_horas_dia']}h</div>
    </div>
  </div>

  <h3>Valores de Tabela</h3>
  <table>
    <tr><th>Item</th><th>Cálculo</th><th>Valor</th></tr>
    <tr>
      <td>Mensalidade</td>
      <td>—</td>
      <td><strong>{$fmt['mensal']}</strong><div class="per-month">(por mês)</div></td>
    </tr>
    <tr>
      <td>Horas Extras ({$h['horas_extras_mes']}h/mês)</td>
      <td>{$h['horas_extras_mes']} × {$fmt['hora_extra']} = {$fmt['extras']}</td>
      <td><strong>{$fmt['extras']}</strong><div class="per-month">(por mês)</div></td>
    </tr>
    <tr>
      <td>Almoços ({$h['qtd_almocos_mes']} dias/mês)</td>
      <td>{$h['qtd_almocos_mes']} × {$fmt['refeicao_almoco']} = {$fmt['almoco']}</td>
      <td><strong>{$fmt['almoco']}</strong><div class="per-month">(por mês)</div></td>
    </tr>
    <tr>
      <td>Jantares ({$h['qtd_jantares_mes']} dias/mês)</td>
      <td>{$h['qtd_jantares_mes']} × {$fmt['refeicao_jantar']} = {$fmt['jantar']}</td>
      <td><strong>{$fmt['jantar']}</strong><div class="per-month">(por mês)</div></td>
    </tr>
    <tr class="sum">
      <td>Subtotal (Tabela)</td><td></td><td><strong>{$fmt['tabela']}</strong><div class="per-month">(mensal)</div></td>
    </tr>
  </table>

  <h3>Descontos & Totais</h3>
  <table>
    <tr><td>Mensalidade c/ desconto</td><td>{$fmt['mensal_d']}</td></tr>
    <tr><td>Extras c/ desconto</td><td>{$fmt['extras_d']}</td></tr>
    <tr><td>Almoços c/ desconto</td><td>{$fmt['almoco_d']}</td></tr>
    <tr><td>Jantares c/ desconto</td><td>{$fmt['jantar_d']}</td></tr>
    <tr><td class="small">Desconto Global</td><td class="small">{$descPct}% ({$descVal})</td></tr>
    <tr class="grand"><td>Valor Final</td><td><strong>{$fmt['final']}</strong><div class="per-month">(mensal)</div></td></tr>
  </table>

  <p class="small">* Esta é uma simulação de orçamento. Todos os valores são mensais e sujeitos a atualização.</p>
</body>
</html>
HTML;

/* ================================
   Gerar o PDF
================================ */
use Dompdf\Dompdf;
use Dompdf\Options;

$opt = new Options();
$opt->set('isRemoteEnabled', true);
$opt->setChroot($projectRoot);

$dompdf = new Dompdf($opt);
$dompdf->setBasePath($projectRoot);
$dompdf->loadHtml($html, 'UTF-8');
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();

$filename = 'Proposta-Horario-Integral.pdf';
header('Content-Type: application/pdf');
header("Content-Disposition: inline; filename=\"$filename\"");
echo $dompdf->output();
exit;
