<?php
/* php tests/today.test.php — Arizona workout day (America/Phoenix), independent of the WP/site/PHP timezone. */
define('ABSPATH', __DIR__ . '/');
define('DAY_IN_SECONDS', 86400);
date_default_timezone_set('UTC'); // like a site set to UTC; must not matter
require __DIR__ . '/../includes/data.php';
$pass = 0; $fail = 0;
function eq($a, $b, $m) { global $pass, $fail; if ($a === $b) $pass++; else { $fail++; echo "FAIL $m (got " . var_export($a, true) . ", want " . var_export($b, true) . ")\n"; } }
$ts = function ($iso) { return (new DateTimeImmutable($iso))->getTimestamp(); };
eq(oniko_fit_today($ts('2026-11-24T03:30:00Z')), '2026-11-23', '8:30 PM AZ session stays on the same day (not UTC 11/24)');
eq(oniko_fit_today($ts('2026-11-24T03:23:12Z')), '2026-11-23', 'oniko-5 completed 8:23 PM AZ is 11/23');
eq(oniko_fit_today($ts('2026-11-24T06:59:59Z')), '2026-11-23', '11:59:59 PM AZ same day');
eq(oniko_fit_today($ts('2026-11-24T07:00:00Z')), '2026-11-24', 'midnight AZ rolls over');
eq(oniko_fit_today($ts('2026-07-01T03:30:00Z')), '2026-06-30', 'no DST in summer');
date_default_timezone_set('Asia/Tokyo');
eq(oniko_fit_today($ts('2026-11-24T03:30:00Z')), '2026-11-23', 'PHP default timezone ignored');
$today = oniko_fit_today();
eq(oniko_fit_valid_date($today), true, 'today is a valid date');
eq(oniko_fit_valid_date(oniko_fit_today(time() + 86400)), true, 'tomorrow (AZ) allowed');
eq(oniko_fit_valid_date(oniko_fit_today(time() + 2 * 86400)), false, 'two days ahead (AZ) rejected');
eq(oniko_fit_valid_date('2019-12-31'), false, 'pre-2020 rejected');
eq(oniko_fit_valid_date('2026-02-30'), false, 'impossible date rejected');
echo "today tests: $pass passed, $fail failed\n";
exit($fail ? 1 : 0);
