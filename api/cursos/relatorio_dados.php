<?php
// /api/cursos/relatorio_dados.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';

require_auth(); // garante login

$pdo = pdo();
$tipo  = $_GET['tipo']  ?? '';
$valor = trim($_GET['valor'] ?? '');

if (!$tipo || !$valor) {
  json_response(false, null, 'Parâmetros inválidos');
}

try {
  switch ($tipo) {
    case 'professor':
      $sql = "SELECT 
                c.id AS curso_id,
                c.nome AS curso_nome,
                c.professor_nome,
                a.nome AS aluno_nome,
                a.responsavel,
                mc.status
              FROM cursos c
              JOIN curso_turmas ct ON ct.curso_id = c.id
              JOIN matriculas_curso mc ON mc.curso_turma_id = ct.id
              JOIN alunos a ON a.id = mc.aluno_id
              WHERE c.professor_nome LIKE :nome OR c.professor_nome = :nome_exato
              ORDER BY c.nome, a.nome";
      $stmt = $pdo->prepare($sql);
      $stmt->execute([
        ':nome' => "%$valor%",
        ':nome_exato' => $valor
      ]);
      break;

    case 'curso':
      $sql = "SELECT 
                c.id AS curso_id,
                c.nome AS curso_nome,
                c.professor_nome,
                a.nome AS aluno_nome,
                a.responsavel,
                mc.status
              FROM cursos c
              JOIN curso_turmas ct ON ct.curso_id = c.id
              JOIN matriculas_curso mc ON mc.curso_turma_id = ct.id
              JOIN alunos a ON a.id = mc.aluno_id
              WHERE c.id = :id OR c.nome LIKE :nome
              ORDER BY a.nome";
      $stmt = $pdo->prepare($sql);
      $stmt->execute([
        ':id' => $valor,
        ':nome' => "%$valor%"
      ]);
      break;

    case 'aluno':
      $sql = "SELECT 
                a.id AS aluno_id,
                a.nome AS aluno_nome,
                a.responsavel,
                c.nome AS curso_nome,
                c.professor_nome,
                mc.status
              FROM alunos a
              JOIN matriculas_curso mc ON mc.aluno_id = a.id
              JOIN curso_turmas ct ON ct.id = mc.curso_turma_id
              JOIN cursos c ON c.id = ct.curso_id
              WHERE a.id = :id OR a.nome LIKE :nome
              ORDER BY c.nome";
      $stmt = $pdo->prepare($sql);
      $stmt->execute([
        ':id' => $valor,
        ':nome' => "%$valor%"
      ]);
      break;

    default:
      json_response(false, null, 'Tipo de filtro inválido');
  }

  $dados = $stmt->fetchAll(PDO::FETCH_ASSOC);
  json_response(true, $dados ?: []);

} catch (Throwable $e) {
  json_response(false, null, 'Erro ao buscar dados: ' . $e->getMessage());
}
