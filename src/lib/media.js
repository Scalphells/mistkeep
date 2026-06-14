/**
 * Téléversement des médias : R2 (Cloudflare, egress gratuit) quand configuré,
 * sinon le storage du backend — cf. workers/media-worker.js pour le serveur.
 *
 * `VITE_MEDIA_URL` = URL du Worker (édition Supabase uniquement : le backend
 * Go sert ses fichiers localement, sans enjeu d'egress). Un fichier R2 est
 * référencé par son URL ABSOLUE, stockée telle quelle en base ;
 * `cachedSignedUrl` laisse passer les URLs absolues, donc tous les lecteurs
 * existants (carte, jetons, portraits, handouts, audio) fonctionnent sans
 * changement. Sans VITE_MEDIA_URL : comportement identique à avant.
 */
import { backend } from './backend.js';
import { supabase } from './supabase.js';
import { IMMUTABLE_CACHE } from './signed-urls.js';
import { campaignId } from './campaigns.js';
import { t as tr } from './i18n.js';

const goBackend = import.meta.env && import.meta.env.VITE_BACKEND === 'go';
const MEDIA_URL = goBackend ? '' : ((import.meta.env && import.meta.env.VITE_MEDIA_URL) || '').replace(/\/+$/, '');

/** R2 est-il configuré pour ce déploiement ? */
export function mediaConfigured() {
  return !!MEDIA_URL;
}

/**
 * Téléverse un fichier média et renvoie la référence à stocker en base :
 * URL absolue (R2) ou chemin `bucket/clé` (storage du backend).
 */
export async function uploadMedia(bucket, key, file, contentType) {
  // Clé préfixée par la campagne active : l'écriture est réservée au MJ DE
  // CETTE CAMPAGNE (policies Supabase 0029 / authz du backend Go) ; un chemin
  // sans préfixe (fichiers historiques) reste rattaché à la campagne par
  // défaut.
  key = `${campaignId()}/${key}`;
  const type = contentType || file.type || 'application/octet-stream';
  if (MEDIA_URL) {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`${MEDIA_URL}/${bucket}/${key}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${data?.session?.access_token || ''}`,
        'Content-Type': type,
      },
      body: file,
    });
    if (!res.ok) throw new Error(tr('media.err.r2', { status: res.status }));
    return `${MEDIA_URL}/${bucket}/${key}`;
  }
  const { error } = await backend.storage.from(bucket).upload(key, file, {
    upsert: true,
    contentType: type,
    cacheControl: IMMUTABLE_CACHE,
  });
  if (error) throw new Error(error.message);
  return `${bucket}/${key}`;
}
