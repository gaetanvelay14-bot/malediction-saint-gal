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
  version: "4.0",

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
       moyens (7-10 ans) : devinette ou calcul
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
        suggestion: "Repéré sur OpenStreetMap : ruelle entre la Rue de l'Église et la Rue de la Douplette. À vérifier sur place : éclairage, sol, accord des riverains.",
        indice: "Entrez dans le petit Passage du Carrèrou. Un ruban orange vous attend.",
        x: 544, y: 486, lat: 44.669105, lng: 3.424871
      },
      cachette: "Enveloppe noire nouée d'un ruban orange, accrochée à hauteur d'enfant dans le passage.",
      contenu: "Une carte avec une chauve-souris dessinée, le mot codé CSJMMF et « 1er chiffre : 3 ».",
      recit: "La ruelle est étroite et sombre. Contre le mur, la sorcière a glissé un message codé…",
      apparition: { emoji: "🦇", texte: "Une chauve-souris sort de la ruelle !" },
      petits: {
        question: "Quelle bête est apparue ?",
        choix: ["🦇", "🐈‍⬛", "🕷️", "🦉"],
        bonne: 0
      },
      moyens: {
        type: "texte",
        question: "Je suis rond et orange. Pour Halloween, on me creuse et on me met une bougie. Qui suis-je ?",
        reponses: ["citrouille", "potiron", "une citrouille"],
        indices: ["Je pousse dans le potager.", "On fait de la soupe avec moi.", "Ça commence par CITR…"]
      },
      grands: {
        question: "La sorcière a avancé chaque lettre d'un cran dans l'alphabet (A devient B, B devient C…). Décodez le message de la sorcière.",
        code: "CSJMMF",
        reponses: ["brille"],
        indices: ["Faites l'inverse : reculez chaque lettre d'un cran.", "C devient B, S devient R…", "Le mot commence par BRI…"]
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
        suggestion: "Repéré sur OpenStreetMap : un banc près du monument aux morts, au bord de la Rue de la Margeride. À vérifier : rester côté banc, sans traverser. Ne rien poser sur le monument.",
        indice: "Allez jusqu'au banc, près du monument aux morts. Regardez dessous !",
        x: 579, y: 525, lat: 44.668752, lng: 3.425314
      },
      cachette: "Boîte orange (boîte à chaussures peinte), posée sous un banc.",
      contenu: "Un parchemin avec le mot ENUL écrit à l'envers et « 2e chiffre : 1 ».",
      recit: "Une odeur de soupe aux crapauds… La boîte est encore tiède !",
      apparition: { couleur: "#ff8a1f", emoji: "📦", texte: "Une boîte magique apparaît sous le banc !" },
      petits: {
        question: "De quelle couleur était la boîte ?",
        couleurs: ["#ff8a1f", "#3b82f6", "#22c55e", "#f5f5f5"],
        nomsCouleurs: ["orange", "bleue", "verte", "blanche"],
        bonne: 0
      },
      moyens: {
        type: "nombre",
        question: "La sorcière a 3 chaudrons. Dans chaque chaudron nagent 4 crapauds. Combien de crapauds en tout ?",
        reponses: ["12", "douze"],
        indices: ["Comptez les crapauds d'un chaudron, puis recommencez.", "4 + 4 + 4…", "C'est entre 10 et 15."]
      },
      grands: {
        question: "Le message de la sorcière est écrit à l'envers. Remettez-le dans le bon sens.",
        code: "ENUL",
        reponses: ["lune"],
        indices: ["Lisez de droite à gauche.", "La dernière lettre devient la première.", "On la voit la nuit dans le ciel."]
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
        suggestion: "Repéré sur OpenStreetMap : petite voie qui part de la Rue de la Margeride. À vérifier : coin d'herbe public ou jardin dont tu as l'accord.",
        indice: "Suivez le Chemin des Jardins. Trois citrouilles montent la garde.",
        x: 578, y: 570, lat: 44.668345, lng: 3.425301
      },
      cachette: "Carte plastifiée derrière une citrouille sculptée (ou une citrouille en papier).",
      contenu: "Une carte avec 3 citrouilles dessinées, les nombres 4-15-18-5-5 et « 3e chiffre : 1 ».",
      recit: "Les citrouilles vous fixent avec leurs yeux de feu. L'une d'elles cache un secret…",
      apparition: { emoji: "🎃🎃🎃", texte: "Des citrouilles sortent de terre !" },
      petits: {
        question: "Combien de citrouilles sont sorties ?",
        compter: { emoji: "🎃", options: [1, 2, 3, 4] },
        bonne: 2
      },
      moyens: {
        type: "texte",
        question: "Je vole la nuit et je dors la tête en bas. Qui suis-je ?",
        reponses: ["chauve-souris", "chauvesouris", "une chauve-souris", "chauve souris"],
        indices: ["J'ai des ailes mais je ne suis pas un oiseau.", "Je vis dans les grottes et les clochers.", "Mon nom contient « chauve »."]
      },
      grands: {
        question: "Chaque nombre est une lettre : A=1, B=2, C=3… Décodez les nombres de la sorcière.",
        code: "4 - 15 - 18 - 5 - 5",
        reponses: ["doree", "dorée"],
        indices: ["4 est la 4e lettre de l'alphabet.", "4 = D, 15 = O…", "C'est la couleur de l'or."]
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
        suggestion: "Repéré sur OpenStreetMap : point d'eau potable au bord de la Rue de la Margeride. À vérifier : espace dégagé pour les fantômes en drap, à l'écart de la circulation.",
        indice: "Trouvez le point d'eau du village. Des fantômes blancs flottent tout près.",
        x: 610, y: 638, lat: 44.66773, lng: 3.425705
      },
      cachette: "Pierre peinte d'une étoile jaune, posée au sol près de fantômes en drap.",
      contenu: "Sous la pierre : une carte avec la suite 🎃 👻 🕷️ 🦇 🌙 et « 4e chiffre : 0 ».",
      recit: "Brrr… Un souffle froid. Les fantômes ne sont pas méchants : ils gardent un message en symboles.",
      apparition: { emoji: "⭐", texte: "Une étoile magique brille près de l'eau !" },
      petits: {
        question: "Quelle forme brillait ?",
        choix: ["⭐", "⚫", "🔺", "🟥"],
        bonne: 0
      },
      moyens: {
        type: "nombre",
        question: "La sorcière avait 20 bonbons. Elle en a mangé 7. Combien lui en reste-t-il ?",
        reponses: ["13", "treize"],
        indices: ["Il faut enlever.", "20 − 7…", "C'est entre 10 et 15."]
      },
      grands: {
        question: "Avec la grille des fantômes, remplacez chaque symbole du message par sa lettre.",
        code: "🎃 👻 🕷️ 🦇 🌙",
        grille: [["🎃", "S"], ["👻", "A"], ["🕷️", "U"], ["🦇", "V"], ["🌙", "E"], ["🕸️", "R"], ["🐈‍⬛", "O"]],
        reponses: ["sauve"],
        indices: ["🎃 = S. Continuez dans l'ordre de la carte.", "S, A, U…", "Le mot veut dire « protège »."]
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
        suggestion: "Repéré sur OpenStreetMap : rue en boucle au nord de l'église, hors du cimetière. À vérifier : un porche ou un muret abrité, avec l'accord du riverain.",
        indice: "Remontez la Rue du Ron Pendut, au-dessus de l'église. Un vieux livre attend, gardé par une araignée.",
        x: 560, y: 382, lat: 44.670045, lng: 3.425074
      },
      cachette: "Un vieux livre (grimoire) dans un sac, avec une araignée en plastique dessus.",
      contenu: "Une page avec 8 mots illustrés : Sorcière, Araignée, Inquiétante, Nuit, Toile, Grimoire, Araignée, Lune.",
      recit: "Le grimoire s'ouvre tout seul. Les pages sentent la poussière et la cire de bougie…",
      apparition: { emoji: "🕷️", texte: "Une araignée garde le grimoire !" },
      petits: {
        question: "Quelle bête gardait le grimoire ?",
        choix: ["🐸", "🕷️", "🐭", "🦊"],
        bonne: 1
      },
      moyens: {
        type: "texte",
        question: "Je suis pointu, noir, et la sorcière me porte sur la tête. Qui suis-je ?",
        reponses: ["chapeau", "un chapeau", "chapeau pointu"],
        indices: ["On me met sur la tête.", "J'ai un grand bord rond.", "Ça commence par CHA…"]
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
