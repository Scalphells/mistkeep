import { escapeHtml } from './utils.js';
import { t } from './i18n.js';
import { activeCampaign } from './campaigns.js';

/**
 * États (conditions) par système de jeu, avec icônes. Partagé entre le tracker
 * de combat et l'affichage des jetons de la carte. Le nom `n` (français) reste
 * l'IDENTIFIANT stable (stocké/synchronisé/comparé) ; l'affichage passe par
 * condLabel() (cf. clés cond.* dans les dictionnaires). `desc` = clé i18n de la
 * règle (tooltip). `valued` = la condition porte une valeur numérique (PF2e).
 *
 * Le jeu actif est choisi par le système de la campagne (systemConditions()) ;
 * la résolution d'un état stocké retombe sur l'autre jeu si besoin (condDef).
 *
 * Logos custom : dépose un fichier `public/icons/status/<slug>.svg` puis ajoute
 * le `slug` à CUSTOM_STATUS_ICONS ci-dessous. L'app affiche alors l'image à la
 * place de l'emoji (repli automatique sur l'emoji si non listé / absent).
 */

// ── D&D 5e (2014 / 2024) ──────────────────────────────────────
export const COND_5E = [
  { n: 'Aveuglé', i: '🙈', slug: 'blinded', desc: 'cond.blinded.desc' },
  { n: 'Charmé', i: '💗', slug: 'charmed', desc: 'cond.charmed.desc' },
  { n: 'Assourdi', i: '🔇', slug: 'deafened', desc: 'cond.deafened.desc' },
  { n: 'Effrayé', i: '😱', slug: 'frightened', desc: 'cond.frightened.desc' },
  { n: 'Agrippé', i: '✊', slug: 'grappled', desc: 'cond.grappled.desc' },
  { n: 'Entravé', i: '🕸', slug: 'restrained', desc: 'cond.restrained.desc' },
  { n: 'Empoisonné', i: '🤢', slug: 'poisoned', desc: 'cond.poisoned.desc' },
  { n: 'À terre', i: '⬇️', slug: 'prone', desc: 'cond.prone.desc' },
  { n: 'Neutralisé', i: '🚫', slug: 'incapacitated', desc: 'cond.incapacitated.desc' },
  { n: 'Étourdi', i: '💫', slug: 'stunned', desc: 'cond.stunned.desc' },
  { n: 'Paralysé', i: '🥶', slug: 'paralyzed', desc: 'cond.paralyzed.desc' },
  { n: 'Pétrifié', i: '🗿', slug: 'petrified', desc: 'cond.petrified.desc' },
  { n: 'Inconscient', i: '😵', slug: 'unconscious', desc: 'cond.unconscious.desc' },
  { n: 'Invisible', i: '👻', slug: 'invisible', desc: 'cond.invisible.desc' },
  { n: 'Épuisement', i: '🥵', slug: 'exhaustion', desc: 'cond.exhaustion.desc' },
  { n: 'Concentration', i: '🧠', slug: 'concentration', desc: 'cond.concentration.desc' },
];

