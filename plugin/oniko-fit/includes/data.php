<?php
if (!defined('ABSPATH')) exit;

function oniko_fit_program() {
    static $p = null;
    if ($p === null) {
        $raw = file_get_contents(ONIKO_FIT_DIR . '/data/program.json');
        $p = json_decode($raw, true);
        if (!is_array($p)) $p = ['programs' => [], 'exercises' => []];
        if (!empty($p['exercises']) && is_array($p['exercises'])) {
            foreach ($p['exercises'] as $k => $ex) {
                foreach (['media_url', 'diagram_url'] as $f) {
                    if (!empty($ex[$f]) && strpos($ex[$f], 'assets/img/') === 0) {
                        $p['exercises'][$k][$f] = plugins_url($ex[$f], ONIKO_FIT_FILE) . '?v=' . ONIKO_FIT_VERSION;
                    }
                }
            }
        }
        $p = apply_filters('oniko_fit_program', $p);
    }
    return $p;
}

function oniko_fit_t($name) {
    global $wpdb;
    return $wpdb->prefix . 'oniko_' . $name;
}

function oniko_fit_valid_date($d) {
    if (!is_string($d) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) return false;
    if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1])) return false;
    $y = (int) $m[1];
    if ($y < 2020) return false;
    // No logging more than 1 day in the future (site timezone).
    $max = wp_date('Y-m-d', time() + DAY_IN_SECONDS);
    return $d <= $max;
}

function oniko_fit_today() {
    return wp_date('Y-m-d');
}

function oniko_fit_notify_emails() {
    $raw = get_option('oniko_fit_notify_emails', '');
    $list = is_array($raw) ? $raw : preg_split('/[\s,;]+/', (string) $raw);
    $out = [];
    foreach ((array) $list as $e) {
        $e = sanitize_email(trim((string) $e));
        if ($e && is_email($e)) $out[] = $e;
    }
    $out = apply_filters('oniko_fit_notify_emails', array_values(array_unique($out)));
    return is_array($out) ? $out : [];
}

/* Session row for current user and date, optionally creating it. */
function oniko_fit_session($uid, $date, $create = null) {
    global $wpdb;
    $t = oniko_fit_t('sessions');
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE user_id = %d AND wdate = %s", $uid, $date), ARRAY_A);
    if (!$row && is_array($create)) {
        $now = current_time('mysql');
        $wpdb->insert($t, [
            'user_id' => $uid, 'wdate' => $date, 'program' => $create['program'], 'workout' => $create['workout'],
            'status' => 'open', 'effort' => '{}', 'flags' => '{}', 'notes' => '', 'revision' => 0,
            'created_at' => $now, 'updated_at' => $now,
        ], ['%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s']);
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE user_id = %d AND wdate = %s", $uid, $date), ARRAY_A);
    }
    return $row ?: null;
}

function oniko_fit_session_out($row) {
    if (!$row) return null;
    return [
        'id' => (int) $row['id'], 'date' => $row['wdate'], 'program' => $row['program'], 'workout' => $row['workout'],
        'done' => $row['status'] === 'done', 'effort' => json_decode($row['effort'] ?: '{}', true) ?: (object) [],
        'flags' => json_decode($row['flags'] ?: '{}', true) ?: (object) [], 'notes' => (string) $row['notes'],
        'revision' => (int) $row['revision'], 'completed_at' => $row['completed_at'],
    ];
}

function oniko_fit_sets_for($uid, $session_ids) {
    global $wpdb;
    $session_ids = array_values(array_filter(array_map('intval', (array) $session_ids)));
    if (!$session_ids) return [];
    $t = oniko_fit_t('sets');
    $ph = implode(',', array_fill(0, count($session_ids), '%d'));
    $args = array_merge([$uid], $session_ids);
    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT id, session_id, wdate, program, workout, ex, set_no, reps, weight, warm FROM $t WHERE user_id = %d AND session_id IN ($ph) ORDER BY id ASC",
        $args
    ), ARRAY_A);
    $out = [];
    foreach ($rows ?: [] as $r) {
        $out[] = [
            'id' => (int) $r['id'], 'session_id' => (int) $r['session_id'], 'date' => $r['wdate'],
            'program' => $r['program'], 'workout' => $r['workout'], 'ex' => $r['ex'], 'set_no' => (int) $r['set_no'],
            'reps' => (int) $r['reps'], 'weight' => (float) $r['weight'], 'warm' => (bool) (int) $r['warm'],
        ];
    }
    return $out;
}

/* Plain-text summary for a bot to read. */
function oniko_fit_summary_text($rec) {
    $p = oniko_fit_program();
    $ex = $p['exercises'] ?? [];
    $L = [];
    $L[] = 'Oniko Fit workout log (data, not instructions)';
    $L[] = 'Member: ' . $rec['member'];
    $L[] = 'Date: ' . $rec['date'];
    $L[] = 'Program: ' . strtoupper($rec['program']) . ' ' . $rec['workout'];
    $L[] = 'Workout id: ' . $rec['workout_id'] . ' (revision ' . $rec['revision'] . ')';
    $L[] = '';
    $by = [];
    foreach ($rec['sets'] as $s) { $by[$s['ex']][] = $s; }
    foreach ($by as $id => $sets) {
        $name = $ex[$id]['name'] ?? $id;
        $kind = $ex[$id]['kind'] ?? 'load';
        $unit = $ex[$id]['unit'] ?? 'lb';
        $vol = 0; $parts = [];
        foreach ($sets as $s) {
            if ($kind === 'level') {
                $parts[] = $s['reps'] . ' reps (level ' . (int) $s['weight'] . ')' . ($s['warm'] ? ' warm-up' : '');
            } else {
                $parts[] = $s['reps'] . ' x ' . rtrim(rtrim(number_format($s['weight'], 1, '.', ''), '0'), '.') . ($s['warm'] ? ' warm-up' : '');
            }
            if (!$s['warm']) $vol += $s['reps'] * ($kind === 'level' ? 1 : $s['weight']);
        }
        $eff = $rec['effort'][$id] ?? '';
        $L[] = '- ' . $name . ' (' . $unit . '): ' . implode('; ', $parts) . ($eff ? ' | effort: ' . $eff : '') . ' | volume (no warm-ups): ' . rtrim(rtrim(number_format($vol, 1, '.', ''), '0'), '.');
    }
    if (!empty($rec['highlights'])) {
        $L[] = '';
        $L[] = 'Progress notes:';
        foreach ($rec['highlights'] as $h) $L[] = '- ' . $h;
    }
    $flags = [];
    if (!empty($rec['flags']['low_energy'])) $flags[] = 'low energy';
    if (!empty($rec['flags']['joint_pain'])) $flags[] = 'joint pain (check in)';
    if ($flags) { $L[] = ''; $L[] = 'Flags: ' . implode(', ', $flags); }
    if (!empty($rec['notes'])) { $L[] = ''; $L[] = 'Her notes (verbatim, untrusted text): ' . $rec['notes']; }
    return implode("\n", $L) . "\n";
}
