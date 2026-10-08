<?php
// /api/relatorios/export_csv.php
declare(strict_types=1);

/* Evita cabeçalhos JSON do bootstrap (é um download) */
$GLOBALS['_no_json_header'] = true;

require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');

/** Lê input, aceitando JSON, x-www-form-urlencoded etc. */
$in = input_any();

/* ====== Config/Defaults ====== */
$filename = trim((string)($in['filename'] ?? 'relatorio_' . date('Ymd_His') . '.csv'));
if (!preg_match('/\.csv$/i', $filename)) $filename .= '.csv';

$columns = $in['columns'] ?? [];
$rows    = $in['rows']    ?? [];

if (!is_array($columns) || !is_array($rows) || empty($columns)) {
  http_response_code(422);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['ok'=>false, 'message'=>'Payload inválido: columns[] e rows[] são obrigatórios.'], JSON_UNESCAPED_UNICODE);
  exit;
}

/** Normaliza columns: aceita ["Aluno","Série"] ou [{key,label}] */
$normCols = [];
foreach ($columns as $i => $c) {
  if (is_array($c)) {
    $key   = isset($c['key'])   ? (string)$c['key']   : ('col_'.$i);
    $label = isset($c['label']) ? (string)$c['label'] : $key;
  } else {
    $key = is_string($c) ? $c : ('col_'.$i);
    $label = $key;
  }
  $normCols[] = ['key'=>$key, 'label'=>$label];
}

/* ====== CSV helpers ====== */
$delimiter = isset($in['delimiter']) && in_array($in['delimiter'], [',',';','\t'], true)
  ? ($in['delimiter'] === '\t' ? "\t" : $in['delimiter'])
  : ';'; // padrão brasileiro: ponto e vírgula

$addBom = !isset($in['bom']) || (bool)$in['bom']; // por padrão adiciona BOM para Excel

/** Escapa campo CSV com delimitador/aspas/linhas. */
$esc = function ($v) use ($delimiter) {
  if ($v === null) $v = '';
  $s = (string)$v;
  $needQuote = strpbrk($s, "\"\r\n".$delimiter) !== false;
  $s = str_replace('"', '""', $s);
  return $needQuote ? "\"$s\"" : $s;
};

/* ====== Geração ====== */
$out = fopen('php://temp', 'w+');
if ($addBom) fwrite($out, "\xEF\xBB\xBF"); // BOM UTF-8 para Excel

// Cabeçalho
$header = [];
foreach ($normCols as $c) $header[] = $esc($c['label']);
fwrite($out, implode($delimiter, $header) . "\r\n");

// Linhas
foreach ($rows as $r) {
  $line = [];
  foreach ($normCols as $c) {
    $val = '';
    if (is_array($r) && array_key_exists($c['key'], $r)) {
      $val = $r[$c['key']];
    }
    // Protege números longos/zero-leading do Excel: prefixa com \t se solicitado
    if (!empty($in['excel_safe']) && is_string($val) && preg_match('/^\d{10,}$/', $val)) {
      $val = "\t".$val;
    }
    $line[] = $esc($val);
  }
  fwrite($out, implode($delimiter, $line) . "\r\n");
}

rewind($out);
$size = ftell($out);
$csv  = stream_get_contents($out, -1, 0);

/* ====== Headers ====== */
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

echo $csv;
exit;
