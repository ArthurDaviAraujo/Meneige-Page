<?php
// /api/calc/_calc.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';

/**
 * Calcula a proposta da calculadora (sem multiplicar por fator mensal).
 * Regra: total = mensalidade + (horas_extras_mes * valor_hora) + (qtd_almocos_mes * preco_almoco) + (qtd_jantares_mes * preco_jantar)
 * - Se as quantidades mensais NÃO forem informadas no payload, caímos em um fallback derivado do grid semanal (sem aplicar fator).
 */
function calc_quote(array $payload, PDO $pdo): array
{
  // --- Entrada principal do front ---
  $serie = (string)($payload['serie'] ?? '');
  $week  = (array)($payload['week'] ?? []);              // grid semanal (fallback)
  $disc  = (array)($payload['descontos'] ?? []);         // {mensal, extras, almoco, jantar}

  // Valores unitários (vindos do front/financeiro)
  $valores = [
    'mensalidade'      => (float)($payload['mensalidade'] ?? 0),
    'hora_extra'       => (float)($payload['hora_extra'] ?? 0),
    'refeicao_almoco'  => (float)($payload['refeicao_almoco'] ?? 0),
    'refeicao_jantar'  => (float)($payload['refeicao_jantar'] ?? 0),
  ];

  if (!$serie) {
    throw new InvalidArgumentException('Informe a série.');
  }

  // Quantidades MENSAIS opcionais (se vierem, têm prioridade)
  $qtyMes = [
    'horas_extras_mes' => isset($payload['horas_extras_mes']) ? (float)$payload['horas_extras_mes'] : null,
    'qtd_almocos_mes'  => isset($payload['qtd_almocos_mes'])  ? (int)$payload['qtd_almocos_mes']  : null,
    'qtd_jantares_mes' => isset($payload['qtd_jantares_mes']) ? (int)$payload['qtd_jantares_mes'] : null,
  ];

  // Helpers
  $pct = static function ($v): float {
    return max(0, min(100, (float)$v)) / 100.0;
  };
  $mins = static function (string $hhmm): int {
    if (!$hhmm || strpos($hhmm, ':') === false) return 0;
    [$h, $m] = array_map('intval', explode(':', $hhmm, 2));
    return $h * 60 + $m;
  };

  // --- Fallback a partir do grid semanal (sem fator mensal) ---
  // Mantemos a base de 5h/dia (20h/semana). Extras semanais = max(0, horas_totais_semana - 20).
  // Se as quantidades mensais NÃO vierem, usamos o que sair daqui diretamente como "mensal" (conforme pedido do cliente: sem fator).
  $dias = ['seg', 'ter', 'qua', 'qui', 'sex'];
  $horasTotaisSemana = 0.0;
  $almocosSemana = 0;
  $jantaresSemana = 0;

  foreach ($dias as $d) {
    $st = $week[$d] ?? null;
    if (!$st) continue;
    $in  = $mins((string)($st['in'] ?? ''));
    $out = $mins((string)($st['out'] ?? ''));
    if ($in && $out && $out > $in) {
      $horasTotaisSemana += ($out - $in) / 60;
    }
    if (!empty($st['almoco'])) $almocosSemana++;
    if (!empty($st['jantar'])) $jantaresSemana++;
  }

  $baseHorasDia = 5;                 // referência histórica da regra
  $horasExtrasSemana = max(0, $horasTotaisSemana - ($baseHorasDia * 5)); // 20h

  // --- Quantidades efetivamente usadas no cálculo (prioriza mensal do payload) ---
  $horasExtrasMes = $qtyMes['horas_extras_mes'];
  if ($horasExtrasMes === null) {
    // fallback: usa o valor semanal diretamente como mensal (sem multiplicar por fator)
    $horasExtrasMes = $horasExtrasSemana;
  }

  $qtdAlmocosMes = $qtyMes['qtd_almocos_mes'];
  if ($qtdAlmocosMes === null) {
    // fallback: usa a contagem semanal diretamente como mensal
    $qtdAlmocosMes = $almocosSemana;
  }

  $qtdJantaresMes = $qtyMes['qtd_jantares_mes'];
  if ($qtdJantaresMes === null) {
    // fallback: usa a contagem semanal diretamente como mensal
    $qtdJantaresMes = $jantaresSemana;
  }

  // --- Cálculos SEM fator mensal ---
  $mensal      = (float)$valores['mensalidade'];
  $valorExtras = (float)$horasExtrasMes * (float)$valores['hora_extra'];
  $valorAlmoco = (float)$qtdAlmocosMes * (float)$valores['refeicao_almoco'];
  $valorJantar = (float)$qtdJantaresMes * (float)$valores['refeicao_jantar'];
  $valorTabela = $mensal + $valorExtras + $valorAlmoco + $valorJantar;

  // --- Descontos (% individuais por item) ---
  $dMensal = $pct($disc['mensal'] ?? 0);
  $dExtras = $pct($disc['extras'] ?? 0);
  $dAlmoco = $pct($disc['almoco'] ?? 0);
  $dJantar = $pct($disc['jantar'] ?? 0);

  $mensalDesc = $mensal * (1 - $dMensal);
  $extrasDesc = $valorExtras * (1 - $dExtras);
  $almocoDesc = $valorAlmoco * (1 - $dAlmoco);
  $jantarDesc = $valorJantar * (1 - $dJantar);
  $valorFinal = $mensalDesc + $extrasDesc + $almocoDesc + $jantarDesc;

  $descGlobal = $valorTabela > 0 ? (1 - ($valorFinal / $valorTabela)) * 100 : 0;

  return [
    'serie' => $serie,
    'base_horas_dia' => $baseHorasDia,
    'totais' => [
      'horas_extras_mes'   => round((float)$horasExtrasMes, 1),
      'qtd_almocos_mes'    => (int)$qtdAlmocosMes,
      'qtd_jantares_mes'   => (int)$qtdJantaresMes,
      'mensal'             => round($mensal, 2),
      'extras'             => round($valorExtras, 2),
      'almoco'             => round($valorAlmoco, 2),
      'jantar'             => round($valorJantar, 2),
      'tabela'             => round($valorTabela, 2),
    ],
    'descontos' => [
      'mensal' => round($dMensal * 100, 2),
      'extras' => round($dExtras * 100, 2),
      'almoco' => round($dAlmoco * 100, 2),
      'jantar' => round($dJantar * 100, 2),
    ],
    'totais_com_desconto' => [
      'mensal'               => round($mensalDesc, 2),
      'extras'               => round($extrasDesc, 2),
      'almoco'               => round($almocoDesc, 2),
      'jantar'               => round($jantarDesc, 2),
      'final'                => round($valorFinal, 2),
      'desconto_global_pct'  => round($descGlobal, 1),
      'desconto_global_val'  => round($valorTabela - $valorFinal, 2)
    ],
    'valores' => $valores
  ];
}
