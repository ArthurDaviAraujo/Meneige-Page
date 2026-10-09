<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
  http_response_code(404);
  exit;
}

require_once __DIR__ . '/../api/_core/db.php';

/** @return never */
function fail_cli(string $message): void {
  fwrite(STDERR, $message . PHP_EOL);
  exit(1);
}

function prompt_cli(string $message): string {
  fwrite(STDOUT, $message);
  $value = fgets(STDIN);
  return $value === false ? '' : trim($value);
}

/** @param array<string, mixed> $options */
function option_value(array $options, string $key, string $prompt, string $default = ''): string {
  $value = trim((string)($options[$key] ?? ''));
  if ($value !== '') return $value;

  $suffix = $default !== '' ? " [$default]" : '';
  $typed = prompt_cli($prompt . $suffix . ': ');
  return $typed !== '' ? $typed : $default;
}

$options = getopt('', ['user:', 'email:', 'name::']);
$usuario = option_value($options, 'user', 'Usuário', 'admin');
$email = option_value($options, 'email', 'E-mail');
$nome = option_value($options, 'name', 'Nome', 'Administrador');
$password = (string)(getenv('SYSTEMCOLLEGE_ADMIN_PASSWORD') ?: prompt_cli('Senha (mínimo de 12 caracteres): '));

if (mb_strlen($usuario) < 3) fail_cli('O usuário precisa ter pelo menos 3 caracteres.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail_cli('Informe um e-mail válido.');
if (mb_strlen($password) < 12) fail_cli('A senha precisa ter pelo menos 12 caracteres.');

$pdo = pdo();
$pdo->beginTransaction();

try {
  $find = $pdo->prepare('SELECT id FROM users WHERE LOWER(usuario) = LOWER(?) LIMIT 1');
  $find->execute([$usuario]);
  $id = $find->fetchColumn();
  $hash = password_hash($password, PASSWORD_DEFAULT);

  if ($id) {
    $update = $pdo->prepare('UPDATE users SET nome = ?, email = ?, senha_hash = ?, role = ?, ativo = 1 WHERE id = ?');
    $update->execute([$nome, $email, $hash, 'admin', (int)$id]);
    $message = 'Administrador atualizado com sucesso.';
  } else {
    $insert = $pdo->prepare('INSERT INTO users (nome, usuario, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, 1)');
    $insert->execute([$nome, $usuario, $email, $hash, 'admin']);
    $message = 'Administrador criado com sucesso.';
  }

  $pdo->commit();
  fwrite(STDOUT, $message . PHP_EOL);
} catch (Throwable $error) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  fail_cli('Não foi possível configurar o administrador: ' . $error->getMessage());
}
