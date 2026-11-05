<?php
if (!defined('ABSPATH')) exit;

function oniko_fit_can_use() {
    return is_user_logged_in() && current_user_can('oniko_fit_use');
}
function oniko_fit_can_poll() {
    return is_user_logged_in() && current_user_can('oniko_fit_poll');
}

add_action('rest_api_init', function () {
    $m = 'oniko_fit_can_use';
    $routes = [
        ['/day', 'GET', 'oniko_fit_rest_day', $m],
        ['/select', 'POST', 'oniko_fit_rest_select', $m],
        ['/set', 'POST', 'oniko_fit_rest_set', $m],
        ['/undo', 'POST', 'oniko_fit_rest_undo', $m],
        ['/effort', 'POST', 'oniko_fit_rest_effort', $m],
        ['/complete', 'POST', 'oniko_fit_rest_complete', $m],
        ['/prefs', 'POST', 'oniko_fit_rest_prefs', $m],
        ['/outbox', 'GET', 'oniko_fit_rest_outbox', 'oniko_fit_can_poll'],
        ['/ack', 'POST', 'oniko_fit_rest_ack', 'oniko_fit_can_poll'],
    ];
    foreach ($routes as $r) {
        register_rest_route(ONIKO_FIT_NS, $r[0], [
            'methods' => $r[1],
            'permission_callback' => $r[3],
            'callback' => $r[2],
        ]);
    }
});

/* No caching of any Oniko Fit REST response. */
add_filter('rest_post_dispatch', function ($res, $server, $req) {
    if (strpos($req->get_route(), '/' . ONIKO_FIT_NS) === 0 && $res instanceof WP_REST_Response) {
        $res->header('Cache-Control', 'no-store, private');
        $res->header('X-Robots-Tag', 'noindex, nofollow');
    }
    return $res;
}, 10, 3);

function oniko_fit_err($code, $msg, $status = 400) {
    return new WP_Error('oniko_' . $code, $msg, ['status' => $status]);
}

/* Per-user rate limit: $max calls per $win seconds for bucket. */
function oniko_fit_rate($bucket, $max, $win) {
    $uid = get_current_user_id();
    $key = 'oniko_rl_' . $bucket . '_' . $uid;
    $now = time();
    $st = get_transient($key);
    if (!is_array($st) || $st['t'] + $win < $now) $st = ['t' => $now, 'n' => 0];
    $st['n']++;
    set_transient($key, $st, $win);
    return $st['n'] <= $max;
}

function oniko_fit_guard(WP_REST_Request $req, $bucket = 'w', $max = 240, $win = 600) {
    if (strlen((string) $req->get_body()) > ONIKO_FIT_MAX_BODY) return oniko_fit_err('big', 'Request too large', 413);
    if (!oniko_fit_rate($bucket, $max, $win)) return oniko_fit_err('rate', 'Slow down a little and try again.', 429);
    return null;
}

function oniko_fit_req_date(WP_REST_Request $req) {
    $d = (string) $req->get_param('date');
    if ($d === '') $d = oniko_fit_today();
    return oniko_fit_valid_date($d) ? $d : null;
}

function oniko_fit_req_pw(WP_REST_Request $req) {
    $p = oniko_fit_program();
    $prog = (string) $req->get_param('program');
    $w = strtoupper((string) $req->get_param('workout'));
    if (!isset($p['programs'][$prog])) return null;
    if (!isset($p['programs'][$prog]['workouts'][$w])) return null;
    return [$prog, $w];
}

