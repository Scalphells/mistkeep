/**
 * Contenu D&D 5e (2024) — sous-ensemble du SRD 5.2 (CC-BY-4.0, Wizards of the
 * Coast). Les MATHS (caractéristiques, compétences, dés de vie, sauvegardes,
 * progressions d'emplacements) sont identiques à 2014 : la machinerie de
 * srd5e.js est réutilisée telle quelle (les fonctions derive* acceptent les
 * entrées de CE module en paramètre). Ce module ne porte que le contenu
 * d'identité 2024 :
 *   - ESPÈCES (9) : sans bonus de caractéristiques (portés par les
 *     historiques en 2024) ;
 *   - HISTORIQUES (4) : +2/+1 (ou +1/+1/+1) parmi trois caractéristiques
 *     fixes + don d'origine (résumés dans `feature`, le choix restant au
 *     joueur) ;
 *   - CLASSES : les mêmes douze (stats de base inchangées), avec leurs
 *     aptitudes de niveau 1 version 2024 (dont la Maîtrise d'armes) et la
 *     sous-classe unique du SRD 5.2, débloquée au niveau 3 pour toutes.
 *
 * Les textes d'aptitudes sont des RÉSUMÉS (même esprit que les traits
 * d'espèce ci-dessous), pas le texte intégral : ils décrivent ce que fait
 * l'aptitude pour la table, le joueur gardant le PHB 2024 pour le détail
 * chiffré. Les descriptions restent qualitatives là où un nombre exact n'a
 * pas sa place dans un résumé.
 */

import { CLASSES as CLASSES_5E, subSlug } from './srd5e.js';
import { getLocale } from './i18n.js';
import * as EN24 from './srd2024.en.js';

/* ── Espèces (SRD 5.2) ──────────────────────────────────────── */

const SPECIES_FR = [
  {
    key: 'humain', label: 'Humain', ability: {},
    speed: 9, darkvision: 0, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Ingéniosité', desc: 'Tu regagnes l’Inspiration héroïque après chaque repos long.' },
      { name: 'Talentueux', desc: 'Tu gagnes un don d’origine supplémentaire au niveau 1.' },
    ],
  },
  {
    key: 'nain', label: 'Nain', ability: {}, hpPerLevel: 1,
    speed: 9, darkvision: 36, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Robustesse naine', desc: '+1 PV par niveau.' },
      { name: 'Résistance naine', desc: 'Résistance aux dégâts de poison ; avantage aux JS contre l’état empoisonné.' },
      { name: 'Connaissance de la pierre', desc: 'Perception des vibrations (tremorsense) 18 m, 10 min, par repos (bonus action).' },
    ],
  },
  {
    key: 'elfe', label: 'Elfe', ability: {},
    speed: 9, darkvision: 18, size: 'M', fixedSkills: [],
    skillChoose: { count: 1, from: ['insight', 'perception', 'survival'] },
    traits: [
      { name: 'Ascendance féérique', desc: 'Avantage aux JS contre l’état charmé.' },
      { name: 'Transe', desc: '4 h de transe remplacent le sommeil ; tu restes conscient.' },
      { name: 'Lignée elfique', desc: 'Une lignée (drow, haut-elfe, sylvestre) accorde un sort mineur et des sorts aux niveaux 3 et 5.' },
    ],
  },
  {
    key: 'gnome', label: 'Gnome', ability: {},
    speed: 9, darkvision: 18, size: 'P', fixedSkills: [],
    traits: [
      { name: 'Ruse gnome', desc: 'Avantage aux JS d’Intelligence, de Sagesse et de Charisme.' },
      { name: 'Lignée gnome', desc: 'Une lignée (forêts ou roches) accorde des sorts mineurs utilitaires.' },
    ],
  },
  {
    key: 'goliath', label: 'Goliath', ability: {},
    speed: 10.5, darkvision: 0, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Ascendance de géant', desc: 'Un héritage de géant accorde un pouvoir (ex. frappe de pierre, brume), utilisable bonus de maîtrise/jour.' },
      { name: 'Grande stature', desc: 'Avantage aux JS contre l’état agrippé ; tu comptes comme une taille au-dessus pour la capacité de charge.' },
    ],
  },
  {
    key: 'halfelin', label: 'Halfelin', ability: {},
    speed: 9, darkvision: 0, size: 'P', fixedSkills: [],
    traits: [
      { name: 'Chanceux', desc: 'Relance les 1 naturels aux jets d’attaque, de caractéristique et de sauvegarde.' },
      { name: 'Brave', desc: 'Avantage aux JS contre l’état effrayé.' },
      { name: 'Agilité halfeline', desc: 'Tu peux traverser l’espace des créatures plus grandes que toi.' },
    ],
  },
  {
    key: 'drakeide', label: 'Drakéide', ability: {},
    speed: 9, darkvision: 18, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Ascendance draconique', desc: 'Choisis un dragon : il détermine ton souffle et ta résistance.' },
      { name: 'Souffle', desc: 'Remplace une attaque : cône 4,5 m ou ligne 9 m, 1d10 (augmente avec le niveau), JS DEX.' },
      { name: 'Résistance aux dégâts', desc: 'Résistance au type de dégâts de ton ascendance.' },
    ],
  },
  {
    key: 'orc', label: 'Orc', ability: {},
    speed: 9, darkvision: 36, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Poussée d’adrénaline', desc: 'Bonus action : Pointe (Dash) + PV temporaires égaux au bonus de maîtrise.' },
      { name: 'Acharnement', desc: 'Quand tu tombes à 0 PV sans être tué, tu restes à 1 PV (1/repos long).' },
    ],
  },
  {
    key: 'tieffelin', label: 'Tieffelin', ability: {},
    speed: 9, darkvision: 18, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Héritage fiélon', desc: 'Un héritage (abyssal, chthonien, infernal) accorde une résistance et des sorts aux niveaux 3 et 5.' },
      { name: 'Présence d’outre-monde', desc: 'Tu connais le sort mineur Thaumaturgie.' },
    ],
  },
];

/* ── Historiques (SRD 5.2) ──────────────────────────────────── */
// En 2024 les bonus de caractéristiques viennent de l'historique : +2/+1 (ou
// +1/+1/+1) parmi TROIS caractéristiques fixes, plus un don d'origine. Le
// choix appartient au joueur — résumé dans `feature`, non auto-appliqué.

const BACKGROUNDS_2024_FR = [
  {
    key: 'acolyte', label: 'Acolyte', skills: ['insight', 'religion'],
    tools: 'Matériel de calligraphie', languages: '',
    feature: { name: 'Origine 2024', desc: '+2/+1 (ou +1/+1/+1) parmi INT, SAG, CHA · Don d’origine : Initié à la magie (clerc).' },
    equipment: [['Symbole sacré', 1], ['Livre de prières', 1], ['Matériel de calligraphie', 1], ['Habits de cérémonie', 1]], gold: 8,
  },
  {
    key: 'criminel', label: 'Criminel', skills: ['sleight', 'stealth'],
    tools: 'Outils de voleur', languages: '',
    feature: { name: 'Origine 2024', desc: '+2/+1 (ou +1/+1/+1) parmi DEX, CON, INT · Don d’origine : Vigilant.' },
    equipment: [['Dague', 2], ['Outils de voleur', 1], ['Pied-de-biche', 1], ['Habits de voyage', 1]], gold: 16,
  },
  {
    key: 'erudit', label: 'Érudit', skills: ['arcana', 'history'],
    tools: 'Matériel de calligraphie', languages: '',
    feature: { name: 'Origine 2024', desc: '+2/+1 (ou +1/+1/+1) parmi CON, INT, SAG · Don d’origine : Initié à la magie (magicien).' },
    equipment: [['Matériel de calligraphie', 1], ['Livre (philosophie)', 1], ['Parchemin', 8], ['Habits de voyage', 1]], gold: 8,
  },
  {
    key: 'soldat', label: 'Soldat', skills: ['athletics', 'intimidation'],
    tools: 'Un jeu (dés ou cartes)', languages: '',
    feature: { name: 'Origine 2024', desc: '+2/+1 (ou +1/+1/+1) parmi FOR, DEX, CON · Don d’origine : Attaquant sauvage.' },
    equipment: [['Lance', 1], ['Dague', 1], ['Jeu de dés', 1], ['Habits de voyage', 1]], gold: 14,
  },
];

/* ── Classes & sous-classes (SRD 5.2) ───────────────────────── */
// Mêmes douze classes, stats de base identiques à 2014 (DV, sauvegardes,
// carac. d'incantation, progressions). Nouveautés 2024 portées ici : la
// Maîtrise d'armes (classes martiales), l'incantation au niveau 1 pour
// paladin et rôdeur, et les sous-classes toutes débloquées au niveau 3.

