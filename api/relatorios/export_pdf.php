<?php
// /api/relatorios/export_pdf.php
declare(strict_types=1);

/* Evita cabeçalhos JSON do bootstrap (render/stream de PDF) */
$GLOBALS['_no_json_header'] = true;

require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');

/* ===== Autoload do Dompdf ===== */
$VENDOR_AUTOLOAD = __DIR__ . '/../../vendor/autoload.php';
if (!class_exists(\Dompdf\Dompdf::class)) {
  if (file_exists($VENDOR_AUTOLOAD)) {
    require_once $VENDOR_AUTOLOAD;
  }
}
if (!class_exists(\Dompdf\Dompdf::class)) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['ok'=>false,'message'=>'Dompdf não encontrado. Instale com composer require dompdf/dompdf'], JSON_UNESCAPED_UNICODE);
  exit;
}

use Dompdf\Dompdf;
use Dompdf\Options;

/* ====== Entrada ====== */
$in = input_any();

$filename    = trim((string)($in['filename'] ?? 'relatorio_' . date('Ymd_His') . '.pdf'));
if (!preg_match('/\.pdf$/i', $filename)) $filename .= '.pdf';

$title       = trim((string)($in['title']    ?? 'Relatório'));
$subtitle    = trim((string)($in['subtitle'] ?? ''));
$footer      = trim((string)($in['footer']   ?? ''));
$logoUrl     = trim((string)($in['logo_url'] ?? ''));

$orientation = strtolower((string)($in['orientation'] ?? 'portrait'));
if (!in_array($orientation, ['portrait','landscape'], true)) $orientation = 'portrait';

$paper       = strtoupper((string)($in['paper'] ?? 'A4'));
$download    = isset($in['download']) ? (bool)$in['download'] : true;

$columns     = $in['columns'] ?? [];
$rows        = $in['rows']    ?? [];

if (!is_array($columns) || !is_array($rows) || empty($columns)) {
  http_response_code(422);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['ok'=>false, 'message'=>'Payload inválido: columns[] e rows[] são obrigatórios.'], JSON_UNESCAPED_UNICODE);
  exit;
}

/* Normaliza columns */
$normCols = [];
foreach ($columns as $i => $c) {
  if (is_array($c)) {
    $key   = isset($c['key'])   ? (string)$c['key']   : ('col_'.$i);
    $label = isset($c['label']) ? (string)$c['label'] : $key;
    $align = isset($c['align']) ? (string)$c['align'] : 'left'; // opcional
    $width = isset($c['width']) ? (string)$c['width'] : null;   // ex "80px" ou "20%"
  } else {
    $key = is_string($c) ? $c : ('col_'.$i);
    $label = $key;
    $align = 'left'; $width = null;
  }
  $normCols[] = ['key'=>$key,'label'=>$label,'align'=>$align,'width'=>$width];
}

/* ====== HTML/CSS ====== */
$escape = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

$thead = '';
foreach ($normCols as $col) {
  $style = $col['width'] ? ' style="width:'.$escape($col['width']).'"' : '';
  $thead .= '<th'.$style.'>'. $escape($col['label']) .'</th>';
}

$tbody = '';
foreach ($rows as $r) {
  $tbody .= '<tr>';
  foreach ($normCols as $col) {
    $val = '';
    if (is_array($r) && array_key_exists($col['key'], $r)) $val = $r[$col['key']];
    $align = in_array($col['align'], ['left','center','right'], true) ? $col['align'] : 'left';
    $tbody .= '<td class="a-'.$align.'">'. $escape($val) .'</td>';
  }
  $tbody .= '</tr>';
}

$logoHtml = $logoUrl ? '<img src="'.$escape($logoUrl).'" alt="logo" class="logo"/>' : '';

$css = <<<CSS
  @page { margin: 24px 26px 40px 26px; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Arial, "Helvetica Neue", sans-serif; }
  body { color: #111827; font-size: 12px; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .logo   { height: 34px; }
  h1 { font-size: 18px; margin: 0; }
  .subtitle { color:#6b7280; margin: 4px 0 10px; }
  .table-wrap { border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
  th { background: #f3f4f6; text-align: left; font-weight: 700; }
  tr:nth-child(even) td { background: #fafafa; }
  .a-left { text-align: left; } .a-center { text-align: center; } .a-right { text-align: right; }
  .footer { position: fixed; left:0; right:0; bottom: 0; color:#6b7280; font-size: 10px; text-align: right; padding: 6px 12px; border-top: 1px solid #e5e7eb; }
  .muted { color:#6b7280; }
CSS;

$html = <<<HTML
<!doctype html>
<html>
<head><meta charset="utf-8"><style>{$css}</style></head>
<body>
  <div class="header">
    {$logoHtml}
    <div>
      <h1>{$escape($title)}</h1>
      <div class="subtitle">{$escape($subtitle)}</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr>{$thead}</tr></thead>
      <tbody>{$tbody}</tbody>
    </table>
  </div>

  <div class="footer">{$escape($footer)} &nbsp;•&nbsp; Gerado em {date('d/m/Y H:i')}</div>
</body>
</html>
HTML;

/* ====== Render ====== */
$options = new Options();
$options->set('isRemoteEnabled', true);
$options->set('isHtml5ParserEnabled', true);
$options->set('defaultFont', 'Inter');

$dompdf = new Dompdf($options);
$dompdf->setPaper($paper, $orientation);
$dompdf->loadHtml($html, 'UTF-8');
$dompdf->render();

/* Sugestão de filename seguro */
$fname = preg_replace('/[^\w\-.]+/u', '_', $filename);
$dompdf->stream($fname, ['Attachment' => $download ? 1 : 0]);
exit;
