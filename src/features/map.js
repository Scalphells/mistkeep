import { backend } from '../lib/backend.js';
import { cachedSignedUrl } from '../lib/signed-urls.js';
import { uploadMedia } from '../lib/media.js';
import { campaignId, loadSessionValue, saveSessionValue, sameCampaign } from '../lib/campaigns.js';
import { store } from '../state.js';
import { debounce } from '../lib/utils.js';
import { createUndoStack } from '../lib/undo-stack.js';
import { updateLayer } from '../lib/ambience.js';
import { showToast } from '../lib/toast.js';
import { t as tr } from '../lib/i18n.js';

/**
 * Carte de combat partagée (battle map).
 *
 * Source de vérité : table `scenes` (une ligne `state` jsonb par scène). La
 * scène active est pointée par `session_state['active_scene']`. `store.map` =
 * état de la scène active. Écriture MJ (RLS), lecture tous, diffusion Realtime.
 *
 * Le ping est éphémère : diffusé via Realtime *broadcast* (aucune écriture en
 * base), accessible à tous les joueurs. La règle (distance) est purement
 * locale. Le pan/zoom est propre à chaque utilisateur (non synchronisé).
 *
 * Système de coordonnées : tout est exprimé en pixels de l'image native.
 *   - tokens.x / tokens.y : centre du jeton, en px image.
 *   - grid.size           : côté d'une case, en px image.
 *   - fog.cell            : côté d'une case de brouillard, en px image.
 *   - fog.revealed        : ensemble de cases révélées, format "cx,cy".
 */

const ACTIVE_KEY = 'active_scene';
const BG_BUCKET = 'battlemap';

export const DEFAULT_MAP = {
  bg: null, // chemin Storage du fond, ex: "battlemap/1700000000.jpg"
  bgW: 0,
  bgH: 0,
  grid: { size: 70, ox: 0, oy: 0, show: true, opacity: 0.12 },
  unit: 'ft', // 'ft' | 'm'
  feetPerCell: 5, // distance représentée par une case
  tokens: [],
  tiles: [], // décors posés {id, img, x, y, w, h, rot, opacity, above} en px image (MJ)
  fog: { on: false, cell: 70, revealed: [], explored: [] },
  walls: [], // segments occultants {x1,y1,x2,y2} en px image (MJ)
  lights: [], // sources de lumière {id,x,y,radius} en px image (MJ)
  tokenLib: [], // bibliothèque d'images de jetons réutilisables (chemins Storage)
  lighting: { on: false }, // lumière dynamique (vision + murs + mémoire)
  pins: [], // marqueurs {id, x, y, n, note, revealed} en px image (MJ)
  drawings: [], // annotations {id, type, ...} en px image (MJ), visibles de tous
  labels: [], // étiquettes de zone {id, x, y, text, color, revealed} (MJ)
  atmosphere: { darkness: 0, weather: 'none' }, // ambiance de scène (jour/nuit + météo)
  soundscape: [], // identifiants des pistes d'ambiance liées à cette scène (MJ)
};

/* ── Chargement & scènes ──────────────────────────────────── */

/** Liste des scènes (sans le gros `state`). */
async function fetchScenes() {
  const { data, error } = await backend.db
    .from('scenes')
    .select('id, name, sort')
    .eq('campaign_id', campaignId())
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[scenes] liste impossible:', error.message);
    return [];
  }
  return data || [];
}

async function fetchActiveSceneId() {
  const v = await loadSessionValue(ACTIVE_KEY);
  return v?.id ?? null;
}

/** Charge l'état complet d'une scène dans le store. */
async function loadSceneState(id) {
  if (!id) {
    store.set({ map: { ...DEFAULT_MAP } });
    return;
  }
  const { data, error } = await backend.db.from('scenes').select('state').eq('id', id).maybeSingle();
  if (error) {
    console.warn('[scenes] chargement état impossible:', error.message);
    return;
  }
  store.set({ map: normalizeMap(data?.state) });
  _bgUrlForPath = null;
  await refreshBgUrl();
  await resolveTokenUrls();
}

export async function loadMap() {
  const scenes = await fetchScenes();
  let activeId = await fetchActiveSceneId();
  if (!scenes.some((s) => s.id === activeId)) activeId = scenes[0]?.id ?? null;

  // Aucune scène : le MJ en crée une par défaut ; sinon carte vide.
  if (!activeId && store.get().isDM) {
    const id = await insertScene('Scène 1', { ...DEFAULT_MAP });
    if (id) {
      activeId = id;
      await setActivePointer(id);
      scenes.push({ id, name: tr('map.scene.default1'), sort: 0 });
    }
  }

  store.set({ scenes, activeSceneId: activeId });
  await loadSceneState(activeId);
}