// Aptitudes de niveau 1, version 2024 (résumés).
const CLASS_FEATURES_2024 = {
  barbare: [
    { name: 'Rage', desc: 'Action bonus : +dégâts en mêlée, avantage aux jets et JS de FOR, résistance contondant/perforant/tranchant. Plusieurs usages par repos.' },
    { name: 'Défense sans armure', desc: 'Sans armure, CA = 10 + mod. DEX + mod. CON.' },
    { name: 'Maîtrise d’armes', desc: 'Utilise la propriété de maîtrise de deux types d’armes au choix (Entaille, Renversement…).' },
  ],
  barde: [
    { name: 'Incantation', desc: 'Lanceur de sorts (Charisme) ; rituels.' },
    { name: 'Inspiration bardique', desc: 'Action bonus : donne un d6 à un allié (ajout à un d20 ou aux dégâts), récup. repos.' },
  ],
  clerc: [
    { name: 'Incantation', desc: 'Lanceur de sorts (Sagesse) ; rituels.' },
    { name: 'Ordre divin', desc: 'Protecteur (armes martiales + armures lourdes) ou Érudit (un tour de magie + maîtrise de deux compétences de savoir).' },
  ],
  druide: [
    { name: 'Incantation', desc: 'Lanceur de sorts (Sagesse) ; rituels.' },
    { name: 'Druidique', desc: 'Langue secrète des druides ; tu connais Détection de la magie comme rituel.' },
    { name: 'Ordre primal', desc: 'Gardien (arme + armure martiales) ou Magicien (un tour de magie + bonus aux tests d’Arcanes/Nature).' },
  ],
  ensorceleur: [
    { name: 'Incantation', desc: 'Lanceur de sorts (Charisme).' },
    { name: 'Sorcellerie innée', desc: 'Action bonus, 1/repos long : 1 min, +1 au DD de tes sorts et avantage à tes jets d’attaque de sort.' },
  ],
  guerrier: [
    { name: 'Style de combat', desc: 'Une spécialisation au choix (archerie, défense, duel…).' },
    { name: 'Second souffle', desc: 'Action bonus : récupère 1d10 + niveau PV ; plusieurs usages, récup. repos.' },
    { name: 'Maîtrise d’armes', desc: 'Utilise la propriété de maîtrise de trois types d’armes au choix.' },
  ],
  magicien: [
    { name: 'Incantation', desc: 'Lanceur de sorts (Intelligence) ; grimoire.' },
    { name: 'Récupération arcanique', desc: 'Une fois/jour au repos court, récupère des emplacements de sorts (total ≈ ½ niveau).' },
    { name: 'Adepte rituel', desc: 'Lance comme rituels les sorts rituels de ton grimoire.' },
  ],
  moine: [
    { name: 'Arts martiaux', desc: 'À mains nues / armes de moine : utilise la DEX, dé de dégâts dédié, et une attaque à mains nues en action bonus.' },
    { name: 'Défense sans armure', desc: 'Sans armure ni bouclier, CA = 10 + mod. DEX + mod. SAG.' },
  ],
  paladin: [
    { name: 'Imposition des mains', desc: 'Réservoir de soins = 5 × niveau PV, réparti par action ; peut aussi neutraliser un poison.' },
    { name: 'Incantation', desc: 'Lanceur de sorts (Charisme) dès le niveau 1 en 2024.' },
    { name: 'Maîtrise d’armes', desc: 'Utilise la propriété de maîtrise de deux types d’armes au choix.' },
  ],
  rodeur: [
    { name: 'Incantation', desc: 'Lanceur de sorts (Sagesse) dès le niveau 1 en 2024.' },
    { name: 'Ennemi juré', desc: 'Tu connais Marque du chasseur et la lances gratuitement un nombre de fois/jour égal à ton bonus de maîtrise.' },
    { name: 'Maîtrise d’armes', desc: 'Utilise la propriété de maîtrise de deux types d’armes au choix.' },
  ],
  roublard: [
    { name: 'Expertise', desc: 'Double ton bonus de maîtrise sur deux compétences.' },
    { name: 'Attaque sournoise', desc: '+1d6 (augmente avec le niveau) avec une arme fine/à distance, si avantage ou allié adjacent à la cible.' },
    { name: 'Argot des voleurs', desc: 'Langage codé secret.' },
    { name: 'Maîtrise d’armes', desc: 'Utilise la propriété de maîtrise de deux types d’armes au choix.' },
  ],
  occultiste: [
    { name: 'Magie de pacte', desc: 'Emplacements de sorts qui se rechargent au repos court (Charisme).' },
    { name: 'Invocations occultes', desc: 'Améliorations permanentes au choix (échangeables à la montée de niveau).' },
  ],
};

const SUBCLASS_BY_CLASS = {
  barbare: 'Voie du Berserker',
  barde: 'Collège du Savoir',
  clerc: 'Domaine de la Vie',
  druide: 'Cercle de la Terre',
  ensorceleur: 'Sorcellerie draconique',
  guerrier: 'Champion',
  magicien: 'Évocateur',
  moine: 'Guerrier de la Main ouverte',
  paladin: 'Serment de Dévotion',
  rodeur: 'Chasseur',
  roublard: 'Voleur',
  occultiste: 'Patron fiélon',
};

