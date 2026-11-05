<?php
/**
 * Plugin Name: Oniko Fit
 * Description: Members-only novice workout logger (Gym 5x5 and Home 3x8-12). Data stays in WordPress; an Aegis poller pulls completed workouts. The site never dials out except optional wp_mail.
 * Version: 1.0.1
 * Author: Oda Intelligence
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

define('ONIKO_FIT_VERSION', '1.0.1');
define('ONIKO_FIT_FILE', __FILE__);
define('ONIKO_FIT_DIR', __DIR__);
define('ONIKO_FIT_NS', 'oniko-fit/v1');
define('ONIKO_FIT_MAX_BODY', 16384);
define('ONIKO_FIT_MAX_NOTES', 1000);

require_once ONIKO_FIT_DIR . '/includes/data.php';
require_once ONIKO_FIT_DIR . '/includes/rest.php';
require_once ONIKO_FIT_DIR . '/includes/front.php';
require_once ONIKO_FIT_DIR . '/includes/admin.php';

register_activation_hook(__FILE__, 'oniko_fit_activate');

function oniko_fit_activate() {
    oniko_fit_install_tables();
    add_role('oniko_poller', 'Oniko Poller', ['oniko_fit_poll' => true]);
    $poller = get_role('oniko_poller');
    if ($poller) { $poller->add_cap('oniko_fit_poll'); }
    $admin = get_role('administrator');
    if ($admin) { $admin->add_cap('oniko_fit_use'); }
    update_option('users_can_register', 0);
    if (get_option('oniko_fit_notify_emails', null) === null) {
        add_option('oniko_fit_notify_emails', '', '', false);
    }
    if (!get_page_by_path('oniko')) {
        wp_insert_post([
            'post_title'   => 'Oniko Fit',
            'post_name'    => 'oniko',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => '[oniko_fit]',
            'comment_status' => 'closed',
            'ping_status'  => 'closed',
        ]);
    }
}

function oniko_fit_install_tables() {
    global $wpdb;
    $c = $wpdb->get_charset_collate();
    $p = $wpdb->prefix;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta("CREATE TABLE {$p}oniko_sessions (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL,
        wdate date NOT NULL,
        program varchar(8) NOT NULL,
        workout char(1) NOT NULL,
        status varchar(8) NOT NULL DEFAULT 'open',
        effort text NULL,
        flags text NULL,
        notes text NULL,
        revision int(10) unsigned NOT NULL DEFAULT 0,
        created_at datetime NOT NULL,
        updated_at datetime NOT NULL,
        completed_at datetime NULL,
        PRIMARY KEY  (id),
        UNIQUE KEY user_day (user_id,wdate),
        KEY user_status (user_id,status)
    ) $c;");
    dbDelta("CREATE TABLE {$p}oniko_sets (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL,
        session_id bigint(20) unsigned NOT NULL,
        wdate date NOT NULL,
        program varchar(8) NOT NULL,
        workout char(1) NOT NULL,
        ex varchar(32) NOT NULL,
        set_no smallint(5) unsigned NOT NULL,
        reps smallint(5) unsigned NOT NULL,
        weight decimal(7,2) NOT NULL DEFAULT 0,
        warm tinyint(1) NOT NULL DEFAULT 0,
        created_at datetime NOT NULL,
        PRIMARY KEY  (id),
        KEY user_day (user_id,wdate),
        KEY session_id (session_id)
    ) $c;");
    dbDelta("CREATE TABLE {$p}oniko_outbox (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL,
        session_id bigint(20) unsigned NOT NULL,
        revision int(10) unsigned NOT NULL DEFAULT 1,
        payload longtext NOT NULL,
        status varchar(8) NOT NULL DEFAULT 'pending',
        created_at datetime NOT NULL,
        acked_at datetime NULL,
        PRIMARY KEY  (id),
        KEY status (status)
    ) $c;");
    update_option('oniko_fit_db_version', ONIKO_FIT_VERSION, false);
}

add_action('plugins_loaded', function () {
    if (get_option('oniko_fit_db_version') !== ONIKO_FIT_VERSION) {
        oniko_fit_install_tables();
    }
});
