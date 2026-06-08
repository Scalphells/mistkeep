import { backend } from './backend.js';
import { store } from '../state.js';

/**
 * Trésor de groupe partagé : un « pot commun » de pièces et d'objets que le MJ
 * remplit (butin d'un combat, coffre…) et distribue ensuite aux personnages.
 *
 * Stocké dans `session_state` (clé `party_loot`), comme le journal de combat :
 * écriture MJ (RLS), lecture par toute la table, synchro temps réel. Aucune
 * migration nécessaire. Forme : { coins: {pp,gp,ep,sp,cp}, items: [{id,nm,qty,note}] }.
 */

const KEY = 'party_loot';

const empty = () => ({ coins: {}, items: [] });

function normalize(v) {
  const o = v && typeof v === 'object' ? v : {};
  return {
    coins: o.coins && typeof o.coins === 'object' ? o.coins : {},
    items: Array.isArray(o.items) ? o.items : [],
  };
}

/** État courant du trésor (toujours normalisé). */
export function getPartyLoot() {
  return normalize(store.get().partyLoot);
}

export async function loadPartyLoot() {
  const { data } = await backend.db.from('session_state').select('value').eq('key', KEY).maybeSingle();
  store.set({ partyLoot: normalize(data?.value) });
}

let _subbed = false;
export function subscribePartyLoot() {
  if (_subbed) return () => {};
  _subbed = true;
  backend.realtime
    .channel('party_loot_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_state', filter: `key=eq.${KEY}` },
      (payload) => store.set({ partyLoot: normalize(payload.new?.value) })
    )
    .subscribe();
  return () => {};
}

async function persist(next) {
  if (!store.get().isDM) return;
  store.set({ partyLoot: next }); // affichage optimiste
  const { error } = await backend.db
    .from('session_state')
    .upsert(
      { key: KEY, value: next, updated_at: new Date().toISOString(), updated_by: store.get().user?.id ?? null },
      { onConflict: 'key' }
    );
  if (error) console.error('[party loot]', error.message);
}

function uid() {
  return `l_${crypto.randomUUID().slice(0, 8)}`;
}

/* ── Mutations MJ ─────────────────────────────────────────── */

export function addLootItem({ nm, qty, note } = {}) {
  const cur = getPartyLoot();
  persist({
    ...cur,
    items: [...cur.items, { id: uid(), nm: String(nm || 'Objet').trim(), qty: Math.max(1, Number(qty) || 1), note: String(note || '') }],
  });
}

export function updateLootItem(id, patch) {
  const cur = getPartyLoot();
  persist({ ...cur, items: cur.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
}

export function removeLootItem(id) {
  const cur = getPartyLoot();
  persist({ ...cur, items: cur.items.filter((it) => it.id !== id) });
}

export function setLootCoin(k, v) {
  const cur = getPartyLoot();
  persist({ ...cur, coins: { ...cur.coins, [k]: Math.max(0, Number(v) || 0) } });
}

/** Remplace tout le trésor (utilisé après une répartition de pièces). */
export function setPartyLoot(next) {
  persist(normalize(next));
}