function oniko_fit_rest_day(WP_REST_Request $req) {
    if ($e = oniko_fit_guard($req, 'r', 600, 600)) return $e;
    $date = oniko_fit_req_date($req);
    if (!$date) return oniko_fit_err('date', 'Bad date');
    global $wpdb;
    $uid = get_current_user_id();
    $t = oniko_fit_t('sessions');
    $sess = oniko_fit_session($uid, $date);
    $hist = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $t WHERE user_id = %d AND wdate < %s ORDER BY wdate DESC LIMIT 80", $uid, $date
    ), ARRAY_A) ?: [];
    $ids = array_map(function ($r) { return (int) $r['id']; }, $hist);
    if ($sess) $ids[] = (int) $sess['id'];
    $sets = oniko_fit_sets_for($uid, $ids);
    $by = [];
    foreach ($sets as $s) $by[$s['session_id']][] = $s;
    $history = [];
    foreach (array_reverse($hist) as $h) {
        $o = oniko_fit_session_out($h);
        $o['sets'] = $by[(int) $h['id']] ?? [];
        $history[] = $o;
    }
    $today = null;
    if ($sess) { $today = oniko_fit_session_out($sess); $today['sets'] = $by[(int) $sess['id']] ?? []; }
    $prog = get_user_meta($uid, 'oniko_fit_program', true);
    return [
        'date' => $date,
        'today' => oniko_fit_today(),
        'session' => $today,
        'history' => $history,
        'prefs' => ['program' => in_array($prog, ['gym', 'home'], true) ? $prog : ''],
    ];
}

function oniko_fit_rest_prefs(WP_REST_Request $req) {
    if ($e = oniko_fit_guard($req)) return $e;
    $prog = (string) $req->get_param('program');
    if (!in_array($prog, ['gym', 'home'], true)) return oniko_fit_err('prog', 'Bad program');
    update_user_meta(get_current_user_id(), 'oniko_fit_program', $prog);
    return ['ok' => true, 'program' => $prog];
}

function oniko_fit_rest_select(WP_REST_Request $req) {
    if ($e = oniko_fit_guard($req)) return $e;
    $date = oniko_fit_req_date($req);
    $pw = oniko_fit_req_pw($req);
    if (!$date || !$pw) return oniko_fit_err('bad', 'Bad date or workout');
    global $wpdb;
    $uid = get_current_user_id();
    $sess = oniko_fit_session($uid, $date, ['program' => $pw[0], 'workout' => $pw[1]]);
    $wpdb->update(oniko_fit_t('sessions'), ['program' => $pw[0], 'workout' => $pw[1], 'updated_at' => current_time('mysql')],
        ['id' => (int) $sess['id'], 'user_id' => $uid], ['%s', '%s', '%s'], ['%d', '%d']);
    update_user_meta($uid, 'oniko_fit_program', $pw[0]);
    return ['ok' => true, 'session' => oniko_fit_session_out(oniko_fit_session($uid, $date))];
}

