<?php
require_once __DIR__ . '/bootstrap.php';

$perms = [
  ['admin.geral', 'Acesso à Administração', 'Administração'],

  ['acad.visualizar', 'Visualizar Estrutura Acadêmica', 'Estrutura Acadêmica'],
  ['acad.cadastro', 'Cadastro de Estrutura', 'Estrutura Acadêmica'],
  ['acad.transferencia', 'Transferência de Alunos', 'Estrutura Acadêmica'],

  ['horarios.visualizar', 'Visualizar Horários', 'Horários'],
  ['horarios.edicao', 'Edição de Rotina', 'Horários'],

  ['curso.cadastro', 'Cadastro de Curso', 'Cursos Extracurriculares'],
  ['curso.aluno_cadastro', 'Cadastro de Aluno em Curso', 'Cursos Extracurriculares'],

  ['fin.atualizar_preco', 'Atualização de Preço por Segmento', 'Financeiro'],

  ['rel.tudo', 'Visualizar Todos os Relatórios', 'Relatórios'],
  ['rel.total_alunos', 'Visualizar Total de Alunos', 'Relatórios'],
  ['rel.receita', 'Visualizar Receita', 'Relatórios'],
  ['rel.refeicoes', 'Visualizar Refeições', 'Relatórios'],
  ['rel.horas_extras', 'Visualizar Horas Extras', 'Relatórios'],

  ['config.geral', 'Acesso às Configurações', 'Configurações'],
  ['logs.visualizar', 'Visualizar Logs', 'Logs'],
];

$pdo = pdo();
foreach ($perms as [$code, $nome, $area]) {
  $stmt = $pdo->prepare("
    INSERT INTO permissions (code, nome, area)
    VALUES (:c, :n, :a)
    ON DUPLICATE KEY UPDATE nome=:n, area=:a
  ");
  $stmt->execute([':c'=>$code, ':n'=>$nome, ':a'=>$area]);
}
echo "Permissões atualizadas com sucesso.\n";