// Aptitudes de sous-classe (résumés SRD 5.2). En 2024 toutes débloquent au
// niveau 3 ; les paliers suivants donnent les aptitudes principales.
const SUBCLASS_FEATURES_2024 = {
  'Voie du Berserker': [
    { level: 3, name: 'Frénésie', desc: 'Pendant ta Rage, ta première attaque réussie de chaque tour inflige des dégâts supplémentaires (dés croissants avec le niveau).' },
    { level: 6, name: 'Esprit hargneux', desc: 'Tu ne peux pas être charmé ni effrayé pendant ta Rage (ces états sont suspendus).' },
    { level: 10, name: 'Présence intimidante', desc: 'Action : effraie les créatures proches (JS Sagesse contre le DD de tes capacités).' },
    { level: 14, name: 'Représailles', desc: 'Réaction : quand une créature proche te blesse, attaque de mêlée contre elle.' },
  ],
  'Collège du Savoir': [
    { level: 3, name: 'Maîtrises supplémentaires', desc: 'Trois compétences au choix.' },
    { level: 3, name: 'Mots cinglants', desc: 'Réaction : dépense une Inspiration bardique pour réduire l’attaque, le test ou les dégâts d’une créature.' },
    { level: 6, name: 'Secrets magiques', desc: 'Apprends des sorts de n’importe quelle classe, comptés comme sorts de barde.' },
    { level: 14, name: 'Talent suprême', desc: 'Dépense une Inspiration bardique pour améliorer un test de caractéristique après l’avoir vu.' },
  ],
  'Domaine de la Vie': [
    { level: 3, name: 'Sorts de domaine & armures lourdes', desc: 'Sorts de domaine toujours préparés et maîtrise des armures lourdes.' },
    { level: 3, name: 'Disciple de la vie', desc: 'Tes sorts de soin rendent +2 + le niveau du sort.' },
    { level: 6, name: 'Guérisseur béni', desc: 'Tes sorts de soin lancés sur autrui te soignent aussi.' },
    { level: 17, name: 'Guérison suprême', desc: 'Tes dés de soin sont considérés comme donnant leur maximum.' },
  ],
  'Cercle de la Terre': [
    { level: 3, name: 'Sorts de cercle', desc: 'Sorts bonus selon le terrain choisi, toujours préparés.' },
    { level: 3, name: 'Aide de la terre', desc: 'Magie naturelle utilitaire/défensive liée à ton terrain.' },
    { level: 6, name: 'Récupération naturelle', desc: 'Au repos court, récupère des emplacements de sorts (jusqu’à ≈ ½ niveau).' },
    { level: 10, name: 'Garde de la nature', desc: 'Immunité poison/maladie ; les fées et élémentaires ne te charment ni t’effraient.' },
    { level: 14, name: 'Sanctuaire de la nature', desc: 'Action : empêche une créature de t’attaquer (JS Sagesse).' },
  ],
  'Sorcellerie draconique': [
    { level: 3, name: 'Résilience draconique', desc: 'Choisis un dragon (type de dégâts) ; +1 PV par niveau et, sans armure, CA = 10 + DEX + CHA.' },
    { level: 6, name: 'Affinité élémentaire', desc: 'Ajoute ton mod. CHA aux dégâts du type de ton dragon ; dépense un point de sorcellerie pour une résistance temporaire.' },
    { level: 14, name: 'Ailes de dragon', desc: 'Fais pousser des ailes : vitesse de vol égale à ta vitesse au sol.' },
    { level: 18, name: 'Présence draconique', desc: 'Aura d’effroi ou de fascination sur les créatures proches (JS Sagesse).' },
  ],
  Champion: [
    { level: 3, name: 'Critique amélioré', desc: 'Tes attaques d’arme font un critique sur un jet de 19-20.' },
    { level: 3, name: 'Athlète remarquable', desc: 'Avantage à l’initiative et aux tests de FOR (Athlétisme) ; petites prouesses athlétiques.' },
    { level: 7, name: 'Style de combat supplémentaire', desc: 'Un second style de combat au choix.' },
    { level: 15, name: 'Critique supérieur', desc: 'Tes attaques d’arme font un critique sur un jet de 18-20.' },
    { level: 18, name: 'Survivant', desc: 'Regagne des PV à chaque tour tant que tu es au-dessus de la moitié de tes PV.' },
  ],
  'Évocateur': [
    { level: 3, name: 'Sculpteur de sorts', desc: 'Tes alliés pris dans tes sorts d’évocation réussissent automatiquement leur JS et ne subissent aucun dégât.' },
    { level: 6, name: 'Tour de magie surpuissant', desc: 'Tes tours de magie offensifs infligent au moins leurs dégâts minimaux en cas d’échec/JS réussi.' },
    { level: 10, name: 'Évocation renforcée', desc: 'Ajoute ton mod. INT aux dégâts d’un sort d’évocation par tour.' },
    { level: 14, name: 'Surcharge', desc: 'Un sort de niveau ≤ 5 inflige ses dégâts maximaux (puis dégâts en retour aux usages suivants).' },
  ],
  'Guerrier de la Main ouverte': [
    { level: 3, name: 'Technique de la Main ouverte', desc: 'Selon ta Rafale de coups : fais tomber, repousse, ou prive de réaction la cible.' },
    { level: 6, name: 'Plénitude corporelle', desc: 'Action : soigne-toi d’un montant lié à ton niveau (1/repos long).' },
    { level: 11, name: 'Tranquillité', desc: 'À la fin d’un repos long, bénéficie d’un effet proche de Sanctuaire.' },
    { level: 17, name: 'Paume vibratoire', desc: 'Pose une vibration mortelle déclenchable plus tard (JS Constitution).' },
  ],
  'Serment de Dévotion': [
    { level: 3, name: 'Sorts de serment', desc: 'Sorts bonus toujours préparés.' },
    { level: 3, name: 'Arme sacrée', desc: 'Conduit divin : ton arme gagne +mod. CHA aux attaques et émet de la lumière.' },
    { level: 7, name: 'Aura de dévotion', desc: 'Toi et tes alliés proches êtes immunisés contre l’état charmé.' },
    { level: 15, name: 'Pourfendeur protecteur', desc: 'Réaction défensive liée à ton Châtiment divin pour protéger un allié.' },
    { level: 20, name: 'Halo sacré', desc: 'Action : aura de lumière sacrée renforçant tes attaques et JS (1/repos long).' },
  ],
  Chasseur: [
    { level: 3, name: 'Proie du chasseur', desc: 'Choisis une spécialité offensive (ex. Tueur de colosses, Briseur de hordes).' },
    { level: 7, name: 'Tactiques de défense', desc: 'Choisis une option défensive contre les ennemis nombreux ou puissants.' },
    { level: 11, name: 'Multiattaque', desc: 'Frappe plusieurs cibles (volée) ou une seule plus fort, une fois par tour.' },
    { level: 15, name: 'Défense supérieure du chasseur', desc: 'Réaction défensive renforcée pour encaisser les coups.' },
  ],
  Voleur: [
    { level: 3, name: 'Mains prestes', desc: 'Utilise ta Ruse (action bonus) pour manier des outils ou utiliser un objet.' },
    { level: 3, name: 'Travail en hauteur', desc: 'Escalade sans surcoût de déplacement ; meilleur saut.' },
    { level: 9, name: 'Discrétion suprême', desc: 'Avantage à la Discrétion si tu ne te déplaces pas trop vite ce tour.' },
    { level: 13, name: 'Usage d’objets magiques', desc: 'Ignore les conditions de classe/race/niveau pour utiliser les objets magiques.' },
    { level: 17, name: 'Réflexes du voleur', desc: 'Deux tours au premier round de combat (un normal, un à l’initiative −10).' },
  ],
  'Patron fiélon': [
    { level: 3, name: 'Bénédiction du Sombre', desc: 'Quand tu réduis un ennemi à 0 PV, gagne des PV temporaires (CHA + niveau d’occultiste).' },
    { level: 6, name: 'Chance du Sombre', desc: 'Ajoute un d10 à un test ou un JS raté (1/repos court ou long).' },
    { level: 10, name: 'Résistance fiélonne', desc: 'Choisis une résistance à un type de dégâts (modifiable à chaque repos).' },
    { level: 14, name: 'Projeté en enfer', desc: 'Action : projette une créature à travers les Enfers (dégâts psychiques élevés, JS pour annuler).' },
  ],
};

// Classes 2024 : aptitudes de niveau 1 version 2024, sous-classe unique au niveau 3.
const CLASSES_2024_FR = CLASSES_5E.map((c) => ({
  ...c,
  features: CLASS_FEATURES_2024[c.key] || [],
  subclasses: SUBCLASS_BY_CLASS[c.key] ? [SUBCLASS_BY_CLASS[c.key]] : [],
}));

const SUBCLASSES_2024_FR = Object.fromEntries(
  Object.entries(SUBCLASS_BY_CLASS).map(([classKey, label]) => [
    label,
    { key: subSlug(label), classKey, features: SUBCLASS_FEATURES_2024[label] || [] },
  ])
);


/* PHB2024-EXTRA — roster PHB 2024 complet : sous-classes au-delà de l'échantillon SRD 5.2.
 * Contenu paraphrasé (mécaniques 2024), généré puis vérifié. */