async function insertScene(name, state) {
  const { data, error } = await backend.db
    .from('scenes')
    .insert({ name, state, sort: store.get().scenes.length, created_by: store.get().user?.id ?? null, campaign_id: campaignId() })
    .select('id, name, sort')
    .single();
  if (error) {
    console.error('[scenes] création impossible:', error.message);
    return null;
  }
  return data.id;
}

async function setActivePointer(id) {
  await saveSessionValue(ACTIVE_KEY, { id });
}

/** Crée une scène (vierge) et l'active (MJ). */
export async function createScene(name) {
  if (!store.get().isDM) return;
  const id = await insertScene(name || tr('map.scene.new'), { ...DEFAULT_MAP });
  if (!id) return;
  // Ajout idempotent : l'écho temps réel instantané a pu déjà l'ajouter.
  const cur = store.get().scenes;
  if (!cur.some((s) => s.id === id)) {
    store.set({ scenes: [...cur, { id, name: name || tr('map.scene.new'), sort: cur.length }] });
  }
  await switchScene(id);
}

/** Bascule la scène active (MJ) — répercuté à tous via le pointeur. */
export async function switchScene(id) {
  if (!store.get().isDM || id === store.get().activeSceneId) return;
  saveDebounced.flush?.(); // persiste la scène courante avant de changer
  store.set({ activeSceneId: id });
  await setActivePointer(id);
  await loadSceneState(id);
  applySceneSoundscape();
}

/**
 * Ambiance sonore liée à la scène : si la scène a mémorisé un « paysage sonore »
 * (liste d'identifiants de pistes), on lance ces pistes et on coupe les autres.
 * Une scène sans paysage sonore défini ne touche pas à l'ambiance en cours.
 */
export function applySceneSoundscape() {
  if (!store.get().isDM) return;
  const ss = store.get().map?.soundscape;
  if (!Array.isArray(ss) || !ss.length) return;
  const want = new Set(ss);
  for (const l of store.get().ambience?.layers || []) {
    const shouldPlay = want.has(l.id);
    if (!!l.playing !== shouldPlay) updateLayer(l.id, { playing: shouldPlay });
  }
}

export async function renameScene(id, name) {
  if (!store.get().isDM) return;
  store.set({ scenes: store.get().scenes.map((s) => (s.id === id ? { ...s, name } : s)) });
  await backend.db.from('scenes').update({ name }).eq('id', id);
}

export async function deleteScene(id) {
  if (!store.get().isDM) return;
  const scenes = store.get().scenes;
  if (scenes.length <= 1) return; // garder au moins une scène
  await backend.db.from('scenes').delete().eq('id', id);
  const remaining = scenes.filter((s) => s.id !== id);
  store.set({ scenes: remaining });
  if (store.get().activeSceneId === id) await switchScene(remaining[0].id);
}

