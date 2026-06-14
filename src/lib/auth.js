import { backend } from './backend.js';
import { t as tr } from './i18n.js';

/**
 * Couche d'authentification.
 * IMPORTANT : le rôle (dm/player) provient TOUJOURS de la table profiles
 * (protégée par RLS), jamais d'une comparaison d'email côté client.
 */

export async function getCurrentUser() {
  const { data } = await backend.auth.getSession();
  return data.session?.user ?? null;
}

export async function signIn(email, password) {
  const { data, error } = await backend.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUp(email, password, displayName) {
  const { data, error } = await backend.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;

  // Crée le profil (role forcé côté serveur via RLS : impossible de mettre 'dm').
  if (data.user) {
    const { error: pErr } = await backend.db.from('profiles').insert({
      id: data.user.id,
      email,
      display_name: displayName,
      role: 'player',
    });
    // 23505 = profil déjà créé par un trigger éventuel : on ignore.
    if (pErr && pErr.code !== '23505') throw pErr;
  }
  return data.user;
}

export async function signOut() {
  await backend.auth.signOut();
}

/**
 * Change le mot de passe de l'utilisateur connecté, après vérification du mot de
 * passe actuel (ré-authentification). Supabase ne le vérifie pas de lui-même, on
 * le contrôle donc en tentant une connexion avec l'ancien mot de passe.
 */
export async function changePassword(currentPassword, newPassword) {
  const pwd = String(newPassword || '');
  if (pwd.length < 6) throw new Error(tr('auth.err.pwShort'));

  const { data } = await backend.auth.getUser();
  const email = data?.user?.email;
  if (!email) throw new Error(tr('auth.err.noSession'));

  const { error: vErr } = await backend.auth.signInWithPassword({
    email,
    password: String(currentPassword || ''),
  });
  if (vErr) throw new Error(tr('auth.err.wrongPw'));

  const { error } = await backend.auth.updateUser({ password: pwd });
  if (error) throw error;
}

/**
 * Charge le profil et en déduit le rôle (source de vérité = DB).
 * @returns {{ profile: object|null, role: 'dm'|'player', isDM: boolean }}
 */
export async function loadProfile(userId) {
  const { data, error } = await backend.db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[auth] Erreur chargement profil:', error.message);
    return { profile: null, role: 'player', isDM: false };
  }

  const role = data.role === 'dm' ? 'dm' : 'player';
  return { profile: data, role, isDM: role === 'dm' };
}

export function onAuthChange(callback) {
  return backend.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
