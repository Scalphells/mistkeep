/**
 * Données SRD 5.1 (2014) — classes & races — et helpers PURS pour dériver les
 * champs mécaniques d'une fiche à partir d'un choix de classe/race.
 *
 * Sans dépendance DOM/Supabase → testable en isolation (cf. test/srd5e.test.js).
 * Distances en MÈTRES pour coller à `data.spd` (30 ft = 9 m, 25 ft = 7,5 m,
 * 35 ft = 10,5 m, 60 ft = 18 m, 120 ft = 36 m).
 *
 * Les clés de compétences correspondent à SKILLS dans features/characters.js :
 *   acrobatics, animal, arcana, athletics, deception, history, insight,
 *   intimidation, investigation, medicine, nature, perception, performance,
 *   persuasion, religion, sleight, stealth, survival.
 */

import { abilityMod } from './rules.js';

const norm = (s) => String(s || '').normalize('NFC').trim().toLowerCase();

/* ── Marqueurs du bloc « aptitudes » géré (inséré/retiré automatiquement) ── */
export const SRD_OPEN = '⟦SRD⟧';
export const SRD_CLOSE = '⟦/SRD⟧';

/* ── Classes ──────────────────────────────────────────────────────────────
 * { key, label, hd (taille du dé), saves:[2 carac.], sc (carac. d'incantation
 *   | null), skillCount, skillList:[clés], armorProf, weaponProf,
 *   features:[{name,desc}], subclasses:[labels] }
 */