/** Réordonne les scènes (MJ) selon une liste d'identifiants ; persiste `sort`. */
export async function reorderScenes(orderedIds) {
  if (!store.get().isDM) return;
  const cur = store.get().scenes;
  const byId = new Map(cur.map((s) => [s.id, s]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  for (const s of cur) if (!ordered.includes(s)) ordered.push(s); // sécurité : n'oublie aucune scène
  const changed = [];
  const next = ordered.map((s, i) => {
    if (s.sort !== i) changed.push({ id: s.id, sort: i });
    return { ...s, sort: i };
  });
  if (!changed.length) return;
  store.set({ scenes: next });
  await Promise.all(changed.map((c) => backend.db.from('scenes').update({ sort: c.sort }).eq('id', c.id)));
}

/** Exporte la scène active en objet JSON portable ({ type, name, state }). */
export function exportActiveScene() {
  const sc = store.get().scenes.find((s) => s.id === store.get().activeSceneId);
  return { type: 'vaultmj-scene', v: 1, name: sc?.name || 'Scène', state: store.get().map || { ...DEFAULT_MAP } };
}

/** Crée une nouvelle scène à partir d'un état JSON et l'active (MJ). */
export async function importSceneState(name, state) {
  if (!store.get().isDM) return null;
  const id = await insertScene(name || 'Scène importée', normalizeMap(state));
  if (!id) return null;
  const cur = store.get().scenes;
  if (!cur.some((s) => s.id === id)) {
    store.set({ scenes: [...cur, { id, name: name || 'Scène importée', sort: cur.length }] });
  }
  await switchScene(id);
  return id;
}

function normalizeMap(v) {
  const m = { ...DEFAULT_MAP, ...(v || {}) };
  m.grid = { ...DEFAULT_MAP.grid, ...(v?.grid || {}) };
  m.fog = { ...DEFAULT_MAP.fog, ...(v?.fog || {}) };
  m.lighting = { ...DEFAULT_MAP.lighting, ...(v?.lighting || {}) };
  m.atmosphere = { ...DEFAULT_MAP.atmosphere, ...(v?.atmosphere || {}) };
  if (!Array.isArray(m.soundscape)) m.soundscape = [];
  if (!Array.isArray(m.tokens)) m.tokens = [];
  if (!Array.isArray(m.tiles)) m.tiles = [];
  if (!Array.isArray(m.tokenLib)) m.tokenLib = [];
  if (!Array.isArray(m.walls)) m.walls = [];
  if (!Array.isArray(m.lights)) m.lights = [];
  if (!Array.isArray(m.pins)) m.pins = [];
  if (!Array.isArray(m.drawings)) m.drawings = [];
  if (!Array.isArray(m.labels)) m.labels = [];
  if (!Array.isArray(m.fog.revealed)) m.fog.revealed = [];
  if (!Array.isArray(m.fog.explored)) m.fog.explored = [];
  return m;
}

/** URL signée du fond, conservée hors-état (non persistée). */
let _bgUrl = null;
let _bgUrlForPath = null;
export function bgUrl() {
  return _bgUrl;
}

export async function refreshBgUrl() {
  const m = store.get().map;
  const path = m?.bg;
  if (!path) {
    _bgUrl = null;
    _bgUrlForPath = null;
    store.set({ map: { ...store.get().map } }); // force re-render
    return;
  }
  if (path === _bgUrlForPath && _bgUrl) return;
  const url = await cachedSignedUrl(BG_BUCKET, path);
  if (!url) {
    console.warn('[map] URL signée impossible pour', path);
    _bgUrl = null;
  } else {
    _bgUrl = url;
    _bgUrlForPath = path;
  }
  store.set({ map: { ...store.get().map } });
}

/* ── Écriture (MJ) ────────────────────────────────────────── */

// Dernière scène sauvegardée par NOUS. Le backend renvoie nos propres écritures
// en temps réel (écho instantané) ; on s'en sert pour ignorer cet écho et ne pas
// écraser l'état optimiste local (sinon la carte « clignote »/disparaît pendant
// une bascule de scène).
let _selfSceneEcho = { id: null, t: 0 };
function isSelfSceneEcho(id) {
  return !!id && id === _selfSceneEcho.id && Date.now() - _selfSceneEcho.t < 4000;
}

let _savePending = false;

const saveDebounced = debounce(async () => {
  _savePending = false;
  const m = store.get().map;
  const id = store.get().activeSceneId;
  if (!m || !id) return;
  _selfSceneEcho = { id, t: Date.now() };
  const { error } = await backend.db
    .from('scenes')
    .update({ state: m, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[map] sauvegarde scène échouée:', error.message);
    showToast(tr('map.err.save'), { type: 'warn', icon: '⚠️' });
  }
  // Filet de sécurité temps réel : signale aux autres clients de recharger la
  // scène (au cas où les postgres_changes sur `scenes` ne leur parviendraient pas).
  else _pingChannel?.send({ type: 'broadcast', event: 'scenedirty', payload: { id, by: store.get().user?.id } });
}, 800); // 800 ms : coalesce les rafales d'édition — chaque sauvegarde réplique l'état complet vers chaque joueur

/** Force la persistance immédiate d'une sauvegarde de scène encore en debounce.
 *  À appeler avant de démonter la vue carte (changement d'onglet) pour ne pas
 *  perdre un changement récent — sinon le remontage rechargerait l'ancien état.
 *  No-op si rien n'est en attente (pas d'écriture gratuite, pas de PATCH rejeté
 *  côté joueur sur le backend Go). */
export function flushSceneSave() {
  if (!_savePending) return;
  saveDebounced.flush?.();
}

/* ── Annulation (Ctrl+Z, MJ) ──────────────────────────────── */

// Historique des patchs MJ, scopé par scène (cf. lib/undo-stack). Les patchs
// automatiques (exploration du brouillard, sync de vision, moves des joueurs)
// passent `record:false` pour ne pas noyer les actions réelles du MJ.
const _undo = createUndoStack(50);

/** Y a-t-il quelque chose à annuler sur la scène active ? */
export function canUndoMap() {
  return _undo.canUndo(store.get().activeSceneId);
}

/** Annule le dernier patch MJ de la scène active (restaure les clés touchées). */
export function undoMapPatch() {
  if (!store.get().isDM) return false;
  const prev = _undo.pop(store.get().activeSceneId);
  if (!prev) return false;
  const cur = store.get().map || { ...DEFAULT_MAP };
  store.set({ map: { ...cur, ...prev } });
  _savePending = true;
  saveDebounced();
  return true;
}

/** Applique un patch à l'état de la carte (optimiste + persistance MJ). */
export function patchMap(patch, { record = true } = {}) {
  if (!store.get().isDM) return;
  const cur = store.get().map || { ...DEFAULT_MAP };
  if (record) _undo.record(store.get().activeSceneId, cur, patch);
  const next = { ...cur, ...patch };
  store.set({ map: next });
  _savePending = true;
  saveDebounced();
}

/* ── Fond de carte ────────────────────────────────────────── */

/** Téléverse une image de fond et met à jour la carte (MJ). */
export async function uploadBackground(file) {
  if (!store.get().isDM) return;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const key = `${Date.now()}.${ext}`;
  let ref;
  try {
    ref = await uploadMedia(BG_BUCKET, key, file, file.type || 'image/jpeg');
  } catch (e) {
    console.error('[map] upload échoué:', e.message);
    throw e;
  }
  const dims = await imageDimensions(file);
  patchMap({ bg: ref, bgW: dims.w, bgH: dims.h });
  _bgUrlForPath = null;
  await refreshBgUrl();
}

/** Définit le fond de la scène active depuis un chemin Storage déjà présent
 *  (ex. banque d'images), en calculant ses dimensions. MJ. */
export async function setBackgroundFromPath(path) {
  if (!store.get().isDM || !path) return;
  const url = await signedTokenUrl(path);
  const dims = await new Promise((resolve) => {
    if (!url) return resolve({ w: 0, h: 0 });
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = url;
  });
  patchMap({ bg: path, bgW: dims.w, bgH: dims.h });
  _bgUrlForPath = null;
  await refreshBgUrl();
}

function imageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = URL.createObjectURL(file);
  });
}

