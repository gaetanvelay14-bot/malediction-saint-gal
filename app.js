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
  var gps = { suivi: null, pos: null, erreur: null, premier: true, annonce: {}, refuse: false };
  function versCarte(lat, lng) { return [(lng - CARTE_SG.ouest) * CARTE_SG.kx, (CARTE_SG.nord - lat) * CARTE_SG.ky]; }
  function lancerGPS() {
    if (!("geolocation" in navigator)) { gps.erreur = "Ce téléphone ne donne pas sa position. Le jeu marche sans."; majGPS(); return; }
    if (gps.suivi !== null) return;
    gps.erreur = null;
    try {
      gps.suivi = navigator.geolocation.watchPosition(function (p) {
        gps.pos = { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy };
        gps.erreur = null;
        gps.refuse = false;
        if (!S.gps) { S.gps = true; sauver(); toast("Localisation activée ✅"); rendre(); }
        if (gps.premier) { gps.premier = false; if (dansLeVillage()) { carte.suivre = true; } }
        majGPS(); verifierArrivee();
      }, function (err) {
        gps.erreur = err && err.code === 1
          ? "Localisation refusée. Le jeu en a besoin : autorisez-la dans les réglages du téléphone."
          : "Signal GPS introuvable pour l'instant. Restez à découvert quelques secondes. Le jeu marche sans.";
        if (err && err.code === 1) { gps.suivi = null; gps.refuse = true; S.gps = false; sauver(); rendre(); return; }
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
  /* ----- Arrivée à une cachette : l'énigme ne s'ouvre que sur place ----- */
  function seuilArrivee() { return (JEU.carte.rayonArrivee || 15) + (gps.pos ? Math.min(gps.pos.precision, 15) : 0); }
  function estArrive(lieu) { return !!(gps.pos && distance(gps.pos, lieu) <= seuilArrivee()); }
  function temperature(d) {
    if (d <= seuilArrivee()) return { e: "🎃", t: "Vous y êtes !", c: "arrive" };
    if (d <= 30) return { e: "🔥", t: "Brûlant !", c: "brulant" };
    if (d <= 60) return { e: "🌡️", t: "Chaud", c: "chaud" };
    if (d <= 120) return { e: "❄️", t: "Froid", c: "froid" };
    return { e: "🥶", t: "Glacé", c: "glace" };
  }
  var derniereDistance = null;
  var apparitionVue = {}, minuterie = null;
  function minuterieApparition(id) {
    clearTimeout(minuterie);
    minuterie = setTimeout(function () { if (S.ecran === "etape" && S.courant === id && !apparitionVue[id]) { apparitionVue[id] = true; son.fantome(); rendre(); } }, 6000);
  }
  function radarHTML(lieu) {
    return '<div class="radar" id="radar" data-lat="' + lieu.lat + '" data-lng="' + lieu.lng + '">' +
      '<span class="radar-emoji" id="radar-emoji" aria-hidden="true">📍</span>' +
      '<p class="radar-texte" id="radar-texte">Activez le GPS</p>' +
      '<p class="radar-dist" id="radar-dist"></p><p class="radar-tendance" id="radar-tendance"></p>' +
      '<button class="btn" id="radar-gps" data-action="gps">📍 Activer le GPS</button></div>';
  }
  function majRadar() {
    var r = document.getElementById("radar"); if (!r) return;
    var lieu = { lat: +r.dataset.lat, lng: +r.dataset.lng };
    var em = document.getElementById("radar-emoji"), tx = document.getElementById("radar-texte"), di = document.getElementById("radar-dist"), te = document.getElementById("radar-tendance"), bt = document.getElementById("radar-gps");
    bt.hidden = gps.suivi !== null;
    if (gps.erreur) { r.className = "radar"; em.textContent = "📡"; tx.textContent = "Pas de GPS"; di.textContent = gps.erreur; te.textContent = ""; return; }
    if (gps.suivi === null) { r.className = "radar"; em.textContent = "📍"; tx.textContent = "Activez le GPS"; di.textContent = "Pour savoir si vous êtes près de la cachette."; te.textContent = ""; return; }
    if (!gps.pos) { r.className = "radar"; em.textContent = "🛰️"; tx.textContent = "Recherche…"; di.textContent = "Restez dehors quelques secondes."; te.textContent = ""; return; }
    var d = distance(gps.pos, lieu), T = temperature(d);
    r.className = "radar " + T.c; em.textContent = T.e; tx.textContent = T.t;
    di.textContent = d <= seuilArrivee() ? "" : "encore ≈ " + Math.round(d) + " m";
    if (derniereDistance !== null && Math.abs(d - derniereDistance) >= 3) { te.textContent = d < derniereDistance ? "👍 Vous vous rapprochez !" : "↩️ Vous vous éloignez…"; derniereDistance = d; }
    else if (derniereDistance === null) derniereDistance = d;
  }
  function verifierArrivee() {
    if (!S.equipe || !gps.pos) return;
    var p = prochaineEtape();
    if (p) {
      var st = etape(p), lieu = donneesEtape(p).lieu;
      if (st.phase === "chercher" && !st.arrive && estArrive(lieu)) {
        st.arrive = true; S.courant = p; sauver(); celebrerArrivee();
        if (S.ecran === "carte" || S.ecran === "etape" || S.ecran === "inventaire") aller("etape");
      }
    } else if (nbFinies() === JEU.etapes.length && !S.coffreArrive && estArrive(JEU.final.lieu)) {
      S.coffreArrive = true; sauver(); celebrerArrivee();
      if (S.ecran === "carte" || S.ecran === "final" || S.ecran === "inventaire") aller("final");
    }
  }
  function celebrerArrivee() {
    son.tresor(); vibrer([300, 120, 300, 120, 500]);
    setTimeout(function () { if (S.son) parler("Vous êtes arrivés ! Cherchez bien autour de vous."); }, 700);
  }
  function blocArrivee(texte) {
    return '<div class="arrivee pile centre"><span class="arrivee-emoji" aria-hidden="true">🎃</span><h2>Vous êtes arrivés !</h2>' +
      '<div class="ligne" style="justify-content:center;flex-wrap:nowrap"><p style="font-size:1.2rem">' + esc(texte) + "</p>" + boutonVoix("Vous êtes arrivés ! " + texte) + "</div></div>";
  }
  function blocVerrou() {
    return '<button class="btn verrouille" disabled>🔒 Approchez-vous pour débloquer</button>' +
      '<button class="btn discret" data-action="debloquer-adulte">GPS en panne ? Un adulte peut débloquer</button>';
  }
  function miniPlan(lieu, emoji) {
    return '<div class="plan plan-mini" id="plan">' +
      '<svg id="plan-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-label="Carte">' + fondCarte() + "</svg>" +
      '<span id="gps-halo" class="gps-halo" hidden></span><span id="gps-point" class="gps-point" hidden></span>' +
      '<span class="repere prochain cible" data-mx="' + lieu.x + '" data-my="' + lieu.y + '" aria-hidden="true">' + emoji + "</span>" +
      '<span class="attribution">' + esc(JEU.carte.attribution) + "</span></div>";
  }
  function vueCible(lieu) {
    var w = 240, r = ratioPlan(); return bornerVue({ x: lieu.x - w / 2, y: lieu.y - w * r / 2, w: w });
  }

  function majGPS() {
    var el = document.getElementById("gps-texte");
    if (el && S.courant) el.textContent = texteGPS(donneesEtape(S.courant).lieu);
    var info = document.getElementById("gps-info");
    if (info) { var t = texteInfoCarte(); info.textContent = t; info.hidden = !t; }
    var bouton = document.getElementById("btn-gps");
    if (bouton) bouton.hidden = gps.suivi !== null;
    majRadar();
    var mini = document.querySelector(".plan-mini .cible");
    placerSurCarte();
  }

  /* ------------------------------------------------------------------ */
  /* Carte réelle de Saint-Gal (OpenStreetMap, stockée hors ligne)      */
  /* ------------------------------------------------------------------ */
  var carte = { vue: null, suivre: false, glisse: false, cadrage: true };
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
    carte.vue = vueParcours();
    appliquerVue();
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
      '<button class="btn second" data-aller="partage">📱 Partager le jeu (QR code)</button>' +
      '<button class="btn discret" data-aller="pin">Mode organisateur</button></div></section>';
  };

  vues.partage = function () {
    var url = "https://gaetanvelay14-bot.github.io/malediction-saint-gal/";
    return '<section class="pile centre"><h2>Partager le jeu</h2><p style="font-size:1.1rem">Scannez ce QR code avec l\'appareil photo d\'un autre téléphone, puis installez le jeu.</p>' +
      '<div class="qr"><img src="qr.svg" alt="QR code du jeu" width="260" height="260"></div><p class="adresse">' + url + "</p>" +
      '<button class="btn second" data-action="retour-jeu">Retour</button></section>';
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
      return '<span class="repere ' + cls + '" data-mx="' + d.lieu.x + '" data-my="' + d.lieu.y + '" aria-label="Cachette ' + (i + 1) + '">' + (st && st.fini ? "✓" : String(i + 1)) + "</span>";
    }).join("");
    reperes += '<span class="repere final ' + (finalPret ? "prochain" : "") + '" data-mx="' + F.x + '" data-my="' + F.y + '" aria-label="Le coffre">' + (finalPret ? "🗝️" : "🔒") + "</span>";
    var nonVerifies = JEU.etapes.some(function (e) { return !e.lieu.verifie; }) || !F.verifie;
    var msg;
    if (finalPret) msg = "Les cinq morceaux sont à vous ! Filez au coffre 🗝️";
    else if (prochain) msg = "Prochaine cachette : le rond orange n°" + (eq.ordre.indexOf(prochain) + 1) + ".";
    var info = texteInfoCarte();
    return '<section class="pile">' + entete() +
      "<h2>La carte</h2><p>" + esc(msg) + "</p>" +
      '<div class="plan" id="plan">' +
        '<svg id="plan-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-label="Carte de Saint-Gal">' + fondCarte() + trace + "</svg>" +
        '<span id="gps-halo" class="gps-halo" hidden></span><span id="gps-point" class="gps-point" hidden></span>' + reperes +
        '<span class="attribution">' + esc(JEU.carte.attribution) + "</span>" +
      "</div>" +
      (prochain || finalPret ? '<button class="btn gros" data-action="aller-prochaine">' + (prochain ? "🔍 Aller à la cachette n°" + (eq.ordre.indexOf(prochain) + 1) : "🗝️ Aller au coffre") + "</button>" : "") +
      '<p id="gps-info" class="gps-info"' + (info ? "" : " hidden") + ">" + esc(info) + "</p>" +
      '<button id="btn-gps" class="btn second" data-action="gps"' + (gps.suivi !== null ? " hidden" : "") + ">📍 Afficher notre position sur la carte</button>" +
      (nonVerifies ? '<span class="fictif">⚠ Lieux repérés sur la carte, à vérifier sur place</span>' : "") +
      '<p class="legende-plan">' + nbFinies() + " cachette(s) sur " + JEU.etapes.length + " trouvée(s).</p>" +
      "</section>";
  };

  /* ----- Questions tirées au hasard, différentes pour chaque équipe ----- */
  function melange(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // Le téléphone retient les questions déjà posées : la partie suivante en tire d'autres.
  function dejaVues() { try { return JSON.parse(localStorage.getItem("malediction-deja-vues") || "{}"); } catch (e) { return {}; } }
  function tirer() {
    var b = equipe().banque, t = {}, h = dejaVues(), nb = JEU.etapes.length;
    ["petits", "moyens", "grands"].forEach(function (n) {
      var cle = b + "-" + n, vues = h[cle] || [], tous = QUESTIONS[n][b].map(function (_, i) { return i; });
      var neuves = melange(tous.filter(function (i) { return vues.indexOf(i) < 0; }));
      if (neuves.length < nb) { var anciennes = melange(tous.filter(function (i) { return neuves.indexOf(i) < 0; })); neuves = neuves.concat(anciennes); vues = []; }
      var idx = neuves.slice(0, nb);
      h[cle] = vues.concat(idx);
      t[n] = {};
      JEU.etapes.forEach(function (e, k) { var r = { i: idx[k] }; if (n === "moyens") r.ordre = melange([0, 1, 2, 3]); t[n][e.id] = r; });
    });
    try { localStorage.setItem("malediction-deja-vues", JSON.stringify(h)); } catch (e) {}
    S.tirage = { banque: b, t: t };
  }
  function question(id, n) {
    if (!S.tirage || S.tirage.banque !== equipe().banque) { tirer(); sauver(); }
    var r = S.tirage.t[n][id], q = QUESTIONS[n][S.tirage.banque][r.i];
    if (n === "moyens") return Object.assign({}, q, { options: r.ordre.map(function (k) { return q.options[k]; }), bonne: r.ordre.indexOf(q.bonne) });
    return q;
  }
  function demarrerChrono(st, n) { if (!st.debut) st.debut = {}; if (!st.debut[n]) { st.debut[n] = Date.now(); sauver(); } }
  function nbIndices(st, n, total) {
    var t0 = st.debut && st.debut[n]; if (!t0) return 0;
    var e = (Date.now() - t0) / 1000, c = JEU.indices;
    if (e < c.premier) return 0;
    return Math.min(total, 1 + Math.floor((e - c.premier) / c.intervalle));
  }
  function attenteIndice(st, n, total) {
    var t0 = st.debut && st.debut[n], c = JEU.indices, k = nbIndices(st, n, total);
    if (!t0 || k >= total) return 0;
    var prochain = t0 + (c.premier + k * c.intervalle) * 1000;
    return Math.max(0, Math.ceil((prochain - Date.now()) / 1000));
  }
  function zoneIndices(n) { return '<div class="zone-indices" id="zone-indices" data-niveau="' + n + '"></div><p class="penalite" id="penalite" hidden></p>'; }
  var dernierNbIndices = -1;
  function majIndices() {
    var z = document.getElementById("zone-indices"); if (!z || !S.courant) return;
    var st = etape(S.courant), n = z.dataset.niveau, q = question(S.courant, n), total = q.indices.length;
    var k = nbIndices(st, n, total), att = attenteIndice(st, n, total);
    if (k !== +z.dataset.nb) {
      if (z.dataset.nb !== undefined && k > +z.dataset.nb) { son.fantome(); vibrer(120); }
      z.dataset.nb = k;
      var html = "";
      for (var i = 0; i < k; i++) html += '<p class="indice"><b>💡 Indice ' + (i + 1) + " :</b> " + esc(q.indices[i]) + " " + boutonVoix(q.indices[i]) + "</p>";
      html += '<p class="prochain-indice" id="prochain-indice"></p>';
      z.innerHTML = html;
    }
    var pi = document.getElementById("prochain-indice");
    if (pi) pi.textContent = att > 0 ? "⏳ " + (k === 0 ? "Premier indice" : "Indice suivant") + " dans " + Math.floor(att / 60) + ":" + ("0" + att % 60).slice(-2) : (k >= total ? "Tous les indices sont là. Courage !" : "");
    var pen = document.getElementById("penalite"), parch = document.getElementById("parchemin");
    var reste = st.bloque ? Math.ceil((st.bloque - Date.now()) / 1000) : 0;
    if (pen && parch) {
      pen.hidden = reste <= 0; parch.classList.toggle("ensorcele", reste > 0);
      if (reste > 0) pen.textContent = "🧙‍♀️ Mauvaise réponse ! La sorcière vous jette un sort : attendez " + reste + " s.";
    }
  }
  function ensorceler() { var st = etape(S.courant); st.bloque = Date.now() + JEU.indices.penalite * 1000; sauver(); majIndices(); }
  function estEnsorcele() { var st = etape(S.courant); return st.bloque && st.bloque > Date.now(); }
  setInterval(function () { if (S.ecran === "etape") majIndices(); }, 1000);

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
      if (st.arrive) {
        h += JEU.objetsPhysiques
          ? blocArrivee(d.lieu.indice) + '<button class="btn gros" data-action="trouve">✋ On a trouvé la cachette !</button>'
          : blocArrivee("La sorcière a laissé quelque chose de magique ici…") + '<button class="btn gros" data-action="trouve">✨ Voir ce que la sorcière a laissé</button>';
      } else {
        h += '<div class="carte-bloc"><p class="etiquette-etape">Où aller ?</p><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><p style="font-size:1.25rem">' + esc(d.lieu.indice) + "</p>" + boutonVoix(d.lieu.indice) + "</div></div>" +
          radarHTML(d.lieu) + miniPlan(d.lieu, d.emoji) + blocVerrou() +
          (d.lieu.verifie ? "" : '<span class="fictif">⚠ ' + esc(d.lieu.nom) + " : lieu repéré sur la carte, à vérifier</span>");
      }
    }
    else if (st.phase === "petits" && !apparitionVue[d.id]) {
      var QA = question(d.id, "petits"), A = QA.apparition;
      h += '<div class="apparition pile centre"><p class="age">Regardez bien… ça va disparaître !</p>' +
        (A.couleur ? '<span class="apparition-boite" style="background:' + A.couleur + '" aria-hidden="true">' + A.emoji + "</span>" : '<span class="apparition-emoji" aria-hidden="true">' + A.emoji + "</span>") +
        '<div class="ligne" style="justify-content:center;flex-wrap:nowrap"><p style="font-size:1.3rem;font-weight:600">' + esc(A.texte) + "</p>" + boutonVoix(d.recit + " " + A.texte) + "</div></div>" +
        '<button class="btn gros" data-action="apparition-vue">👀 On a bien regardé !</button>';
      minuterieApparition(d.id);
    }
    else if (st.phase === "petits") {
      var P = question(d.id, "petits"), contenuChoix; demarrerChrono(st, "petits");
      if (P.couleurs) contenuChoix = P.couleurs.map(function (c, i) { return '<button class="choix couleur" style="background:' + c + '" data-choix="' + i + '" aria-label="' + esc(P.nomsCouleurs[i]) + '"></button>'; }).join("");
      else if (P.compter) contenuChoix = P.compter.options.map(function (n, i) { return '<button class="choix" data-choix="' + i + '" aria-label="' + n + '"><span class="compte">' + new Array(n + 1).join(P.compter.emoji) + "</span></button>"; }).join("");
      else contenuChoix = P.choix.map(function (c, i) { return '<button class="choix" data-choix="' + i + '">' + c + "</button>"; }).join("");
      h += '<div class="parchemin" id="parchemin"><p class="age">Épreuve des petits · 2-6 ans</p><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><h3>' + esc(P.question) + "</h3>" + boutonVoix(P.question) + "</div>" +
        '<div class="choix-grille">' + contenuChoix + '</div><p class="retour" id="retour" aria-live="polite"></p>' +
        '<button class="btn second" data-action="revoir">👀 Revoir</button>' + zoneIndices("petits") + "</div>";
    }
    else if (st.phase === "moyens") {
      var M = question(d.id, "moyens"); demarrerChrono(st, "moyens");
      h += '<div class="parchemin" id="parchemin"><p class="age">Épreuve des moyens · 7-10 ans</p><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><h3>' + esc(M.question) + "</h3>" + boutonVoix(M.question + " " + M.options.join(", ")) + "</div>" +
        '<div class="reponses">' + M.options.map(function (o, i) { return '<button class="reponse" data-rep-moyens="' + i + '">' + esc(o) + "</button>"; }).join("") + "</div>" +
        '<p class="retour" id="retour" aria-live="polite"></p>' + zoneIndices("moyens") + "</div>";
    }
    else if (st.phase === "grands") {
      var G = question(d.id, "grands"); demarrerChrono(st, "grands");
      h += '<div class="parchemin" id="parchemin"><p class="age">Épreuve des grands · 11-14 ans</p><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><h3>L\'énigme de la sorcière</h3>' + boutonVoix(G.question) + "</div>" +
        "<p style=\"font-size:1.1rem\">" + esc(G.question) + "</p>" +
        (G.code ? '<p class="message-code">' + esc(G.code) + "</p>" : "") +
        (G.alphabet ? '<div class="alphabet">' + "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(function (l, i) { return "<span><b>" + l + "</b>" + (i + 1) + "</span>"; }).join("") + "</div>" : "") +
        '<form class="pile" data-form="grands"><label for="rep-grands" class="petit">Votre réponse</label>' +
        '<input id="rep-grands" class="saisie" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<button class="btn" type="submit">Valider</button></form><p class="retour" id="retour" aria-live="polite"></p>' +
        zoneIndices("grands") + "</div>";
    }
    else if (st.phase === "recompense") {
      var mot = JEU.formule[d.id - 1];
      h += '<div class="carte-bloc recompense pile"><p class="doux">Un morceau de la formule apparaît…</p><p class="mot-gagne">' + esc(mot) + "</p>" +
        (d.chiffre ? '<p>Et un chiffre du cadenas : le <b>' + d.chiffre.position + (d.chiffre.position === 1 ? "er" : "e") + "</b> chiffre est <b style=\"font-size:1.6rem;color:var(--flamme)\">" + esc(d.chiffre.valeur) + "</b></p>" : "") +
        (JEU.objetsPhysiques ? '<p class="doux petit">Laissez la cachette en place pour les autres équipes.</p>' : "") + "</div>" +
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
    if (!S.coffreArrive) {
      return h + radarHTML(F.lieu) + miniPlan(F.lieu, "🗝️") + blocVerrou() + "</section>";
    }
    h += blocArrivee("Le coffre est ici. Tapez le code du cadenas.");
    if (!S.codeOuvert) {
      var aff = "";
      for (var i = 0; i < JEU.codeCadenas.length; i++) aff += "<span>" + (saisieCode[i] || "") + "</span>";
      h += "<h3>Le cadenas du coffre</h3><p class=\"doux\">Tapez les 4 chiffres trouvés, dans l'ordre (regardez dans 🎒 Mon sac)." + (JEU.objetsPhysiques ? " Ensuite, tournez les molettes du vrai cadenas." : "") + "</p>" +
        '<div class="affiche-code" aria-live="polite">' + aff + '</div><p class="retour" id="retour"></p><div class="clavier">' +
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map(function (k) { return '<button data-touche="' + k + '" aria-label="' + (k === "⌫" ? "Effacer" : k === "✓" ? "Valider" : k) + '">' + k + "</button>"; }).join("") + "</div>";
    } else {
      h += '<div class="carte-bloc centre pile"><span class="apparition-emoji" aria-hidden="true">🧰</span><p style="font-size:1.2rem">Le coffre magique s\'ouvre… Tous ensemble, criez la formule !</p><button class="btn" data-action="victoire">Nous avons crié la formule ! 📣</button></div>';
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
  var pinSaisi = "", orgOuvert = false, confirmeReset = false, pinMode = "orga", pinRetour = "carte";
  vues.pin = function () {
    var aff = ""; for (var i = 0; i < JEU.codeOrganisateur.length; i++) aff += "<span>" + (pinSaisi[i] ? "•" : "") + "</span>";
    var titre = pinMode === "debloquer" ? "Déblocage par un adulte" : "Mode organisateur";
    var texte = pinMode === "debloquer" ? "Le GPS ne marche pas ? Si vous êtes bien à la cachette, un adulte tape le code organisateur pour débloquer l'épreuve." : "Réservé aux adultes. Tapez le code organisateur.";
    return '<section class="pile"><h2>' + titre + '</h2><p class="doux">' + texte + "</p>" +
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
    var reponses = !S.equipe ? "" : JEU.etapes.map(function (d) {
      var P = question(d.id, "petits"), M = question(d.id, "moyens"), G = question(d.id, "grands");
      var bonP = P.couleurs ? P.nomsCouleurs[P.bonne] : P.compter ? String(P.compter.options[P.bonne]) : P.choix[P.bonne];
      return "<tr><td><b>" + d.id + ". " + esc(d.nom) + "</b><br><span class=\"doux petit\">" + esc(d.lieu.nom) + (d.lieu.verifie ? " ✔ vérifié" : " ⚠ à vérifier") + "</span></td><td>" + esc(bonP) + "</td><td>" + esc(M.options[M.bonne]) + "</td><td>" + esc(G.reponses[0]).toUpperCase() + "</td><td>" + (d.chiffre ? d.chiffre.position + "e = " + esc(d.chiffre.valeur) : "—") + "</td></tr>";
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
      (S.courant && !etape(S.courant).fini ? '<button class="btn" data-action="passer">' + (etape(S.courant).phase === "chercher" && !etape(S.courant).arrive ? "Débloquer l\'arrivée à la cachette (sans GPS)" : "Valider l\'épreuve en cours (" + esc(etape(S.courant).phase) + ")") + "</button>" : (nbFinies() === JEU.etapes.length && !S.coffreArrive ? '<button class="btn" data-action="ouvrir-coffre">Débloquer l\'arrivée au coffre (sans GPS)</button>' : '<p class="doux">Aucune épreuve en cours.</p>')) +
      '<button class="btn second" data-action="changer-equipe">Changer d\'équipe</button>' +
      '<button class="btn second" data-action="sans-gps">' + (S.sansGps ? "Rendre le GPS obligatoire" : "Dépannage : jouer sans GPS sur ce téléphone") + "</button></div>" +
      '<div class="carte-bloc"><h3>Réponses de cette partie' + (equipe() ? " (équipe " + esc(equipe().nom) + ")" : "") + "</h3>" + (S.equipe ? "" : '<p class="doux">Choisissez une équipe pour voir ses questions.</p>') + '<div class="defile"><table class="tableau"><tr><th>Cachette</th><th>Petits</th><th>Moyens</th><th>Grands</th><th>Cadenas</th></tr>' + reponses + "</table></div>" +
      "<p>Code du cadenas : <b>" + esc(JEU.codeCadenas) + "</b> · Formule : <b>" + esc(JEU.formuleAffichee) + "</b></p></div>" +
      (JEU.objetsPhysiques ? '<div class="carte-bloc"><h3>À cacher avant la partie</h3><ul class="pile" style="padding-left:20px;margin:0">' + objets + "</ul></div>" : '<div class="carte-bloc"><h3>Rien à cacher</h3><p>Tout apparaît sur le téléphone à l\'arrivée. Pour la version avec objets cachés, mettez <code>objetsPhysiques: true</code> dans data.js.</p></div>') +
      '<div class="carte-bloc"><h3>Partager le jeu</h3><button class="btn second" data-aller="partage">📱 Afficher le QR code</button></div>' +
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
    res.push({ titre: "Position GPS", etat: !gpsDispo ? "ko" : (S.gps ? "ok" : "att"), detail: !gpsDispo ? "Le GPS ne peut pas marcher ici : ouvrez le jeu depuis son adresse https." : (S.gps ? "Localisation autorisée. Le GPS marche aussi en mode avion (sans Internet), dehors, en quelques secondes." : "Pas encore autorisée : commencez l'aventure, le jeu vous demandera d'autoriser la localisation. Elle est obligatoire pour jouer.") });
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
  /* Installation obligatoire sur le téléphone + protection anti-erreur */
  /* ------------------------------------------------------------------ */
  var promptInstall = null, installAccepte = false;
  function estInstalle() {
    try { return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || window.navigator.standalone === true; } catch (e) { return false; }
  }
  function apercuAutorise() { if (window.APERCU_CLAUDE) return true; try { return sessionStorage.getItem("apercu-orga") === "1"; } catch (e) { return false; } }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); promptInstall = e; if (!estInstalle()) rendre(); });
  window.addEventListener("appinstalled", function () { installAccepte = true; rendre(); });
  var ua = navigator.userAgent || "";
  var estIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var estAndroid = /Android/i.test(ua);
  var estSafari = estIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

  vues.installer = function () {
    var h = '<section class="pile installer"><div class="citrouille-anim" aria-hidden="true">📲</div><h1>Installez le jeu</h1>' +
      '<p style="font-size:1.15rem">Pour jouer sans Internet et sans quitter le jeu par erreur, il faut d\'abord l\'installer sur ce téléphone. Ça prend 20 secondes.</p>';
    if (installAccepte) {
      h += '<div class="carte-bloc pile"><h3>C\'est installé ! 🎉</h3><p style="font-size:1.15rem">Fermez cette page, puis ouvrez le jeu avec l\'icône <b>🎃 Malédiction</b> sur l\'écran d\'accueil du téléphone.</p></div>';
    } else if (estIOS && !estSafari) {
      h += '<div class="carte-bloc pile"><h3>Ouvrez ce lien dans Safari</h3><p>Sur iPhone, l\'installation se fait depuis <b>Safari</b>. Copiez l\'adresse de cette page, collez-la dans Safari, puis suivez les étapes.</p><p class="adresse">' + esc(location.href.split("#")[0]) + "</p></div>";
    } else if (estIOS) {
      h += '<ol class="etapes-install">' +
        '<li><span class="num">1</span><span>Touchez le bouton <b>Partager</b> <span class="pictos">⬆️</span> (le carré avec une flèche, en bas ou en haut de l\'écran).</span></li>' +
        '<li><span class="num">2</span><span>Faites défiler et touchez <b>« Sur l\'écran d\'accueil »</b> <span class="pictos">➕</span>.</span></li>' +
        '<li><span class="num">3</span><span>Touchez <b>« Ajouter »</b> en haut à droite.</span></li>' +
        '<li><span class="num">4</span><span>Fermez Safari et ouvrez le jeu avec l\'icône <b>🎃 Malédiction</b>.</span></li></ol>';
    } else if (promptInstall) {
      h += '<button class="btn gros" data-action="installer">📲 Installer le jeu</button><p class="doux">Puis ouvrez le jeu avec l\'icône <b>🎃 Malédiction</b> sur l\'écran d\'accueil.</p>';
    } else {
      h += '<ol class="etapes-install">' +
        '<li><span class="num">1</span><span>Touchez le menu <b>⋮</b> en haut à droite de Chrome.</span></li>' +
        '<li><span class="num">2</span><span>Touchez <b>« Installer l\'application »</b> ou <b>« Ajouter à l\'écran d\'accueil »</b>.</span></li>' +
        '<li><span class="num">3</span><span>Ouvrez le jeu avec l\'icône <b>🎃 Malédiction</b> sur l\'écran d\'accueil.</span></li></ol>' +
        '<p class="doux petit">Déjà installé ? Ouvrez-le simplement depuis l\'icône.' + (estAndroid ? "" : " Sur ordinateur, utilisez Chrome ou Edge.") + "</p>";
    }
    h += '<button class="btn second" data-aller="partage">📱 Montrer le QR code à un autre téléphone</button>' +
      '<button class="btn discret" data-action="apercu">Organisateur : tester dans le navigateur</button></section>';
    return h;
  };


  vues.localisation = function () {
    var h = '<section class="pile installer"><div class="citrouille-anim" aria-hidden="true">📍</div><h1>Activez la localisation</h1>' +
      '<p style="font-size:1.15rem">Le téléphone doit savoir où vous êtes pour ouvrir les énigmes quand vous arrivez aux cachettes. Sans localisation, on ne peut pas jouer.</p>';
    if (gps.refuse) {
      h += '<div class="carte-bloc pile" style="text-align:left"><h3>La localisation est bloquée</h3>' +
        (estIOS
          ? '<ol class="etapes-install"><li><span class="num">1</span><span>Ouvrez les <b>Réglages</b> de l\'iPhone.</span></li><li><span class="num">2</span><span><b>Confidentialité et sécurité</b> → <b>Service de localisation</b> : activé.</span></li><li><span class="num">3</span><span>Plus bas, touchez <b>Sites web Safari</b> → <b>Lorsque l\'app est active</b>.</span></li><li><span class="num">4</span><span>Revenez ici et touchez <b>Réessayer</b>.</span></li></ol>'
          : '<ol class="etapes-install"><li><span class="num">1</span><span>Faites un appui long sur l\'icône <b>🎃 Malédiction</b> → <b>Infos sur l\'appli</b> (ou ⓘ).</span></li><li><span class="num">2</span><span><b>Autorisations</b> → <b>Position</b> → <b>Autoriser</b>.</span></li><li><span class="num">3</span><span>Vérifiez que la <b>Localisation</b> du téléphone est activée (menu du haut de l\'écran).</span></li><li><span class="num">4</span><span>Revenez ici et touchez <b>Réessayer</b>.</span></li></ol>') +
        "</div>" + '<button class="btn gros" data-action="gps">🔄 Réessayer</button>';
    } else if (gps.suivi !== null) {
      h += '<div class="radar"><span class="radar-emoji" aria-hidden="true">🛰️</span><p class="radar-texte">Recherche…</p><p class="radar-dist">Si le téléphone demande, touchez <b>Autoriser</b>. Restez dehors quelques secondes.</p></div>';
    } else {
      h += '<button class="btn gros" data-action="gps">📍 Autoriser la localisation</button>' +
        '<p class="doux">Le téléphone va demander : touchez <b>« Autoriser »</b>' + (estIOS ? " (ou « Autoriser lorsque l'app est active »)" : " (ou « Lorsque vous utilisez l'appli »)") + ".</p>";
    }
    return h + '<button class="btn discret" data-aller="pin">Organisateur</button></section>';
  };

  // Une fois installé : pas de retour arrière ni d'actualisation par erreur
  function protegerNavigation() {
    try {
      history.pushState({ jeu: 1 }, "", location.href);
      window.addEventListener("popstate", function () {
        history.pushState({ jeu: 1 }, "", location.href);
        if (S.ecran === "etape" || S.ecran === "inventaire" || S.ecran === "final") aller("carte");
        else if (S.ecran === "pin" || S.ecran === "verif") aller(S.equipe ? "carte" : "accueil");
        else toast("Le jeu reste ouvert 🎃");
      });
    } catch (e) {}
    window.addEventListener("beforeunload", function (e) { if (S.equipe && !S.victoire) { e.preventDefault(); e.returnValue = ""; } });
  }
  // Garder l'écran allumé pendant la partie (si le téléphone l'accepte)
  var verrouEcran = null;
  function garderEcranAllume() {
    try { if (navigator.wakeLock && document.visibilityState === "visible" && !verrouEcran) navigator.wakeLock.request("screen").then(function (w) { verrouEcran = w; w.addEventListener("release", function () { verrouEcran = null; }); }).catch(function () {}); } catch (e) {}
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { garderEcranAllume(); if (gps.suivi === null && S.gps) lancerGPS(); } });

  /* ------------------------------------------------------------------ */
  /* Rendu + événements                                                 */
  /* ------------------------------------------------------------------ */
  function rendre() {
    if (S.ecran !== "accueil" && S.ecran !== "intro" && S.ecran !== "equipes" && S.ecran !== "verif" && S.ecran !== "pin" && S.ecran !== "orga" && S.ecran !== "partage" && !S.equipe) S.ecran = "accueil";
    if (S.victoire && S.ecran === "final") S.ecran = "victoire";
    var libre = { pin: 1, orga: 1, verif: 1, partage: 1 };
    var avecGps = { intro: 1, equipes: 1, carte: 1, etape: 1, inventaire: 1, final: 1 };
    var v;
    if (!estInstalle() && !apercuAutorise() && !libre[S.ecran]) v = vues.installer;
    else if (!S.gps && !S.sansGps && !window.APERCU_CLAUDE && avecGps[S.ecran]) v = vues.localisation;
    else v = vues[S.ecran] || vues.accueil;
    app.innerHTML = v();
    rendreNav();
    carte.cadrage = true;
    if (document.querySelector(".plan-mini")) { var cible = document.querySelector(".plan-mini .cible"); carte.vue = null; brancherCarte(); carte.vue = vueCible({ x: +cible.dataset.mx, y: +cible.dataset.my }); appliquerVue(); }
    else brancherCarte();
    derniereDistance = null;
    majGPS();
    majIndices();
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
    audio(); garderEcranAllume();
    if (b.dataset.dire) { parler(b.dataset.dire, b); return; }
    if (b.dataset.carte) {
      var c = b.dataset.carte;
      if (c === "plus" || c === "moins") carte.cadrage = false;
      if (c === "plus") zoomer(1 / 1.5); else if (c === "moins") zoomer(1.5);
      else if (c === "parcours") { carte.suivre = false; carte.vue = vueParcours(); appliquerVue(); }
      else if (c === "moi") {
        if (gps.suivi === null) { lancerGPS(); toast("Recherche de votre position…"); carte.suivre = true; }
        else if (!gps.pos) toast("Recherche du signal GPS…");
        else if (!dansLeVillage()) toast("Vous êtes en dehors de la carte de Saint-Gal.");
        else if (document.querySelector(".plan-mini")) { carte.cadrage = true; majGPS(); }
        else { carte.suivre = true; if (carte.vue.w > 260) carte.vue.w = 200; var m = versCarte(gps.pos.lat, gps.pos.lng); centrerSur(m[0], m[1]); }
      }
      placerSurCarte(); return;
    }
    if (b.dataset.aller) {
      var cible = b.dataset.aller;
      if (cible === "pin" && orgOuvert) cible = "orga";
      if (cible === "verif") verifs = null;
      if (cible === "pin") { pinSaisi = ""; pinMode = "orga"; }
      if (cible === "etape" && !S.courant) cible = "carte";
      aller(cible); return;
    }
    if (b.dataset.equipe) {
      S.equipe = b.dataset.equipe; if (!S.debut) S.debut = Date.now(); carte.vue = null; tirer(); sauver();
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
      var i = +b.dataset.choix;
      if (i === question(S.courant, "petits").bonne) { b.classList.add("bon"); retour("Bravo ! 🎉", true); son.bon(); setTimeout(function () { valider("moyens"); }, 700); }
      else { b.classList.remove("faux"); void b.offsetWidth; b.classList.add("faux"); retour("Essaie encore !", false); son.faux(); }
      return;
    }
    if (b.dataset.repMoyens !== undefined) {
      if (estEnsorcele()) return;
      var im = +b.dataset.repMoyens;
      if (im === question(S.courant, "moyens").bonne) { b.classList.add("bon"); retour("Bravo ! 🎉", true); son.bon(); setTimeout(function () { valider("grands"); }, 700); }
      else { b.classList.remove("faux"); void b.offsetWidth; b.classList.add("faux"); b.disabled = true; retour("", false); son.faux(); ensorceler(); }
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
        if (pinSaisi === JEU.codeOrganisateur) {
          pinSaisi = "";
          if (pinMode === "debloquer") {
            if (S.courant && !etape(S.courant).fini) { etape(S.courant).arrive = true; etape(S.courant).aide = true; }
            else if (nbFinies() === JEU.etapes.length) S.coffreArrive = true;
            sauver(); pinMode = "orga"; son.tresor(); aller(pinRetour); return;
          }
          orgOuvert = true; if (!estInstalle()) { try { sessionStorage.setItem("apercu-orga", "1"); } catch (e) {} } aller("orga"); return;
        }
        pinSaisi = ""; rendre(); retour("Code incorrect.", false); return;
      } else if (pinSaisi.length < JEU.codeOrganisateur.length) pinSaisi += kp;
      rendre(); return;
    }
    switch (b.dataset.action) {
      case "commencer": S.debut = S.debut || null; aller("intro"); son.fantome(); break;
      case "son": S.son = !S.son; sauver(); rendre(); if (S.son) son.bon(); break;
      case "gps": carte.suivre = true; lancerGPS(); break;
      case "trouve": valider("petits"); break;
      case "apparition-vue": clearTimeout(minuterie); apparitionVue[S.courant] = true; rendre(); break;
      case "revoir": apparitionVue[S.courant] = false; rendre(); break;
      case "aller-prochaine":
        var pr = prochaineEtape();
        if (pr) { S.courant = pr; etape(pr); aller("etape"); } else if (nbFinies() === JEU.etapes.length) aller("final");
        break;
      case "ranger":
        var st2 = etape(S.courant); st2.fini = true; st2.heure = Date.now(); st2.phase = "fini";
        var finiTout = nbFinies() === JEU.etapes.length; S.courant = null; sauver(); son.tresor();
        aller(finiTout ? "final" : "carte"); if (finiTout) etincelles(); break;
      case "victoire": S.victoire = true; S.fin = S.fin || Date.now(); sauver(); son.victoire(); aller("victoire"); etincelles(); break;
      case "retour-jeu": if (pinMode === "debloquer") { pinMode = "orga"; aller(pinRetour); } else aller(S.equipe ? "carte" : "accueil"); break;
      case "debloquer-adulte": pinMode = "debloquer"; pinRetour = S.ecran; pinSaisi = ""; aller("pin"); break;
      case "ouvrir-coffre": S.coffreArrive = true; sauver(); toast("Arrivée au coffre débloquée"); rendre(); break;
      case "installer":
        if (promptInstall) { promptInstall.prompt(); promptInstall.userChoice.then(function (c) { if (c && c.outcome === "accepted") { installAccepte = true; } promptInstall = null; rendre(); }).catch(function () { promptInstall = null; rendre(); }); }
        break;
      case "fermer-orga": orgOuvert = false; confirmeReset = false; aller(S.equipe ? "carte" : "accueil"); break;
      case "passer":
        var st3 = etape(S.courant), ordre = ["chercher", "petits", "moyens", "grands", "recompense"];
        st3.aide = true; st3.bloque = 0; if (st3.phase === "chercher" && !st3.arrive) st3.arrive = true; else st3.phase = ordre[Math.min(ordre.indexOf(st3.phase) + 1, 4)]; sauver(); toast("Épreuve validée par l'organisateur"); rendre(); break;
      case "changer-equipe": S.equipe = null; orgOuvert = false; aller("equipes"); break;
      case "reset": confirmeReset = true; rendre(); break;
      case "reset-non": confirmeReset = false; rendre(); break;
      case "sans-gps": S.sansGps = !S.sansGps; sauver(); toast(S.sansGps ? "Jeu autorisé sans GPS sur ce téléphone" : "GPS de nouveau obligatoire"); rendre(); break;
      case "reset-ok":
        var garderSon = S.son, garderGps = S.gps; S = etatVierge(); S.son = garderSon; S.gps = garderGps; gps.annonce = {}; sauver(); confirmeReset = false; orgOuvert = false; toast("Partie réinitialisée"); aller("accueil"); break;
      case "reverif": verifs = null; rendre(); break;
      case "apercu": pinMode = "orga"; pinSaisi = ""; aller("pin"); break;
    }
  });

  document.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, quoi = f.dataset.form; if (!quoi) return;
    var d = donneesEtape(S.courant), champ = f.querySelector("input"), val = champ.value;
    if (estEnsorcele()) return;
    var ok = bonneReponse(val, question(S.courant, quoi).reponses);
    if (ok) { retour("Bonne réponse ! ✨", true); champ.blur(); setTimeout(function () { valider(quoi === "moyens" ? "grands" : "recompense"); }, 600); }
    else if (!val.trim()) retour("Écrivez une réponse d'abord.", false);
    else { retour("", false); son.faux(); champ.select(); ensorceler(); }
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
  try {
    if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: "geolocation" }).then(function (r) {
      if (r.state === "granted" && gps.suivi === null) lancerGPS();
      if (r.state === "denied") { gps.refuse = true; S.gps = false; sauver(); rendre(); }
      r.onchange = function () { if (r.state === "granted") { gps.refuse = false; lancerGPS(); } else if (r.state === "denied") { gps.refuse = true; S.gps = false; sauver(); rendre(); } };
    }).catch(function () {});
  } catch (e) {}
  if (estInstalle()) protegerNavigation();
  garderEcranAllume();
  if (S.ecran === "pin" || S.ecran === "orga") S.ecran = S.equipe ? "carte" : "accueil";
  rendre();
})();
