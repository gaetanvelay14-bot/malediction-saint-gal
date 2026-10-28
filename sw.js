/* Service worker : enregistre tout le jeu sur le téléphone pour le mode avion.
   À chaque nouvelle version (VERSION_CACHE change), le téléphone retélécharge
   tous les fichiers en contournant son cache, puis le jeu se recharge tout seul. */
/* Liste des fichiers enregistrés sur le téléphone pour le mode avion.
   Utilisée par sw.js et par l'écran « Prêt pour le mode avion ».
   Changer VERSION_CACHE force la mise à jour sur les téléphones. */
var VERSION_CACHE = "malediction-v10";
var FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "fichiers.js",
  "lib/qrcode.js",
  "lib/jsQR.js",
  "carte-saint-gal.js",
  "config.js",
  "questions.js",
  "app.js",
  "manifest.webmanifest",
  "icone.svg",
  "qr.svg",
  "icone-192.png",
  "icone-512.png"
];

var CACHE_POLICES = "malediction-polices";

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION_CACHE).then(function (c) {
    return Promise.all(FICHIERS.map(function (f) {
      return fetch(new Request(f, { cache: "reload" })).then(function (r) { if (!r.ok) throw new Error(f); return c.put(f, r); });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== VERSION_CACHE && k !== CACHE_POLICES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE_POLICES).then(function (c) {
      return c.match(req).then(function (r) {
        var reseau = fetch(req).then(function (rep) { c.put(req, rep.clone()); return rep; }).catch(function () { return r; });
        return r || reseau;
      });
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION_CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (r) {
      if (r) return r;
      return fetch(req).then(function (rep) { if (rep && rep.ok && !url.search) c.put(req, rep.clone()); return rep; })
        .catch(function () { return req.mode === "navigate" ? c.match("index.html") : new Response("", { status: 504 }); });
    });
  }));
});
