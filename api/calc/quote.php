<?php
// /api/calc/quote.php
declare(strict_types=1);

require_once __DIR__ . '/_calc.php';

require_method('POST');
require_auth();

$in  = input_json();
$pdo = pdo();

try {
  $data = calc_quote($in, $pdo);
  json_response(true, $data);
} catch (Throwable $e) {
  json_response(false, null, $e->getMessage(), 400);
}
