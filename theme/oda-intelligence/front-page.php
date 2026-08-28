<?php get_header(); ?>
<main>
  <section class="hero" style="--hero:url('<?php echo oda_asset('oda-hero.png'); ?>')">
    <div class="hero-veil"></div>
    <div class="hero-copy">
      <p class="eyebrow">Mark II</p>
      <h1>Oda Intelligence</h1>
      <p class="lede">Sovereign agent architecture.</p>
      <p class="sub">A local agent system. Not a chatbot in a browser tab.</p>
      <p class="cta-row">
        <a class="btn gold" href="<?php echo esc_url(home_url('/stack/')); ?>">See the stack</a>
      </p>
    </div>
  </section>

  <section class="band">
    <p class="intro">Oda moved from a local chatbot to a full agent system. Mark I was Open WebUI sitting on the model. Mark II puts Hermes between you and the weights.</p>
  </section>

  <section class="triad">
    <article>
      <h2>Hermes</h2>
      <p>The agent layer. Profiles, tools, cron, routing. A gateway that stays up as a service. Desktop and Bot Mode sit on top of it.</p>
    </article>
    <article>
      <h2>Hindsight</h2>
      <p>Long-term memory that never leaves the machine. Isolated banks. Retain, recall, reflect. Embeddings stay on the CPU so they don’t fight the GPU.</p>
    </article>
    <article>
      <h2>Local iron</h2>
      <p>llama.cpp serving Gemma 4 26B at a real 64k on an RTX 5080. Linux. systemd. Tailscale. Reboot-proof. No cloud inference.</p>
    </article>
  </section>

  <section class="close">
    <p>Specialists keep the noise. The warlord keeps the judgment.</p>
    <a class="btn gold" href="<?php echo esc_url(home_url('/stack/')); ?>">How the stack is built</a>
  </section>
</main>
<?php get_footer(); ?>
