/**
 * Système « Libre » : fiche générique sans règles embarquées, pour jouer un
 * JdR non couvert par un module dédié. Six caractéristiques génériques sur
 * base 10 (modificateur = (score − 10) / 2, familier et lisible), une liste
 * courte de compétences, identité en champs libres — et pas d'onglet sorts,
 * pas de dés de vie, pas d'outillage SRD (cf. `sheet`).
 *
 * Premier consommateur non-5e de l'interface Système : il prouve que la
 * fiche s'assemble entièrement depuis le descripteur. (Évolution prévue :
 * caractéristiques/compétences configurables par campagne.)
 */

import { abilityMod } from '../rules.js';

export const ABILITIES = [
  { key: 'phy', label: 'PHY' }, // Physique
  { key: 'agi', label: 'AGI' }, // Agilité
  { key: 'men', label: 'MEN' }, // Mental
  { key: 'per', label: 'PER' }, // Perception
  { key: 'soc', label: 'SOC' }, // Social
  { key: 'vol', label: 'VOL' }, // Volonté
];

// Compétence -> { label, caractéristique }
export const SKILLS = {
  athletisme: { label: 'Athlétisme', ability: 'phy' },
  adresse: { label: 'Adresse', ability: 'agi' },
  discretion: { label: 'Discrétion', ability: 'agi' },
  savoir: { label: 'Savoir', ability: 'men' },
  bricolage: { label: 'Bricolage', ability: 'men' },
  observation: { label: 'Observation', ability: 'per' },
  intuition: { label: 'Intuition', ability: 'per' },
  survie: { label: 'Survie', ability: 'per' },
  persuasion: { label: 'Persuasion', ability: 'soc' },
  intimidation: { label: 'Intimidation', ability: 'soc' },
  sangfroid: { label: 'Sang-froid', ability: 'vol' },
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

/** Blob `data` par défaut d'une nouvelle fiche « Libre ». */
export function createDefaults() {
  return {
    cls: '', race: '', bg: '', align: '', lvl: 1, xp: 0,
    hp: 10, hpMax: 10, hpTmp: 0, ac: 10, spd: 9, initB: 0, prof: 2, insp: false,
    phy: 10, agi: 10, men: 10, per: 10, soc: 10, vol: 10,
    saves: [], profs: [], exp: [], atks: [],
    feats: '', equip: '', notes: '', story: '', ds: { s: 0, f: 0 },
    darkvision: 0, size: 'M', // la carte (vision/taille des jetons) reste utilisable
    system: 'custom',
  };
}

/** Schéma de fiche : le sous-ensemble générique (cf. systems/dnd5e2014.js). */
export const SHEET = {
  tabs: ['stats', 'combat', 'inv', 'story', 'notes'],
  rail: ['hp', 'stats', 'saves'],
  identity: 'free',
};

/** Descripteur du système « Libre ». */
export const custom = {
  id: 'custom',
  label: 'Libre (générique)',
  abilities: ABILITIES,
  skills: SKILLS,
  abilityMod,
  fmtMod,
  saveBonus,
  skillBonus,
  createDefaults,
  sheet: SHEET,
};