/* ── Jetons ───────────────────────────────────────────────── */

const TOKEN_COLORS = [
  '#7c6af7', '#4ec994', '#e5c07b', '#e06c75',
  '#61afef', '#c678dd', '#56b6c2', '#d19a66',
];

export function addToken(opts = {}) {
  if (!store.get().isDM) return;
  const { x, y, label = '', color, size = 1, charId = null, img = null } = opts;
  const m = store.get().map || { ...DEFAULT_MAP };
  const id = `t_${crypto.randomUUID().slice(0, 8)}`;
  const tk = {
    id,
    x,
    y,
    size, // multiplicateur de case (1 = Moyen, 2 = Grand…)
    color: color || TOKEN_COLORS[m.tokens.length % TOKEN_COLORS.length],
    label,
    charId,
    img,
  };
  // Champs optionnels (jeton autonome : PV/CA/vision/note propres ; lien combat).
  for (const k of ['hp', 'hpMax', 'hpTemp', 'ac', 'vision', 'darkvision', 'dvManual', 'note', 'entityId', 'aura', 'rot', 'elev']) {
    if (opts[k] !== undefined && opts[k] !== '' && opts[k] !== null) tk[k] = opts[k];
  }
  patchMap({ tokens: [...m.tokens, tk] });
  return id;
}

/** Importe un jeton par PJ depuis les fiches (MJ). */
export function addTokensFromParty() {
  if (!store.get().isDM) return;
  const m = store.get().map || { ...DEFAULT_MAP };
  const chars = store.get().characters;
  const existing = new Set(m.tokens.map((t) => t.charId).filter(Boolean));
  const grid = m.grid.size || 70;
  let i = m.tokens.length;
  const tokens = [...m.tokens];
  for (const c of chars) {
    if (existing.has(c.id)) continue;
    const dv = metersToCells(m, c.data?.darkvision); // vision dans le noir de la fiche
    tokens.push({
      id: `t_${crypto.randomUUID().slice(0, 8)}`,
      x: grid * (1.5 + (i % 6)),
      y: grid * 1.5,
      size: 1,
      color: TOKEN_COLORS[i % TOKEN_COLORS.length],
      label: initials(c.name),
      charId: c.id,
      img: c.data?.portrait || null, // portrait de fiche = image de jeton
      vision: 6, // ≈ 30 ft de vision normale, réglable par jeton
      ...(dv > 0 ? { darkvision: dv } : {}),
    });
    i++;
  }
  patchMap({ tokens });
}

