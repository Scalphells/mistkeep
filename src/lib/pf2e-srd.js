/**
 * Contenu Pathfinder 2e (Remaster, Player Core) — sous licence ORC. Données
 * d'identité (ascendances, historiques, classes) et dérivations PURES (aucun
 * DOM/réseau) pour le moteur de fiche pf2e de characters-ui.
 *
 * Modèle de l'app : la fiche pf2e stocke des SCORES (str:10…, mod = (score−10)/2)
 * et des RANGS de maîtrise dans `data.ranks` ({ clé: 0..4 } — 1 Qualifié,
 * 2 Expert…, cf. systems/pf2e.js). Un « boost » d'attribut Remaster vaut +2 au
 * score (= +1 au modificateur). Les PV pf2e = PV d'ascendance + (PV de classe +
 * mod. CON) × niveau.
 *
 * Les textes d'aptitudes sont des RÉSUMÉS (le joueur garde le Player Core pour
 * le détail) ; ascendances/classes couvrent le Player Core 1.
 *
 * Source de référence : Archives of Nethys (2e.aonprd.com), entrées Remaster
 * (Player Core) — chassis vérifié contre AoN (PV, taille, vitesse, vision,
 * boosts d'ascendance ; attribut clé, PV, rangs de Perception/sauvegardes et
 * compétences de classe). NB : le Remaster a supprimé les défauts d'attribut
 * (les « flaws » encore visibles sur AoN sont l'héritage legacy).
 */

import { getLocale } from './i18n.js';
import * as ENPF from './pf2e-srd.en.js';

// Conversion pieds → mètres utilisée par l'app (25 ft ≈ 7,5 m).
const FT = { 20: 6, 25: 7.5, 30: 9 };

/* ── Ascendances (Player Core) ──────────────────────────────────
 * hp = PV d'ascendance ; size 'P' (petite) / 'M' (moyenne) ; speed en mètres ;
 * darkvision en mètres (0 = pas de vision dans le noir, la vision faible est
 * notée en trait) ; boosts = boosts d'attribut FIXES (un boost libre s'ajoute
 * presque toujours, laissé au joueur). */
const ANCESTRIES_FR = [
  {
    key: 'nain', label: 'Nain', hp: 10, size: 'M', speed: FT[20], darkvision: 18,
    boosts: ['con', 'wis'], traits: [
      { name: 'Vision dans le noir', desc: 'Tu vois dans l’obscurité comme en pleine lumière (sans couleurs).' },
      { name: 'Robustesse naine', desc: 'PV d’ascendance élevés (10).' },
    ],
  },
  {
    key: 'elfe', label: 'Elfe', hp: 6, size: 'M', speed: FT[30], darkvision: 0,
    boosts: ['dex', 'int'], traits: [
      { name: 'Vision nocturne', desc: 'Tu ignores la condition « ténèbres légères » (vision faible).' },
      { name: 'Rapidité', desc: 'Vitesse de 9 m, supérieure à la normale.' },
    ],
  },
  {
    key: 'gnome', label: 'Gnome', hp: 8, size: 'P', speed: FT[25], darkvision: 0,
    boosts: ['con', 'cha'], traits: [
      { name: 'Vision nocturne', desc: 'Tu ignores la condition « ténèbres légères ».' },
      { name: 'Petite taille', desc: 'Catégorie de taille P.' },
    ],
  },
  {
    key: 'gobelin', label: 'Gobelin', hp: 6, size: 'P', speed: FT[25], darkvision: 18,
    boosts: ['dex', 'cha'], traits: [
      { name: 'Vision dans le noir', desc: 'Tu vois dans l’obscurité totale.' },
      { name: 'Petite taille', desc: 'Catégorie de taille P.' },
    ],
  },
  {
    key: 'halfelin', label: 'Halfelin', hp: 6, size: 'P', speed: FT[25], darkvision: 0,
    boosts: ['dex', 'wis'], traits: [
      { name: 'Yeux perçants', desc: 'Tu cherches les créatures cachées avec plus d’acuité.' },
      { name: 'Petite taille', desc: 'Catégorie de taille P.' },
    ],
  },
  {
    key: 'humain', label: 'Humain', hp: 8, size: 'M', speed: FT[25], darkvision: 0,
    boosts: [], free: 2, traits: [
      { name: 'Polyvalence', desc: 'Deux boosts d’attribut libres et un don supplémentaire (d’ascendance ou de compétence).' },
    ],
  },
  {
    key: 'leshy', label: 'Leshy', hp: 8, size: 'P', speed: FT[25], darkvision: 0,
    boosts: ['con', 'wis'], traits: [
      { name: 'Vision nocturne', desc: 'Tu ignores la condition « ténèbres légères ».' },
      { name: 'Constitution végétale', desc: 'Créature végétale : tu n’as pas besoin de respirer, manger ni dormir comme les autres.' },
    ],
  },
  {
    key: 'orc', label: 'Orc', hp: 10, size: 'M', speed: FT[25], darkvision: 18,
    boosts: [], free: 2, traits: [ // Player Core : deux boosts libres, aucun fixe
      { name: 'Vision dans le noir', desc: 'Tu vois dans l’obscurité totale.' },
      { name: 'Endurance', desc: 'PV d’ascendance élevés (10).' },
    ],
  },
];

