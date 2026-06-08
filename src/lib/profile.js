import { backend } from './backend.js';
import { store } from '../state.js';

/**
 * Profil joueur : nom + couleur personnelle. La couleur sert d'identité visuelle
 * (avatar = initiales colorées) dans le chat, les dés et l'en-tête.
 *
 * `store.players` sert d'annuaire des profils (id → nom, couleur, rôle), chargé
 * pour tout le monde au démarrage.
 */

export const PALETTE = [
  '#7c6af7', '#4ec994', '#e5c07b', '#e06c75',
  '#56b6c2', '#c678dd', '#d19a66', '#61afef',
  '#e879a6', '#9acd5b', '#f0883e', '#5bc0be',
];

/** Couleur d'un profil par id (sinon dérivée du nom, sinon accent). */
export function colorFor(id, name = '') {
  const p = store.get().players.find((x) => x.id === id);
  if (p?.color) return p.color;
  if (name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  return 'var(--accent)';
}

export function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';
}

/** Charge l'annuaire des profils (tous les utilisateurs). */
export async function loadDirectory() {
  const { data, error } = await backend.db
    .from('profiles')
    .select('id, display_name, email, role, color')
    .order('display_name', { ascending: true });
  if (error) {
    console.warn('[profile] annuaire impossible:', error.message);
    return;
  }
  store.set({ players: data });
}

/** Met à jour son propre profil (nom, couleur). */
export async function updateMyProfile(patch) {
  const uid = store.get().user?.id;
  if (!uid) return;
  const clean = {};
  if (patch.display_name !== undefined) clean.display_name = String(patch.display_name).trim();
  if (patch.color !== undefined) clean.color = patch.color;
  const { error } = await backend.db
    .from('profiles')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', uid);
  if (error) throw new Error(error.message);
  // Optimiste : met à jour le profil courant + l'annuaire.
  store.set({
    profile: { ...store.get().profile, ...clean },
    players: store.get().players.map((p) => (p.id === uid ? { ...p, ...clean } : p)),
  });
}
