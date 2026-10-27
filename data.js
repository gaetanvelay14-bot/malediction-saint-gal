/* =====================================================================
   LA MALÉDICTION DE SAINT-GAL — CONTENU DU JEU
   ---------------------------------------------------------------------
   C'est le SEUL fichier à modifier pour adapter le jeu :
   lieux, énigmes, réponses, indices, code du cadenas, code organisateur.

   Les lieux ci-dessous sont de vrais endroits de Saint-Gal repérés sur
   OpenStreetMap, mais PAS ENCORE VÉRIFIÉS sur place (verifie: false).
   Après ta reconnaissance, ajuste-les si besoin et passe verifie à true. Voir GUIDE-ORGANISATEUR.md, partie 5.

   Réponses tapées : majuscules, accents, espaces et tirets sont
   ignorés. "Saint-Gal", "saint gal" et "SAINTGAL" sont équivalents.
   ===================================================================== */

const JEU = {
  titre: "La Malédiction de Saint-Gal",
  version: "5.0",

  // false = rien à cacher sur place : tout apparaît sur le téléphone à l'arrivée.
  // true  = version avec objets cachés (enveloppes, boîtes…) et vrai coffre.
  objetsPhysiques: false,

  // Code pour ouvrir le mode organisateur (à changer et à garder secret)
  codeOrganisateur: "1031",

  // Code du vrai cadenas du coffre final. Chaque étape 1 à 4 en donne un chiffre.
  // 3110 = 31/10, la nuit d'Halloween. Change-le si ton cadenas a un autre code.
  codeCadenas: "3110",

  // La formule magique : un mot par cachette, dans l'ordre des étapes 1 à 5.
  formule: ["BRILLE", "LUNE", "DORÉE", "SAUVE", "SAINT-GAL"],
  formuleAffichee: "Brille, lune dorée, sauve Saint-Gal !",

  /* ---------- CARTE ----------
     Vraie carte de Saint-Gal (données OpenStreetMap), dans carte-saint-gal.js.
     Elle est enregistrée sur le téléphone : elle marche en mode avion.
     Les lieux ont des coordonnées GPS réelles (lat / lng) ; x / y = position
     sur la carte en mètres (voir le guide, partie 5). */
  carte: {
    attribution: "Carte : © les contributeurs d'OpenStreetMap",
    // Distance (m) à laquelle le jeu annonce « vous êtes tout près ! »
    rayonArrivee: 15
  },

  equipes: [
    { id: "citrouille", nom: "Citrouille", emoji: "🎃", couleur: "#ff9a3c", ordre: [1, 2, 3, 4, 5] },
    { id: "fantome", nom: "Fantôme", emoji: "👻", couleur: "#cfd8ff", ordre: [3, 4, 5, 1, 2] },
    { id: "chauvesouris", nom: "Chauve-souris", emoji: "🦇", couleur: "#c89bff", ordre: [5, 1, 2, 3, 4] }
  ],

  intro: {
    titre: "La lettre de la sorcière",
    texte: [
      "Ce soir, la sorcière Grisemoufle est passée sur Saint-Gal.",
      "Elle a volé la formule magique qui protège le village et l'a déchirée en cinq morceaux.",
      "Elle a caché chaque morceau dans le village, avec un chiffre de son cadenas.",
      "Si personne ne retrouve la formule avant minuit, les esprits envahiront les rues !",
      "Votre mission : trouver les cinq cachettes, résoudre les épreuves et prononcer la formule devant son coffre."
    ],
    signature: "— Grisemoufle, sorcière de la Margeride"
  },

  /* ---------- LES 5 CACHETTES ----------
     Chaque cachette a 3 épreuves, une par âge :
       petits (2-6 ans)  : toucher la bonne image
       moyens (7-10 ans) : devinette ou calcul, réponse à toucher
       grands (11-14 ans): déchiffrer le mot écrit sur la carte trouvée
     Les grands déchiffrent le mot de la formule. */
  etapes: [
    {
      id: 1,
      nom: "La ruelle maudite",
      emoji: "🕯️",
      lieu: {
        nom: "Passage du Carrèrou",
        verifie: false,
        suggestion: "Repéré sur OpenStreetMap : ruelle entre la Rue de l'Église et la Rue de la Douplette. À vérifier sur place : éclairage, sol.",
        indice: "Allez dans le petit Passage du Carrèrou, la ruelle près de l'église.",
        x: 544, y: 486, lat: 44.669105, lng: 3.424871
      },
      cachette: "Rien à cacher : tout apparaît sur le téléphone.",
      contenu: "Apparition d'une chauve-souris.",
      recit: "Dans la ruelle sombre, quelque chose bat des ailes…",
      apparition: { emoji: "🦇", texte: "Une chauve-souris sort de la ruelle !" },
      petits: {
        question: "Quelle bête est apparue ?",
        choix: ["🦇", "🐈‍⬛", "🐸", "🦉"],
        bonne: 0
      },
      moyens: {
        type: "choix",
        question: "Je suis rond et orange. Pour Halloween, on me creuse et on met une bougie dedans. Qui suis-je ?",
        options: ["🎃 Une citrouille", "🍎 Une pomme", "⚽ Un ballon", "🌞 Le soleil"],
        bonne: 0,
        indices: ["Je pousse dans le potager.", "On fait de la soupe avec moi."]
      },
      grands: {
        question: "Il manque des lettres dans le message de la sorcière. C'est ce que fait une bougie dans la nuit.",
        code: "B _ I L L _",
        reponses: ["brille"],
        indices: ["La 2e lettre est un R.", "La dernière lettre est un E.", "C'est BRI… LLE."]
      },
      chiffre: { position: 1, valeur: "3" }
    },
    {
      id: 2,
      nom: "Le chaudron renversé",
      emoji: "🧪",
      lieu: {
        nom: "Banc du monument aux morts",
        verifie: false,
        suggestion: "Repéré sur OpenStreetMap : un banc près du monument aux morts, au bord de la Rue de la Margeride. À vérifier : rester côté banc, sans traverser.",
        indice: "Allez jusqu'au banc, à côté du monument aux morts.",
        x: 579, y: 525, lat: 44.668752, lng: 3.425314
      },
      cachette: "Rien à cacher : tout apparaît sur le téléphone.",
      contenu: "Apparition d'une boîte orange.",
      recit: "Une odeur de soupe aux crapauds… Le chaudron de la sorcière est tout près !",
      apparition: { couleur: "#ff8a1f", emoji: "📦", texte: "Une boîte magique apparaît près du banc !" },
      petits: {
        question: "De quelle couleur était la boîte ?",
        couleurs: ["#ff8a1f", "#3b82f6", "#22c55e", "#f5f5f5"],
        nomsCouleurs: ["orange", "bleue", "verte", "blanche"],
        bonne: 0
      },
      moyens: {
        type: "choix",
        question: "Dans le chaudron, il y a 5 crapauds. La sorcière en ajoute 3. Combien de crapauds en tout ?",
        options: ["6", "7", "8", "9"],
        bonne: 2,
        indices: ["Comptez sur vos doigts : 5, puis encore 3.", "6, 7, 8…"]
      },
      grands: {
        question: "La sorcière a écrit ce mot à l'envers. Lisez-le dans le bon sens.",
        code: "E N U L",
        reponses: ["lune"],
        indices: ["Lisez de droite à gauche.", "On la voit la nuit dans le ciel.", "C'est L, U, N, E."]
      },
      chiffre: { position: 2, valeur: "1" }
    },
    {
      id: 3,
      nom: "Le champ des citrouilles",
      emoji: "🎃",
      lieu: {
        nom: "Chemin des Jardins",
        verifie: false,
        suggestion: "Repéré sur OpenStreetMap : petite voie qui part de la Rue de la Margeride.",
        indice: "Allez au début du Chemin des Jardins.",
        x: 578, y: 570, lat: 44.668345, lng: 3.425301
      },
      cachette: "Rien à cacher : tout apparaît sur le téléphone.",
      contenu: "Apparition de 3 citrouilles.",
      recit: "Le sol tremble… Quelque chose pousse dans les jardins !",
      apparition: { emoji: "🎃🎃🎃", texte: "Des citrouilles sortent de terre !" },
      petits: {
        question: "Combien de citrouilles sont sorties ?",
        compter: { emoji: "🎃", options: [1, 2, 3, 4] },
        bonne: 2
      },
      moyens: {
        type: "choix",
        question: "Je vole la nuit et je dors la tête en bas. Qui suis-je ?",
        options: ["🐦 Un oiseau", "🦇 Une chauve-souris", "🦋 Un papillon", "🐝 Une abeille"],
        bonne: 1,
        indices: ["J'ai des ailes mais je ne suis pas un oiseau.", "Une de mes amies est apparue dans la ruelle maudite !"]
      },
      grands: {
        question: "Chaque nombre est une lettre. Servez-vous du tableau pour décoder le message.",
        code: "4 - 15 - 18 - 5 - 5",
        alphabet: true,
        reponses: ["doree", "dorée"],
        indices: ["4 = D, 15 = O.", "C'est la couleur de l'or.", "D, O, R, E, E."]
      },
      chiffre: { position: 3, valeur: "1" }
    },
    {
      id: 4,
      nom: "Le repaire des fantômes",
      emoji: "👻",
      lieu: {
        nom: "Point d'eau",
        verifie: false,
        suggestion: "Repéré sur OpenStreetMap : point d'eau potable au bord de la Rue de la Margeride.",
        indice: "Trouvez le point d'eau du village, au bord de la grande rue.",
        x: 610, y: 638, lat: 44.66773, lng: 3.425705
      },
      cachette: "Rien à cacher : tout apparaît sur le téléphone.",
      contenu: "Apparition d'une étoile.",
      recit: "Brrr… Un souffle froid. Les fantômes gentils de Saint-Gal veulent vous aider !",
      apparition: { emoji: "⭐", texte: "Une étoile magique brille près de l'eau !" },
      petits: {
        question: "Quelle forme brillait ?",
        choix: ["⭐", "⚫", "🔺", "🟥"],
        bonne: 0
      },
      moyens: {
        type: "choix",
        question: "La sorcière avait 10 bonbons. Elle en a mangé 3. Combien lui en reste-t-il ?",
        options: ["5", "6", "7", "13"],
        bonne: 2,
        indices: ["Il faut enlever 3.", "10, 9, 8…"]
      },
      grands: {
        question: "Avec la grille des fantômes, remplacez chaque symbole du message par sa lettre.",
        code: "🎃 👻 🕷️ 🦇 🌙",
        grille: [["🎃", "S"], ["👻", "A"], ["🕷️", "U"], ["🦇", "V"], ["🌙", "E"], ["🕸️", "R"], ["🐈‍⬛", "O"]],
        reponses: ["sauve"],
        indices: ["🎃 = S, 👻 = A…", "S, A, U…", "C'est SAUVE."]
      },
      chiffre: { position: 4, valeur: "0" }
    },
    {
      id: 5,
      nom: "Le grimoire perdu",
      emoji: "📕",
      lieu: {
        nom: "Rue du Ron Pendut",
        verifie: false,
        suggestion: "Repéré sur OpenStreetMap : rue en boucle au nord de l'église, hors du cimetière.",
        indice: "Montez la Rue du Ron Pendut, au-dessus de l'église.",
        x: 560, y: 382, lat: 44.670045, lng: 3.425074
      },
      cachette: "Rien à cacher : tout apparaît sur le téléphone.",
      contenu: "Apparition d'une araignée.",
      recit: "Le grimoire de la sorcière s'ouvre tout seul… Une petite bête le surveille !",
      apparition: { emoji: "🕷️", texte: "Une araignée garde le grimoire !" },
      petits: {
        question: "Quelle bête gardait le grimoire ?",
        choix: ["🐸", "🕷️", "🐭", "🦊"],
        bonne: 1
      },
      moyens: {
        type: "choix",
        question: "Je suis pointu et noir. La sorcière me porte sur la tête. Qui suis-je ?",
        options: ["🧢 Une casquette", "🎩 Un chapeau pointu", "👑 Une couronne", "🪖 Un casque"],
        bonne: 1,
        indices: ["Je suis pointu en haut.", "Les sorcières en ont toujours un !"]
      },
      grands: {
        question: "Prenez la première lettre de chaque mot du grimoire, dans l'ordre. Quel nom apparaît ?",
        code: "Sorcière · Araignée · Inquiétante · Nuit · Toile · Grimoire · Araignée · Lune",
        reponses: ["saint-gal", "saintgal", "saint gal"],
        indices: ["Sorcière donne S.", "S, A, I, N, T…", "C'est le nom de votre village !"]
      },
      chiffre: null
    }
  ],

  final: {
    titre: "Le coffre de Grisemoufle",
    lieu: {
      nom: "Devant la mairie",
      verifie: false,
      suggestion: "Repéré sur OpenStreetMap : la mairie, à côté de l'église. Point de départ et d'arrivée des 3 équipes, avec un adulte qui garde le coffre.",
      indice: "Retournez devant la mairie, là où l'aventure a commencé. Le coffre vous attend !",
      x: 505, y: 444, lat: 44.669485, lng: 3.424379
    },
    texte: "Vous avez les cinq mots et les quatre chiffres. Attendez les autres équipes, ouvrez le coffre magique de la sorcière, puis criez la formule tous ensemble, très fort !",
    victoire: "La malédiction est levée ! Les esprits retournent dormir et Saint-Gal brille à nouveau. Bravo, chasseurs de sorcière !"
  }
};
