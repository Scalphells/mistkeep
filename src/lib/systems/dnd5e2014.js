/**
 * Système de jeu : D&D 5e (SRD 2014). Première implémentation derrière l'interface
 * « Système » (cf. systems/index.js). Pur (pas de DOM/Supabase) → testable.
 *
 * Un descripteur de système expose le contrat dont la fiche et les jets ont besoin :
 *   - abilities : liste des caractéristiques { key, label }
 *   - skills    : { clé: { label, ability } }
 *   - saveOptions : entrées proposables pour un jet de sauvegarde { key, label }
 *                   (= les caractéristiques en 5e ; des sauvegardes nommées en pf2e)
 *   - abilityMod / fmtMod / saveBonus / skillBonus : calculs dérivés
 *   - initBonus(data) : bonus d'initiative du système (mod. de Dex en 5e)
 *   - encounterBudget : le constructeur de rencontre sait chiffrer ce système
 *   - createDefaults() : blob `data` initial d'une nouvelle fiche
 * Les futurs systèmes (pf2e, D&D 5e 2024, custom) fourniront le même contrat, ce
 * qui permettra à une campagne de choisir son système sans coder le 5e en dur.
 */

import { abilityMod } from '../rules.js';
import { t } from '../i18n.js';

// Libellés résolus via i18n au rendu (FOR/SAG en FR, STR/WIS en EN). La clé
// (str/dex/…) et la caractéristique d'une compétence restent stables.
const _ABBR = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITIES = _ABBR.map((key) => ({
  key,
  get label() {
    return t('sys.abbr.' + key);
  },
}));

// Compétence -> { label (i18n), caractéristique }
const _SKILL_ABILITY = {
  acrobatics: 'dex', animal: 'wis', arcana: 'int', athletics: 'str', deception: 'cha',
  history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis',
  nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int',
  sleight: 'dex', stealth: 'dex', survival: 'wis',
};
export const SKILLS = Object.fromEntries(
  Object.entries(_SKILL_ABILITY).map(([k, ability]) => [
    k,
    {
      ability,
      get label() {
        return t('sys.skill5e.' + k);
      },
    },
  ])
);

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

/** Bonus d'initiative : modificateur de Dextérité (NaN → 0 si la carac manque). */
export function initBonus(data) {
  return abilityMod(data?.dex) || 0;
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

/**
 * Schéma de la fiche : ce que l'UI assemble pour ce système. La fiche
 * (characters-ui) possède un moteur de sections ; chaque système déclare
 * lesquelles il utilise et dans quel ordre.
 *   - tabs     : onglets du panneau principal, parmi
 *                'stats' | 'combat' | 'spells' | 'feats' | 'inv' | 'story' | 'notes'
 *   - rail     : blocs de la colonne gauche, parmi
 *                'hp' | 'hitdice' | 'stats' | 'extras' | 'saves'
 *   - identity : variante du bloc d'identité — 'srd5e' (sélecteurs
 *                race/classe/historique + multiclassage + montée de niveau +
 *                maîtrises SRD) ou 'free' (champs libres, systèmes custom).
 */
export const SHEET = {
  tabs: ['stats', 'combat', 'spells', 'feats', 'inv', 'story', 'notes'],
  rail: ['hp', 'hitdice', 'stats', 'extras', 'saves'],
  identity: 'srd5e',
};

/** Descripteur du système D&D 5e (2014). */
export const dnd5e2014 = {
  id: 'dnd5e-2014',
  label: 'D&D 5e (2014)',
  abilities: ABILITIES,
  skills: SKILLS,
  saveOptions: ABILITIES, // un jet de sauvegarde par caractéristique
  abilityMod,
  fmtMod,
  saveBonus,
  skillBonus,
  initBonus,
  encounterBudget: true, // budget XP/FP du DMG 2014
  createDefaults,
  sheet: SHEET,
};