export const CLASSES = [
  {
    key: 'barbare', label: 'Barbare', hd: 12, saves: ['str', 'con'], sc: null,
    skillCount: 2, skillList: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    armorProf: 'Armures légères et intermédiaires, boucliers',
    weaponProf: 'Armes courantes et de guerre',
    features: [
      { name: 'Rage', desc: 'Action bonus : +dégâts en mêlée, avantage aux jets de FOR, résistance contondant/perforant/tranchant.' },
      { name: 'Défense sans armure', desc: 'Sans armure, CA = 10 + mod. DEX + mod. CON.' },
    ],
    subclasses: ['Voie du Berserker'],
  },
  {
    key: 'barde', label: 'Barde', hd: 8, saves: ['dex', 'cha'], sc: 'cha',
    skillCount: 3, skillList: ['acrobatics', 'animal', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight', 'stealth', 'survival'],
    armorProf: 'Armures légères',
    weaponProf: 'Armes courantes, arbalètes de poing, épées longues/courtes, rapières',
    features: [
      { name: 'Incantation', desc: 'Lanceur de sorts (Charisme).' },
      { name: 'Inspiration bardique', desc: 'Action bonus : donne un dé d6 à un allié (récup. repos long).' },
    ],
    subclasses: ['Collège du Savoir'],
  },
  {
    key: 'clerc', label: 'Clerc', hd: 8, saves: ['wis', 'cha'], sc: 'wis',
    skillCount: 2, skillList: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    armorProf: 'Armures légères et intermédiaires, boucliers',
    weaponProf: 'Armes courantes',
    features: [
      { name: 'Incantation', desc: 'Lanceur de sorts (Sagesse).' },
      { name: 'Domaine divin', desc: 'Choisi au niveau 1, accorde des sorts et aptitudes.' },
    ],
    subclasses: ['Domaine de la Vie'],
  },
  {
    key: 'druide', label: 'Druide', hd: 8, saves: ['int', 'wis'], sc: 'wis',
    skillCount: 2, skillList: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    armorProf: 'Armures légères/intermédiaires et boucliers (non métalliques)',
    weaponProf: 'Bâtons, cimeterres, dagues, frondes, javelines, gourdins, lances…',
    features: [
      { name: 'Incantation', desc: 'Lanceur de sorts (Sagesse).' },
      { name: 'Druidique', desc: 'Langue secrète des druides.' },
    ],
    subclasses: ['Cercle de la Terre'],
  },
  {
    key: 'ensorceleur', label: 'Ensorceleur', hd: 6, saves: ['con', 'cha'], sc: 'cha',
    skillCount: 2, skillList: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    armorProf: 'Aucune',
    weaponProf: 'Dagues, bâtons, fléchettes, frondes, arbalètes légères',
    features: [
      { name: 'Incantation', desc: 'Lanceur de sorts (Charisme).' },
      { name: 'Origine magique', desc: 'Source de pouvoir choisie au niveau 1.' },
    ],
    subclasses: ['Lignée draconique'],
  },
  {
    key: 'guerrier', label: 'Guerrier', hd: 10, saves: ['str', 'con'], sc: null,
    skillCount: 2, skillList: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
    armorProf: 'Toutes les armures, boucliers',
    weaponProf: 'Armes courantes et de guerre',
    features: [
      { name: 'Style de combat', desc: 'Spécialisation choisie au niveau 1 (archerie, défense…).' },
      { name: 'Second souffle', desc: 'Action bonus : récupère 1d10 + niveau PV (repos court/long).' },
    ],
    subclasses: ['Champion'],
  },
  {
    key: 'magicien', label: 'Magicien', hd: 6, saves: ['int', 'wis'], sc: 'int',
    skillCount: 2, skillList: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
    armorProf: 'Aucune',
    weaponProf: 'Dagues, bâtons, fléchettes, frondes, arbalètes légères',
    features: [
      { name: 'Incantation', desc: 'Lanceur de sorts (Intelligence).' },
      { name: 'Récupération arcanique', desc: 'Au repos court, récupère des emplacements de sorts.' },
    ],
    subclasses: ["École d'Invocation"],
  },
  {
    key: 'moine', label: 'Moine', hd: 8, saves: ['str', 'dex'], sc: null,
    skillCount: 2, skillList: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    armorProf: 'Aucune',
    weaponProf: 'Armes courantes, épées courtes',
    features: [
      { name: 'Défense sans armure', desc: 'Sans armure ni bouclier, CA = 10 + mod. DEX + mod. SAG.' },
      { name: 'Arts martiaux', desc: 'Frappes à mains nues avec la DEX, attaque à mains nues en action bonus.' },
    ],
    subclasses: ['Voie de la Main ouverte'],
  },
  {
    key: 'paladin', label: 'Paladin', hd: 10, saves: ['wis', 'cha'], sc: 'cha',
    skillCount: 2, skillList: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    armorProf: 'Toutes les armures, boucliers',
    weaponProf: 'Armes courantes et de guerre',
    features: [
      { name: 'Sens divin', desc: 'Détecte céleste/fiélon/mort-vivant à proximité.' },
      { name: 'Imposition des mains', desc: 'Réservoir de soins = 5 × niveau PV (repos long).' },
    ],
    subclasses: ['Serment de Dévotion'],
  },
  {
    key: 'rodeur', label: 'Rôdeur', hd: 10, saves: ['str', 'dex'], sc: 'wis',
    skillCount: 3, skillList: ['animal', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    armorProf: 'Armures légères et intermédiaires, boucliers',
    weaponProf: 'Armes courantes et de guerre',
    features: [
      { name: 'Ennemi juré', desc: 'Avantage pour pister et se souvenir d’un type de créature.' },
      { name: 'Explorateur-né', desc: 'Aisance dans un type de terrain favori.' },
    ],
    subclasses: ['Chasseur'],
  },
  {
    key: 'roublard', label: 'Roublard', hd: 8, saves: ['dex', 'int'], sc: null,
    skillCount: 4, skillList: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight', 'stealth'],
    armorProf: 'Armures légères',
    weaponProf: 'Armes courantes, arbalètes de poing, épées longues/courtes, rapières',
    features: [
      { name: 'Attaque sournoise', desc: 'Dégâts supplémentaires (1d6 au niveau 1) si avantage ou allié adjacent.' },
      { name: 'Expertise', desc: 'Double maîtrise sur 2 compétences (ou outils).' },
      { name: 'Argot des voleurs', desc: 'Jargon codé secret.' },
    ],
    subclasses: ['Voleur'],
  },
  {
    key: 'occultiste', label: 'Occultiste', hd: 8, saves: ['wis', 'cha'], sc: 'cha',
    skillCount: 2, skillList: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    armorProf: 'Armures légères',
    weaponProf: 'Armes courantes',
    features: [
      { name: 'Protecteur de l’outre-monde', desc: 'Pacte conclu au niveau 1, accorde des sorts.' },
      { name: 'Magie de pacte', desc: 'Incantation (Charisme) ; emplacements récupérés au repos court.' },
    ],
    subclasses: ['Le Fiélon'],
  },
];

/* ── Races (sous-races pertinentes aplaties) ──────────────────────────────
 * { key, label, ability:{bonus}, abilityChoose?:{count,from[],amount},
 *   speed(m), darkvision(m), size('P'|'M'), traits:[{name,desc}], fixedSkills:[] }
 */
export const RACES = [
  {
    key: 'humain', label: 'Humain', ability: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 9, darkvision: 0, size: 'M', fixedSkills: [],
    traits: [{ name: 'Polyvalent', desc: '+1 à toutes les caractéristiques.' }],
  },
  {
    key: 'elfe-haut', label: 'Elfe (Haut-elfe)', ability: { dex: 2, int: 1 },
    speed: 9, darkvision: 18, size: 'M', fixedSkills: ['perception'],
    traits: [
      { name: 'Ascendance féerique', desc: 'Avantage contre l’état charmé ; insensible au sommeil magique.' },
      { name: 'Sens aiguisés', desc: 'Maîtrise de Perception.' },
      { name: 'Transe', desc: 'Médite 4 h au lieu de dormir 8 h.' },
      { name: 'Tour de magie', desc: 'Un sortilège mineur de magicien (Intelligence).' },
    ],
  },
  {
    key: 'elfe-sylvestre', label: 'Elfe Sylvestre', ability: { dex: 2, wis: 1 },
    speed: 10.5, darkvision: 18, size: 'M', fixedSkills: ['perception'],
    traits: [
      { name: 'Ascendance féerique', desc: 'Avantage contre l’état charmé ; insensible au sommeil magique.' },
      { name: 'Sens aiguisés', desc: 'Maîtrise de Perception.' },
      { name: 'Transe', desc: 'Médite 4 h au lieu de dormir 8 h.' },
      { name: 'Cachette naturelle', desc: 'Peut se cacher quand seulement légèrement obscurci par la nature.' },
    ],
  },
  {
    key: 'elfe-drow', label: 'Elfe (Drow)', ability: { dex: 2, cha: 1 },
    speed: 9, darkvision: 36, size: 'M', fixedSkills: ['perception'],
    traits: [
      { name: 'Ascendance féerique', desc: 'Avantage contre l’état charmé ; insensible au sommeil magique.' },
      { name: 'Sensibilité au soleil', desc: 'Désavantage à la vue et aux attaques en plein soleil.' },
      { name: 'Magie drow', desc: 'Tour de magie Lumières dansantes (Charisme).' },
    ],
  },
  {
    key: 'nain-collines', label: 'Nain des collines', ability: { con: 2, wis: 1 },
    speed: 7.5, darkvision: 18, size: 'M', fixedSkills: [], hpPerLevel: 1,
    traits: [
      { name: 'Résistance naine', desc: 'Avantage aux JS contre le poison, résistance aux dégâts de poison.' },
      { name: 'Robustesse naine', desc: '+1 PV par niveau.' },
      { name: 'Entraînement au combat nain', desc: 'Maîtrise hache d’armes/de guerre, marteau léger/de guerre.' },
    ],
  },
  {
    key: 'nain-montagnes', label: 'Nain des montagnes', ability: { con: 2, str: 2 },
    speed: 7.5, darkvision: 18, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Résistance naine', desc: 'Avantage aux JS contre le poison, résistance aux dégâts de poison.' },
      { name: 'Entraînement aux armures naines', desc: 'Maîtrise des armures légères et intermédiaires.' },
    ],
  },
  {
    key: 'halfelin-pied-leger', label: 'Halfelin (Pied-léger)', ability: { dex: 2, cha: 1 },
    speed: 7.5, darkvision: 0, size: 'P', fixedSkills: [],
    traits: [
      { name: 'Chanceux', desc: 'Relance un 1 obtenu sur un d20 (attaque, test, JS).' },
      { name: 'Brave', desc: 'Avantage aux JS contre l’état effrayé.' },
      { name: 'Agilité halfeline', desc: 'Traverse l’espace d’une créature plus grande.' },
      { name: 'Discrétion naturelle', desc: 'Peut se cacher derrière une créature plus grande.' },
    ],
  },
  {
    key: 'halfelin-robuste', label: 'Halfelin (Robuste)', ability: { dex: 2, con: 1 },
    speed: 7.5, darkvision: 0, size: 'P', fixedSkills: [],
    traits: [
      { name: 'Chanceux', desc: 'Relance un 1 obtenu sur un d20 (attaque, test, JS).' },
      { name: 'Brave', desc: 'Avantage aux JS contre l’état effrayé.' },
      { name: 'Agilité halfeline', desc: 'Traverse l’espace d’une créature plus grande.' },
      { name: 'Résistance halfeline', desc: 'Avantage aux JS contre le poison, résistance au poison.' },
    ],
  },
  {
    key: 'drakeide', label: 'Drakéide', ability: { str: 2, cha: 1 },
    speed: 9, darkvision: 0, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Ascendance draconique', desc: 'Type de dragon au choix (définit le souffle et la résistance).' },
      { name: 'Arme de souffle', desc: 'Souffle infligeant des dégâts de zone (JS, récup. repos court).' },
      { name: 'Résistance draconique', desc: 'Résistance au type de dégâts de l’ascendance.' },
    ],
  },
  {
    key: 'gnome-roches', label: 'Gnome des roches', ability: { int: 2, con: 1 },
    speed: 7.5, darkvision: 18, size: 'P', fixedSkills: [],
    traits: [
      { name: 'Ruse gnome', desc: 'Avantage aux JS d’INT/SAG/CHA contre la magie.' },
      { name: 'Connaissances en artifice', desc: 'Bonus de maîtrise doublé pour identifier objets magiques.' },
      { name: 'Bricoleur', desc: 'Fabrique de petits engins mécaniques.' },
    ],
  },
  {
    key: 'gnome-forets', label: 'Gnome des forêts', ability: { int: 2, dex: 1 },
    speed: 7.5, darkvision: 18, size: 'P', fixedSkills: [],
    traits: [
      { name: 'Ruse gnome', desc: 'Avantage aux JS d’INT/SAG/CHA contre la magie.' },
      { name: 'Tour de magie naturel', desc: 'Connaît Illusion mineure (Intelligence).' },
      { name: 'Discours avec les bêtes', desc: 'Communique des idées simples aux petites bêtes.' },
    ],
  },
  {
    key: 'demi-elfe', label: 'Demi-Elfe', ability: { cha: 2 },
    abilityChoose: { count: 2, from: ['str', 'dex', 'con', 'int', 'wis'], amount: 1 },
    skillChoose: { count: 2, from: 'all' }, // Polyvalence : 2 compétences au choix
    speed: 9, darkvision: 18, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Ascendance féerique', desc: 'Avantage contre l’état charmé ; insensible au sommeil magique.' },
      { name: 'Polyvalence', desc: 'Maîtrise de 2 compétences au choix (à cocher manuellement).' },
    ],
  },
  {
    key: 'demi-orc', label: 'Demi-Orc', ability: { str: 2, con: 1 },
    speed: 9, darkvision: 18, size: 'M', fixedSkills: ['intimidation'],
    traits: [
      { name: 'Menace', desc: 'Maîtrise d’Intimidation.' },
      { name: 'Endurance acharnée', desc: 'Tombe à 1 PV au lieu de 0 (1/repos long).' },
      { name: 'Attaques sauvages', desc: 'Sur un coup critique en mêlée, +1 dé de dégâts de l’arme.' },
    ],
  },
  {
    key: 'tieffelin', label: 'Tieffelin', ability: { cha: 2, int: 1 },
    speed: 9, darkvision: 18, size: 'M', fixedSkills: [],
    traits: [
      { name: 'Résistance infernale', desc: 'Résistance aux dégâts de feu.' },
      { name: 'Legs infernal', desc: 'Connaît Thaumaturgie ; sorts supplémentaires aux niveaux 3 et 5 (Charisme).' },
    ],
  },
];

