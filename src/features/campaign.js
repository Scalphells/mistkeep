import { backend } from '../lib/backend.js';
import { store } from '../state.js';
import { debounce } from '../lib/utils.js';

/**
 * Classeur de campagne (MJ) — arbre de pages à profondeur libre (façon Obsidian).
 * Chaque nœud : { id, name, body (Markdown), done, sceneId, entryIds, children[] }.
 * Persisté dans `session_state['campaign']` (écriture MJ). Compatible avec
 * l'ancien format { name, arcs[] } (migré au chargement). Aucun contenu sous
 * copyright fourni : ce sont des cadres que le MJ remplit avec son matériel.
 */

const KEY = 'campaign';

function uid(p) {
  return `${p}_${crypto.randomUUID().slice(0, 8)}`;
}

/** Crée un nœud vierge. */
export function campNode(name = 'Sans titre', body = '') {
  return { id: uid('n'), name, body, done: false, sceneId: null, entryIds: [], children: [] };
}

/** Arborescence par défaut (générique, à remplir par le MJ). */
function seed() {
  const n = (name, kids = []) => {
    const x = campNode(name);
    x.children = kids;
    return x;
  };
  return [
    n('Préparation', [campNode('Session zéro & création'), campNode('Découverte de la région'), campNode('Conduire la partie')]),
    n('Acte I', [campNode('Arc 1')]),
    n('Acte II'),
    n('Acte III'),
    n('Acte IV'),
    n('Annexes', [campNode('PNJ'), campNode('Objets')]),
  ];
}

/** Normalise un nœud (compat ancien format { arcs }). */
function normNode(o) {
  const kidsRaw = Array.isArray(o.children) ? o.children : Array.isArray(o.arcs) ? o.arcs : [];
  return {
    id: o.id || uid('n'),
    name: typeof o.name === 'string' ? o.name : 'Sans titre',
    body: typeof o.body === 'string' ? o.body : '',
    done: !!o.done,
    sceneId: o.sceneId ?? null,
    entryIds: Array.isArray(o.entryIds) ? o.entryIds : [],
    children: kidsRaw.map(normNode),
  };
}
function normalize(v) {
  return Array.isArray(v) && v.length ? v.map(normNode) : seed();
}

export async function loadCampaign() {
  const { data } = await backend.db.from('session_state').select('value').eq('key', KEY).maybeSingle();
  store.set({ campaign: normalize(data?.value) });
}

const _persist = debounce(async () => {
  if (!store.get().isDM) return;
  const { error } = await backend.db.from('session_state').upsert(
    { key: KEY, value: store.get().campaign, updated_at: new Date().toISOString(), updated_by: store.get().user?.id ?? null },
    { onConflict: 'key' }
  );
  if (error) console.warn('[campaign]', error.message);
}, 600);

/** Met à jour le classeur (optimiste + persistance debouncée, ou immédiate). */
export function setCampaign(nodes, immediate = false) {
  store.set({ campaign: nodes });
  _persist();
  if (immediate) _persist.flush?.();
}

/** Copie profonde de l'arbre courant (pour mutation immuable). */
export function cloneCampaign() {
  return JSON.parse(JSON.stringify(store.get().campaign || []));
}

/** Recherche un nœud par id (profondeur). */
export function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const f = findNode(n.children || [], id);
    if (f) return f;
  }
  return null;
}

/** Supprime un nœud (et sa descendance) par id, en place. */
export function removeNode(nodes, id) {
  const i = nodes.findIndex((n) => n.id === id);
  if (i >= 0) {
    nodes.splice(i, 1);
    return true;
  }
  for (const n of nodes) if (removeNode(n.children || [], id)) return true;
  return false;
}

/** Chemin d'ids depuis la racine jusqu'au nœud (inclus), ou null. */
export function pathTo(nodes, id, acc = []) {
  for (const n of nodes) {
    if (n.id === id) return [...acc, n.id];
    const r = pathTo(n.children || [], id, [...acc, n.id]);
    if (r) return r;
  }
  return null;
}

/** Liste à plat avec profondeur (dock / progression). */
export function flattenCampaign(nodes, depth = 0, out = []) {
  for (const n of nodes) {
    out.push({ node: n, depth });
    flattenCampaign(n.children || [], depth + 1, out);
  }
  return out;
}

/** Progression (nœuds terminés / total). */
export function campaignProgress(nodes) {
  const flat = flattenCampaign(nodes);
  const total = flat.length;
  const done = flat.filter((x) => x.node.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export { uid as campaignUid };
