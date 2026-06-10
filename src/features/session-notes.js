import { backend } from '../lib/backend.js';
import { store } from '../state.js';
import { insertWithOutbox } from '../lib/outbox.js';
import { showToast } from '../lib/toast.js';

/**
 * Notes de session : journal de partie. Chacun peut écrire ses notes ; une note
 * est partagée (visible de tous) ou privée (auteur seul). Le MJ voit tout.
 * RLS (migration 0017) : select (dm|auteur|partagé), insert self, update/delete
 * (auteur|MJ). Diffusion Realtime.
 */

/** L'utilisateur courant peut-il modifier cette note ? (auteur ou MJ) */
export function canEditNote(n) {
  return store.get().isDM || n?.created_by === store.get().user?.id;
}

export async function loadNotes() {
  const { data, error } = await backend.db
    .from('session_notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[notes] chargement impossible:', error.message);
    return;
  }
  store.set({ sessionNotes: data });
}

export async function addNote(content, shared = false) {
  const text = String(content).trim();
  if (!text) return;
  const res = await insertWithOutbox('session_notes', {
    content: text,
    shared: !!shared,
    created_by: store.get().user?.id ?? null,
  });
  if (!res.ok) throw new Error(res.error?.message || "Échec de l'ajout.");
  // Hors-ligne : affichage optimiste (resynchronisé au retour réseau).
  if (res.queued) {
    const cur = store.get().sessionNotes;
    if (!cur.some((n) => n.id === res.row.id)) {
      store.set({ sessionNotes: [{ ...res.row, created_at: new Date().toISOString() }, ...cur] });
    }
  }
}

/** Met à jour une note (contenu et/ou partage) — auteur ou MJ. */
export async function updateNote(id, patch) {
  const cur = store.get().sessionNotes.find((n) => n.id === id);
  if (!cur || !canEditNote(cur)) return;
  const clean = {};
  if (patch.content !== undefined) {
    const t = String(patch.content).trim();
    if (!t) return;
    clean.content = t;
  }
  if (patch.shared !== undefined) clean.shared = !!patch.shared;
  store.set({
    sessionNotes: store.get().sessionNotes.map((n) => (n.id === id ? { ...n, ...clean } : n)),
  });
  const { error } = await backend.db.from('session_notes').update(clean).eq('id', id);
  if (error) {
    console.error('[notes] mise à jour échouée:', error.message);
    showToast('Échec de l’enregistrement de la note — vérifie ta connexion.', { type: 'warn', icon: '⚠️' });
  }
}

export async function deleteNote(id) {
  const cur = store.get().sessionNotes.find((n) => n.id === id);
  if (cur && !canEditNote(cur)) return;
  const { error } = await backend.db.from('session_notes').delete().eq('id', id);
  if (error) {
    console.error('[notes] suppression échouée:', error.message);
    showToast('Échec de la suppression de la note.', { type: 'warn', icon: '⚠️' });
    return;
  }
  store.set({ sessionNotes: store.get().sessionNotes.filter((n) => n.id !== id) });
}

export function subscribeNotes() {
  const channel = backend.realtime
    .channel('session_notes_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_notes' },
      (payload) => {
        const cur = store.get().sessionNotes;
        if (payload.eventType === 'DELETE') {
          store.set({ sessionNotes: cur.filter((n) => n.id !== payload.old.id) });
          return;
        }
        const row = payload.new;
        const exists = cur.some((n) => n.id === row.id);
        const next = exists
          ? cur.map((n) => (n.id === row.id ? row : n))
          : [row, ...cur];
        // Tri décroissant par date pour rester cohérent avec loadNotes.
        next.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        store.set({ sessionNotes: next });
      }
    )
    .subscribe();

  return () => backend.realtime.removeChannel(channel);
}