/* ── Équipement de départ par classe ──────────────────────────────────────
 * Chaque groupe est soit { fixed:[items] } (toujours ajouté), soit
 * { choose:[{label, items:[items]}] } (un choix à faire). item = {nm, qty}.
 */
const I = (nm, qty = 1) => ({ nm, qty });
export const CLASS_EQUIPMENT = {
  barbare: [
    { choose: [{ label: 'Une hache à deux mains', items: [I('Hache à deux mains')] }, { label: 'Une arme de guerre de corps à corps', items: [I('Arme de guerre (corps à corps)')] }] },
    { choose: [{ label: 'Deux hachettes', items: [I('Hachette', 2)] }, { label: 'Une arme courante', items: [I('Arme courante')] }] },
    { fixed: [I("Sac d'exploration"), I('Javeline', 4)] },
  ],
  barde: [
    { choose: [{ label: 'Une rapière', items: [I('Rapière')] }, { label: 'Une épée longue', items: [I('Épée longue')] }, { label: 'Une arme courante', items: [I('Arme courante')] }] },
    { choose: [{ label: 'Un sac de diplomate', items: [I('Sac de diplomate')] }, { label: "Un sac d'artiste", items: [I("Sac d'artiste")] }] },
    { choose: [{ label: 'Un luth', items: [I('Luth')] }, { label: 'Un autre instrument de musique', items: [I('Instrument de musique')] }] },
    { fixed: [I('Armure de cuir'), I('Dague')] },
  ],
  clerc: [
    { choose: [{ label: "Une masse d'armes", items: [I("Masse d'armes")] }, { label: 'Un marteau de guerre (si maîtrise)', items: [I('Marteau de guerre')] }] },
    { choose: [{ label: "Une armure d'écailles", items: [I("Armure d'écailles")] }, { label: 'Une armure de cuir', items: [I('Armure de cuir')] }, { label: 'Une cotte de mailles (si maîtrise)', items: [I('Cotte de mailles')] }] },
    { choose: [{ label: 'Une arbalète légère et 20 carreaux', items: [I('Arbalète légère'), I('Carreau', 20)] }, { label: 'Une arme courante', items: [I('Arme courante')] }] },
    { fixed: [I('Bouclier'), I('Symbole sacré'), I("Sac d'ecclésiastique")] },
  ],
  druide: [
    { choose: [{ label: 'Un bouclier en bois', items: [I('Bouclier')] }, { label: 'Une arme courante', items: [I('Arme courante')] }] },
    { choose: [{ label: 'Un cimeterre', items: [I('Cimeterre')] }, { label: 'Une arme courante de corps à corps', items: [I('Arme courante (corps à corps)')] }] },
    { fixed: [I('Armure de cuir'), I("Sac d'exploration"), I('Focaliseur druidique')] },
  ],
  ensorceleur: [
    { choose: [{ label: 'Une arbalète légère et 20 carreaux', items: [I('Arbalète légère'), I('Carreau', 20)] }, { label: 'Une arme courante', items: [I('Arme courante')] }] },
    { choose: [{ label: 'Un sac à composantes', items: [I('Sac à composantes')] }, { label: 'Un focaliseur arcanique', items: [I('Focaliseur arcanique')] }] },
    { choose: [{ label: "Un sac d'exploration", items: [I("Sac d'exploration")] }, { label: "Un sac d'aventurier", items: [I("Sac d'aventurier")] }] },
    { fixed: [I('Dague', 2)] },
  ],
  guerrier: [
    { choose: [{ label: 'Une cotte de mailles', items: [I('Cotte de mailles')] }, { label: 'Une armure de cuir, un arc long et 20 flèches', items: [I('Armure de cuir'), I('Arc long'), I('Flèche', 20)] }] },
    { choose: [{ label: 'Une arme de guerre et un bouclier', items: [I('Arme de guerre'), I('Bouclier')] }, { label: 'Deux armes de guerre', items: [I('Arme de guerre', 2)] }] },
    { choose: [{ label: 'Une arbalète légère et 20 carreaux', items: [I('Arbalète légère'), I('Carreau', 20)] }, { label: 'Deux hachettes', items: [I('Hachette', 2)] }] },
    { choose: [{ label: "Un sac d'exploration", items: [I("Sac d'exploration")] }, { label: "Un sac d'aventurier", items: [I("Sac d'aventurier")] }] },
  ],
  magicien: [
    { choose: [{ label: 'Un bâton', items: [I('Bâton')] }, { label: 'Une dague', items: [I('Dague')] }] },
    { choose: [{ label: 'Un sac à composantes', items: [I('Sac à composantes')] }, { label: 'Un focaliseur arcanique', items: [I('Focaliseur arcanique')] }] },
    { choose: [{ label: "Un sac d'érudit", items: [I("Sac d'érudit")] }, { label: "Un sac d'exploration", items: [I("Sac d'exploration")] }] },
    { fixed: [I('Grimoire')] },
  ],
  moine: [
    { choose: [{ label: 'Une épée courte', items: [I('Épée courte')] }, { label: 'Une arme courante', items: [I('Arme courante')] }] },
    { choose: [{ label: "Un sac d'exploration", items: [I("Sac d'exploration")] }, { label: "Un sac d'aventurier", items: [I("Sac d'aventurier")] }] },
    { fixed: [I('Fléchette', 10)] },
  ],
  paladin: [
    { choose: [{ label: 'Une arme de guerre et un bouclier', items: [I('Arme de guerre'), I('Bouclier')] }, { label: 'Deux armes de guerre', items: [I('Arme de guerre', 2)] }] },
    { choose: [{ label: 'Cinq javelines', items: [I('Javeline', 5)] }, { label: 'Une arme courante de corps à corps', items: [I('Arme courante (corps à corps)')] }] },
    { fixed: [I('Cotte de mailles'), I('Symbole sacré'), I("Sac d'ecclésiastique")] },
  ],
  rodeur: [
    { choose: [{ label: "Une armure d'écailles", items: [I("Armure d'écailles")] }, { label: 'Une armure de cuir', items: [I('Armure de cuir')] }] },
    { choose: [{ label: 'Deux épées courtes', items: [I('Épée courte', 2)] }, { label: 'Deux armes courantes de corps à corps', items: [I('Arme courante (corps à corps)', 2)] }] },
    { choose: [{ label: "Un sac d'exploration", items: [I("Sac d'exploration")] }, { label: "Un sac d'aventurier", items: [I("Sac d'aventurier")] }] },
    { fixed: [I('Arc long'), I('Flèche', 20)] },
  ],
  roublard: [
    { choose: [{ label: 'Une rapière', items: [I('Rapière')] }, { label: 'Une épée courte', items: [I('Épée courte')] }] },
    { choose: [{ label: 'Un arc court et 20 flèches', items: [I('Arc court'), I('Flèche', 20)] }, { label: 'Une épée courte', items: [I('Épée courte')] }] },
    { choose: [{ label: 'Un sac de cambrioleur', items: [I('Sac de cambrioleur')] }, { label: "Un sac d'exploration", items: [I("Sac d'exploration")] }, { label: "Un sac d'aventurier", items: [I("Sac d'aventurier")] }] },
    { fixed: [I('Armure de cuir'), I('Dague', 2), I('Outils de voleur')] },
  ],
  occultiste: [
    { choose: [{ label: 'Une arbalète légère et 20 carreaux', items: [I('Arbalète légère'), I('Carreau', 20)] }, { label: 'Une arme courante', items: [I('Arme courante')] }] },
    { choose: [{ label: 'Un sac à composantes', items: [I('Sac à composantes')] }, { label: 'Un focaliseur arcanique', items: [I('Focaliseur arcanique')] }] },
    { choose: [{ label: "Un sac d'érudit", items: [I("Sac d'érudit")] }, { label: "Un sac d'exploration", items: [I("Sac d'exploration")] }] },
    { fixed: [I('Armure de cuir'), I('Arme courante'), I('Dague', 2)] },
  ],
};

