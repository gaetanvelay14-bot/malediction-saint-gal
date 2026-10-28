(function () {
/* La Malédiction de Saint-Gal — application (joueur + organisateur).
   Les fichiers src/js/*.js sont assemblés dans cet ordre en un seul app.js,
   à l'intérieur d'une même fonction : ils partagent leurs variables. */
"use strict";

var app = document.getElementById("app");
var nav = document.getElementById("nav");
var URL_JEU = "https://gaetanvelay14-bot.github.io/malediction-saint-gal/";

/* ------------------------------------------------------------------ */
/* Stockage local                                                     */
/* ------------------------------------------------------------------ */
function lire(cle, defaut) {
  try { var b = localStorage.getItem(cle); return b ? JSON.parse(b) : defaut; } catch (e) { return defaut; }
}
function ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); return true; } catch (e) { return false; } }

// UI : écran courant et préférences du téléphone
var UI = Object.assign({ ecran: "accueil", son: true, gps: false, sansGps: false, onglet: "carte", orgaMi: null, codeOrga: "1031" }, lire("msg-ui", {}));
function sauverUI() { ecrire("msg-ui", UI); }

/* ------------------------------------------------------------------ */
/* Outils                                                             */
/* ------------------------------------------------------------------ */
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function normaliser(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, ""); }
function formes(t) {
  var brut = String(t || "").toLowerCase().trim(), f = [normaliser(brut)];
  var m = brut.match(/^(une|un|les|le|la|l')\s*(.+)$/); if (m) f.push(normaliser(m[2]));
  return f.filter(Boolean);
}
function bonneReponse(saisie, liste) {
  var s = formes(saisie); if (!s.length) return false;
  return liste.some(function (r) { var a = formes(r); return s.some(function (x) { return a.indexOf(x) >= 0; }); });
}
function duree(ms) { var m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return m + " min " + (s < 10 ? "0" : "") + s + " s"; }
function dureeMin(min) { min = Math.round(min); var h = Math.floor(min / 60), m = min % 60; return h ? h + " h " + (m < 10 ? "0" : "") + m : m + " min"; }
function toast(txt) {
  var t = document.createElement("div"); t.className = "toast"; t.textContent = txt; t.setAttribute("role", "status");
  document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
}
function vibrer(motif) { try { if (navigator.vibrate) navigator.vibrate(motif); } catch (e) {} }
function idAleatoire() { return Math.random().toString(36).slice(2, 8); }
function copie(o) { return JSON.parse(JSON.stringify(o)); }
function ordinal(n) { return n + (n === 1 ? "er" : "e"); }

// Hasard reproductible : même graine = même tirage sur tous les téléphones
function rng(graine) {
  var a = graine >>> 0;
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hacher(txt) { var h = 2166136261; for (var i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function melanger(tab, alea) { var a = tab.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(alea() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function melangeHasard(tab) { return melanger(tab, Math.random); }

/* ------------------------------------------------------------------ */
/* Sons synthétisés (aucun fichier audio)                             */
/* ------------------------------------------------------------------ */
var ctxAudio = null;
function audio() {
  if (!UI.son) return null;
  try { if (!ctxAudio) ctxAudio = new (window.AudioContext || window.webkitAudioContext)(); if (ctxAudio.state === "suspended") ctxAudio.resume(); return ctxAudio; } catch (e) { return null; }
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
  pop: function () { note(900 + Math.random() * 300, 0, .09, "square", .08); },
  ingredient: function (i) { note([392, 494, 587, 698][i % 4], 0, .35, "triangle", .2); },
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
/* Lecture à voix haute                                               */
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
    var u = new SpeechSynthesisUtterance(String(txt).replace(/[\u{1F300}-\u{1FAFF}☀-➿️‍]/gu, " "));
    u.lang = "fr-FR"; u.rate = .92; if (voixFr) u.voice = voixFr;
    if (bouton) { bouton.classList.add("parle"); u.onend = u.onerror = function () { bouton.classList.remove("parle"); }; }
    speechSynthesis.speak(u);
  } catch (e) { toast("Lecture impossible. Un grand peut lire !"); }
}
function boutonVoix(txt) { return '<button class="voix" data-dire="' + esc(txt) + '" aria-label="Écouter le texte">🔊</button>'; }
function arretVoix() { try { speechSynthesis.cancel(); } catch (e) {} }

/* ------------------------------------------------------------------ */
/* Le parcours : missions, équipes, réglages                          */
/* ------------------------------------------------------------------ */
var DEPART_DEFAUT = { nom: "Devant la mairie", indice: "Retournez devant la mairie, là où l'aventure a commencé.", lat: 44.669485, lng: 3.424379 };

function missionVierge(lat, lng, n) {
  return {
    id: idAleatoire(), nom: "Mission " + (n || ""), emoji: EMOJIS_MISSION[(n || 0) % EMOJIS_MISSION.length],
    type: "enigmes", nb: 1, niveau: 2, chrono: 0, cachee: false,
    mot: MOTS_RESERVE[(n || 0) % MOTS_RESERVE.length], lieu: "", indice: "",
    lat: lat, lng: lng, rayon: null, perso: [], defis: []
  };
}

function completerParcours(p) {
  p = p || {};
  var r = {
    v: 1, id: p.id || "p" + idAleatoire(), nom: p.nom || "Mon parcours",
    graine: p.graine || Math.floor(Math.random() * 1e9),
    code: String(p.code || UI.codeOrga || "1031"), codeCoffre: String(p.codeCoffre != null ? p.codeCoffre : "3110").replace(/\D/g, ""),
    equipes: (p.equipes && p.equipes.length ? p.equipes : EQUIPES_PROPOSEES.slice(0, 2)).map(function (e, i) { return { nom: e.nom || ("Équipe " + (i + 1)), emoji: e.emoji || "⭐", couleur: e.couleur || EQUIPES_PROPOSEES[i % 4].couleur }; }),
    ages: Object.assign({ petits: true, moyens: true, grands: true }, p.ages || {}),
    ordre: p.ordre === "meme" ? "meme" : "decale",
    indices: Object.assign({ premier: 90, intervalle: 60, penalite: 15 }, p.indices || {}),
    rayon: +p.rayon || 15,
    depart: Object.assign({}, DEPART_DEFAUT, p.depart || {}),
    missions: (p.missions || []).map(function (m, i) {
      var b = missionVierge(m.lat, m.lng, i + 1);
      var x = Object.assign(b, m);
      x.id = m.id || b.id; x.perso = m.perso || []; x.defis = m.defis || [];
      x.nb = Math.max(1, Math.min(4, +x.nb || 1)); x.niveau = Math.max(1, Math.min(3, +x.niveau || 2));
      if (!TYPES_QUETE[x.type]) x.type = "enigmes";
      return x;
    }),
    maj: p.maj || Date.now()
  };
  return r;
}
function depuisModele(i, fixe) {
  var p = completerParcours(copie(MODELES[i].parcours));
  if (fixe) { p.id = "modele-" + i; p.graine = 31102026 + i; }
  return p;
}

/* ----- Coordonnées sur la carte (mètres) ----- */
function xy(o) { var m = versCarte(o.lat, o.lng); return { x: m[0], y: m[1] }; }
function depuisCarte(x, y) { return { lat: Math.round((CARTE_SG.nord - y / CARTE_SG.ky) * 1e6) / 1e6, lng: Math.round((CARTE_SG.ouest + x / CARTE_SG.kx) * 1e6) / 1e6 }; }
function rayonMission(p, m) { return +m.rayon || p.rayon || 15; }

/* ----- Ordre des missions pour chaque équipe ----- */
function ordreEquipe(p, t) {
  var M = p.missions.length, base = p.missions.map(function (_, i) { return i; });
  if (p.ordre === "meme" || !M) return base;
  var debut = Math.round(t * M / p.equipes.length) % M;
  return base.slice(debut).concat(base.slice(0, debut));
}

/* ----- Chiffres du coffre et formule ----- */
function chiffres(p) {
  var code = p.codeCoffre || "", L = code.length, M = p.missions.length, r = {};
  if (!L || !M) return r;
  for (var i = 0; i < Math.min(L, M); i++) r[Math.floor(i * M / Math.min(L, M))] = { pos: i + 1, val: code[i] };
  return r;
}
function formule(p) {
  var mots = p.missions.map(function (m) { return (m.mot || "").trim(); }).filter(Boolean);
  if (!mots.length) return "";
  var t = mots.join(" ");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return /[!?.]$/.test(t) ? t : t + " !";
}

/* ----- Questions : chaque équipe a sa part, sans doublon ----- */
var AGES = [
  { cle: "petits", nom: "Petits", detail: "2-6 ans", minutes: 1.5 },
  { cle: "moyens", nom: "Moyens", detail: "7-10 ans", minutes: 2.5 },
  { cle: "grands", nom: "Grands", detail: "11-14 ans", minutes: 3.5 }
];
function agesActifs(p) { return AGES.filter(function (a) { return p.ages[a.cle]; }); }
function besoinParEquipe(p) {
  return p.missions.reduce(function (s, m) { return s + (m.type === "enigmes" ? m.nb : 0); }, 0);
}
var cacheTirage = {};
function tirage(p, t) {
  var cle = p.id + ":" + p.graine + ":" + t + ":" + p.missions.map(function (m) { return m.type + m.nb; }).join(",");
  if (cacheTirage[cle]) return cacheTirage[cle];
  var k = besoinParEquipe(p), res = {};
  AGES.forEach(function (a) {
    var reserve = QUESTIONS[a.cle].map(function (_, i) { return i; });
    var ordre = melanger(reserve, rng(hacher(p.graine + ":" + a.cle)));
    var n = ordre.length, debut = t * k, pos = 0;
    res[a.cle] = {};
    p.missions.forEach(function (m, mi) {
      if (m.type !== "enigmes") return;
      res[a.cle][mi] = [];
      for (var r = 0; r < m.nb; r++) { res[a.cle][mi].push(ordre[(debut + pos) % n]); pos++; }
    });
  });
  cacheTirage[cle] = res;
  return res;
}
function questionEnigme(p, t, mi, r, age) {
  var idx = tirage(p, t)[age][mi][r], q = QUESTIONS[age][idx];
  if (age === "moyens") {
    var ordre = melanger([0, 1, 2, 3].slice(0, q.options.length), rng(hacher(p.graine + ":o:" + t + ":" + mi + ":" + r)));
    return Object.assign({}, q, { options: ordre.map(function (k) { return q.options[k]; }), bonne: ordre.indexOf(q.bonne) });
  }
  return q;
}
function defiPour(p, t, mi) {
  var m = p.missions[mi];
  var perso = m.defis && m.defis[indexEquipe(m, t)];
  if (perso && perso.trim()) return perso.trim();
  var auto = p.missions.map(function (x, i) { return i; }).filter(function (i) { var x = p.missions[i]; return x.type === "defi" && !(x.defis && x.defis[t] && x.defis[t].trim()); });
  var ordre = melanger(DEFIS.map(function (_, i) { return i; }), rng(hacher(p.graine + ":defis")));
  var k = p.missions.filter(function (x) { return x.type === "defi"; }).length;
  return DEFIS[ordre[(t * k + auto.indexOf(mi)) % ordre.length]];
}
// Par défaut, une question écrite par l'organisateur vaut pour toutes les équipes
function estCommune(m) { return m.commune !== false; }
function indexEquipe(m, t) { return estCommune(m) ? 0 : t; }
function questionLieu(p, t, mi) { var m = p.missions[mi]; return (m.perso || [])[indexEquipe(m, t)] || null; }

/* ----- Durée estimée ----- */
var VITESSE_ENFANTS = 42; // mètres par minute, en groupe avec des petits
function minutesQuete(p, m) {
  if (m.type === "enigmes") return m.nb * agesActifs(p).reduce(function (s, a) { return s + a.minutes; }, 0);
  if (m.type === "defi") return TYPES_QUETE.defi.minutes + (m.chrono || 0) / 60;
  if (m.type === "fantomes" || m.type === "potion" || m.type === "memoire") return TYPES_QUETE[m.type].minutes + (m.niveau - 2);
  return TYPES_QUETE[m.type].minutes;
}
function estimer(p) {
  var parEquipe = p.equipes.map(function (_, t) {
    var ordre = ordreEquipe(p, t), pts = [p.depart].concat(ordre.map(function (i) { return p.missions[i]; })).concat([p.depart]), d = 0;
    for (var i = 1; i < pts.length; i++) d += distance(pts[i - 1], pts[i]);
    var marche = d * 1.35 / VITESSE_ENFANTS;
    var quetes = p.missions.reduce(function (s, m) { return s + minutesQuete(p, m) + 2 + (m.cachee ? 3 : 0); }, 0);
    return { distance: d * 1.35, marche: marche, quetes: quetes, total: marche + quetes + 8 };
  });
  var tot = parEquipe.reduce(function (s, e) { return Math.max(s, e.total); }, 0);
  return { total: tot, parEquipe: parEquipe };
}

/* ----- Vérification avant d'envoyer ----- */
function verifier(p) {
  var erreurs = [], alertes = [], T = p.equipes.length, M = p.missions.length;
  if (!M) erreurs.push("Ajoutez au moins une mission sur la carte.");
  if (!agesActifs(p).length && p.missions.some(function (m) { return m.type === "enigmes"; })) erreurs.push("Choisissez au moins un âge (petits, moyens ou grands) pour les énigmes.");
  if (p.codeCoffre.length > M && M) erreurs.push("Le code du coffre a " + p.codeCoffre.length + " chiffres, mais il n'y a que " + M + " mission(s). Raccourcissez le code ou ajoutez des missions.");
  if (!p.codeCoffre.length) alertes.push("Pas de code de coffre : le coffre s'ouvrira sans code.");
  var k = besoinParEquipe(p);
  agesActifs(p).forEach(function (a) {
    var n = QUESTIONS[a.cle].length;
    if (T * k > n) erreurs.push("Pas assez de questions différentes pour les " + a.nom.toLowerCase() + " : il en faut " + (T * k) + " (" + k + " par équipe), la réserve en a " + n + ". Baissez le nombre de questions ou changez des missions en mini-jeux.");
  });
  var nbDefis = p.missions.filter(function (m) { return m.type === "defi"; }).length;
  if (T * nbDefis > DEFIS.length) alertes.push("Beaucoup de défis : certains pourraient revenir deux fois.");
  p.missions.forEach(function (m, i) {
    var n = "Mission " + (i + 1) + " (" + (m.nom || "sans nom") + ")";
    if (m.type === "observation") for (var t = 0; t < (estCommune(m) ? 1 : T); t++) {
      var q = (m.perso || [])[t];
      if (!q || !q.question || !q.question.trim()) erreurs.push(n + " : écrivez la question" + (estCommune(m) ? "" : " pour l'équipe " + p.equipes[t].nom) + ".");
      else if (q.mode === "choix" && (!q.options || q.options.filter(function (o) { return o && o.trim(); }).length < 2)) erreurs.push(n + " : il faut au moins 2 réponses" + (estCommune(m) ? "" : " pour l'équipe " + p.equipes[t].nom) + ".");
      else if (q.mode !== "choix" && !(q.reponse || "").trim()) erreurs.push(n + " : indiquez la bonne réponse" + (estCommune(m) ? "" : " pour l'équipe " + p.equipes[t].nom) + ".");
    }
    if (!m.indice || !m.indice.trim()) alertes.push(n + " : pas de phrase pour dire où aller.");
    if (!horsCarte(m)) {} else alertes.push(n + " : elle est en dehors de la carte du village.");
    p.missions.forEach(function (o, j) {
      if (j <= i) return;
      var d = distance(m, o), mini = rayonMission(p, m) + rayonMission(p, o) + 10;
      if (d < mini) alertes.push("Missions " + (i + 1) + " et " + (j + 1) + " sont à " + Math.round(d) + " m l'une de l'autre : elles risquent de se débloquer en même temps.");
    });
    if (distance(m, p.depart) < rayonMission(p, m) + 15) alertes.push(n + " est très proche du départ : elle peut se débloquer dès le début.");
  });
  return { erreurs: erreurs, alertes: alertes };
}
function horsCarte(o) {
  var c = xy(o), V = CARTE_SG.vueMax;
  return c.x < V[0] || c.x > V[0] + V[2] || c.y < V[1] || c.y > V[1] + V[3];
}

/* ----- Transfert par QR code / lien ----- */
function enB64(octets) { var s = ""; for (var i = 0; i < octets.length; i++) s += String.fromCharCode(octets[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function deB64(t) { t = t.replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; var s = atob(t), o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
function fluxVersOctets(flux) { return new Response(flux).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
function encoderParcours(p) {
  var brut = copie(p); delete brut.maj;
  var json = new TextEncoder().encode(JSON.stringify(brut));
  if (typeof CompressionStream === "undefined") return Promise.resolve("j" + enB64(json));
  try {
    var flux = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return fluxVersOctets(flux).then(function (o) { return "z" + enB64(o); }).catch(function () { return "j" + enB64(json); });
  } catch (e) { return Promise.resolve("j" + enB64(json)); }
}
function decoderParcours(code) {
  return new Promise(function (ok, ko) {
    try {
      code = String(code || "").trim();
      var type = code[0], octets = deB64(code.slice(1));
      var finir = function (o) { try { ok(completerParcours(JSON.parse(new TextDecoder().decode(o)))); } catch (e) { ko(e); } };
      if (type === "j") finir(octets);
      else if (type === "z") {
        if (typeof DecompressionStream === "undefined") return ko(new Error("Ce téléphone est trop ancien pour lire ce parcours compressé."));
        fluxVersOctets(new Blob([octets]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).then(finir).catch(ko);
      } else ko(new Error("Ce code n'est pas un parcours de La Malédiction de Saint-Gal."));
    } catch (e) { ko(e); }
  });
}
// Découpe en plusieurs QR codes si le parcours est long : "MSG|id|i|n|morceau"
var TAILLE_MORCEAU = 450;
function decouper(code) {
  var id = idAleatoire().slice(0, 4), n = Math.max(1, Math.ceil(code.length / TAILLE_MORCEAU)), parts = [];
  for (var i = 0; i < n; i++) parts.push("MSG|" + id + "|" + (i + 1) + "|" + n + "|" + code.slice(i * TAILLE_MORCEAU, (i + 1) * TAILLE_MORCEAU));
  return parts;
}
function lienParcours(code) { return URL_JEU + "#p=" + code; }

/* ------------------------------------------------------------------ */
/* GPS                                                                */
/* ------------------------------------------------------------------ */
var gps = { suivi: null, pos: null, erreur: null, refuse: false };
var ecouteursGPS = [];
function versCarte(lat, lng) { return [(lng - CARTE_SG.ouest) * CARTE_SG.kx, (CARTE_SG.nord - lat) * CARTE_SG.ky]; }
function lancerGPS() {
  if (!("geolocation" in navigator)) { gps.erreur = "Ce téléphone ne donne pas sa position."; majGPS(); return; }
  if (gps.suivi !== null) return;
  gps.erreur = null;
  try {
    gps.suivi = navigator.geolocation.watchPosition(function (p) {
      gps.pos = { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy };
      gps.erreur = null; gps.refuse = false;
      if (!UI.gps) { UI.gps = true; sauverUI(); toast("Localisation activée ✅"); rendre(); }
      majGPS(); ecouteursGPS.forEach(function (f) { f(); });
    }, function (err) {
      gps.erreur = err && err.code === 1 ? "Localisation refusée. Le jeu en a besoin : autorisez-la dans les réglages du téléphone." : "Signal GPS introuvable pour l'instant. Restez à découvert quelques secondes.";
      if (err && err.code === 1) { gps.suivi = null; gps.refuse = true; UI.gps = false; sauverUI(); rendre(); return; }
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
function dansLeVillage() { return !!gps.pos && !horsCarte(gps.pos); }

/* ------------------------------------------------------------------ */
/* Carte réelle de Saint-Gal (OpenStreetMap, stockée hors ligne)      */
/* ------------------------------------------------------------------ */
var carte = { vue: null };
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
  routes.forEach(function (f) { if (f.cls === "highway=track" || f.cls === "highway=path") h.push('<path d="' + chemin(f.pts) + '" fill="none" stroke="#b39a72" stroke-width="' + largeur[f.cls] + '" stroke-dasharray="6 4" stroke-linecap="round"/>'); });
  routes.forEach(function (f) { if (largeur[f.cls] >= 5) h.push('<path d="' + chemin(f.pts) + '" fill="none" stroke="#5a4b38" stroke-width="' + (largeur[f.cls] + 2.5) + '" stroke-linecap="round" stroke-linejoin="round"/>'); });
  routes.forEach(function (f) { if (largeur[f.cls] >= 5) h.push('<path d="' + chemin(f.pts) + '" fill="none" stroke="' + (f.cls === "highway=unclassified" ? "#f1dfb4" : "#ddd0b0") + '" stroke-width="' + largeur[f.cls] + '" stroke-linecap="round" stroke-linejoin="round"/>'); });
  de(function (f) { return f.cls === "building=yes"; }).forEach(function (f) { h.push('<path d="' + chemin(f.pts, true) + '" fill="#7b6450" stroke="#4d3d2e" stroke-width=".8"/>'); });
  de(function (f) { return f.cls === "eglise"; }).forEach(function (f) { h.push('<path d="' + chemin(f.pts, true) + '" fill="#8d74a8" stroke="#4d3d5e" stroke-width="1"/>'); });
  de(function (f) { return f.cls === "mairie"; }).forEach(function (f) { h.push('<path d="' + chemin(f.pts, true) + '" fill="#b07a4c" stroke="#5e3f22" stroke-width="1"/>'); });
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
  v.w = Math.max(60, Math.min(M[2], v.w)); v.h = v.w * r;
  v.x = Math.max(M[0], Math.min(M[0] + M[2] - v.w, v.x)); v.y = Math.max(M[1], Math.min(M[1] + M[3] - v.h, v.y));
  return v;
}
function vueSur(points, marge) {
  marge = marge == null ? 45 : marge;
  if (!points.length) points = [xy(DEPART_DEFAUT)];
  var xs = points.map(function (p) { return p.x; }), ys = points.map(function (p) { return p.y; });
  var x0 = Math.min.apply(0, xs) - marge, x1 = Math.max.apply(0, xs) + marge, y0 = Math.min.apply(0, ys) - marge, y1 = Math.max.apply(0, ys) + marge;
  var r = ratioPlan(), w = Math.max(x1 - x0, (y1 - y0) / r, 160);
  return bornerVue({ x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - w * r / 2, w: w });
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
  plan.querySelectorAll(".cercle-rayon").forEach(function (el) { var px = 2 * (+el.dataset.r) / carte.vue.w * plan.clientWidth; el.style.width = el.style.height = px + "px"; });
  var pt = document.getElementById("gps-point"), halo = document.getElementById("gps-halo");
  if (pt && halo) {
    if (gps.pos && dansLeVillage()) {
      var m = versCarte(gps.pos.lat, gps.pos.lng);
      pt.hidden = halo.hidden = false; placer(pt, m[0], m[1]); placer(halo, m[0], m[1]);
      var px = Math.max(24, 2 * gps.pos.precision / carte.vue.w * plan.clientWidth); halo.style.width = halo.style.height = px + "px";
    } else { pt.hidden = halo.hidden = true; }
  }
}
function htmlPlan(contenuSvg, reperes, classe) {
  return '<div class="plan ' + (classe || "") + '" id="plan">' +
    '<svg id="plan-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-label="Carte de Saint-Gal">' + fondCarte() + (contenuSvg || "") + "</svg>" +
    '<span id="gps-halo" class="gps-halo" hidden></span><span id="gps-point" class="gps-point" hidden></span>' + (reperes || "") +
    '<span class="attribution">' + esc(TEXTES.attribution) + "</span></div>";
}

/* ----- Carte qui bouge (éditeur organisateur seulement) ----- */
function zoomer(f, mx, my) {
  var v = carte.vue; if (mx == null) { mx = v.x + v.w / 2; my = v.y + v.h / 2; }
  var nw = Math.max(60, Math.min(CARTE_SG.vueMax[2], v.w * f)), k = nw / v.w;
  v.x = mx - (mx - v.x) * k; v.y = my - (my - v.y) * k; v.w = nw; bornerVue(v); appliquerVue();
}
function brancherCarteMobile(surTap) {
  var plan = document.getElementById("plan"); if (!plan) return;
  var pts = {}, depart = null, pince = null, bouge = false, t0 = 0;
  function enMetres(cx, cy) { var r = plan.getBoundingClientRect(); return [carte.vue.x + (cx - r.left) / r.width * carte.vue.w, carte.vue.y + (cy - r.top) / r.height * carte.vue.h]; }
  plan.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button")) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (ids.length === 1) { depart = { x: e.clientX, y: e.clientY, vx: carte.vue.x, vy: carte.vue.y }; bouge = false; t0 = Date.now(); }
    if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]], c = enMetres((a.x + b.x) / 2, (a.y + b.y) / 2);
      pince = { d: Math.hypot(a.x - b.x, a.y - b.y), vue: Object.assign({}, carte.vue), mx: c[0], my: c[1] }; bouge = true;
    }
    try { plan.setPointerCapture(e.pointerId); } catch (err) {}
  });
  plan.addEventListener("pointermove", function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (ids.length >= 2 && pince) {
      var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      var nw = Math.max(60, Math.min(CARTE_SG.vueMax[2], pince.vue.w * pince.d / d)), k = nw / pince.vue.w;
      carte.vue.w = nw; carte.vue.x = pince.mx - (pince.mx - pince.vue.x) * k; carte.vue.y = pince.my - (pince.my - pince.vue.y) * k;
      bornerVue(carte.vue); appliquerVue(); return;
    }
    if (!depart) return;
    var dx = e.clientX - depart.x, dy = e.clientY - depart.y;
    if (!bouge && Math.hypot(dx, dy) < 8) return;
    bouge = true;
    var k2 = carte.vue.w / plan.clientWidth; carte.vue.x = depart.vx - dx * k2; carte.vue.y = depart.vy - dy * k2; bornerVue(carte.vue); appliquerVue();
  });
  function fin(e) {
    var etait = !!pts[e.pointerId];
    delete pts[e.pointerId]; var ids = Object.keys(pts);
    if (ids.length < 2) pince = null;
    if (ids.length === 1) { var p = pts[ids[0]]; depart = { x: p.x, y: p.y, vx: carte.vue.x, vy: carte.vue.y }; }
    if (!ids.length) {
      if (etait && e.type === "pointerup" && !bouge && Date.now() - t0 < 600 && surTap) { var m = enMetres(e.clientX, e.clientY); surTap(m[0], m[1]); }
      depart = null;
    }
  }
  plan.addEventListener("pointerup", fin); plan.addEventListener("pointercancel", fin);
  plan.addEventListener("wheel", function (e) { e.preventDefault(); var m = enMetres(e.clientX, e.clientY); zoomer(e.deltaY > 0 ? 1.15 : 1 / 1.15, m[0], m[1]); }, { passive: false });
}

/* ------------------------------------------------------------------ */
/* Radar chaud / froid                                                */
/* ------------------------------------------------------------------ */
var derniereDistance = null;
function seuilArrivee(r) { return r + (gps.pos ? Math.min(gps.pos.precision, 15) : 0); }
function temperature(d, r) {
  if (d <= seuilArrivee(r)) return { e: "🎃", t: "Vous y êtes !", c: "arrive" };
  if (d <= r + 15) return { e: "🔥", t: "Brûlant !", c: "brulant" };
  if (d <= r + 45) return { e: "🌡️", t: "Chaud", c: "chaud" };
  if (d <= r + 105) return { e: "❄️", t: "Froid", c: "froid" };
  return { e: "🥶", t: "Glacé", c: "glace" };
}
function radarHTML(lieu, r) {
  return '<div class="radar" id="radar" data-lat="' + lieu.lat + '" data-lng="' + lieu.lng + '" data-r="' + r + '">' +
    '<span class="radar-emoji" id="radar-emoji" aria-hidden="true">📍</span>' +
    '<p class="radar-texte" id="radar-texte">Activez le GPS</p>' +
    '<p class="radar-dist" id="radar-dist"></p><p class="radar-tendance" id="radar-tendance"></p>' +
    '<button class="btn" id="radar-gps" data-action="gps">📍 Activer le GPS</button></div>';
}
function majRadar() {
  var r = document.getElementById("radar"); if (!r) return;
  var lieu = { lat: +r.dataset.lat, lng: +r.dataset.lng }, ray = +r.dataset.r;
  var em = document.getElementById("radar-emoji"), tx = document.getElementById("radar-texte"), di = document.getElementById("radar-dist"), te = document.getElementById("radar-tendance"), bt = document.getElementById("radar-gps");
  bt.hidden = gps.suivi !== null;
  if (gps.erreur) { r.className = "radar"; em.textContent = "📡"; tx.textContent = "Pas de GPS"; di.textContent = gps.erreur; te.textContent = ""; return; }
  if (gps.suivi === null) { r.className = "radar"; em.textContent = "📍"; tx.textContent = "Activez le GPS"; di.textContent = "Pour savoir si vous êtes près de la mission."; te.textContent = ""; return; }
  if (!gps.pos) { r.className = "radar"; em.textContent = "🛰️"; tx.textContent = "Recherche…"; di.textContent = "Restez dehors quelques secondes."; te.textContent = ""; return; }
  var d = distance(gps.pos, lieu), T = temperature(d, ray);
  r.className = "radar " + T.c; em.textContent = T.e; tx.textContent = T.t;
  di.textContent = d <= seuilArrivee(ray) ? "" : "encore ≈ " + Math.round(d) + " m";
  if (derniereDistance !== null && Math.abs(d - derniereDistance) >= 3) { te.textContent = d < derniereDistance ? "👍 Vous vous rapprochez !" : "↩️ Vous vous éloignez…"; derniereDistance = d; }
  else if (derniereDistance === null) derniereDistance = d;
}
function majGPS() {
  var info = document.getElementById("gps-info");
  if (info && typeof texteInfoCarte === "function") { var t = texteInfoCarte(); info.textContent = t; info.hidden = !t; }
  var bouton = document.getElementById("btn-gps"); if (bouton) bouton.hidden = gps.suivi !== null;
  majRadar(); placerSurCarte();
}

/* ------------------------------------------------------------------ */
/* Côté joueur : parcours chargé et partie en cours                   */
/* ------------------------------------------------------------------ */
var JOUE = lire("msg-parcours", null);
JOUE = JOUE ? completerParcours(JOUE) : null; // aucun parcours tant que l'organisateur n'en a pas envoyé
var PARTIE = lire("msg-partie", null);
function partieVierge() { return { pid: JOUE ? JOUE.id : null, graine: JOUE ? JOUE.graine : null, equipe: null, debut: null, fin: null, courant: null, etapes: {}, coffreArrive: false, codeOuvert: false, victoire: false }; }
if (!PARTIE || !JOUE || PARTIE.pid !== JOUE.id || PARTIE.graine !== JOUE.graine) PARTIE = partieVierge();
function sauverPartie() { if (!TEST) ecrire("msg-partie", PARTIE); else if (TEST.st) {} }
function chargerParcoursJoueur(p) {
  JOUE = completerParcours(p); ecrire("msg-parcours", JOUE);
  PARTIE = partieVierge(); sauverPartie(); cacheTirage = {};
}

// Mode test (organisateur qui essaie une épreuve, sans GPS ni sauvegarde)
var TEST = null;

function etatVierge() { return { phase: "chercher", i: 0, t0: null, bloque: 0, arrive: false, vu: false, fini: false, aide: false }; }
function etat(mi) { if (!PARTIE.etapes[mi]) PARTIE.etapes[mi] = etatVierge(); return PARTIE.etapes[mi]; }
function equipeJ() { return PARTIE.equipe == null ? null : JOUE.equipes[PARTIE.equipe]; }
function ordreJ() { return ordreEquipe(JOUE, PARTIE.equipe || 0); }
function nbFinies() { return JOUE.missions.filter(function (_, i) { return PARTIE.etapes[i] && PARTIE.etapes[i].fini; }).length; }
function toutFini() { return JOUE.missions.length > 0 && nbFinies() === JOUE.missions.length; }
function prochaine() {
  var o = ordreJ();
  for (var k = 0; k < o.length; k++) if (!(PARTIE.etapes[o[k]] && PARTIE.etapes[o[k]].fini)) return o[k];
  return null;
}
function numeroDans(mi) { return ordreJ().indexOf(mi) + 1; }

// Contexte de l'épreuve affichée : partie réelle ou test organisateur
function ctx() {
  if (TEST) return { p: TEST.p, t: TEST.t, mi: TEST.mi, st: TEST.st, test: true };
  return { p: JOUE, t: PARTIE.equipe || 0, mi: PARTIE.courant, st: PARTIE.courant == null ? null : etat(PARTIE.courant), test: false };
}
function etapesQuete(p, m) {
  if (m.type !== "enigmes") return [{ k: m.type }];
  var e = [];
  for (var r = 0; r < m.nb; r++) agesActifs(p).forEach(function (a) { e.push({ k: "q", age: a.cle, r: r }); });
  return e;
}

/* ----- Arrivée aux missions ----- */
function lieuSuivant() {
  var p = prochaine();
  if (p != null) return { lieu: JOUE.missions[p], r: rayonMission(JOUE, JOUE.missions[p]), coffre: false };
  if (PARTIE.equipe != null && toutFini() && !PARTIE.victoire) return { lieu: JOUE.depart, r: JOUE.rayon, coffre: true };
  return null;
}
function estArrive(lieu, r) { return !!(gps.pos && distance(gps.pos, lieu) <= seuilArrivee(r)); }
function verifierArrivee() {
  if (TEST || PARTIE.equipe == null || !gps.pos) return;
  var p = prochaine();
  if (p != null) {
    var st = etat(p), m = JOUE.missions[p];
    if (st.phase === "chercher" && !st.arrive && estArrive(m, rayonMission(JOUE, m))) {
      st.arrive = true; PARTIE.courant = p; sauverPartie(); celebrerArrivee();
      if (UI.ecran === "carte" || UI.ecran === "etape" || UI.ecran === "inventaire") aller("etape"); else rendre();
    }
  } else if (toutFini() && !PARTIE.coffreArrive && estArrive(JOUE.depart, JOUE.rayon)) {
    PARTIE.coffreArrive = true; sauverPartie(); celebrerArrivee();
    if (UI.ecran === "carte" || UI.ecran === "final" || UI.ecran === "inventaire") aller("final");
  }
}
ecouteursGPS.push(verifierArrivee);
function celebrerArrivee() {
  son.tresor(); vibrer([300, 120, 300, 120, 500]);
  setTimeout(function () { if (UI.son) parler("Vous êtes arrivés !"); }, 700);
}
function texteInfoCarte() {
  if (gps.erreur) return gps.erreur;
  if (gps.suivi === null) return "";
  if (!gps.pos) return "Recherche du signal GPS… Restez à découvert.";
  if (!dansLeVillage()) return "Vous êtes hors de la carte, à " + (Math.round(distance(gps.pos, JOUE.depart) / 100) / 10) + " km du départ.";
  var l = lieuSuivant(); if (!l) return "Précision ± " + Math.round(gps.pos.precision) + " m";
  var d = Math.round(distance(gps.pos, l.lieu));
  return (l.coffre ? "Le coffre : " : "Prochaine mission : ") + (d <= seuilArrivee(l.r) ? "vous y êtes presque !" : "≈ " + d + " m") + " · précision ± " + Math.round(gps.pos.precision) + " m";
}

/* ------------------------------------------------------------------ */
/* Écrans du joueur                                                   */
/* ------------------------------------------------------------------ */
var vues = {}, apres = {};

function entete() {
  var c = ctx();
  if (c.test) return '<div class="entete"><span class="badge-equipe test"><span class="e" aria-hidden="true">🧪</span>Test · ' + esc(c.p.equipes[c.t].nom) + '</span><button class="btn second petit-btn" data-action="quitter-test">Quitter le test</button></div>';
  var eq = equipeJ();
  return '<div class="entete"><span class="badge-equipe" style="border-color:' + eq.couleur + '"><span class="e" aria-hidden="true">' + eq.emoji + "</span>Équipe " + esc(eq.nom) + "</span>" +
    '<span class="ligne"><button class="voix" data-action="son" aria-label="' + (UI.son ? "Couper le son" : "Activer le son") + '">' + (UI.son ? "🔔" : "🔕") + "</button>" +
    '<button class="voix" data-action="ouvrir-outils" aria-label="Outils adulte">⚙️</button></span></div>';
}

vues.accueil = function () {
  var blocJoueur;
  if (!JOUE) {
    blocJoueur = '<div class="choix-mode joueur"><p class="age">🎮 Côté joueur</p>' +
      '<p class="resume-parcours"><b>Pas encore de parcours.</b><br>Demandez à l\'organisateur d\'afficher son QR code, puis scannez-le.</p>' +
      '<button class="btn gros" data-aller="charger">📷 Scanner le QR code de l\'organisateur</button></div>';
  } else {
    var e = estimer(JOUE), enCours = PARTIE.equipe != null && !PARTIE.victoire;
    blocJoueur = '<div class="choix-mode joueur"><p class="age">🎮 Côté joueur</p>' +
      '<p class="resume-parcours"><b>' + esc(JOUE.nom) + "</b><br>" + JOUE.missions.length + " missions · " + JOUE.equipes.length + " équipe" + (JOUE.equipes.length > 1 ? "s" : "") + " · ≈ " + dureeMin(e.total) + "</p>" +
      (enCours ? '<button class="btn gros" data-aller="carte">▶️ Reprendre la partie</button>' : '<button class="btn gros" data-action="commencer">▶️ Jouer</button>') +
      '<button class="btn discret" data-aller="charger">📷 Scanner un autre parcours</button></div>';
  }
  return '<section class="pile accueil">' +
    '<div class="citrouille-anim" aria-hidden="true">🎃</div><h1>' + esc(TEXTES.titre) + "</h1>" +
    '<p class="doux">Un escape game d\'Halloween à jouer en équipe, avec un adulte.</p>' +
    '<div class="pile" style="width:100%;margin-top:8px">' + blocJoueur +
      '<div class="choix-mode orga"><p class="age">🛠️ Côté organisateur</p><p class="doux petit">Créer le parcours sur la carte, choisir les missions et l\'envoyer aux téléphones.</p>' +
        '<button class="btn second" data-action="ouvrir-orga">🛠️ Espace organisateur</button></div>' +
      '<div class="ligne" style="justify-content:center"><button class="btn discret" data-aller="verif">Prêt pour le mode avion ?</button><button class="btn discret" data-aller="partage">📱 QR code du jeu</button></div>' +
    "</div></section>";
};

vues.partage = function () {
  return '<section class="pile centre"><h2>Partager le jeu</h2><p style="font-size:1.1rem">Scannez ce QR code avec l\'appareil photo d\'un autre téléphone, puis installez le jeu.</p>' +
    '<div class="qr"><img src="qr.svg" alt="QR code du jeu" width="260" height="260"></div><p class="adresse">' + URL_JEU + "</p>" +
    '<button class="btn second" data-action="retour-accueil">Retour</button></section>';
};

vues.intro = function () {
  var I = TEXTES.intro, N = JOUE.missions.length, lignes = I.texte.map(function (t) { return t.replace(/\{N\}/g, N); }), tout = lignes.join(" ");
  return '<section class="pile"><div class="parchemin lettre"><div class="ligne" style="justify-content:space-between"><h3>' + esc(I.titre) + "</h3>" + boutonVoix(tout + " " + I.signature) + "</div>" +
    lignes.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + '<p class="signature">' + esc(I.signature) + "</p></div>" +
    '<button class="btn gros" data-aller="equipes">Nous acceptons la mission !</button></section>';
};

vues.equipes = function () {
  return '<section class="pile"><h2>Choisissez votre équipe</h2><p class="doux">Un téléphone par équipe, avec un adulte. Chaque équipe a ses propres questions.</p>' +
    JOUE.equipes.map(function (e, i) {
      return '<button class="btn second btn-equipe" data-equipe="' + i + '" style="border-color:' + e.couleur + '"><span class="e" aria-hidden="true">' + e.emoji + "</span><span>Équipe " + esc(e.nom) + "</span></button>";
    }).join("") + '<button class="btn discret" data-aller="intro">Relire la lettre</button></section>';
};

vues.carte = function () {
  var eq = equipeJ(), o = ordreJ(), proch = prochaine(), fini = toutFini(), D = xy(JOUE.depart);
  var visibles = o.filter(function (mi) { return !JOUE.missions[mi].cachee || (PARTIE.etapes[mi] && PARTIE.etapes[mi].fini); });
  var pts = [D].concat(visibles.map(function (mi) { return xy(JOUE.missions[mi]); })).concat([D]);
  var trace = '<polyline points="' + pts.map(function (p) { return p.x + "," + p.y; }).join(" ") + '" fill="none" stroke="' + eq.couleur + '" stroke-width="3" stroke-dasharray="7 5" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>';
  var reperes = visibles.map(function (mi) {
    var c = xy(JOUE.missions[mi]), st = PARTIE.etapes[mi], cls = st && st.fini ? "fait" : (mi === proch ? "prochain" : "verrou");
    return '<span class="repere ' + cls + '" data-mx="' + c.x + '" data-my="' + c.y + '">' + (st && st.fini ? "✓" : numeroDans(mi)) + "</span>";
  }).join("") + '<span class="repere final ' + (fini ? "prochain" : "") + '" data-mx="' + D.x + '" data-my="' + D.y + '">' + (fini ? "🗝️" : "🏁") + "</span>";
  apresRendu.push(function () { carte.vue = vueSur(pts); appliquerVue(); });
  var msg = fini ? "Toutes les missions sont réussies ! Filez au coffre 🗝️" : (proch != null ? (JOUE.missions[proch].cachee ? "Prochaine mission : la mission secrète n°" + numeroDans(proch) + " ! Elle n'est pas sur la carte." : "Prochaine mission : le rond orange n°" + numeroDans(proch) + ".") : "");
  var info = texteInfoCarte();
  return '<section class="pile">' + entete() + "<h2>La carte</h2><p>" + esc(msg) + "</p>" + htmlPlan(trace, reperes) +
    (proch != null || fini ? '<button class="btn gros" data-action="aller-prochaine">' + (proch != null ? "🔍 Aller à la mission n°" + numeroDans(proch) : "🗝️ Aller au coffre") + "</button>" : "") +
    '<p id="gps-info" class="gps-info"' + (info ? "" : " hidden") + ">" + esc(info) + "</p>" +
    '<button id="btn-gps" class="btn second" data-action="gps"' + (gps.suivi !== null ? " hidden" : "") + ">📍 Afficher notre position</button>" +
    '<p class="legende-plan">' + nbFinies() + " mission(s) sur " + JOUE.missions.length + " réussie(s).</p></section>";
};

function miniPlan(lieu, emoji) {
  var c = xy(lieu);
  return htmlPlan("", '<span class="repere prochain cible" data-mx="' + c.x + '" data-my="' + c.y + '" aria-hidden="true">' + emoji + "</span>", "plan-mini");
}
apres.miniPlan = function () { var c = document.querySelector(".plan-mini .cible"); if (c) { carte.vue = null; var w = 240, r = ratioPlan(); carte.vue = bornerVue({ x: +c.dataset.mx - w / 2, y: +c.dataset.my - w * r / 2, w: w }); appliquerVue(); } };
function blocArrivee(texte) {
  return '<div class="arrivee pile centre"><span class="arrivee-emoji" aria-hidden="true">🎃</span><h2>Vous êtes arrivés !</h2>' +
    '<div class="ligne" style="justify-content:center;flex-wrap:nowrap"><p style="font-size:1.2rem">' + esc(texte) + "</p>" + boutonVoix("Vous êtes arrivés ! " + texte) + "</div></div>";
}
function blocVerrou() {
  return '<button class="btn verrouille" disabled>🔒 Approchez-vous pour débloquer</button>' +
    '<button class="btn discret" data-action="debloquer-adulte">GPS en panne ? Un adulte peut débloquer</button>';
}

vues.etape = function () {
  var c = ctx(); if (c.mi == null) return vues.carte();
  var m = c.p.missions[c.mi], st = c.st, liste = etapesQuete(c.p, m);
  var num = c.test ? c.mi + 1 : numeroDans(c.mi);
  var h = '<section class="pile">' + entete() +
    '<div class="ligne"><span style="font-size:2.4rem" aria-hidden="true">' + esc(m.emoji) + '</span><div><p class="doux petit">' + (m.cachee ? "Mission secrète n°" : "Mission n°") + num + " · " + esc(TYPES_QUETE[m.type].nom) + "</p><h2>" + esc(m.nom) + "</h2></div></div>" +
    '<div class="progres">' + ["chercher"].concat(liste.map(function () { return "x"; })).map(function (_, k) {
      var fait = st.phase === "recompense" || st.phase === "fini" || (st.phase === "jeu" && k <= st.i) || (st.phase === "chercher" && k === 0 && st.arrive);
      return '<span class="' + (fait ? "fait" : "") + '"></span>';
    }).join("") + "</div>";
  if (st.phase === "chercher") {
    if (st.arrive) h += blocArrivee(m.type === "enigmes" ? "La sorcière vous attend avec ses énigmes…" : TYPES_QUETE[m.type].nom + " : êtes-vous prêts ?") + '<button class="btn gros" data-action="commencer-quete">✨ Commencer l\'épreuve</button>';
    else {
      h += '<div class="carte-bloc"><p class="etiquette-etape">' + (m.cachee ? "Mission secrète : suivez le radar !" : "Où aller ?") + '</p><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><p style="font-size:1.25rem">' + esc(m.indice || "Suivez le radar jusqu'à la mission.") + "</p>" + boutonVoix(m.indice || "") + "</div></div>" +
        radarHTML(m, rayonMission(c.p, m)) + (m.cachee ? "" : miniPlan(m, m.emoji)) + blocVerrou();
      apresRendu.push(apres.miniPlan);
    }
  } else if (st.phase === "jeu" && st.i >= liste.length) {
    st.phase = "recompense"; sauverPartie(); return vues.etape();
  } else if (st.phase === "jeu") {
    var e = liste[st.i]; if (!st.t0) { st.t0 = Date.now(); sauverPartie(); }
    h += renduQuete(c, m, e, st.i, liste.length);
  } else {
    var ch = chiffres(c.p)[c.mi];
    h += '<div class="carte-bloc recompense pile"><p class="doux">Épreuve réussie ! Un morceau de la formule apparaît…</p><p class="mot-gagne">' + esc(m.mot || "✨") + "</p>" +
      (ch ? "<p>Et un chiffre du cadenas : le <b>" + ordinal(ch.pos) + '</b> chiffre est <b class="chiffre-gagne">' + esc(ch.val) + "</b></p>" : "") + "</div>" +
      (c.test ? '<button class="btn gros" data-action="quitter-test">✅ Fin du test</button>' : '<button class="btn gros" data-action="ranger">🎒 Ranger dans le sac et continuer</button>');
  }
  return h + "</section>";
};

vues.inventaire = function () {
  var ch = chiffres(JOUE), L = JOUE.codeCoffre.length, pos = {};
  Object.keys(ch).forEach(function (mi) { pos[ch[mi].pos] = +mi; });
  return '<section class="pile">' + entete() + "<h2>Mon sac</h2>" +
    '<h3>La formule</h3><div class="fragments">' + JOUE.missions.map(function (m, i) {
      var ok = PARTIE.etapes[i] && PARTIE.etapes[i].fini;
      return '<div class="fragment ' + (ok ? "" : "vide") + '"><span aria-hidden="true" style="font-size:1.6rem">' + (ok ? esc(m.emoji) : "❔") + '</span><span class="mot">' + (ok ? esc(m.mot || "✨") : "• • •") + "</span></div>";
    }).join("") + "</div>" +
    (L ? '<h3>Les chiffres du cadenas</h3><div class="chiffres" style="grid-template-columns:repeat(' + Math.min(L, 6) + ',1fr)">' + Array.from({ length: L }, function (_, k) {
      var mi = pos[k + 1], ok = mi != null && PARTIE.etapes[mi] && PARTIE.etapes[mi].fini;
      return '<div class="chiffre ' + (ok ? "" : "vide") + '">' + (ok ? esc(ch[mi].val) : "?") + "</div>";
    }).join("") + "</div>" : "") + "</section>";
};

var saisieCode = "";
vues.final = function () {
  if (!toutFini()) return '<section class="pile">' + entete() + "<h2>Le coffre est encore scellé</h2><p>Il reste " + (JOUE.missions.length - nbFinies()) + " mission(s) à réussir.</p></section>";
  var F = TEXTES.final, f = formule(JOUE), code = JOUE.codeCoffre;
  var h = '<section class="pile">' + entete() + "<h2>" + esc(F.titre) + "</h2>" +
    '<div class="parchemin"><p class="age">La formule complète</p><p class="formule">' + esc(f) + "</p>" + boutonVoix(f) + "</div>";
  if (!PARTIE.coffreArrive) {
    h += '<div class="carte-bloc"><p class="etiquette-etape">Où aller ?</p><div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><p style="font-size:1.2rem">' + esc(JOUE.depart.indice) + "</p>" + boutonVoix(JOUE.depart.indice) + "</div></div>" +
      radarHTML(JOUE.depart, JOUE.rayon) + miniPlan(JOUE.depart, "🗝️") + blocVerrou();
    apresRendu.push(apres.miniPlan);
    return h + "</section>";
  }
  h += blocArrivee(F.texte);
  if (code && !PARTIE.codeOuvert) {
    var aff = ""; for (var i = 0; i < code.length; i++) aff += "<span>" + (saisieCode[i] || "") + "</span>";
    h += "<h3>Le cadenas du coffre</h3><p class=\"doux\">Tapez les " + code.length + " chiffres trouvés, dans l'ordre (regardez dans 🎒 Mon sac).</p>" +
      '<div class="affiche-code" aria-live="polite">' + aff + '</div><p class="retour" id="retour"></p>' + clavier("touche");
  } else {
    h += '<div class="carte-bloc centre pile"><span class="apparition-emoji" aria-hidden="true">🧰</span><p style="font-size:1.2rem">Le coffre magique s\'ouvre… Tous ensemble, criez la formule !</p><button class="btn gros" data-action="victoire">📣 Nous avons crié la formule !</button></div>';
  }
  return h + "</section>";
};
function clavier(attr) {
  return '<div class="clavier">' + ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map(function (k) { return '<button data-' + attr + '="' + k + '" aria-label="' + (k === "⌫" ? "Effacer" : k === "✓" ? "Valider" : k) + '">' + k + "</button>"; }).join("") + "</div>";
}

vues.victoire = function () {
  var eq = equipeJ(), t = PARTIE.debut && PARTIE.fin ? duree(PARTIE.fin - PARTIE.debut) : "";
  return '<section class="pile victoire"><div class="citrouille-anim" aria-hidden="true">✨🎃✨</div><h1>Malédiction levée !</h1>' +
    '<p style="font-size:1.2rem">' + esc(TEXTES.final.victoire) + "</p>" +
    '<p class="badge-equipe" style="align-self:center"><span class="e">' + eq.emoji + "</span>Équipe " + esc(eq.nom) + (t ? " · " + t : "") + "</p>" +
    boutonVoix(TEXTES.final.victoire) + '<button class="btn second" data-aller="inventaire">Revoir mon sac</button></section>';
};

/* ----- Code adulte (déblocage, défi, outils, espace organisateur) ----- */
var PIN = { saisie: "", but: "outils", retour: "accueil" };
function demanderCode(but, retour) { PIN = { saisie: "", but: but, retour: retour || UI.ecran }; aller("pin"); }
function codeAttendu() { return PIN.but === "orga" ? (UI.codeOrga || "1031") : (TEST ? TEST.p.code : JOUE && JOUE.code) || "1031"; }
vues.pin = function () {
  var t = { orga: ["Espace organisateur", "Réservé aux adultes. Tapez le code organisateur (1031 au départ)."], outils: ["Outils adulte", "Tapez le code adulte du parcours."], debloquer: ["Déblocage par un adulte", "Le GPS ne marche pas ? Si vous êtes bien au bon endroit, un adulte tape le code pour débloquer."], defi: ["Validation du défi", "L'adulte vérifie que le défi est réussi, puis tape le code."] }[PIN.but];
  var L = codeAttendu().length, aff = ""; for (var i = 0; i < L; i++) aff += "<span>" + (PIN.saisie[i] ? "•" : "") + "</span>";
  return '<section class="pile"><h2>' + t[0] + '</h2><p class="doux">' + t[1] + '</p><div class="affiche-code">' + aff + '</div><p class="retour ko" id="retour"></p>' + clavier("pin") +
    '<button class="btn discret" data-action="pin-retour">Retour</button></section>';
};
function codeBon() {
  var b = PIN.but; PIN.saisie = "";
  if (b === "orga") { aller("orga"); return; }
  if (b === "outils") { aller("outils"); return; }
  if (b === "debloquer") {
    if (PIN.retour === "final") PARTIE.coffreArrive = true;
    else { var c = ctx(); if (c.st) { c.st.arrive = true; c.st.aide = true; } }
    sauverPartie(); son.tresor(); aller(PIN.retour); return;
  }
  if (b === "defi") { aller(PIN.retour); avancer(); return; }
}

/* ----- Outils adulte sur un téléphone joueur ----- */
var confirmeReset = false;
vues.outils = function () {
  if (!JOUE) return '<section class="pile"><div class="entete"><h2>Outils adulte</h2><button class="btn second petit-btn" data-action="fermer-outils">Fermer</button></div><p>Aucun parcours chargé sur ce téléphone.</p><button class="btn second" data-aller="verif">Contrôle mode avion</button><button class="btn" data-aller="charger">📷 Scanner le parcours</button></section>';
  var eq = equipeJ(), tps = PARTIE.debut ? duree((PARTIE.fin || Date.now()) - PARTIE.debut) : "pas commencé";
  var lignes = JOUE.missions.map(function (m, i) {
    var st = PARTIE.etapes[i], e = st && st.fini ? '<span class="pastille ok">Réussie</span>' : st && (st.phase !== "chercher" || st.arrive) ? '<span class="pastille cours">En cours</span>' : '<span class="pastille att">À faire</span>';
    return "<tr><td>" + (i + 1) + ". " + esc(m.emoji + " " + m.nom) + "</td><td>" + e + "</td></tr>";
  }).join("");
  if (!TEST && PARTIE.courant == null && PARTIE.equipe != null && prochaine() != null) { PARTIE.courant = prochaine(); etat(PARTIE.courant); }
  var c = ctx(), enCours = !TEST && PARTIE.courant != null && c.st && !c.st.fini;
  var h = '<section class="pile"><div class="entete"><h2>Outils adulte</h2><button class="btn second petit-btn" data-action="fermer-outils">Fermer</button></div>' +
    '<div class="carte-bloc"><h3>Ce téléphone</h3><p>Parcours : <b>' + esc(JOUE.nom) + "</b><br>Équipe : <b>" + (eq ? eq.emoji + " " + esc(eq.nom) : "aucune") + "</b> · Temps : <b>" + tps + "</b></p>" +
    '<div class="defile"><table class="tableau"><tr><th>Mission</th><th>État</th></tr>' + lignes + "</table></div></div>" +
    '<div class="carte-bloc"><h3>Débloquer</h3>' +
    (enCours ? '<button class="btn" data-action="passer">' + (c.st.phase === "chercher" && !c.st.arrive ? "Débloquer l'arrivée (sans GPS)" : "Valider l'épreuve en cours") + "</button>" : toutFini() && !PARTIE.coffreArrive ? '<button class="btn" data-action="ouvrir-coffre">Débloquer l\'arrivée au coffre</button>' : '<p class="doux">Aucune épreuve en cours.</p>') +
    '<button class="btn second" data-action="changer-equipe">Changer d\'équipe</button>' +
    '<button class="btn second" data-action="sans-gps">' + (UI.sansGps ? "Rendre le GPS obligatoire" : "Dépannage : jouer sans GPS sur ce téléphone") + "</button></div>" +
    '<div class="carte-bloc"><h3>Réponses</h3><button class="btn second" data-action="voir-reponses-joueur">📋 Voir les réponses de cette équipe</button></div>' +
    '<div class="carte-bloc"><h3>Préparation</h3><button class="btn second" data-aller="verif">Contrôle mode avion</button><button class="btn second" data-aller="charger">📷 Charger un autre parcours</button>';
  h += !confirmeReset ? '<button class="btn danger" data-action="reset">Recommencer la partie</button>' :
    '<p><b>Effacer la progression de ce téléphone ?</b></p><div class="ligne" style="flex-wrap:nowrap"><button class="btn danger" data-action="reset-ok">Oui, effacer</button><button class="btn second" data-action="reset-non">Annuler</button></div>';
  return h + "</div></section>";
};

/* ----- Fiche des réponses (adultes) ----- */
var FICHE = { p: null, equipes: null, retour: "outils" };
function texteBonnePetit(q) { return q.couleurs ? q.nomsCouleurs[q.bonne] : q.compter ? String(q.compter.options[q.bonne]) : q.choix[q.bonne]; }
vues.reponses = function () {
  var p = FICHE.p, h = '<section class="pile"><div class="entete"><h2>Réponses</h2><button class="btn second petit-btn" data-action="fiche-retour">Retour</button></div><p class="doux">' + esc(p.nom) + " · questions de cette partie (graine " + p.graine + ").</p>";
  (FICHE.equipes || p.equipes.map(function (_, i) { return i; })).forEach(function (t) {
    var eq = p.equipes[t];
    h += '<div class="carte-bloc"><h3>' + eq.emoji + " Équipe " + esc(eq.nom) + "</h3>";
    ordreEquipe(p, t).forEach(function (mi, k) {
      var m = p.missions[mi], lig = [];
      if (m.type === "enigmes") for (var r = 0; r < m.nb; r++) agesActifs(p).forEach(function (a) {
        var q = questionEnigme(p, t, mi, r, a.cle);
        lig.push("<b>" + a.nom + " :</b> " + esc(q.question) + (q.code ? " <code>" + esc(q.code) + "</code>" : "") + " → <b>" + esc(a.cle === "petits" ? texteBonnePetit(q) : a.cle === "moyens" ? q.options[q.bonne] : q.reponses[0]) + "</b>");
      });
      else if (m.type === "observation") { var o = questionLieu(p, t, mi); lig.push(o ? esc(o.question) + " → <b>" + esc(o.mode === "choix" ? (o.options || [])[o.bonne || 0] : o.reponse) + "</b>" : "<i>Question non écrite</i>"); }
      else if (m.type === "defi") lig.push(esc(defiPour(p, t, mi)));
      else lig.push(esc(TYPES_QUETE[m.type].nom) + " (niveau " + ["facile", "moyen", "difficile"][m.niveau - 1] + ")");
      h += '<div class="fiche"><p><b>' + (k + 1) + ". " + esc(m.emoji + " " + m.nom) + "</b> <span class=\"doux petit\">" + esc(m.lieu || "") + "</span></p><ul>" + lig.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></div>";
    });
    h += "</div>";
  });
  return h + '<div class="carte-bloc"><p>Code du coffre : <b>' + esc(p.codeCoffre || "aucun") + "</b><br>Formule : <b>" + esc(formule(p)) + "</b><br>Code adulte : <b>" + esc(p.code) + "</b></p></div></section>";
};

/* ----- Navigation du joueur ----- */
var ECRANS_JEU = { carte: 1, inventaire: 1, etape: 1, final: 1 };
function rendreNav() {
  if (TEST || PARTIE.equipe == null || !ECRANS_JEU[UI.ecran]) { nav.hidden = true; return; }
  nav.hidden = false;
  var items = [["carte", "🗺️", "Carte"], ["inventaire", "🎒", "Mon sac"]];
  var c = ctx(); if (PARTIE.courant != null && c.st && !c.st.fini) items.splice(1, 0, ["etape", "🔍", "Épreuve"]);
  if (toutFini()) items.push(["final", "🗝️", "Coffre"]);
  nav.innerHTML = items.map(function (it) { return '<button data-aller="' + it[0] + '" class="' + (UI.ecran === it[0] ? "actif" : "") + '"><span class="i" aria-hidden="true">' + it[1] + "</span>" + it[2] + "</button>"; }).join("");
}

/* ----- Progression dans une mission ----- */
function avancer() {
  var c = ctx(), m = c.p.missions[c.mi], liste = etapesQuete(c.p, m), st = c.st;
  st.i++; st.t0 = null; st.vu = false; st.bloque = 0;
  if (st.i >= liste.length) { st.phase = "recompense"; son.tresor(); etincelles(); } else son.bon();
  sauverPartie(); nettoyerJeux(); rendre(); window.scrollTo(0, 0);
}
function etincelles() {
  var em = ["🎃", "✨", "🦇", "⭐", "🍬", "👻"];
  for (var i = 0; i < 24; i++) {
    var s = document.createElement("span"); s.className = "etincelle"; s.textContent = em[i % em.length];
    s.style.left = Math.random() * 100 + "vw"; s.style.animationDuration = (2.5 + Math.random() * 2.5) + "s"; s.style.animationDelay = Math.random() * 1.2 + "s";
    document.body.appendChild(s); (function (x) { setTimeout(function () { x.remove(); }, 6500); })(s);
  }
}

/* ------------------------------------------------------------------ */
/* Les quêtes : énigmes, question sur le lieu, défi, mini-jeux        */
/* ------------------------------------------------------------------ */
var minuterieApparition = null, jeu = { timers: [] };
function nettoyerJeux() {
  clearTimeout(minuterieApparition);
  jeu.timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
  jeu = { timers: [] };
}
function renduQuete(c, m, e, i, n) {
  var etiquette = n > 1 ? '<p class="age">Épreuve ' + (i + 1) + " sur " + n + "</p>" : "";
  if (e.k === "q") return etiquette + renduEnigme(c, m, e);
  if (e.k === "observation") return renduObservation(c, m);
  if (e.k === "defi") return renduDefi(c, m);
  if (e.k === "fantomes") return renduFantomes(c, m);
  if (e.k === "potion") return renduPotion(c, m);
  if (e.k === "memoire") return renduMemoire(c, m);
  return "";
}
function enteteParchemin(titre, txtVoix) {
  return '<div class="ligne" style="justify-content:space-between;flex-wrap:nowrap"><h3>' + esc(titre) + "</h3>" + boutonVoix(txtVoix || titre) + "</div>";
}

/* ----- Indices qui apparaissent avec le temps + sort de la sorcière ----- */
var questionAffichee = null;
function nbIndices(c, total) {
  var t0 = c.st.t0; if (!t0) return 0;
  var e = (Date.now() - t0) / 1000, I = c.p.indices;
  if (e < I.premier) return 0;
  return Math.min(total, 1 + Math.floor((e - I.premier) / I.intervalle));
}
function attenteIndice(c, total) {
  var k = nbIndices(c, total), I = c.p.indices; if (!c.st.t0 || k >= total) return 0;
  return Math.max(0, Math.ceil((c.st.t0 + (I.premier + k * I.intervalle) * 1000 - Date.now()) / 1000));
}
function zoneIndices(indices) { questionAffichee = (indices || []).filter(function (x) { return x && String(x).trim(); }); return '<div class="zone-indices" id="zone-indices"></div><p class="penalite" id="penalite" hidden></p>'; }
function majIndices() {
  var z = document.getElementById("zone-indices"); if (!z || UI.ecran !== "etape") return;
  var c = ctx(); if (!c.st || !questionAffichee) return;
  var tot = questionAffichee.length, k = nbIndices(c, tot), att = attenteIndice(c, tot);
  if (String(k) !== z.dataset.nb) {
    if (z.dataset.nb !== undefined && k > +z.dataset.nb) { son.fantome(); vibrer(120); }
    z.dataset.nb = k;
    var h = "";
    for (var i = 0; i < k; i++) h += '<p class="indice"><span><b>💡 Indice ' + (i + 1) + " :</b> " + esc(questionAffichee[i]) + "</span> " + boutonVoix(questionAffichee[i]) + "</p>";
    z.innerHTML = h + '<p class="prochain-indice" id="prochain-indice"></p>';
  }
  var pi = document.getElementById("prochain-indice");
  if (pi) pi.textContent = !tot ? "" : att > 0 ? "⏳ " + (k === 0 ? "Premier indice" : "Indice suivant") + " dans " + Math.floor(att / 60) + ":" + ("0" + att % 60).slice(-2) : (k >= tot ? "Tous les indices sont là. Courage !" : "");
  var pen = document.getElementById("penalite"), parch = document.getElementById("parchemin");
  var reste = c.st.bloque ? Math.ceil((c.st.bloque - Date.now()) / 1000) : 0;
  if (pen && parch) {
    pen.hidden = reste <= 0; parch.classList.toggle("ensorcele", reste > 0);
    if (reste > 0) pen.textContent = "🧙‍♀️ Mauvaise réponse ! La sorcière vous jette un sort : attendez " + reste + " s.";
  }
}
setInterval(majIndices, 1000);
function ensorceler() { var c = ctx(); c.st.bloque = Date.now() + (c.p.indices.penalite || 0) * 1000; sauverPartie(); son.faux(); majIndices(); }
function estEnsorcele() { var c = ctx(); return c.st && c.st.bloque && c.st.bloque > Date.now(); }
function retour(txt, ok) { var r = document.getElementById("retour"); if (r) { r.textContent = txt; r.className = "retour " + (ok ? "ok" : "ko"); } }

/* ----- Énigmes de la sorcière ----- */
function renduEnigme(c, m, e) {
  var q = questionEnigme(c.p, c.t, c.mi, e.r, e.age), a = AGES.filter(function (x) { return x.cle === e.age; })[0];
  var age = '<p class="age">Épreuve des ' + a.nom.toLowerCase() + " · " + a.detail + "</p>";
  if (e.age === "petits" && !c.st.vu) {
    var A = q.apparition;
    clearTimeout(minuterieApparition);
    minuterieApparition = setTimeout(function () { var c2 = ctx(); if (UI.ecran === "etape" && c2.st && !c2.st.vu) { c2.st.vu = true; son.fantome(); rendre(); } }, 6000);
    return '<div class="apparition pile centre">' + age + '<p class="doux">Regardez bien… ça va disparaître !</p>' +
      (A.couleur ? '<span class="apparition-boite" style="background:' + A.couleur + '" aria-hidden="true">' + A.emoji + "</span>" : '<span class="apparition-emoji" aria-hidden="true">' + A.emoji + "</span>") +
      '<div class="ligne" style="justify-content:center;flex-wrap:nowrap"><p style="font-size:1.3rem;font-weight:600">' + esc(A.texte) + "</p>" + boutonVoix(A.texte) + "</div></div>" +
      '<button class="btn gros" data-action="apparition-vue">👀 On a bien regardé !</button>';
  }
  var h = '<div class="parchemin" id="parchemin">' + age + enteteParchemin(e.age === "grands" ? "L'énigme de la sorcière" : q.question, q.question + (q.options ? " " + q.options.join(", ") : ""));
  if (e.age === "petits") {
    var choix;
    if (q.couleurs) choix = q.couleurs.map(function (col, i) { return '<button class="choix couleur" style="background:' + col + '" data-rep="' + i + '" aria-label="' + esc(q.nomsCouleurs[i]) + '"></button>'; }).join("");
    else if (q.compter) choix = q.compter.options.map(function (n, i) { return '<button class="choix" data-rep="' + i + '" aria-label="' + n + '"><span class="compte">' + new Array(n + 1).join(q.compter.emoji) + "</span></button>"; }).join("");
    else choix = q.choix.map(function (x, i) { return '<button class="choix" data-rep="' + i + '">' + x + "</button>"; }).join("");
    h += '<div class="choix-grille">' + choix + '</div><p class="retour" id="retour" aria-live="polite"></p><button class="btn second" data-action="revoir">👀 Revoir</button>';
  } else if (e.age === "moyens") {
    h += '<div class="reponses">' + q.options.map(function (o, i) { return '<button class="reponse" data-rep="' + i + '">' + esc(o) + "</button>"; }).join("") + '</div><p class="retour" id="retour" aria-live="polite"></p>';
  } else {
    h += '<p style="font-size:1.1rem">' + esc(q.question) + "</p>" + (q.code ? '<p class="message-code">' + esc(q.code) + "</p>" : "") +
      (q.alphabet ? '<div class="alphabet">' + "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(function (l, i) { return "<span><b>" + l + "</b>" + (i + 1) + "</span>"; }).join("") + "</div>" : "") +
      (q.grille ? '<div class="grille-code">' + q.grille.map(function (g) { return "<span><b>" + g[0] + "</b>" + esc(g[1]) + "</span>"; }).join("") + "</div>" : "") +
      formReponse();
  }
  return h + zoneIndices(q.indices) + "</div>";
}
function formReponse(type) {
  return '<form class="pile" data-form="reponse"><label for="rep-texte" class="petit">Votre réponse</label>' +
    '<input id="rep-texte" class="saisie" autocomplete="off" autocapitalize="off" spellcheck="false"' + (type === "nombre" ? ' inputmode="decimal"' : "") + ">" +
    '<button class="btn" type="submit">Valider</button></form><p class="retour" id="retour" aria-live="polite"></p>';
}
function etapeCourante() { var c = ctx(), m = c.p.missions[c.mi]; return { c: c, m: m, e: etapesQuete(c.p, m)[c.st.i] }; }
function repondreChoix(b) {
  if (estEnsorcele()) return;
  var x = etapeCourante(), i = +b.dataset.rep, bonne;
  if (x.e.k === "q") bonne = questionEnigme(x.c.p, x.c.t, x.c.mi, x.e.r, x.e.age).bonne;
  else if (x.e.k === "observation") bonne = +(questionLieu(x.c.p, x.c.t, x.c.mi).bonne || 0);
  if (i === bonne) { b.classList.add("bon"); retour("Bravo ! 🎉", true); son.bon(); jeu.timers.push(setTimeout(avancer, 700)); }
  else { b.classList.remove("faux"); void b.offsetWidth; b.classList.add("faux"); if (b.classList.contains("reponse")) b.disabled = true; retour(x.e.age === "petits" ? "Essaie encore !" : "", false); if (x.e.age === "petits") son.faux(); else ensorceler(); }
}
function repondreTexte(val) {
  if (estEnsorcele()) return;
  var x = etapeCourante(), ok = false;
  if (!String(val).trim()) { retour("Écrivez une réponse d'abord.", false); return; }
  if (x.e.k === "q") ok = bonneReponse(val, questionEnigme(x.c.p, x.c.t, x.c.mi, x.e.r, x.e.age).reponses);
  else if (x.e.k === "observation") {
    var q = questionLieu(x.c.p, x.c.t, x.c.mi), att = String(q.reponse || "").split("/").map(function (s) { return s.trim(); }).filter(Boolean);
    if (q.mode === "nombre") { var n = parseFloat(String(val).replace(",", ".")); ok = att.some(function (a) { return parseFloat(a.replace(",", ".")) === n; }); }
    else ok = bonneReponse(val, att);
  }
  if (ok) { retour("Bonne réponse ! ✨", true); jeu.timers.push(setTimeout(avancer, 600)); }
  else { retour("", false); ensorceler(); var ch = document.getElementById("rep-texte"); if (ch) ch.select(); }
}

/* ----- Question sur le lieu (écrite par l'organisateur) ----- */
function renduObservation(c, m) {
  var q = questionLieu(c.p, c.t, c.mi);
  if (!q || !q.question) return '<div class="carte-bloc"><p>L\'organisateur n\'a pas encore écrit cette question. Un adulte peut valider l\'épreuve.</p><button class="btn" data-action="valider-adulte">L\'adulte valide</button></div>';
  var h = '<div class="parchemin" id="parchemin"><p class="age">Question sur le lieu · regardez bien autour de vous !</p>' + enteteParchemin(q.question, q.question + (q.mode === "choix" ? " " + (q.options || []).filter(Boolean).join(", ") : ""));
  if (q.mode === "choix") h += '<div class="reponses">' + (q.options || []).map(function (o, i) { return o && o.trim() ? '<button class="reponse" data-rep="' + i + '">' + esc(o) + "</button>" : ""; }).join("") + '</div><p class="retour" id="retour" aria-live="polite"></p>';
  else h += formReponse(q.mode);
  return h + zoneIndices(q.indices) + "</div>";
}

/* ----- Défi de groupe ----- */
function renduDefi(c, m) {
  var d = defiPour(c.p, c.t, c.mi), ch = +m.chrono || 0;
  var h = '<div class="parchemin" id="parchemin"><p class="age">Défi de groupe · tous ensemble !</p>' + enteteParchemin("Le défi de la sorcière", d) + '<p class="texte-defi">' + esc(d) + "</p>";
  if (ch) h += '<div class="chrono" id="chrono" data-s="' + ch + '"><span id="chrono-txt">' + ch + ' s</span></div><button class="btn second" data-action="lancer-chrono">⏱️ Lancer le chrono</button>';
  return h + "</div>" + '<button class="btn gros" data-action="valider-defi">✅ L\'adulte valide le défi</button>';
}
function lancerChrono() {
  var el = document.getElementById("chrono"); if (!el || jeu.chrono) return;
  var fin = Date.now() + (+el.dataset.s) * 1000;
  jeu.chrono = setInterval(function () {
    var r = Math.max(0, Math.ceil((fin - Date.now()) / 1000)), t = document.getElementById("chrono-txt");
    if (t) t.textContent = r + " s";
    if (r <= 0) { clearInterval(jeu.chrono); jeu.chrono = null; son.tresor(); var e = document.getElementById("chrono"); if (e) e.classList.add("fini"); }
  }, 250);
  jeu.timers.push(jeu.chrono);
}

/* ----- Chasse aux fantômes ----- */
var NIV_FANTOMES = [null, { but: 10, duree: 30, rythme: 750, vie: 1700, piege: false }, { but: 14, duree: 30, rythme: 600, vie: 1350, piege: false }, { but: 18, duree: 35, rythme: 480, vie: 1100, piege: true }];
function renduFantomes(c, m) {
  var N = NIV_FANTOMES[m.niveau];
  return '<div class="parchemin" id="parchemin"><p class="age">Mini-jeu · tout le monde peut toucher l\'écran !</p>' +
    enteteParchemin("Chasse aux fantômes", "Attrapez " + N.but + " fantômes en " + N.duree + " secondes en touchant l'écran." + (N.piege ? " Attention, ne touchez pas les citrouilles !" : "")) +
    "<p>Attrapez <b>" + N.but + " fantômes</b> en " + N.duree + " secondes." + (N.piege ? " Ne touchez pas les 🎃 : elles font perdre un fantôme !" : "") + "</p>" +
    '<div class="score-jeu"><span id="fj-score">0 / ' + N.but + '</span><span id="fj-temps">' + N.duree + ' s</span></div>' +
    '<div class="arene" id="arene"><button class="btn" data-action="fantomes-go">👻 Commencer la chasse</button></div><p class="retour" id="retour"></p></div>';
}
function demarrerFantomes() {
  var c = ctx(), N = NIV_FANTOMES[c.p.missions[c.mi].niveau], ar = document.getElementById("arene"); if (!ar) return;
  ar.innerHTML = ""; retour("", true);
  var score = 0, fin = Date.now() + N.duree * 1000, fini = false;
  function maj() { var s = document.getElementById("fj-score"); if (s) s.textContent = score + " / " + N.but; }
  function stop(gagne) {
    if (fini) return; fini = true; nettoyerJeux();
    if (gagne) { retour("Bravo, tous les fantômes sont attrapés ! 🎉", true); jeu.timers.push(setTimeout(avancer, 1200)); }
    else { var a = document.getElementById("arene"); if (a) a.innerHTML = '<button class="btn" data-action="fantomes-go">🔁 Encore une fois !</button>'; retour("Presque ! " + score + " fantômes sur " + N.but + ". Réessayez !", false); son.faux(); }
  }
  function apparaitre() {
    var a = document.getElementById("arene"); if (!a || fini) return;
    var piege = N.piege && Math.random() < .25, b = document.createElement("button");
    b.className = "cible-jeu"; b.textContent = piege ? "🎃" : (Math.random() < .5 ? "👻" : "👻");
    b.style.left = (8 + Math.random() * 78) + "%"; b.style.top = (8 + Math.random() * 74) + "%";
    b.addEventListener("pointerdown", function (ev) {
      ev.preventDefault(); if (fini || b.dataset.pris) return; b.dataset.pris = "1";
      if (piege) { score = Math.max(0, score - 1); son.faux(); b.classList.add("rate"); } else { score++; son.pop(); b.classList.add("pris"); }
      maj(); setTimeout(function () { b.remove(); }, 200);
      if (score >= N.but) stop(true);
    });
    a.appendChild(b); setTimeout(function () { b.remove(); }, N.vie);
  }
  jeu.timers.push(setInterval(apparaitre, N.rythme));
  jeu.timers.push(setInterval(function () {
    var r = Math.max(0, Math.ceil((fin - Date.now()) / 1000)), t = document.getElementById("fj-temps"); if (t) t.textContent = r + " s";
    if (r <= 0) stop(score >= N.but);
  }, 250));
  apparaitre(); maj();
}

/* ----- Potion de la sorcière (refaire la suite) ----- */
var INGREDIENTS = [{ e: "🐸", n: "crapaud", c: "#22c55e" }, { e: "🕷️", n: "araignée", c: "#a855f7" }, { e: "🍄", n: "champignon", c: "#ef4444" }, { e: "🦴", n: "os", c: "#f5f0e6" }];
var NIV_POTION = [null, [3, 4], [3, 4, 5], [4, 5, 6]];
function renduPotion(c, m) {
  return '<div class="parchemin" id="parchemin"><p class="age">Mini-jeu · ouvrez grand les yeux !</p>' +
    enteteParchemin("La potion de la sorcière", "Regardez dans quel ordre les ingrédients s'allument, puis touchez-les dans le même ordre.") +
    "<p>Regardez l'ordre des ingrédients, puis refaites-le. Il y a <b>" + NIV_POTION[m.niveau].length + " potions</b> à réussir.</p>" +
    '<div class="score-jeu"><span id="po-manche">Potion 1 / ' + NIV_POTION[m.niveau].length + '</span><span id="po-etat">Prêts ?</span></div>' +
    '<div class="chaudron" id="chaudron">' + INGREDIENTS.map(function (g, i) { return '<button class="ingredient" data-ing="' + i + '" style="--c:' + g.c + '" aria-label="' + g.n + '" disabled>' + g.e + "</button>"; }).join("") + "</div>" +
    '<button class="btn" data-action="potion-go" id="po-go">🧪 Montrer la potion</button><p class="retour" id="retour"></p></div>';
}
function demarrerPotion(rejouer) {
  var c = ctx(), longueurs = NIV_POTION[c.p.missions[c.mi].niveau];
  if (!jeu.potion) jeu.potion = { manche: 0, suite: null };
  var P = jeu.potion;
  if (!P.suite || !rejouer) { P.suite = []; for (var i = 0; i < longueurs[P.manche]; i++) P.suite.push(Math.floor(Math.random() * 4)); }
  P.pos = 0; P.attente = true;
  var go = document.getElementById("po-go"); if (go) go.hidden = true;
  document.getElementById("po-manche").textContent = "Potion " + (P.manche + 1) + " / " + longueurs.length;
  document.getElementById("po-etat").textContent = "👀 Regardez…"; retour("", true);
  var bt = document.querySelectorAll(".ingredient"); bt.forEach(function (b) { b.disabled = true; });
  P.suite.forEach(function (g, k) {
    jeu.timers.push(setTimeout(function () { var b = document.querySelector('[data-ing="' + g + '"]'); if (b) { b.classList.add("allume"); son.ingredient(g); setTimeout(function () { b.classList.remove("allume"); }, 450); } }, 600 + k * 750));
  });
  jeu.timers.push(setTimeout(function () { P.attente = false; document.querySelectorAll(".ingredient").forEach(function (b) { b.disabled = false; }); var e = document.getElementById("po-etat"); if (e) e.textContent = "👉 À vous !"; }, 600 + P.suite.length * 750));
}
function toucherIngredient(b) {
  var P = jeu.potion; if (!P || P.attente) return;
  var g = +b.dataset.ing, c = ctx(), longueurs = NIV_POTION[c.p.missions[c.mi].niveau];
  b.classList.add("allume"); setTimeout(function () { b.classList.remove("allume"); }, 220); son.ingredient(g);
  if (g !== P.suite[P.pos]) { P.attente = true; son.faux(); retour("Pschitt ! La potion a raté. Regardez encore…", false); jeu.timers.push(setTimeout(function () { demarrerPotion(true); }, 1400)); return; }
  P.pos++;
  if (P.pos >= P.suite.length) {
    P.attente = true; P.manche++;
    if (P.manche >= longueurs.length) { retour("La potion est parfaite ! ✨", true); jeu.timers.push(setTimeout(avancer, 1100)); }
    else { son.bon(); retour("Potion réussie ! La suivante est plus longue…", true); P.suite = null; jeu.timers.push(setTimeout(function () { demarrerPotion(false); }, 1500)); }
  }
}

/* ----- Mémoire des citrouilles (paires) ----- */
var IMAGES_MEMOIRE = ["🦇", "👻", "🕷️", "🐸", "🦉", "🍬", "🧹", "🔮", "🌙", "🐈‍⬛", "🍄", "💀"];
var NIV_MEMOIRE = [null, 3, 4, 6];
function renduMemoire(c, m) {
  var n = NIV_MEMOIRE[m.niveau], alea = rng(hacher(c.p.graine + ":mem:" + c.t + ":" + c.mi + ":" + Date.now()));
  var images = melanger(IMAGES_MEMOIRE, alea).slice(0, n), cartes = melanger(images.concat(images), alea);
  jeu.memoire = { cartes: cartes, ouvertes: [], trouvees: 0, n: n, coups: 0, bloque: false };
  return '<div class="parchemin" id="parchemin"><p class="age">Mini-jeu · chacun son tour !</p>' +
    enteteParchemin("Mémoire des citrouilles", "Retournez deux citrouilles à la fois pour retrouver les paires d'images.") +
    "<p>Retrouvez les <b>" + n + " paires</b>. Touchez deux citrouilles à la fois.</p>" +
    '<div class="score-jeu"><span id="me-score">0 / ' + n + ' paires</span><span id="me-coups">0 coup</span></div>' +
    '<div class="memoire m' + cartes.length + '">' + cartes.map(function (_, i) { return '<button class="carte-mem" data-mem="' + i + '" aria-label="Citrouille ' + (i + 1) + '"><span class="dos">🎃</span><span class="face"></span></button>'; }).join("") + "</div>" +
    '<p class="retour" id="retour"></p></div>';
}
function toucherMemoire(b) {
  var J = jeu.memoire; if (!J || J.bloque || b.classList.contains("ouverte") || b.classList.contains("trouvee")) return;
  var i = +b.dataset.mem; b.classList.add("ouverte"); b.querySelector(".face").textContent = J.cartes[i]; son.pop();
  J.ouvertes.push(b);
  if (J.ouvertes.length < 2) return;
  J.coups++; document.getElementById("me-coups").textContent = J.coups + " coup" + (J.coups > 1 ? "s" : "");
  var a = J.ouvertes[0], d = J.ouvertes[1];
  if (J.cartes[+a.dataset.mem] === J.cartes[+d.dataset.mem]) {
    a.classList.add("trouvee"); d.classList.add("trouvee"); J.ouvertes = []; J.trouvees++; son.bon();
    document.getElementById("me-score").textContent = J.trouvees + " / " + J.n + " paires";
    if (J.trouvees >= J.n) { retour("Toutes les paires sont trouvées ! 🎉", true); jeu.timers.push(setTimeout(avancer, 1200)); }
  } else {
    J.bloque = true;
    jeu.timers.push(setTimeout(function () { [a, d].forEach(function (x) { x.classList.remove("ouverte"); x.querySelector(".face").textContent = ""; }); J.ouvertes = []; J.bloque = false; }, 900));
  }
}

/* ------------------------------------------------------------------ */
/* QR codes : afficher (organisateur) et scanner (joueur), hors ligne */
/* ------------------------------------------------------------------ */
function svgQR(texte) {
  var q = qrcode(0, "L"); q.addData(texte, "Byte"); q.make();
  var n = q.getModuleCount(), m = 2, t = n + 2 * m, d = "";
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + " " + t + '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}

/* ----- Scanner (caméra du téléphone + jsQR, aucun réseau) ----- */
var scan = { flux: null, actif: false, parts: {}, total: 0, id: null, dernier: 0 };
function arreterScan() {
  scan.actif = false;
  if (scan.flux) { scan.flux.getTracks().forEach(function (t) { t.stop(); }); scan.flux = null; }
}
function demarrerScan() {
  var v = document.getElementById("video-scan"), etat = document.getElementById("scan-etat");
  if (!v) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { etat.textContent = "Ce téléphone ne permet pas d'utiliser la caméra ici. Utilisez « Coller le lien »."; return; }
  scan.parts = {}; scan.total = 0; scan.id = null;
  etat.textContent = "Ouverture de la caméra…";
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false }).then(function (flux) {
    scan.flux = flux; scan.actif = true; v.srcObject = flux; v.setAttribute("playsinline", ""); v.muted = true;
    var p = v.play(); if (p && p.catch) p.catch(function () {});
    document.getElementById("zone-scan").classList.add("actif");
    etat.textContent = "Visez le QR code affiché sur le téléphone de l'organisateur.";
    var cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
    (function boucle() {
      if (!scan.actif) return;
      if (v.readyState >= 2 && Date.now() - scan.dernier > 180) {
        scan.dernier = Date.now();
        var w = v.videoWidth, h = v.videoHeight, k = Math.min(1, 800 / Math.max(w, h));
        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        cx.drawImage(v, 0, 0, cv.width, cv.height);
        var img = cx.getImageData(0, 0, cv.width, cv.height), res = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (res && res.data) recuTexteQR(res.data);
      }
      requestAnimationFrame(boucle);
    })();
  }).catch(function (e) {
    etat.textContent = e && e.name === "NotAllowedError" ? "La caméra est refusée. Autorisez-la dans les réglages du téléphone, ou utilisez « Coller le lien »." : "Impossible d'ouvrir la caméra. Utilisez « Coller le lien ».";
  });
}
function recuTexteQR(t) {
  var etat = document.getElementById("scan-etat");
  var lien = t.match(/#p=([A-Za-z0-9_-]+)/);
  if (lien) { arreterScan(); importerCode(lien[1]); return; }
  if (t.indexOf("MSG|") !== 0) { if (etat) etat.textContent = "Ce QR code n'est pas un parcours du jeu."; return; }
  var p = t.split("|"), id = p[1], i = +p[2], n = +p[3], morceau = p.slice(4).join("|");
  if (scan.id !== id) { scan.id = id; scan.parts = {}; scan.total = n; }
  if (!scan.parts[i]) { scan.parts[i] = morceau; vibrer(40); son.pop(); }
  var lus = Object.keys(scan.parts).length;
  if (etat) etat.textContent = n > 1 ? "QR code " + lus + " sur " + n + " lu" + (lus > 1 ? "s" : "") + "… gardez le téléphone pointé, les codes défilent tout seuls." : "Lu !";
  var barre = document.getElementById("scan-barre"); if (barre) barre.style.width = (lus / n * 100) + "%";
  if (lus >= n) { arreterScan(); var tout = ""; for (var k = 1; k <= n; k++) tout += scan.parts[k]; importerCode(tout); }
}
var CHARGE = null; // parcours décodé en attente de confirmation
function importerCode(code) {
  decoderParcours(code).then(function (p) {
    CHARGE = p; son.tresor();
    if (!estInstalle() && !apercuAutorise() && (!JOUE || PARTIE.equipe == null)) { chargerParcoursJoueur(p); }
    aller("charge-ok");
  })
    .catch(function (e) { toast("Ce code ne marche pas : " + (e && e.message ? e.message : "il est incomplet.")); aller("charger"); });
}

vues.charger = function () {
  return '<section class="pile"><h2>Charger un parcours</h2><p class="doux">L\'organisateur affiche un QR code sur son téléphone (Espace organisateur → Envoyer). Scannez-le ici.</p>' +
    '<div class="zone-scan" id="zone-scan"><video id="video-scan" playsinline muted></video><span class="viseur" aria-hidden="true"></span></div>' +
    '<div class="barre-scan"><span id="scan-barre"></span></div><p id="scan-etat" class="gps-info">Touchez « Scanner » et autorisez la caméra.</p>' +
    '<button class="btn gros" data-action="scanner">📷 Scanner le QR code</button>' +
    '<details class="carte-bloc"><summary>Coller un lien reçu par message</summary><div class="pile" style="margin-top:10px"><textarea id="code-colle" class="champ" rows="3" placeholder="https://…#p=…"></textarea><button class="btn second" data-action="coller-code">Charger ce lien</button></div></details>' +
    '<button class="btn discret" data-action="retour-accueil">Retour</button></section>';
};
vues["charge-ok"] = function () {
  var p = CHARGE; if (!p) return vues.charger();
  var e = estimer(p), enCours = JOUE && PARTIE.equipe != null && !PARTIE.victoire && JOUE.id !== p.id;
  return '<section class="pile centre"><div class="citrouille-anim" aria-hidden="true">📜</div><h2>Parcours reçu !</h2>' +
    '<div class="carte-bloc" style="text-align:left"><h3>' + esc(p.nom) + "</h3><p>" + p.missions.length + " missions · " + p.equipes.map(function (q) { return q.emoji + " " + esc(q.nom); }).join(", ") + "<br>Durée estimée : <b>≈ " + dureeMin(e.total) + "</b></p></div>" +
    (enCours ? '<p class="fictif">⚠ La partie en cours sur ce téléphone sera effacée.</p>' : "") +
    (estIOS && !estInstalle() && !apercuAutorise() ? '<p class="fictif">Sur iPhone, le jeu installé ne voit pas ce que vous ouvrez dans Safari : ouvrez le jeu depuis son icône, puis Charger → Scanner (ou Coller le lien).</p>' : "") +
    '<button class="btn gros" data-action="accepter-parcours">✅ Utiliser ce parcours</button><button class="btn discret" data-aller="charger">Annuler</button></section>';
};

/* ------------------------------------------------------------------ */
/* Espace organisateur : créer le parcours sur la carte               */
/* ------------------------------------------------------------------ */
var ORGA = lire("msg-orga", { liste: {}, ordre: [], courant: null });
Object.keys(ORGA.liste).forEach(function (id) { ORGA.liste[id] = completerParcours(ORGA.liste[id]); });
ORGA.ordre = ORGA.ordre.filter(function (id) { return ORGA.liste[id]; });
var ED = { sel: null, propose: null, placer: null, vue: null, suppr: null, supprParcours: null, equipeTrajet: 0, eqTab: 0, envoi: null };
function PO() { return ORGA.liste[ORGA.courant] || null; }
var minuterieSauve = null;
function sauverOrga(tout) {
  var p = PO(); if (p) p.maj = Date.now();
  cacheTirage = {};
  clearTimeout(minuterieSauve);
  if (tout) ecrire("msg-orga", ORGA); else minuterieSauve = setTimeout(function () { ecrire("msg-orga", ORGA); }, 300);
}
function ajouterParcours(p) { ORGA.liste[p.id] = p; ORGA.ordre.unshift(p.id); ORGA.courant = p.id; sauverOrga(true); }
function ouvrirParcours(id) { ORGA.courant = id; ED = { sel: null, propose: null, placer: null, vue: null, suppr: null, supprParcours: null, equipeTrajet: 0, eqTab: 0, envoi: null }; UI.onglet = "carte"; sauverUI(); sauverOrga(true); aller("edition"); }

// Écrire une valeur dans le parcours à partir d'un chemin "missions.2.nom"
function poser(obj, chemin, val) {
  var k = chemin.split("."), o = obj;
  for (var i = 0; i < k.length - 1; i++) {
    if (o[k[i]] == null || typeof o[k[i]] !== "object") o[k[i]] = /^\d+$/.test(k[i + 1]) ? [] : {};
    o = o[k[i]];
  }
  o[k[k.length - 1]] = val;
}
function valeur(obj, chemin) { return chemin.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
function champ(chemin, opts) {
  opts = opts || {};
  var v = valeur(PO(), chemin); v = v == null ? "" : v;
  var a = ' data-champ="' + chemin + '"' + (opts.type ? ' data-type="' + opts.type + '"' : "") + (opts.rendre ? " data-rendre" : "") + ' id="c-' + chemin.replace(/\./g, "-") + '"';
  if (opts.zone) return '<textarea class="champ" rows="' + (opts.lignes || 2) + '"' + a + ' placeholder="' + esc(opts.ph || "") + '">' + esc(v) + "</textarea>";
  return '<input class="champ" ' + (opts.num ? 'inputmode="numeric" ' : "") + 'value="' + esc(v) + '"' + a + ' placeholder="' + esc(opts.ph || "") + '"' + (opts.max ? ' maxlength="' + opts.max + '"' : "") + ">";
}
function selection(chemin, options, opts) {
  var v = String(valeur(PO(), chemin));
  return '<select class="champ"' + ' data-champ="' + chemin + '" data-type="' + ((opts && opts.type) || "num") + '" data-rendre id="c-' + chemin.replace(/\./g, "-") + '">' +
    options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
}
function segment(chemin, options, num) {
  var v = String(valeur(PO(), chemin));
  return '<div class="segment">' + options.map(function (o) { return '<button class="' + (String(o[0]) === v ? "actif" : "") + '" data-poser="' + chemin + '" data-val="' + esc(o[0]) + '"' + (num ? " data-num" : "") + ">" + o[1] + "</button>"; }).join("") + "</div>";
}
function bloc(titre, contenu, aide) { return '<div class="carte-bloc pile"><h3>' + titre + "</h3>" + (aide ? '<p class="doux petit">' + aide + "</p>" : "") + contenu + "</div>"; }
function etiq(t, c) { return '<label class="etiq"><span>' + t + "</span>" + c + "</label>"; }

/* ----- Accueil organisateur ----- */
vues.orga = function () {
  var h = '<section class="pile"><div class="entete"><h2>🛠️ Espace organisateur</h2><button class="btn second petit-btn" data-action="retour-accueil">Fermer</button></div>';
  h += '<div class="carte-bloc pile"><h3>Mes parcours</h3>';
  if (!ORGA.ordre.length) h += '<p class="doux">Aucun parcours pour l\'instant. Partez d\'un modèle ci-dessous : vous pourrez tout changer.</p>';
  ORGA.ordre.forEach(function (id) {
    var p = ORGA.liste[id], e = estimer(p);
    h += '<div class="item-parcours"><div><p><b>' + esc(p.nom) + '</b></p><p class="doux petit">' + p.missions.length + " missions · " + p.equipes.length + " équipe(s) · ≈ " + dureeMin(e.total) + "</p></div>" +
      '<div class="ligne"><button class="btn petit-btn" data-ouvrir="' + id + '">Ouvrir</button><button class="btn second petit-btn" data-dupliquer="' + id + '">Copier</button>' +
      (ED.supprParcours === id ? '<button class="btn danger petit-btn" data-suppr-parcours-ok="' + id + '">Supprimer ?</button>' : '<button class="btn discret petit-btn" data-suppr-parcours="' + id + '">🗑️</button>') + "</div></div>";
  });
  h += "</div>";
  h += '<div class="carte-bloc pile"><h3>Nouveau parcours</h3>' + MODELES.map(function (M, i) {
    return '<button class="btn second btn-modele" data-modele="' + i + '"><b>' + esc(M.nom) + '</b><span class="doux petit">' + esc(M.resume) + "</span></button>";
  }).join("") + '<button class="btn second btn-modele" data-action="parcours-vide"><b>Carte vide</b><span class="doux petit">Vous placez toutes les missions vous-même.</span></button></div>';
  h += '<div class="carte-bloc pile"><h3>Les types de quêtes</h3>' + Object.keys(TYPES_QUETE).map(function (k) {
    var T = TYPES_QUETE[k]; return '<p class="type-ligne"><span class="e">' + T.emoji + "</span><span><b>" + T.nom + "</b> · ≈ " + T.minutes + " min<br><span class=\"doux petit\">" + esc(T.desc) + "</span></span></p>";
  }).join("") + '<p class="type-ligne"><span class="e">🕵️</span><span><b>Mission secrète</b> (option)<br><span class="doux petit">N\'importe quelle mission peut être cachée : elle n\'apparaît pas sur la carte, seul le radar chaud/froid guide les enfants.</span></span></p></div>';
  h += bloc("Code organisateur", etiq("Code pour entrer ici", '<input class="champ" inputmode="numeric" maxlength="6" id="c-codeorga" data-ui="codeOrga" value="' + esc(UI.codeOrga) + '">'), "Il protège l'espace organisateur sur ce téléphone. Le code adulte des téléphones joueurs se règle dans chaque parcours.");
  return h + "</section>";
};

/* ----- Édition d'un parcours ----- */
var ONGLETS = [["carte", "🗺️", "Carte"], ["missions", "📋", "Missions"], ["reglages", "⚙️", "Réglages"], ["envoyer", "📤", "Envoyer"]];
vues.edition = function () {
  var p = PO(); if (!p) return vues.orga();
  var h = '<section class="pile editeur"><div class="entete"><button class="btn discret petit-btn" data-aller="orga">← Mes parcours</button><span class="doux petit">≈ ' + dureeMin(estimer(p).total) + "</span></div>" +
    "<h2>" + esc(p.nom) + "</h2>" +
    '<div class="onglets">' + ONGLETS.map(function (o) { return '<button class="' + (UI.onglet === o[0] ? "actif" : "") + '" data-onglet="' + o[0] + '"><span aria-hidden="true">' + o[1] + "</span>" + o[2] + "</button>"; }).join("") + "</div>";
  h += ({ carte: ongletCarte, missions: ongletMissions, reglages: ongletReglages, envoyer: ongletEnvoyer }[UI.onglet] || ongletCarte)(p);
  return h + "</section>";
};

function ongletCarte(p) {
  var t = Math.min(ED.equipeTrajet, p.equipes.length - 1), o = ordreEquipe(p, t), D = xy(p.depart);
  var pts = [D].concat(o.map(function (i) { return xy(p.missions[i]); })).concat([D]);
  var trace = p.missions.length ? '<polyline points="' + pts.map(function (q) { return q.x + "," + q.y; }).join(" ") + '" fill="none" stroke="' + p.equipes[t].couleur + '" stroke-width="2.5" stroke-dasharray="6 5" stroke-linecap="round" opacity=".9"/>' : "";
  var reperes = p.missions.map(function (m, i) {
    var c = xy(m);
    return '<span class="cercle-rayon' + (ED.sel === i ? " sel" : "") + '" data-mx="' + c.x + '" data-my="' + c.y + '" data-r="' + rayonMission(p, m) + '"></span>' +
      '<button class="repere edit' + (ED.sel === i ? " sel" : "") + (m.cachee ? " cache" : "") + '" data-mx="' + c.x + '" data-my="' + c.y + '" data-sel="' + i + '" aria-label="Mission ' + (i + 1) + '">' + (i + 1) + "</button>";
  }).join("") + '<button class="repere final edit' + (ED.sel === "depart" ? " sel" : "") + '" data-mx="' + D.x + '" data-my="' + D.y + '" data-sel="depart" aria-label="Départ et coffre">🏁</button>';
  if (ED.propose) reperes += '<span class="repere fantome-ajout" data-mx="' + ED.propose.x + '" data-my="' + ED.propose.y + '">＋</span>';
  var outils = '<div class="outils-carte"><button data-carte="plus" aria-label="Zoomer">＋</button><button data-carte="moins" aria-label="Dézoomer">−</button><button data-carte="tout" aria-label="Voir tout le parcours">⤢</button><button data-carte="moi" aria-label="Ma position">📍</button></div>';
  var h = "";
  if (ED.placer != null) h += '<p class="consigne">👆 Touchez la carte à l\'endroit où mettre ' + (ED.placer === "depart" ? "le départ et le coffre" : "la mission " + (ED.placer + 1)) + '. <button class="btn discret petit-btn" data-action="annuler-placer">Annuler</button></p>';
  else if (!ED.propose && ED.sel == null) h += '<p class="consigne">👆 Touchez la carte pour ajouter une mission. Glissez pour vous déplacer, pincez pour zoomer.</p>';
  h += htmlPlan(trace, reperes + outils, "editeur-carte");
  if (p.equipes.length > 1) h += '<div class="ligne trajets"><span class="doux petit">Trajet affiché :</span>' + p.equipes.map(function (e, i) { return '<button class="puce' + (i === t ? " actif" : "") + '" data-trajet="' + i + '" style="--c:' + e.couleur + '">' + e.emoji + " " + esc(e.nom) + "</button>"; }).join("") + "</div>";
  if (ED.propose) h += '<div class="barre-action"><span>Ajouter une mission ici ?</span><div class="ligne"><button class="btn petit-btn" data-action="ajouter-ici">➕ Ajouter</button><button class="btn second petit-btn" data-action="annuler-ajout">Annuler</button></div></div>';
  else if (ED.sel === "depart") h += '<div class="carte-bloc pile"><h3>🏁 Départ et coffre</h3><p>' + esc(p.depart.nom) + '</p><p class="doux petit">Les équipes partent d\'ici et y reviennent ouvrir le coffre.</p><div class="ligne"><button class="btn second petit-btn" data-action="placer-depart">↔️ Déplacer</button><button class="btn second petit-btn" data-action="depart-ici">📍 À ma position</button><button class="btn discret petit-btn" data-action="deselect">Fermer</button></div></div>';
  else if (typeof ED.sel === "number" && p.missions[ED.sel]) {
    var m = p.missions[ED.sel];
    h += '<div class="carte-bloc pile"><div class="ligne" style="flex-wrap:nowrap"><span class="num-mission">' + (ED.sel + 1) + '</span><span style="font-size:1.8rem">' + esc(m.emoji) + "</span><div><p><b>" + esc(m.nom) + '</b></p><p class="doux petit">' + esc(TYPES_QUETE[m.type].nom) + (m.cachee ? " · secrète" : "") + " · ≈ " + Math.round(minutesQuete(p, m)) + " min</p></div></div>" +
      '<div class="ligne"><button class="btn petit-btn" data-editer="' + ED.sel + '">✏️ Modifier</button><button class="btn second petit-btn" data-action="placer-sel">↔️ Déplacer</button><button class="btn second petit-btn" data-tester="' + ED.sel + '">▶️ Tester</button><button class="btn discret petit-btn" data-action="deselect">Fermer</button></div></div>';
  } else {
    var e = estimer(p);
    h += '<div class="carte-bloc pile"><p><b>' + p.missions.length + " missions</b> · durée estimée <b>≈ " + dureeMin(e.total) + "</b> · trajet ≈ " + Math.round(e.parEquipe[t].distance) + ' m</p><button class="btn second" data-action="ajouter-gps">📍 Ajouter une mission à ma position</button></div>';
  }
  apresRendu.push(function () {
    carte.vue = ED.vue || vueSur(pts, 60); ED.vue = carte.vue; appliquerVue();
    brancherCarteMobile(function (x, y) {
      var pos = depuisCarte(x, y);
      if (horsCarte(pos)) { toast("C'est en dehors de la carte du village."); return; }
      if (ED.placer != null) {
        if (ED.placer === "depart") Object.assign(p.depart, pos); else Object.assign(p.missions[ED.placer], pos);
        ED.sel = ED.placer; ED.placer = null; sauverOrga(); toast("Position enregistrée ✅"); rendre(); return;
      }
      ED.propose = { x: x, y: y }; ED.sel = null; rendre();
    });
  });
  return h;
}

function ongletMissions(p) {
  var h = '<div class="pile">';
  if (!p.missions.length) h += '<p class="doux">Aucune mission. Allez dans l\'onglet 🗺️ Carte et touchez un endroit du village.</p>';
  var ch = chiffres(p);
  p.missions.forEach(function (m, i) {
    var T = TYPES_QUETE[m.type], detail = m.type === "enigmes" ? m.nb + " série(s) × " + agesActifs(p).length + " âge(s)" : (m.type === "fantomes" || m.type === "potion" || m.type === "memoire") ? ["facile", "moyen", "difficile"][m.niveau - 1] : m.type === "defi" ? (m.chrono ? "chrono " + m.chrono + " s" : "sans chrono") : "1 question par équipe";
    h += '<div class="item-mission"><span class="num-mission">' + (i + 1) + '</span><button class="corps" data-editer="' + i + '"><span class="e">' + esc(m.emoji) + "</span><span><b>" + esc(m.nom) + '</b><br><span class="doux petit">' + T.emoji + " " + T.nom + " · " + detail + (m.cachee ? " · 🕵️ secrète" : "") + " · ≈ " + Math.round(minutesQuete(p, m)) + " min" + (ch[i] ? " · donne le " + ordinal(ch[i].pos) + " chiffre" : "") + "</span></span></button>" +
      '<span class="fleches"><button data-monter="' + i + '" aria-label="Monter"' + (i ? "" : " disabled") + ">▲</button><button data-descendre=\"" + i + '" aria-label="Descendre"' + (i < p.missions.length - 1 ? "" : " disabled") + ">▼</button></span></div>";
  });
  h += '<button class="btn second" data-onglet="carte">➕ Ajouter une mission sur la carte</button>';
  if (p.missions.length && p.equipes.length > 1) h += bloc("Ordre de passage", p.equipes.map(function (e, t) { return "<p>" + e.emoji + " <b>" + esc(e.nom) + "</b> : " + ordreEquipe(p, t).map(function (i) { return i + 1; }).join(" → ") + " → 🏁</p>"; }).join(""), p.ordre === "decale" ? "Chaque équipe commence par une mission différente (réglable dans ⚙️ Réglages)." : "Toutes les équipes suivent le même ordre.");
  return h + "</div>";
}

function ongletReglages(p) {
  var h = bloc("Le parcours", etiq("Nom du parcours", champ("nom")) + etiq("Code adulte (déblocage, défis, outils)", champ("code", { num: true, max: 6 })));
  h += bloc("Équipes", p.equipes.map(function (e, i) {
    return '<div class="ligne equipe-ligne"><select class="champ emoji-select" data-champ="equipes.' + i + '.emoji" data-type="txt" data-rendre>' + ["🎃", "🦇", "👻", "🕷️", "🐺", "🦉", "🧙‍♀️", "💀", "🐈‍⬛", "⭐"].map(function (x) { return "<option" + (x === e.emoji ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select>" + champ("equipes." + i + ".nom") + "</div>";
  }).join("") + '<div class="ligne"><button class="btn second petit-btn" data-action="equipe-moins"' + (p.equipes.length > 1 ? "" : " disabled") + '>− Une équipe</button><button class="btn second petit-btn" data-action="equipe-plus"' + (p.equipes.length < 4 ? "" : " disabled") + ">+ Une équipe</button></div>" +
    etiq("Ordre de passage", selection("ordre", [["decale", "Chaque équipe commence ailleurs"], ["meme", "Même ordre pour tout le monde"]], { type: "txt" })), "De 1 à 4 équipes. Les questions et défis ne sont jamais les mêmes d'une équipe à l'autre.");
  h += bloc("Âges présents", AGES.map(function (a) { return '<label class="interrupteur"><input type="checkbox" data-champ="ages.' + a.cle + '" data-type="bool" data-rendre' + (p.ages[a.cle] ? " checked" : "") + "><span>" + a.nom + " (" + a.detail + ")</span></label>"; }).join(""), "Les énigmes posent une question à chaque âge coché.");
  h += bloc("Indices et sorts", etiq("Premier indice après", selection("indices.premier", [[30, "30 s"], [60, "1 min"], [90, "1 min 30"], [120, "2 min"], [180, "3 min"]])) +
    etiq("Puis un indice toutes les", selection("indices.intervalle", [[30, "30 s"], [60, "1 min"], [90, "1 min 30"], [120, "2 min"]])) +
    etiq("Attente après une erreur", selection("indices.penalite", [[0, "Aucune"], [10, "10 s"], [15, "15 s"], [30, "30 s"]])));
  h += bloc("Coffre final", etiq("Code du coffre (chiffres)", champ("codeCoffre", { num: true, max: 8 })) +
    '<p class="doux petit">Les chiffres sont répartis entre les missions (voir l\'onglet Missions). Formule obtenue : <b>' + esc(formule(p)) + "</b></p>" +
    etiq("Lieu du départ et du coffre", champ("depart.nom")) + etiq("Phrase pour y retourner", champ("depart.indice", { zone: true })) +
    '<button class="btn second petit-btn" data-action="placer-depart">↔️ Déplacer le départ sur la carte</button>');
  h += bloc("Arrivée aux missions", etiq("Distance pour débloquer", selection("rayon", [[10, "10 m"], [15, "15 m"], [20, "20 m"], [25, "25 m"], [30, "30 m"]])), "Plus c'est petit, plus il faut être précis. 15 m convient bien dans un village.");
  return h;
}

function ongletEnvoyer(p) {
  var v = verifier(p), e = estimer(p);
  var h = bloc("Durée estimée", "<p class=\"grand-chiffre\">≈ " + dureeMin(e.total) + "</p>" + p.equipes.map(function (q, t) { var x = e.parEquipe[t]; return "<p>" + q.emoji + " " + esc(q.nom) + " : marche ≈ " + Math.round(x.marche) + " min (" + Math.round(x.distance) + " m) · épreuves ≈ " + Math.round(x.quetes) + " min</p>"; }).join(""),
    "Calculée pour des enfants en groupe (≈ 2,5 km/h), avec le temps de chercher et de répondre. Pour plus long : ajoutez des missions, des séries de questions ou des missions secrètes.");
  h += bloc("Vérification", (v.erreurs.length ? v.erreurs.map(function (x) { return '<p class="alerte ko">✗ ' + esc(x) + "</p>"; }).join("") : '<p class="alerte ok">✓ Le parcours est prêt.</p>') + v.alertes.map(function (x) { return '<p class="alerte att">! ' + esc(x) + "</p>"; }).join(""));
  h += bloc("Envoyer aux téléphones des joueurs",
    '<button class="btn gros" data-action="preparer-envoi"' + (v.erreurs.length ? " disabled" : "") + ">📤 Afficher le QR code</button>" +
    '<button class="btn second" data-action="nouvelles-questions">🎲 Nouvelles questions</button>' +
    '<button class="btn second" data-action="jouer-ici"' + (v.erreurs.length ? " disabled" : "") + ">▶️ Jouer ce parcours sur ce téléphone</button>" +
    '<button class="btn second" data-action="fiche-orga">📋 Fiche des réponses (adultes)</button>',
    "« Nouvelles questions » refait le tirage : renvoyez ensuite le QR code aux téléphones. Chaque équipe garde des questions différentes.");
  return h;
}

/* ----- Édition d'une mission ----- */
vues.mission = function () {
  var p = PO(), i = UI.orgaMi, m = p && p.missions[i]; if (!m) { UI.ecran = "edition"; return vues.edition(); }
  var b = "missions." + i + ".", T = Math.min(ED.eqTab, p.equipes.length - 1), ch = chiffres(p)[i];
  var h = '<section class="pile editeur"><div class="entete"><button class="btn discret petit-btn" data-action="fin-mission">← Retour</button><span class="doux petit">Mission ' + (i + 1) + " sur " + p.missions.length + "</span></div>";
  h += bloc("La mission", etiq("Nom", champ(b + "nom")) +
    '<div class="emojis">' + EMOJIS_MISSION.map(function (x) { return '<button class="' + (x === m.emoji ? "actif" : "") + '" data-poser="' + b + 'emoji" data-val="' + x + '">' + x + "</button>"; }).join("") + "</div>" +
    etiq("Où aller ? (lu aux enfants)", champ(b + "indice", { zone: true, ph: "Ex. : Allez jusqu'au banc, à côté du monument aux morts." })) +
    etiq("Nom du lieu (pour vous)", champ(b + "lieu", { ph: "Ex. : banc du monument" })) +
    '<label class="interrupteur"><input type="checkbox" data-champ="' + b + 'cachee" data-type="bool" data-rendre' + (m.cachee ? " checked" : "") + "><span>🕵️ Mission secrète (pas sur la carte, radar seulement)</span></label>" +
    etiq("Distance pour débloquer", selection(b + "rayon", [["", "Comme le parcours (" + p.rayon + " m)"], [10, "10 m"], [15, "15 m"], [20, "20 m"], [30, "30 m"]])) +
    '<div class="ligne"><button class="btn second petit-btn" data-action="placer-mission">↔️ Déplacer sur la carte</button><button class="btn second petit-btn" data-action="mission-ici">📍 À ma position</button></div>');
  h += bloc("Type de quête", '<div class="types">' + Object.keys(TYPES_QUETE).map(function (k) { var X = TYPES_QUETE[k]; return '<button class="type' + (m.type === k ? " actif" : "") + '" data-poser="' + b + 'type" data-val="' + k + '"><span class="e">' + X.emoji + "</span>" + X.nom + "</button>"; }).join("") + "</div>" + '<p class="doux petit">' + esc(TYPES_QUETE[m.type].desc) + "</p>" + reglagesType(p, m, i, b, T));
  h += bloc("Récompense", etiq("Mot de la formule", champ(b + "mot")) + '<p class="doux petit">' + (ch ? "Cette mission donne aussi le <b>" + ordinal(ch.pos) + " chiffre</b> du coffre : <b>" + esc(ch.val) + "</b>." : "Cette mission ne donne pas de chiffre du coffre.") + "</p>");
  h += '<div class="pile"><p class="doux">Durée estimée de l\'épreuve : ≈ ' + Math.round(minutesQuete(p, m)) + " min</p>" +
    (p.equipes.length > 1 ? '<div class="ligne"><span class="doux petit">Tester en tant que :</span>' + p.equipes.map(function (e, t) { return '<button class="puce' + (t === T ? " actif" : "") + '" data-eqtab="' + t + '" style="--c:' + e.couleur + '">' + e.emoji + " " + esc(e.nom) + "</button>"; }).join("") + "</div>" : "") +
    '<button class="btn gros" data-tester="' + i + '">▶️ Tester l\'épreuve</button>' +
    (ED.suppr === i ? '<div class="ligne"><button class="btn danger" data-action="suppr-ok">Oui, supprimer la mission</button><button class="btn second" data-action="suppr-non">Annuler</button></div>' : '<button class="btn discret" data-action="suppr-mission">🗑️ Supprimer la mission</button>') + "</div>";
  return h + "</section>";
};
function ongletsEquipes(p, T) {
  if (p.equipes.length < 2) return "";
  return '<div class="segment">' + p.equipes.map(function (e, t) { return '<button class="' + (t === T ? "actif" : "") + '" data-eqtab="' + t + '">' + e.emoji + " " + esc(e.nom) + "</button>"; }).join("") + "</div>";
}
function choixCommune(p, m, b) {
  if (p.equipes.length < 2) return "";
  return '<label class="interrupteur"><input type="checkbox" data-champ="' + b + 'commune" data-type="bool" data-rendre' + (estCommune(m) ? " checked" : "") + '><span>Même ' + (m.type === "defi" ? "défi" : "question") + ' pour toutes les équipes</span></label>';
}
function reglagesType(p, m, i, b, T) {
  if (estCommune(m) && (m.type === "observation" || m.type === "defi")) T = 0;
  if (m.type === "enigmes") {
    return etiq("Séries de questions", '<div class="pas"><button data-pas="' + b + 'nb" data-d="-1">−</button><b>' + m.nb + '</b><button data-pas="' + b + 'nb" data-d="1">+</button></div>') +
      '<p class="doux petit">Une série = une question pour chaque âge coché (' + agesActifs(p).map(function (a) { return a.nom.toLowerCase(); }).join(", ") + "). Questions tirées au hasard, différentes pour chaque équipe.</p>";
  }
  if (m.type === "fantomes" || m.type === "potion" || m.type === "memoire") {
    var d = { fantomes: ["10 fantômes en 30 s", "14 fantômes en 30 s", "18 fantômes en 35 s, avec des pièges"], potion: ["2 potions (3 et 4 ingrédients)", "3 potions (3, 4, 5)", "3 potions (4, 5, 6)"], memoire: ["3 paires", "4 paires", "6 paires"] }[m.type];
    return etiq("Difficulté", segment(b + "niveau", [[1, "Facile"], [2, "Moyen"], [3, "Difficile"]], true)) + '<p class="doux petit">' + d[m.niveau - 1] + "</p>";
  }
  if (m.type === "defi") {
    return choixCommune(p, m, b) + (estCommune(m) ? "" : ongletsEquipes(p, T)) +
      etiq(estCommune(m) || p.equipes.length < 2 ? "Défi (pour toutes les équipes)" : "Défi pour l'équipe " + esc(p.equipes[T].nom), champ(b + "defis." + T, { zone: true, lignes: 3, ph: "Laissez vide pour un défi tiré au hasard, différent pour chaque équipe. Ex. : « " + defiPour(p, T, i) + " »" })) +
      etiq("Chrono", selection(b + "chrono", [[0, "Pas de chrono"], [20, "20 s"], [30, "30 s"], [60, "1 min"], [120, "2 min"]])) +
      '<p class="doux petit">Un adulte valide le défi avec le code adulte (' + esc(p.code) + ").</p>";
  }
  if (m.type === "observation") {
    var q = (m.perso || [])[T] || {}, c = b + "perso." + T + ".", mode = q.mode || "choix";
    if (!q.mode) poser(p, c + "mode", "choix");
    var h = choixCommune(p, m, b) + (estCommune(m) ? "" : ongletsEquipes(p, T)) + '<p class="doux petit">Écrivez une question qu\'on ne peut résoudre qu\'en regardant sur place. Allez vérifier la réponse !</p>' +
      etiq(estCommune(m) || p.equipes.length < 2 ? "Question (pour toutes les équipes)" : "Question pour l'équipe " + esc(p.equipes[T].nom), champ(c + "question", { zone: true, ph: "Ex. : Combien de fenêtres voyez-vous sur la façade de la mairie ?" })) +
      etiq("Type de réponse", segment(c + "mode", [["choix", "4 choix"], ["nombre", "Un nombre"], ["mot", "Un mot"]]));
    if (mode === "choix") {
      h += [0, 1, 2, 3].map(function (k) { var bonne = +(q.bonne || 0) === k; return '<div class="ligne option-ligne"><button class="rond' + (bonne ? " actif" : "") + '" data-poser="' + c + 'bonne" data-val="' + k + '" data-num aria-label="Bonne réponse">' + (bonne ? "✓" : "") + "</button>" + champ(c + "options." + k, { ph: "Réponse " + (k + 1) + (k < 2 ? "" : " (facultatif)") }) + "</div>"; }).join("") + '<p class="doux petit">Touchez le rond de la bonne réponse.</p>';
    } else h += etiq("Bonne réponse", champ(c + "reponse", { ph: mode === "nombre" ? "Ex. : 6" : "Ex. : lion / un lion" })) + '<p class="doux petit">Plusieurs réponses acceptées ? Séparez-les par « / ».</p>';
    h += etiq("Indices (facultatifs, ils apparaissent avec le temps)", [0, 1, 2].map(function (k) { return champ(c + "indices." + k, { ph: "Indice " + (k + 1) }); }).join(""));
    return h;
  }
  return "";
}

/* ----- Envoi par QR code ----- */
vues.envoi = function () {
  var E = ED.envoi, p = PO(); if (!E) return vues.edition();
  var n = E.parts.length;
  apresRendu.push(function () {
    if (n < 2) return;
    jeu.timers.push(setInterval(function () { E.i = (E.i + 1) % n; var b = document.getElementById("qr-envoi"); if (b) b.innerHTML = svgQR(E.parts[E.i]); var t = document.getElementById("qr-num"); if (t) t.textContent = "Code " + (E.i + 1) + " sur " + n; document.querySelectorAll(".points span").forEach(function (s, k) { s.classList.toggle("actif", k === E.i); }); }, 1500));
  });
  return '<section class="pile centre"><div class="entete" style="width:100%"><button class="btn discret petit-btn" data-action="fin-envoi">← Retour</button><span class="doux petit">' + esc(p.nom) + "</span></div>" +
    "<h2>Scannez avec chaque téléphone</h2>" +
    '<ol class="etapes-install" style="text-align:left"><li><span class="num">1</span><span>Sur le téléphone joueur : <b>📷 Charger le parcours de l\'organisateur</b> → <b>Scanner</b>.</span></li><li><span class="num">2</span><span>Visez ce QR code' + (n > 1 ? " : les " + n + " codes défilent tout seuls, gardez le téléphone pointé" : "") + '.</span></li><li><span class="num">3</span><span>Touchez <b>Utiliser ce parcours</b>.</span></li></ol>' +
    '<div class="qr qr-grand" id="qr-envoi">' + svgQR(E.parts[E.i]) + "</div>" +
    (n > 1 ? '<p id="qr-num" class="doux">Code ' + (E.i + 1) + " sur " + n + '</p><div class="points">' + E.parts.map(function (_, k) { return '<span class="' + (k === E.i ? "actif" : "") + '"></span>'; }).join("") + "</div>" : "") +
    '<button class="btn second" data-action="partager-lien">🔗 Envoyer le lien par message</button>' +
    '<p class="doux petit">Le lien sert aussi de sauvegarde du parcours. Sur iPhone, le joueur l\'ouvre puis le colle dans le jeu (Charger → Coller un lien).</p></section>';
};

/* ------------------------------------------------------------------ */
/* Installation, localisation, contrôle mode avion                    */
/* ------------------------------------------------------------------ */
var promptInstall = null, installAccepte = false;
function estInstalle() { try { return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || window.navigator.standalone === true; } catch (e) { return false; } }
// Aucune exception : il faut installer le jeu (sauf dans l'aperçu de Claude)
function apercuAutorise() { return !!window.APERCU_CLAUDE; }
window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); promptInstall = e; if (!estInstalle()) rendre(); });
window.addEventListener("appinstalled", function () { installAccepte = true; rendre(); });
var ua = navigator.userAgent || "";
var estIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
var estAndroid = /Android/i.test(ua);
var estSafari = estIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

vues.installer = function () {
  var h = '<section class="pile installer"><div class="citrouille-anim" aria-hidden="true">📲</div><h1>Installez le jeu</h1>' +
    '<p style="font-size:1.15rem">Pour jouer sans Internet et sans quitter le jeu par erreur, installez-le d\'abord sur ce téléphone. Ça prend 20 secondes.</p>';
  if (installAccepte) h += '<div class="carte-bloc pile"><h3>C\'est installé ! 🎉</h3><p style="font-size:1.15rem">Fermez cette page, puis ouvrez le jeu avec l\'icône <b>🎃 Malédiction</b> sur l\'écran d\'accueil.</p></div>';
  else if (estIOS && !estSafari) h += '<div class="carte-bloc pile"><h3>Ouvrez ce lien dans Safari</h3><p>Sur iPhone, l\'installation se fait depuis <b>Safari</b>. Copiez l\'adresse, collez-la dans Safari, puis suivez les étapes.</p><p class="adresse">' + esc(URL_JEU) + "</p></div>";
  else if (estIOS) h += '<ol class="etapes-install"><li><span class="num">1</span><span>Touchez le bouton <b>Partager</b> ⬆️ (le carré avec une flèche).</span></li><li><span class="num">2</span><span>Touchez <b>« Sur l\'écran d\'accueil »</b> ➕.</span></li><li><span class="num">3</span><span>Touchez <b>« Ajouter »</b>.</span></li><li><span class="num">4</span><span>Ouvrez le jeu avec l\'icône <b>🎃 Malédiction</b>.</span></li></ol>';
  else if (promptInstall) h += '<button class="btn gros" data-action="installer">📲 Installer le jeu</button><p class="doux">Puis ouvrez le jeu avec l\'icône <b>🎃 Malédiction</b>.</p>';
  else h += '<ol class="etapes-install"><li><span class="num">1</span><span>Touchez le menu <b>⋮</b> en haut à droite de Chrome.</span></li><li><span class="num">2</span><span>Touchez <b>« Installer l\'application »</b> ou <b>« Ajouter à l\'écran d\'accueil »</b>.</span></li><li><span class="num">3</span><span>Ouvrez le jeu avec l\'icône <b>🎃 Malédiction</b>.</span></li></ol><p class="doux petit">Déjà installé ? Ouvrez-le depuis l\'icône.</p>';
  return h + (CHARGE ? '<p class="alerte ok">✓ Parcours « ' + esc(CHARGE.nom) + ' » reçu. Installez le jeu, puis ouvrez-le depuis l\'icône.</p>' : "") + '<button class="btn second" data-aller="partage">📱 Montrer le QR code du jeu</button></section>';
};

vues.localisation = function () {
  var h = '<section class="pile installer"><div class="citrouille-anim" aria-hidden="true">📍</div><h1>Activez la localisation</h1>' +
    '<p style="font-size:1.15rem">Le téléphone doit savoir où vous êtes pour ouvrir les épreuves quand vous arrivez aux missions. Sans localisation, on ne peut pas jouer.</p>';
  if (gps.refuse) {
    h += '<div class="carte-bloc pile" style="text-align:left"><h3>La localisation est bloquée</h3>' + (estIOS
      ? '<ol class="etapes-install"><li><span class="num">1</span><span>Ouvrez les <b>Réglages</b> de l\'iPhone.</span></li><li><span class="num">2</span><span><b>Confidentialité et sécurité</b> → <b>Service de localisation</b> : activé.</span></li><li><span class="num">3</span><span>Touchez <b>Sites web Safari</b> → <b>Lorsque l\'app est active</b>.</span></li><li><span class="num">4</span><span>Revenez ici et touchez <b>Réessayer</b>.</span></li></ol>'
      : '<ol class="etapes-install"><li><span class="num">1</span><span>Appui long sur l\'icône <b>🎃 Malédiction</b> → <b>Infos sur l\'appli</b>.</span></li><li><span class="num">2</span><span><b>Autorisations</b> → <b>Position</b> → <b>Autoriser</b>.</span></li><li><span class="num">3</span><span>Vérifiez que la <b>Localisation</b> du téléphone est activée.</span></li><li><span class="num">4</span><span>Revenez ici et touchez <b>Réessayer</b>.</span></li></ol>') +
      '</div><button class="btn gros" data-action="gps">🔄 Réessayer</button>';
  } else if (gps.suivi !== null) h += '<div class="radar"><span class="radar-emoji" aria-hidden="true">🛰️</span><p class="radar-texte">Recherche…</p><p class="radar-dist">Si le téléphone demande, touchez <b>Autoriser</b>. Restez dehors quelques secondes.</p></div>';
  else h += '<button class="btn gros" data-action="gps">📍 Autoriser la localisation</button><p class="doux">Le téléphone va demander : touchez <b>« Autoriser »</b>.</p>';
  return h + '<button class="btn discret" data-action="ouvrir-outils">Adulte</button></section>';
};

var verifs = null;
vues.verif = function () {
  var h = '<section class="pile"><h2>Prêt pour le mode avion ?</h2><p class="doux">À faire avec Internet, la veille, sur chaque téléphone.</p><div class="carte-bloc">';
  if (!verifs) { h += "<p>Vérification en cours…</p>"; apresRendu.push(lancerVerif); }
  else h += verifs.map(function (v) { return '<div class="check"><span class="etat ' + v.etat + '">' + (v.etat === "ok" ? "✓" : v.etat === "ko" ? "✗" : "!") + '</span><div><p><b>' + esc(v.titre) + '</b></p><p class="doux petit">' + esc(v.detail) + "</p></div></div>"; }).join("") + '<button class="btn second" data-action="reverif">Relancer la vérification</button>';
  return h + '</div><div class="carte-bloc"><h3>Le test qui compte</h3><ol class="pile" style="padding-left:22px;margin:0"><li>Tout est vert ci-dessus.</li><li>Le parcours de l\'organisateur est chargé.</li><li>Activez le <b>mode avion</b>.</li><li>Fermez complètement le jeu, puis rouvrez-le depuis l\'icône.</li><li>Testez une mission, puis recommencez la partie (⚙️ Outils adulte).</li></ol></div><button class="btn" data-action="retour-accueil">Retour</button></section>';
};
function lancerVerif() {
  var res = [];
  var stockageOk = (function () { try { localStorage.setItem("__t", "1"); var v = localStorage.getItem("__t"); localStorage.removeItem("__t"); return v === "1"; } catch (e) { return false; } })();
  res.push({ titre: "Sauvegarde de la progression", etat: stockageOk ? "ok" : "ko", detail: stockageOk ? "La progression reste enregistrée même si le jeu est fermé." : "Le navigateur bloque la sauvegarde (navigation privée ?)." });
  res.push(!JOUE ? { titre: "Parcours chargé", etat: "ko", detail: "Aucun parcours : scannez le QR code de l'organisateur." } : { titre: "Parcours chargé", etat: "ok", detail: JOUE.nom + " · " + JOUE.missions.length + " missions · " + JOUE.equipes.length + " équipe(s)." });
  res.push({ titre: "Connexion actuelle", etat: navigator.onLine ? "ok" : "att", detail: navigator.onLine ? "En ligne : le téléchargement des fichiers est possible." : "Hors ligne. Si tout le reste est vert, c'est bon signe !" });
  var voix = "speechSynthesis" in window;
  res.push({ titre: "Lecture à voix haute", etat: voix && voixFr ? (voixFr.localService ? "ok" : "att") : "att", detail: !voix ? "Pas disponible : un adulte lira à voix haute." : voixFr ? (voixFr.localService ? "Voix française installée." : "Voix française en ligne : testez-la en mode avion.") : "Aucune voix française trouvée. Un adulte lira." });
  var gpsDispo = ("geolocation" in navigator) && window.isSecureContext;
  res.push({ titre: "Position GPS", etat: !gpsDispo ? "ko" : (UI.gps ? "ok" : "att"), detail: !gpsDispo ? "Le GPS ne marche pas ici : ouvrez le jeu depuis son adresse https." : (UI.gps ? "Localisation autorisée. Le GPS marche aussi en mode avion, dehors." : "Pas encore autorisée : le jeu la demandera au début de la partie.") });
  var cam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  res.push({ titre: "Caméra (pour scanner le parcours)", etat: cam ? "ok" : "att", detail: cam ? "Disponible." : "Indisponible : utilisez « Coller un lien »." });
  if (!("serviceWorker" in navigator)) { res.unshift({ titre: "Fonction hors connexion", etat: "ko", detail: "Ce navigateur (ou cet aperçu) ne permet pas le mode hors connexion. Ouvrez le jeu depuis son adresse https." }); verifs = res; rendre(); return; }
  navigator.serviceWorker.getRegistration().then(function (reg) {
    var actif = !!(reg && reg.active);
    res.unshift({ titre: "Fonction hors connexion", etat: actif ? "ok" : "ko", detail: actif ? "Le gestionnaire hors connexion est actif." : "Pas encore actif. Rechargez une fois avec Internet, puis relancez la vérification." });
    if (!("caches" in window) || typeof FICHIERS === "undefined") { verifs = res; rendre(); return; }
    return Promise.all(FICHIERS.map(function (f) { return caches.match(new URL(f, location.href).href).then(function (r) { return r ? null : f; }); })).then(function (manque) {
      manque = manque.filter(Boolean);
      res.splice(1, 0, { titre: "Fichiers du jeu enregistrés", etat: manque.length ? "ko" : "ok", detail: manque.length ? "Manquants : " + manque.join(", ") + ". Rechargez avec Internet." : FICHIERS.length + " fichiers enregistrés sur le téléphone." });
      verifs = res; rendre();
    });
  }).catch(function () { res.unshift({ titre: "Fonction hors connexion", etat: "ko", detail: "Vérification impossible ici." }); verifs = res; rendre(); });
}

/* Pas de retour arrière ni d'actualisation par erreur une fois installé */
function protegerNavigation() {
  try {
    history.pushState({ jeu: 1 }, "", location.href.split("#")[0]);
    window.addEventListener("popstate", function () {
      history.pushState({ jeu: 1 }, "", location.href.split("#")[0]);
      if (UI.ecran === "etape" || UI.ecran === "inventaire" || UI.ecran === "final") aller("carte");
      else if (UI.ecran === "mission") aller("edition");
      else if (UI.ecran !== "accueil" && UI.ecran !== "carte") aller("accueil");
      else toast("Le jeu reste ouvert 🎃");
    });
  } catch (e) {}
  window.addEventListener("beforeunload", function (e) { if (PARTIE.equipe != null && !PARTIE.victoire) { e.preventDefault(); e.returnValue = ""; } });
}
var verrouEcran = null;
function garderEcranAllume() { try { if (navigator.wakeLock && document.visibilityState === "visible" && !verrouEcran) navigator.wakeLock.request("screen").then(function (w) { verrouEcran = w; w.addEventListener("release", function () { verrouEcran = null; }); }).catch(function () {}); } catch (e) {} }
document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { garderEcranAllume(); if (gps.suivi === null && UI.gps) lancerGPS(); } else arreterScan(); });

/* ------------------------------------------------------------------ */
/* Rendu                                                              */
/* ------------------------------------------------------------------ */
var apresRendu = [];
var SANS_INSTALL = { partage: 1 };
var ECRANS_JOUEUR = { intro: 1, equipes: 1, carte: 1, etape: 1, inventaire: 1, final: 1, victoire: 1, outils: 1 };
var ECRANS_GPS = { intro: 1, equipes: 1, carte: 1, etape: 1, inventaire: 1, final: 1 };
var ECRANS_ORGA = { orga: 1, edition: 1, mission: 1, envoi: 1 };
var orgaDeverrouille = false;
function aller(ecran) { UI.ecran = ecran; sauverUI(); arretVoix(); if (ecran !== "charger") arreterScan(); rendre(); window.scrollTo(0, 0); }
function rendre() {
  nettoyerJeux(); apresRendu = []; questionAffichee = null;
  var e = UI.ecran;
  if (ECRANS_ORGA[e] && !orgaDeverrouille) { e = UI.ecran = "accueil"; }
  if (!TEST && !JOUE && (ECRANS_GPS[e] || e === "victoire")) e = UI.ecran = "accueil";
  if (!TEST && ECRANS_GPS[e] && e !== "intro" && e !== "equipes" && PARTIE.equipe == null) e = UI.ecran = "accueil";
  if (!TEST && e === "final" && PARTIE.victoire) e = UI.ecran = "victoire";
  if (!TEST && e === "etape" && PARTIE.courant == null) e = UI.ecran = "carte";
  if (TEST && e !== "etape" && e !== "pin") TEST = null;
  var v;
  if (!TEST && !estInstalle() && !apercuAutorise() && !SANS_INSTALL[e]) v = vues.installer;
  else if (!TEST && ECRANS_GPS[e] && !UI.gps && !UI.sansGps && !window.APERCU_CLAUDE) v = vues.localisation;
  else v = vues[e] || vues.accueil;
  app.innerHTML = v();
  document.body.classList.toggle("mode-orga", !!ECRANS_ORGA[e]);
  rendreNav();
  derniereDistance = null;
  apresRendu.forEach(function (f) { try { f(); } catch (err) { console.error(err); } });
  majGPS(); majIndices();
}

/* ------------------------------------------------------------------ */
/* Événements                                                         */
/* ------------------------------------------------------------------ */
var ACTIONS = {
  "retour-accueil": function () { aller("accueil"); },
  commencer: function () { if (!JOUE) { aller("charger"); return; } if (PARTIE.victoire) PARTIE = partieVierge(); sauverPartie(); son.fantome(); aller("intro"); },
  son: function () { UI.son = !UI.son; sauverUI(); rendre(); if (UI.son) son.bon(); },
  gps: function () { lancerGPS(); rendre(); },
  "ouvrir-orga": function () { if (orgaDeverrouille) aller("orga"); else demanderCode("orga", "accueil"); },
  "ouvrir-outils": function () { demanderCode("outils", UI.ecran); },
  "fermer-outils": function () { confirmeReset = false; aller(PARTIE.equipe != null ? "carte" : "accueil"); },
  "pin-retour": function () { aller(PIN.retour === "pin" ? "accueil" : PIN.retour); },
  "debloquer-adulte": function () { demanderCode("debloquer", UI.ecran); },
  "aller-prochaine": function () { var p = prochaine(); if (p != null) { PARTIE.courant = p; etat(p); sauverPartie(); aller("etape"); } else if (toutFini()) aller("final"); },
  "commencer-quete": function () { var c = ctx(); c.st.phase = "jeu"; c.st.i = 0; c.st.t0 = null; sauverPartie(); son.bon(); rendre(); },
  "apparition-vue": function () { var c = ctx(); c.st.vu = true; sauverPartie(); rendre(); },
  revoir: function () { var c = ctx(); c.st.vu = false; rendre(); },
  "valider-defi": function () { if (TEST) { avancer(); return; } demanderCode("defi", "etape"); },
  "valider-adulte": function () { if (TEST) { avancer(); return; } demanderCode("defi", "etape"); },
  "lancer-chrono": lancerChrono,
  "fantomes-go": demarrerFantomes,
  "potion-go": function () { demarrerPotion(false); },
  ranger: function () {
    var c = ctx(); c.st.fini = true; c.st.phase = "fini"; c.st.heure = Date.now(); PARTIE.courant = null; sauverPartie();
    son.tresor(); if (toutFini()) { etincelles(); aller("final"); } else aller("carte");
  },
  victoire: function () { PARTIE.victoire = true; PARTIE.fin = PARTIE.fin || Date.now(); sauverPartie(); son.victoire(); aller("victoire"); etincelles(); },
  passer: function () { var c = ctx(); if (!c.st) return; c.st.aide = true; c.st.bloque = 0; if (c.st.phase === "chercher") { c.st.arrive = true; sauverPartie(); aller("etape"); } else { aller("etape"); if (c.st.phase === "jeu") avancer(); } },
  "ouvrir-coffre": function () { PARTIE.coffreArrive = true; sauverPartie(); aller("final"); },
  "changer-equipe": function () { PARTIE = partieVierge(); sauverPartie(); aller("equipes"); },
  "sans-gps": function () { UI.sansGps = !UI.sansGps; sauverUI(); toast(UI.sansGps ? "Jeu autorisé sans GPS sur ce téléphone" : "GPS de nouveau obligatoire"); rendre(); },
  reset: function () { confirmeReset = true; rendre(); },
  "reset-non": function () { confirmeReset = false; rendre(); },
  "reset-ok": function () { PARTIE = partieVierge(); sauverPartie(); confirmeReset = false; toast("Partie effacée"); aller("accueil"); },
  "voir-reponses-joueur": function () { FICHE = { p: JOUE, equipes: PARTIE.equipe != null ? [PARTIE.equipe] : null, retour: "outils" }; aller("reponses"); },
  "fiche-retour": function () { aller(FICHE.retour); },
  reverif: function () { verifs = null; rendre(); },
  installer: function () { if (promptInstall) { promptInstall.prompt(); promptInstall.userChoice.then(function (c) { if (c && c.outcome === "accepted") installAccepte = true; promptInstall = null; rendre(); }).catch(function () { promptInstall = null; rendre(); }); } },
  "quitter-test": function () { var r = TEST && TEST.retour; TEST = null; nettoyerJeux(); aller(r || "edition"); },
  /* Chargement du parcours (joueur) */
  scanner: demarrerScan,
  "coller-code": function () { var t = (document.getElementById("code-colle") || {}).value || "", m = t.match(/#p=([A-Za-z0-9_-]+)/); importerCode(m ? m[1] : t.trim()); },
  "accepter-parcours": function () { chargerParcoursJoueur(CHARGE); CHARGE = null; toast("Parcours chargé ✅"); aller("accueil"); },
  /* Organisateur */
  "parcours-vide": function () { ajouterParcours(completerParcours({ nom: "Mon parcours", missions: [] })); ouvrirParcours(ORGA.courant); },
  "ajouter-ici": function () { var p = PO(), pos = depuisCarte(ED.propose.x, ED.propose.y); p.missions.push(missionVierge(pos.lat, pos.lng, p.missions.length + 1)); ED.sel = p.missions.length - 1; ED.propose = null; sauverOrga(); toast("Mission " + p.missions.length + " ajoutée"); rendre(); },
  "annuler-ajout": function () { ED.propose = null; rendre(); },
  "annuler-placer": function () { ED.placer = null; rendre(); },
  deselect: function () { ED.sel = null; rendre(); },
  "placer-sel": function () { ED.placer = ED.sel; rendre(); },
  "placer-depart": function () { ED.placer = "depart"; UI.onglet = "carte"; aller("edition"); },
  "placer-mission": function () { ED.placer = UI.orgaMi; ED.sel = UI.orgaMi; UI.onglet = "carte"; aller("edition"); },
  "ajouter-gps": function () { avecPosition(function (pos) { var p = PO(); p.missions.push(missionVierge(pos.lat, pos.lng, p.missions.length + 1)); ED.sel = p.missions.length - 1; sauverOrga(); toast("Mission ajoutée à votre position"); rendre(); }); },
  "mission-ici": function () { avecPosition(function (pos) { Object.assign(PO().missions[UI.orgaMi], pos); sauverOrga(); toast("Mission placée à votre position ✅"); rendre(); }); },
  "depart-ici": function () { avecPosition(function (pos) { Object.assign(PO().depart, pos); sauverOrga(); toast("Départ placé à votre position ✅"); rendre(); }); },
  "fin-mission": function () { ED.suppr = null; aller("edition"); },
  "suppr-mission": function () { ED.suppr = UI.orgaMi; rendre(); },
  "suppr-non": function () { ED.suppr = null; rendre(); },
  "suppr-ok": function () { PO().missions.splice(UI.orgaMi, 1); ED.suppr = null; ED.sel = null; sauverOrga(true); toast("Mission supprimée"); UI.onglet = "missions"; aller("edition"); },
  "equipe-plus": function () { var p = PO(); if (p.equipes.length < 4) p.equipes.push(copie(EQUIPES_PROPOSEES[p.equipes.length])); sauverOrga(); rendre(); },
  "equipe-moins": function () { var p = PO(); if (p.equipes.length > 1) p.equipes.pop(); ED.equipeTrajet = 0; ED.eqTab = 0; sauverOrga(); rendre(); },
  "nouvelles-questions": function () { PO().graine = Math.floor(Math.random() * 1e9); sauverOrga(true); toast("🎲 Nouvelles questions tirées. Renvoyez le QR code aux téléphones."); rendre(); },
  "jouer-ici": function () { chargerParcoursJoueur(copie(PO())); toast("Parcours chargé sur ce téléphone ✅"); aller("accueil"); },
  "fiche-orga": function () { FICHE = { p: PO(), equipes: null, retour: "edition" }; aller("reponses"); },
  "preparer-envoi": function () {
    var p = PO(), v = verifier(p); if (v.erreurs.length) { toast("Corrigez d'abord : " + v.erreurs[0]); return; }
    sauverOrga(true);
    encoderParcours(p).then(function (code) { ED.envoi = { parts: decouper(code), i: 0, lien: lienParcours(code) }; aller("envoi"); });
  },
  "fin-envoi": function () { UI.onglet = "envoyer"; aller("edition"); },
  "partager-lien": function () {
    var l = ED.envoi.lien, p = PO();
    if (navigator.share) { navigator.share({ title: "Parcours : " + p.nom, text: "Ouvre ce lien pour charger le parcours de La Malédiction de Saint-Gal :", url: l }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(l).then(function () { toast("Lien copié ✅"); }).catch(function () { toast("Copie impossible sur ce téléphone."); });
  }
};
function avecPosition(f) {
  if (gps.pos) { f({ lat: Math.round(gps.pos.lat * 1e6) / 1e6, lng: Math.round(gps.pos.lng * 1e6) / 1e6 }); return; }
  toast("Recherche de votre position…"); lancerGPS();
  var essais = 0, t = setInterval(function () { essais++; if (gps.pos) { clearInterval(t); f({ lat: Math.round(gps.pos.lat * 1e6) / 1e6, lng: Math.round(gps.pos.lng * 1e6) / 1e6 }); } else if (essais > 30) { clearInterval(t); toast("Position introuvable. Placez la mission en touchant la carte."); } }, 500);
}

document.addEventListener("click", function (ev) {
  var b = ev.target.closest("button"); if (!b || b.disabled) return;
  audio(); garderEcranAllume();
  var d = b.dataset;
  if (d.dire) { parler(d.dire, b); return; }
  if (d.action && ACTIONS[d.action]) { ACTIONS[d.action](b); return; }
  if (d.aller) { if (d.aller === "verif") verifs = null; aller(d.aller); return; }
  if (d.equipe != null) { PARTIE = partieVierge(); PARTIE.equipe = +d.equipe; PARTIE.debut = Date.now(); sauverPartie(); son.fantome(); aller("carte"); return; }
  if (d.rep != null) { repondreChoix(b); return; }
  if (d.ing != null) { toucherIngredient(b); return; }
  if (d.mem != null) { toucherMemoire(b); return; }
  if (d.touche) {
    var k = d.touche, code = JOUE.codeCoffre;
    if (k === "⌫") saisieCode = saisieCode.slice(0, -1);
    else if (k === "✓") { if (saisieCode === code) { PARTIE.codeOuvert = true; sauverPartie(); son.tresor(); saisieCode = ""; rendre(); return; } son.faux(); saisieCode = ""; rendre(); retour("Ce n'est pas le bon code. Regardez dans 🎒 Mon sac.", false); return; }
    else if (saisieCode.length < code.length) saisieCode += k;
    rendre(); return;
  }
  if (d.pin) {
    var kp = d.pin, att = codeAttendu();
    if (kp === "⌫") PIN.saisie = PIN.saisie.slice(0, -1);
    else if (kp === "✓") { if (PIN.saisie === att) { if (PIN.but === "orga") { orgaDeverrouille = true; try { if (!estInstalle()) sessionStorage.setItem("apercu-orga", "1"); } catch (e) {} } codeBon(); return; } PIN.saisie = ""; rendre(); retour("Code incorrect.", false); son.faux(); return; }
    else if (PIN.saisie.length < att.length) PIN.saisie += kp;
    rendre(); return;
  }
  if (d.modeleJoueur != null) { CHARGE = depuisModele(+d.modeleJoueur, true); aller("charge-ok"); return; }
  /* Organisateur */
  if (d.carte) {
    if (d.carte === "plus") zoomer(1 / 1.5); else if (d.carte === "moins") zoomer(1.5);
    else if (d.carte === "tout") { var p0 = PO(); ED.vue = carte.vue = vueSur([xy(p0.depart)].concat(p0.missions.map(xy)), 60); appliquerVue(); }
    else if (d.carte === "moi") { if (gps.pos && dansLeVillage()) { var mm = versCarte(gps.pos.lat, gps.pos.lng); carte.vue.x = mm[0] - carte.vue.w / 2; carte.vue.y = mm[1] - carte.vue.h / 2; bornerVue(carte.vue); appliquerVue(); } else { lancerGPS(); toast(gps.pos ? "Vous êtes en dehors du village." : "Recherche de votre position…"); } }
    return;
  }
  if (d.modele != null) { ajouterParcours(depuisModele(+d.modele)); ouvrirParcours(ORGA.courant); return; }
  if (d.ouvrir) { ouvrirParcours(d.ouvrir); return; }
  if (d.dupliquer) { var c2 = copie(ORGA.liste[d.dupliquer]); c2.id = "p" + idAleatoire(); c2.nom += " (copie)"; c2.graine = Math.floor(Math.random() * 1e9); ajouterParcours(completerParcours(c2)); rendre(); return; }
  if (d.supprParcours) { ED.supprParcours = d.supprParcours; rendre(); return; }
  if (d.supprParcoursOk) { delete ORGA.liste[d.supprParcoursOk]; ORGA.ordre = ORGA.ordre.filter(function (x) { return x !== d.supprParcoursOk; }); ED.supprParcours = null; sauverOrga(true); rendre(); return; }
  if (d.onglet) { UI.onglet = d.onglet; ED.propose = null; ED.placer = null; sauverUI(); aller("edition"); return; }
  if (d.sel != null) { ED.sel = d.sel === "depart" ? "depart" : +d.sel; ED.propose = null; rendre(); return; }
  if (d.editer != null) { UI.orgaMi = +d.editer; ED.suppr = null; sauverUI(); aller("mission"); return; }
  if (d.tester != null) { var pt = copie(PO()), st = etatVierge(); st.phase = "jeu"; st.arrive = true; TEST = { p: pt, t: Math.min(ED.eqTab, pt.equipes.length - 1), mi: +d.tester, st: st, retour: UI.ecran }; aller("etape"); return; }
  if (d.trajet != null) { ED.equipeTrajet = +d.trajet; rendre(); return; }
  if (d.eqtab != null) { ED.eqTab = +d.eqtab; rendre(); return; }
  if (d.monter != null || d.descendre != null) {
    var p1 = PO(), i = +(d.monter != null ? d.monter : d.descendre), j = d.monter != null ? i - 1 : i + 1;
    if (j < 0 || j >= p1.missions.length) return;
    var tmp = p1.missions[i]; p1.missions[i] = p1.missions[j]; p1.missions[j] = tmp; sauverOrga(); rendre(); return;
  }
  if (d.poser) { var v = d.num != null ? +d.val : d.val; poser(PO(), d.poser, v); sauverOrga(); rendre(); return; }
  if (d.pas) { var cur = +valeur(PO(), d.pas) || 0; poser(PO(), d.pas, Math.max(1, Math.min(4, cur + (+d.d)))); sauverOrga(); rendre(); return; }
});
function lireChamp(el) {
  var t = el.dataset.type;
  if (t === "bool") return el.checked;
  if (t === "num") return el.value === "" ? null : +el.value;
  return el.value;
}
document.addEventListener("input", function (ev) {
  var el = ev.target;
  if (el.dataset.ui) { UI[el.dataset.ui] = el.value.replace(/\D/g, "") || "1031"; sauverUI(); return; }
  if (!el.dataset.champ || !PO()) return;
  var v = lireChamp(el);
  if (el.dataset.champ === "codeCoffre" || el.dataset.champ === "code") v = String(v).replace(/\D/g, "");
  poser(PO(), el.dataset.champ, v); sauverOrga();
});
document.addEventListener("change", function (ev) {
  var el = ev.target; if (!el.dataset.champ || !PO()) return;
  poser(PO(), el.dataset.champ, lireChamp(el)); sauverOrga(true);
  if (el.dataset.rendre != null) rendre();
});
document.addEventListener("submit", function (ev) {
  ev.preventDefault();
  if (ev.target.dataset.form === "reponse") repondreTexte(ev.target.querySelector("input").value);
});
document.addEventListener("pointerdown", function (ev) { if (ev.target.closest(".ingredient, .carte-mem")) ev.preventDefault(); });

/* ------------------------------------------------------------------ */
/* Démarrage                                                          */
/* ------------------------------------------------------------------ */
// Parcours reçu par lien (#p=…), lu avant toute modification de l'adresse
var lienRecu = (location.hash || "").match(/^#p=([A-Za-z0-9_-]+)/);
// Service worker + mise à jour automatique sur tous les téléphones
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.APERCU_CLAUDE) {
  try {
    var dejaRecharge = false, avaitControleur = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (dejaRecharge || !avaitControleur) return; dejaRecharge = true;
      try { sessionStorage.setItem("msg-maj", "1"); } catch (e) {}
      location.reload();
    });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
      var verifierMaj = function () { if (navigator.onLine) reg.update().catch(function () {}); };
      verifierMaj();
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") verifierMaj(); });
      setInterval(verifierMaj, 10 * 60 * 1000);
    }).catch(function () {});
  } catch (e) {}
}
try { if (sessionStorage.getItem("msg-maj")) { sessionStorage.removeItem("msg-maj"); setTimeout(function () { toast("✨ Le jeu a été mis à jour"); }, 800); } } catch (e) {}
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
try { localStorage.removeItem("malediction-saint-gal-v1"); localStorage.removeItem("malediction-deja-vues"); } catch (e) {}
if (UI.gps) lancerGPS();
try {
  if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: "geolocation" }).then(function (r) {
    if (r.state === "granted" && gps.suivi === null) lancerGPS();
    if (r.state === "denied") { gps.refuse = true; UI.gps = false; sauverUI(); rendre(); }
    r.onchange = function () { if (r.state === "granted") { gps.refuse = false; lancerGPS(); } else if (r.state === "denied") { gps.refuse = true; UI.gps = false; sauverUI(); rendre(); } };
  }).catch(function () {});
} catch (e) {}
if (estInstalle()) protegerNavigation();
garderEcranAllume();
if (ECRANS_ORGA[UI.ecran] || UI.ecran === "pin" || UI.ecran === "outils" || UI.ecran === "reponses" || UI.ecran === "charge-ok") UI.ecran = PARTIE.equipe != null ? "carte" : "accueil";
if (lienRecu) { try { history.replaceState(null, "", location.href.split("#")[0]); } catch (e) {} importerCode(lienRecu[1]); }
else rendre();
// Accès pour les tests automatiques uniquement (inactif en temps normal)
if (window.MSG_TEST) window.__msg = { ctx: ctx, etapesQuete: etapesQuete, questionEnigme: questionEnigme, questionLieu: questionLieu, defiPour: defiPour, jeu: function () { return jeu; }, joue: function () { return JOUE; }, orga: function () { return PO(); }, envoi: function () { return ED.envoi; } };

})();
