<?php
// /api/precos/index.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

require_method('GET');
require_auth();

$pdo = pdo();

/* -----------------------------------------------------
   1. Busca os segmentos e séries
----------------------------------------------------- */
$segments = $pdo->query("SELECT id, nome FROM segments ORDER BY ordem")->fetchAll(PDO::FETCH_ASSOC);

/* -----------------------------------------------------
   2. Busca os preços cadastrados
----------------------------------------------------- */
$precos = $pdo->query("SELECT chave, valor, vigente_desde, obs FROM precos")->fetchAll(PDO::FETCH_ASSOC);
$mapPrecos = [];
foreach ($precos as $p) $mapPrecos[$p['chave']] = (float)$p['valor'];

/* -----------------------------------------------------
   3. Monta estrutura: mensalidades + extras fixos
----------------------------------------------------- */
$items = [];

// Mensalidades por segmento (dinâmico)
foreach ($segments as $seg) {
  $key = 'mensal.' . strtolower(preg_replace('/\s+/', '_', $seg['nome']));
  $items[] = [
    'tipo'  => 'mensal',
    'label' => "Mensalidade " . $seg['nome'],
    'key'   => $key,
    'valor' => $mapPrecos[$key] ?? null
  ];
}

// Fixos
$fixos = [
  ['tipo'=>'hora',     'label'=>'Hora Extra (R$/h)',    'key'=>'hora.extra'],
  ['tipo'=>'refeicao', 'label'=>'Almoço (R$/dia)',      'key'=>'refeicao.almoco'],
  ['tipo'=>'refeicao', 'label'=>'Jantar (R$/dia)',      'key'=>'refeicao.jantar']
];

foreach ($fixos as $f) {
  $items[] = [
    ...$f,
    'valor' => $mapPrecos[$f['key']] ?? null
  ];
}

/* -----------------------------------------------------
   4. Retorno
----------------------------------------------------- */
json_response(true, [
  'precos'    => $items,
  'segmentos' => $segments
]);