const _PHB2024_SUB = {
  "Voie du Cœur sauvage": {"key":"voie-du-c-ur-sauvage","classKey":"barbare","features":[{"level":3,"name":"Orateur animal","desc":"Tu peux lancer Perception bestiale et Communication avec les animaux, mais uniquement sous forme de rituels."},{"level":3,"name":"Rage du prédateur","desc":"Quand tu entres en Rage, choisis un esprit : Ours (Résistance à presque tous les types de dégâts), Aigle (Désengagement et Foncer en action bonus) ou Loup (tes alliés ont l'avantage contre les ennemis à 1,50 m de toi)."},{"level":6,"name":"Aspect de la faune","desc":"Tu gagnes un don animal persistant, utilitaire hors combat (Hibou : vision dans le noir ; Panthère : vitesse d'escalade ; Saumon : vitesse de nage), modifiable à chaque repos long."},{"level":10,"name":"Orateur de la nature","desc":"Tu peux lancer Communication avec la nature, mais uniquement sous forme de rituel (Sagesse comme caractéristique d'incantation)."},{"level":14,"name":"Pouvoir du prédateur","desc":"Quand tu entres en Rage, choisis un pouvoir : Faucon (vitesse de vol sans armure), Lion (les ennemis adjacents ont un désavantage pour attaquer un autre que toi) ou Bélier (tu peux mettre À terre une cible Grande ou plus petite que tu touches en mêlée)."}]},
  "Voie de l'Arbre-Monde": {"key":"voie-de-l-arbre-monde","classKey":"barbare","features":[{"level":3,"name":"Vitalité de l'arbre","desc":"Quand tu entres en Rage, tu gagnes des PV temporaires égaux à ton niveau de barbare, et au début de chacun de tes tours en Rage tu peux donner des PV temporaires à une créature à 3 m de toi."},{"level":6,"name":"Branches de l'Arbre","desc":"En Rage, par une réaction, des branches spectrales saisissent une créature dans un rayon de 9 m et la téléportent dans un espace libre à 1,50 m de toi."},{"level":10,"name":"Racines fracassantes","desc":"L'allonge de tes armes de mêlée Lourdes et Polyvalentes augmente de 3 m pendant ton tour, et tu peux y appliquer les propriétés de maîtrise Bourrade ou Renversement."},{"level":14,"name":"Voyage par l'arbre","desc":"En Rage, tu peux te téléporter de 18 m à chacun de tes tours, et une fois par Rage tu peux étendre la portée et emmener jusqu'à six créatures consentantes avec toi."}]},
  "Voie du Zélateur": {"key":"voie-du-zelateur","classKey":"barbare","features":[{"level":3,"name":"Fureur divine","desc":"En Rage, la première créature que tu touches à chaque tour subit des dégâts supplémentaires égaux à 1d6 + la moitié de ton niveau de barbare, nécrotiques ou radiants au choix."},{"level":3,"name":"Guerrier des dieux","desc":"Tu disposes d'une réserve de d12 que tu peux dépenser par une action bonus pour te soigner ; elle se reconstitue au repos long et grandit avec ton niveau."},{"level":6,"name":"Concentration fanatique","desc":"Une fois par Rage, si tu rates un jet de sauvegarde, tu peux le relancer avec un bonus égal à ton bonus de dégâts de Rage et garder le nouveau résultat."},{"level":10,"name":"Présence zélée","desc":"Par une action bonus, jusqu'à dix créatures de ton choix à 18 m gagnent l'avantage aux jets d'attaque et de sauvegarde jusqu'au début de ton prochain tour (1/repos long, récupérable en dépensant une Rage)."},{"level":14,"name":"Rage des dieux","desc":"En entrant en Rage, tu prends une forme de guerrier divin (vitesse de vol et résistances) et tu peux dépenser une Rage pour t'empêcher, toi ou un allié, de tomber à 0 PV."}]},
  "Collège de la Danse": {"key":"college-de-la-danse","classKey":"barde","features":[{"level":3,"name":"Pirouettes éblouissantes","desc":"Sans armure ni bouclier, ta CA = 10 + DEX + CHA, tes attaques à mains nues infligent ton dé d'Inspiration bardique + DEX (sans le dépenser) et tu as l'avantage aux tests de Représentation liés à la danse."},{"level":6,"name":"Déplacement exaltant","desc":"Quand un ennemi visible finit son tour à 1,50 m de toi, dépense une Inspiration bardique en réaction pour te déplacer de la moitié de ta vitesse et faire de même pour un allié proche, sans provoquer d'attaque d'opportunité."},{"level":6,"name":"Pirouettes coordonnées","desc":"Quand tu fais ton jet d'initiative en n'étant pas neutralisé, lance et ajoute un dé d'Inspiration bardique à ton initiative et à celle de chaque allié à 9 m qui te voit ou t'entend."},{"level":14,"name":"Évasion meneuse","desc":"Quand tu réussis un JS de Dextérité pour subir la moitié des dégâts, tu n'en subis aucun (et la moitié en cas d'échec), et tu peux partager ce bénéfice avec les créatures à 1,50 m soumises au même jet."}]},
  "Collège de la Séduction": {"key":"college-de-la-seduction","classKey":"barde","features":[{"level":3,"name":"Magie envoûtante","desc":"Tu as toujours Charme-personne et Image miroir préparés et, après avoir lancé un sort d'Enchantement ou d'Illusion, tu peux contraindre une créature proche à un JS de Sagesse sous peine d'être charmée ou effrayée par toi."},{"level":3,"name":"Mante d'inspiration","desc":"Action bonus : dépense une Inspiration bardique pour donner à plusieurs alliés proches des PV temporaires égaux à deux fois le dé lancé, chacun pouvant aussitôt se déplacer en réaction sans provoquer d'attaque d'opportunité."},{"level":6,"name":"Mante de majesté","desc":"Action bonus : pendant 1 minute, lance Injonction sans emplacement puis à chaque tour suivant en action bonus ; toute créature que tu as charmée rate automatiquement son JS."},{"level":14,"name":"Majesté inébranlable","desc":"Action bonus : pendant 1 minute, la première fois qu'une créature te touche à chaque tour, elle doit réussir un JS de Charisme ou son attaque échoue."}]},
  "Collège de la Vaillance": {"key":"college-de-la-vaillance","classKey":"barde","features":[{"level":3,"name":"Formation martiale","desc":"Tu gagnes la maîtrise des armes de guerre, l'entraînement aux armures intermédiaires et aux boucliers, et tu peux utiliser une arme courante ou de guerre comme focaliseur d'incantation."},{"level":3,"name":"Inspiration martiale","desc":"Une créature ayant ton Inspiration bardique peut, après avoir touché, ajouter le dé à ses dégâts, ou bien, en réaction quand elle est touchée, l'ajouter à sa CA contre cette attaque."},{"level":6,"name":"Attaque supplémentaire","desc":"Tu peux attaquer deux fois au lieu d'une chaque fois que tu entreprends l'action Attaquer à ton tour."},{"level":14,"name":"Magie de combat","desc":"Après avoir lancé un sort dont le temps d'incantation est d'une action, tu peux faire une attaque d'arme en action bonus."}]},
  "Domaine de la Lumière": {"key":"domaine-de-la-lumiere","classKey":"clerc","features":[{"level":3,"name":"Sorts de domaine de la Lumière","desc":"Tu prépares en permanence les sorts du domaine et tu connais le tour de magie Lumière s'il te manquait."},{"level":3,"name":"Flamboiement protecteur","desc":"Réaction (PB fois/repos long) : tu imposes le Désavantage au jet d'attaque d'une créature proche que tu vois."},{"level":6,"name":"Éclat de l'aube","desc":"Conduit divin, action : une lumière jaillit autour de toi et inflige des dégâts radiants aux ennemis proches (jet de Constitution pour moitié)."},{"level":17,"name":"Couronne de lumière","desc":"Action bonus : pendant 10 min, une lumière t'entoure et impose le Désavantage aux ennemis exposés contre tes sorts infligeant des dégâts de feu ou radiants."}]},
  "Domaine de la Tromperie": {"key":"domaine-de-la-tromperie","classKey":"clerc","features":[{"level":3,"name":"Sorts de domaine de la Tromperie","desc":"Tu prépares en permanence les sorts du domaine de la Tromperie."},{"level":3,"name":"Bénédiction du fourbe","desc":"Action bonus : tu accordes à toi-même ou à un allié proche l'Avantage aux tests de Discrétion pendant 1 heure."},{"level":3,"name":"Invocation du double","desc":"Conduit divin, action bonus : tu crées pour 1 min un double illusoire de toi que tu peux déplacer et à travers lequel lancer tes sorts."},{"level":6,"name":"Transposition du fourbe","desc":"Dans le cadre de l'action bonus qui déplace ton double, tu peux échanger ta place avec lui."},{"level":17,"name":"Dédoublement amélioré","desc":"Ton Invocation du double crée jusqu'à quatre doubles à la fois, et tu peux te transposer avec n'importe lequel d'entre eux."}]},
  "Domaine de la Guerre": {"key":"domaine-de-la-guerre","classKey":"clerc","features":[{"level":3,"name":"Sorts de domaine de la Guerre","desc":"Tu prépares en permanence les sorts du domaine et tu obtiens la maîtrise des armes de guerre et des armures lourdes."},{"level":3,"name":"Prêtre de guerre","desc":"Action bonus (PB fois/repos long) : tu effectues une attaque d'arme supplémentaire."},{"level":6,"name":"Bénédiction du dieu de la Guerre","desc":"Conduit divin, réaction : tu ajoutes +10 au jet d'attaque d'une créature proche que tu vois, le tien ou celui d'un allié."},{"level":17,"name":"Avatar de bataille","desc":"Tu obtiens la Résistance aux dégâts contondants, perforants et tranchants infligés par des attaques non magiques."}]},
  "Cercle de la Lune": {"key":"cercle-de-la-lune","classKey":"druide","features":[{"level":3,"name":"Forme du cercle","desc":"En Forme sauvage, tu adoptes une CA minimale (13 + ton mod. de Sagesse), gagnes des PV temporaires (3 fois ton niveau) et peux prendre une bête de FP plus élevé."},{"level":3,"name":"Sorts du Cercle de la Lune","desc":"Sorts bonus toujours préparés (Soins, Rayon de lune, Lueur stellaire…), que tu peux lancer même en Forme sauvage."},{"level":6,"name":"Formes du cercle améliorées","desc":"Tes attaques de Forme sauvage infligent des dégâts radiants supplémentaires et tu ajoutes ton mod. de Sagesse à tes jets de sauvegarde de Constitution."},{"level":10,"name":"Foulée sélène","desc":"Par action bonus, tu te téléportes jusqu'à 9 mètres et gagnes l'avantage à ta prochaine attaque ce tour-ci (usages liés à ton mod. de Sagesse)."},{"level":14,"name":"Forme lunaire","desc":"Une fois par tour, tu infliges 2d10 dégâts radiants supplémentaires avec une attaque de Forme sauvage, et ta Foulée sélène peut aussi téléporter un allié proche."}]},
  "Cercle des Mers": {"key":"cercle-des-mers","classKey":"druide","features":[{"level":3,"name":"Courroux des mers","desc":"En dépensant une Forme sauvage, tu déclenches une émanation marine de 1,5 m : à chaque tour, frappe une créature proche pour des dégâts de froid ou de foudre et la repousse."},{"level":3,"name":"Sorts du Cercle des Mers","desc":"Sorts bonus toujours préparés liés à l'eau et au vent (Nappe de brouillard, Rafale de vent, Vague tonitruante, Cône de froid…)."},{"level":6,"name":"Affinité aquatique","desc":"Le rayon de ton émanation passe à 3 mètres et tu gagnes une vitesse de nage égale à ta vitesse de déplacement."},{"level":10,"name":"Enfant des tempêtes","desc":"Tant que ton Courroux des mers est actif, tu gagnes une vitesse de vol et la résistance aux dégâts de froid, de foudre et de tonnerre."},{"level":14,"name":"Don océanique","desc":"Tu peux faire apparaître ton émanation autour d'une créature consentante à moins de 18 mètres, qui en reçoit tous les bienfaits avec ton DD de sauvegarde et ta Sagesse."}]},
  "Cercle des Astres": {"key":"cercle-des-astres","classKey":"druide","features":[{"level":3,"name":"Carte du ciel","desc":"Tu crées une carte céleste servant de focaliseur ; tant que tu la tiens, Assistance et Rayon guidé sont préparés et tu peux lancer Rayon guidé sans emplacement (usages liés à ta Sagesse)."},{"level":3,"name":"Forme étoilée","desc":"En dépensant une Forme sauvage, tu adoptes une constellation : Archer (attaque à distance radiante), Calice (soins) ou Dragon (concentration et jets d'Intelligence/Sagesse fiabilisés)."},{"level":6,"name":"Présage cosmique","desc":"Après chaque repos long, lance un dé pour un présage d'augure favorable (ajoute 1d6) ou néfaste (retire 1d6) que tu dépenses sur des jets (usages liés à ta Sagesse)."},{"level":10,"name":"Constellations scintillantes","desc":"Les dégâts de l'Archer et du Calice passent de 1d8 à 2d8, le Dragon gagne une vitesse de vol avec vol stationnaire, et tu peux changer de constellation à chaque tour."},{"level":14,"name":"Plein d'étoiles","desc":"Tant que ta Forme étoilée est active, tu deviens partiellement incorporel et gagnes la résistance aux dégâts contondants, perforants et tranchants."}]},
  "Sorcellerie aberrante": {"key":"sorcellerie-aberrante","classKey":"ensorceleur","features":[{"level":3,"name":"Sorts psioniques","desc":"Tu disposes d'une liste de sorts psioniques toujours préparés qui s'enrichit en montant de niveau, sans compter dans tes sorts connus."},{"level":3,"name":"Discours télépathique","desc":"Action bonus : tu établis un lien télépathique avec une créature à 9 m pour une durée égale en minutes à ton mod. de Charisme."},{"level":6,"name":"Sorcellerie psionique","desc":"Tu peux lancer un de tes sorts psioniques en dépensant des points de sorcellerie égaux à son niveau, sans composante verbale, gestuelle ni matérielle non consommée."},{"level":6,"name":"Défenses psychiques","desc":"Tu gagnes la résistance aux dégâts psychiques et l'avantage aux jets de sauvegarde pour éviter ou mettre fin aux états Charmé et Effrayé."},{"level":14,"name":"Révélation dans la chair","desc":"Action bonus : tu dépenses des points de sorcellerie pour altérer ton corps pendant 10 min (vol, nage, voir l'invisible ou te faufiler)."},{"level":18,"name":"Implosion gauchissante","desc":"Action : tu te téléportes jusqu'à 36 m, puis attires les créatures vers ton point de départ en leur infligeant des dégâts de force (JS Force)."}]},
  "Sorcellerie mécanique": {"key":"sorcellerie-mecanique","classKey":"ensorceleur","features":[{"level":3,"name":"Sorts mécaniques","desc":"Tu disposes d'une liste de sorts mécaniques toujours préparés, liés à l'ordre du cosmos, qui ne comptent pas dans tes sorts connus."},{"level":3,"name":"Restauration de l'équilibre","desc":"Réaction : tu annules l'avantage ou le désavantage sur le d20 d'une créature à 18 m, un nombre de fois égal à ton mod. de Charisme par repos long."},{"level":6,"name":"Bastion de la Loi","desc":"Action bonus : tu dépenses de 1 à 5 points de sorcellerie pour donner à une créature autant de dés de protection d8 qui absorbent les dégâts subis."},{"level":14,"name":"Transe de l'ordre","desc":"Les attaques contre toi ne bénéficient pas de l'avantage, et tu peux traiter un d20 d'attaque, de test ou de sauvegarde de 9 ou moins comme un 10."},{"level":18,"name":"Cavalcade mécanique","desc":"Action : tu invoques des esprits d'ordre dans un cube de 9 m qui soignent les alliés, réparent les objets et mettent fin à un sort sur chaque créature choisie."}]},
  "Sorcellerie sauvage": {"key":"sorcellerie-sauvage","classKey":"ensorceleur","features":[{"level":3,"name":"Bouffée de Sorcellerie sauvage","desc":"Quand tu lances un sort d'au moins niveau 1, tu peux jeter un dé sur la table de Sorcellerie sauvage pour déclencher un effet magique aléatoire."},{"level":3,"name":"Marée du chaos","desc":"Tu obtiens l'avantage sur un jet d'attaque, de test ou de sauvegarde ; tu récupères cet usage en déclenchant une Sorcellerie sauvage."},{"level":6,"name":"Comme par hasard","desc":"Réaction : tu dépenses 1 point de sorcellerie pour ajouter ou retrancher 1d4 au jet d'attaque, de test ou de sauvegarde d'une créature."},{"level":14,"name":"Chaos contrôlé","desc":"Quand tu jettes un dé sur la table de Sorcellerie sauvage, tu lances deux fois et choisis lequel des deux effets s'applique."},{"level":18,"name":"Bouffée maîtrisée","desc":"Juste après avoir lancé un sort d'ensorceleur, tu peux choisir délibérément un effet de la table de Sorcellerie sauvage à déclencher (1/repos long)."}]},
  "Maître de guerre": {"key":"maitre-de-guerre","classKey":"guerrier","features":[{"level":3,"name":"Supériorité martiale","desc":"Tu apprends des manœuvres alimentées par des dés de supériorité (d8) que tu dépenses pour des effets tactiques, récupérés au repos."},{"level":3,"name":"Étudiant de la guerre","desc":"Tu gagnes la maîtrise d'un type d'outils d'artisan et d'une compétence au choix."},{"level":7,"name":"Connais ton ennemi","desc":"Par une action bonus, tu discernes les immunités, résistances et vulnérabilités d'une créature que tu vois à courte portée."},{"level":10,"name":"Supériorité martiale améliorée","desc":"Tes dés de supériorité passent au d10 et tu en gagnes un de plus."},{"level":15,"name":"Acharnement","desc":"Quand tu fais un jet d'initiative sans dé de supériorité, tu en récupères un (d8)."}]},
  "Chevalier occulte": {"key":"chevalier-occulte","classKey":"guerrier","features":[{"level":3,"name":"Incantation","desc":"Tu lances des sorts de magicien (axés Abjuration/Évocation), avec l'Intelligence comme caractéristique d'incantation."},{"level":3,"name":"Lien d'arme","desc":"Par un rituel, tu lies jusqu'à deux armes à toi et peux en invoquer une en main par une action bonus."},{"level":7,"name":"Magie de guerre","desc":"Lors de l'action Attaque, tu peux remplacer une de tes attaques par un sortilège."},{"level":10,"name":"Frappe occulte","desc":"Quand tu touches une créature avec une arme, elle subit un désavantage à son prochain JS contre un de tes sorts avant la fin de ton tour suivant."},{"level":15,"name":"Charge magique","desc":"Quand tu utilises Fougue, tu peux te téléporter jusqu'à 9 mètres dans un espace libre visible."}]},
  "Guerrier psi": {"key":"guerrier-psi","classKey":"guerrier","features":[{"level":3,"name":"Pouvoir psionique","desc":"Tu disposes de dés d'énergie psionique (à partir du d6) qui alimentent tes prouesses télékinétiques."},{"level":3,"name":"Champ de protection","desc":"En réaction, dépense un dé psionique pour réduire les dégâts subis par toi ou une créature proche."},{"level":3,"name":"Frappe psionique","desc":"Une fois par tour, ajoute un dé psionique en dégâts de force à une attaque qui touche."},{"level":3,"name":"Mouvement télékinétique","desc":"Par une action bonus, déplace par télékinésie toi-même ou une créature/un objet proche (gratuit une fois par repos)."},{"level":7,"name":"Adepte télékinétique","desc":"Tu obtiens un bond psionique (vol bref) et une poussée télékinétique qui renverse ou déplace la cible de ta Frappe psionique."},{"level":10,"name":"Esprit gardé","desc":"Tu gagnes la résistance aux dégâts psychiques et peux dépenser un dé psionique pour mettre fin à l'état Effrayé ou Charmé sur toi."},{"level":15,"name":"Rempart de force","desc":"Par une action bonus, tu accordes un abri partiel à toi-même et à des alliés proches pendant une minute (gratuit une fois par repos long, sinon un dé psionique)."}]},
  "Abjurateur": {"key":"abjurateur","classKey":"magicien","features":[{"level":3,"name":"Initié de l'abjuration","desc":"Tu copies les sorts d'abjuration dans ton grimoire pour la moitié du temps et du coût habituels."},{"level":3,"name":"Gardien arcanique","desc":"En lançant un sort d'abjuration de niveau 1+, tu dresses un gardien de PV (2× niveau du sort + ton mod. INT) qui encaisse les dégâts que tu subis et se recharge à chaque nouvelle abjuration."},{"level":6,"name":"Projection du gardien","desc":"Réaction : quand une créature à 30 pieds ou moins subit des dégâts, dépense des PV de ton gardien arcanique pour les absorber à sa place."},{"level":10,"name":"Briseur de sorts","desc":"Tu as toujours Contresort et Dissipation de la magie préparés, et lancer l'un d'eux recharge ton gardien arcanique d'un montant égal au niveau de l'emplacement dépensé."},{"level":14,"name":"Résistance aux sorts","desc":"Tu as l'avantage aux jets de sauvegarde contre les sorts et la résistance aux dégâts qu'ils infligent."}]},
  "Devin": {"key":"devin","classKey":"magicien","features":[{"level":3,"name":"Initié de la divination","desc":"Tu copies les sorts de divination dans ton grimoire pour la moitié du temps et du coût habituels."},{"level":3,"name":"Présage","desc":"Après un repos long, lance deux d20 et conserve-les ; tu peux remplacer un jet d'attaque, de sauvegarde ou de caractéristique de n'importe quelle créature par un dé réservé."},{"level":6,"name":"Divination experte","desc":"Lancer un sort de divination de niveau 2+ te fait récupérer un emplacement de sort dépensé d'un niveau inférieur (max niveau 5)."},{"level":10,"name":"Le troisième œil","desc":"Action bonus : gagne jusqu'à ton prochain repos l'un de ces atouts — vision dans le noir, lire toute langue écrite, ou voir les créatures et objets invisibles à 10 pieds."},{"level":14,"name":"Présage supérieur","desc":"Ton Présage te fait désormais lancer et conserver trois d20 après un repos long."}]},
  "Illusionniste": {"key":"illusionniste","classKey":"magicien","features":[{"level":3,"name":"Initié de l'illusion","desc":"Tu copies les sorts d'illusion dans ton grimoire pour la moitié du temps et du coût habituels, et tu connais le tour de magie Illusion mineure (qui crée son et image à la fois)."},{"level":3,"name":"Illusions améliorées","desc":"Tes sorts d'illusion d'une durée d'au moins 1 minute n'exigent plus de composante verbale, et tu peux lancer Illusion mineure en action bonus."},{"level":6,"name":"Créatures fantasmagoriques","desc":"En lançant un sort d'illusion qui crée une image, tu peux lui faire prendre la forme d'une créature illusoire qui peut se déplacer et agir comme tu l'ordonnes."},{"level":10,"name":"Soi illusoire","desc":"Réaction : quand une créature te touche par une attaque, interpose un double illusoire pour que l'attaque rate à la place (récup. à un repos court ou long)."},{"level":14,"name":"Réalité illusoire","desc":"Pendant que tu te concentres sur un sort d'illusion, action bonus : rends physiquement réel un objet inanimé non magique de l'illusion pendant 1 minute."}]},
  "Credo des Éléments": {"key":"credo-des-elements","classKey":"moine","features":[{"level":3,"name":"Lien élémentaire","desc":"Dépense 1 point de Credo : pendant 10 min, tes attaques à mains nues gagnent 1,50 m d'allonge et peuvent infliger acide, froid, feu, foudre ou tonnerre."},{"level":3,"name":"Manipulation des éléments","desc":"Tant que Lien élémentaire est actif, tu peux déplacer une cible touchée de 3 m (vers toi ou loin de toi) avec une attaque à mains nues."},{"level":6,"name":"Décharge élémentaire","desc":"À la place d'une attaque, dépense 1 point de Credo pour projeter une explosion élémentaire de 6 m de rayon infligeant des dégâts élémentaires (JS de Dextérité, moitié si réussi)."},{"level":11,"name":"Foulée des éléments","desc":"Tant que Lien élémentaire est actif, tu gagnes une vitesse de vol et de nage égale à ta vitesse au sol."},{"level":17,"name":"Épitomé des éléments","desc":"Tant que Lien élémentaire est actif : résistance à un type de dégâts élémentaires (modifiable à chaque tour), Souffle du vent renforcé, et +1 dé d'Arts martiaux à une attaque à mains nues par tour."}]},
  "Credo de la Miséricorde": {"key":"credo-de-la-misericorde","classKey":"moine","features":[{"level":3,"name":"Main de soin et Main de souffrance","desc":"Dépense 1 point de Credo : Main de soin rend (dé d'Arts martiaux + mod. SAG) PV ; Main de souffrance ajoute des dégâts nécrotiques à une attaque à mains nues (1/tour)."},{"level":3,"name":"Instruments de miséricorde","desc":"Tu gagnes la maîtrise des compétences Intuition et Médecine ainsi que celle du nécessaire d'herboriste."},{"level":6,"name":"Toucher du médecin","desc":"Sans coût supplémentaire : Main de soin met aussi fin à un état (aveuglé, assourdi, paralysé, empoisonné, étourdi) ; Main de souffrance impose aussi l'état empoisonné."},{"level":11,"name":"Déluge de soin et de souffrance","desc":"Pendant ta Déferlante de coups, remplace tes attaques par Main de soin et déclenche Main de souffrance sans dépenser de Credo (usages = mod. SAG, regagnés au repos long)."},{"level":17,"name":"Main de la miséricorde suprême","desc":"Dépense 5 points de Credo pour ramener à la vie une créature morte depuis moins de 24 h (4d10 + mod. SAG PV) et la libérer des états listés (1/repos long)."}]},
  "Credo de l'Ombre": {"key":"credo-de-l-ombre","classKey":"moine","features":[{"level":3,"name":"Artiste des ombres","desc":"Tu connais le tour de magie Illusion mineure (lancé avec la Sagesse) et peux dépenser 1 point de Credo pour lancer Ténèbres, que tu vois à travers et peux déplacer."},{"level":6,"name":"Foulée d'ombre","desc":"Dans la pénombre ou l'obscurité, en action bonus : téléporte-toi jusqu'à 18 m vers un autre lieu sombre et gagne l'avantage à ta prochaine attaque à mains nues ce tour."},{"level":11,"name":"Foulée d'ombre améliorée","desc":"Quand tu utilises Foulée d'ombre, tu peux immédiatement effectuer une attaque à mains nues gratuite."},{"level":17,"name":"Cape d'ombres","desc":"Dans la pénombre ou l'obscurité, action : deviens Invisible jusqu'à la fin de ton prochain tour ou jusqu'à ce que tu attaques, lances un sort ou quittes l'obscurité."}]},
  "Serment des Anciens": {"key":"serment-des-anciens","classKey":"paladin","features":[{"level":3,"name":"Sorts de serment","desc":"Tu as toujours préparés les sorts du serment des Anciens (Enchevêtrement, Châtiment courroucé, puis Modération des éléments, Protection contre le poison, et d'autres aux niveaux supérieurs)."},{"level":3,"name":"Conjuration : courroux de la nature","desc":"Par une action bonus, tu fais surgir des lianes spectrales qui entravent une créature proche tant qu'elle rate son jet de sauvegarde de Force répété à chacun de ses tours."},{"level":7,"name":"Aura de protection","desc":"Toi et tes alliés dans ton aura avez la résistance aux dégâts nécrotiques, psychiques et radiants."},{"level":15,"name":"Sentinelle impérissable","desc":"Quand tu tombes à 0 point de vie sans être tué net, tu chutes à 1 point de vie à la place ; une fois par repos long, et tu ne vieillis plus magiquement."},{"level":20,"name":"Champion vénérable","desc":"Par une action bonus, pendant 1 minute, tu récupères des points de vie à chaque tour, tu lances tes sorts de Paladin plus vite et les ennemis proches subissent un désavantage aux jets de sauvegarde contre tes sorts et Conjurations."}]},
  "Serment de Gloire": {"key":"serment-de-gloire","classKey":"paladin","features":[{"level":3,"name":"Sorts de serment","desc":"Tu as toujours préparés les sorts du serment de Gloire (Grâce féline, Héroïsme, puis Hâte, Arme magique, et d'autres aux niveaux supérieurs)."},{"level":3,"name":"Conjuration : athlète d'exception","desc":"Par une action bonus, pendant 10 minutes, tu as l'avantage aux tests de Force et de Dextérité, ta distance de saut augmente et te relever ne coûte que 1,50 mètre de déplacement."},{"level":3,"name":"Conjuration : châtiment exaltant","desc":"Après avoir touché une créature au corps à corps, tu peux répartir des points de vie temporaires égaux à 2d8 + ton niveau de Paladin entre les créatures de ton choix proches de toi."},{"level":7,"name":"Aura d'alacrité","desc":"Ta vitesse de marche augmente de 3 mètres et tout allié qui débute son tour dans ton aura gagne un bonus de vitesse jusqu'au début de son prochain tour."},{"level":15,"name":"Défense glorieuse","desc":"Par une réaction, quand toi ou une créature proche êtes touchés par une attaque, tu ajoutes ton modificateur de Charisme à la CA contre cette attaque, et si elle rate alors tu peux riposter par une attaque d'arme."},{"level":20,"name":"Légende vivante","desc":"Par une action bonus, pendant 1 minute, tu charmes les ennemis qui t'entendent et ratent un jet, tes attaques au corps à corps ratées touchent quand même, et tu peux relancer un jet de sauvegarde raté une fois par tour."}]},
  "Serment de Vengeance": {"key":"serment-de-vengeance","classKey":"paladin","features":[{"level":3,"name":"Sorts de serment","desc":"Tu as toujours préparés les sorts du serment de Vengeance (Marque du chasseur, Détérioration, puis Hâte, Immobilisation de personne, et d'autres aux niveaux supérieurs)."},{"level":3,"name":"Conjuration : vœu d'inimitié","desc":"Par une action bonus, tu désignes une créature proche et tu as l'avantage à tes jets d'attaque contre elle pendant 1 minute ou jusqu'à ce qu'elle tombe à 0 point de vie."},{"level":7,"name":"Implacable vengeur","desc":"Quand ton attaque d'opportunité touche une créature, tu peux te déplacer aussitôt jusqu'à la moitié de ta vitesse sans provoquer d'attaques d'opportunité."},{"level":15,"name":"Âme de vengeance","desc":"Par une réaction, quand une créature soumise à ton vœu d'inimitié effectue une attaque, tu peux faire une attaque au corps à corps contre elle."},{"level":20,"name":"Ange vengeur","desc":"Par une action bonus, pendant 10 minutes, des ailes te confèrent une vitesse de vol et tu émets une aura qui terrifie les ennemis débutant leur tour à proximité."}]},
  "Belluaire": {"key":"belluaire","classKey":"rodeur","features":[{"level":3,"name":"Compagnon primitif","desc":"Tu invoques une bête primitive (Terrestre, Marine ou Aérienne) qui agit à ton initiative et peut Attaquer quand tu entreprends l'action Attaquer."},{"level":7,"name":"Coordination facilitée","desc":"Par action bonus tu ordonnes à ta bête d'entreprendre l'Esquive, et ses attaques infligent désormais des dégâts de Force."},{"level":11,"name":"Fureur bestiale","desc":"Ta bête porte deux attaques quand tu lui ordonnes d'Attaquer, et inflige 2d6 dégâts de Force à une cible de ton Marquage du chasseur."},{"level":15,"name":"Partage de sorts","desc":"Un sort que tu lances en te ciblant peut aussi cibler ta bête primitive si elle se trouve à 9 mètres ou moins de toi."}]},
  "Vagabond féerique": {"key":"vagabond-feerique","classKey":"rodeur","features":[{"level":3,"name":"Frappes terrifiantes","desc":"Quand tu touches une créature avec une arme, tu peux lui infliger 1d4 dégâts psychiques supplémentaires une fois par tour (1d6 au niveau 11)."},{"level":3,"name":"Charme de l'Autre-Monde","desc":"Tu maîtrises une compétence de Charisme et tu ajoutes ton modificateur de Sagesse à tes tests de Charisme (minimum +1)."},{"level":3,"name":"Sorts de Vagabond féerique","desc":"Tu as toujours préparés des sorts féeriques (charme-personne, pas brumeux, etc.) qui ne comptent pas dans ta limite de sorts préparés."},{"level":7,"name":"Tour enjôleur","desc":"Quand tu lances un sort d'enchantement, tu peux faire ricocher l'effet d'une cible vers une autre créature proche."},{"level":11,"name":"Renforts féeriques","desc":"Tu peux lancer convocation de fées sans composante matérielle, et une fois sans emplacement de sort par repos long."},{"level":15,"name":"Vagabond brumeux","desc":"Tu peux lancer pas brumeux sans emplacement de sort un nombre de fois égal à ton modificateur de Sagesse par repos long."}]},
  "Traqueur des ténèbres": {"key":"traqueur-des-tenebres","classKey":"rodeur","features":[{"level":3,"name":"Embuscade effrayante","desc":"Tu ajoutes ton modificateur de Sagesse à l'initiative, gagnes +3 mètres de vitesse au 1er tour, et infliges 2d6 dégâts psychiques une fois par tour (Sag fois/repos long)."},{"level":3,"name":"Sorts de Traqueur des ténèbres","desc":"Tu as toujours préparés des sorts d'embuscade (déguisement, etc.) qui ne comptent pas dans ta limite de sorts préparés."},{"level":3,"name":"Vision ombreuse","desc":"Tu gagnes 18 mètres de vision dans le noir et tu es invisible aux créatures qui n'y voient que grâce à leur propre vision dans le noir."},{"level":7,"name":"Mental d'acier","desc":"Tu gagnes la maîtrise des jets de sauvegarde de Sagesse (ou d'Intelligence ou de Charisme si tu la possèdes déjà)."},{"level":11,"name":"Déluge du traqueur","desc":"Une fois par tour, quand tu rates une attaque d'arme, tu peux immédiatement porter une autre attaque d'arme dans la même action."},{"level":15,"name":"Esquive ombreuse","desc":"Par réaction, quand une créature t'attaque, tu lui imposes le Désavantage et tu te téléportes jusqu'à 9 mètres vers un emplacement libre."}]},
  "Arnaqueur arcanique": {"key":"arnaqueur-arcanique","classKey":"roublard","features":[{"level":3,"name":"Incantation","desc":"Tu apprends des sorts de magicien axés sur l'illusion et l'enchantement, que tu lances grâce à l'Intelligence."},{"level":3,"name":"Tour de Main du mage","desc":"Tu connais toujours Main du mage, peux la lancer de façon invisible et l'utiliser à distance pour des larcins comme crocheter une serrure ou faire les poches."},{"level":9,"name":"Embuscade magique","desc":"Quand une créature dont tu es caché doit faire un jet de sauvegarde contre l'un de tes sorts, elle le fait avec le Désavantage."},{"level":13,"name":"Filou polyvalent","desc":"Quand tu touches une créature avec Main du mage, tu peux dépenser des dés d'Attaque sournoise pour la faire chuter, la repousser ou lui imposer le Désavantage."},{"level":17,"name":"Voleur de sorts","desc":"En réaction, lorsque tu réussis un jet de sauvegarde contre un sort, tu l'annules et tu l'apprends, pouvant le lancer jusqu'à ton prochain repos long."}]},
  "Assassin": {"key":"assassin","classKey":"roublard","features":[{"level":3,"name":"Assassinat","desc":"Tu as l'Avantage aux attaques contre toute créature n'ayant pas encore agi ; lors de ton premier tour, tes coups infligent des dégâts bonus égaux à ton niveau de roublard, et toucher une créature surprise est un coup critique."},{"level":3,"name":"Outils d'assassin","desc":"Tu gagnes la maîtrise du kit d'empoisonneur et du kit de déguisement, et tu reçois des doses de poison gratuites lors de tes repos longs."},{"level":9,"name":"Expertise en infiltration","desc":"Tu peux te forger une fausse identité crédible et imiter à la perfection le discours, l'écriture et les manières d'une personne que tu as étudiée."},{"level":13,"name":"Empoisonnement d'armes","desc":"Quand tu enduis une arme de poison avec ton kit d'empoisonneur, sa DD de sauvegarde augmente et les dégâts de poison qu'elle inflige sont doublés."},{"level":17,"name":"Frappe fatale","desc":"Quand tu touches une créature surprise, elle doit réussir un jet de sauvegarde de Constitution (DD 8 + mod. Dextérité + bonus de maîtrise) sous peine de subir le double des dégâts de l'attaque."}]},
  "Lame psychique": {"key":"lame-psychique","classKey":"roublard","features":[{"level":3,"name":"Lames psychiques","desc":"Tu manifestes des lames d'énergie psychique pour attaquer au corps à corps ou à distance (dégâts psychiques), sans avoir besoin d'une arme matérielle."},{"level":3,"name":"Pouvoir psionique","desc":"Tu disposes de dés d'Énergie psionique qui alimentent des talents : renforcer un test de caractéristique (Astuce psi-renforcée) ou communiquer par télépathie (Murmures psychiques)."},{"level":9,"name":"Âmes de lames","desc":"Tes dés d'Énergie psionique deviennent plus nombreux et plus grands, et tu peux en dépenser pour ne pas rater une lame psychique (Frappe à tête chercheuse) ou pour te téléporter avec elle (Téléportation psychique)."},{"level":13,"name":"Voile psychique","desc":"Par une action Magie, tu deviens Invisible jusqu'à la fin de ton prochain tour, une fois par repos long ou en dépensant un dé d'Énergie psionique."},{"level":17,"name":"Déchirement mental","desc":"Quand tu infliges des dégâts d'Attaque sournoise avec une lame psychique, tu peux dépenser trois dés d'Énergie psionique pour Étourdir la cible (jet de Sagesse) jusqu'à la fin de ton prochain tour."}]},
  "Patron archifée": {"key":"patron-archifee","classKey":"occultiste","features":[{"level":3,"name":"Foulée des fées","desc":"Foulée brumeuse est toujours préparé et tu peux le lancer sans emplacement (CHA fois par repos long) ; à chaque téléportation, choisis d'octroyer des PV temporaires (1d10) ou d'imposer le Désavantage aux attaques contre d'autres près de ton point de départ."},{"level":6,"name":"Échappatoire brumeuse","desc":"Tu peux lancer Foulée brumeuse en réaction lorsque tu subis des dégâts, et tu débloques deux nouvelles options de Foulée des fées (te rendre Invisible jusqu'à ton prochain tour, ou infliger des dégâts psychiques aux créatures proches)."},{"level":10,"name":"Charmantes défenses","desc":"Tu deviens immunisé à l'état Charmé ; quand une attaque te touche, tu peux (réaction) réduire les dégâts de moitié et forcer l'attaquant à un JS de Sagesse, lui renvoyant ces dégâts en psychiques s'il échoue."},{"level":14,"name":"Magie ensorcelante","desc":"Après avoir lancé un sort d'Enchantement ou d'Illusion à l'aide d'une action et d'un emplacement, tu peux aussitôt lancer Foulée brumeuse dans le cadre de cette même action, sans dépenser d'emplacement."}]},
  "Patron céleste": {"key":"patron-celeste","classKey":"occultiste","features":[{"level":3,"name":"Lumière guérisseuse","desc":"Tu disposes d'une réserve de d6 (1 + ton niveau d'occultiste) que tu peux dépenser (action bonus) pour rendre des PV à toi-même ou à une créature proche, réserve rechargée au repos long."},{"level":6,"name":"Âme radiante","desc":"Tu gagnes la résistance aux dégâts radiants, et une fois par tour, lorsqu'un sort que tu lances inflige des dégâts de feu ou radiants, tu peux ajouter ton mod de Charisme à ces dégâts."},{"level":10,"name":"Résilience céleste","desc":"Quand tu utilises Ruse magique ou termines un repos, tu gagnes des PV temporaires (niveau d'occultiste + mod de Charisme) et tu peux en octroyer la moitié à plusieurs créatures proches."},{"level":14,"name":"Vengeance brûlante","desc":"Quand une créature visible (à 60 ft) va faire un JS contre la mort, tu peux la sauver : elle récupère la moitié de ses PV max et se relève, tandis que les ennemis proches subissent des dégâts radiants et sont Aveuglés (1/repos long)."}]},
  "Patron Grand Ancien": {"key":"patron-grand-ancien","classKey":"occultiste","features":[{"level":3,"name":"Esprit éveillé","desc":"Par une action bonus, tu établis un lien télépathique avec une créature que tu vois (portée liée à ton mod de Charisme) ; elle ne te comprend que si vous partagez une langue."},{"level":3,"name":"Sorts psychiques","desc":"Quand un sort d'occultiste inflige des dégâts, tu peux en changer le type en psychique ; tes sorts d'Enchantement et d'Illusion se lancent sans composante verbale ni gestuelle."},{"level":6,"name":"Combattant clairvoyant","desc":"Quand tu établis ton lien d'Esprit éveillé, tu peux forcer la cible à un JS de Sagesse ; en cas d'échec, elle a le Désavantage à ses attaques contre toi et tu as l'Avantage contre elle tant que le lien dure."},{"level":10,"name":"Maléfice occulte","desc":"Le sort Maléfice est toujours préparé pour toi, et quand tu le lances en désignant une caractéristique, la cible subit aussi le Désavantage à ses JS de cette caractéristique."},{"level":10,"name":"Bouclier mental","desc":"Tes pensées ne peuvent être lues sans ton accord, tu gagnes la résistance aux dégâts psychiques, et quand une créature t'inflige des dégâts psychiques, elle en subit autant en retour."},{"level":14,"name":"Créer un servant","desc":"Tu peux lancer Invocation d'aberration sans concentration (1 minute), et l'aberration invoquée inflige des dégâts psychiques supplémentaires aux créatures sous l'effet de ton Maléfice."}]},
};
Object.assign(SUBCLASSES_2024_FR, _PHB2024_SUB);
{
  const _byClass = {};
  for (const [_lab, _sc] of Object.entries(_PHB2024_SUB)) (_byClass[_sc.classKey] ||= []).push(_lab);
  for (const _c of CLASSES_2024_FR) if (_byClass[_c.key]) _c.subclasses = [..._c.subclasses, ..._byClass[_c.key]];
}

