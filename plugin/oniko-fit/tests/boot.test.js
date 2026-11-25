/* node tests/boot.test.js — the page app must never hang on the "Loading…" splash.
   Runs the real engine.js + app.js + the page's inline recovery script (from front.php) in a
   tiny fake DOM (no dependencies), with member history shaped like the live data, and checks
   the 1.0.3 failure: a stale cached engine.js (no azToday) under a new app.js. Also checks the
   service worker only caches exact versioned 200 script responses. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ENGINE = read('assets/engine.js'), APP = read('assets/app.js'), SW = read('assets/sw.js'), FRONT = read('includes/front.php');
const PROGRAM = JSON.parse(read('data/program.json'));
const VERSION = (read('oniko-fit.php').match(/define\('ONIKO_FIT_VERSION', '([^']+)'\)/) || [])[1];
const HIST = JSON.parse(read('tests/fixtures/member-history-2026-11-25.json')).sessions;
const RECOVER = (FRONT.match(/<<<'JS'\n([\s\S]*?)\nJS;/) || [])[1];
const AFTER = (FRONT.match(/wp_add_inline_script\('oniko-fit', '([^']+)', 'after'\)/) || [])[1];
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('FAIL', m); } }

/* ---- minimal DOM ---- */
class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.className = ''; this._text = ''; this.listeners = {}; this.value = ''; this.checked = false; }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  focus() {}
  get textContent() { return this.tagName === '#text' ? this._text : this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; if (this.tagName === '#text') this._text = String(v); else if (v !== '') this.children.push(text(String(v))); }
  set innerHTML(v) { this._html = v; this.content = { firstChild: new Node('svg') }; }
  querySelector(sel) { const cls = sel.replace(/^\./, ''); const walk = (n) => { for (const c of n.children) { if ((' ' + c.className + ' ').indexOf(' ' + cls + ' ') !== -1) return c; const r = walk(c); if (r) return r; } return null; }; return walk(this); }
  find(pred) { const walk = (n) => { for (const c of n.children) { if (pred(c)) return c; const r = walk(c); if (r) return r; } return null; }; return walk(this); }
}
function text(s) { const n = new Node('#text'); n._text = s; return n; }

function page(opts) {
  opts = opts || {};
  const app = new Node('div'); app.className = 'oniko';
  const boot = new Node('div'); boot.className = 'oniko-boot';
  const p = new Node('p'); p.textContent = 'Loading…'; boot.appendChild(p); app.appendChild(boot);
  const ss = Object.assign({}, opts.session || {});
  const calls = { reload: 0, unregister: 0, cacheDelete: [], fetch: [] };
  const regs = [{ active: { scriptURL: 'https://odaintelligence.com/?oniko_fit=sw' }, unregister() { calls.unregister++; return Promise.resolve(true); } }];
  const win = {
    ONIKO_CFG: { root: 'https://odaintelligence.com/wp-json/oniko-fit/v1/', nonce: 'n', today: opts.today || '2026-11-25', name: 'Member', sw: '', scope: '/oniko/', logout: '#', program: PROGRAM, version: VERSION },
    scrollY: 0, scrollTo() {}, console: { error() {}, log() {} },
    document: { getElementById: (id) => id === 'oniko-app' ? app : null, createElement: (t) => new Node(t), createTextNode: text },
    location: { search: opts.search || '', protocol: 'https:', reload() { calls.reload++; } },
    navigator: { serviceWorker: { register: () => Promise.resolve(), getRegistrations: () => Promise.resolve(regs) } },
    caches: { keys: () => Promise.resolve(['oniko-fit-shell-1.0.3', 'other']), delete: (k) => { calls.cacheDelete.push(k); return Promise.resolve(true); } },
    localStorage: { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); } },
    sessionStorage: { getItem: (k) => (k in ss ? ss[k] : null), setItem: (k, v) => { ss[k] = String(v); }, removeItem: (k) => { delete ss[k]; } },
    fetch: (url) => { calls.fetch.push(url); return opts.fetch ? opts.fetch(url) : serve(url); },
    setTimeout: (f, ms) => { if (ms < 1000) setTimeout(f, ms); return 0; },
    Promise, Date, Math, JSON, Intl, URL, Error, Object, Array, String, Number, isFinite, encodeURIComponent,
  };
  win.window = win; win.self = win;
  vm.createContext(win);
  return { win, app, calls, ss };
}
function serve(url) {
  const date = new URL(url).searchParams.get('date');
  const body = { date, today: '2026-11-25', session: HIST.find((s) => s.date === date) || null, history: HIST.filter((s) => s.date < date), prefs: { program: 'gym' } };
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(body))) });
}
function run(pg, opts) {
  opts = opts || {};
  vm.runInContext(RECOVER, pg.win);
  if (opts.engine !== false) vm.runInContext(opts.engineSrc || ENGINE, pg.win);
  if (opts.engineMutate) opts.engineMutate(pg.win.OnikoEngine);
  if (opts.app !== false) { try { vm.runInContext(APP, pg.win); } catch (e) { pg.threw = e; } }
  vm.runInContext(AFTER, pg.win);
}
const settle = () => new Promise((r) => setTimeout(r, 30));
const stuck = (app) => app.textContent.trim() === 'Loading…';

