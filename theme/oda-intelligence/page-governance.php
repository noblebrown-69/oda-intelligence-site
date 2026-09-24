<?php
/*
Template Name: Governance
*/
get_header(); ?>
<main>
  <section class="hero stack-hero" style="--hero:url('<?php echo oda_asset('oda-stack.png'); ?>')">
    <div class="hero-veil"></div>
    <div class="hero-copy">
      <p class="eyebrow">Policy</p>
      <h1>How Oda is governed</h1>
      <p class="sub">Written rules the system actually follows. Mapped to NIST AI RMF and ISO/IEC 42001 language — not a certification claim.</p>
    </div>
  </section>

  <article class="stack">
    <section>
      <h2>Operating policy</h2>
      <p><strong>GPU tenancy.</strong> The RTX 5080 belongs to the main model alone. The Intel Arc B580 runs the desktop, other apps, and on-demand vision. The memory service runs on CPU. Photo and writing jobs are scheduled apart so they never compete for a card.</p>
      <p><strong>Public demo isolation.</strong> The members chat has no tools, no memory, every approval set to deny, a two-turn cap, and private network addresses blocked. It cannot read or write private memory.</p>
      <p><strong>Scheduled work runs; exceptions wait for a human.</strong> The daily paper publishes on schedule only after it clears every gate. Recovery runs, republishing, and corrections stop and wait for a human decision.</p>
      <p><strong>Secrets out of model context.</strong> Credentials live in locked files that scripts read at run time. They never go into prompts, agent charters, or the public demo.</p>
      <p><strong>Local-first data boundary.</strong> Inference and long-term memory run on hardware I own. Cloud assistants are separate tools and do not hold the house memory.</p>
      <p><strong>Content gates.</strong> Editorial gates reject bad drafts, and the paper rewrites instead of quitting. Fake or tiny lead images fail loud. A quote gate, added after we caught fabricated quotes in our own output, now strips any quote without a named speaker and a fetched source.</p>
    </section>

    <section>
      <h2>Framework mapping</h2>
      <p>Controls on this page are <em>mapped to</em> NIST AI RMF 1.0 functions (Govern, Map, Measure, Manage) and ISO/IEC 42001:2023 areas (clauses 4–10 and Annex A objectives such as policies, resources, lifecycle, data, and use). This site does not claim certification, audit completion, or EU AI Act conformity assessment.</p>
      <table style="width:100%;border-collapse:collapse;font-size:0.95em">
        <thead><tr><th style="text-align:left">Control</th><th style="text-align:left">NIST AI RMF</th><th style="text-align:left">ISO/IEC 42001 (mapped)</th></tr></thead>
        <tbody>
          <tr><td>GPU tenancy and job scheduling</td><td>Govern, Map, Manage</td><td>Cl. 6 Planning, Cl. 8 Operation; A.4 Resources</td></tr>
          <tr><td>Public demo isolation</td><td>Govern, Map, Manage</td><td>Cl. 8 Operation; A.6 Life cycle, A.9 Use, A.10 Third parties</td></tr>
          <tr><td>Human decision on exceptions</td><td>Govern, Manage</td><td>Cl. 5 Leadership, Cl. 8 Operation; A.9 Use</td></tr>
          <tr><td>Secrets out of model context</td><td>Govern, Map, Manage</td><td>Cl. 7 Support; A.2 Policies, A.7 Data</td></tr>
          <tr><td>Local-first data boundary</td><td>Map, Manage</td><td>Cl. 4 Context; A.4 Resources, A.7 Data</td></tr>
          <tr><td>Content gates, including the quote gate</td><td>Measure, Manage</td><td>Cl. 8, Cl. 9 Evaluation, Cl. 10 Improvement; A.5 Impact, A.6 Life cycle</td></tr>
          <tr><td>Interrupt alerts and recovery playbooks</td><td>Measure, Manage</td><td>Cl. 9, Cl. 10; A.6 Life cycle</td></tr>
          <tr><td>Blameless postmortems</td><td>Govern, Manage</td><td>Cl. 10 Improvement; A.5, A.6</td></tr>
          <tr><td>Update snapshots and patch restore</td><td>Govern, Measure, Manage</td><td>Cl. 8, Cl. 9; A.6 Life cycle</td></tr>
          <tr><td>Written charters for each specialist agent</td><td>Govern, Map</td><td>A.2 Policies, A.3 Internal organization, A.9 Use</td></tr>
          <tr><td>Red-team testing of the public demo</td><td>Measure</td><td>Cl. 9 Evaluation; A.5, A.6</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>Related</h2>
      <p class="cta-row">
        <a class="btn gold" href="<?php echo esc_url(home_url('/incidents/')); ?>">Incidents</a>
        <a class="btn" href="<?php echo esc_url(home_url('/redteam/')); ?>">Red team</a>
        <a class="btn" href="<?php echo esc_url(home_url('/stack/')); ?>">Stack</a>
      </p>
    </section>
  </article>
</main>
<?php get_footer(); ?>
