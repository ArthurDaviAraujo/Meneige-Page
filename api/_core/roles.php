<?php
// /api/_core/roles.php
declare(strict_types=1);

/** Retorna usuário logado (array) ou null quando auth.php ainda não foi carregado. */
if (!function_exists('current_user')) {
  function current_user(): ?array {
    return $_SESSION['user'] ?? null;
  }
}

/** Checa existência de uma tabela no schema atual (seguro p/ placeholders). */
function table_exists(PDO $pdo, string $table): bool {
  $sql = "SELECT COUNT(*) FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = ?";
  $st = $pdo->prepare($sql);
  $st->execute([$table]);
  return (int)$st->fetchColumn() > 0;
}

/** Lê as capabilities do usuário logado (cache em sessão). */
function user_caps(): array {
  if (!isset($_SESSION['caps_loaded']) || !$_SESSION['caps_loaded']) {
    $_SESSION['caps'] = [];
    $u = current_user();

    if ($u) {
      // Admin => todas as permissões
      if (($u['role'] ?? '') === 'admin') {
        $_SESSION['caps'] = ['*'];
      } else {
        $pdo = pdo();

        // Se a tabela user_permissions existir, lê os códigos concedidos
        if (table_exists($pdo, 'user_permissions')) {
          $st = $pdo->prepare("
            SELECT p.code
              FROM user_permissions up
              JOIN permissions p ON p.id = up.perm_id
             WHERE up.user_id = ? AND up.granted = 1
          ");
          $st->execute([(int)$u['id']]);
          $_SESSION['caps'] = $st->fetchAll(PDO::FETCH_COLUMN, 0) ?: [];
        } else {
          // Sem tabela => nenhuma permissão específica
          $_SESSION['caps'] = [];
        }
      }
    }

    $_SESSION['caps_loaded'] = true;
  }

  return $_SESSION['caps'] ?? [];
}

/**
 * true se usuário possui a(s) capability(s).
 * Suporta:
 *   - OR com "|": ex. "user.read|user.write"
 *   - AND com "&": ex. "user.read&user.write"
 * AND tem precedência sobre OR.
 */
function has_cap(string $expr): bool {
  $caps = user_caps();
  if (in_array('*', $caps, true)) return true; // admin
  $expr = trim($expr);
  if ($expr === '') return true;

  $ors = array_map('trim', explode('|', $expr));
  foreach ($ors as $orTerm) {
    $ands = array_map('trim', explode('&', $orTerm));
    $okAnd = true;
    foreach ($ands as $cap) {
      if ($cap === '') continue;
      if (!in_array($cap, $caps, true)) { $okAnd = false; break; }
    }
    if ($okAnd) return true;
  }
  return false;
}

/** Exige capability; 403 se não tiver. Retorna o usuário autenticado. */
function require_cap(string $cap): array {
  $u = require_auth(); // 401 se não logado
  if (!has_cap($cap)) {
    json_response(false, null, 'Acesso negado', 403);
  }
  return $u;
}
