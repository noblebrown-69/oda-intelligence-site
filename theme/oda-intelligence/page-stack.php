<?php
/*
Template Name: Stack
*/
get_header(); ?>
<main>
  <section class="hero stack-hero" style="--hero:url('<?php echo oda_asset('oda-stack.png'); ?>')">
    <div class="hero-veil"></div>
    <div class="hero-copy">
      <p class="eyebrow">Architecture</p>
      <h1>The Mark III stack</h1>
      <p class="sub">What changed when one house brain became three compute lanes.</p>
    </div>
  </section>

  <article class="stack">
    <section>
      <h2>Three lanes</h2>
      <p>Mark III is not a new model. It is the same house on more than one machine. The house brain writes and decides. The library retrieves. The eyes look at photographs. Each lane has one job, and the rules keep them from fighting.</p>
    </section>
    <section>
      <h2>Hermes</h2>
      <p>Still the front door. The gateway, the specialist profiles, the schedules, the tools, and Desktop all live here. Every surface talks to Hermes, and Hermes routes the work: Hermes Desktop, Open WebUI, a phone over Tailscale, and email. Hindsight memory runs on the CPU and survives a reboot.</p>
    </section>
    <section>
      <h2>The library</h2>
      <p>This is the RAG return Mark II promised. Minamoto, an HP Z840, runs Qwen3-8B over a large shelf of books and documents, including a historical research shelf. Retrieve on the Z840, then write on Aegis. Minamoto also takes overflow. It fails soft: when the library is down, the house still answers.</p>
    </section>
    <section>
      <h2>GPU tenancy</h2>
      <p>The RTX 5080 belongs to the house brain. Nothing else runs there. The Intel Arc B580 runs the desktop, every non-Oda app, and the eyes: Qwen2-VL-2B through Vulkan, for captions and checking the lead photo. The eyes wake for the job and go back to sleep.</p>
    </section>
    <section>
      <h2>Specialists</h2>
      <p>Each specialist is a personality modeled on someone who excelled at the job. An operations lead orchestrates the floor. A books desk handles publishing work. A code specialist writes lean tools. A fitness specialist coaches training. A careers specialist runs job search. An AI research and stack monitor watches the house. An engineering analyst takes the hard problems. They are profiles sharing the brains, not separate model files. A near-identical roster runs on Grok in the cloud, and the cloud twins help train the local ones.</p>
    </section>
    <section>
      <h2>What ships</h2>
      <p>Yūkan, a daily local evening paper at <a href="<?php echo esc_url(home_url('/yukan/')); ?>">odaintelligence.com/yukan</a>. Specialists write it, an editor desk cleans it, Hermes assembles and publishes it. Photos run mid-morning and writers at noon so the GPUs don’t collide. A fake or tiny image fails loud.</p>
      <p>Oda Fit, a phone gym logger that writes into the same database the fitness specialist reads.</p>
      <p>The books desk locally, and Perkins on the xAI marketplace as Perkins by Noble.</p>
      <p>A members-only public chat demo. Thin. No tools. It cannot write private memory.</p>
    </section>
    <section>
      <h2>Hardening</h2>
      <p>This month: a paper that recovers instead of quitting when a gate refuses, a memory service that comes back on boot, GPU tenancy rules, and lean swap.</p>
    </section>
    <section>
      <h2>Why this matters</h2>
      <p>One box doing everything means every job waits on every other job. Three lanes means the writer never gives up its card, the library can go dark without taking the house with it, and vision stays off when nobody is looking. The specialists stay detailed. The public face stays thin. The house brain stays sharp.</p>
    </section>
    <section>
      <h2>Current shape</h2>
      <p>Surfaces on top: Hermes Desktop, Open WebUI, phone over Tailscale, email. Hermes gateway beneath them, routing to specialists. House brain on Aegis: llama.cpp, Gemma 4 26B at 64k, RTX 5080, Hindsight on CPU. Library on Minamoto: Qwen3-8B, RAG, overflow. Eyes on the Arc B580: Qwen2-VL-2B, on demand. Yūkan, Oda Fit, and the books desk ship on top.</p>
      <p>That’s the Mark III architecture.</p>
    </section>
    <section>
      <h2>What’s next</h2>
      <p>Keep climbing hardware. Denser models on a sidecar box are being weighed, not decided. More of the paper running unattended.</p>
    </section>
  </article>
</main>
<?php get_footer(); ?>
