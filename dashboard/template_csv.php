<?php
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="modelo_importacao_alunos.csv"');

$output = fopen('php://output', 'w');

// Cabeçalho
fputcsv($output, [
  'segmento',
  'serie',
  'turma',
  'aluno_nome',
  'responsavel_nome',
  'hora_entrada',
  'hora_saida',
  'almoco',
  'jantar'
]);

// Exemplo
fputcsv($output, [
  'aluno',
  'Educação Infantil',
  'Maternal',
  'Turma A',
  'Maria Silva',
  'João Silva',
  '08:00',
  '13:00',
  '1',
  '0'
]);

fputcsv($output, [
  'aluno',
  'Ensino Fundamental 1',
  'Fundamental 1',
  'Turma A',
  'Pedro Souza',
  'Ana Souza',
  '07:30',
  '12:30',
  '1',
  '1'
]);

fclose($output);
exit;
