/**
 * États (conditions) D&D 5e 2014, avec icônes. Partagé entre le tracker de
 * combat et l'affichage des jetons de la carte.
 */

export const CONDITIONS = [
  { n: 'Aveuglé', i: '🙈' },
  { n: 'Charmé', i: '💗' },
  { n: 'Assourdi', i: '🔇' },
  { n: 'Effrayé', i: '😱' },
  { n: 'Agrippé', i: '✊' },
  { n: 'Entravé', i: '🕸' },
  { n: 'Empoisonné', i: '🤢' },
  { n: 'À terre', i: '⬇️' },
  { n: 'Neutralisé', i: '🚫' },
  { n: 'Étourdi', i: '💫' },
  { n: 'Paralysé', i: '🥶' },
  { n: 'Pétrifié', i: '🗿' },
  { n: 'Inconscient', i: '😵' },
  { n: 'Invisible', i: '👻' },
  { n: 'Épuisement', i: '🥵' },
  { n: 'Concentration', i: '🧠' },
];

const _icon = Object.fromEntries(CONDITIONS.map((c) => [c.n, c.i]));
export function condIcon(name) {
  return _icon[name] || '🔹';
}
