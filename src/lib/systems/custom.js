/**
 * Système « Libre » : fiche générique sans règles embarquées, pour jouer un
 * JdR non couvert par un module dédié. Modificateur = (score − 10) / 2
 * (familier et lisible), identité en champs libres — et pas d'onglet sorts,
 * pas de dés de vie, pas d'outillage SRD (cf. `sheet`).
 *
 * CONFIGURABLE PAR CAMPAGNE : le MJ peut définir SES caractéristiques et
 * compétences (éditeur dans le gestionnaire de campagnes). La config vit dans
 * `session_state['system_config']` (scopée campagne, écriture MJ, realtime) et
 * est injectée ici via setCustomConfig() — cf. systems/config.js. Sans config,
 * les listes génériques ci-dessous servent de défaut. Ce module reste pur
 * (aucune E/S) : il reçoit la config, il ne la charge pas.
 */

import { abilityMod as rawMod } from '../rules.js';

/** Modificateur tolérant : un score absent vaut 10 (mod +0). */
function abilityMod(score) {
  return rawMod(score === undefined || score === null || score === '' ? 10 : score);
}

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

/* ── Config par campagne ────────────────────────────────────── */

// Clés de fiche réservées : une caractéristique custom ne peut pas écraser un
// champ structurel du blob `data`.
const RESERVED_KEYS = new Set([
  'cls', 'sub', 'race', 'bg', 'align', 'lvl', 'xp', 'hp', 'hpMax', 'hpTmp',
  'ac', 'spd', 'initB', 'prof', 'insp', 'saves', 'profs', 'exp', 'atks',
  'sc', 'slots', 'spells', 'feats', 'equip', 'notes', 'story', 'ds',
  'darkvision', 'size', 'hd', 'hdMax', 'hdSize', 'system', 'portrait', 'exh', 'player',
]);

/** Libellé sûr pour insertion dans les gabarits HTML de la fiche. */
function cleanLabel(v, max = 30) {
  return String(v || '').replace(/[<>&"']/g, '').trim().slice(0, max);
}

/** Clé technique sûre (slug court, jamais une clé réservée). */
function cleanKey(v) {
  const k = String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents (é -> e)
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 20);
  return !k || RESERVED_KEYS.has(k) ? '' : k;
}

/** Clé technique dérivée d'un libellé (pour l'éditeur de système). */
export function slugKey(label) {
  return cleanKey(label);
}

/** Normalise une config brute { abilities, skills } ; null si inexploitable. */
export function normalizeConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;
  const abilities = [];
  const seen = new Set();
  for (const a of Array.isArray(cfg.abilities) ? cfg.abilities : []) {
    const key = cleanKey(a?.key);
    const label = cleanLabel(a?.label, 12);
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    abilities.push({ key, label });
  }
  if (!abilities.length) return null;
  const skills = {};
  for (const [rawK, s] of Object.entries(cfg.skills && typeof cfg.skills === 'object' ? cfg.skills : {})) {
    const key = cleanKey(rawK);
    const label = cleanLabel(s?.label);
    if (!key || !label || !seen.has(s?.ability) || skills[key]) continue;
    skills[key] = { label, ability: s.ability };
  }
  return { abilities, skills };
}

let _config = null; // config normalisée de la campagne active (ou null = défauts)

/** Injecte la config de la campagne active (systems/config.js). */
export function setCustomConfig(cfg) {
  _config = normalizeConfig(cfg);
}

function effAbilities() {
  return _config?.abilities || ABILITIES;
}

function effSkills() {
  return _config ? _config.skills : SKILLS;
}

/* ── Calculs ────────────────────────────────────────────────── */

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
  const sk = effSkills()[skillKey];
  if (!sk) return 0;
  const mod = abilityMod(data[sk.ability]);
  const p = Number(data.prof || 0);
  if ((data.exp || []).includes(skillKey)) return mod + p * 2;
  if ((data.profs || []).includes(skillKey)) return mod + p;
  return mod;
}

/** Blob `data` par défaut d'une nouvelle fiche « Libre » (scores à 10 sur les
 *  caractéristiques EFFECTIVES — celles de la config de la campagne). */
export function createDefaults() {
  const scores = Object.fromEntries(effAbilities().map((a) => [a.key, 10]));
  return {
    cls: '', race: '', bg: '', align: '', lvl: 1, xp: 0,
    hp: 10, hpMax: 10, hpTmp: 0, ac: 10, spd: 9, initB: 0, prof: 2, insp: false,
    ...scores,
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

/** Descripteur du système « Libre ». abilities/skills sont des accesseurs :
 *  ils reflètent la config de la campagne active dès qu'elle est injectée. */
export const custom = {
  id: 'custom',
  label: 'Libre (générique)',
  get abilities() {
    return effAbilities();
  },
  get skills() {
    return effSkills();
  },
  abilityMod,
  fmtMod,
  saveBonus,
  skillBonus,
  createDefaults,
  sheet: SHEET,
};
