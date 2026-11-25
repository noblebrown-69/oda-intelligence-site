/* Oniko Fit service worker: caches the static app shell ONLY (plugin css/js/icons/images).
   Never caches pages, REST (/wp-json/), login, or anything with auth.
   1.0.4: shell css/js are cached under their exact versioned URL (?ver=), fetched past the
   HTTP cache (the host sends max-age=1 year), and matched exactly. Before, the unversioned
   precache came out of the browser's year-long HTTP cache and ignoreSearch matching served it
   for every ?ver=, so a new app.js could run with a stale engine.js (1.0.3 hung on Loading). */
var VERSION = '__ONIKO_VERSION__';
var CACHE = 'oniko-fit-shell-' + VERSION;
var ASSETS = '__ONIKO_ASSETS__';
var SHELL = ['app.css', 'app.js', 'engine.js'].map(function (p) { return ASSETS + p + '?ver=' + VERSION; })
  .concat(['icons/icon-192.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg'].map(function (p) { return ASSETS + p; }));

/* Only a real 200 from our own origin is cacheable. A 202 bot-check page or an HTML error page
   served for a .js URL must never be stored as the script. */
function cacheable(req, res) {
  if (!res || res.status !== 200 || res.type !== 'basic') return false;
  var path = new URL(req.url || req, self.location.href).pathname;
  var ct = (res.headers.get('Content-Type') || '').toLowerCase();
  if (/\.js$/.test(path)) return ct.indexOf('javascript') !== -1;
  if (/\.css$/.test(path)) return ct.indexOf('css') !== -1;
  return ct.indexOf('text/html') === -1;
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      var req = new Request(u, { cache: 'reload' });
      return fetch(req).then(function (res) { if (cacheable(req, res)) return c.put(u, res); }).catch(function () {});
    }));
  }).catch(function () {}));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('oniko-fit-shell-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/wp-json/') !== -1 || url.search.indexOf('rest_route') !== -1 || url.pathname.indexOf('wp-login') !== -1 || url.pathname.indexOf('/wp-admin') !== -1) return;
  if (url.pathname.indexOf(ASSETS) !== 0) return; /* pages and everything else: network only */
  /* Exact-URL cache-first: a new ?ver= / ?v= is a cache miss and comes from the network. */
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (cacheable(req, res)) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
