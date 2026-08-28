<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="<?php echo oda_asset('oda-crest.png'); ?>" type="image/png">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<header class="oda-nav">
  <a class="oda-brand" href="<?php echo esc_url(home_url('/')); ?>">
    <img src="<?php echo oda_asset('oda-crest.png'); ?>" alt="" width="36" height="36">
    <span>ODA</span>
  </a>
  <nav>
    <a href="<?php echo esc_url(home_url('/')); ?>"<?php if (is_front_page()) echo ' aria-current="page"'; ?>>Home</a>
    <a href="<?php echo esc_url(home_url('/stack/')); ?>"<?php if (is_page('stack')) echo ' aria-current="page"'; ?>>Stack</a>
    <a href="<?php echo esc_url(home_url('/chat/')); ?>"<?php if (is_page('chat')) echo ' aria-current="page"'; ?>>Chat</a>
  </nav>
</header>
