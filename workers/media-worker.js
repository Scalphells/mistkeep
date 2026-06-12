/**
 * Worker Cloudflare : médias de l'app servis depuis R2 (egress gratuit).
 *
 * Pourquoi : l'egress Supabase (plan gratuit) est plafonné à 5 GB/mois ; les
 * médias (fonds de carte, jetons, audio d'ambiance) en sont le gros poste.
 * R2 ne facture pas l'egress, et ce Worker met en plus chaque fichier en
 * cache au bord (edge) + navigateur 1 an : un média n'est lu dans R2 qu'une
 * fois par point de présence.
 *
 * Routes :
 *   GET /<bucket>/<clé>  → fichier (public ; noms de fichiers non devinables)
 *   PUT /<bucket>/<clé>  → upload, authentifié via le JWT Supabase de l'app
 *
 * Configuration (dashboard du Worker → Settings) :
 *   - Binding R2        : `MEDIA` → le bucket (ex. vault-mj-media)
 *   - Variable          : `SUPABASE_URL`      (https://xxxx.supabase.co)
 *   - Variable          : `SUPABASE_ANON_KEY` (clé anon du projet)
 *
 * Modèle de confiance : l'upload exige un compte Supabase valide (le JWT est
 * vérifié auprès de l'API auth) — même cercle de confiance que la table de
 * jeu. La lecture est publique mais les clés sont horodatées/aléatoires.
 */

const ALLOWED_BUCKETS = new Set(['battlemap', 'handouts']);
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 Mo (pistes audio comprises)

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    ...extra,
  };
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });

    const url = new URL(req.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const bucket = key.split('/')[0];
    if (!ALLOWED_BUCKETS.has(bucket) || key.includes('..')) {
      return new Response('bad path', { status: 400, headers: cors() });
    }

    if (req.method === 'GET') {
      // Cache edge : les rechargements de toute la table sortent du cache
      // Cloudflare, R2 n'est lu qu'au premier accès.
      const cache = caches.default;
      const hit = await cache.match(req);
      if (hit) return hit;

      const obj = await env.MEDIA.get(key);
      if (!obj) return new Response('not found', { status: 404, headers: cors() });
      const res = new Response(obj.body, {
        headers: cors({
          'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable', // clés uniques, jamais réécrites
          ETag: obj.httpEtag,
        }),
      });
      ctx.waitUntil(cache.put(req, res.clone()));
      return res;
    }

    if (req.method === 'PUT') {
      const auth = req.headers.get('Authorization') || '';
      if (!auth.startsWith('Bearer ')) {
        return new Response('unauthenticated', { status: 401, headers: cors() });
      }
      // Vérifie le JWT auprès de Supabase (aucun secret de signature à gérer
      // ici, et la révocation de session est respectée).
      const who = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY },
      });
      if (!who.ok) return new Response('unauthenticated', { status: 401, headers: cors() });

      const len = Number(req.headers.get('Content-Length') || 0);
      if (len > MAX_UPLOAD_BYTES) {
        return new Response('too large', { status: 413, headers: cors() });
      }
      await env.MEDIA.put(key, req.body, {
        httpMetadata: { contentType: req.headers.get('Content-Type') || 'application/octet-stream' },
      });
      return new Response(JSON.stringify({ ok: true, path: key }), {
        status: 201,
        headers: cors({ 'Content-Type': 'application/json' }),
      });
    }

    return new Response('method not allowed', { status: 405, headers: cors() });
  },
};
