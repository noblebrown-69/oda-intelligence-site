<?php
if (!defined('ABSPATH')) exit;

add_action('init', function () {
    add_shortcode('oniko_fit', 'oniko_fit_shortcode');
});

function oniko_fit_is_app_page() {
    if (!is_singular()) return false;
    $post = get_queried_object();
    return $post instanceof WP_Post && has_shortcode($post->post_content, 'oniko_fit');
}

function oniko_fit_page_url() {
    $id = (int) get_option('oniko_fit_page_id', 0);
    if ($id && get_post_status($id) === 'publish') return get_permalink($id);
    $p = get_page_by_path('oniko');
    return $p ? get_permalink($p) : home_url('/oniko/');
}

function oniko_fit_asset($rel) {
    return plugins_url($rel, ONIKO_FIT_FILE);
}

/* Manifest and service worker served from the site root so the worker may control the app page path. */
add_action('template_redirect', function () {
    $what = isset($_GET['oniko_fit']) ? sanitize_key(wp_unslash($_GET['oniko_fit'])) : '';
    if ($what === 'manifest') {
        $url = oniko_fit_page_url();
        $path = wp_parse_url($url, PHP_URL_PATH) ?: '/';
        nocache_headers();
        header('Content-Type: application/manifest+json; charset=utf-8');
        header('X-Robots-Tag: noindex, nofollow');
        echo wp_json_encode([
            'name' => 'Oniko Fit',
            'short_name' => 'Oniko Fit',
            'description' => 'Log your workouts. Get a little stronger every week.',
            'start_url' => $path,
            'scope' => $path,
            'display' => 'standalone',
            'orientation' => 'portrait',
            'background_color' => '#0b0709',
            'theme_color' => '#0b0709',
            'icons' => [
                ['src' => oniko_fit_asset('assets/icons/icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
                ['src' => oniko_fit_asset('assets/icons/icon-512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
            ],
        ], JSON_UNESCAPED_SLASHES);
        exit;
    }
    if ($what === 'sw') {
        $path = wp_parse_url(oniko_fit_page_url(), PHP_URL_PATH) ?: '/';
        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-cache');
        header('Service-Worker-Allowed: ' . $path);
        $sw = file_get_contents(ONIKO_FIT_DIR . '/assets/sw.js');
        $assets = wp_parse_url(plugins_url('assets/', ONIKO_FIT_FILE), PHP_URL_PATH);
        echo str_replace(['__ONIKO_VERSION__', '__ONIKO_ASSETS__'], [ONIKO_FIT_VERSION, esc_js($assets)], $sw);
        exit;
    }
    if (oniko_fit_is_app_page()) {
        header('X-Robots-Tag: noindex, nofollow');
        header('Cache-Control: no-store, private');
        header('Referrer-Policy: same-origin');
    }
});

add_filter('wp_robots', function ($robots) {
    if (oniko_fit_is_app_page()) { $robots['noindex'] = true; $robots['nofollow'] = true; }
    return $robots;
});

add_action('wp_head', function () {
    if (!oniko_fit_is_app_page()) return;
    $m = esc_url(add_query_arg('oniko_fit', 'manifest', home_url('/')));
    echo "\n<!-- Oniko Fit -->\n";
    echo '<meta name="robots" content="noindex, nofollow">' . "\n";
    echo '<link rel="manifest" href="' . $m . '">' . "\n";
    echo '<meta name="theme-color" content="#0b0709">' . "\n";
    echo '<meta name="apple-mobile-web-app-capable" content="yes">' . "\n";
    echo '<meta name="mobile-web-app-capable" content="yes">' . "\n";
    echo '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' . "\n";
    echo '<meta name="apple-mobile-web-app-title" content="Oniko Fit">' . "\n";
    echo '<link rel="apple-touch-icon" href="' . esc_url(oniko_fit_asset('assets/icons/apple-touch-icon.png')) . '">' . "\n";
    echo '<link rel="icon" type="image/svg+xml" href="' . esc_url(oniko_fit_asset('assets/icons/favicon.svg')) . '">' . "\n";
}, 1);

/* iOS needs viewport-fit=cover for safe-area insets; add it if the theme's viewport lacks it. */
add_action('wp_head', function () {
    if (!oniko_fit_is_app_page()) return;
    echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' . "\n";
}, 2);

add_filter('body_class', function ($c) {
    if (oniko_fit_is_app_page()) $c[] = 'oniko-fit-page';
    return $c;
});

function oniko_fit_mask_svg($cls = 'oniko-mask') {
    return '<svg class="' . esc_attr($cls) . '" viewBox="0 0 64 64" aria-hidden="true" focusable="false">'
        . '<path d="M14 22 C8 14 8 6 12 2 C12 10 16 15 22 18 Z" fill="#e11d2e"/>'
        . '<path d="M50 22 C56 14 56 6 52 2 C52 10 48 15 42 18 Z" fill="#e11d2e"/>'
        . '<path d="M32 14 C18 14 12 24 12 34 C12 48 22 60 32 60 C42 60 52 48 52 34 C52 24 46 14 32 14 Z" fill="#c1121f" stroke="#ff3b4a" stroke-width="1.5"/>'
        . '<path d="M18 30 L28 34 L19 37 Z" fill="#0b0709"/><path d="M46 30 L36 34 L45 37 Z" fill="#0b0709"/>'
        . '<circle cx="22.5" cy="34" r="1.6" fill="#ffd2d6"/><circle cx="41.5" cy="34" r="1.6" fill="#ffd2d6"/>'
        . '<path d="M22 46 Q32 52 42 46 L40 50 Q32 55 24 50 Z" fill="#0b0709"/>'
        . '<path d="M25 47 L26.5 50.5 L28 47.8 Z M39 47 L37.5 50.5 L36 47.8 Z" fill="#f4eef0"/>'
        . '<path d="M24 24 Q32 20 40 24" stroke="#0b0709" stroke-width="2" fill="none"/>'
        . '</svg>';
}

function oniko_fit_shortcode() {
    wp_enqueue_style('oniko-fit', oniko_fit_asset('assets/app.css'), [], ONIKO_FIT_VERSION);
    if (!is_user_logged_in() || !current_user_can('oniko_fit_use')) {
        $in = is_user_logged_in();
        ob_start();
        echo '<div class="oniko oniko-wall" id="oniko-app">';
        echo oniko_fit_mask_svg('oniko-mask big');
        echo '<h1 class="neon">Oniko Fit</h1>';
        if ($in) {
            echo '<p>This account does not have Oniko Fit turned on yet. Ask Noble to switch it on.</p>';
        } else {
            echo '<p class="lead">Members only. Sign in.</p>';
            echo '<p><a class="btn primary" href="' . esc_url(wp_login_url(get_permalink())) . '">Sign in</a></p>';
            echo '<p class="muted">Accounts are by invite.</p>';
        }
        echo '</div>';
        return ob_get_clean();
    }
    wp_enqueue_script('oniko-engine', oniko_fit_asset('assets/engine.js'), [], ONIKO_FIT_VERSION, true);
    wp_enqueue_script('oniko-fit', oniko_fit_asset('assets/app.js'), ['oniko-engine'], ONIKO_FIT_VERSION, true);
    $u = wp_get_current_user();
    $cfg = [
        'root' => esc_url_raw(rest_url(ONIKO_FIT_NS . '/')),
        'nonce' => wp_create_nonce('wp_rest'),
        'today' => oniko_fit_today(),
        'name' => $u->first_name ?: $u->display_name,
        'sw' => esc_url_raw(add_query_arg('oniko_fit', 'sw', home_url('/'))),
        'scope' => wp_parse_url(get_permalink(), PHP_URL_PATH) ?: '/',
        'logout' => esc_url_raw(wp_logout_url(get_permalink())),
        'program' => oniko_fit_program(),
    ];
    wp_add_inline_script('oniko-engine', 'window.ONIKO_CFG = ' . wp_json_encode($cfg, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES) . ';', 'before');
    return '<div class="oniko" id="oniko-app"><div class="oniko-boot">' . oniko_fit_mask_svg('oniko-mask big') . '<p>Loading…</p></div>'
        . '<noscript><p>Oniko Fit needs JavaScript turned on.</p></noscript></div>';
}

/* App page feels like an app: no admin toolbar there. */
add_filter('show_admin_bar', function ($show) {
    return oniko_fit_is_app_page() ? false : $show;
});