/**
 * Convertit une distance en MÈTRES (valeur des fiches, ex. `data.darkvision`)
 * en nombre de CASES de la carte. `feetPerCell` porte la distance d'une case
 * dans l'unité de la scène (`unit` = 'ft' | 'm'). 0 si distance nulle/invalide.
 */
export function metersToCells(m, meters) {
  const v = Number(meters) || 0;
  if (v <= 0) return 0;
  const map = m || store.get().map || DEFAULT_MAP;
  const per = Number(map.feetPerCell) || 5;
  const metersPerCell = map.unit === 'm' ? per : per * 0.3048; // 1 pied = 0,3048 m
  return Math.max(0, Math.round(v / metersPerCell));
}

/**
 * Recopie la vision dans le noir des fiches sur les jetons liés (MJ). Ignore les
 * jetons dont la vision a été réglée à la main (`dvManual`). Ne patche que si une
 * valeur change réellement → sûr à appeler à chaque changement du store.
 */
export function syncTokenVisionFromSheets() {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m || !m.tokens?.length) return;
  const chars = store.get().characters;
  let changed = false;
  const tokens = m.tokens.map((t) => {
    if (!t.charId || t.dvManual) return t;
    const ch = chars.find((c) => c.id === t.charId);
    if (!ch) return t;
    const want = metersToCells(m, ch.data?.darkvision);
    const cur = Number(t.darkvision) || 0;
    if (want === cur) return t;
    changed = true;
    const nt = { ...t };
    if (want > 0) nt.darkvision = want;
    else delete nt.darkvision;
    return nt;
  });
  if (changed) patchMap({ tokens }, { record: false }); // sync auto : pas dans l'historique Ctrl+Z
}

function initials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

export function moveToken(id, x, y, opts) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({
    tokens: m.tokens.map((t) => (t.id === id ? { ...t, x, y } : t)),
  }, opts);
}

export function updateToken(id, patch) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({
    tokens: m.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  });
}

export function removeToken(id) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ tokens: m.tokens.filter((t) => t.id !== id) });
}

/* ── Tuiles / décors (props posés sur la carte) ───────────── */

export function addTile({ img, x, y, w = 140, h = 140, above = false }) {
  if (!store.get().isDM) return;
  const m = store.get().map || { ...DEFAULT_MAP };
  const tile = { id: `ti_${crypto.randomUUID().slice(0, 8)}`, img, x, y, w, h, rot: 0, opacity: 1, above };
  patchMap({ tiles: [...(m.tiles || []), tile] });
  return tile.id;
}

export function updateTile(id, patch) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ tiles: (m.tiles || []).map((t) => (t.id === id ? { ...t, ...patch } : t)) });
}

export function removeTile(id) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ tiles: (m.tiles || []).filter((t) => t.id !== id) });
}

/* ── Brouillard de guerre ─────────────────────────────────── */

export function setFog(on) {
  if (!store.get().isDM) return;
  const m = store.get().map || { ...DEFAULT_MAP };
  patchMap({ fog: { ...m.fog, on } });
}

/** Révèle (reveal=true) ou masque (false) un ensemble de cases. */
export function paintFog(cells, reveal) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  const set = new Set(m.fog.revealed);
  for (const c of cells) {
    if (reveal) set.add(c);
    else set.delete(c);
  }
  patchMap({ fog: { ...m.fog, revealed: [...set] } });
}

export function revealAll() {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ fog: { ...m.fog, revealed: ['ALL'] } });
}

export function hideAll() {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ fog: { ...m.fog, revealed: [] } });
}

/* ── Marqueurs / notes sur la carte (MJ) ─────────────────── */

export function addPin({ x, y }) {
  if (!store.get().isDM) return;
  const m = store.get().map || { ...DEFAULT_MAP };
  const n = (m.pins.reduce((mx, p) => Math.max(mx, p.n || 0), 0) || 0) + 1;
  const pin = { id: `p_${crypto.randomUUID().slice(0, 8)}`, x, y, n, note: '', revealed: false };
  patchMap({ pins: [...m.pins, pin] });
  return pin.id;
}

export function updatePin(id, patch) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ pins: m.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
}

export function removePin(id) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ pins: m.pins.filter((p) => p.id !== id) });
}

/* ── Dessins / annotations (MJ, partagés) ─────────────────── */

