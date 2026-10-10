<?php
// Serve the evening edition HTML (busts stale static cache on bare /yukan/).
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
readfile(__DIR__ . '/index.html');
