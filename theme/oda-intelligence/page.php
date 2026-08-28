<?php get_header(); ?>
<main class="band page-main">
<?php if (have_posts()) : while (have_posts()) : the_post(); ?>
  <article class="page-body">
    <?php the_content(); ?>
  </article>
<?php endwhile; endif; ?>
</main>
<?php get_footer();