export function addDrawing(d) {
  if (!store.get().isDM) return;
  const m = store.get().map || { ...DEFAULT_MAP };
  const drawing = { id: `d_${crypto.randomUUID().slice(0, 8)}`, ...d };
  patchMap({ drawings: [...(m.drawings || []), drawing] });
  return drawing.id;
}

export function removeLastDrawing() {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m || !(m.drawings || []).length) return;
  patchMap({ drawings: m.drawings.slice(0, -1) });
}

export function clearDrawings() {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ drawings: [] });
}

/* ── Étiquettes de zone (MJ, révélables) ──────────────────── */

export function addLabel({ x, y, text }) {
  if (!store.get().isDM) return;
  const m = store.get().map || { ...DEFAULT_MAP };
  const label = { id: `lb_${crypto.randomUUID().slice(0, 8)}`, x, y, text: text || 'Lieu', color: '#e5c07b', revealed: true };
  patchMap({ labels: [...(m.labels || []), label] });
  return label.id;
}

export function updateLabel(id, patch) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ labels: (m.labels || []).map((l) => (l.id === id ? { ...l, ...patch } : l)) });
}

export function removeLabel(id) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ labels: (m.labels || []).filter((l) => l.id !== id) });
}

/* ── Lumière dynamique (murs, vision par jeton, mémoire) ──── */

export function setLighting(on) {
  if (!store.get().isDM) return;
  const m = store.get().map || { ...DEFAULT_MAP };
  patchMap({ lighting: { ...m.lighting, on } });
}

export function setTokenVision(id, cells) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  const v = Math.max(0, Math.min(60, Number(cells) || 0));
  patchMap({ tokens: m.tokens.map((t) => (t.id === id ? { ...t, vision: v } : t)) });
}

export function addWall(seg) {
  if (!store.get().isDM) return;
  const m = store.get().map || { ...DEFAULT_MAP };
  patchMap({ walls: [...m.walls, seg] });
}

/** Bascule l'état ouvert/fermé d'une porte (mur avec door=true), par index. */
export function toggleDoor(i) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  const w = m.walls[i];
  if (!w || !w.door) return;
  patchMap({ walls: m.walls.map((x, idx) => (idx === i ? { ...x, open: !x.open } : x)) });
}

/** Met à jour une porte/un mur à l'index donné (verrou, secret…) (MJ). */
export function updateWallAt(i, patch) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m || !m.walls[i]) return;
  patchMap({ walls: m.walls.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
}

/** Supprime le mur/porte à l'index donné (MJ). */
export function removeWallAt(i) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m || !m.walls[i]) return;
  patchMap({ walls: m.walls.filter((_, idx) => idx !== i) });
}

export function removeLastWall() {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m || !m.walls.length) return;
  patchMap({ walls: m.walls.slice(0, -1) });
}

export function clearWalls() {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ walls: [] });
}

/** Ajoute des cases à la mémoire d'exploration (MJ uniquement, persisté). */
export function accumulateExplored(cells) {
  if (!store.get().isDM || !cells.length) return;
  const m = store.get().map;
  if (!m) return;
  const set = new Set(m.fog.explored);
  let changed = false;
  for (const c of cells) {
    if (!set.has(c)) {
      set.add(c);
      changed = true;
    }
  }
  if (changed) patchMap({ fog: { ...m.fog, explored: [...set] } }, { record: false }); // auto-exploration : pas dans l'historique Ctrl+Z
}

export function clearExplored() {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ fog: { ...m.fog, explored: [] } });
}

/* ── Sources de lumière ───────────────────────────────────── */

export function addLight({ x, y, radius = 4, color = '#ffb86b' }) {
  if (!store.get().isDM) return;
  const m = store.get().map || { ...DEFAULT_MAP };
  const light = { id: `l_${crypto.randomUUID().slice(0, 8)}`, x, y, radius, color };
  patchMap({ lights: [...m.lights, light] });
  return light.id;
}

export function updateLight(id, patch) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ lights: m.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
}

export function removeLight(id) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ lights: m.lights.filter((l) => l.id !== id) });
}

export function clearLights() {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ lights: [] });
}

/* ── Images de jetons (bucket battlemap, prefix tokens/) ──── */

const _tokenUrlCache = new Map();
export function tokenImgUrl(path) {
  return path ? _tokenUrlCache.get(path) || null : null;
}

