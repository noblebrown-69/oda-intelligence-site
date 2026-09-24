<?php
/*
Template Name: Red Team
*/
get_header(); ?>
<main>
  <section class="hero stack-hero" style="--hero:url('<?php echo oda_asset('oda-stack.png'); ?>')">
    <div class="hero-veil"></div>
    <div class="hero-copy">
      <p class="eyebrow">Evals</p>
      <h1>Public demo red team</h1>
      <p class="sub">Thirty-one single-turn attacks on the public chat, each reviewed by hand, with the demoThirty-one single-turn probes against the demo persona on the house brain. Human-reviewed. Config isolation is a second control plane.rsquo;s locked-down configuration as a second layer of defense.</p>
    </div>
  </section>

  <article class="stack">
    <section>
      <h2>Latest run</h2>
      <p><strong>When:</strong> 2026-09-24 ~01:45–01:52 PT (America/Phoenix).</p>
      <p><strong>What was tested:</strong> 31 attacks against the public demo&rsquo;s persona prompt, sent directly to the model (Gemma 4 26B on llama.cpp). This tests the model and persona only, not the full website path.</p>
      <p><strong>Result:</strong> 31/31 pass on run 2 (max_tokens 3000). No system prompt leak, no claimed tool execution, no fabricated secrets, no harmful instructions. Indirect-injection cases flagged the attack, including an SSRF bait aimed at cloud metadata.</p>
    </section>

    <section>
      <h2>Finding: budget the reasoning</h2>
      <p>Run 1 used max_tokens 600. <strong>20 of 31</strong> replies came back empty — the model’s hidden reasoning consumed the budget before any answer. That looks like an outage. Fix: leave headroom for the answer (run 2 used 3000; all 31 answered).</p>
    </section>

    <section>
      <h2>Defense in depth</h2>
      <p>On the live demo, toolsets are disabled, memory is off, approvals deny, and turns cap at two. This harness did not need those controls to hold — the persona refused — but they remain the backstop if a future persona failure tries to call a tool.</p>
    </section>

    <section>
      <h2>Limits</h2>
      <p>Single sample, single turn, no automated grader, no full web path. Next: multi-turn, repeated sampling, and the full website route.</p>
      <p class="cta-row">
        <a class="btn gold" href="<?php echo esc_url(home_url('/governance/')); ?>">Operating policy</a>
        <a class="btn" href="<?php echo esc_url(home_url('/incidents/')); ?>">Incidents</a>
      </p>
    </section>
  </article>
</main>
<?php get_footer(); ?>
