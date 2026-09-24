<?php get_header(); ?>
<main>
  <section class="hero" style="--hero:url('<?php echo oda_asset('oda-hero.png'); ?>')">
    <div class="hero-veil"></div>
    <div class="hero-copy">
      <p class="eyebrow">Mark III</p>
      <h1>Oda Intelligence</h1>
      <p class="lede">Sovereign agent architecture.</p>
      <p class="sub">A local agent system on three compute lanes. Not a chatbot in a browser tab.</p>
      <p class="cta-row">
        <a class="btn gold" href="<?php echo esc_url(home_url('/stack/')); ?>">See the stack</a>
      </p>
    </div>
  </section>

  <section class="band">
    <p class="intro">Mark II put Hermes between you and the weights. Mark III spreads the house across more than one machine. One brain writes. One library searches the shelf. One set of eyes wakes only for photographs.</p>
  </section>

  <section class="triad">
    <article>
      <h2>House brain</h2>
      <p>Gemma 4 26B on llama.cpp at 64k, on an RTX 5080 in Aegis. Always on. Serves chat and every specialist. Nothing else is allowed on that card.</p>
    </article>
    <article>
      <h2>Library</h2>
      <p>A second machine, an HP Z840 called Minamoto, running Qwen3-8B. RAG search over a deep shelf of books and documents. Retrieve here, write on Aegis. If the library is down, the house still answers.</p>
    </article>
    <article>
      <h2>Eyes</h2>
      <p>An Intel Arc B580 running Qwen2-VL-2B through Vulkan. Photography only. On for the job, then off. The Arc also drives the desktop, so the 5080 stays clean.</p>
    </article>
  </section>

  <section class="close">
    <p>Specialists stay narrow. The operator keeps the judgment.</p>
    <a class="btn gold" href="<?php echo esc_url(home_url('/stack/')); ?>">How the stack is built</a>
  </section>
</main>
<?php get_footer(); ?>
