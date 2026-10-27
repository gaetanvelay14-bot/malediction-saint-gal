/* La Malédiction de Saint-Gal — moteur du jeu.
   JavaScript sans dépendance : rien à compiler, rien à télécharger pendant la partie.
   Le contenu (lieux, énigmes, réponses) est dans data.js. */
(function () {
  "use strict";

  var CLE = "malediction-saint-gal-v1";
  var app = document.getElementById("app");
  var nav = document.getElementById("nav");

  /* ------------------------------------------------------------------ */
  /* Sauvegarde locale                                                  */
  /* ------------------------------------------------------------------ */
  function etatVierge() {
    return { ecran: "accueil", gps: false, equipe: null, debut: null, fin: null, courant: null, etapes: {}, son: true, victoire: false, codeOuvert: false };
  }
  var S = charger();
  function charger() {
    try {
      var brut = localStorage.getItem(CLE);
      if (brut) { var e = JSON.parse(brut); return Object.assign(etatVierge(), e); }
    } catch (err) { /* stockage indisponible : on joue quand même */ }
    return etatVierge();
  }
  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(S)); return true; } catch (err) { return false; }
  }
  function etape(id) {
    if (!S.etapes[id]) S.etapes[id] = { phase: "chercher", indM: 0, indG: 0, fini: false, heure: null, aide: false };
    return S.etapes[id];
  }
  function donneesEtape(id) { return JEU.etapes.filter(function (e) { return e.id === id; })[0]; }
  function equipe() { return JEU.equipes.filter(function (e) { return e.id === S.equipe; })[0]; }
  function nbFinies() { return JEU.etapes.filter(function (e) { return S.etapes[e.id] && S.etapes[e.id].fini; }).length; }
  function prochaineEtape() {
    var eq = equipe(); if (!eq) return null;
    for (var i = 0; i < eq.ordre.length; i++) { if (!(S.etapes[eq.ordre[i]] && S.etapes[eq.ordre[i]].fini)) return eq.ordre[i]; }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Outils                                                             */
  /* ------------------------------------------------------------------ */
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function normaliser(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  }
  // Accepte aussi la réponse précédée d'un article : « une citrouille », « le chapeau »…
  function formes(t) {
    var brut = String(t || "").toLowerCase().trim(), n = normaliser(brut), f = [n];
    var m = brut.match(/^(une|un|les|le|la|l')\s*(.+)$/);
    if (m) f.push(normaliser(m[2]));
    return f.filter(Boolean);
  }
  function bonneReponse(saisie, liste) {
    var s = formes(saisie); if (!s.length) return false;
    return liste.some(function (r) { var a = formes(r); return s.some(function (x) { return a.indexOf(x) >= 0; }); });
  }
  function duree(ms) { var m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return m + " min " + (s < 10 ? "0" : "") + s + " s"; }
  function toast(txt) {
    var t = document.createElement("div"); t.className = "toast"; t.textContent = txt; t.setAttribute("role", "status");
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2400);
  }
  function vibrer(motif) { try { if (navigator.vibrate) navigator.vibrate(motif); } catch (e) {} }

  /* ------------------------------------------------------------------ */
  /* Sons synthétisés (aucun fichier audio à télécharger)               */
  /* ------------------------------------------------------------------ */
  var ctx = null;
  function audio() {
    if (!S.son) return null;
    try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch (e) { return null; }
  }
  function note(freq, debut, dureeS, type, vol) {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    var t0 = a.currentTime + debut;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dureeS);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dureeS + 0.05);
  }
  var son = {
    bon: function () { note(660, 0, .18, "triangle"); note(880, .12, .3, "triangle"); vibrer(60); },
    faux: function () { note(180, 0, .25, "sawtooth", .12); note(140, .15, .3, "sawtooth", .1); vibrer([80, 60, 80]); },
    fantome: function () {
      var a = audio(); if (!a) return;
      var o = a.createOscillator(), g = a.createGain(); o.type = "sine";
      var t = a.currentTime; o.frequency.setValueAtTime(300, t); o.frequency.linearRampToValueAtTime(520, t + .6); o.frequency.linearRampToValueAtTime(260, t + 1.4);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.15, t + .2); g.gain.exponentialRampToValueAtTime(.0001, t + 1.5);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 1.6);
    },
    tresor: function () { [523, 659, 784, 1047].forEach(function (f, i) { note(f, i * .14, .35, "triangle", .18); }); vibrer([60, 40, 60, 40, 120]); },
    victoire: function () { [392, 523, 659, 784, 659, 784, 1047].forEach(function (f, i) { note(f, i * .16, .4, "square", .08); note(f / 2, i * .16, .4, "triangle", .1); }); vibrer([100, 50, 100, 50, 300]); }
  };

  /* ------------------------------------------------------------------ */
  /* Lecture à voix haute (pour les enfants qui ne lisent pas)          */
  /* ------------------------------------------------------------------ */
  var voixFr = null;
  function chercherVoix() {
    try {
      var v = speechSynthesis.getVoices();
      voixFr = v.filter(function (x) { return /^fr/i.test(x.lang) && x.localService; })[0] || v.filter(function (x) { return /^fr/i.test(x.lang); })[0] || null;
    } catch (e) {}
  }
  if ("speechSynthesis" in window) { chercherVoix(); try { speechSynthesis.onvoiceschanged = chercherVoix; } catch (e) {} }
  function parler(txt, bouton) {
    if (!("speechSynthesis" in window)) { toast("La lecture à voix haute n'existe pas sur ce téléphone. Un grand peut lire !"); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(txt.replace(/[\u{1F300}-\u{1FAFF}☀-➿️‍]/gu, " "));
      u.lang = "fr-FR"; u.rate = .92; u.pitch = 1; if (voixFr) u.voice = voixFr;
      if (bouton) { bouton.classList.add("parle"); u.onend = u.onerror = function () { bouton.classList.remove("parle"); }; }
      speechSynthesis.speak(u);
    } catch (e) { toast("Lecture impossible. Un grand peut lire !"); }
  }
  function boutonVoix(txt) { return '<button class="voix" data-dire="' + esc(txt) + '" aria-label="Écouter le texte">🔊</button>'; }

  /* ------------------------------------------------------------------ */
  /* GPS en direct (facultatif : le jeu marche sans)                     */
  /* ------------------------------------------------------------------ */
  var gps = { suivi: null, pos: null, erreur: null, premier: true, annonce: {} };
  function versCarte(lat, lng) { return [(lng - CARTE_SG.ouest) * CARTE_SG.kx, (CARTE_SG.nord - lat) * CARTE_SG.ky]; }
  function lancerGPS() {
    if (!("geolocation" in navigator)) { gps.erreur = "Ce téléphone ne donne pas sa position. Le jeu marche sans."; majGPS(); return; }
    if (gps.suivi !== null) return;
    gps.erreur = null;
    try {
      gps.suivi = navigator.geolocation.watchPosition(function (p) {
        gps.pos = { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy };
        gps.erreur = null;
        if (!S.gps) { S.gps = true; sauver(); }
        if (gps.premier) { gps.premier = false; if (dansLeVillage()) { carte.suivre = true; } }
        if (carte.suivre && carte.vue && dansLeVillage()) { var m = versCarte(gps.pos.lat, gps.pos.lng); centrerSur(m[0], m[1]); }
        majGPS(); verifierArrivee();
      }, function (err) {
        gps.erreur = err && err.code === 1
          ? "Localisation refusée. Autorisez-la dans les réglages du téléphone (Localisation → navigateur), puis rouvrez le jeu."
          : "Signal GPS introuvable pour l'instant. Restez à découvert quelques secondes. Le jeu marche sans.";
        if (err && err.code === 1) { gps.suivi = null; S.gps = false; sauver(); }
        majGPS();
      }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
    } catch (e) { gps.erreur = "GPS indisponible."; gps.suivi = null; }
    majGPS();
  }
  function distance(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function dansLeVillage() {
    if (!gps.pos) return false;
    var m = versCarte(gps.pos.lat, gps.pos.lng), V = CARTE_SG.vueMax;
    return m[0] >= V[0] && m[0] <= V[0] + V[2] && m[1] >= V[1] && m[1] <= V[1] + V[3];
  }
  function lieuSuivant() {
    var p = prochaineEtape();
    if (p) return donneesEtape(p).lieu;
    if (S.equipe && nbFinies() === JEU.etapes.length && !S.victoire) return JEU.final.lieu;
    return null;
  }
  function texteDistance(lieu) {
    var d = Math.round(distance(gps.pos, lieu));
    return d <= (JEU.carte.rayonArrivee || 15) ? "vous y êtes presque !" : "≈ " + d + " m";
  }
  function texteGPS(lieu) {
    if (gps.erreur) return gps.erreur;
    if (gps.suivi === null) return "";
    if (!gps.pos) return "Recherche du signal GPS…";
    return "Distance jusqu'à la cachette : " + texteDistance(lieu) + " (précision ± " + Math.round(gps.pos.precision) + " m)";
  }
  function texteInfoCarte() {
    if (gps.erreur) return gps.erreur;
    if (gps.suivi === null) return "";
    if (!gps.pos) return "Recherche du signal GPS… Restez à découvert.";
    if (!dansLeVillage()) return "Vous êtes hors de la carte, à " + (Math.round(distance(gps.pos, JEU.final.lieu) / 100) / 10) + " km de la mairie de Saint-Gal.";
    var l = lieuSuivant();
    return (l ? (l === JEU.final.lieu ? "Le coffre : " : "Prochaine cachette : ") + texteDistance(l) + " · " : "") + "précision ± " + Math.round(gps.pos.precision) + " m";
  }
  function verifierArrivee() {
    var l = lieuSuivant(); if (!l || !gps.pos || l.lat == null) return;
    var cle = l.nom, d = distance(gps.pos, l), r = JEU.carte.rayonArrivee || 15;
    if (d <= r && !gps.annonce[cle]) { gps.annonce[cle] = true; toast("👀 Vous êtes tout près ! Cherchez bien…"); son.fantome(); vibrer([200, 100, 200]); }
  }
  function majGPS() {
    var el = document.getElementById("gps-texte");
    if (el && S.courant) el.textContent = texteGPS(donneesEtape(S.courant).lieu);
    var info = document.getElementById("gps-info");
    if (info) { var t = texteInfoCarte(); info.textContent = t; info.hidden = !t; }
    var bouton = document.getElementById("btn-gps");
    if (bouton) bouton.hidden = gps.suivi !== null;
    placerSurCarte();
  }

  /* ------------------------------------------------------------------ */
  /* Carte réelle de Saint-Gal (OpenStreetMap, stockée hors ligne)      */
  /* ------------------------------------------------------------------ */
  var carte = { vue: null, suivre: false, glisse: false };
  var CARTE_SVG = null;
  function chemin(pts, ferme) { return "M" + pts.map(function (p) { return p[0] + " " + p[1]; }).join("L") + (ferme ? "Z" : ""); }
  function fondCarte() {
    if (CARTE_SVG) return CARTE_SVG;
    var F = CARTE_SG.donnees.split("\n").map(function (l) {
      var p = l.split("|"); return { cls: p[0], nom: p[1], pts: p[2].trim().split(" ").map(function (c) { return c.split(",").map(Number); }) };
    });
    function de(f) { return F.filter(f); }
    var V = CARTE_SG.vueMax, h = [];
    h.push('<rect x="' + (V[0] - 2000) + '" y="' + (V[1] - 2000) + '" width="' + (V[2] + 4000) + '" height="' + (V[3] + 4000) + '" fill="#3a5140"/>');
    de(function (f) { return f.cls === "landuse=forest"; }).forEach(function (f) { h.push('<path d="' + chemin(f.pts, true) + '" fill="#2a3d2f"/>'); });
    de(function (f) { return f.cls === "landuse=cemetery"; }).forEach(function (f) { h.push('<path d="' + chemin(f.pts, true) + '" fill="#4a5a52" stroke="#6b7a70" stroke-width="1"/>'); });
    de(function (f) { return f.cls.indexOf("waterway") === 0; }).forEach(function (f) { h.push('<path d="' + chemin(f.pts) + '" fill="none" stroke="#5b9ed1" stroke-width="3" stroke-linecap="round"/>'); });
    var routes = de(function (f) { return f.cls.indexOf("highway") === 0; });
    var largeur = { "highway=unclassified": 9, "highway=residential": 7, "highway=service": 5, "highway=track": 3.5, "highway=path": 2 };
    routes.forEach(function (f) {
      if (f.cls === "highway=track" || f.cls === "highway=path") h.push('<path d="' + chemin(f.pts) + '" fill="none" stroke="#b39a72" stroke-width="' + largeur[f.cls] + '" stroke-dasharray="6 4" stroke-linecap="round"/>');
    });
    routes.forEach(function (f) { if (largeur[f.cls] >= 5) h.push('<path d="' + chemin(f.pts) + '" fill="none" stroke="#5a4b38" stroke-width="' + (largeur[f.cls] + 2.5) + '" stroke-linecap="round" stroke-linejoin="round"/>'); });
    routes.forEach(function (f) { if (largeur[f.cls] >= 5) h.push('<path d="' + chemin(f.pts) + '" fill="none" stroke="' + (f.cls === "highway=unclassified" ? "#f1dfb4" : "#ddd0b0") + '" stroke-width="' + largeur[f.cls] + '" stroke-linecap="round" stroke-linejoin="round"/>'); });
    de(function (f) { return f.cls === "building=yes"; }).forEach(function (f) { h.push('<path d="' + chemin(f.pts, true) + '" fill="#7b6450" stroke="#4d3d2e" stroke-width=".8"/>'); });
    de(function (f) { return f.cls === "eglise"; }).forEach(function (f) { h.push('<path d="' + chemin(f.pts, true) + '" fill="#8d74a8" stroke="#4d3d5e" stroke-width="1"/>'); });
    de(function (f) { return f.cls === "mairie"; }).forEach(function (f) { h.push('<path d="' + chemin(f.pts, true) + '" fill="#b07a4c" stroke="#5e3f22" stroke-width="1"/>'); });
    // Noms de rues le long des rues
    var defs = [], noms = [];
    routes.forEach(function (f, i) {
      if (!f.nom) return;
      var pts = f.pts.slice(); if (pts[pts.length - 1][0] < pts[0][0]) pts.reverse();
      defs.push('<path id="rue' + i + '" d="' + chemin(pts) + '"/>');
      noms.push('<text class="nom-rue"><textPath href="#rue' + i + '" startOffset="50%" text-anchor="middle">' + esc(f.nom) + "</textPath></text>");
    });
    var icones = { eglise: "⛪", mairie: "🏛️", monument: "🎖️", croix: "✝", eau: "💧", parking: "🅿️" };
    var poi = CARTE_SG.reperes.map(function (r) { return '<text class="poi" x="' + r.x + '" y="' + r.y + '">' + icones[r.type] + "</text>"; });
    CARTE_SVG = "<defs>" + defs.join("") + "</defs>" + h.join("") + noms.join("") + poi.join("");
    return CARTE_SVG;
  }
  function ratioPlan() { var p = document.getElementById("plan"); return p && p.clientWidth ? p.clientHeight / p.clientWidth : 1.25; }
  function bornerVue(v) {
    var M = CARTE_SG.vueMax, r = ratioPlan();
    v.w = Math.max(70, Math.min(M[2], v.w)); v.h = v.w * r;
    v.x = Math.max(M[0], Math.min(M[0] + M[2] - v.w, v.x)); v.y = Math.max(M[1], Math.min(M[1] + M[3] - v.h, v.y));
    return v;
  }
  function vueParcours() {
    var eq = equipe(), pts = [JEU.final.lieu].concat(eq ? eq.ordre.map(function (id) { return donneesEtape(id).lieu; }) : []);
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(0, xs) - 45, x1 = Math.max.apply(0, xs) + 45, y0 = Math.min.apply(0, ys) - 45, y1 = Math.max.apply(0, ys) + 45;
    var r = ratioPlan(), w = Math.max(x1 - x0, (y1 - y0) / r);
    return bornerVue({ x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - w * r / 2, w: w });
  }
  function centrerSur(mx, my) { var v = carte.vue; v.x = mx - v.w / 2; v.y = my - v.h / 2; bornerVue(v); appliquerVue(); }
  function zoomer(f, mx, my) {
    var v = carte.vue; if (mx == null) { mx = v.x + v.w / 2; my = v.y + v.h / 2; }
    var nw = Math.max(70, Math.min(CARTE_SG.vueMax[2], v.w * f)), k = nw / v.w;
    v.x = mx - (mx - v.x) * k; v.y = my - (my - v.y) * k; v.w = nw; bornerVue(v); appliquerVue();
  }
  function appliquerVue() {
    var svg = document.getElementById("plan-svg"); if (!svg || !carte.vue) return;
    var v = carte.vue; svg.setAttribute("viewBox", v.x + " " + v.y + " " + v.w + " " + v.h);
    svg.style.setProperty("--echelle", (v.w / 320).toFixed(3));
    placerSurCarte();
  }
  function placer(el, mx, my) {
    var v = carte.vue, l = (mx - v.x) / v.w * 100, t = (my - v.y) / v.h * 100;
    el.style.left = l + "%"; el.style.top = t + "%";
    el.style.visibility = (l < -8 || l > 108 || t < -8 || t > 108) ? "hidden" : "visible";
  }
  function placerSurCarte() {
    var plan = document.getElementById("plan"); if (!plan || !carte.vue) return;
    plan.querySelectorAll("[data-mx]").forEach(function (el) { placer(el, +el.dataset.mx, +el.dataset.my); });
    var pt = document.getElementById("gps-point"), halo = document.getElementById("gps-halo");
    if (pt && halo) {
      if (gps.pos && dansLeVillage()) {
        var m = versCarte(gps.pos.lat, gps.pos.lng);
        pt.hidden = halo.hidden = false; placer(pt, m[0], m[1]); placer(halo, m[0], m[1]);
        var px = Math.max(24, 2 * gps.pos.precision / carte.vue.w * plan.clientWidth); halo.style.width = halo.style.height = px + "px";
      } else { pt.hidden = halo.hidden = true; }
    }
    var moi = document.querySelector('[data-carte="moi"]'); if (moi) moi.classList.toggle("actif", !!carte.suivre);
  }
  function brancherCarte() {
    var plan = document.getElementById("plan"); if (!plan) return;
    if (!carte.vue) carte.vue = vueParcours(); else bornerVue(carte.vue);
    appliquerVue();
    var pts = {}, depart = null, pince = null;
    function versMetres(dxPx, dyPx) { var k = carte.vue.w / plan.clientWidth; return [dxPx * k, dyPx * k]; }
    plan.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".outils-carte")) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 1) { depart = { x: e.clientX, y: e.clientY, vx: carte.vue.x, vy: carte.vue.y }; carte.glisse = false; }
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]], r = plan.getBoundingClientRect();
        var cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
        pince = { d: Math.hypot(a.x - b.x, a.y - b.y), vue: Object.assign({}, carte.vue), mx: carte.vue.x + cx / r.width * carte.vue.w, my: carte.vue.y + cy / r.height * carte.vue.h };
        carte.glisse = true;
      }
    });
    plan.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length >= 2 && pince) {
        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        var nw = Math.max(70, Math.min(CARTE_SG.vueMax[2], pince.vue.w * pince.d / d)), k = nw / pince.vue.w;
        carte.vue.w = nw; carte.vue.x = pince.mx - (pince.mx - pince.vue.x) * k; carte.vue.y = pince.my - (pince.my - pince.vue.y) * k;
        carte.suivre = false; bornerVue(carte.vue); appliquerVue(); return;
      }
      if (!depart) return;
      var dx = e.clientX - depart.x, dy = e.clientY - depart.y;
      if (!carte.glisse && Math.hypot(dx, dy) < 8) return;
      carte.glisse = true; carte.suivre = false;
      var m = versMetres(dx, dy); carte.vue.x = depart.vx - m[0]; carte.vue.y = depart.vy - m[1]; bornerVue(carte.vue); appliquerVue();
    });
    function fin(e) {
      delete pts[e.pointerId]; var ids = Object.keys(pts);
      if (ids.length < 2) pince = null;
      if (ids.length === 1) { var p = pts[ids[0]]; depart = { x: p.x, y: p.y, vx: carte.vue.x, vy: carte.vue.y }; }
      if (!ids.length) depart = null;
    }
    plan.addEventListener("pointerup", fin); plan.addEventListener("pointercancel", fin); plan.addEventListener("pointerleave", fin);
    plan.addEventListener("click", function (e) { if (carte.glisse && !e.target.closest(".outils-carte")) { e.stopPropagation(); e.preventDefault(); carte.glisse = false; } }, true);
    plan.addEventListener("wheel", function (e) {
      e.preventDefault(); var r = plan.getBoundingClientRect();
      var mx = carte.vue.x + (e.clientX - r.left) / r.width * carte.vue.w, my = carte.vue.y + (e.clientY - r.top) / r.height * carte.vue.h;
      carte.suivre = false; zoomer(e.deltaY > 0 ? 1.15 : 1 / 1.15, mx, my);
    }, { passive: false });
  }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                         */
  /* ------------------------------------------------------------------ */
  function aller(ecran) {
    S.ecran = ecran; sauver();
    try { speechSynthesis.cancel(); } catch (e) {}
    rendre(); window.scrollTo(0, 0);
  }
  var ECRANS_JEU = { carte: 1, inventaire: 1, etape: 1, final: 1 };
  function rendreNav() {
    if (!S.equipe || !ECRANS_JEU[S.ecran]) { nav.hidden = true; return; }
    nav.hidden = false;
    var finalPret = nbFinies() === JEU.etapes.length;
    var items = [["carte", "🗺️", "Carte"], ["inventaire", "🎒", "Mon sac"]];
    if (S.courant && !etape(S.courant).fini) items.splice(1, 0, ["etape", "🔍", "Épreuve"]);
    if (finalPret) items.push(["final", "🗝️", "Coffre"]);
    nav.innerHTML = items.map(function (it) {
      return '<button data-aller="' + it[0] + '" class="' + (S.ecran === it[0] ? "actif" : "") + '"><span class="i" aria-hidden="true">' + it[1] + "</span>" + it[2] + "</button>";
    }).join("");
  }
  function entete() {
    var eq = equipe();
    return '<div class="entete"><span class="badge-equipe"><span class="e" aria-hidden="true">' + eq.emoji + "</span>Équipe " + esc(eq.nom) + "</span>" +
      '<span class="ligne"><button class="voix" data-action="son" aria-label="' + (S.son ? "Couper le son" : "Activer le son") + '">' + (S.son ? "🔔" : "🔕") + "</button>" +
      '<button class="voix" data-aller="pin" aria-label="Mode organisateur">⚙️</button></span></div>';
  }

  /* ------------------------------------------------------------------ */
  /* Écrans                                                             */
  /* ------------------------------------------------------------------ */
  var vues = {};

  vues.accueil = function () {
    var reprise = S.equipe ? '<button class="btn" data-aller="carte">Reprendre l\'aventure</button>' : "";
    return '<section class="pile accueil">' +
      '<div class="citrouille-anim" aria-hidden="true">🎃</div>' +
      "<h1>" + esc(JEU.titre) + "</h1>" +
      '<p class="doux">Un escape game d\'Halloween à jouer en équipe, avec un adulte.</p>' +
      '<div class="pile" style="width:100%;margin-top:12px">' + (reprise || '<button class="btn" data-action="commencer">Commencer l\'aventure</button>') +
      '<button class="btn second" data-aller="verif">Prêt pour le mode avion ?</button>' +
      '<button class="btn discret" data-aller="pin">Mode organisateur</button></div></section>';
  };

  vues.intro = function () {
    var I = JEU.intro, tout = I.texte.join(" ");
    return '<section class="pile">' +
      '<div class="parchemin lettre"><div class="ligne" style="justify-content:space-between"><h3>' + esc(I.titre) + "</h3>" + boutonVoix(tout + " " + I.signature) + "</div>" +
      I.texte.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
      '<p class="signature">' + esc(I.signature) + "</p></div>" +
      '<button class="btn" data-aller="equipes">Nous acceptons la mission !</button></section>';
  };

  vues.equipes = function () {
    return '<section class="pile"><h2>Choisissez votre équipe</h2>' +
      '<p class="doux">Un téléphone par équipe, un adulte responsable. Chaque équipe commence par une cachette différente.</p>' +
      JEU.equipes.map(function (e) {
        return '<button class="btn second" data-equipe="' + e.id + '" style="display:flex;align-items:center;gap:14px;justify-content:flex-start;min-height:80px;border:3px solid ' + e.couleur + '">' +
          '<span style="font-size:2.6rem" aria-hidden="true">' + e.emoji + "</span><span>Équipe " + esc(e.nom) + "</span></button>";
      }).join("") + '<button class="btn discret" data-aller="intro">Relire la lettre</button></section>';
  };

  vues.carte = function () {
    var eq = equipe(), prochain = prochaineEtape(), finalPret = nbFinies() === JEU.etapes.length, F = JEU.final.lieu;
    var pts = [F].concat(eq.ordre.map(function (id) { return donneesEtape(id).lieu; })).concat([F]);
    var trace = '<polyline points="' + pts.map(function (p) { return p.x + "," + p.y; }).join(" ") + '" fill="none" stroke="' + eq.couleur + '" stroke-width="3" stroke-dasharray="7 5" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>';
    var reperes = eq.ordre.map(function (id, i) {
      var d = donneesEtape(id), st = S.etapes[id], cls = st && st.fini ? "fait" : (id === prochain ? "prochain" : "verrou");
      return '<button class="repere ' + cls + '" data-mx="' + d.lieu.x + '" data-my="' + d.lieu.y + '" data-repere="' + id + '" aria-label="Cachette ' + (i + 1) + " : " + esc(d.nom) + '">' + (st && st.fini ? "✓" : String(i + 1)) + "</button>";
    }).join("");
    reperes += '<button class="repere final ' + (finalPret ? "prochain" : "") + '" data-mx="' + F.x + '" data-my="' + F.y + '" data-repere="final" aria-label="Le coffre">' + (finalPret ? "🗝️" : "🔒") + "</button>";
    var nonVerifies = JEU.etapes.some(function (e) { return !e.lieu.verifie; }) || !F.verifie;
    var msg;
    if (finalPret) msg = "Les cinq morceaux sont à vous ! Filez au coffre 🗝️";
    else if (prochain) msg = "Prochaine cachette : n°" + (eq.ordre.indexOf(prochain) + 1) + ", « " + donneesEtape(prochain).nom + " ». Touchez le rond orange.";
    var info = texteInfoCarte();
    return '<section class="pile">' + entete() +
      "<h2>La carte</h2><p>" + esc(msg) + "</p>" +
      '<div class="plan" id="plan">' +
        '<svg id="plan-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-label="Carte de Saint-Gal">' + fondCarte() + trace + "</svg>" +
        '<span id="gps-halo" class="gps-halo" hidden></span><span id="gps-point" class="gps-point" hidden></span>' + reperes +
        '<div class="outils-carte"><button data-carte="plus" aria-label="Zoomer">＋</button><button data-carte="moins" aria-label="Dézoomer">−</button>' +
        '<button data-carte="moi" aria-label="Me suivre sur la carte">📍</button><button data-carte="parcours" aria-label="Voir tout le parcours">⤢</button></div>' +
        '<span class="attribution">' + esc(JEU.carte.attribution) + "</span>" +
      "</div>" +
      '<p id="gps-info" class="gps-info"' + (info ? "" : " hidden") + ">" + esc(info) + "</p>" +
      '<button id="btn-gps" class="btn second" data-action="gps"' + (gps.suivi !== null ? " hidden" : "") + ">📍 Afficher notre position sur la carte</button>" +
      (nonVerifies ? '<span class="fictif">⚠ Lieux repérés sur la carte, à vérifier sur place</span>' : "") +
      '<p class="legende-plan">' + nbFinies() + " cachette(s) sur " + JEU.etapes.length + " trouvée(s). Glissez pour déplacer la carte, pincez pour zoomer.</p>" +
      "</section>";
  };

  function progresEtape(phase) {
    var ordre = ["chercher", "petits", "moyens", "grands", "recompense"], n = ordre.indexOf(phase);
    return '<div class="progres" aria-label="Avancement de la cachette">' + ordre.slice(0, 4).map(function (p, i) { return '<span class="' + (i < n ? "fait" : "") + '"></span>'; }).join("") + "</div>";
  }

  function blocIndices(nom, liste, nb) {
    var html = "";
    for (var i = 0; i < nb && i < liste.length; i++) html += '<p class="indice"><b>Indice ' + (i + 1) + " :</b> " + esc(liste[i]) + "</p>";
    if (nb < liste.length) html += '<button class="btn second" data-indice="' + nom + '">💡 Un indice (' + (nb + 1) + "/" + liste.length + ")</button>";
    return html;
  }

  vues.etape = function () {
    if (!S.courant) return vues.carte();
    var d = donneesEtape(S.courant), st = etape(S.courant), eq = equipe();
    var num = eq.ordre.indexOf(d.id) + 1;
    var h = '<section class="pile">' + entete() +
      '<div class="ligne"><span style="font-size:2.4rem" aria-hidden="true">' + d.emoji + '</span><div><p class="doux petit">Cachette n°' + num + "</p><h2>" + esc(d.nom) + "</h2></div></div>" + progresEtape(st.phase);

    if (st.phase === "chercher") {
      var g = texteGPS(d.lieu);
      h += (d.lieu.verifie ? "" : '<span class="fictif">⚠ ' + esc(d.lieu.nom) + " : lieu repéré sur la carte, à vérifier</span>") +
        '<div class="carte-bloc"><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><p style="font-size:1.2rem">' + esc(d.lieu.indice) + "</p>" + boutonVoix(d.lieu.indice) + "</div>" +
        (d.lieu.lat != null ? '<p id="gps-texte" class="gps-info">' + esc(g) + "</p>" + (gps.suivi === null ? '<button class="btn second" data-action="gps">📍 Activer le GPS</button>' : "") : "") + '<button class="btn second" data-aller="carte">🗺️ Voir sur la carte</button>' +
        "</div>" +
        '<p class="doux">Les petits ouvrent grand les yeux, les grands surveillent la route. Ne touchez pas à ce qui n\'est pas à vous.</p>' +
        '<button class="btn" data-action="trouve">On a trouvé la cachette !</button>';
    }
    else if (st.phase === "petits") {
      var P = d.petits, contenuChoix;
      if (P.couleurs) contenuChoix = P.couleurs.map(function (c, i) { return '<button class="choix couleur" style="background:' + c + '" data-choix="' + i + '" aria-label="' + esc(P.nomsCouleurs[i]) + '"></button>'; }).join("");
      else if (P.compter) contenuChoix = P.compter.options.map(function (n, i) { return '<button class="choix" data-choix="' + i + '" aria-label="' + n + '"><span class="compte">' + new Array(n + 1).join(P.compter.emoji) + "</span></button>"; }).join("");
      else contenuChoix = P.choix.map(function (c, i) { return '<button class="choix" data-choix="' + i + '">' + c + "</button>"; }).join("");
      h += '<div class="parchemin"><p class="age">Épreuve des petits · 2-6 ans</p><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><h3>' + esc(P.question) + "</h3>" + boutonVoix(d.recit + " " + P.question) + "</div>" +
        '<p class="petit">' + esc(d.recit) + '</p><div class="choix-grille">' + contenuChoix + '</div><p class="retour" id="retour" aria-live="polite"></p></div>';
    }
    else if (st.phase === "moyens") {
      var M = d.moyens;
      h += '<div class="parchemin"><p class="age">Épreuve des moyens · 7-10 ans</p><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><h3>' + esc(M.question) + "</h3>" + boutonVoix(M.question) + "</div>" +
        '<form class="pile" data-form="moyens"><label for="rep-moyens" class="petit">Votre réponse</label>' +
        '<input id="rep-moyens" class="saisie" autocomplete="off" autocapitalize="off" spellcheck="false" ' + (M.type === "nombre" ? 'inputmode="numeric"' : "") + ">" +
        '<button class="btn" type="submit">Valider</button></form><p class="retour" id="retour" aria-live="polite"></p>' +
        blocIndices("moyens", M.indices, st.indM) + "</div>";
    }
    else if (st.phase === "grands") {
      var G = d.grands;
      h += '<div class="parchemin"><p class="age">Épreuve des grands · 11-14 ans</p><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><h3>Le message codé</h3>' + boutonVoix(G.question) + "</div>" +
        "<p>" + esc(G.question) + "</p>" +
        (G.grille ? '<div class="defile"><table class="tableau" style="color:inherit"><tr>' + G.grille.map(function (c) { return '<td style="font-size:1.6rem;text-align:center">' + c[0] + "</td>"; }).join("") + "</tr><tr>" + G.grille.map(function (c) { return '<td style="text-align:center;font-weight:700">' + c[1] + "</td>"; }).join("") + "</tr></table></div>" : "") +
        '<p class="petit">Le message se trouve sur ce que vous avez découvert dans la cachette.</p>' +
        '<form class="pile" data-form="grands"><label for="rep-grands" class="petit">Le mot décodé</label>' +
        '<input id="rep-grands" class="saisie" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
        '<button class="btn" type="submit">Déchiffrer</button></form><p class="retour" id="retour" aria-live="polite"></p>' +
        blocIndices("grands", G.indices, st.indG) + "</div>";
    }
    else if (st.phase === "recompense") {
      var mot = JEU.formule[d.id - 1];
      h += '<div class="carte-bloc recompense pile"><p class="doux">Un morceau de la formule apparaît…</p><p class="mot-gagne">' + esc(mot) + "</p>" +
        (d.chiffre ? '<p>Et un chiffre du cadenas : le <b>' + d.chiffre.position + (d.chiffre.position === 1 ? "er" : "e") + "</b> chiffre est <b style=\"font-size:1.6rem;color:var(--flamme)\">" + esc(d.chiffre.valeur) + "</b></p>" : "") +
        '<p class="doux petit">Laissez la cachette en place pour les autres équipes.</p></div>' +
        '<button class="btn" data-action="ranger">Ranger dans le sac et continuer</button>';
    }
    return h + "</section>";
  };

  vues.inventaire = function () {
    var obj = JEU.etapes.filter(function (e) { return S.etapes[e.id] && S.etapes[e.id].fini; });
    return '<section class="pile">' + entete() + "<h2>Mon sac</h2>" +
      '<h3>La formule</h3><div class="fragments">' + JEU.etapes.map(function (e, i) {
        var ok = S.etapes[e.id] && S.etapes[e.id].fini;
        return '<div class="fragment ' + (ok ? "" : "vide") + '"><span aria-hidden="true" style="font-size:1.6rem">' + (ok ? e.emoji : "❔") + '</span><span class="mot">' + (ok ? esc(JEU.formule[i]) : "• • •") + "</span></div>";
      }).join("") + "</div>" +
      '<h3>Les chiffres du cadenas</h3><div class="chiffres">' + [1, 2, 3, 4].map(function (pos) {
        var e = JEU.etapes.filter(function (x) { return x.chiffre && x.chiffre.position === pos; })[0];
        var ok = e && S.etapes[e.id] && S.etapes[e.id].fini;
        return '<div class="chiffre ' + (ok ? "" : "vide") + '" aria-label="Chiffre ' + pos + '">' + (ok ? esc(e.chiffre.valeur) : "?") + "</div>";
      }).join("") + "</div>" +
      "<h3>Objets trouvés</h3>" + (obj.length ? '<ul class="pile" style="padding-left:20px;margin:0">' + obj.map(function (e) { return "<li>" + e.emoji + " " + esc(e.nom) + "</li>"; }).join("") + "</ul>" : '<p class="doux">Rien pour l\'instant. En route !</p>') +
      "</section>";
  };

  var saisieCode = "";
  vues.final = function () {
    var F = JEU.final;
    if (nbFinies() < JEU.etapes.length) return '<section class="pile">' + entete() + "<h2>Le coffre est encore scellé</h2><p>Il manque " + (JEU.etapes.length - nbFinies()) + " morceau(x) de formule.</p></section>";
    var h = '<section class="pile">' + entete() + "<h2>" + esc(F.titre) + "</h2>" +
      '<div class="parchemin"><p class="age">La formule complète</p><p style="font-family:var(--f-titre);font-size:1.9rem;line-height:1.15;color:#7a2e0e">' + esc(JEU.formuleAffichee) + "</p>" + boutonVoix(JEU.formuleAffichee) + "</div>" +
      (F.lieu.verifie ? "" : '<span class="fictif">⚠ ' + esc(F.lieu.nom) + " : lieu repéré sur la carte, à vérifier</span>") +
      '<div class="carte-bloc"><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><p style="font-size:1.15rem">' + esc(F.lieu.indice) + " " + esc(F.texte) + "</p>" + boutonVoix(F.lieu.indice + " " + F.texte) + "</div></div>";
    if (!S.codeOuvert) {
      var aff = "";
      for (var i = 0; i < JEU.codeCadenas.length; i++) aff += "<span>" + (saisieCode[i] || "") + "</span>";
      h += "<h3>Le cadenas</h3><p class=\"doux\">Tapez les chiffres trouvés dans l'ordre. Ensuite, tournez les molettes du vrai cadenas.</p>" +
        '<div class="affiche-code" aria-live="polite">' + aff + '</div><p class="retour" id="retour"></p><div class="clavier">' +
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map(function (k) { return '<button data-touche="' + k + '" aria-label="' + (k === "⌫" ? "Effacer" : k === "✓" ? "Valider" : k) + '">' + k + "</button>"; }).join("") + "</div>";
    } else {
      h += '<div class="carte-bloc centre pile"><p style="font-size:1.2rem">Le cadenas s\'ouvre… Tous ensemble, criez la formule !</p><button class="btn" data-action="victoire">Nous avons crié la formule ! 📣</button></div>';
    }
    return h + "</section>";
  };

  vues.victoire = function () {
    var eq = equipe(), t = S.debut && S.fin ? duree(S.fin - S.debut) : "";
    return '<section class="pile victoire"><div class="citrouille-anim" aria-hidden="true">✨🎃✨</div><h1>Malédiction levée !</h1>' +
      '<p style="font-size:1.2rem">' + esc(JEU.final.victoire) + "</p>" +
      '<p class="badge-equipe" style="align-self:center"><span class="e">' + eq.emoji + "</span>Équipe " + esc(eq.nom) + (t ? " · " + t : "") + "</p>" +
      boutonVoix(JEU.final.victoire) +
      '<button class="btn second" data-aller="inventaire">Revoir mon sac</button></section>';
  };

  /* ----- Organisateur ----- */
  var pinSaisi = "", orgOuvert = false, confirmeReset = false;
  vues.pin = function () {
    var aff = ""; for (var i = 0; i < JEU.codeOrganisateur.length; i++) aff += "<span>" + (pinSaisi[i] ? "•" : "") + "</span>";
    return '<section class="pile"><h2>Mode organisateur</h2><p class="doux">Réservé aux adultes. Tapez le code organisateur.</p>' +
      '<div class="affiche-code">' + aff + '</div><p class="retour ko" id="retour"></p><div class="clavier">' +
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map(function (k) { return '<button data-pin="' + k + '" aria-label="' + (k === "⌫" ? "Effacer" : k === "✓" ? "Valider" : k) + '">' + k + "</button>"; }).join("") + "</div>" +
      '<button class="btn discret" data-action="retour-jeu">Retour</button></section>';
  };

  vues.orga = function () {
    if (!orgOuvert) return vues.pin();
    var eq = equipe();
    var lignes = JEU.etapes.map(function (d) {
      var st = S.etapes[d.id], etat = st && st.fini ? '<span class="pastille ok">Finie</span>' : (st ? '<span class="pastille cours">' + esc(st.phase) + "</span>" : '<span class="pastille att">À faire</span>');
      return "<tr><td>" + d.id + ". " + esc(d.nom) + "</td><td>" + etat + "</td><td>" + (st ? (st.indM + st.indG) : 0) + "</td><td>" + (st && st.heure ? new Date(st.heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—") + "</td></tr>";
    }).join("");
    var reponses = JEU.etapes.map(function (d) {
      var P = d.petits, bonP = P.couleurs ? P.nomsCouleurs[P.bonne] : P.compter ? String(P.compter.options[P.bonne]) : P.choix[P.bonne];
      return "<tr><td><b>" + d.id + ". " + esc(d.nom) + "</b><br><span class=\"doux petit\">" + esc(d.lieu.nom) + (d.lieu.verifie ? " ✔ vérifié" : " ⚠ à vérifier") + "</span></td><td>" + esc(bonP) + "</td><td>" + esc(d.moyens.reponses[0]) + "</td><td>" + esc(d.grands.reponses[0]).toUpperCase() + "</td><td>" + (d.chiffre ? d.chiffre.position + "e = " + esc(d.chiffre.valeur) : "—") + "</td></tr>";
    }).join("");
    var objets = JEU.etapes.map(function (d) {
      return "<li><b>" + d.id + ". " + esc(d.nom) + "</b> (" + esc(d.lieu.nom) + ") : " + esc(d.cachette) + " <i>Contenu :</i> " + esc(d.contenu) + "</li>";
    }).join("");
    var tempsJeu = S.debut ? duree((S.fin || Date.now()) - S.debut) : "pas commencé";
    var h = '<section class="pile"><div class="entete"><h2>Organisateur</h2><button class="btn second" style="width:auto;min-height:48px" data-action="fermer-orga">Fermer</button></div>' +
      '<div class="carte-bloc"><h3>Ce téléphone</h3><p>Équipe : <b>' + (eq ? eq.emoji + " " + esc(eq.nom) : "aucune") + "</b> · Temps : <b>" + tempsJeu + "</b> · " + nbFinies() + "/" + JEU.etapes.length + " cachettes" + (S.victoire ? " · <b>Victoire</b>" : "") + "</p>" +
      '<p class="doux petit">La progression est enregistrée sur ce téléphone uniquement. Pour suivre les 3 équipes, regardez chaque téléphone.</p>' +
      '<div class="defile"><table class="tableau"><tr><th>Cachette</th><th>État</th><th>Indices</th><th>Finie à</th></tr>' + lignes + "</table></div></div>" +
      '<div class="carte-bloc"><h3>Débloquer</h3>' +
      (S.courant && !etape(S.courant).fini ? '<button class="btn" data-action="passer">Valider l\'épreuve en cours (' + esc(etape(S.courant).phase) + ")</button>" : '<p class="doux">Aucune épreuve en cours.</p>') +
      '<button class="btn second" data-action="changer-equipe">Changer d\'équipe</button></div>' +
      '<div class="carte-bloc"><h3>Réponses</h3><div class="defile"><table class="tableau"><tr><th>Cachette</th><th>Petits</th><th>Moyens</th><th>Grands</th><th>Cadenas</th></tr>' + reponses + "</table></div>" +
      "<p>Code du cadenas : <b>" + esc(JEU.codeCadenas) + "</b> · Formule : <b>" + esc(JEU.formuleAffichee) + "</b></p></div>" +
      '<div class="carte-bloc"><h3>À cacher avant la partie</h3><ul class="pile" style="padding-left:20px;margin:0">' + objets + "</ul></div>" +
      '<div class="carte-bloc"><h3>Préparation</h3><button class="btn second" data-aller="verif">Contrôle mode avion</button>';
    if (!confirmeReset) h += '<button class="btn danger" data-action="reset">Réinitialiser la partie</button>';
    else h += '<p><b>Effacer toute la progression de ce téléphone ?</b> Cette action ne peut pas être annulée.</p><div class="ligne" style="flex-wrap:nowrap"><button class="btn danger" data-action="reset-ok">Oui, effacer</button><button class="btn second" data-action="reset-non">Annuler</button></div>';
    return h + "</div></section>";
  };

  /* ----- Contrôle mode avion ----- */
  var verifs = null;
  vues.verif = function () {
    var h = '<section class="pile"><h2>Prêt pour le mode avion ?</h2><p class="doux">À faire avec Internet, la veille, sur chaque téléphone.</p><div class="carte-bloc">';
    if (!verifs) { h += '<p>Vérification en cours…</p>'; lancerVerif(); }
    else h += verifs.map(function (v) {
      return '<div class="check"><span class="etat ' + v.etat + '">' + (v.etat === "ok" ? "✓" : v.etat === "ko" ? "✗" : "!") + '</span><div><p><b>' + esc(v.titre) + '</b></p><p class="doux petit">' + esc(v.detail) + "</p></div></div>";
    }).join("") + '<button class="btn second" data-action="reverif">Relancer la vérification</button>';
    h += '</div><div class="carte-bloc"><h3>Le test qui compte</h3><ol class="pile" style="padding-left:22px;margin:0"><li>Tout est vert ci-dessus.</li><li>Ajoutez le jeu à l\'écran d\'accueil.</li><li>Activez le <b>mode avion</b>.</li><li>Fermez complètement le navigateur, puis rouvrez le jeu depuis l\'icône.</li><li>Jouez une cachette pour tester, puis réinitialisez dans le mode organisateur.</li></ol></div>' +
      '<button class="btn" data-action="retour-jeu">Retour</button></section>';
    return h;
  };
  function lancerVerif() {
    var res = [];
    var swOk = "serviceWorker" in navigator;
    var stockageOk = (function () { try { localStorage.setItem("__t", "1"); var v = localStorage.getItem("__t"); localStorage.removeItem("__t"); return v === "1"; } catch (e) { return false; } })();
    res.push({ titre: "Sauvegarde de la progression", etat: stockageOk ? "ok" : "ko", detail: stockageOk ? "La progression reste enregistrée même si le navigateur est fermé." : "Le navigateur bloque la sauvegarde (navigation privée ?). Ouvrez le jeu dans un onglet normal." });
    res.push({ titre: "Connexion actuelle", etat: navigator.onLine ? "ok" : "att", detail: navigator.onLine ? "En ligne : le téléchargement des fichiers est possible." : "Hors ligne en ce moment. Si tout le reste est vert, c'est bon signe !" });
    var voix = ("speechSynthesis" in window);
    res.push({ titre: "Lecture à voix haute", etat: voix && voixFr ? (voixFr.localService ? "ok" : "att") : "att", detail: !voix ? "Pas disponible sur ce téléphone : un adulte lira à voix haute." : voixFr ? (voixFr.localService ? "Voix française installée sur le téléphone." : "Voix française en ligne : elle risque de ne pas marcher en mode avion. Testez-la en mode avion.") : "Aucune voix française trouvée. Testez le bouton 🔊 ; sinon un adulte lira." });
    var gpsDispo = ("geolocation" in navigator) && window.isSecureContext;
    res.push({ titre: "Position GPS", etat: !gpsDispo ? "ko" : (S.gps ? "ok" : "att"), detail: !gpsDispo ? "Le GPS ne peut pas marcher ici : ouvrez le jeu depuis son adresse https." : (S.gps ? "Localisation autorisée. Le GPS marche aussi en mode avion (sans Internet), dehors, en quelques secondes." : "Pas encore autorisée : sur la carte, touchez « Afficher notre position » et acceptez. Le jeu marche aussi sans.") });
    var policesOk = false; try { policesOk = document.fonts && document.fonts.check('20px "Grenze Gotisch"') && document.fonts.check('20px "Fredoka"'); } catch (e) {}
    res.push({ titre: "Polices décoratives", etat: policesOk ? "ok" : "att", detail: policesOk ? "Polices chargées." : "Pas encore chargées : le jeu utilisera une police simple. Sans gravité." });
    if (!swOk) {
      res.unshift({ titre: "Fonction hors connexion", etat: "ko", detail: "Ce navigateur (ou cet aperçu) ne permet pas le mode hors connexion. Ouvrez le jeu depuis son adresse d'hébergement (https) dans Chrome ou Safari." });
      verifs = res; rendre(); return;
    }
    navigator.serviceWorker.getRegistration().then(function (reg) {
      var actif = !!(reg && reg.active);
      res.unshift({ titre: "Fonction hors connexion", etat: actif ? "ok" : "ko", detail: actif ? "Le gestionnaire hors connexion est actif." : "Pas encore actif. Rechargez la page une fois avec Internet, puis relancez la vérification." });
      if (!("caches" in window) || typeof FICHIERS === "undefined") { verifs = res; rendre(); return; }
      var liste = FICHIERS.slice(); if (JEU.carte.image) liste.push(JEU.carte.image);
      return Promise.all(liste.map(function (f) { return caches.match(new URL(f, location.href).href).then(function (r) { return r ? null : f; }); })).then(function (manque) {
        manque = manque.filter(Boolean);
        res.splice(1, 0, { titre: "Fichiers du jeu enregistrés", etat: manque.length ? "ko" : "ok", detail: manque.length ? "Manquants : " + manque.join(", ") + ". Rechargez avec Internet." : liste.length + " fichiers enregistrés sur le téléphone (jeu, énigmes, carte, icônes)." });
        verifs = res; rendre();
      });
    }).catch(function () { res.unshift({ titre: "Fonction hors connexion", etat: "ko", detail: "Vérification impossible ici." }); verifs = res; rendre(); });
  }

  /* ------------------------------------------------------------------ */
  /* Rendu + événements                                                 */
  /* ------------------------------------------------------------------ */
  function rendre() {
    if (S.ecran !== "accueil" && S.ecran !== "intro" && S.ecran !== "equipes" && S.ecran !== "verif" && S.ecran !== "pin" && S.ecran !== "orga" && !S.equipe) S.ecran = "accueil";
    if (S.victoire && S.ecran === "final") S.ecran = "victoire";
    var v = vues[S.ecran] || vues.accueil;
    app.innerHTML = v();
    rendreNav();
    brancherCarte();
    majGPS();
    var champ = app.querySelector(".saisie"); if (champ && !("ontouchstart" in window)) champ.focus();
  }

  function valider(phase) {
    var st = etape(S.courant);
    st.phase = phase; sauver(); son.bon(); rendre(); window.scrollTo(0, 0);
  }

  function retour(txt, ok) { var r = document.getElementById("retour"); if (r) { r.textContent = txt; r.className = "retour " + (ok ? "ok" : "ko"); } }

  function etincelles() {
    var em = ["🎃", "✨", "🦇", "⭐", "🍬", "👻"];
    for (var i = 0; i < 28; i++) {
      var s = document.createElement("span"); s.className = "etincelle"; s.textContent = em[i % em.length];
      s.style.left = Math.random() * 100 + "vw"; s.style.animationDuration = (2.5 + Math.random() * 2.5) + "s"; s.style.animationDelay = Math.random() * 1.2 + "s";
      document.body.appendChild(s); (function (x) { setTimeout(function () { x.remove(); }, 6500); })(s);
    }
  }

  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    audio();
    if (b.dataset.dire) { parler(b.dataset.dire, b); return; }
    if (b.dataset.carte) {
      var c = b.dataset.carte;
      if (c === "plus") zoomer(1 / 1.5); else if (c === "moins") zoomer(1.5);
      else if (c === "parcours") { carte.suivre = false; carte.vue = vueParcours(); appliquerVue(); }
      else if (c === "moi") {
        if (gps.suivi === null) { lancerGPS(); toast("Recherche de votre position…"); carte.suivre = true; }
        else if (!gps.pos) toast("Recherche du signal GPS…");
        else if (!dansLeVillage()) toast("Vous êtes en dehors de la carte de Saint-Gal.");
        else { carte.suivre = true; if (carte.vue.w > 260) carte.vue.w = 200; var m = versCarte(gps.pos.lat, gps.pos.lng); centrerSur(m[0], m[1]); }
      }
      placerSurCarte(); return;
    }
    if (b.dataset.aller) {
      var cible = b.dataset.aller;
      if (cible === "pin" && orgOuvert) cible = "orga";
      if (cible === "verif") verifs = null;
      if (cible === "pin") pinSaisi = "";
      if (cible === "etape" && !S.courant) cible = "carte";
      aller(cible); return;
    }
    if (b.dataset.equipe) {
      S.equipe = b.dataset.equipe; if (!S.debut) S.debut = Date.now(); carte.vue = null;
      son.fantome(); aller("carte"); return;
    }
    if (b.dataset.repere) {
      var id = b.dataset.repere;
      if (id === "final") { if (nbFinies() === JEU.etapes.length) aller("final"); else toast("Le coffre est scellé. Trouvez d'abord les 5 cachettes !"); return; }
      id = +id; var p = prochaineEtape();
      if (S.etapes[id] && S.etapes[id].fini) { toast("Cachette déjà trouvée ✓"); return; }
      if (id !== p) { toast("Pas encore ! Suivez l'ordre de votre équipe : rond orange."); son.faux(); return; }
      S.courant = id; etape(id); aller("etape"); return;
    }
    if (b.dataset.choix !== undefined) {
      var d = donneesEtape(S.courant), i = +b.dataset.choix;
      if (i === d.petits.bonne) { b.classList.add("bon"); retour("Bravo ! 🎉", true); son.bon(); setTimeout(function () { valider("moyens"); }, 700); }
      else { b.classList.remove("faux"); void b.offsetWidth; b.classList.add("faux"); retour("Essaie encore !", false); son.faux(); }
      return;
    }
    if (b.dataset.indice) {
      var st = etape(S.courant);
      if (b.dataset.indice === "moyens") st.indM++; else st.indG++;
      sauver(); rendre(); var ind = app.querySelectorAll(".indice"); if (ind.length) ind[ind.length - 1].scrollIntoView({ block: "center" });
      return;
    }
    if (b.dataset.touche) {
      var k = b.dataset.touche;
      if (k === "⌫") saisieCode = saisieCode.slice(0, -1);
      else if (k === "✓") {
        if (saisieCode === JEU.codeCadenas) { S.codeOuvert = true; sauver(); son.tresor(); saisieCode = ""; rendre(); return; }
        son.faux(); saisieCode = ""; rendre(); retour("Ce n'est pas le bon code. Regardez votre sac 🎒", false); return;
      } else if (saisieCode.length < JEU.codeCadenas.length) saisieCode += k;
      rendre(); return;
    }
    if (b.dataset.pin) {
      var kp = b.dataset.pin;
      if (kp === "⌫") pinSaisi = pinSaisi.slice(0, -1);
      else if (kp === "✓") {
        if (pinSaisi === JEU.codeOrganisateur) { orgOuvert = true; pinSaisi = ""; aller("orga"); return; }
        pinSaisi = ""; rendre(); retour("Code incorrect.", false); return;
      } else if (pinSaisi.length < JEU.codeOrganisateur.length) pinSaisi += kp;
      rendre(); return;
    }
    switch (b.dataset.action) {
      case "commencer": S.debut = S.debut || null; aller("intro"); son.fantome(); break;
      case "son": S.son = !S.son; sauver(); rendre(); if (S.son) son.bon(); break;
      case "gps": carte.suivre = true; lancerGPS(); break;
      case "trouve": valider("petits"); break;
      case "ranger":
        var st2 = etape(S.courant); st2.fini = true; st2.heure = Date.now(); st2.phase = "fini";
        var finiTout = nbFinies() === JEU.etapes.length; S.courant = null; sauver(); son.tresor();
        aller(finiTout ? "final" : "carte"); if (finiTout) etincelles(); break;
      case "victoire": S.victoire = true; S.fin = S.fin || Date.now(); sauver(); son.victoire(); aller("victoire"); etincelles(); break;
      case "retour-jeu": aller(S.equipe ? "carte" : "accueil"); break;
      case "fermer-orga": orgOuvert = false; confirmeReset = false; aller(S.equipe ? "carte" : "accueil"); break;
      case "passer":
        var st3 = etape(S.courant), ordre = ["chercher", "petits", "moyens", "grands", "recompense"];
        st3.aide = true; st3.phase = ordre[Math.min(ordre.indexOf(st3.phase) + 1, 4)]; sauver(); toast("Épreuve validée par l'organisateur"); rendre(); break;
      case "changer-equipe": S.equipe = null; orgOuvert = false; aller("equipes"); break;
      case "reset": confirmeReset = true; rendre(); break;
      case "reset-non": confirmeReset = false; rendre(); break;
      case "reset-ok":
        var garderSon = S.son, garderGps = S.gps; S = etatVierge(); S.son = garderSon; S.gps = garderGps; gps.annonce = {}; sauver(); confirmeReset = false; orgOuvert = false; toast("Partie réinitialisée"); aller("accueil"); break;
      case "reverif": verifs = null; rendre(); break;
    }
  });

  document.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, quoi = f.dataset.form; if (!quoi) return;
    var d = donneesEtape(S.courant), champ = f.querySelector("input"), val = champ.value;
    var ok = bonneReponse(val, quoi === "moyens" ? d.moyens.reponses : d.grands.reponses);
    if (ok) { retour("Bonne réponse ! ✨", true); champ.blur(); setTimeout(function () { valider(quoi === "moyens" ? "grands" : "recompense"); }, 600); }
    else { retour(val.trim() ? "Ce n'est pas ça… Réfléchissez ensemble !" : "Écrivez une réponse d'abord.", false); son.faux(); champ.select(); }
  });

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                          */
  /* ------------------------------------------------------------------ */
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    try {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    } catch (e) {}
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  if (S.gps) lancerGPS();
  if (S.ecran === "pin" || S.ecran === "orga") S.ecran = S.equipe ? "carte" : "accueil";
  rendre();
})();
