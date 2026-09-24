<?php
/*
Template Name: Incidents
*/
get_header(); ?>
<main>
  <section class="hero stack-hero" style="--hero:url('<?php echo oda_asset('oda-stack.png'); ?>')">
    <div class="hero-veil"></div>
    <div class="hero-copy">
      <p class="eyebrow">Operations</p>
      <h1>Incidents</h1>
      <p class="sub">Blameless postmortems from a personal production stack. What broke, how it was found, what changed.</p>
    </div>
  </section>

  <article class="stack">
    <section>
      <p>When something breaks in Oda, it is written down. Each one follows the same shape: what happened, how it was found, the root cause, and what changed so it does not happen again.</p>
    </section>

    <section>
      <h2>Fabricated quotes in a published Yūkan edition</h2>
      <p><strong>When:</strong> 2026-09-23.</p>
      <p>The evening edition shipped with quotes from two people who do not appear to exist: a union spokesperson and an industry analyst, both invented by the writing model. The paper checked links and images, but nothing checked quotes. I found it reviewing our own published output.</p>
      <p><strong>Fix:</strong> a quote gate now runs at the editor desk before assembly. Every quote needs a named speaker and a URL fetched that run, or the quote is stripped or paraphrased. The corrected edition replaced the original on the front page and in the archive on Sept. 24. The gate runs on every edition from then on.</p>
    </section>

    <section>
      <h2>Yūkan desk and publish interrupts</h2>
      <p><strong>When:</strong> 2026-09-14 through 2026-09-22 (seven interrupt alerts).</p>
      <p>Editorial gates rejected drafts mid-run, and the pipeline stopped instead of recovering. Each stop raised an alert, and recovery playbooks resumed the run and waited for a human before publishing. The pipeline was hardened to rewrite and recover instead of quitting when a gate refuses. Interrupt count is published next to edition count as monitoring evidence.</p>
    </section>

    <section>
      <h2>Arc B580 hang and RAM collapse</h2>
      <p><strong>When:</strong> 2026-09-22 / 23.</p>
      <p>Arc memory-manager workers hung; free RAM on a 30 GiB box fell to about 1.6 GiB while process RSS explained only about 5 GiB. Mixed 100 Hz / 60 Hz refresh contributed. Fix: stop Desktop, lock both monitors to 60 Hz, retire the extra 8 GiB swapfile, return to a single 2 GiB swap, swappiness 10.</p>
    </section>

    <section>
      <h2>Grok Bot silent software-rendering fallback</h2>
      <p><strong>When:</strong> found during the same stability pass.</p>
      <p>The desktop client turned acceleration off when <code>hardwareAccelerationEnabled</code> was missing from settings — before Chromium flags applied. Fixed with a launcher that pins the key and runs on the Arc with ANGLE.</p>
    </section>

    <section>
      <h2>What changed</h2>
      <p>These incidents became standing rules: the main model is never restarted casually; any recovery that ends in publishing waits for a human; only the main model runs on the RTX 5080; swap stays small; and the Arc-driven displays run at 60 Hz.</p>
      <p class="cta-row">
        <a class="btn gold" href="<?php echo esc_url(home_url('/governance/')); ?>">See the operating policy</a>
      </p>
    </section>
  </article>
</main>
<?php get_footer(); ?>
