/**
 * Système de jeu : D&D 5e (SRD 2014). Première implémentation derrière l'interface
 * « Système » (cf. systems/index.js). Pur (pas de DOM/Supabase) → testable.
 *
 * Un descripteur de système expose le contrat dont la fiche et les jets ont besoin :
 *   - abilities : liste des caractéristiques { key, label }
 *   - skills    : { clé: { label, ability } }
 *   - abilityMod / fmtMod / saveBonus / skillBonus : calculs dérivés
 *   - createDefaults() : blob `data` initial d'une nouvelle fiche
 * Les futurs systèmes (pf2e, D&D 5e 2024, custom) fourniront le même contrat, ce
 * qui permettra à une campagne de choisir son système sans coder le 5e en dur.
 */

import { abilityMod } from '../rules.js';

export const ABILITIES = [
  { key: 'str', label: 'FOR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'SAG' },
  { key: 'cha', label: 'CHA' },
];

// Compétence -> { label, caractéristique }
export const SKILLS = {
  acrobatics:   { label: 'Acrobaties', ability: 'dex' },
  animal:       { label: 'Dressage', ability: 'wis' },
  arcana:       { label: 'Arcanes', ability: 'int' },
  athletics:    { label: 'Athlétisme', ability: 'str' },
  deception:    { label: 'Tromperie', ability: 'cha' },
  history:      { label: 'Histoire', ability: 'int' },
  insight:      { label: 'Perspicacité', ability: 'wis' },
  intimidation: { label: 'Intimidation', ability: 'cha' },
  investigation:{ label: 'Investigation', ability: 'int' },
  medicine:     { label: 'Médecine', ability: 'wis' },
  nature:       { label: 'Nature', ability: 'int' },
  perception:   { label: 'Perception', ability: 'wis' },
  performance:  { label: 'Représentation', ability: 'cha' },
  persuasion:   { label: 'Persuasion', ability: 'cha' },
  religion:     { label: 'Religion', ability: 'int' },
  sleight:      { label: 'Escamotage', ability: 'dex' },
  stealth:      { label: 'Discrétion', ability: 'dex' },
  survival:     { label: 'Survie', ability: 'wis' },
};

/** Formate un modificateur signé (+3 / -1 / +0). */
export function fmtMod(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Bonus d'un jet de sauvegarde (mod + maîtrise si applicable). */
export function saveBonus(data, abilityKey) {
  const mod = abilityMod(data[abilityKey]);
  const prof = (data.saves || []).includes(abilityKey) ? Number(data.prof || 0) : 0;
  return mod + prof;
}

/** Bonus d'une compétence (mod + maîtrise, + expertise si listée). */
export function skillBonus(data, skillKey) {
  const sk = SKILLS[skillKey];
  if (!sk) return 0;
  const mod = abilityMod(data[sk.ability]);
  const p = Number(data.prof || 0);
  if ((data.exp || []).includes(skillKey)) return mod + p * 2;
  if ((data.profs || []).includes(skillKey)) return mod + p;
  return mod;
}

/** Blob `data` par défaut d'une nouvelle fiche 5e-2014. */
export function createDefaults() {
  return {
    cls: '', sub: '', lvl: 1, race: '', bg: '', align: '',
    hp: 10, hpMax: 10, hpTmp: 0, ac: 10, spd: 9, initB: 0, prof: 2, insp: false,
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    saves: [], profs: [], exp: [], atks: [], sc: null, slots: {}, spells: [],
    feats: '', equip: '', notes: '', story: '', ds: { s: 0, f: 0 }, xp: 0,
    darkvision: 0, size: 'M', hdSize: 8,
    system: 'dnd5e-2014', // système de jeu de la fiche (cf. systems/index.js)
  };
}

/** Descripteur du système D&D 5e (2014). */
export const dnd5e2014 = {
  id: 'dnd5e-2014',
  label: 'D&D 5e (2014)',
  abilities: ABILITIES,
  skills: SKILLS,
  abilityMod,
  fmtMod,
  saveBonus,
  skillBonus,
  createDefaults,
};
