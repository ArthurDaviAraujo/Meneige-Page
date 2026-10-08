<?php
// /api/users/item.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../_core/roles.php';

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) json_response(false, null, 'ID inválido', 400);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = pdo();

/* =========================================================
   GET — retorna um usuário com permissões
========================================================= */
if ($method === 'GET') {
  $u = require_cap('user.read');

  $stmt = $pdo->prepare('SELECT id, nome, usuario, email, role, ativo, created_at, updated_at FROM users WHERE id = ?');
  $stmt->execute([$id]);
  $row = $stmt->fetch();
  if (!$row) json_response(false, null, 'Não encontrado', 404);

  $ps = $pdo->prepare('
    SELECT p.code
      FROM user_permissions up
      JOIN permissions p ON p.id = up.perm_id
     WHERE up.user_id = ? AND up.granted = 1
     ORDER BY p.code
  ');
  $ps->execute([$id]);
  $row['permissoes'] = $ps->fetchAll(PDO::FETCH_COLUMN, 0);

  json_response(true, ['item' => $row]);
}

/* =========================================================
   PUT/PATCH — atualiza dados e permissões
========================================================= */
if ($method === 'PUT' || $method === 'PATCH') {
  $u = require_cap('user.update');
  $in = input_json();

  $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
  $stmt->execute([$id]);
  $old = $stmt->fetch();
  if (!$old) json_response(false, null, 'Não encontrado', 404);

  $nome    = trim((string)($in['nome'] ?? $old['nome']));
  $usuario = trim((string)($in['usuario'] ?? $old['usuario']));
  $email   = trim((string)($in['email'] ?? $old['email']));
  $role    = (string)($in['role'] ?? $old['role']);
  $ativo   = isset($in['ativo']) ? (int)!!$in['ativo'] : (int)$old['ativo'];

  $permsIn = array_values(array_unique(array_filter((array)($in['permissoes'] ?? []), 'is_string')));

  if (!in_array($role, ['admin', 'padrao', 'leitor'], true)) {
    json_response(false, null, 'Perfil inválido', 400);
  }

  // checa duplicidade de email/usuário
  if ($usuario !== $old['usuario'] || $email !== $old['email']) {
    $chk = $pdo->prepare('SELECT 1 FROM users WHERE (usuario = ? OR email = ?) AND id <> ? LIMIT 1');
    $chk->execute([$usuario, $email, $id]);
    if ($chk->fetch()) json_response(false, null, 'Usuário ou e-mail já utilizado', 409);
  }

  try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('UPDATE users SET nome=?, usuario=?, email=?, role=?, ativo=? WHERE id=?');
    $stmt->execute([$nome, $usuario, $email, $role, $ativo, $id]);

    /* =========================================================
       Atualizar permissões — criando automaticamente as faltantes
    ========================================================= */
    if (array_key_exists('permissoes', $in)) {
      // zera vínculos antigos
      $pdo->prepare('DELETE FROM user_permissions WHERE user_id = ?')->execute([$id]);

      if (!empty($permsIn)) {
        // busca permissões existentes
        $inMarks = implode(',', array_fill(0, count($permsIn), '?'));
        $sel = $pdo->prepare("SELECT id, code FROM permissions WHERE code IN ($inMarks)");
        $sel->execute($permsIn);
        $found = $sel->fetchAll(PDO::FETCH_ASSOC);

        $permIds = [];
        $foundCodes = [];
        foreach ($found as $row) {
          $permIds[$row['code']] = (int)$row['id'];
          $foundCodes[] = $row['code'];
        }

        // cria permissões faltantes
        $missing = array_values(array_diff($permsIn, $foundCodes));
        if ($missing) {
          $insPerm = $pdo->prepare("INSERT INTO permissions (code, nome, area) VALUES (:code, :nome, :area)");
          foreach ($missing as $code) {
            $area = explode('.', $code, 2)[0] ?? 'Geral';
            $insPerm->execute([
              ':code' => $code,
              ':nome' => $code,
              ':area' => ucfirst($area)
            ]);
            $permIds[$code] = (int)$pdo->lastInsertId();
          }
        }

        // vincula permissões ao usuário
        $insLink = $pdo->prepare('INSERT INTO user_permissions (user_id, perm_id, granted) VALUES (:uid, :pid, 1)');
        foreach ($permIds as $pid) {
          $insLink->execute([':uid' => $id, ':pid' => $pid]);
        }
      }
    }

    $pdo->commit();

    audit_log((int)$u['id'], 'users', $id, 'update', [
      'old' => [
        'nome' => $old['nome'], 'usuario' => $old['usuario'], 'email' => $old['email'],
        'role' => $old['role'], 'ativo' => $old['ativo']
      ],
      'new' => [
        'nome' => $nome, 'usuario' => $usuario, 'email' => $email, 'role' => $role,
        'ativo' => $ativo, 'permissoes' => (array)($in['permissoes'] ?? null)
      ]
    ]);

    json_response(true, ['id' => $id], 'Atualizado');
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(false, null, 'Falha ao atualizar usuário', 500);
  }
}

/* =========================================================
   DELETE — desativa usuário (soft delete)
========================================================= */
if ($method === 'DELETE') {
  $u = require_cap('user.delete');

  $stmt = $pdo->prepare('UPDATE users SET ativo = 0 WHERE id = ?');
  $stmt->execute([$id]);

  audit_log((int)$u['id'], 'users', $id, 'delete', ['ativo' => 0]);
  json_response(true, null, 'Desativado');
}

json_response(false, null, 'Método não permitido', 405);
