<?php
declare(strict_types=1);

/**
 * Registra logs compatíveis com a tabela audit_logs atual.
 * Campos: user_id, entidade, entidade_id, acao, diffs, created_at
 */
function registrar_log(
  PDO $pdo,
  string $acao,
  string $entidade,
  ?int $entidade_id = null,
  string $descricao = ''
): void {
  try {
    if (session_status() !== PHP_SESSION_ACTIVE) {
      session_start();
    }

    $userId   = $_SESSION['user']['id']   ?? null;
    $userNome = $_SESSION['user']['nome'] ?? 'Usuário';

    // Monta campo diffs como JSON legível
    $diffs = [
      'autor'      => $userNome,
      'descricao'  => trim($descricao),
      'ip'         => $_SERVER['REMOTE_ADDR'] ?? null,
      'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
    ];

    $stmt = $pdo->prepare("
      INSERT INTO audit_logs (user_id, entidade, entidade_id, acao, diffs, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([
      $userId,
      $entidade,
      $entidade_id,
      $acao,
      json_encode($diffs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    ]);

  } catch (Throwable $e) {
    error_log('Erro ao registrar log: ' . $e->getMessage());
  }
}