function oniko_fit_rest_set(WP_REST_Request $req) {
    if ($e = oniko_fit_guard($req)) return $e;
    $date = oniko_fit_req_date($req);
    $pw = oniko_fit_req_pw($req);
    $ex = (string) $req->get_param('ex');
    $p = oniko_fit_program();
    if (!$date || !$pw || !isset($p['exercises'][$ex])) return oniko_fit_err('bad', 'Bad set');
    $reps = $req->get_param('reps');
    $weight = $req->get_param('weight');
    if (!is_numeric($reps) || (int) $reps != $reps || $reps < 0 || $reps > 100) return oniko_fit_err('reps', 'Reps must be 0 to 100');
    if ($weight === null || $weight === '') $weight = 0;
    if (!is_numeric($weight) || $weight < 0 || $weight > 2000) return oniko_fit_err('weight', 'Weight must be 0 to 2000');
    $warm = filter_var($req->get_param('warm'), FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    global $wpdb;
    $uid = get_current_user_id();
    $sess = oniko_fit_session($uid, $date, ['program' => $pw[0], 'workout' => $pw[1]]);
    $t = oniko_fit_t('sets');
    $n = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE user_id = %d AND session_id = %d", $uid, (int) $sess['id']));
    if ($n >= 80) return oniko_fit_err('many', 'That is a lot of sets for one day.');
    $no = (int) $wpdb->get_var($wpdb->prepare("SELECT COALESCE(MAX(set_no),0) FROM $t WHERE user_id = %d AND session_id = %d AND ex = %s", $uid, (int) $sess['id'], $ex)) + 1;
    $wpdb->insert($t, [
        'user_id' => $uid, 'session_id' => (int) $sess['id'], 'wdate' => $date, 'program' => $pw[0], 'workout' => $pw[1],
        'ex' => $ex, 'set_no' => $no, 'reps' => (int) $reps, 'weight' => round((float) $weight, 2), 'warm' => $warm,
        'created_at' => current_time('mysql'),
    ], ['%d', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%f', '%d', '%s']);
    $wpdb->update(oniko_fit_t('sessions'), ['updated_at' => current_time('mysql')], ['id' => (int) $sess['id'], 'user_id' => $uid], ['%s'], ['%d', '%d']);
    return ['ok' => true, 'id' => (int) $wpdb->insert_id, 'set_no' => $no, 'sets' => oniko_fit_sets_for($uid, [(int) $sess['id']])];
}

function oniko_fit_rest_undo(WP_REST_Request $req) {
    if ($e = oniko_fit_guard($req)) return $e;
    $date = oniko_fit_req_date($req);
    $ex = (string) $req->get_param('ex');
    if (!$date || !preg_match('/^[a-z0-9_]{1,32}$/', $ex)) return oniko_fit_err('bad', 'Bad request');
    global $wpdb;
    $uid = get_current_user_id();
    $sess = oniko_fit_session($uid, $date);
    if (!$sess) return oniko_fit_err('none', 'Nothing to undo', 404);
    $t = oniko_fit_t('sets');
    $id = (int) $wpdb->get_var($wpdb->prepare("SELECT MAX(id) FROM $t WHERE user_id = %d AND session_id = %d AND ex = %s", $uid, (int) $sess['id'], $ex));
    if (!$id) return oniko_fit_err('none', 'Nothing to undo', 404);
    $wpdb->delete($t, ['id' => $id, 'user_id' => $uid], ['%d', '%d']);
    return ['ok' => true, 'removed' => $id, 'sets' => oniko_fit_sets_for($uid, [(int) $sess['id']])];
}

function oniko_fit_rest_effort(WP_REST_Request $req) {
    if ($e = oniko_fit_guard($req)) return $e;
    $date = oniko_fit_req_date($req);
    $ex = (string) $req->get_param('ex');
    $tap = (string) $req->get_param('tap');
    $p = oniko_fit_program();
    if (!$date || !isset($p['exercises'][$ex]) || !in_array($tap, ['Easy', 'Good', 'Hard', 'Grind', ''], true)) return oniko_fit_err('bad', 'Bad effort');
    global $wpdb;
    $uid = get_current_user_id();
    $sess = oniko_fit_session($uid, $date);
    if (!$sess) return oniko_fit_err('none', 'Log a set first', 404);
    $eff = json_decode($sess['effort'] ?: '{}', true) ?: [];
    if ($tap === '') unset($eff[$ex]); else $eff[$ex] = $tap;
    $wpdb->update(oniko_fit_t('sessions'), ['effort' => wp_json_encode((object) $eff), 'updated_at' => current_time('mysql')],
        ['id' => (int) $sess['id'], 'user_id' => $uid], ['%s', '%s'], ['%d', '%d']);
    return ['ok' => true, 'effort' => (object) $eff];
}

function oniko_fit_clean_line($s, $max = 240) {
    $s = wp_strip_all_tags((string) $s);
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s);
    return mb_substr(trim($s), 0, $max);
}

function oniko_fit_rest_complete(WP_REST_Request $req) {
    if ($e = oniko_fit_guard($req, 'c', 20, 3600)) return $e;
    $date = oniko_fit_req_date($req);
    if (!$date) return oniko_fit_err('date', 'Bad date');
    global $wpdb;
    $uid = get_current_user_id();
    $sess = oniko_fit_session($uid, $date);
    if (!$sess) return oniko_fit_err('none', 'Log at least one set first.', 404);
    $sets = oniko_fit_sets_for($uid, [(int) $sess['id']]);
    if (!$sets) return oniko_fit_err('none', 'Log at least one set first.', 400);
    $notes = oniko_fit_clean_line($req->get_param('notes'), ONIKO_FIT_MAX_NOTES);
    $fl = (array) $req->get_param('flags');
    $flags = [
        'low_energy' => !empty($fl['low_energy']) && filter_var($fl['low_energy'], FILTER_VALIDATE_BOOLEAN),
        'joint_pain' => !empty($fl['joint_pain']) && filter_var($fl['joint_pain'], FILTER_VALIDATE_BOOLEAN),
    ];
    $hl = [];
    foreach (array_slice((array) $req->get_param('highlights'), 0, 24) as $h) {
        $h = oniko_fit_clean_line($h, 240);
        if ($h !== '') $hl[] = $h;
    }
    $rev = (int) $sess['revision'] + 1;
    $now = current_time('mysql');
    $wpdb->update(oniko_fit_t('sessions'), [
        'status' => 'done', 'notes' => $notes, 'flags' => wp_json_encode($flags), 'revision' => $rev,
        'completed_at' => $now, 'updated_at' => $now,
    ], ['id' => (int) $sess['id'], 'user_id' => $uid], ['%s', '%s', '%s', '%d', '%s', '%s'], ['%d', '%d']);
    $user = wp_get_current_user();
    $member = $user->display_name ?: $user->user_login;
    $rec = [
        'schema' => 'oniko-fit/1',
        'workout_id' => 'oniko-' . (int) $sess['id'],
        'session_id' => (int) $sess['id'],
        'revision' => $rev,
        'user_id' => (int) $uid,
        'user_login' => $user->user_login,
        'member' => $member,
        'date' => $date,
        'program' => $sess['program'],
        'workout' => $sess['workout'],
        'completed_at' => get_gmt_from_date($now, 'c'),
        'sets' => array_map(function ($s) {
            return ['ex' => $s['ex'], 'set_no' => $s['set_no'], 'reps' => $s['reps'], 'weight' => $s['weight'], 'warm' => $s['warm'], 'logged_under' => $s['program'] . ' ' . $s['workout']];
        }, $sets),
        'effort' => json_decode($sess['effort'] ?: '{}', true) ?: (object) [],
        'flags' => $flags,
        'notes' => $notes,
        'highlights' => $hl,
    ];
    $text = oniko_fit_summary_text(array_merge($rec, ['effort' => (array) $rec['effort']]));
    $rec['summary_text'] = $text;
    $wpdb->insert(oniko_fit_t('outbox'), [
        'user_id' => $uid, 'session_id' => (int) $sess['id'], 'revision' => $rev, 'payload' => wp_json_encode($rec),
        'status' => 'pending', 'created_at' => $now,
    ], ['%d', '%d', '%d', '%s', '%s', '%s']);
    $mailed = false;
    $to = oniko_fit_notify_emails();
    if ($to) {
        $subject = sprintf('[Oniko Fit] %s — %s %s — %s', $member, ucfirst($sess['program']), $sess['workout'], $date);
        try {
            $mailed = (bool) wp_mail($to, $subject, $text, ['Content-Type: text/plain; charset=UTF-8']);
        } catch (\Throwable $t) {
            $mailed = false;
        }
    }
    return ['ok' => true, 'workout_id' => $rec['workout_id'], 'revision' => $rev, 'mailed' => $mailed, 'queued' => true, 'summary_text' => $text];
}

function oniko_fit_rest_outbox(WP_REST_Request $req) {
    global $wpdb;
    $t = oniko_fit_t('outbox');
    $status = (string) ($req->get_param('status') ?: 'pending');
    if (!in_array($status, ['pending', 'acked'], true)) $status = 'pending';
    $limit = max(1, min(100, (int) ($req->get_param('limit') ?: 50)));
    $rows = $wpdb->get_results($wpdb->prepare("SELECT id, payload, created_at FROM $t WHERE status = %s ORDER BY id ASC LIMIT %d", $status, $limit), ARRAY_A) ?: [];
    $out = [];
    foreach ($rows as $r) {
        $out[] = ['outbox_id' => (int) $r['id'], 'created_at' => $r['created_at'], 'record' => json_decode($r['payload'], true)];
    }
    return ['items' => $out];
}

function oniko_fit_rest_ack(WP_REST_Request $req) {
    if (strlen((string) $req->get_body()) > ONIKO_FIT_MAX_BODY) return oniko_fit_err('big', 'Request too large', 413);
    global $wpdb;
    $ids = array_slice(array_values(array_filter(array_map('intval', (array) $req->get_param('ids')))), 0, 200);
    if (!$ids) return oniko_fit_err('bad', 'No ids');
    $t = oniko_fit_t('outbox');
    $ph = implode(',', array_fill(0, count($ids), '%d'));
    $n = $wpdb->query($wpdb->prepare("UPDATE $t SET status = 'acked', acked_at = %s WHERE status = 'pending' AND id IN ($ph)", array_merge([current_time('mysql')], $ids)));
    return ['ok' => true, 'acked' => (int) $n];
}
