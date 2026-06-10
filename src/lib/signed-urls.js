/**
 * URLs signées Storage avec cache persistant — correctif egress.
 *
 * Sur le backend Supabase, le coût egress venait de deux fuites combinées :
 *   1. chaque rechargement de page régénérait des URLs signées neuves (token
 *      différent → query string différente → cache navigateur contourné) :
 *      fonds de carte, jetons, portraits, handouts et pistes audio étaient
 *      retéléchargés en entier par chaque joueur à chaque session ;
 *   2. les uploads ne posaient pas de Cache-Control long (défaut : 1 h).
 *
 * En réutilisant LA MÊME URL signée d'une session à l'autre (localStorage),
 * le navigateur — et le CDN — resservent les fichiers depuis leur cache.
 * Sur le backend Go, l'URL « signée » est un chemin authentifié stable :
 * la mise en cache est inoffensive et évite un aller-retour /sign.
 */
import { backend } from './backend.js';

/** Durée de validité des URLs signées (6 jours). */
export const SIGNED_TTL = 60 * 60 * 24 * 6;

// Renouvelle une URL 12 h avant son expiration (marge pour une longue session).
const RENEW_MARGIN_MS = 12 * 60 * 60 * 1000;
const LS_KEY = 'mk_signed_urls_v1';

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    /* localStorage plein/indisponible : le cache mémoire suffit pour la session */
  }
}

/**
 * URL signée stable pour un fichier de `bucket`. Accepte le chemin avec ou
 * sans préfixe bucket (`maps/123.jpg` ou `123.jpg`). Renvoie null si le
 * fichier est inaccessible et qu'aucune URL n'est en cache.
 */
export async function cachedSignedUrl(bucket, path) {
  if (!path) return null;
  const key = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  const c = load();
  const id = `${bucket}/${key}`;
  const hit = c[id];
  if (hit && hit.exp - Date.now() > RENEW_MARGIN_MS) return hit.url;
  const { data, error } = await backend.storage.from(bucket).createSignedUrl(key, SIGNED_TTL);
  if (error || !data) return hit?.url || null; // une URL proche de l'expiration vaut mieux que rien
  c[id] = { url: data.signedUrl, exp: Date.now() + SIGNED_TTL * 1000 };
  persist();
  return data.signedUrl;
}

/**
 * Options d'upload des fichiers à clé unique (horodatée, jamais réécrite) :
 * immuables → cache navigateur/CDN un an.
 */
export const IMMUTABLE_CACHE = '31536000';
