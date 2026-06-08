/**
 * Petites fonctions utilitaires partagées.
 */

/** Debounce : retarde l'exécution jusqu'à `ms` après le dernier appel. */
export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

/** Échappe le HTML pour insertion sûre dans le DOM. */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Valide une couleur destinée à un `style="..."` inline pour éviter toute
 * injection CSS. Autorise : #rgb / #rrggbb, rgb()/rgba(), les variables CSS
 * `var(--x)` du thème, et un petit jeu de mots-clés. Sinon → couleur de repli.
 */
export function safeColor(c, fallback = 'transparent') {
  const s = String(c ?? '').trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s) || /^#[0-9a-fA-F]{8}$/.test(s)) return s;
  if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/.test(s)) return s;
  if (/^var\(--[a-z0-9-]+\)$/i.test(s)) return s;
  if (/^(transparent|currentColor|inherit)$/i.test(s)) return s;
  return fallback;
}