/* ── Historiques (backgrounds) ─────────────────────────────────────────────
 * { key, label, skills:[2 clés], tools, languages, feature:{name,desc},
 *   equipment:[[nm,qty]], gold } — gold en pièces d'or (data.coins.po).
 */
export const BACKGROUNDS = [
  { key: 'acolyte', label: 'Acolyte', skills: ['insight', 'religion'], tools: '', languages: '2 au choix',
    feature: { name: 'Abri du fidèle', desc: 'Toi et tes compagnons recevez soins et accueil gratuits dans un temple de ta foi.' },
    equipment: [['Symbole sacré', 1], ['Livre de prières', 1], ["Bâton d'encens", 5], ['Habits de cérémonie', 1], ['Habits communs', 1]], gold: 15 },
  { key: 'criminel', label: 'Criminel', skills: ['deception', 'stealth'], tools: 'un jeu, outils de voleur', languages: '',
    feature: { name: 'Contact criminel', desc: 'Tu as un contact fiable dans la pègre qui te sert d’intermédiaire.' },
    equipment: [['Pied-de-biche', 1], ['Habits communs sombres avec capuche', 1]], gold: 15 },
  { key: 'soldat', label: 'Soldat', skills: ['athletics', 'intimidation'], tools: 'un jeu, véhicules terrestres', languages: '',
    feature: { name: 'Grade militaire', desc: 'Les soldats loyaux à ton ancienne organisation reconnaissent ton autorité.' },
    equipment: [['Insigne de grade', 1], ["Trophée d'ennemi", 1], ['Jeu de dés en os', 1], ['Habits communs', 1]], gold: 10 },
  { key: 'sage', label: 'Sage', skills: ['arcana', 'history'], tools: '', languages: '2 au choix',
    feature: { name: 'Chercheur', desc: 'Quand tu ignores une information, tu sais souvent où et auprès de qui la trouver.' },
    equipment: [["Bouteille d'encre", 1], ['Plume', 1], ['Petit couteau', 1], ["Lettre d'un collègue défunt", 1], ['Habits communs', 1]], gold: 10 },
  { key: 'noble', label: 'Noble', skills: ['history', 'persuasion'], tools: 'un jeu', languages: '1 au choix',
    feature: { name: 'Position de privilège', desc: 'On te traite avec respect dans la haute société ; le petit peuple cherche à te complaire.' },
    equipment: [['Habits fins', 1], ['Chevalière', 1], ['Lettres de noblesse', 1]], gold: 25 },
  { key: 'ermite', label: 'Ermite', skills: ['medicine', 'religion'], tools: "kit d'herboriste", languages: '1 au choix',
    feature: { name: 'Découverte', desc: 'Durant ton isolement, tu as découvert une vérité unique et puissante.' },
    equipment: [['Étui à parchemins', 1], ['Couverture', 1], ['Habits communs', 1], ["Kit d'herboriste", 1]], gold: 5 },
  { key: 'artiste', label: 'Artiste', skills: ['acrobatics', 'performance'], tools: 'déguisement, un instrument de musique', languages: '',
    feature: { name: 'Par demande populaire', desc: 'Tu es accueilli et logé là où tu te produis, en échange de tes spectacles.' },
    equipment: [['Instrument de musique', 1], ["Cadeau d'un admirateur", 1], ['Costume', 1]], gold: 15 },
  { key: 'charlatan', label: 'Charlatan', skills: ['deception', 'sleight'], tools: 'déguisement, matériel de faussaire', languages: '',
    feature: { name: 'Fausse identité', desc: 'Tu possèdes une seconde identité crédible et sais contrefaire des documents.' },
    equipment: [['Habits fins', 1], ['Kit de déguisement', 1], ["Outils d'escroquerie", 1]], gold: 15 },
  { key: 'heros-du-peuple', label: 'Héros du peuple', skills: ['animal', 'survival'], tools: "un type d'outils d'artisan, véhicules terrestres", languages: '',
    feature: { name: 'Hospitalité rustique', desc: 'Les gens du peuple t’offrent refuge et te cachent au besoin.' },
    equipment: [["Outils d'artisan", 1], ['Pelle', 1], ['Pot en fer', 1], ['Habits communs', 1]], gold: 10 },
  { key: 'marin', label: 'Marin', skills: ['athletics', 'perception'], tools: "instruments de navigation, véhicules aquatiques", languages: '',
    feature: { name: 'Passage gratuit', desc: 'Tu peux embarquer gratuitement sur un navire pour toi et tes compagnons.' },
    equipment: [['Cordage en soie (15 m)', 1], ['Porte-bonheur', 1], ['Habits communs', 1]], gold: 10 },
  { key: 'artisan-de-guilde', label: 'Artisan de guilde', skills: ['insight', 'persuasion'], tools: "un type d'outils d'artisan", languages: '1 au choix',
    feature: { name: 'Membre de guilde', desc: 'Ta guilde t’offre soutien, hébergement et accès à des contacts professionnels.' },
    equipment: [["Outils d'artisan", 1], ['Lettre de recommandation', 1], ['Habits de voyage', 1]], gold: 15 },
  { key: 'enfant-des-rues', label: 'Enfant des rues', skills: ['sleight', 'stealth'], tools: 'déguisement, outils de voleur', languages: '',
    feature: { name: 'Secrets de la ville', desc: 'Tu connais les passages et raccourcis secrets des villes.' },
    equipment: [['Petit couteau', 1], ['Carte de ta ville natale', 1], ['Souris domestiquée', 1], ['Habits communs', 1]], gold: 10 },
];

/* ── Sous-classes (exemple SRD par classe) : aptitudes datées par niveau ────
 * Clé = libellé exact proposé dans CLASSES[].subclasses. `features:[{level,name,desc}]`.
 * Le niveau d'accès est porté par chaque aptitude (la sous-classe débloque au fil
 * des niveaux). Descriptions condensées, conformes au SRD 5.1 / aidedd.
 */
