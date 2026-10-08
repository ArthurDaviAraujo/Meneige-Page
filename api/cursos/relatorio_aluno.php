<?php
declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '1');

$GLOBALS['_no_json_header'] = true;

require_once __DIR__ . '/../_core/bootstrap.php';
require_once __DIR__ . '/../../vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;

$pdo = pdo();

$aluno_id = $_GET['aluno_id'] ?? '';
if (!$aluno_id) die('Parâmetro aluno_id obrigatório.');

/* =========================================================
   Funções auxiliares
========================================================= */
function logo_recente(): ?string {
  $dir = __DIR__ . '/../../uploads/';
  if (!is_dir($dir)) return null;
  $arquivos = glob($dir . 'logo_escola_*.png');
  if (!$arquivos) return null;
  usort($arquivos, fn($a, $b) => filemtime($b) <=> filemtime($a));
  return 'data:image/png;base64,' . base64_encode(file_get_contents($arquivos[0]));
}

/* =========================================================
   Busca dados do aluno e cursos matriculados
========================================================= */
$stmt = $pdo->prepare("
  SELECT a.nome AS aluno, a.responsavel, c.id AS curso_id, c.nome AS curso,
         c.professor_nome AS professor, c.preco_mensal AS preco
  FROM alunos a
  JOIN matriculas_curso mc ON mc.aluno_id = a.id
  JOIN curso_turmas ct ON ct.id = mc.curso_turma_id
  JOIN cursos c ON c.id = ct.curso_id
  WHERE a.id = :id
");
$stmt->execute([':id' => $aluno_id]);
$cursos = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (!$cursos) die('Aluno sem cursos matriculados.');

$aluno = $cursos[0]['aluno'];
$responsavel = $cursos[0]['responsavel'] ?? '';
$total = 0;
$totalPresGeral = 0;
$totalRegGeral = 0;

/* =========================================================
   Montagem HTML do relatório
========================================================= */
$logo = logo_recente();
$options = new Options();
$options->set('isRemoteEnabled', true);
$options->set('defaultFont', 'DejaVu Sans');
$dompdf = new Dompdf($options);

$css = "
body { font-family: DejaVu Sans, sans-serif; color:#222; margin:40px; }
.header { text-align:center; border-bottom:2px solid #444; margin-bottom:25px; padding-bottom:10px; }
.header img { height:60px; margin-bottom:10px; }
h1 { font-size:20px; color:#004aad; margin:4px 0; }
h2 { font-size:16px; color:#333; border-left:4px solid #666; padding-left:6px; margin-top:25px; }
table { width:100%; border-collapse:collapse; margin-top:8px; margin-bottom:16px; }
th, td { border:1px solid #ccc; padding:6px 8px; font-size:13px; text-align:left; }
th { background:#f5f5f5; }
tfoot td { font-weight:bold; border-top:2px solid #999; background:#fafafa; }
footer { font-size:11px; text-align:center; color:#666; border-top:1px solid #ccc; margin-top:25px; padding-top:6px; }
.barra { width:300px; height:16px; border-radius:8px; overflow:hidden; margin-top:4px; border:1px solid #ccc; }
.barra span { display:inline-block; height:100%; }
.barra .verde { background:#5cb85c; }
.barra .vermelho { background:#d9534f; }
.small { font-size:12px; color:#555; }
";

$html = "<html><head><meta charset='utf-8'><style>$css</style></head><body>";
$html .= "<div class='header'>";
if ($logo) $html .= "<img src='$logo'><br>";
$html .= "<h1>Relatório Individual — {$aluno}</h1>";
if ($responsavel) $html .= "<div>Responsável: <b>{$responsavel}</b></div>";
$html .= "<div class='small'>Gerado em " . date('d/m/Y H:i') . "</div>";
$html .= "</div>";

foreach ($cursos as $curso) {
  $curso_id = $curso['curso_id'];
  $valor = number_format((float)$curso['preco'], 2, ',', '.');
  $total += (float)$curso['preco'];

  $html .= "<h2>📘 Curso: {$curso['curso']}</h2>";
  $html .= "<div class='small'>Professor: <b>{$curso['professor']}</b>";

  $pres = $pdo->prepare("
    SELECT DATE_FORMAT(data, '%d/%m/%Y') AS data_fmt, status
    FROM presencas_extracurriculares
    WHERE aluno_id = :aluno AND curso_id = :curso
    ORDER BY data ASC
  ");
  $pres->execute([':aluno' => $aluno_id, ':curso' => $curso_id]);
  $presencas = $pres->fetchAll(PDO::FETCH_ASSOC);

  if ($presencas) {
    $html .= "<table><thead><tr><th>Data</th><th>Status</th></tr></thead><tbody>";
    $totalPres = 0; $totalAus = 0;

    foreach ($presencas as $p) {
      $statusTxt = $p['status'] === 'presente' ? '✅ Presente' : '❌ Ausente';
      if ($p['status'] === 'presente') $totalPres++; else $totalAus++;
      $html .= "<tr><td>{$p['data_fmt']}</td><td>{$statusTxt}</td></tr>";
    }

    $html .= "</tbody></table>";

    $totalReg = $totalPres + $totalAus;
    $percPres = $totalReg ? round(($totalPres / $totalReg) * 100, 1) : 0;
    $percAus = 100 - $percPres;

    $totalPresGeral += $totalPres;
    $totalRegGeral += $totalReg;

    $html .= "<div class='small'>Presença: <b>{$percPres}%</b> | Ausência: <b>{$percAus}%</b></div>";
    $html .= "<div class='barra'><span class='verde' style='width:{$percPres}%;'></span><span class='vermelho' style='width:{$percAus}%;'></span></div>";
  } else {
    $html .= "<p class='small' style='margin-left:8px;color:#777;'>Sem registros de presença neste curso.</p>";
  }
}

/* Média geral */
if ($totalRegGeral > 0) {
  $mediaGeral = round(($totalPresGeral / $totalRegGeral) * 100, 1);
  $html .= "<h2 style='margin-top:25px;'>📊 Média geral de presença: {$mediaGeral}%</h2>";
  $html .= "<div class='barra'><span class='verde' style='width:{$mediaGeral}%;'></span><span class='vermelho' style='width:" . (100 - $mediaGeral) . "%;'></span></div>";
}

/* Total financeiro */
$html .= "<table><tfoot><tr><td style='text-align:right;'>Total Geral:</td>
<td><b>R$ " . number_format($total, 2, ',', '.') . "</b></td></tr></tfoot></table>";

$html .= "<footer>Relatório automático — Sistema Meneiger Page</footer></body></html>";

$dompdf->loadHtml($html);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();
$dompdf->stream('relatorio_aluno.pdf', ['Attachment' => false]);
