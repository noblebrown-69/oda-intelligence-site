/* Oniko Fit service worker: caches the static app shell ONLY (plugin css/js/icons).
   Never caches pages, REST (/wp-json/), login, or anything with auth. */
var CACHE = 'oniko-fit-shell-__ONIKO_VERSION__';
var ASSETS = '__ONIKO_ASSETS__';
var SHELL = ['app.css', 'app.js', 'engine.js', 'icons/icon-192.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg'].map(function (p) { return ASSETS + p; });

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {}));
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
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
    return hit || net;
  }));
});
