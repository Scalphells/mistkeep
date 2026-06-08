import { supabase } from '../lib/supabase.js';
import { store } from '../state.js';
import { insertWithOutbox } from '../lib/outbox.js';

/**
 * Chat partagé temps réel.
 *
 * Source de vérité : table `messages`.
 * Deux canaux :
 *   - 'public' : visible par tous les joueurs connectés.
 *   - 'dm'     : messages privés MJ ↔ joueur (RLS : expéditeur + MJ).
 *
 * Diffusion via Supabase Realtime (INSERT). La RLS garantit qu'un joueur ne
 * reçoit jamais un message 'dm' qui ne le concerne pas.
 */

const MAX_HISTORY = 100;
const MAX_LEN = 2000;

/** Charge l'historique récent des messages (RLS filtre les canaux privés). */
export async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);

  if (error) {
    console.warn('[chat] chargement impossible:', error.message);
    return;
  }
  store.set({ messages: data.reverse() });
}

/**
 * Envoie un message.
 * @param {string} content  texte du message
 * @param {string} channel  'public' | 'dm'
 */
export async function sendMessage(content, channel = 'public', recipientId = null) {
  const text = String(content).trim();
  if (!text) return;
  if (text.length > MAX_LEN) {
    throw new Error(`Message trop long (max ${MAX_LEN} caractères).`);
  }

  const { user, profile } = store.get();
  const row = {
    channel,
    content: text,
    sender_id: user?.id ?? null,
    sender_name: profile?.display_name || 'Anonyme',
  };
  // recipient_id n'existe que pour le canal privé (migration 0011). On l'omet
  // pour 'public' afin de rester compatible si la migration n'est pas appliquée.
  if (channel === 'dm') row.recipient_id = recipientId || null;

  const res = await insertWithOutbox('messages', row);
  if (!res.ok) throw new Error(res.error?.message || "Échec de l'envoi.");
  // Hors-ligne : affichage optimiste (resynchronisé au retour réseau).
  if (res.queued) {
    const cur = store.get().messages;
    if (!cur.some((m) => m.id === res.row.id)) {
      store.set({ messages: [...cur, { ...res.row, created_at: new Date().toISOString() }].slice(-MAX_HISTORY) });
    }
  }
}

/**
 * Efface tous les messages d'un canal (MJ uniquement).
 * @param {string} channel  'public' | 'dm'
 */
export async function clearChannel(channel = 'public') {
  if (!store.get().isDM) return;
  const { error } = await supabase.from('messages').delete().eq('channel', channel);
  if (error) {
    console.error('[chat] effacement échoué:', error.message);
    return;
  }
  store.set({
    messages: store.get().messages.filter((m) => m.channel !== channel),
  });
}

/**
 * S'abonne aux nouveaux messages en temps réel.
 * Renvoie une fonction de désinscription.
 */
let _msgChannel = null;
export function subscribeMessages() {
  if (_msgChannel) return () => {}; // abonnement unique pour la session
  const channel = supabase
    .channel('messages_feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const m = payload.new;
        // Évite les doublons (l'INSERT local peut aussi revenir par realtime).
        const cur = store.get().messages;
        if (cur.some((x) => x.id === m.id)) return;
        store.set({ messages: [...cur, m].slice(-MAX_HISTORY) });
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages' },
      (payload) => {
        const id = payload.old?.id;
        if (!id) return;
        store.set({
          messages: store.get().messages.filter((m) => m.id !== id),
        });
      }
    )
    .subscribe();
  _msgChannel = channel;

  return () => {}; // canal conservé pour la session (dock + onglet partagés)
}