/* ── Historiques (exemples Player Core) ─────────────────────────
 * boosts = deux boosts (souvent une carac. fixe + un libre) ; skills = une
 * compétence entraînée + une compétence de Lore (au choix, libre). */
const BACKGROUNDS_PF2E_FR = [
  { key: 'acolyte', label: 'Acolyte', boosts: ['int', 'wis'], skills: ['religion'], feat: 'Étudiant de la nature ou Connaissances (Religion).' },
  { key: 'artisan', label: 'Artisan', boosts: ['str', 'int'], skills: ['artisanat'], feat: 'Spécialiste de l’artisanat.' },
  { key: 'criminel', label: 'Criminel', boosts: ['dex', 'int'], skills: ['discretion'], feat: 'Expert en filouterie.' },
  { key: 'eclaireur', label: 'Éclaireur', boosts: ['dex', 'wis'], skills: ['survie'], feat: 'Pisteur expérimenté.' },
  { key: 'erudit', label: 'Érudit', boosts: ['int', 'wis'], skills: ['arcanes'], feat: 'Assistant de recherche (savoir au choix).' },
  { key: 'noble', label: 'Noble', boosts: ['int', 'cha'], skills: ['societe'], feat: 'Courtisan averti.' },
  { key: 'soldat', label: 'Soldat', boosts: ['str', 'con'], skills: ['athletisme'], feat: 'Connaissance de la guerre.' },
];

/* ── Classes (Player Core) ──────────────────────────────────────
 * keyAbility = attribut(s) de prédilection (boost de classe) ; hp = PV de
 * classe par niveau ; perception/saves en RANGS (1 Qualifié, 2 Expert) ;
 * skills = nombre de compétences entraînées de départ (en plus du mod. INT). */