export const SUBCLASSES = {
  'Voie du Berserker': { classKey: 'barbare', features: [
    { level: 3, name: 'Frénésie', desc: 'En rage, une attaque supplémentaire à mains armées en action bonus ; épuisement à la fin de la rage.' },
    { level: 6, name: 'Rage inébranlable', desc: 'Pendant ta rage, tu ne peux pas être charmé ni effrayé.' },
    { level: 10, name: 'Présence intimidante', desc: 'Action : effraie une créature (JS Sagesse contre DD de tes capacités).' },
    { level: 14, name: 'Représailles', desc: 'Quand une créature à 1,5 m te blesse, attaque de mêlée en réaction.' },
  ] },
  'Collège du Savoir': { classKey: 'barde', features: [
    { level: 3, name: 'Maîtrises supplémentaires', desc: '3 compétences au choix.' },
    { level: 3, name: 'Mots cinglants', desc: 'Réaction : dépense un dé d’inspiration pour réduire l’attaque/test/dégâts d’une créature.' },
    { level: 6, name: 'Secrets magiques supplémentaires', desc: 'Apprends 2 sorts de n’importe quelle classe.' },
    { level: 14, name: 'Talent suprême', desc: 'Pour un test de caractéristique, ajoute un dé d’inspiration dépensé.' },
  ] },
  'Domaine de la Vie': { classKey: 'clerc', features: [
    { level: 1, name: 'Sorts de domaine + armures lourdes', desc: 'Sorts de domaine bonus et maîtrise des armures lourdes.' },
    { level: 1, name: 'Disciple de la vie', desc: 'Tes sorts de soin rendent +2 + niveau du sort.' },
    { level: 2, name: 'Conduit divin : Préservation de la vie', desc: 'Soigne un total de 5 × niveau, réparti (créatures ≤ ½ PV).' },
    { level: 6, name: 'Guérisseur béni', desc: 'Tes sorts de soin lancés sur autrui te soignent de 2 + niveau du sort.' },
    { level: 8, name: 'Frappe divine', desc: '1/tour : +1d8 radiant sur une attaque d’arme (2d8 au niveau 14).' },
    { level: 17, name: 'Guérison suprême', desc: 'Tes dés de soin sont considérés comme donnant leur maximum.' },
  ] },
  'Cercle de la Terre': { classKey: 'druide', features: [
    { level: 2, name: 'Tour de magie bonus', desc: 'Un tour de magie de druide supplémentaire.' },
    { level: 2, name: 'Récupération naturelle', desc: 'Au repos court, récupère des emplacements de sorts (jusqu’à ½ niveau).' },
    { level: 3, name: 'Sorts de cercle', desc: 'Sorts bonus selon le terrain choisi (niveaux 3, 5, 7, 9).' },
    { level: 6, name: 'Foulée légère', desc: 'Ignore le terrain difficile naturel et certains effets de plantes.' },
    { level: 10, name: 'Protection de la nature', desc: 'Immunité poison/maladie ; les fées/élémentaires ne te charment ni t’effraient.' },
    { level: 14, name: 'Sanctuaire de la nature', desc: 'Action : empêche une créature de t’attaquer (JS Sagesse).' },
  ] },
  'Lignée draconique': { classKey: 'ensorceleur', features: [
    { level: 1, name: 'Ascendance draconique', desc: 'Choisis un type de dragon (définit le type de dégâts associé).' },
    { level: 1, name: 'Résilience draconique', desc: '+1 PV par niveau ; sans armure, CA = 13 + mod. DEX.' },
    { level: 6, name: 'Affinité élémentaire', desc: '+mod. CHA aux dégâts du type de ton dragon ; 1 point de sorcellerie → résistance 1 h.' },
    { level: 14, name: 'Ailes de dragon', desc: 'Fais pousser des ailes, vitesse de vol égale à la vitesse au sol.' },
    { level: 18, name: 'Présence draconique', desc: '5 points de sorcellerie : aura d’effroi ou de fascination sur 18 m.' },
  ] },
  Champion: { classKey: 'guerrier', features: [
    { level: 3, name: 'Critique amélioré', desc: 'Coups critiques sur un jet de 19-20.' },
    { level: 7, name: 'Athlète remarquable', desc: '½ maîtrise aux tests de FOR/DEX/CON non maîtrisés ; meilleur saut en longueur.' },
    { level: 10, name: 'Style de combat supplémentaire', desc: 'Un second style de combat au choix.' },
    { level: 15, name: 'Critique supérieur', desc: 'Coups critiques sur un jet de 18-20.' },
    { level: 18, name: 'Survivant', desc: 'Regagne des PV à chaque tour si tu es au-dessus de la moitié de tes PV.' },
  ] },
  "École d'Invocation": { classKey: 'magicien', features: [
    { level: 2, name: 'Spécialiste de l’Évocation', desc: 'Copie des sorts d’évocation à moitié prix/temps.' },
    { level: 2, name: 'Façonnage des sorts', desc: 'Tes alliés dans la zone réussissent leur JS et ne subissent aucun dégât.' },
    { level: 6, name: 'Tour de magie surpuissant', desc: 'Tes tours de magie offensifs infligent au moins leurs dégâts minimaux en cas d’échec.' },
    { level: 10, name: 'Évocation renforcée', desc: '+mod. INT aux dégâts d’un sort d’évocation par tour.' },
    { level: 14, name: 'Surcharge', desc: 'Un sort de niveau ≤ 5 inflige ses dégâts maximaux (puis dégâts en retour).' },
  ] },
  'Voie de la Main ouverte': { classKey: 'moine', features: [
    { level: 3, name: 'Technique de la Main ouverte', desc: 'Selon ta Rafale de coups : fais tomber, repousse de 4,5 m, ou prive de réaction.' },
    { level: 6, name: 'Plénitude corporelle', desc: 'Action : soigne-toi de 3 × niveau (1/repos long).' },
    { level: 11, name: 'Tranquillité', desc: 'À la fin d’un repos long, bénéficie d’un effet de Sanctuaire.' },
    { level: 17, name: 'Paume vibratoire', desc: 'Pose une vibration mortelle déclenchable ultérieurement (JS Constitution).' },
  ] },
  'Serment de Dévotion': { classKey: 'paladin', features: [
    { level: 3, name: 'Sorts de serment', desc: 'Sorts bonus toujours préparés.' },
    { level: 3, name: 'Conduit divin', desc: 'Arme sacrée (+mod. CHA aux attaques, lumière) ou Renvoi des impies.' },
    { level: 7, name: 'Aura de dévotion', desc: 'Toi et tes alliés à 3 m (6 m au niveau 18) êtes immunisés contre le charme.' },
    { level: 15, name: 'Pureté d’âme', desc: 'Effet permanent de Protection contre le mal et le bien sur toi.' },
    { level: 20, name: 'Halo sacré', desc: '1 min : aura de lumière, dégâts radiants et avantage aux JS contre les sorts fiélons/morts-vivants.' },
  ] },
  Chasseur: { classKey: 'rodeur', features: [
    { level: 3, name: 'Proie du chasseur', desc: 'Au choix : Tueur de colosses, Casseur de hordes ou Destructeur de géants.' },
    { level: 7, name: 'Tactiques défensives', desc: 'Au choix : Échappe à la nuée, Défense multiattaque ou Volonté d’acier.' },
    { level: 11, name: 'Attaque multiple', desc: 'Au choix : Salve ou Frappe tournoyante.' },
    { level: 15, name: 'Défense supérieure du chasseur', desc: 'Au choix : réduction de dégâts d’une source.' },
  ] },
  Voleur: { classKey: 'roublard', features: [
    { level: 3, name: 'Mains habiles', desc: 'Action bonus : Utiliser un objet, Escamotage ou Crochetage/Désamorçage.' },
    { level: 3, name: 'Monte-en-l’air', desc: 'Escalade sans surcoût de déplacement ; saut amélioré.' },
    { level: 9, name: 'Discrétion suprême', desc: 'Avantage à la Discrétion si tu te déplaces d’au plus la moitié de ta vitesse.' },
    { level: 13, name: 'Utilisation d’objet magique', desc: 'Ignore les conditions de classe/race/niveau pour utiliser un objet magique.' },
    { level: 17, name: 'Réflexes du voleur', desc: 'Deux tours au premier round d’un combat (initiatives séparées).' },
  ] },
  'Le Fiélon': { classKey: 'occultiste', features: [
    { level: 1, name: 'Liste de sorts élargie', desc: 'Sorts supplémentaires accessibles via le pacte.' },
    { level: 1, name: 'Aubaine du Fiélon', desc: 'Quand un ennemi tombe à 0 PV, gagne des PV temporaires = mod. CHA + niveau.' },
    { level: 6, name: 'Chance du Fiélon', desc: '1/repos court : ajoute 1d10 à un test de caractéristique ou un JS.' },
    { level: 10, name: 'Résilience fiélonne', desc: 'À chaque repos court, choisis une résistance aux dégâts (hors magique/argenté).' },
    { level: 14, name: 'Précipité aux enfers', desc: '1/repos long : expédie une créature aux enfers (10d10 psychiques).' },
  ] },
};

