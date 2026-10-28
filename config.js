/* =====================================================================
   LA MALÉDICTION DE SAINT-GAL — RÉGLAGES ET CONTENUS FIXES
   ---------------------------------------------------------------------
   Le parcours (missions, lieux, équipes…) se crée maintenant dans
   l'application, côté organisateur. Ce fichier contient seulement :
   les textes de l'histoire, la liste des défis, les types de quêtes
   et les deux parcours modèles proposés au départ.
   ===================================================================== */

var TEXTES = {
  titre: "La Malédiction de Saint-Gal",
  attribution: "Carte : © les contributeurs d'OpenStreetMap",
  intro: {
    titre: "La lettre de la sorcière",
    texte: [
      "Ce soir, la sorcière Grisemoufle est passée sur Saint-Gal.",
      "Elle a volé la formule magique qui protège le village et l'a déchirée en {N} morceaux.",
      "Elle a caché chaque morceau dans le village, avec les chiffres de son cadenas.",
      "Si personne ne retrouve la formule avant minuit, les esprits envahiront les rues !",
      "Votre mission : réussir les {N} épreuves, retrouver la formule et ouvrir son coffre."
    ],
    signature: "— Grisemoufle, sorcière de la Margeride"
  },
  final: {
    titre: "Le coffre de Grisemoufle",
    texte: "Vous avez tous les morceaux de la formule et tous les chiffres. Attendez les autres équipes, ouvrez le coffre magique, puis criez la formule tous ensemble, très fort !",
    victoire: "La malédiction est levée ! Les esprits retournent dormir et Saint-Gal brille à nouveau. Bravo, chasseurs de sorcière !"
  }
};

/* ---------- Les types de quêtes que l'organisateur peut choisir ----------
   minutes = durée moyenne estimée (sans la marche), pour calculer la durée. */
var TYPES_QUETE = {
  enigmes: { nom: "Énigmes de la sorcière", emoji: "📜", minutes: 7,
    desc: "Une question par âge (petits, moyens, grands), tirée au hasard. Indices automatiques. Vous choisissez combien de séries de questions." },
  observation: { nom: "Question sur le lieu", emoji: "🔎", minutes: 3,
    desc: "Vous écrivez une question sur ce qu'on voit sur place (« Combien de fenêtres a la mairie ? »). Une question différente par équipe." },
  defi: { nom: "Défi de groupe", emoji: "🤸", minutes: 4,
    desc: "Un défi à faire tous ensemble (ronde, mime, statues…). Un adulte valide avec le code. Différent pour chaque équipe." },
  fantomes: { nom: "Chasse aux fantômes", emoji: "👻", minutes: 3,
    desc: "Des fantômes apparaissent sur l'écran : il faut en attraper assez avant la fin du temps." },
  potion: { nom: "Potion de la sorcière", emoji: "🧪", minutes: 4,
    desc: "Le chaudron montre des ingrédients dans un ordre : il faut refaire le même ordre, de plus en plus long." },
  memoire: { nom: "Mémoire des citrouilles", emoji: "🎃", minutes: 4,
    desc: "Retournez les citrouilles pour retrouver les paires d'images cachées." }
};

/* ---------- Défis de groupe (sans matériel, sans danger) ---------- */
var DEFIS = [
  "Faites une ronde tous ensemble et criez trois fois : « Grisemoufle, va-t'en ! »",
  "Chacun imite un animal de la nuit. Les autres doivent deviner lequel.",
  "Restez tous immobiles comme des statues pendant 20 secondes, même si l'adulte fait des grimaces !",
  "Trouvez autour de vous 3 feuilles de couleurs différentes et montrez-les à l'adulte.",
  "Inventez ensemble une formule magique de 4 mots et dites-la très fort.",
  "Comptez ensemble à voix haute jusqu'à 20 en sautant à chaque nombre.",
  "Faites chacun votre tour votre plus horrible rire de sorcière.",
  "Avec vos corps, formez tous ensemble la lettre S de Saint-Gal, et tenez la pose 5 secondes.",
  "Trouvez un petit bâton : ce sera la baguette magique de l'équipe jusqu'à la fin du jeu.",
  "Marchez comme des zombies jusqu'à l'adulte… sans rire !",
  "Chacun dit le nom de son bonbon préféré, le plus vite possible.",
  "Faites un câlin de groupe pour vous protéger des fantômes.",
  "Trouvez quelque chose de rond, quelque chose de doux et quelque chose de piquant (sans rien abîmer).",
  "Mimez tous ensemble une sorcière qui vole sur son balai.",
  "Jouez au téléphone arabe : chuchotez « la citrouille danse sous la lune » d'oreille en oreille. Le dernier répète la phrase !",
  "Défi du silence : 30 secondes sans faire un seul bruit. La sorcière écoute…",
  "Faites 10 sauts de grenouille tous ensemble.",
  "Chacun invente un nom de monstre rigolo et le dit avec une voix effrayante.",
  "Trouvez trois choses de couleur orange autour de vous.",
  "Dessinez une citrouille dans les airs avec votre doigt, puis soufflez tous ensemble pour l'allumer.",
  "Faites une chenille : chacun pose les mains sur les épaules de celui de devant, et faites 10 pas ensemble.",
  "Le plus petit de l'équipe choisit une pose de fantôme : tout le monde doit la copier.",
  "Chantez tous ensemble une comptine ou une chanson que tout le monde connaît.",
  "Chacun dit une chose qui fait peur… puis une chose qui fait rire !"
];