// ── Pathfinder 2e ─────────────────────────────────────────────
// `valued: true` = la condition porte une valeur (Effrayé 1, Ralenti 2…).
export const COND_PF2E = [
  { n: 'Aveuglé', i: '🙈', slug: 'blinded', desc: 'condpf.blinded.desc' },
  { n: 'Pris au dépourvu', i: '🛡', slug: 'offguard', desc: 'condpf.offguard.desc' },
  { n: 'Caché', i: '🌫', slug: 'hidden', desc: 'condpf.hidden.desc' },
  { n: 'Dissimulé', i: '👤', slug: 'concealed', desc: 'condpf.concealed.desc' },
  { n: 'Maladroit', i: '🤸', slug: 'clumsy', valued: true, desc: 'condpf.clumsy.desc' },
  { n: 'Confus', i: '😵‍💫', slug: 'confused', desc: 'condpf.confused.desc' },
  { n: 'Contrôlé', i: '🎭', slug: 'controlled', desc: 'condpf.controlled.desc' },
  { n: 'Ébloui', i: '✨', slug: 'dazzled', desc: 'condpf.dazzled.desc' },
  { n: 'Assourdi', i: '🔇', slug: 'deafened', desc: 'condpf.deafened.desc' },
  { n: 'Affaibli', i: '💪', slug: 'enfeebled', valued: true, desc: 'condpf.enfeebled.desc' },
  { n: 'Effrayé', i: '😱', slug: 'frightened', valued: true, desc: 'condpf.frightened.desc' },
  { n: 'Empoigné', i: '✊', slug: 'grabbed', desc: 'condpf.grabbed.desc' },
  { n: 'Immobilisé', i: '⛓', slug: 'immobilized', desc: 'condpf.immobilized.desc' },
  { n: 'Drainé', i: '🩸', slug: 'drained', valued: true, desc: 'condpf.drained.desc' },
  { n: 'Mourant', i: '💀', slug: 'dying', valued: true, desc: 'condpf.dying.desc' },
  { n: 'Condamné', i: '☠️', slug: 'doomed', valued: true, desc: 'condpf.doomed.desc' },
  { n: 'Fasciné', i: '😍', slug: 'fascinated', desc: 'condpf.fascinated.desc' },
  { n: 'Fatigué', i: '🥱', slug: 'fatigued', desc: 'condpf.fatigued.desc' },
  { n: 'En fuite', i: '🏃', slug: 'fleeing', desc: 'condpf.fleeing.desc' },
  { n: 'Écœuré', i: '🤮', slug: 'sickened', valued: true, desc: 'condpf.sickened.desc' },
  { n: 'Ralenti', i: '🐌', slug: 'slowed', valued: true, desc: 'condpf.slowed.desc' },
  { n: 'Hébété', i: '💫', slug: 'stunned', valued: true, desc: 'condpf.stunned.desc' },
  { n: 'Stupéfait', i: '🌀', slug: 'stupefied', valued: true, desc: 'condpf.stupefied.desc' },
  { n: 'À terre', i: '⬇️', slug: 'prone', desc: 'condpf.prone.desc' },
  { n: 'Entravé', i: '🕸', slug: 'restrained', desc: 'condpf.restrained.desc' },
  { n: 'Inconscient', i: '😵', slug: 'unconscious', desc: 'condpf.unconscious.desc' },
  { n: 'Accéléré', i: '⚡', slug: 'quickened', desc: 'condpf.quickened.desc' },
  { n: 'Encombré', i: '🎒', slug: 'encumbered', desc: 'condpf.encumbered.desc' },
  { n: 'Blessé', i: '❤️‍🩹', slug: 'wounded', valued: true, desc: 'condpf.wounded.desc' },
];

/** Jeu d'états par identifiant de système. */
const COND_BY_SYSTEM = {
  'dnd5e-2014': COND_5E,
  'dnd5e-2024': COND_5E,
  pf2e: COND_PF2E,
  custom: COND_5E,
};

/** Compat : ancien export (jeu 5e). Le tracker passe par systemConditions(). */
export const CONDITIONS = COND_5E;

/** Liste d'états du système actif (repli 5e hors campagne). */
export function systemConditions() {
  return COND_BY_SYSTEM[activeCampaign()?.system] || COND_5E;
}

/** Définition d'un état stocké : système actif d'abord, puis repli inter-jeux. */
export function condDef(name) {
  return (
    systemConditions().find((c) => c.n === name) ||
    COND_5E.find((c) => c.n === name) ||
    COND_PF2E.find((c) => c.n === name) ||
    null
  );
}

/** Dossier des logos custom (fichiers `<slug>.svg`). */
export const STATUS_ICON_BASE = '/icons/status';

/**
 * Slugs ayant un logo custom déposé dans `public/icons/status/`.
 * Ajoute ici le slug une fois le fichier `<slug>.svg` en place. Vide = tout en
 * emoji (comportement par défaut).
 */
export const CUSTOM_STATUS_ICONS = new Set([
  // Échantillon « style affiné » (les autres restent en emoji pour l'instant).
  'poisoned', 'frightened', 'invisible', 'exhaustion',
]);

/** Libellé traduit d'un état (le nom `n` reste l'identifiant de données). */
export function condLabel(name) {
  const c = condDef(name);
  return c ? t('cond.' + c.slug) : name;
}

/** Emoji (texte) d'un état — pour les contextes sans HTML (ex. <option>). */
export function condIcon(name) {
  return condDef(name)?.i || '🔹';
}

/** Slug technique d'un état (ou null). */
export function condSlug(name) {
  return condDef(name)?.slug || null;
}

/** Texte de règle (tooltip) d'un état, ou chaîne vide. */
export function condDesc(name) {
  const c = condDef(name);
  return c?.desc ? t(c.desc) : '';
}

/** Vrai si l'état porte une valeur numérique (PF2e). */
export function condValued(name) {
  return !!condDef(name)?.valued;
}

/** Logo custom (<img>) si déposé pour ce slug, sinon l'emoji fourni. */
export function statusIconHtml(slug, emoji, label) {
  if (slug && CUSTOM_STATUS_ICONS.has(slug)) {
    const tt = escapeHtml(label || slug);
    return `<img class="cond-ico" src="${STATUS_ICON_BASE}/${slug}.svg" alt="${tt}" title="${tt}" loading="lazy">`;
  }
  return emoji || '🔹';
}

/** Icône d'affichage d'un état par son nom : logo custom si présent, sinon emoji. */
export function condIconHtml(name) {
  const c = condDef(name);
  return statusIconHtml(c?.slug, c?.i, condLabel(name));
}
