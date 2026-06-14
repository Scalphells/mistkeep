import { backend } from '../lib/backend.js';
import { cachedSignedUrl } from '../lib/signed-urls.js';
import { uploadMedia } from '../lib/media.js';
import { campaignId, sameCampaign } from '../lib/campaigns.js';
import { store } from '../state.js';
import { showToast } from '../lib/toast.js';
import { t as tr } from '../lib/i18n.js';

/**
 * Handouts : documents partagés par le MJ aux joueurs.
 *
 * Source de vérité : table `handouts` (RLS : écriture MJ ; lecture filtrée par
 * destinataire via migration 0010). Images dans le bucket privé `handouts`
 * (URL signées). Diffusion temps réel via Realtime.
 *
 * Un handout peut cibler un joueur précis (`target_player` = id du profil) ou
 * tout le monde (`target_player` = null).
 */

const HBUCKET = 'handouts';

/** Cache des URL signées : chemin Storage -> URL. Non persisté. */
const _urlCache = new Map();
export function handoutUrl(path) {
  return path ? _urlCache.get(path) || null : null;
}

/* ── Chargement ───────────────────────────────────────────── */

export async function loadHandouts() {
  const { data, error } = await backend.db
    .from('handouts')
    .select('*')
    .eq('campaign_id', campaignId())
    .order('pushed_at', { ascending: false });

  if (error) {
    console.warn('[handouts] chargement impossible:', error.message);
    return;
  }
  store.set({ handouts: data });
  await resolveUrls();
}

/** Résout les URL signées manquantes pour les handouts image, puis re-render. */
async function resolveUrls() {
  const list = store.get().handouts;
  let changed = false;
  for (const h of list) {
    if (h.content_type === 'image' && h.image_url && !_urlCache.has(h.image_url)) {
      const url = await cachedSignedUrl(HBUCKET, h.image_url);
      if (url) {
        _urlCache.set(h.image_url, url);
        changed = true;
      }
    }
  }
  if (changed) store.set({ handouts: [...store.get().handouts] });
}

/* ── Écriture (MJ) ────────────────────────────────────────── */

/** Crée un handout texte ou lettre (MJ). */
export async function createHandout({ title, description, content_type, text_content, target_player }) {
  if (!store.get().isDM) return;
  const row = {
    title: String(title).trim() || 'Sans titre',
    description: description?.trim() || null,
    content_type: content_type || 'text',
    text_content: text_content ?? null,
    target_player: target_player || null,
    pushed_by: store.get().user?.id ?? null,
    campaign_id: campaignId(),
  };
  const { error } = await backend.db.from('handouts').insert(row);
  if (error) throw new Error(error.message);
}

/** Téléverse une image puis crée le handout associé (MJ). */
export async function uploadHandout(file, { title, description, target_player }) {
  if (!store.get().isDM) return;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const ref = await uploadMedia(HBUCKET, key, file, file.type || 'image/jpeg');

  const row = {
    title: String(title).trim() || file.name,
    description: description?.trim() || null,
    content_type: 'image',
    image_url: ref,
    target_player: target_player || null,
    pushed_by: store.get().user?.id ?? null,
    campaign_id: campaignId(),
  };
  const { error } = await backend.db.from('handouts').insert(row);
  if (error) throw new Error(error.message);
}

/** Supprime un handout (et son image éventuelle) — MJ. */
export async function deleteHandout(id) {
  if (!store.get().isDM) return;
  const h = store.get().handouts.find((x) => x.id === id);
  const { error } = await backend.db.from('handouts').delete().eq('id', id);
  if (error) {
    console.error('[handouts] suppression échouée:', error.message);
    showToast(tr('handouts.err.del'), { type: 'warn', icon: '⚠️' });
    return;
  }
  if (h?.image_url) {
    // Fichier du storage backend : on le supprime. Fichier R2 (URL absolue) :
    // laissé en place (orphelin inoffensif — pas d'API delete côté Worker).
    if (!/^https?:\/\//i.test(h.image_url)) {
      const key = h.image_url.startsWith(`${HBUCKET}/`)
        ? h.image_url.slice(HBUCKET.length + 1)
        : h.image_url;
      backend.storage.from(HBUCKET).remove([key]).then(({ error: e }) => {
        if (e) console.warn('[handouts] image non supprimée:', e.message);
      });
    }
    _urlCache.delete(h.image_url);
  }
  store.set({ handouts: store.get().handouts.filter((x) => x.id !== id) });
}

/* ── Realtime ─────────────────────────────────────────────── */

export function subscribeHandouts() {
  const channel = backend.realtime
    .channel('handouts_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'handouts' },
      async (payload) => {
        if (!sameCampaign(payload)) return;
        const cur = store.get().handouts;
        if (payload.eventType === 'DELETE') {
          store.set({ handouts: cur.filter((h) => h.id !== payload.old.id) });
          return;
        }
        const row = payload.new;
        const exists = cur.some((h) => h.id === row.id);
        const next = exists
          ? cur.map((h) => (h.id === row.id ? row : h))
          : [row, ...cur];
        store.set({ handouts: next });
        await resolveUrls();
      }
    )
    .subscribe();

  return () => backend.realtime.removeChannel(channel);
}
