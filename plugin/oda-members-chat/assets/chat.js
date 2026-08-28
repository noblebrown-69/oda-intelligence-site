
(function () {
  const log = document.getElementById('oda-chat-log');
  const form = document.getElementById('oda-chat-form');
  const box = document.getElementById('oda-chat-text');
  if (!log || !form || !window.odaChat) return;

  function row(m) {
    const d = document.createElement('div');
    d.className = 'row';
    const pending = m.role === 'user' && m.status === 'pending';
    d.innerHTML = '<div class="who">' + (m.role === 'assistant' ? 'Oda' : 'You') + '</div>' +
      '<div class="body"></div>' + (pending ? '<div class="pending">Oda is thinking…</div>' : '');
    d.querySelector('.body').textContent = m.body || '';
    return d;
  }

  async function refresh() {
    const r = await fetch(odaChat.root + 'thread', { headers: { 'X-WP-Nonce': odaChat.nonce } });
    if (!r.ok) return;
    const data = await r.json();
    log.innerHTML = '';
    (data.messages || []).forEach(m => log.appendChild(row(m)));
    log.scrollTop = log.scrollHeight;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = box.value.trim();
    if (!text) return;
    box.value = '';
    await fetch(odaChat.root + 'message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': odaChat.nonce },
      body: JSON.stringify({ text })
    });
    refresh();
  });

  refresh();
  setInterval(refresh, 4000);
})();
