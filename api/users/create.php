<?php
// /api/users/create.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php'; // fornece: json_response, require_method, input_json, pdo()

require_method('POST');
$in = input_json();

/**
 * Campos esperados:
 *  - nome (string, obrig.)
 *  - email (string, obrig.)
 *  - usuario (string, obrig.)
 *  - senha (string, obrig.)
 *  - role  ('admin'|'padrao'|'leitor') opcional (default: 'padrao')
 *  - permissoes (string[] de codes), opcional
 */

$nome   = trim((string)($in['nome']   ?? ''));
$email  = trim((string)($in['email']  ?? ''));
$login  = trim((string)($in['usuario']?? ''));
$senha  = (string)($in['senha'] ?? '');
$role   = strtolower((string)($in['role'] ?? 'padrao'));
$perms  = $in['permissoes'] ?? [];

if ($nome === '' || $email === '' || $login === '' || $senha === '') {
  json_response(false, null, 'Campos obrigatórios: nome, email, usuario, senha', 422);
}
if (!in_array($role, ['admin','padrao','leitor'], true)) {
  $role = 'padrao';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  json_response(false, null, 'E-mail inválido', 422);
}

// normaliza permissoes
$perms = is_array($perms) ? array_values(array_unique(array_filter(array_map('strval', $perms)))) : [];

$pdo = pdo();
$pdo->beginTransaction();

try {
  // cria usuário
  $hash = password_hash($senha, PASSWORD_BCRYPT);

  $stmt = $pdo->prepare("
    INSERT INTO users (nome, usuario, email, senha_hash, role, ativo)
    VALUES (:nome, :usuario, :email, :senha, :role, 1)
  ");
  $stmt->execute([
    ':nome'    => $nome,
    ':usuario' => $login,
    ':email'   => $email,
    ':senha'   => $hash,
    ':role'    => $role,
  ]);

  $userId = (int)$pdo->lastInsertId();

  // garante que os codes de permissões existam em permissions (se vieram)
  $permIds = [];
  if (!empty($perms)) {
    // busca existentes
    $inMarks = implode(',', array_fill(0, count($perms), '?'));
    $sel = $pdo->prepare("SELECT id, code FROM permissions WHERE code IN ($inMarks)");
    $sel->execute($perms);
    $found = $sel->fetchAll();
    $foundCodes = [];
    foreach ($found as $row) {
      $permIds[(string)$row['code']] = (int)$row['id'];
      $foundCodes[] = (string)$row['code'];
    }
    // insere faltantes com label básico
    $missing = array_values(array_diff($perms, $foundCodes));
    if ($missing) {
      $ins = $pdo->prepare("INSERT INTO permissions (code, nome, area) VALUES (:code, :nome, :area)");
      foreach ($missing as $code) {
        $ins->execute([
          ':code' => $code,
          ':nome' => $code,         // rótulo simples (você pode ajustar depois via seed/config)
          ':area' => 'Custom',
        ]);
        $permIds[$code] = (int)$pdo->lastInsertId();
      }
    }

    // vincula permissões ao usuário
    $link = $pdo->prepare("
      INSERT INTO user_permissions (user_id, perm_id, granted)
      VALUES (:uid, :pid, 1)
      ON DUPLICATE KEY UPDATE granted = VALUES(granted)
    ");
    foreach ($perms as $code) {
      $pid = $permIds[$code] ?? null;
      if ($pid) {
        $link->execute([':uid' => $userId, ':pid' => $pid]);
      }
    }
  }

  // audit log
  $diffs = [
    'after' => [
      'id'      => $userId,
      'nome'    => $nome,
      'usuario' => $login,
      'email'   => $email,
      'role'    => $role,
      'ativo'   => 1,
      'permissoes' => $perms,
    ],
  ];
  $al = $pdo->prepare("
    INSERT INTO audit_logs (user_id, entidade, entidade_id, acao, diffs)
    VALUES (:uid, 'users', :ent_id, 'create', CAST(:diffs AS JSON))
  ");
  // quem está criando: se já há usuário logado na sessão, use-o; senão null
  $actorId = isset($_SESSION['user']['id']) ? (int)$_SESSION['user']['id'] : null;
  $al->execute([
    ':uid'    => $actorId,
    ':ent_id' => $userId,
    ':diffs'  => json_encode($diffs, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
  ]);

  $pdo->commit();

  json_response(true, [
    'user' => [
      'id'      => $userId,
      'nome'    => $nome,
      'usuario' => $login,
      'email'   => $email,
      'role'    => $role,
      'ativo'   => 1,
      'permissoes' => $perms,
    ]
  ], 'Usuário criado', 201);

} catch (PDOException $e) {
  $pdo->rollBack();

  // violações de UNIQUE (email/usuario)
  if ($e->getCode() === '23000') {
    $msg = $e->getMessage();
    if (stripos($msg, 'ux_users_email') !== false) {
      json_response(false, null, 'Este e-mail já está em uso.', 409);
    }
    if (stripos($msg, 'ux_users_usuario') !== false) {
      json_response(false, null, 'Este usuário (login) já está em uso.', 409);
    }
    json_response(false, null, 'Violação de restrição de unicidade.', 409);
  }

  json_response(false, null, 'Erro ao criar usuário: '.$e->getMessage(), 500);
} catch (Throwable $t) {
  $pdo->rollBack();
  json_response(false, null, 'Falha inesperada: '.$t->getMessage(), 500);
}
