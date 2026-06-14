import { backend } from './backend.js';
import { cachedSignedUrl } from './signed-urls.js';
import { uploadMedia } from './media.js';
import { campaignId, loadSessionValue, saveSessionValue, sameCampaign } from './campaigns.js';
import { store } from '../state.js';
import { debounce } from './utils.js';
import { t as tr } from './i18n.js';

/**
 * Ambiance audio partagée, MULTI-PISTES. Le MJ empile plusieurs sons (ambiance,
 * cris, pluie…), chacun avec son volume (%) et sa boucle ; l'état est diffusé via
 * `session_state['ambience'] = { layers: [...] }`. Chaque client lit toutes les
 * pistes en parallèle. Un volume maître LOCAL (par appareil, localStorage) laisse
 * chaque joueur régler le son global sans affecter les autres.
 */

const KEY = 'ambience';
const BUCKET = 'battlemap';

const audios = new Map(); // layerId -> { audio, lastSrc }
let channel = null;
let bcast = null; // canal broadcast (filet temps réel si postgres_changes manque)
let _unlocked = false;

/** Débloque l'audio au premier geste utilisateur (politique d'autoplay). */
function unlockOnGesture() {
  if (_unlocked) return;
  _unlocked = true;
  applyAll();
  document.removeEventListener('pointerdown', unlockOnGesture);
  document.removeEventListener('keydown', unlockOnGesture);
}

function uid() {
  return `a_${crypto.randomUUID().slice(0, 8)}`;
}

/* ── Volume maître local (par appareil) ── */
let master = (() => {
  try {
    const v = Number(localStorage.getItem('vaultmj_ambvol'));
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 100;
  } catch {
    return 100;
  }
})();
export function getMasterVol() {
  return master;
}
export function setMasterVol(v) {
  master = Math.max(0, Math.min(100, Math.round(v) || 0));
  try {
    localStorage.setItem('vaultmj_ambvol', String(master));
  } catch {
    /* mode privé */
  }
  applyAll();
}

/* ── Volume LOCAL par piste (par appareil, chaque joueur règle le sien) ── */
let layerLocal = (() => {
  try {
    return JSON.parse(localStorage.getItem('vaultmj_amblayervol')) || {};
  } catch {
    return {};
  }
})();
export function getLayerLocal(id) {
  return layerLocal[id] ?? 100;
}
export function setLayerLocal(id, v) {
  layerLocal[id] = Math.max(0, Math.min(100, Math.round(v) || 0));
  try {
    localStorage.setItem('vaultmj_amblayervol', JSON.stringify(layerLocal));
  } catch {
    /* mode privé */
  }
  applyAll();
}
function effVol(layer) {
  return (Number(layer.vol ?? 60) / 100) * (getLayerLocal(layer.id) / 100) * (master / 100);
}

/* ── Modèle ── */
function layers() {
  const a = store.get().ambience;
  return Array.isArray(a?.layers) ? a.layers : [];
}
function normalize(v) {
  if (Array.isArray(v?.layers)) return { layers: v.layers };
  if (v?.url) return { layers: [{ id: uid(), url: v.url, name: v.name || 'Piste', vol: v.vol ?? 60, loop: v.loop !== false, playing: !!v.playing }] };
  return { layers: [] };
}

async function resolveUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return cachedSignedUrl(BUCKET, u);
}

/* ── YouTube (lecteur IFrame caché) ── */
function ytId(u) {
  const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
let _ytApi = null;
function loadYTApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (_ytApi) return _ytApi;
  _ytApi = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return _ytApi;
}
function ytHost() {
  let h = document.getElementById('yt-amb-host');
  if (!h) {
    h = document.createElement('div');
    h.id = 'yt-amb-host';
    h.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;';
    document.body.appendChild(h);
  }
  return h;
}
function teardown(rec) {
  if (!rec) return;
  if (rec.kind === 'yt') rec.player?.destroy?.();
  else rec.audio?.pause();
}

async function applyYT(layer, rec) {
  const id = ytId(layer.url);
  if (!id) return;
  const vol = Math.max(0, Math.min(100, Math.round(effVol(layer) * 100)));
  if (!rec) {
    rec = { kind: 'yt', player: null, ready: false, ytId: id, wantLoop: layer.loop !== false };
    audios.set(layer.id, rec);
    await loadYTApi();
    const div = document.createElement('div');
    ytHost().appendChild(div);
    rec.player = new window.YT.Player(div, {
      videoId: id,
      playerVars: { autoplay: layer.playing ? 1 : 0, controls: 0, loop: 1, playlist: id, disablekb: 1, playsinline: 1 },
      events: {
        onReady: (e) => {
          rec.ready = true;
          e.target.setVolume(vol);
          if (layer.playing) e.target.playVideo();
          else e.target.pauseVideo();
        },
        onStateChange: (e) => {
          if (e.data === window.YT.PlayerState.ENDED && rec.wantLoop) e.target.playVideo();
        },
      },
    });
    return;
  }
  rec.wantLoop = layer.loop !== false;
  if (rec.ready && rec.player) {
    if (rec.ytId !== id) {
      rec.ytId = id;
      rec.player.loadVideoById(id);
    }
    rec.player.setVolume(vol);
    if (layer.playing) rec.player.playVideo();
    else rec.player.pauseVideo();
  }
}