/* ── Maîtrises d'outils, incantation, langues (cartes annexes) ────────────
 * Conservées hors des grands tableaux CLASSES/RACES pour ne pas les alourdir.
 */

/** Maîtrises d'outils par classe (les armes/armures sont déjà dans CLASSES). */
const CLASS_TOOLS = {
  barde: 'Trois instruments de musique au choix',
  moine: "Un type d'outils d'artisan ou un instrument de musique au choix",
  roublard: 'Outils de voleur',
};

/**
 * Incantation par classe : type ('full' = lanceur complet, 'half' = demi-lanceur,
 * 'pact' = magie de pacte), nb de sorts mineurs au niveau 1, et une note décrivant
 * les sorts de départ (connus / préparés / grimoire).
 */
const CLASS_CASTING = {
  barde: { type: 'full', cantrips: 2, line: '2 sorts mineurs, 4 sorts de niveau 1 connus' },
  clerc: { type: 'full', cantrips: 3, line: '3 sorts mineurs ; sorts préparés = mod. SAG + niveau' },
  druide: { type: 'full', cantrips: 2, line: '2 sorts mineurs ; sorts préparés = mod. SAG + niveau' },
  ensorceleur: { type: 'full', cantrips: 4, line: '4 sorts mineurs, 2 sorts de niveau 1 connus' },
  magicien: { type: 'full', cantrips: 3, line: '3 sorts mineurs ; grimoire de 6 sorts de niveau 1' },
  paladin: { type: 'half', cantrips: 0, line: 'Sorts préparés (mod. CHA + ½ niveau) à partir du niveau 2' },
  rodeur: { type: 'half', cantrips: 0, line: 'Sorts connus à partir du niveau 2' },
  occultiste: { type: 'pact', cantrips: 2, line: '2 sorts mineurs, 2 sorts connus (magie de pacte)' },
};

/** Langues automatiques par race (clé de race). */
const RACE_LANGUAGES = {
  humain: 'Commun + 1 au choix',
  'elfe-haut': 'Commun, Elfique + 1 au choix',
  'elfe-sylvestre': 'Commun, Elfique',
  'elfe-drow': 'Commun, Elfique',
  'nain-collines': 'Commun, Nain',
  'nain-montagnes': 'Commun, Nain',
  'halfelin-pied-leger': 'Commun, Halfelin',
  'halfelin-robuste': 'Commun, Halfelin',
  drakeide: 'Commun, Draconique',
  'gnome-roches': 'Commun, Gnome',
  'gnome-forets': 'Commun, Gnome',
  'demi-elfe': 'Commun, Elfique + 1 au choix',
  'demi-orc': 'Commun, Orc',
  tieffelin: 'Commun, Infernal',
};

/* ── Tables d'emplacements de sorts (PHB 2014, mono-classe) ─────────────────
 * Index = niveau de personnage (1..20) ; valeur = [empl. niv.1, niv.2, …].
 */
