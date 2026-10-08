<?php
require_once '../api/_core/bootstrap.php';
require_once '../api/_core/log_helper.php';
header('Content-Type: application/json');

try {
  if (!isset($_FILES['arquivo'])) {
    throw new Exception('Nenhum arquivo enviado.');
  }
  
  $tmp = $_FILES['arquivo']['tmp_name'];
  $dry = isset($_POST['dry_run']) && $_POST['dry_run'] === '1';

  $pdo = pdo();
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $handle = fopen($tmp, 'r');
  if (!$handle) {
    throw new Exception('Falha ao abrir o arquivo CSV.');
  }

  $header = fgetcsv($handle, 0, ',');
  $linhas = 0;
  $alunos = 0;
  $erros  = [];

  while (($row = fgetcsv($handle, 0, ',')) !== false) {
    $linhas++;
    $data = array_combine($header, $row);
    if (strtolower(trim($data['tipo'] ?? '')) !== 'aluno') continue;

    $segmento = trim($data['segmento'] ?? '');
    $serie    = trim($data['serie'] ?? '');
    $turma    = trim($data['turma'] ?? '');
    $nome     = trim($data['aluno_nome'] ?? '');
    $resp     = trim($data['responsavel_nome'] ?? '');
    $hEnt     = trim($data['hora_entrada'] ?? '');
    $hSai     = trim($data['hora_saida'] ?? '');
    $almoco   = !empty($data['almoco']) ? 1 : 0;
    $jantar   = !empty($data['jantar']) ? 1 : 0;

    if (!$segmento || !$serie || !$turma || !$nome) {
      $erros[] = "Linha $linhas: campos obrigatórios ausentes.";
      continue;
    }

    // Segmento
    $segStmt = $pdo->prepare("SELECT id FROM segments WHERE nome=? LIMIT 1");
    $segStmt->execute([$segmento]);
    $segId = $segStmt->fetchColumn();
    if (!$segId) {
      $erros[] = "Linha $linhas: segmento '$segmento' não encontrado.";
      continue;
    }

    // Série
    $serieStmt = $pdo->prepare("SELECT id FROM series WHERE nome=? AND segment_id=? LIMIT 1");
    $serieStmt->execute([$serie, $segId]);
    $serieId = $serieStmt->fetchColumn();
    if (!$serieId) {
      $erros[] = "Linha $linhas: série '$serie' não encontrada no segmento '$segmento'.";
      continue;
    }

    // Turma
    $turmaStmt = $pdo->prepare("SELECT id FROM turmas WHERE nome=? AND series_id=? LIMIT 1");
    $turmaStmt->execute([$turma, $serieId]);
    $turmaId = $turmaStmt->fetchColumn();
    if (!$turmaId) {
      $erros[] = "Linha $linhas: turma '$turma' não encontrada na série '$serie'.";
      continue;
    }

    // Se não for simulação, insere aluno e rotina
    if (!$dry) {
      $pdo->beginTransaction();

      // Cria o aluno
      $ins = $pdo->prepare("
        INSERT INTO alunos (turma_id, nome, responsavel, status)
        VALUES (?, ?, ?, 'ativo')
      ");
      $ins->execute([$turmaId, $nome, $resp ?: null]);
      $alunoId = (int)$pdo->lastInsertId();

      // Cria rotina semanal
      $rotina = $pdo->prepare("
        INSERT INTO aluno_rotina (aluno_id, dia_semana, entrada, saida, almoco, jantar)
        VALUES (?,?,?,?,?,?)
      ");
      for ($dia = 1; $dia <= 5; $dia++) {
        $rotina->execute([$alunoId, $dia, $hEnt ?: null, $hSai ?: null, $almoco, $jantar]);
      }

      $pdo->commit();
      $alunos++;
    }
  }

  fclose($handle);

  // 🔹 Registra o log (somente se importou algo real)
  if (!$dry && $alunos > 0) {
    $user = $_SESSION['user']['nome'] ?? 'Usuário';
    $descricao = "$user importou $alunos alunos via CSV.";

    registrar_log($pdo, 'import', 'alunos', null, json_encode([
      'descricao'  => $descricao,
      'linhas'     => $linhas,
      'alunos'     => $alunos,
      'ip'         => $_SERVER['REMOTE_ADDR'] ?? null,
      'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  }

  echo json_encode([
    'linhas' => $linhas,
    'alunos' => $alunos,
    'erros' => $erros
  ]);

} catch (Throwable $e) {
  echo json_encode(['erro' => $e->getMessage()]);
}
