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
    <div class="oda-nav-item has-sub<?php $on_ev = is_page(['governance','redteam','incidents']); if ($on_ev) echo ' is-current'; ?>">
      <a href="<?php echo esc_url(home_url('/governance/')); ?>" class="oda-nav-parent"<?php if ($on_ev) echo ' aria-current="page"'; ?>>Evidence</a>
      <div class="oda-subnav" role="menu">
        <a href="<?php echo esc_url(home_url('/governance/')); ?>" role="menuitem">Governance</a>
        <a href="<?php echo esc_url(home_url('/redteam/')); ?>" role="menuitem">Red Team</a>
        <a href="<?php echo esc_url(home_url('/incidents/')); ?>" role="menuitem">Incidents</a>
      </div>
    </div>
    <a href="<?php echo esc_url(home_url('/chat/')); ?>"<?php if (is_page('chat')) echo ' aria-current="page"'; ?>>Chat</a>
    <div class="oda-nav-item has-sub<?php
      $on_yukan = (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'] ?? '', '/yukan') === 0);
      if ($on_yukan) echo ' is-current';
    ?>">
      <a href="/yukan/" class="oda-nav-parent"<?php if (!empty($on_yukan)) echo ' aria-current="page"'; ?>>Yukan</a>
      <div class="oda-subnav" role="menu">
        <a href="/yukan/" role="menuitem">Today&apos;s Edition</a>
        <a href="/yukan/archive/" role="menuitem">Archive</a>
      </div>
    </div>
  </nav>
</header>
