<?php
// Copy this file to config.php and set the values for your environment.
declare(strict_types=1);
define('UPLOADS_DIR', realpath(__DIR__ . '/../../storage/uploads') ?: (__DIR__ . '/../../storage/uploads'));
define('UPLOADS_URL_BASE', '/storage/uploads');

const DB_HOST    = '127.0.0.1:3306';
const DB_NAME    = 'gestao_integral';
const DB_USER    = 'root';
const DB_PASS    = '';
const DB_CHARSET = 'utf8mb4';

const SESSION_NAME = 'GISESSID';
const APP_TZ = 'America/Sao_Paulo';

ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/../../error_log');
