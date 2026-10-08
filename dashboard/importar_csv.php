<?php
// importar_csv.php — compatível com o schema enviado
declare(strict_types=1);

require_once '../api/_core/bootstrap.php';
require_once '../api/_core/log_helper.php';

header('Content-Type: application/json; charset=utf-8');

try {
  if (!isset($_FILES['arquivo'])) {
    throw new Exception('Nenhum arquivo enviado.');
  }

  $tmp = $_FILES['arquivo']['tmp_name'];
  $dry = isset($_POST['dry_run']) && $_POST['dry_run'] === '1';

  $pdo = pdo();
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  /* ---------------- Helpers ---------------- */
  $norm = static fn (string $s): string => mb_strtolower(trim($s), 'UTF-8');

  $parseBool = static function ($v) use ($norm): int {
    $v = $norm((string)$v);
    if ($v === '' || $v === '0' || in_array($v, ['nao','não','no','false','f','n'], true)) return 0;
    return 1;
  };

  $parseTime = static function ($v): ?string {
    $v = trim((string)$v);
    if ($v === '') return null;
    if (preg_match('/^(\d{1,2}):(\d{2})(?::\d{2})?$/', $v, $m)) {
      $h = max(0, min(23, (int)$m[1]));
      $i = max(0, min(59, (int)$m[2]));
      return sprintf('%02d:%02d:00', $h, $i);
    }
    return null;
  };

  $slugify = static function (string $s): string {
    $s = trim($s);
    $s = iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$s);
    $s = strtolower($s);
    $s = preg_replace('/[^a-z0-9]+/','-',$s);
    $s = trim($s, '-');
    return $s !== '' ? $s : 'serie';
  };

  $ensureUniqueSerieCodigo = static function(PDO $pdo, string $base): string {
    $try = $base;
    $i = 1;
    while (true) {
      $st = $pdo->prepare("SELECT 1 FROM series WHERE codigo=? LIMIT 1");
      $st->execute([$try]);
      if (!$st->fetchColumn()) return $try;
      $i++;
      $try = $base . '-' . $i;
    }
  };

  $findOrCreateSegment = static function (PDO $pdo, string $nome, bool $dry): array {
    $st = $pdo->prepare("SELECT id FROM segments WHERE nome=? LIMIT 1");
    $st->execute([$nome]);
    $id = $st->fetchColumn();
    if ($id) return [(int)$id, false];
    if ($dry) return [null, true];
    $ins = $pdo->prepare("INSERT INTO segments (nome, ordem) VALUES (?, 0)");
    $ins->execute([$nome]);
    return [(int)$pdo->lastInsertId(), true];
  };

  $findOrCreateSerie = static function (PDO $pdo, int $segmentId, string $nome, bool $dry, callable $slugify, callable $ensureUnique): array {
    $st = $pdo->prepare("SELECT id FROM series WHERE segment_id=? AND nome=? LIMIT 1");
    $st->execute([$segmentId, $nome]);
    $id = $st->fetchColumn();
    if ($id) return [(int)$id, false];
    if ($dry) return [null, true];

    $codigoBase = $slugify($nome);
    $codigo = $ensureUnique($pdo, $codigoBase);

    $ins = $pdo->prepare("INSERT INTO series (segment_id, nome, codigo, ordem) VALUES (?,?,?,0)");
    $ins->execute([$segmentId, $nome, $codigo]);
    return [(int)$pdo->lastInsertId(), true];
  };

  $findOrCreateTurma = static function (PDO $pdo, int $seriesId, string $nome, ?string $ent, ?string $sai, bool $dry): array {
    $st = $pdo->prepare("SELECT id FROM turmas WHERE series_id=? AND nome=? LIMIT 1");
    $st->execute([$seriesId, $nome]);
    $id = $st->fetchColumn();
    if ($id) return [(int)$id, false];
    if ($dry) return [null, true];

    // turmas exige entrada_parcial/saida_parcial NOT NULL
    $baseEnt = $ent ?: '08:00:00';
    $baseSai = $sai ?: '13:00:00';

    $ins = $pdo->prepare("INSERT INTO turmas (series_id, nome, entrada_parcial, saida_parcial, ativo) VALUES (?,?,?,?,1)");
    $ins->execute([$seriesId, $nome, $baseEnt, $baseSai]);
    return [(int)$pdo->lastInsertId(), true];
  };

  $findAluno = static function (PDO $pdo, int $turmaId, string $nome): ?int {
    $st = $pdo->prepare("SELECT id FROM alunos WHERE turma_id=? AND nome=? LIMIT 1");
    $st->execute([$turmaId, $nome]);
    $id = $st->fetchColumn();
    return $id ? (int)$id : null;
  };

  $upsertRotina = static function (PDO $pdo, int $alunoId, ?string $ent, ?string $sai, int $alm, int $jan, bool $dry): void {
    if ($dry) return;
    $pdo->prepare("DELETE FROM aluno_rotina WHERE aluno_id=?")->execute([$alunoId]);
    $ins = $pdo->prepare("INSERT INTO aluno_rotina (aluno_id, dia_semana, entrada, saida, almoco, jantar) VALUES (?,?,?,?,?,?)");
    for ($d=1; $d<=5; $d++) {
      $ins->execute([$alunoId, $d, $ent, $sai, $alm, $jan]);
    }
  };

  /* --------------- Abrir CSV / Delimitador / Cabeçalho --------------- */
  $handle = fopen($tmp, 'r');
  if (!$handle) throw new Exception('Falha ao abrir CSV.');

  $probe = fgets($handle);
  if ($probe === false) throw new Exception('CSV vazio.');

  // Detecta separador: vírgula, ponto-e-vírgula, TAB — pega o que mais aparece
  $counts = [
    ','  => substr_count($probe, ','),
    ';'  => substr_count($probe, ';'),
    "\t" => substr_count($probe, "\t"),
  ];
  arsort($counts);
  $delimiter = key($counts);
  if ($counts[$delimiter] === 0) { $delimiter = ','; } // fallback

  rewind($handle);
  $header = fgetcsv($handle, 0, $delimiter);
  if (!$header) throw new Exception('Não foi possível ler o cabeçalho.');

  // Remove BOM da primeira coluna
  if (isset($header[0])) {
    $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string)$header[0]);
  }

  $headerNorm = array_map(static function($h){
    return mb_strtolower(trim((string)$h), 'UTF-8');
  }, $header);

  // Modelo oficial (9 colunas)
  $modelo = [
    'segmento','serie','turma',
    'aluno_nome','responsavel_nome',
    'hora_entrada','hora_saida','almoco','jantar'
  ];

  if (count($headerNorm) !== count($modelo)) {
    throw new Exception('Cabeçalho inválido. Use exatamente as 9 colunas do modelo oficial.');
  }
  $diffA = array_diff($headerNorm, $modelo);
  $diffB = array_diff($modelo, $headerNorm);
  if (!empty($diffA) || !empty($diffB)) {
    throw new Exception('Cabeçalho inválido. Baixe o modelo oficial e não altere os nomes das colunas.');
  }

  $idx = array_flip($headerNorm);

  /* ---------------- Contadores ---------------- */
  $linhas = 0;
  $alunosCriados = 0;
  $alunosAtualizados = 0;
  $segCriados = 0;
  $serCriadas = 0;
  $turCriadas = 0;
  $erros = [];

  if (!$dry) $pdo->beginTransaction();

  while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
    $linhas++;

    if (count($row) < count($headerNorm)) {
      $row = array_pad($row, count($headerNorm), '');
    }

    $get = static function(string $k) use ($idx, $row): string {
      return isset($idx[$k]) ? trim((string)($row[$idx[$k]] ?? '')) : '';
    };

    $segmento = $get('segmento');
    $serie    = $get('serie');
    $turma    = $get('turma');
    $nome     = $get('aluno_nome');
    $resp     = $get('responsavel_nome');
    $hEnt     = $parseTime($get('hora_entrada'));
    $hSai     = $parseTime($get('hora_saida'));
    $almoco   = $parseBool($get('almoco'));
    $jantar   = $parseBool($get('jantar'));

    if ($segmento === '' || $serie === '' || $turma === '' || $nome === '') {
      $erros[] = "Linha {$linhas}: campos obrigatórios ausentes (segmento/série/turma/aluno).";
      continue;
    }

    // Encadeia criações
    [$segId, $crSeg] = $findOrCreateSegment($pdo, $segmento, $dry);
    if ($crSeg) $segCriados++;
    if ($dry && $crSeg) { $serCriadas++; $turCriadas++; $alunosCriados++; continue; }

    [$serieId, $crSer] = $findOrCreateSerie($pdo, (int)$segId, $serie, $dry, $slugify, $ensureUniqueSerieCodigo);
    if ($crSer) $serCriadas++;
    if ($dry && $crSer) { $turCriadas++; $alunosCriados++; continue; }

    [$turmaId, $crTur] = $findOrCreateTurma($pdo, (int)$serieId, $turma, $hEnt, $hSai, $dry);
    if ($crTur) $turCriadas++;
    if ($dry && $crTur) { $alunosCriados++; continue; }

    // Aluno
    $alunoId = $findAluno($pdo, (int)$turmaId, $nome);
    if ($alunoId === null) {
      if (!$dry) {
        $ins = $pdo->prepare("INSERT INTO alunos (turma_id, nome, responsavel, status) VALUES (?,?,?, 'ativo')");
        $ins->execute([(int)$turmaId, $nome, ($resp !== '' ? $resp : null)]);
        $alunoId = (int)$pdo->lastInsertId();
      }
      $alunosCriados++;
    } else {
      $alunosAtualizados++;
    }

    if ($alunoId !== null) {
      $upsertRotina($pdo, $alunoId, $hEnt, $hSai, $almoco, $jantar, $dry);
    }
  }

  fclose($handle);

  if (!$dry) {
    $pdo->commit();

    $tot = $alunosCriados + $alunosAtualizados;
    if ($tot > 0) {
      $user = $_SESSION['user']['nome'] ?? 'Usuário';
      $desc = sprintf(
        "%s importou %d linhas (%d alunos criados, %d atualizados; %d segmentos, %d séries, %d turmas criados).",
        $user, $linhas, $alunosCriados, $alunosAtualizados, $segCriados, $serCriadas, $turCriadas
      );
      registrar_log($pdo, 'import', 'alunos', null, json_encode([
        'descricao' => $desc,
        'linhas' => $linhas,
        'alunos_criados' => $alunosCriados,
        'alunos_atualizados' => $alunosAtualizados,
        'segmentos_criados' => $segCriados,
        'series_criadas' => $serCriadas,
        'turmas_criadas' => $turCriadas,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
      ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
  }

  echo json_encode([
    'linhas'              => $linhas,
    'alunos'              => $alunosCriados + $alunosAtualizados,
    'alunos_criados'      => $alunosCriados,
    'alunos_atualizados'  => $alunosAtualizados,
    'segmentos_criados'   => $segCriados,
    'series_criadas'      => $serCriadas,
    'turmas_criadas'      => $turCriadas,
    'erros'               => $erros
  ]);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) { $pdo->rollBack(); }
  echo json_encode(['erro' => $e->getMessage()]);
}