const CLASSES_PF2E_FR = [
  { key: 'barbare', label: 'Barbare', keyAbility: ['str'], hp: 12, perception: 2, saves: { fort: 2, ref: 1, will: 2 }, skills: 3,
    features: [{ name: 'Rage', desc: 'Action : tu entres en rage (dégâts supplémentaires, PV temporaires), 1 min, puis fatigue.' }, { name: 'Instinct', desc: 'Ton instinct (animal, dragon, géant…) façonne ta rage.' }] },
  { key: 'barde', label: 'Barde', keyAbility: ['cha'], hp: 8, perception: 2, saves: { fort: 1, ref: 1, will: 2 }, skills: 4,
    features: [{ name: 'Incantation occulte', desc: 'Lanceur spontané occulte (Charisme).' }, { name: 'Muse', desc: 'Une muse (érudition, entretien, raillerie…) accorde un don et un sort.' }] },
  { key: 'champion', label: 'Champion', keyAbility: ['str', 'dex'], hp: 10, perception: 1, saves: { fort: 2, ref: 1, will: 2 }, skills: 2,
    features: [{ name: 'Cause sacrée', desc: 'Ta cause (libérateur, paladin, rédempteur…) définit ta réaction de champion.' }, { name: 'Imposition des mains', desc: 'Sort de soin de champion.' }] },
  { key: 'clerc', label: 'Clerc', keyAbility: ['wis'], hp: 8, perception: 1, saves: { fort: 1, ref: 1, will: 2 }, skills: 2,
    features: [{ name: 'Incantation divine', desc: 'Lanceur préparé divin (Sagesse).' }, { name: 'Doctrine', desc: 'Cure (soins) ou Combat (guerre) ; sorts de domaine de ta divinité.' }] },
  { key: 'druide', label: 'Druide', keyAbility: ['wis'], hp: 8, perception: 1, saves: { fort: 1, ref: 1, will: 2 }, skills: 2,
    features: [{ name: 'Incantation primordiale', desc: 'Lanceur préparé primordial (Sagesse).' }, { name: 'Ordre druidique', desc: 'Un ordre (animal, feuille, flammes, tempête…) accorde un don et un sort.' }] },
  { key: 'guerrier', label: 'Guerrier', keyAbility: ['str', 'dex'], hp: 10, perception: 2, saves: { fort: 2, ref: 2, will: 1 }, skills: 3,
    features: [{ name: 'Maîtrise d’arme', desc: 'Tu es Expert avec un groupe d’armes (le meilleur bonus d’attaque du jeu).' }, { name: 'Attaque d’opportunité', desc: 'Réaction : frappe une créature qui baisse sa garde à ta portée.' }] },
  { key: 'moine', label: 'Moine', keyAbility: ['str', 'dex'], hp: 10, perception: 1, saves: { fort: 2, ref: 2, will: 2 }, skills: 4,
    features: [{ name: 'Arts martiaux', desc: 'Attaques à mains nues améliorées (dé de dégâts, agile, sans armes).' }, { name: 'Puissance ou voie', desc: 'Frappe enflammée (ki) ou un style martial de départ.' }] },
  { key: 'pisteur', label: 'Pisteur', keyAbility: ['str', 'dex'], hp: 10, perception: 2, saves: { fort: 2, ref: 2, will: 1 }, skills: 4,
    features: [{ name: 'Proie du pisteur', desc: 'Action : désigne une proie ; bonus aux Recherches et aux attaques répétées contre elle.' }, { name: 'Disposition de pisteur', desc: 'Précision ou puissance contre ta proie.' }] },
  { key: 'roublard', label: 'Roublard', keyAbility: ['dex'], hp: 8, perception: 2, saves: { fort: 1, ref: 2, will: 2 }, skills: 7,
    features: [{ name: 'Attaque sournoise', desc: '+1d6 (croissant) contre une cible prise au dépourvu ou inapte.' }, { name: 'Tour de filou', desc: 'Une discipline (escroc, voleur, espion…) qui change ton attribut clé et ton talent.' }] },
  { key: 'ensorceleur', label: 'Ensorceleur', keyAbility: ['cha'], hp: 6, perception: 1, saves: { fort: 1, ref: 1, will: 2 }, skills: 2,
    features: [{ name: 'Incantation spontanée', desc: 'Lanceur spontané ; la tradition dépend de ta lignée (Charisme).' }, { name: 'Lignée', desc: 'Une lignée (draconique, élémentaire, fée…) accorde sorts de sang et pouvoirs.' }] },
  { key: 'sorcier', label: 'Sorcier', keyAbility: ['int'], hp: 6, perception: 1, saves: { fort: 1, ref: 1, will: 2 }, skills: 3,
    features: [{ name: 'Incantation', desc: 'Lanceur préparé ; tradition selon ton patron (Intelligence).' }, { name: 'Familier & patron', desc: 'Un familier porteur de tes sorts et un patron qui accorde un sort et une magie de circonstance.' }] },
  { key: 'magicien', label: 'Magicien', keyAbility: ['int'], hp: 6, perception: 1, saves: { fort: 1, ref: 1, will: 2 }, skills: 2,
    features: [{ name: 'Incantation arcanique', desc: 'Lanceur préparé arcanique ; grimoire (Intelligence).' }, { name: 'École ou cursus', desc: 'Une école arcanique (ou le cursus universaliste) accorde un emplacement et des sorts d’école.' }] },
];

/* ── Lookups ────────────────────────────────────────────────── */
/* ── Sélection par locale (données EN générées : pf2e-srd.en.js) ────────── */
const _enLoc = () => getLocale() === 'en';
export const ANCESTRIES = _enLoc() ? ENPF.ANCESTRIES : ANCESTRIES_FR;
export const BACKGROUNDS_PF2E = _enLoc() ? ENPF.BACKGROUNDS_PF2E : BACKGROUNDS_PF2E_FR;
export const CLASSES_PF2E = _enLoc() ? ENPF.CLASSES_PF2E : CLASSES_PF2E_FR;

// Résolution cross-locale : une fiche d'avant l'i18n stocke un libellé FR ; on
// résout via la locale active, puis via l'autre langue (clé stable partagée).
const _normPf = (s) => String(s || '').normalize('NFC').trim().toLowerCase();
const _findPf = (arr, v) => arr.find((e) => _normPf(e.label) === _normPf(v) || _normPf(e.key) === _normPf(v)) || null;
const _xresPf = (active, inactive, v) => {
  if (!v) return null;
  const hit = _findPf(active, v);
  if (hit) return hit;
  const o = _findPf(inactive, v);
  return o ? active.find((e) => e.key === o.key) || null : null;
};
export const ancestryByLabel = (v) => _xresPf(ANCESTRIES, _enLoc() ? ANCESTRIES_FR : ENPF.ANCESTRIES, v);
export const backgroundByLabelPf2e = (v) => _xresPf(BACKGROUNDS_PF2E, _enLoc() ? BACKGROUNDS_PF2E_FR : ENPF.BACKGROUNDS_PF2E, v);
export const classByLabelPf2e = (v) => _xresPf(CLASSES_PF2E, _enLoc() ? CLASSES_PF2E_FR : ENPF.CLASSES_PF2E, v);