/* ---------- Choix proposés dans l'éditeur ---------- */
var EMOJIS_MISSION = ["🕯️", "🧪", "🎃", "👻", "📕", "🦇", "🕷️", "🐺", "🦉", "🧹", "🔮", "🗝️", "💀", "🐈‍⬛", "🌙", "🍄", "⚰️", "🧙‍♀️"];
var EQUIPES_PROPOSEES = [
  { nom: "Citrouille", emoji: "🎃", couleur: "#ff9a3c" },
  { nom: "Chauve-souris", emoji: "🦇", couleur: "#c89bff" },
  { nom: "Fantôme", emoji: "👻", couleur: "#cfe8ff" },
  { nom: "Araignée", emoji: "🕷️", couleur: "#7fd47a" }
];
var MOTS_RESERVE = ["Abracadabra", "citrouille", "hibou", "chaudron", "étoile", "balai", "grimoire", "potion", "minuit", "lune", "brume", "chouette"];

/* ---------- Parcours modèles ----------
   Lieux repérés sur OpenStreetMap, à vérifier sur place.
   type : enigmes, observation, defi, fantomes, potion, memoire */
var MODELES = [
  {
    nom: "Grand parcours (8 missions)",
    resume: "Environ 1 h 30 à 1 h 45, boucle d'à peu près 1 km dans le cœur du village.",
    parcours: {
      nom: "La Malédiction de Saint-Gal",
      codeCoffre: "3110",
      depart: { nom: "Devant la mairie", indice: "Retournez devant la mairie, là où l'aventure a commencé.", lat: 44.669485, lng: 3.424379 },
      missions: [
        { nom: "La ruelle maudite", emoji: "🕯️", type: "enigmes", nb: 1, mot: "Lune", lieu: "Passage du Carrèrou", indice: "Allez dans le petit Passage du Carrèrou, la ruelle près de l'église.", lat: 44.669105, lng: 3.424871 },
        { nom: "Le chaudron renversé", emoji: "🧪", type: "potion", niveau: 2, mot: "dorée", lieu: "Banc du monument aux morts", indice: "Allez jusqu'au banc, à côté du monument aux morts.", lat: 44.668752, lng: 3.425314 },
        { nom: "Le champ des citrouilles", emoji: "🎃", type: "enigmes", nb: 1, mot: "brille", lieu: "Chemin des Jardins", indice: "Allez au début du Chemin des Jardins.", lat: 44.668345, lng: 3.425301 },
        { nom: "Le repaire des fantômes", emoji: "👻", type: "fantomes", niveau: 2, mot: "sur", lieu: "Point d'eau", indice: "Trouvez le point d'eau du village, au bord de la grande rue.", lat: 44.66773, lng: 3.425705 },
        { nom: "Le grimoire perdu", emoji: "📕", type: "enigmes", nb: 1, mot: "Saint-Gal", lieu: "Rue du Ron Pendut", indice: "Montez la Rue du Ron Pendut, au-dessus de l'église.", lat: 44.670045, lng: 3.425074 },
        { nom: "Le chemin des loups", emoji: "🐺", type: "defi", mot: "et", lieu: "Chemin au nord de la mairie", indice: "Prenez le petit chemin de terre qui part de la mairie vers le nord.", lat: 44.669955, lng: 3.424139 },
        { nom: "La croix oubliée", emoji: "🔮", type: "memoire", niveau: 2, cachee: true, mot: "chasse", lieu: "Chemin de la Croix de la Roberte", indice: "Mission secrète : elle n'est pas sur la carte ! Suivez le radar vers l'ouest, sur le Chemin de la Croix de la Roberte.", lat: 44.669313, lng: 3.423558 },
        { nom: "Le pré de la sorcière", emoji: "🧹", type: "enigmes", nb: 1, mot: "Grisemoufle", lieu: "Rue du Prat de la Gleisa", indice: "Descendez la Rue du Prat de la Gleisa.", lat: 44.668879, lng: 3.423709 }
      ]
    }
  },
  {
    nom: "Parcours classique (5 missions)",
    resume: "Environ 1 h, uniquement des énigmes, autour de l'église.",
    parcours: {
      nom: "La Malédiction de Saint-Gal (classique)",
      codeCoffre: "3110",
      depart: { nom: "Devant la mairie", indice: "Retournez devant la mairie, là où l'aventure a commencé.", lat: 44.669485, lng: 3.424379 },
      missions: [
        { nom: "La ruelle maudite", emoji: "🕯️", type: "enigmes", nb: 1, mot: "Brille,", lieu: "Passage du Carrèrou", indice: "Allez dans le petit Passage du Carrèrou, la ruelle près de l'église.", lat: 44.669105, lng: 3.424871 },
        { nom: "Le chaudron renversé", emoji: "🧪", type: "enigmes", nb: 1, mot: "lune", lieu: "Banc du monument aux morts", indice: "Allez jusqu'au banc, à côté du monument aux morts.", lat: 44.668752, lng: 3.425314 },
        { nom: "Le champ des citrouilles", emoji: "🎃", type: "enigmes", nb: 1, mot: "dorée,", lieu: "Chemin des Jardins", indice: "Allez au début du Chemin des Jardins.", lat: 44.668345, lng: 3.425301 },
        { nom: "Le repaire des fantômes", emoji: "👻", type: "enigmes", nb: 1, mot: "sauve", lieu: "Point d'eau", indice: "Trouvez le point d'eau du village, au bord de la grande rue.", lat: 44.66773, lng: 3.425705 },
        { nom: "Le grimoire perdu", emoji: "📕", type: "enigmes", nb: 1, mot: "Saint-Gal", lieu: "Rue du Ron Pendut", indice: "Montez la Rue du Ron Pendut, au-dessus de l'église.", lat: 44.670045, lng: 3.425074 }
      ]
    }
  }
];
