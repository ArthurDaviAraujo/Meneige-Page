<?php
// /api/cursos/relatorio.php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../../vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;

require_auth();
$pdo = pdo();

$tipo  = $_GET['tipo']  ?? '';
$valor = trim($_GET['valor'] ?? '');

if (!$tipo || !$valor) {
  die('Parâmetros inválidos.');
}

/* =========================================================
   Funções auxiliares
========================================================= */

// Busca nome amigável para o título
function nome_referencia(PDO $pdo, string $tipo, string $valor): string {
  switch ($tipo) {
    case 'curso':
      $stmt = $pdo->prepare("SELECT nome FROM cursos WHERE id = :id OR nome LIKE :nome LIMIT 1");
      $stmt->execute([':id' => $valor, ':nome' => "%$valor%"]);
      return $stmt->fetchColumn() ?: $valor;

    case 'professor':
      $stmt = $pdo->prepare("SELECT DISTINCT professor_nome FROM cursos WHERE professor_nome LIKE :nome LIMIT 1");
      $stmt->execute([':nome' => "%$valor%"]);
      return $stmt->fetchColumn() ?: $valor;

    case 'aluno':
      $stmt = $pdo->prepare("SELECT nome FROM alunos WHERE id = :id OR nome LIKE :nome LIMIT 1");
      $stmt->execute([':id' => $valor, ':nome' => "%$valor%"]);
      return $stmt->fetchColumn() ?: $valor;
  }
  return $valor;
}

// Busca a logo mais recente em /uploads/
function logo_recente(): ?string {
  $dir = __DIR__ . '/../../uploads/';
  $arquivos = glob($dir . 'logo_escola_*.png');
  if (!$arquivos) return null;
  usort($arquivos, fn($a, $b) => filemtime($b) <=> filemtime($a));
  return 'data:image/png;base64,' . base64_encode(file_get_contents($arquivos[0]));
}

// Busca os dados do relatório
function buscar_dados(PDO $pdo, string $tipo, string $valor): array {
  switch ($tipo) {
    case 'professor':
      $sql = "SELECT 
                c.nome AS curso,
                c.professor_nome AS professor,
                a.nome AS aluno,
                a.responsavel,
                mc.status,
                FORMAT(c.preco_mensal,2,'de_DE') AS valor_matricula
              FROM cursos c
              JOIN curso_turmas ct ON ct.curso_id = c.id
              JOIN matriculas_curso mc ON mc.curso_turma_id = ct.id
              JOIN alunos a ON a.id = mc.aluno_id
              WHERE c.professor_nome LIKE :valor
              ORDER BY c.nome, a.nome";
      break;

    case 'curso':
      $sql = "SELECT 
                c.nome AS curso,
                c.professor_nome AS professor,
                a.nome AS aluno,
                a.responsavel,
                mc.status,
                FORMAT(c.preco_mensal,2,'de_DE') AS valor_matricula
              FROM cursos c
              JOIN curso_turmas ct ON ct.curso_id = c.id
              JOIN matriculas_curso mc ON mc.curso_turma_id = ct.id
              JOIN alunos a ON a.id = mc.aluno_id
              WHERE c.id = :id OR c.nome LIKE :valor
              ORDER BY a.nome";
      break;

    case 'aluno':
      $sql = "SELECT 
                a.nome AS aluno,
                a.responsavel,
                c.nome AS curso,
                c.professor_nome AS professor,
                mc.status,
                FORMAT(c.preco_mensal,2,'de_DE') AS valor_matricula
              FROM alunos a
              JOIN matriculas_curso mc ON mc.aluno_id = a.id
              JOIN curso_turmas ct ON ct.id = mc.curso_turma_id
              JOIN cursos c ON c.id = ct.curso_id
              WHERE a.id = :id OR a.nome LIKE :valor
              ORDER BY c.nome";
      break;

    default:
      return [];
  }

  $stmt = $pdo->prepare($sql);
  $stmt->execute([':id' => $valor, ':valor' => "%$valor%"]);
  return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/* =========================================================
   Execução
========================================================= */

$dados = buscar_dados($pdo, $tipo, $valor);
if (!$dados) die('Nenhum dado encontrado.');

$nomeRef = nome_referencia($pdo, $tipo, $valor);
$logo = logo_recente();

$titulo = match ($tipo) {
  'professor' => "Relatório de Cursos — Professor: $nomeRef",
  'curso'     => "Relatório de Alunos — Curso: $nomeRef",
  'aluno'     => "Relatório de Cursos — Aluno: $nomeRef",
  default     => "Relatório de Cursos"
};

/* =========================================================
   Montagem do PDF
========================================================= */

$options = new Options();
$options->set('isRemoteEnabled', true);
$dompdf = new Dompdf($options);

$css = "
body { font-family: DejaVu Sans, sans-serif; font-size:13px; color:#222; margin:40px; }
.header { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #555; padding-bottom:8px; margin-bottom:20px; }
.header img { height:50px; }
.header h1 { font-size:20px; margin:0; }
table { width:100%; border-collapse:collapse; margin-top:10px; }
th, td { border:1px solid #ccc; padding:8px 10px; text-align:left; }
th { background:#f5f5f5; font-weight:600; }
tfoot td { background:#fafafa; font-weight:bold; border-top:2px solid #999; }
footer { font-size:11px; text-align:center; margin-top:25px; color:#666; border-top:1px solid #ccc; padding-top:8px; }
";

$thead = "<tr>";
foreach (array_keys($dados[0]) as $col) {
  $thead .= "<th>" . ucfirst(str_replace('_',' ',$col)) . "</th>";
}
$thead .= "</tr>";

$tbody = "";
$total = 0;
foreach ($dados as $row) {
  $tbody .= "<tr>";
  foreach ($row as $k => $v) {
    $tbody .= "<td>" . htmlspecialchars((string)$v) . "</td>";
    if ($k === 'valor_matricula') $total += (float)str_replace(',', '.', $v);
  }
  $tbody .= "</tr>";
}
$total_fmt = 'R$ ' . number_format($total, 2, ',', '.');

$html = "
<html><head><meta charset='utf-8'><style>$css</style></head><body>
<div class='header'>
  <div><h1>$titulo</h1><div style='font-size:12px;color:#555;'>Gerado em ".date('d/m/Y H:i')."</div></div>
  " . ($logo ? "<img src='$logo'>" : "") . "
</div>
<table>
<thead>$thead</thead>
<tbody>$tbody</tbody>
<tfoot>
  <tr><td colspan='" . (count($dados[0]) - 1) . "' style='text-align:right;'>Total Geral:</td>
      <td>$total_fmt</td></tr>
</tfoot>
</table>
<footer>Relatório automático — Sistema Meneiger Page</footer>
</body></html>
";

$dompdf->loadHtml($html);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();
$dompdf->stream('relatorio_cursos.pdf', ['Attachment' => false]);
