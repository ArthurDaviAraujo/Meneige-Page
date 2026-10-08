<?php
// /api/auth/me.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_auth();

$pdo = pdo();
$user = $_SESSION['user'] ?? null;
if (!$user) json_response(false, null, 'Sessão expirada', 401);

// Administradores recebem todas as permissões cadastradas.
// Demais perfis recebem apenas os vínculos explicitamente concedidos.
if (($user['role'] ?? '') === 'admin') {
  $perms = $pdo->query("SELECT code FROM permissions ORDER BY code")
               ->fetchAll(PDO::FETCH_COLUMN, 0);
} else {
  $stmt = $pdo->prepare("
    SELECT p.code
      FROM user_permissions up
      JOIN permissions p ON p.id = up.perm_id
     WHERE up.user_id = ? AND up.granted = 1
  ");
  $stmt->execute([$user['id']]);
  $perms = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
}

json_response(true, [
  'id' => $user['id'],
  'nome' => $user['nome'],
  'role' => $user['role'],
  'email' => $user['email'],
  'permissoes' => $perms
]);