/* ── Sélection par locale (données EN générées : srd2024.en.js) ─────────── */
const _enLoc = () => getLocale() === 'en';
export const SPECIES = _enLoc() ? EN24.SPECIES : SPECIES_FR;
export const BACKGROUNDS_2024 = _enLoc() ? EN24.BACKGROUNDS_2024 : BACKGROUNDS_2024_FR;
export const CLASSES_2024 = _enLoc() ? EN24.CLASSES_2024 : CLASSES_2024_FR;
export const SUBCLASSES_2024 = _enLoc() ? EN24.SUBCLASSES_2024 : SUBCLASSES_2024_FR;

/* ── Résolution par libellé, cross-locale (anciennes fiches stockées en FR) ──
 * On résout d'abord dans la locale active (libellé OU clé), puis, à défaut, via
 * l'AUTRE langue → on remappe sur l'entrée active grâce à la clé stable. */
const _norm24 = (s) => String(s || '').normalize('NFC').trim().toLowerCase();
const _find24 = (arr, v) => arr.find((e) => _norm24(e.label) === _norm24(v) || _norm24(e.key) === _norm24(v)) || null;
const _xres24 = (active, inactive, v) => {
  if (!v) return null;
  const hit = _find24(active, v);
  if (hit) return hit;
  const o = _find24(inactive, v);
  return o ? active.find((e) => e.key === o.key) || null : null;
};
export const classByLabel2024 = (v) => _xres24(CLASSES_2024, _enLoc() ? CLASSES_2024_FR : EN24.CLASSES_2024, v);
export const speciesByLabel2024 = (v) => _xres24(SPECIES, _enLoc() ? SPECIES_FR : EN24.SPECIES, v);
export const backgroundByLabel2024 = (v) => _xres24(BACKGROUNDS_2024, _enLoc() ? BACKGROUNDS_2024_FR : EN24.BACKGROUNDS_2024, v);
const _subList24 = (obj) => Object.entries(obj).map(([label, s]) => ({ label, ...s }));
export const subclassByLabel2024 = (v) => {
  if (!v) return null;
  const n = _norm24(v);
  const active = _subList24(SUBCLASSES_2024);
  const hit = active.find((e) => _norm24(e.label) === n || _norm24(e.key) === n);
  if (hit) return hit;
  const o = _subList24(_enLoc() ? SUBCLASSES_2024_FR : EN24.SUBCLASSES_2024).find((e) => _norm24(e.label) === n || _norm24(e.key) === n);
  return o ? active.find((e) => e.key === o.key) || null : null;
};
