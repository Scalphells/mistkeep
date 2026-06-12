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
 *   - CLASSES : les mêmes douze (stats de base inchangées), avec la
 *     sous-classe unique du SRD 5.2, débloquée au niveau 3 pour toutes.
 * v1 : les textes détaillés d'aptitudes 2024 ne sont pas embarqués (ceux de
 * 2014 seraient subtilement faux) — l'auto-application couvre les stats.
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
// carac. d'incantation, progressions). Le SRD 5.2 embarque UNE sous-classe
// par classe ; en 2024 TOUTES se débloquent au niveau 3.

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

// v1 : features 2014 retirées (textes subtilement différents en 2024) — le
// gabarit ⚙ applique DV/sauvegardes/incantation/emplacements, inchangés.
export const CLASSES_2024 = CLASSES_5E.map((c) => ({
  ...c,
  features: [],
  subclasses: SUBCLASS_BY_CLASS[c.key] ? [SUBCLASS_BY_CLASS[c.key]] : [],
}));

export const SUBCLASSES_2024 = Object.fromEntries(
  Object.entries(SUBCLASS_BY_CLASS).map(([classKey, label]) => [
    label,
    { classKey, features: [] }, // v1 : pas de texte d'aptitudes embarqué
  ])
);
