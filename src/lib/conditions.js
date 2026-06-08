import { escapeHtml } from './utils.js';

/**
 * États (conditions) D&D 5e 2014, avec icônes. Partagé entre le tracker de
 * combat et l'affichage des jetons de la carte.
 *
 * Logos custom : dépose un fichier `public/icons/status/<slug>.svg` puis ajoute
 * le `slug` à CUSTOM_STATUS_ICONS ci-dessous. L'app affiche alors l'image à la
 * place de l'emoji (repli automatique sur l'emoji si non listé / absent).
 */

export const CONDITIONS = [
  { n: 'Aveuglé', i: '🙈', slug: 'blinded' },
  { n: 'Charmé', i: '💗', slug: 'charmed' },
  { n: 'Assourdi', i: '🔇', slug: 'deafened' },
  { n: 'Effrayé', i: '😱', slug: 'frightened' },
  { n: 'Agrippé', i: '✊', slug: 'grappled' },
  { n: 'Entravé', i: '🕸', slug: 'restrained' },
  { n: 'Empoisonné', i: '🤢', slug: 'poisoned' },
  { n: 'À terre', i: '⬇️', slug: 'prone' },
  { n: 'Neutralisé', i: '🚫', slug: 'incapacitated' },
  { n: 'Étourdi', i: '💫', slug: 'stunned' },
  { n: 'Paralysé', i: '🥶', slug: 'paralyzed' },
  { n: 'Pétrifié', i: '🗿', slug: 'petrified' },
  { n: 'Inconscient', i: '😵', slug: 'unconscious' },
  { n: 'Invisible', i: '👻', slug: 'invisible' },
  { n: 'Épuisement', i: '🥵', slug: 'exhaustion' },
  { n: 'Concentration', i: '🧠', slug: 'concentration' },
];

/** Dossier des logos custom (fichiers `<slug>.svg`). */
export const STATUS_ICON_BASE = '/icons/status';

/**
 * Slugs ayant un logo custom déposé dans `public/icons/status/`.
 * Ajoute ici le slug une fois le fichier `<slug>.svg` en place. Vide = tout en
 * emoji (comportement par défaut).
 */
export const CUSTOM_STATUS_ICONS = new Set([
  // 'poisoned', 'prone', 'stunned', 'paralyzed', 'frightened', ...
]);

const _byName = Object.fromEntries(CONDITIONS.map((c) => [c.n, c]));

/** Emoji (texte) d'un état — pour les contextes sans HTML (ex. <option>). */
export function condIcon(name) {
  return _byName[name]?.i || '🔹';
}

/** Slug technique d'un état (ou null). */
export function condSlug(name) {
  return _byName[name]?.slug || null;
}

/** Logo custom (<img>) si déposé pour ce slug, sinon l'emoji fourni. */
export function statusIconHtml(slug, emoji, label) {
  if (slug && CUSTOM_STATUS_ICONS.has(slug)) {
    const t = escapeHtml(label || slug);
    return `<img class="cond-ico" src="${STATUS_ICON_BASE}/${slug}.svg" alt="${t}" title="${t}" loading="lazy">`;
  }
  return emoji || '🔹';
}

/** Icône d'affichage d'un état par son nom : logo custom si présent, sinon emoji. */
export function condIconHtml(name) {
  const c = _byName[name];
  return statusIconHtml(c?.slug, c?.i, name);
}
