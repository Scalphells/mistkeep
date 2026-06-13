/**
 * Système de jeu : Pathfinder 2e (Remaster). Règles de base sous licence ORC.
 *
 * Les maths diffèrent du 5e : la maîtrise est à QUATRE rangs (Qualifié +2,
 * Expert +4, Maître +6, Légendaire +8) auxquels s'ajoute LE NIVEAU du
 * personnage ; les jets de sauvegarde sont trois entrées nommées (Vigueur,
 * Réflexes, Volonté — plus la Perception, traitée pareil) et non un jet par
 * caractéristique. Les rangs vivent dans `data.ranks` ({ clé: 0..4 }, clés de
 * compétences et de sauvegardes confondues — elles ne se recouvrent pas).
 *
 * v1 volontairement sans contenu (ascendance/classe en champs libres) : la
 * fiche calcule juste — listes de compétences, rangs, sauvegardes, niveau.
 */

import { abilityMod as rawMod } from '../rules.js';
import {
  ANCESTRIES, BACKGROUNDS_PF2E, CLASSES_PF2E,
  ancestryByLabel, backgroundByLabelPf2e, classByLabelPf2e,
  deriveAncestryPatch, deriveBackgroundPatchPf2e, deriveClassPatchPf2e, pf2eHpMax,
} from '../pf2e-srd.js';

/** Modificateur tolérant : un score absent vaut 10 (mod +0). */
function abilityMod(score) {
  return rawMod(score === undefined || score === null || score === '' ? 10 : score);
}

export const ABILITIES = [
  { key: 'str', label: 'FOR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'SAG' },
  { key: 'cha', label: 'CHA' },
];

// Compétence -> { label, caractéristique } (les 16 du Remaster).
export const SKILLS = {
  acrobaties: { label: 'Acrobaties', ability: 'dex' },
  arcanes: { label: 'Arcanes', ability: 'int' },
  artisanat: { label: 'Artisanat', ability: 'int' },
  athletisme: { label: 'Athlétisme', ability: 'str' },
  diplomatie: { label: 'Diplomatie', ability: 'cha' },
  discretion: { label: 'Discrétion', ability: 'dex' },
  duperie: { label: 'Duperie', ability: 'cha' },
  intimidation: { label: 'Intimidation', ability: 'cha' },
  larcin: { label: 'Larcin', ability: 'dex' },
  medecine: { label: 'Médecine', ability: 'wis' },
  nature: { label: 'Nature', ability: 'wis' },
  occultisme: { label: 'Occultisme', ability: 'int' },
  religion: { label: 'Religion', ability: 'wis' },
  representation: { label: 'Représentation', ability: 'cha' },
  societe: { label: 'Société', ability: 'int' },
  survie: { label: 'Survie', ability: 'wis' },
};

/** Jets de sauvegarde (entrées nommées) + Perception, tous à rang. */
export const SAVES = [
  { key: 'fort', label: 'Vigueur', ability: 'con' },
  { key: 'ref', label: 'Réflexes', ability: 'dex' },
  { key: 'will', label: 'Volonté', ability: 'wis' },
  { key: 'per', label: 'Perception', ability: 'wis' },
];

/** Rangs de maîtrise (l'index est la valeur stockée dans data.ranks). */
export const PROF_RANKS = [
  { abbr: '—', label: 'Inexpérimenté', bonus: 0 },
  { abbr: 'Q', label: 'Qualifié', bonus: 2 },
  { abbr: 'E', label: 'Expert', bonus: 4 },
  { abbr: 'M', label: 'Maître', bonus: 6 },
  { abbr: 'L', label: 'Légendaire', bonus: 8 },
];

/** Bonus de maîtrise d'un rang : +2 par rang, plus le niveau si entraîné. */
function rankBonus(data, rank) {
  const r = Math.max(0, Math.min(PROF_RANKS.length - 1, Number(rank) || 0));
  return r > 0 ? PROF_RANKS[r].bonus + (Number(data.lvl) || 1) : 0;
}

/** Formate un modificateur signé (+3 / -1 / +0). */
export function fmtMod(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Bonus d'un jet de sauvegarde (mod + rang + niveau si entraîné). */
export function saveBonus(data, saveKey) {
  const sv = SAVES.find((s) => s.key === saveKey);
  if (!sv) return 0;
  return abilityMod(data[sv.ability]) + rankBonus(data, data.ranks?.[saveKey]);
}

/** Bonus d'une compétence (mod + rang + niveau si entraîné). */
export function skillBonus(data, skillKey) {
  const sk = SKILLS[skillKey];
  if (!sk) return 0;
  return abilityMod(data[sk.ability]) + rankBonus(data, data.ranks?.[skillKey]);
}

/** Bonus d'initiative : Perception (le défaut des règles de base). */
export function initBonus(data) {
  return saveBonus(data, 'per');
}

/** Blob `data` par défaut d'une nouvelle fiche pf2e. */
export function createDefaults() {
  return {
    cls: '', race: '', bg: '', align: '', lvl: 1, xp: 0,
    hp: 15, hpMax: 15, hpTmp: 0, ac: 10, spd: 7.5, initB: 0, prof: 0, insp: false,
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    ranks: { fort: 1, ref: 1, will: 1, per: 1 }, // un niveau 1 est Qualifié partout
    saves: [], profs: [], exp: [], atks: [],
    feats: '', equip: '', notes: '', story: '', ds: { s: 0, f: 0 },
    darkvision: 0, size: 'M',
    system: 'pf2e',
  };
}

/** Schéma de fiche : générique, sans dés de vie ni outillage SRD 5e. */
export const SHEET = {
  tabs: ['stats', 'combat', 'inv', 'story', 'notes'],
  rail: ['hp', 'stats', 'saves'],
  identity: 'free',
};

/** Descripteur du système Pathfinder 2e. `saves` (liste nommée) et
 *  `profRanks` déclenchent les variantes à rang du moteur de fiche. */
export const pf2e = {
  id: 'pf2e',
  label: 'Pathfinder 2e',
  abilities: ABILITIES,
  skills: SKILLS,
  saves: SAVES,
  saveOptions: SAVES, // sauvegardes nommées (Vigueur/Réflexes/Volonté/Perception)
  profRanks: PROF_RANKS,
  abilityMod,
  fmtMod,
  saveBonus,
  skillBonus,
  initBonus,
  // pas d'encounterBudget : le budget pf2e (par niveau) diffère du modèle XP 5e.
  createDefaults,
  sheet: SHEET,
  // Contenu d'identité Remaster (ascendances/historiques/classes) + dérivations
  // pures, consommé par le moteur de fiche pf2e (sheet.identity === 'pf2e').
  // Volontairement hors `srd` pour ne pas activer la machinerie SRD 5e.
  content: {
    ancestriesLabel: 'Ascendance',
    ancestries: ANCESTRIES,
    backgrounds: BACKGROUNDS_PF2E,
    classes: CLASSES_PF2E,
    ancestryByLabel,
    backgroundByLabel: backgroundByLabelPf2e,
    classByLabel: classByLabelPf2e,
    deriveAncestryPatch,
    deriveBackgroundPatch: deriveBackgroundPatchPf2e,
    deriveClassPatch: deriveClassPatchPf2e,
    hpMax: pf2eHpMax,
  },
};
