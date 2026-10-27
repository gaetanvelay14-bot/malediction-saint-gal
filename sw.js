/* Service worker : enregistre tout le jeu sur le téléphone pour le mode avion. */
importScripts("fichiers.js");
var CACHE_POLICES = "malediction-polices";

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION_CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
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

  // Polices Google : enregistrées au premier passage, puis servies hors ligne.
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

  // Fichiers du jeu : d'abord le téléphone, sinon le réseau.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    if (r) return r;
    return fetch(req).then(function (rep) {
      if (rep && rep.ok) { var copie = rep.clone(); caches.open(VERSION_CACHE).then(function (c) { c.put(req, copie); }); }
      return rep;
    }).catch(function () {
      if (req.mode === "navigate") return caches.match("index.html");
      return new Response("", { status: 504 });
    });
  }));
});