/* ── Dérivations PURES ──────────────────────────────────────── */

/** Modificateur d'un score (mod = floor((score−10)/2)), 10 si absent. */
function mod(score) {
  return Math.floor(((score === undefined || score === null || score === '' ? 10 : Number(score)) - 10) / 2);
}

/**
 * Champs dérivés d'une ascendance.
 * @returns {{patch:{size,spd,darkvision}, ancestryHp, boosts:string[], free:number, traitsText:string[]}|null}
 */
export function deriveAncestryPatch(data, anc) {
  if (!anc) return null;
  return {
    patch: { size: anc.size, spd: anc.speed, darkvision: anc.darkvision || 0 },
    ancestryHp: anc.hp,
    boosts: anc.boosts || [],
    free: anc.free || 0,
    traitsText: (anc.traits || []).map((t) => `${t.name} — ${t.desc}`),
  };
}

/**
 * Champs dérivés d'un historique.
 * @returns {{boosts:string[], trainedSkills:string[], featText:string}|null}
 */
export function deriveBackgroundPatchPf2e(data, bg) {
  if (!bg) return null;
  return { boosts: bg.boosts || [], trainedSkills: bg.skills || [], featText: bg.feat || '' };
}

/**
 * Champs dérivés d'une classe : rangs de Perception/sauvegardes, PV de classe,
 * attribut clé, nombre de compétences entraînées, aptitudes de départ.
 * @returns {{keyAbility:string[], classHp:number, ranks:object, skillsTrained:number, featuresText:string[]}|null}
 */
export function deriveClassPatchPf2e(data, cls) {
  if (!cls) return null;
  return {
    keyAbility: cls.keyAbility || [],
    classHp: cls.hp,
    ranks: { per: cls.perception, fort: cls.saves.fort, ref: cls.saves.ref, will: cls.saves.will },
    skillsTrained: cls.skills,
    featuresText: (cls.features || []).map((f) => `${f.name} — ${f.desc}`),
  };
}

/**
 * PV maximum pf2e = PV d'ascendance + (PV de classe + mod. CON) × niveau.
 * Le total ne descend pas sous 1.
 */
export function pf2eHpMax(ancestryHp, classHp, level, conScore) {
  const lvl = Math.max(1, Number(level) || 1);
  const perLvl = Math.max(0, (Number(classHp) || 0) + mod(conScore));
  return Math.max(1, (Number(ancestryHp) || 0) + perLvl * lvl);
}

// Libellés courts d'attributs (pour les recommandations de boosts).
const AB_LABEL = { str: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'SAG', cha: 'CHA' };
const abList = (keys) => keys.map((k) => AB_LABEL[k] || k).join(', ');

/**
 * Bloc « aptitudes » géré d'une fiche pf2e : traits d'ascendance, aptitudes de
 * classe, aptitude d'historique et recommandations de boosts d'attribut. Pur et
 * idempotent (recalculé en entier depuis l'ascendance/classe/historique
 * courants) — destiné à être inséré via mergeFeatsBlock, comme le 5e.
 * @param {object} data fiche
 * @param {{ancestryByLabel,classByLabel,backgroundByLabel}} lk lookups pf2e
 */
export function pf2eManagedLines(data, lk) {
  const lines = [];
  const anc = lk.ancestryByLabel(data?.race);
  if (anc) {
    lines.push(...(anc.traits || []).map((t) => `${t.name} — ${t.desc}`));
    const boosts = anc.boosts || [];
    const recs = [];
    if (boosts.length) recs.push(`+2 ${abList(boosts)}`);
    if (anc.free) recs.push(`${anc.free} boost(s) libre(s)`);
    if (recs.length) lines.push(`Boosts d'ascendance : ${recs.join(' · ')}`);
  }
  const cls = lk.classByLabel(data?.cls);
  if (cls) {
    lines.push(...(cls.features || []).map((f) => `${f.name} — ${f.desc}`));
    lines.push(`Attribut clé : ${abList(cls.keyAbility || [])}${(cls.keyAbility || []).length > 1 ? ' (au choix)' : ''} · ${cls.skills} compétence(s) entraînée(s) + mod. INT`);
  }
  const bg = lk.backgroundByLabel(data?.bg);
  if (bg) {
    const recs = [];
    if ((bg.boosts || []).length) recs.push(`+2 ${abList(bg.boosts)}`);
    lines.push(`Historique — ${bg.feat}${recs.length ? ` (boosts : ${recs.join(', ')})` : ''}`);
  }
  return lines;
}
