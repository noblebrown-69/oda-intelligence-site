<?php
if (!defined('ABSPATH')) exit;

/* Settings > Oniko Fit: notify email list (default empty). */
add_action('admin_menu', function () {
    add_options_page('Oniko Fit', 'Oniko Fit', 'manage_options', 'oniko-fit', 'oniko_fit_settings_page');
});

add_action('admin_init', function () {
    register_setting('oniko_fit', 'oniko_fit_notify_emails', [
        'type' => 'string',
        'sanitize_callback' => function ($v) {
            $out = [];
            foreach (preg_split('/[\s,;]+/', (string) $v) as $e) {
                $e = sanitize_email($e);
                if ($e && is_email($e)) $out[] = $e;
            }
            return implode(', ', array_unique($out));
        },
        'default' => '',
    ]);
});

function oniko_fit_settings_page() {
    if (!current_user_can('manage_options')) return;
    echo '<div class="wrap"><h1>Oniko Fit</h1><form method="post" action="options.php">';
    settings_fields('oniko_fit');
    echo '<table class="form-table"><tr><th scope="row"><label for="oniko_fit_notify_emails">Notify emails</label></th><td>';
    echo '<textarea name="oniko_fit_notify_emails" id="oniko_fit_notify_emails" rows="3" class="large-text">' . esc_textarea((string) get_option('oniko_fit_notify_emails', '')) . '</textarea>';
    echo '<p class="description">Comma separated. Each completed workout sends a plain-text note here (for example the Grok bot inboxes). Leave empty to use only the poller queue.</p></td></tr></table>';
    submit_button();
    echo '</form><p>Give a member access on their profile (Users &rarr; Edit &rarr; Oniko Fit access), or <code>wp user add-cap &lt;login&gt; oniko_fit_use</code>.</p></div>';
}

/* Per-user access checkbox, administrators only. */
function oniko_fit_profile_box($user) {
    if (!current_user_can('promote_users')) return;
    wp_nonce_field('oniko_fit_access_' . $user->ID, 'oniko_fit_access_nonce');
    $on = user_can($user, 'oniko_fit_use');
    echo '<h2>Oniko Fit</h2><table class="form-table"><tr><th>Oniko Fit access</th><td><label><input type="checkbox" name="oniko_fit_access" value="1"' . checked($on, true, false) . '> Can use the Oniko Fit logger</label></td></tr></table>';
}
add_action('edit_user_profile', 'oniko_fit_profile_box');
add_action('show_user_profile', 'oniko_fit_profile_box');

function oniko_fit_profile_save($uid) {
    if (!current_user_can('promote_users')) return;
    if (!isset($_POST['oniko_fit_access_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['oniko_fit_access_nonce'])), 'oniko_fit_access_' . $uid)) return;
    $u = get_user_by('id', $uid);
    if (!$u || in_array('administrator', (array) $u->roles, true)) return;
    if (!empty($_POST['oniko_fit_access'])) $u->add_cap('oniko_fit_use'); else $u->remove_cap('oniko_fit_use');
}
add_action('edit_user_profile_update', 'oniko_fit_profile_save');
add_action('personal_options_update', 'oniko_fit_profile_save');
