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
      <h1>The Mark II stack</h1>
      <p class="sub">What actually changed between a local chatbot and a sovereign agent system.</p>
    </div>
  </section>

  <article class="stack">
    <section>
      <h2>Remote access</h2>
      <p>The Telegram bridge is gone. It worked, but it added a third-party dependency and limited what you could do from a phone or another machine. Everything now routes through Tailscale. Same security model, cleaner access from any device, no extra service to maintain.</p>
    </section>
    <section>
      <h2>Hermes</h2>
      <p>This is the real architectural change.</p>
      <p>Mark I was Open WebUI sitting directly on top of the model. Mark II puts Hermes between the user and the model. Hermes is the agent layer. It owns the profiles, the tool calling, the scheduling, and the routing.</p>
      <p>There is a central Gateway that stays running as a systemd service. Multiple Bot Mode profiles sit behind it — one for the main Oda personality, one for operational coordination (Arsenal), and a set of specialist profiles for specific domains. Each profile has its own system prompt and its own memory context. The Desktop app is the local interface. Cron jobs live here too, so scheduled work survives reboots.</p>
    </section>
    <section>
      <h2>Hindsight</h2>
      <p>Hermes needed real long-term memory. Hindsight provides it.</p>
      <p>It runs as a local daemon with its own embedding model, forced onto the CPU so it doesn’t fight the GPU for VRAM. Memory is stored in isolated banks. The system supports retain, recall, and reflect. Nothing leaves the machine.</p>
    </section>
    <section>
      <h2>Memory hierarchy</h2>
      <p>Dumping everything into one vector store gets noisy fast. The hierarchy is deliberate.</p>
      <p>Specialist bots keep detailed working memory in their own private banks. They surface relevant status and decisions upward into Arsenal, the operational layer. Arsenal holds the current working picture. Only durable, high-value facts get promoted into the top-level Oda bank. That promotion happens on a weekly schedule.</p>
      <p>The main personality stays sharp. It has long-term context without being buried under every tactical detail from the specialists.</p>
    </section>
    <section>
      <h2>Why this matters</h2>
      <p>Most local setups either lose memory on reboot or slowly degrade as the context fills with irrelevant history. This design keeps the top layer clean while still giving the system real continuity across weeks and months. The specialists can be detailed and domain-specific without contaminating the core agent.</p>
    </section>
    <section>
      <h2>Current shape</h2>
      <p>User surfaces — Open WebUI, Hermes Desktop, email, Tailscale — sit on top of the Hermes Gateway. The Gateway talks to two parallel services: the llama.cpp inference server running the 26B model at a real 64k context, and the Hindsight daemon managing the memory banks. Everything runs under systemd on Linux, with an RTX 5080 and 32 GB of RAM. Fully local. Reboot-proof.</p>
      <p>That’s the Mark II architecture.</p>
    </section>
    <section>
      <h2>What’s next</h2>
      <p>Experimentation with the new Qwen 3.8 models, and a return to RAG and LoRA to bring Professor Terguson back onto the shelf. Stay tuned.</p>
    </section>
  </article>
</main>
<?php get_footer(); ?>