/** Résout les URL signées manquantes pour les jetons à image, puis re-render. */
export async function resolveTokenUrls() {
  const m = store.get().map;
  if (!m) return;
  let changed = false;
  const paths = [...m.tokens.map((t) => t.img), ...(m.tiles || []).map((t) => t.img), ...(m.tokenLib || [])].filter(Boolean);
  for (const path of paths) {
    if (_tokenUrlCache.has(path)) continue;
    const url = await cachedSignedUrl(BG_BUCKET, path);
    if (url) {
      _tokenUrlCache.set(path, url);
      changed = true;
    }
  }
  if (changed) store.set({ map: { ...store.get().map } });
}

/** Résout (et met en cache) l'URL signée d'une image de jeton, pour un usage
 *  hors carte (ex. vignette dans le compendium). */
export async function signedTokenUrl(path) {
  if (!path) return null;
  if (_tokenUrlCache.has(path)) return _tokenUrlCache.get(path);
  const url = await cachedSignedUrl(BG_BUCKET, path);
  if (!url) return null;
  _tokenUrlCache.set(path, url);
  return url;
}

/** Téléverse une image dans le bucket des jetons et renvoie son chemin Storage
 *  (sans toucher à une scène : utilisable depuis le compendium). MJ uniquement. */
export async function uploadTokenAsset(file) {
  if (!store.get().isDM) return null;
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const key = `tokens/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  return uploadMedia(BG_BUCKET, key, file, file.type || 'image/png');
}

/** Téléverse une image dans la bibliothèque de jetons (MJ). */
export async function uploadLibraryImage(file) {
  if (!store.get().isDM) return null;
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const key = `tokens/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const path = await uploadMedia(BG_BUCKET, key, file, file.type || 'image/png');
  const m = store.get().map || { ...DEFAULT_MAP };
  patchMap({ tokenLib: [...(m.tokenLib || []), path] });
  await resolveTokenUrls();
  return path;
}

/** Retire une image de la bibliothèque (ne supprime pas le fichier Storage). */
export function removeLibraryImage(path) {
  if (!store.get().isDM) return;
  const m = store.get().map;
  if (!m) return;
  patchMap({ tokenLib: (m.tokenLib || []).filter((p) => p !== path) });
}