const FULL_SLOTS = [
  null,
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const HALF_SLOTS = [
  null,
  [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2],
  [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
  [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];
// Magie de pacte (occultiste) : [nombre d'emplacements, niveau de ces emplacements].
const PACT_SLOTS = [
  null,
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5],
  [2, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
];

/* ── Index normalisés ─────────────────────────────────────────────────── */
const CLASS_INDEX = new Map();
for (const c of CLASSES) {
  CLASS_INDEX.set(norm(c.label), c);
  CLASS_INDEX.set(norm(c.key), c);
}
const RACE_INDEX = new Map();
for (const r of RACES) {
  RACE_INDEX.set(norm(r.label), r);
  RACE_INDEX.set(norm(r.key), r);
}
// Alias fréquents (anciennes fiches / variantes d'orthographe).
const RACE_ALIASES = {
  'elfe': 'elfe-haut',
  'elfe des bois': 'elfe-sylvestre',
  'haut-elfe': 'elfe-haut',
  'haut elfe': 'elfe-haut',
  'drow': 'elfe-drow',
  'nain': 'nain-collines',
  'halfelin': 'halfelin-pied-leger',
  'halflin': 'halfelin-pied-leger',
  'gnome': 'gnome-roches',
  'draconien': 'drakeide',
  'draconide': 'drakeide',
  'demi elfe': 'demi-elfe',
  'demi orc': 'demi-orc',
};
for (const [alias, key] of Object.entries(RACE_ALIASES)) {
  const r = RACES.find((x) => x.key === key);
  if (r && !RACE_INDEX.has(norm(alias))) RACE_INDEX.set(norm(alias), r);
}

/** Entrée de classe à partir d'un libellé (ou clé). Tolère un suffixe « Barde 3 ». */
export function classByLabel(label) {
  const n = norm(label);
  if (!n) return null;
  if (CLASS_INDEX.has(n)) return CLASS_INDEX.get(n);
  // Best-effort : premier mot significatif (« roublard 3 / magicien 2 » → roublard).
  const first = n.split(/[\s/]+/)[0];
  return CLASS_INDEX.get(first) || null;
}

/** Entrée de race à partir d'un libellé (ou clé/alias). */
export function raceByLabel(label) {
  const n = norm(label);
  if (!n) return null;
  return RACE_INDEX.get(n) || null;
}

const BG_INDEX = new Map();
for (const b of BACKGROUNDS) {
  BG_INDEX.set(norm(b.label), b);
  BG_INDEX.set(norm(b.key), b);
}

/** Entrée d'historique à partir d'un libellé (ou clé). */
export function backgroundByLabel(label) {
  const n = norm(label);
  if (!n) return null;
  return BG_INDEX.get(n) || null;
}

const SUBCLASS_INDEX = new Map();
for (const [label, sc] of Object.entries(SUBCLASSES)) {
  SUBCLASS_INDEX.set(norm(label), { label, ...sc });
}

/** Entrée de sous-classe à partir d'un libellé exact (ou null). */
export function subclassByLabel(label) {
  const n = norm(label);
  if (!n) return null;
  return SUBCLASS_INDEX.get(n) || null;
}

/** Groupes d'équipement de départ d'une classe (ou [] si inconnue). */
export function classStartingEquipment(classKey) {
  const c = typeof classKey === 'object' ? classKey : (CLASS_INDEX.get(norm(classKey)) || classByLabel(classKey));
  return c ? CLASS_EQUIPMENT[c.key] || [] : [];
}

/* ── Dérivations ──────────────────────────────────────────────────────── */

/** Convertit une liste de traits/features {name,desc} en lignes « Nom — desc ». */
function featuresToLines(list) {
  return (list || []).map((f) => (f.desc ? `${f.name} — ${f.desc}` : f.name));
}

/**
 * Champs dérivés d'une classe.
 * @returns {{patch:{hdSize,hdMax,hd,saves,sc}, featuresText:string,
 *            skillOptions:{count:number,list:string[]}}}
 * La classe n'émet jamais `spd` (la race possède la vitesse).
 */
export function deriveClassPatch(data, classKey) {
  const c = typeof classKey === 'object' ? classKey : (CLASS_INDEX.get(norm(classKey)) || classByLabel(classKey));
  if (!c) return null;
  const lvl = Math.max(1, Number(data?.lvl) || 1);
  const cast = CLASS_CASTING[c.key] || null;
  return {
    patch: {
      hdSize: c.hd,
      hdMax: lvl,
      hd: lvl,
      saves: [...c.saves],
      sc: c.sc,
    },
    featuresText: featuresToLines(c.features).join('\n'),
    skillOptions: { count: c.skillCount, list: [...c.skillList] },
    caster: cast ? cast.type : null,
    cantrips: cast ? cast.cantrips : 0,
    casterLine: cast ? cast.line : '',
    spellSlots: spellSlotsForLevel(c.key, lvl),
  };
}

/**
 * Emplacements de sorts d'une classe à un niveau donné (mono-classe, PHB 2014).
 * @returns {Object|null} `{ [niveauDeSort]: { m, u } }` ou null si non-lanceur
 *   / aucun emplacement à ce niveau (ex. Paladin/Rôdeur au niveau 1).
 */
export function spellSlotsForLevel(classKey, level) {
  const c = typeof classKey === 'object' ? classKey : (CLASS_INDEX.get(norm(classKey)) || classByLabel(classKey));
  const cast = c ? CLASS_CASTING[c.key] : null;
  if (!cast) return null;
  const lvl = Math.max(1, Math.min(20, Number(level) || 1));
  if (cast.type === 'pact') {
    const [cnt, sl] = PACT_SLOTS[lvl] || [];
    return cnt ? { [sl]: { m: cnt, u: 0 } } : null;
  }
  const row = (cast.type === 'half' ? HALF_SLOTS : FULL_SLOTS)[lvl];
  if (!row || !row.length) return null;
  const out = {};
  row.forEach((m, i) => {
    if (m > 0) out[i + 1] = { m, u: 0 };
  });
  return Object.keys(out).length ? out : null;
}

/**
 * Aptitudes d'une sous-classe accessibles au niveau courant.
 * @returns {{label, classKey, featureLines:string[], upcoming:object[]}|null}
 *   `featureLines` = aptitudes débloquées (niveau ≤ data.lvl), au format
 *   « Nom (niv.X) — desc » ; `upcoming` = aptitudes à venir (niveau > data.lvl).
 */
export function deriveSubclassPatch(data) {
  const sc = subclassByLabel(data?.sub);
  if (!sc) return null;
  const lvl = Math.max(1, Number(data?.lvl) || 1);
  const avail = sc.features.filter((f) => (f.level || 1) <= lvl);
  const upcoming = sc.features.filter((f) => (f.level || 1) > lvl);
  return {
    label: sc.label,
    classKey: sc.classKey,
    featureLines: avail.map((f) => `${f.name} (niv.${f.level}) — ${f.desc}`),
    upcoming,
  };
}

/**
 * Synthèse structurée des maîtrises, langues et sorts de départ, calculée en
 * direct depuis `cls/race/bg` (sans toucher au texte libre). Pour un affichage
 * dédié en lecture seule sur la fiche.
 * @returns {{armor, weapons, tools:string[], languages:string[],
 *            casterClass:string, cantrips:number, spellLine:string}}
 */
export function deriveProficiencies(data) {
  const c = classByLabel(data?.cls);
  const r = raceByLabel(data?.race);
  const b = backgroundByLabel(data?.bg);
  const tools = [];
  if (c && CLASS_TOOLS[c.key]) tools.push(CLASS_TOOLS[c.key]);
  if (b && b.tools) tools.push(b.tools);
  const languages = [];
  if (r && RACE_LANGUAGES[r.key]) languages.push(RACE_LANGUAGES[r.key]);
  if (b && b.languages) languages.push(`${b.languages} (historique)`);
  const cast = c ? CLASS_CASTING[c.key] : null;
  return {
    armor: c?.armorProf || '',
    weapons: c?.weaponProf || '',
    tools,
    languages,
    casterClass: c ? c.label : '',
    cantrips: cast ? cast.cantrips : 0,
    spellLine: cast ? cast.line : '',
  };
}

/* ── Multiclassage (couche additive) ──────────────────────────────────────
 * La classe principale reste `data.cls`/`data.lvl`/`data.sub` ; les classes
 * secondaires vivent dans `data.mc = [{cls, sub, lvl}]`. Les fonctions ci-dessous
 * dérivent niveau total, bonus de maîtrise, dés de vie mixtes et emplacements de
 * sorts combinés (table multiclasse PHB 2014). Sauvegardes : de la classe
 * principale uniquement (règle 5e), donc inchangées ici.
 */

/** Toutes les classes SRD de la fiche (principale + secondaires) avec leur niveau. */
function allClassEntries(data) {
  const list = [];
  const p = classByLabel(data?.cls);
  if (p) list.push({ entry: p, lvl: Math.max(1, Number(data?.lvl) || 1), sub: data?.sub || '' });
  for (const e of data?.mc || []) {
    const c = classByLabel(e?.cls);
    if (c) list.push({ entry: c, lvl: Math.max(1, Number(e?.lvl) || 1), sub: e?.sub || '' });
  }
  return list;
}

/** Niveau total du personnage (classe principale + classes secondaires). */
export function totalLevel(data) {
  let t = Math.max(0, Number(data?.lvl) || 0);
  for (const e of data?.mc || []) t += Math.max(0, Number(e?.lvl) || 0);
  return t || 1;
}

/** Bonus de maîtrise pour un niveau total donné (+2 à +6). */
export function profBonusForLevel(total) {
  return 2 + Math.floor((Math.max(1, Number(total) || 1) - 1) / 4);
}

/**
 * Niveau de lanceur combiné (règle multiclasse PHB) : niveaux pleins des lanceurs
 * complets + moitié (arrondi inf.) des demi-lanceurs. La magie de pacte
 * (occultiste) est traitée à part. Renvoie 0 si aucun lanceur « classique ».
 */
export function combinedCasterLevel(data) {
  let ccl = 0;
  for (const { entry, lvl } of allClassEntries(data)) {
    const cast = CLASS_CASTING[entry.key];
    if (!cast) continue;
    if (cast.type === 'full') ccl += lvl;
    else if (cast.type === 'half') ccl += Math.floor(lvl / 2);
  }
  return ccl;
}

/**
 * Emplacements de sorts combinés du personnage multiclassé : table des lanceurs
 * complets indexée par le niveau de lanceur combiné, plus les emplacements de
 * magie de pacte (occultiste) fusionnés dans la même grille.
 * @returns {Object|null} `{ [niveauDeSort]: { m, u } }` ou null.
 */
export function multiclassSpellSlots(data) {
  const out = {};
  const ccl = combinedCasterLevel(data);
  if (ccl > 0) {
    const row = FULL_SLOTS[Math.min(20, ccl)] || [];
    row.forEach((m, i) => {
      if (m > 0) out[i + 1] = { m, u: 0 };
    });
  }
  let warlock = 0;
  for (const { entry, lvl } of allClassEntries(data)) if (entry.key === 'occultiste') warlock += lvl;
  if (warlock > 0) {
    const [cnt, sl] = PACT_SLOTS[Math.min(20, warlock)] || [];
    if (cnt) out[sl] = { m: (out[sl]?.m || 0) + cnt, u: 0 };
  }
  return Object.keys(out).length ? out : null;
}

/** Synthèse des dés de vie mixtes, ex. « 3d10 + 2d6 » (classes SRD uniquement). */
export function hitDiceSummary(data) {
  const dice = {};
  for (const { entry, lvl } of allClassEntries(data)) dice[entry.hd] = (dice[entry.hd] || 0) + lvl;
  return Object.keys(dice)
    .map(Number)
    .sort((a, b) => b - a)
    .map((s) => `${dice[s]}d${s}`)
    .join(' + ');
}

/**
 * Lignes du bloc « aptitudes » géré, dans l'ordre : aptitudes de classe,
 * aptitudes de sous-classe (selon le niveau), aptitudes des classes
 * secondaires (multiclassage), traits de race, capacité d'historique, puis une
 * synthèse des MAÎTRISES (armures/armes/outils), des LANGUES et des SORTS de
 * départ. Pur (lit `cls/sub/mc/race/bg/lvl` de `data`).
 */
export function srdManagedLines(data) {
  const lines = [];
  const c = classByLabel(data?.cls);
  const r = raceByLabel(data?.race);
  const b = backgroundByLabel(data?.bg);
  if (c) lines.push(...featuresToLines(c.features));
  const ds = deriveSubclassPatch(data);
  if (ds) lines.push(...ds.featureLines);
  // Classes secondaires (multiclassage) : aptitudes + sous-classe, par classe.
  for (const e of data?.mc || []) {
    const mc = classByLabel(e?.cls);
    if (!mc) continue;
    const lvl = Math.max(1, Number(e?.lvl) || 1);
    lines.push(`Multiclasse : ${mc.label} (niv.${lvl})`);
    lines.push(...featuresToLines(mc.features));
    const dsm = deriveSubclassPatch({ sub: e?.sub, lvl });
    if (dsm) lines.push(...dsm.featureLines);
  }
  if (r) lines.push(...featuresToLines(r.traits));
  if (b && b.feature) lines.push(`${b.feature.name} — ${b.feature.desc}`);

  // Maîtrises (armures / armes de la classe + outils classe & historique).
  const profParts = [];
  if (c?.armorProf) profParts.push(`Armures : ${c.armorProf}`);
  if (c?.weaponProf) profParts.push(`Armes : ${c.weaponProf}`);
  const tools = [];
  if (c && CLASS_TOOLS[c.key]) tools.push(CLASS_TOOLS[c.key]);
  if (b && b.tools) tools.push(b.tools);
  if (tools.length) profParts.push(`Outils : ${tools.join(' ; ')}`);
  if (profParts.length) lines.push(`Maîtrises — ${profParts.join(' ; ')}`);

  // Langues (race + créneaux « au choix » de l'historique).
  const langs = [];
  if (r && RACE_LANGUAGES[r.key]) langs.push(RACE_LANGUAGES[r.key]);
  if (b && b.languages) langs.push(`${b.languages} (historique)`);
  if (langs.length) lines.push(`Langues — ${langs.join(' ; ')}`);

  // Sorts de départ (lanceurs uniquement).
  if (c && CLASS_CASTING[c.key]) lines.push(`Sorts (${c.label}) — ${CLASS_CASTING[c.key].line}`);

  return lines;
}

/**
 * Champs dérivés d'une race.
 * @returns {{patch:{spd,darkvision,size}, traitsText:string,
 *            abilityDelta:object, abilityChoose:(object|null), fixedSkills:string[]}}
 */
export function deriveRacePatch(data, raceKey) {
  const r = typeof raceKey === 'object' ? raceKey : (RACE_INDEX.get(norm(raceKey)) || raceByLabel(raceKey));
  if (!r) return null;
  return {
    patch: { spd: r.speed, darkvision: r.darkvision, size: r.size },
    traitsText: featuresToLines(r.traits).join('\n'),
    abilityDelta: { ...r.ability },
    abilityChoose: r.abilityChoose ? { ...r.abilityChoose, from: [...r.abilityChoose.from] } : null,
    skillChoose: r.skillChoose ? { ...r.skillChoose } : null,
    fixedSkills: [...(r.fixedSkills || [])],
    hpPerLevel: r.hpPerLevel || 0,
  };
}

/**
 * Champs dérivés d'un historique.
 * @returns {{skills:string[], featureLines:string[], equipment:{nm,qty}[], gold:number}}
 *   featureLines = trait d'historique + note outils/langues, pour le bloc Aptitudes.
 */
export function deriveBackgroundPatch(data, bgKey) {
  const b = typeof bgKey === 'object' ? bgKey : (BG_INDEX.get(norm(bgKey)) || backgroundByLabel(bgKey));
  if (!b) return null;
  const featureLines = [];
  if (b.feature) featureLines.push(`${b.feature.name} — ${b.feature.desc}`);
  const profParts = [];
  if (b.tools) profParts.push(`Outils : ${b.tools}`);
  if (b.languages) profParts.push(`Langues : ${b.languages}`);
  if (profParts.length) featureLines.push(`Historique (${b.label}) — ${profParts.join(' ; ')}`);
  return {
    skills: [...b.skills],
    featureLines,
    equipment: (b.equipment || []).map(([nm, qty]) => ({ nm, qty })),
    gold: b.gold || 0,
  };
}

/**
 * PV max suggérés : max du dé au niveau 1, puis moyenne fixe par niveau, le tout
 * + mod. CON par niveau (minimum 1 PV gagné par niveau).
 */
export function suggestHpMax(data, extraPerLevel = 0) {
  const hd = Number(data?.hdSize) || 8;
  const lvl = Math.max(1, Number(data?.lvl) || 1);
  const con = abilityMod(data?.con);
  const extra = Number(extraPerLevel) || 0; // ex. Robustesse naine : +1 PV/niveau
  const first = Math.max(1, hd + con);
  const perLevel = Math.max(1, Math.floor(hd / 2) + 1 + con);
  return first + (lvl - 1) * perLevel + extra * lvl;
}

/**
 * Applique un delta de caractéristiques racial de façon IDEMPOTENTE : retire le
 * dernier delta racial connu (data._raceMods) avant d'ajouter le nouveau, pour
 * ne jamais empiler en cas de changement de race. Préserve les ajustements
 * manuels du joueur entre deux applications.
 * @returns {{scores:object, _raceMods:object}}
 *   `scores` = uniquement les caractéristiques qui changent.
 */
export function applyRaceMods(data, newDelta) {
  const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const old = data?._raceMods || {};
  const next = newDelta || {};
  const scores = {};
  for (const k of ABIL) {
    const o = Number(old[k]) || 0;
    const n = Number(next[k]) || 0;
    if (o === 0 && n === 0) continue;
    const cur = Number(data?.[k]);
    const base = (Number.isFinite(cur) ? cur : 10) - o;
    const val = Math.max(1, base + n);
    if (val !== cur) scores[k] = val;
  }
  return { scores, _raceMods: { ...next } };
}

/**
 * Fusionne un bloc « aptitudes SRD » géré dans le texte libre `data.feats`.
 * Retire l'ancien bloc (entre marqueurs) puis ré-insère les nouvelles lignes.
 * `srdLines` vide => le bloc est simplement retiré.
 */
export function mergeFeatsBlock(currentFeats, srdLines) {
  const open = SRD_OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const close = SRD_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\n*${open}[\\s\\S]*?${close}`, 'g');
  let base = String(currentFeats || '').replace(re, '').replace(/\s+$/, '');
  const lines = (Array.isArray(srdLines) ? srdLines : String(srdLines || '').split('\n'))
    .map((l) => String(l).trim())
    .filter(Boolean);
  if (!lines.length) return base;
  const block = `${SRD_OPEN}\n${lines.join('\n')}\n${SRD_CLOSE}`;
  return base ? `${base}\n\n${block}` : block;
}

/** Une ligne de texte est-elle un marqueur de bloc SRD ? (pour le filtrage UI) */
export function isSrdMarker(line) {
  const t = String(line || '').trim();
  return t === SRD_OPEN || t === SRD_CLOSE;
}
