import { backend } from './backend.js';
import { store } from '../state.js';
import { showToast } from './toast.js';

/**
 * Journal de quêtes partagé : objectifs visibles de toute la table (actifs /
 * terminés). Écriture MJ (RLS), lecture par tous, synchro temps réel via
 * `session_state` (clé `quest_log`). Distinct des pages MJ de campagne.
 * Forme : { quests: [{ id, title, note, done }] }.
 */

const KEY = 'quest_log';

function normalize(v) {
  const o = v && typeof v === 'object' ? v : {};
  return { quests: Array.isArray(o.quests) ? o.quests : [] };
}

export function getQuests() {
  return normalize(store.get().questLog);
}

export async function loadQuests() {
  const { data } = await backend.db.from('session_state').select('value').eq('key', KEY).maybeSingle();
  store.set({ questLog: normalize(data?.value) });
}

let _subbed = false;
export function subscribeQuests() {
  if (_subbed) return () => {};
  _subbed = true;
  backend.realtime
    .channel('quest_log_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_state', filter: `key=eq.${KEY}` },
      (payload) => store.set({ questLog: normalize(payload.new?.value) })
    )
    .subscribe();
  return () => {};
}

async function persist(next) {
  if (!store.get().isDM) return;
  store.set({ questLog: next });
  const { error } = await backend.db
    .from('session_state')
    .upsert(
      { key: KEY, value: next, updated_at: new Date().toISOString(), updated_by: store.get().user?.id ?? null },
      { onConflict: 'key' }
    );
  if (error) {
    console.error('[quests]', error.message);
    showToast('Échec de la mise à jour des quêtes — vérifie ta connexion.', { type: 'warn', icon: '⚠️' });
  }
}

function uid() {
  return `q_${crypto.randomUUID().slice(0, 8)}`;
}

/* ── Mutations MJ ─────────────────────────────────────────── */

export function addQuest({ title, note } = {}) {
  const cur = getQuests();
  persist({ quests: [...cur.quests, { id: uid(), title: String(title || 'Quête').trim(), note: String(note || ''), done: false }] });
}

export function updateQuest(id, patch) {
  const cur = getQuests();
  persist({ quests: cur.quests.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
}

export function toggleQuestDone(id) {
  const cur = getQuests();
  persist({ quests: cur.quests.map((q) => (q.id === id ? { ...q, done: !q.done } : q)) });
}

export function removeQuest(id) {
  const cur = getQuests();
  persist({ quests: cur.quests.filter((q) => q.id !== id) });
}