/** Téléverse une image et l'associe à un jeton (MJ). */
export async function uploadTokenImage(file, tokenId) {
  if (!store.get().isDM) return;
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const key = `tokens/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const path = await uploadMedia(BG_BUCKET, key, file, file.type || 'image/png');
  updateToken(tokenId, { img: path });
  await resolveTokenUrls();
}

/* ── Realtime (état de la carte) ──────────────────────────── */

export function subscribeMap() {
  const ch = backend.realtime
    .channel('scenes_feed')
    // État des scènes : si la scène active est modifiée, on re-fusionne.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scenes' }, async (payload) => {
      if (!sameCampaign(payload)) return;
      const activeId = store.get().activeSceneId;
      if (payload.eventType === 'DELETE') {
        store.set({ scenes: store.get().scenes.filter((s) => s.id !== payload.old.id) });
        return;
      }
      const row = payload.new;
      // Tient la liste des scènes à jour (nom / ajout).
      const cur = store.get().scenes;
      const meta = { id: row.id, name: row.name, sort: row.sort };
      const list = cur.some((s) => s.id === row.id) ? cur.map((s) => (s.id === row.id ? meta : s)) : [...cur, meta];
      list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)); // reflète un réordonnancement distant
      store.set({ scenes: list });
      // Re-fusionne l'état seulement pour la scène active, et JAMAIS pour notre
      // propre écho (sinon il écrase l'état optimiste local pendant une bascule).
      if (row.id === activeId && row.state && !isSelfSceneEcho(row.id)) {
        _sceneRowAt = Date.now(); // l'update realtime est bien arrivée (cf. reloadActiveSceneIfStale)
        const prevBg = store.get().map?.bg;
        store.set({ map: normalizeMap(row.state) });
        if (row.state.bg !== prevBg) await refreshBgUrl();
        await resolveTokenUrls();
      }
    })
    // Pointeur de scène active : les joueurs suivent le MJ qui bascule.
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_state', filter: `key=eq.${ACTIVE_KEY}` },
      async (payload) => {
        if (!sameCampaign(payload)) return;
        const id = payload.new?.value?.id;
        if (id && id !== store.get().activeSceneId) {
          store.set({ activeSceneId: id });
          await loadSceneState(id);
        }
      }
    )
    .subscribe();

  return () => backend.realtime.removeChannel(ch);
}

/* ── Ping (broadcast éphémère) ────────────────────────────── */

let _pingChannel = null;

/** Canal de diffusion éphémère de la carte : ping, déplacement de jeton, vue. */
export function subscribeMapBroadcast({ onPing, onTokenMove, onView, onDraw, onCursor, onSceneDirty, onTemplate } = {}) {
  _pingChannel = backend.realtime.channel(`map_rt:${campaignId()}`, { config: { broadcast: { self: true } } });
  _pingChannel
    .on('broadcast', { event: 'ping' }, ({ payload }) => onPing?.(payload))
    .on('broadcast', { event: 'tokenmove' }, ({ payload }) => onTokenMove?.(payload))
    .on('broadcast', { event: 'view' }, ({ payload }) => onView?.(payload))
    .on('broadcast', { event: 'draw' }, ({ payload }) => onDraw?.(payload))
    .on('broadcast', { event: 'cursor' }, ({ payload }) => onCursor?.(payload))
    .on('broadcast', { event: 'scenedirty' }, ({ payload }) => onSceneDirty?.(payload))
    .on('broadcast', { event: 'template' }, ({ payload }) => onTemplate?.(payload))
    .subscribe();

  return () => {
    if (_pingChannel) backend.realtime.removeChannel(_pingChannel);
    _pingChannel = null;
  };
}

/** Émet un ping à la position (x,y) en px image. Accessible à tous. */
export function sendPing(x, y) {
  if (!_pingChannel) return;
  const { profile } = store.get();
  _pingChannel.send({
    type: 'broadcast',
    event: 'ping',
    payload: { x, y, name: profile?.display_name || 'Anonyme', t: Date.now() },
  });
}

/** Recharge l'état de la scène active depuis la base (filet temps réel). */
export async function reloadActiveScene() {
  await loadSceneState(store.get().activeSceneId);
}

/* Horodatage du dernier état de scène reçu via postgres_changes. */
let _sceneRowAt = 0;
let _dirtyTimer = null;

/**
 * Filet de sécurité économe : ne recharge la scène active que si l'update
 * postgres_changes correspondant au ping `scenedirty` n'est PAS arrivée.
 * Avant, chaque sauvegarde MJ coûtait l'état complet DEUX fois par joueur
 * (réplication realtime + re-téléchargement systématique) — gros poste egress.
 */
export function reloadActiveSceneIfStale() {
  const pingAt = Date.now();
  clearTimeout(_dirtyTimer);
  _dirtyTimer = setTimeout(() => {
    if (_sceneRowAt >= pingAt - 1500) return; // la réplication realtime a fait le travail
    reloadActiveScene();
  }, 2000);
}

/** Diffuse un gabarit de sort éphémère (affiché chez tous, coloré par joueur). */
export function sendTemplate(tmpl) {
  if (!_pingChannel) return;
  const { user, profile } = store.get();
  _pingChannel.send({
    type: 'broadcast',
    event: 'template',
    payload: { ...tmpl, by: user?.id, name: profile?.display_name || '' },
  });
}

/** Diffuse la position du curseur (px image) pour l'afficher chez les autres. */
export function sendCursor(x, y) {
  if (!_pingChannel) return;
  const { user, profile } = store.get();
  _pingChannel.send({
    type: 'broadcast',
    event: 'cursor',
    payload: { x, y, by: user?.id, name: profile?.display_name || 'Anonyme' },
  });
}

/** Diffuse le déplacement d'un jeton (utilisé par les joueurs). */
export function sendTokenMove(id, x, y) {
  if (!_pingChannel) return;
  _pingChannel.send({ type: 'broadcast', event: 'tokenmove', payload: { id, x, y, by: store.get().user?.id } });
}

/** Diffuse la vue du MJ (px,py,z) pour recadrer les joueurs. */
export function sendView(view) {
  if (!_pingChannel) return;
  _pingChannel.send({
    type: 'broadcast',
    event: 'view',
    payload: { ...view, by: store.get().user?.id, name: store.get().profile?.display_name || 'MJ' },
  });
}

/** Diffuse un dessin éphémère (utilisé par les joueurs, non persisté). */
export function sendDraw(drawing) {
  if (!_pingChannel) return;
  _pingChannel.send({ type: 'broadcast', event: 'draw', payload: { ...drawing, by: store.get().user?.id } });
}

/** Applique localement un déplacement de jeton (sans persistance). */
export function applyTokenMoveLocal(id, x, y) {
  const m = store.get().map;
  if (!m) return;
  store.set({ map: { ...m, tokens: m.tokens.map((t) => (t.id === id ? { ...t, x, y } : t)) } });
}
