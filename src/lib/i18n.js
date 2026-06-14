import fr from '../locales/fr.json';
import en from '../locales/en.json';

/**
 * Internationalisation par dictionnaires JSON (src/locales/<code>.json).
 *
 * Ajouter une langue = créer le fichier JSON, l'importer ici, puis l'ajouter à
 * DICTS et à LOCALES. Le français est la langue SOURCE : toute clé absente
 * d'une autre langue y retombe automatiquement (puis sur la clé brute en
 * dernier recours), ce qui permet une traduction PROGRESSIVE — une surface non
 * encore traduite reste simplement en français.
 *
 * La langue active est pilotée par la préférence `locale` (cf. lib/prefs.js,
 * portée par le compte) ; ce module reste pur (il ne lit ni localStorage ni le
 * réseau, on lui injecte la langue via setLocale).
 */

const DICTS = { fr, en };

/** Langues proposées par la bascule (⚙ Affichage). */
export const LOCALES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

export const DEFAULT_LOCALE = 'fr';
let _locale = DEFAULT_LOCALE;
// Boot : lit la locale en cache (localStorage) AVANT l'init des autres modules,
// pour que la sélection de données par locale (srd*.js) soit déjà correcte au
// premier chargement. Essaie les deux clés de marque ; ignoré sans localStorage.
try {
  const raw = typeof localStorage !== 'undefined' && (localStorage.getItem('vaultmj_prefs') || localStorage.getItem('mistkeep_prefs'));
  const cached = raw && JSON.parse(raw).locale;
  if (cached && DICTS[cached]) _locale = cached;
} catch { /* tests/SSR : pas de localStorage, on garde le défaut */ }

/** Langue active (code ISO court, ex. 'fr'). */
export function getLocale() {
  return _locale;
}

/** Définit la langue active ; une langue inconnue est ignorée (reste l'actuelle). */
export function setLocale(code) {
  if (DICTS[code]) _locale = code;
}

/**
 * Traduit une clé. Repli : langue active → français → clé brute.
 * Interpolation optionnelle : `t('x', { name: 'Aé' })` remplace « {name} ».
 * @param {string} key
 * @param {Object<string, string|number>} [params]
 * @returns {string}
 */
export function t(key, params) {
  let s = DICTS[_locale]?.[key];
  if (s == null) s = DICTS.fr?.[key];
  if (s == null) s = key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
