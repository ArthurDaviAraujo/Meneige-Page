<?php
// /api/auth/logout.php
declare(strict_types=1);

require_once __DIR__ . '/../_core/bootstrap.php';

require_method('POST');
do_logout();
json_response(true, null, 'Sessão encerrada');