async function applyAudio(layer, rec) {
  if (!rec) {
    rec = { kind: 'audio', audio: new Audio(), lastSrc: null };
    rec.audio.preload = 'auto';
    audios.set(layer.id, rec);
  }
  const a = rec.audio;
  a.loop = layer.loop !== false;
  a.volume = Math.max(0, Math.min(1, effVol(layer)));
  if (!layer.url || !layer.playing) {
    a.pause();
    return;
  }
  if (rec.lastSrc !== layer.url) {
    const url = await resolveUrl(layer.url);
    if (!url) return;
    a.src = url;
    rec.lastSrc = layer.url;
  }
  try {
    await a.play();
  } catch {
    // Autoplay bloqué : le son démarrera au premier geste utilisateur (cf. unlock).
  }
}

async function applyLayer(layer) {
  const isYT = !!ytId(layer.url);
  let rec = audios.get(layer.id);
  if (rec && rec.kind !== (isYT ? 'yt' : 'audio')) {
    teardown(rec);
    audios.delete(layer.id);
    rec = null;
  }
  if (isYT) return applyYT(layer, rec);
  return applyAudio(layer, rec);
}

function applyAll() {
  const ls = layers();
  const ids = new Set(ls.map((l) => l.id));
  for (const [id, rec] of audios) {
    if (!ids.has(id)) {
      teardown(rec);
      audios.delete(id);
    }
  }
  ls.forEach(applyLayer);
}

function applyState(s) {
  store.set({ ambience: normalize(s) });
  applyAll();
}

async function fetchState() {
  return (await loadSessionValue(KEY)) || null;
}

export async function initAmbience() {
  document.addEventListener('pointerdown', unlockOnGesture);
  document.addEventListener('keydown', unlockOnGesture);
  applyState(await fetchState());
  channel = backend.realtime
    .channel('ambience_feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_state', filter: `key=eq.${KEY}` }, (payload) => {
      if (!sameCampaign(payload)) return;
      applyState(payload.new?.value || null);
    })
    .subscribe();
  // Filet temps réel : applique aussi l'état diffusé par le MJ (ajout/retrait).
  bcast = backend.realtime.channel(`amb_rt:${campaignId()}`, { config: { broadcast: { self: false } } });
  bcast.on('broadcast', { event: 'state' }, ({ payload }) => applyState(payload?.value || { layers: [] })).subscribe();
}

export function stopAmbience() {
  if (channel) backend.realtime.removeChannel(channel);
  if (bcast) backend.realtime.removeChannel(bcast);
  channel = null;
  bcast = null;
  for (const rec of audios.values()) teardown(rec);
  audios.clear();
}

/* ── Contrôles MJ (pistes partagées) ── */
const persist = debounce(async () => {
  if (!store.get().isDM) return;
  const { error } = await saveSessionValue(KEY, { layers: layers() });
  if (error) console.error('[ambience]', error.message);
}, 250);

function mutate(fn) {
  if (!store.get().isDM) return;
  const next = { layers: layers().map((l) => ({ ...l })) };
  fn(next.layers);
  store.set({ ambience: next });
  applyAll();
  persist();
  bcast?.send({ type: 'broadcast', event: 'state', payload: { value: { layers: layers() } } });
}

export function addLayer({ url, name }) {
  mutate((ls) => ls.push({ id: uid(), url, name: name || url.split('/').pop() || 'Piste', vol: 60, loop: true, playing: true }));
}
export function updateLayer(id, patch) {
  mutate((ls) => {
    const l = ls.find((x) => x.id === id);
    if (l) Object.assign(l, patch);
  });
}
export function removeLayer(id) {
  mutate((ls) => {
    const i = ls.findIndex((x) => x.id === id);
    if (i >= 0) ls.splice(i, 1);
  });
}

/** Téléverse un fichier audio dans le bucket et l'ajoute comme nouvelle piste. */
export async function uploadAmbience(file) {
  if (!store.get().isDM) return;
  const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
  const key = `audio/${Date.now()}.${ext}`;
  const ref = await uploadMedia(BUCKET, key, file, file.type || 'audio/mpeg');
  addLayer({ url: ref, name: file.name.replace(/\.[^.]+$/, '') });
}

/* ── Catalogue Tabletop Audio (inchangé) ── */
let _catalog = null;
export async function fetchTabletopCatalog() {
  if (_catalog) return _catalog;
  const res = await fetch('https://tabletopaudio.com/getalltracks.json');
  if (!res.ok) throw new Error(tr('amb.err.catalog', { status: res.status }));
  const data = await res.json();
  const tracks = Array.isArray(data) ? data : data.tracks || [];
  _catalog = tracks
    .map((t) => ({
      title: t.track_title || t.title || 'Piste',
      url: t.flac || t.link || t.url || '',
      genre: Array.isArray(t.track_genre) ? t.track_genre.join(', ') : t.track_genre || '',
    }))
    .filter((t) => t.url);
  return _catalog;
}
