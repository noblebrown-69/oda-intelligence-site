<?php
if (!defined('ABSPATH')) exit;

function oda_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'gallery', 'caption']);
    add_theme_support('custom-logo', [
        'height' => 80,
        'width'  => 80,
        'flex-height' => true,
        'flex-width'  => true,
    ]);
    register_nav_menus(['primary' => 'Primary']);
}
add_action('after_setup_theme', 'oda_setup');

function oda_assets() {
    wp_enqueue_style(
        'oda-fonts',
        'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;1,9..40,400&display=swap',
        [],
        null
    );
    wp_enqueue_style(
        'oda-site',
        get_template_directory_uri() . '/assets/site.css',
        ['oda-fonts'],
        '1.0.5'
    );
}
add_action('wp_enqueue_scripts', 'oda_assets');

add_filter('show_admin_bar', '__return_false');

function oda_ensure_pages() {
    $home_id = 0;
    $stack_id = 0;

    $home = get_page_by_path('home');
    if (!$home) {
        $home_id = wp_insert_post([
            'post_title'   => 'Home',
            'post_name'    => 'home',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => '',
        ]);
    } else {
        $home_id = $home->ID;
    }

    $stack = get_page_by_path('stack');
    if (!$stack) {
        $stack_id = wp_insert_post([
            'post_title'   => 'Stack',
            'post_name'    => 'stack',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => '',
        ]);
    } else {
        $stack_id = $stack->ID;
    }

    if ($stack_id) {
        update_post_meta($stack_id, '_wp_page_template', 'page-stack.php');
    }

    if ($home_id) {
        update_option('show_on_front', 'page');
        update_option('page_on_front', $home_id);
        update_option('page_for_posts', 0);
    }

    update_option('blogname', 'Oda Intelligence');
    update_option('blogdescription', 'Sovereign agent architecture.');
}
add_action('after_switch_theme', 'oda_ensure_pages');

function oda_asset($file) {
    return esc_url(get_template_directory_uri() . '/assets/' . $file);
}

/* ODA_PORTFOLIO_PAGES_v1 (2026-09-24): ensure portfolio pages exist with their templates. Runs once per version. */
function oda_ensure_portfolio_pages() {
    if (get_option('oda_portfolio_pages_v') === '1') return;
    $pages = [
        'governance' => ['Governance', 'page-governance.php'],
        'incidents'  => ['Incidents',  'page-incidents.php'],
        'redteam'    => ['Red Team',   'page-redteam.php'],
    ];
    foreach ($pages as $slug => $info) {
        $page = get_page_by_path($slug);
        $id = $page ? $page->ID : wp_insert_post([
            'post_title'   => $info[0],
            'post_name'    => $slug,
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => '',
        ]);
        if ($id && !is_wp_error($id)) {
            update_post_meta($id, '_wp_page_template', $info[1]);
        }
    }
    update_option('oda_portfolio_pages_v', '1');
}
add_action('init', 'oda_ensure_portfolio_pages', 20);

/* ODA_PORTFOLIO_PAGES_v2 (2026-09-24): Noble removed the About page. Unpublish it once. */
function oda_remove_about_page() {
    if (get_option('oda_about_removed_v') === '1') return;
    $page = get_page_by_path('about');
    if ($page && $page->post_status !== 'draft') {
        wp_update_post(['ID' => $page->ID, 'post_status' => 'draft']);
    }
    update_option('oda_about_removed_v', '1');
}
add_action('init', 'oda_remove_about_page', 21);
