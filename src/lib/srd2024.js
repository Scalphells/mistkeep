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

import { CLASSES as CLASSES_5E } from './srd5e.js';

/* ── Espèces (SRD 5.2) ──────────────────────────────────────── */

export const SPECIES = [
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

export const BACKGROUNDS_2024 = [
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
export const CLASSES_2024 = CLASSES_5E.map((c) => ({
  ...c,
  features: CLASS_FEATURES_2024[c.key] || [],
  subclasses: SUBCLASS_BY_CLASS[c.key] ? [SUBCLASS_BY_CLASS[c.key]] : [],
}));

export const SUBCLASSES_2024 = Object.fromEntries(
  Object.entries(SUBCLASS_BY_CLASS).map(([classKey, label]) => [
    label,
    { classKey, features: SUBCLASS_FEATURES_2024[label] || [] },
  ])
);