(async function () {
  ok(!!RECOVER && !!AFTER, 'front.php inline recovery + after-guard found');
  ok(VERSION && /var VERSION = '([^']+)'/.exec(ENGINE)[1] === VERSION, 'engine.js VERSION equals ONIKO_FIT_VERSION (' + VERSION + ')');

  // 1. Live data shape: every day boots and renders (no hang, no exception).
  for (const d of ['2026-11-25', '2026-11-24', '2026-11-23', '2026-11-17', '2026-11-16', '2026-11-13']) {
    const pg = page({ search: d === '2026-11-25' ? '' : '?d=' + d });
    run(pg); await settle();
    ok(!pg.threw, d + ' app.js did not throw ' + (pg.threw && pg.threw.message));
    ok(pg.win.OnikoApp && pg.win.OnikoApp.booted, d + ' booted');
    ok(!stuck(pg.app), d + ' not stuck on Loading');
    ok(pg.app.textContent.indexOf('Hi Member') !== -1, d + ' shows the app');
    ok(pg.calls.reload === 0, d + ' no recovery reload');
    if (d === '2026-11-25') ok(pg.win.OnikoApp.state.workout === 'B', 'after 11/24 Gym A, today suggests Gym B (got ' + pg.win.OnikoApp.state.workout + ')');
    if (d === '2026-11-24') ok(pg.app.textContent.indexOf('Workout logged!') !== -1 && pg.app.textContent.indexOf('Gym A') !== -1, '11/24 shows logged Gym A');
    if (d === '2026-11-23') ok(pg.app.textContent.indexOf('Gym B') !== -1, '11/23 shows Gym B');
  }

  // 2. The 1.0.3 bug: stale cached engine (1.0.0 had no azToday and no VERSION) under new app.js.
  const stale = (E) => { delete E.azToday; delete E.VERSION; };
  let pg = page(); run(pg, { engineMutate: stale }); await settle();
  ok(!pg.threw, 'stale engine: app.js does not throw (' + (pg.threw && pg.threw.message) + ')');
  ok(pg.calls.reload >= 1, 'stale engine: first time reloads after cleanup');
  ok(pg.calls.unregister === 1, 'stale engine: Oniko Fit service worker unregistered');
  ok(pg.calls.cacheDelete.join() === 'oniko-fit-shell-1.0.3', 'stale engine: only Oniko Fit caches deleted (' + pg.calls.cacheDelete.join() + ')');
  pg = page({ session: { oniko_fit_recover: '1' } }); run(pg, { engineMutate: stale }); await settle();
  ok(pg.calls.reload === 0, 'stale engine, already retried: no reload loop');
  ok(!stuck(pg.app) && /could not start/.test(pg.app.textContent), 'stale engine, already retried: shows a message, not Loading (' + pg.app.textContent.slice(0, 80) + ')');
  ok(!!pg.app.find((n) => n.tagName === 'button' && n.textContent === 'Reload'), 'stale engine: Reload button');
  // Older engine that has azToday but is another release (silently wrong progression rules before).
  pg = page(); run(pg, { engineMutate: (E) => { E.VERSION = '1.0.3'; } }); await settle();
  ok(pg.calls.reload === 1 && !pg.win.OnikoApp, 'engine from another release is refused and recovered');

  // 3. Scripts never arrived (blocked, offline, bot-check page served instead of JS).
  pg = page(); run(pg, { engine: false, app: false }); await settle();
  ok(pg.calls.reload === 1, 'no scripts: after-guard triggers recovery');
  pg = page({ session: { oniko_fit_recover: '1' } }); run(pg, { engine: false }); await settle();
  ok(/engine\.js did not load|could not start/.test(pg.app.textContent) && !stuck(pg.app), 'no engine: message shown');

  // 4. Successful boot clears the one-shot recovery flag.
  pg = page({ session: { oniko_fit_recover: '1' } }); run(pg); await settle();
  ok(pg.win.OnikoApp.booted && !('oniko_fit_recover' in pg.ss), 'good boot clears recovery flag');

  // 5. REST failures show a message, not Loading.
  pg = page({ fetch: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ message: 'Server error' }) }) });
  run(pg); await settle();
  ok(/Server error/.test(pg.app.textContent) && !/Loading/.test(pg.app.textContent), 'REST 500: message shown');
  pg = page({ fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null) }) });
  run(pg); await settle();
  ok(/empty reply/.test(pg.app.textContent), 'REST null body: message shown');
  // Session naming a workout the program does not have: falls back instead of crashing render.
  pg = page({ fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ date: '2026-11-25', session: { id: 9, date: '2026-11-25', program: 'gym', workout: 'Z', done: false, effort: [], sets: [] }, history: HIST, prefs: {} }) }) });
  run(pg); await settle();
  ok(pg.win.OnikoApp.state.workout === 'A' && /Hi Member/.test(pg.app.textContent), 'unknown workout letter falls back to A');

  // 6. Service worker: versioned, exact-match, HTTP-cache-bypassing, 200-only shell.
  const put = [], matchOpts = [], fetched = [];
  let handlers = {};
  const swEnv = {
    location: { href: 'https://odaintelligence.com/?oniko_fit=sw', origin: 'https://odaintelligence.com' },
    addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim: () => Promise.resolve() },
    caches: {
      open: () => Promise.resolve({ put: (k, r) => { put.push(typeof k === 'string' ? k : k.url); return Promise.resolve(); } }),
      keys: () => Promise.resolve([]), delete: () => Promise.resolve(true),
      match: (req, o) => { matchOpts.push(o); return Promise.resolve(undefined); },
    },
    Request: function (u, o) { this.url = new URL(u, 'https://odaintelligence.com/').href; this.cache = o && o.cache; },
    fetch: (req) => {
      fetched.push(req);
      const u = req.url || req;
      const isJs = /\.js(\?|$)/.test(u);
      const status = /engine\.js/.test(u) ? 202 : 200; // bot-check page for engine.js
      const ct = status === 202 ? 'text/html' : (isJs ? 'application/javascript' : /\.css/.test(u) ? 'text/css' : 'image/png');
      return Promise.resolve({ status, type: 'basic', ok: true, headers: { get: () => ct }, clone() { return this; } });
    },
    URL, Promise,
  };
  swEnv.self = swEnv;
  vm.createContext(swEnv);
  vm.runInContext(SW.replace(/__ONIKO_VERSION__/g, VERSION).replace(/__ONIKO_ASSETS__/g, '/wp-content/plugins/oniko-fit/assets/'), swEnv);
  let waited; handlers.install({ waitUntil: (p) => { waited = p; } }); await waited;
  ok(fetched.length === 6 && fetched.every((r) => r.cache === 'reload'), 'install fetches shell past the HTTP cache (cache: reload)');
  ok(put.indexOf('/wp-content/plugins/oniko-fit/assets/app.js?ver=' + VERSION) !== -1, 'app.js cached under its versioned URL');
  ok(!put.some((u) => /engine\.js/.test(u)), '202 bot-check page for engine.js is not cached');
  ok(!put.some((u) => /\/(app|engine)\.js$/.test(u)), 'no unversioned script keys');
  let resp; handlers.fetch({ request: { method: 'GET', url: 'https://odaintelligence.com/wp-content/plugins/oniko-fit/assets/app.js?ver=' + VERSION }, respondWith: (p) => { resp = p; } });
  await resp;
  ok(matchOpts.length === 1 && !(matchOpts[0] && matchOpts[0].ignoreSearch), 'asset lookups match the exact URL (no ignoreSearch)');

  console.log(pass + '/' + (pass + fail) + ' boot checks passed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.stack); process.exit(1); });
