/**
 * Multi-campagne — fondation front (cf. migrations Supabase 0024 / SQLite v3).
 *
 * Une campagne = un groupe de jeu + un système de jeu (src/lib/systems/).
 * Toutes les lectures/écritures de tables de jeu sont scopées par
 * `campaign_id` ; avec une seule campagne (la campagne par défaut), le
 * comportement est identique à l'app mono-campagne historique.
 *
 * `isDM` dérive du rôle DANS la campagne active (campaign_members.role),
 * avec repli sur le rôle de profil historique tant qu'aucune adhésion
 * n'existe. Côté Supabase, les RLS scopées (migration 0026) appliquent ce
 * rôle par campagne côté serveur ; côté Go, l'authz serveur reste sur le
 * rôle global en attendant le chantier d'authz scopée — ne pas y attribuer
 * de rôle « MJ de campagne » à un joueur d'ici là.
 * Ne crée une DEUXIÈME campagne qu'après la migration des clés composites
 * (Supabase 0025 / SQLite v4).
 */
import { backend } from './backend.js';
import { store } from '../state.js';

/** Campagne par défaut (uuid fixe posé par les migrations). */
export const DEFAULT_CAMPAIGN_ID = '00000000-0000-4000-8000-000000000001';

/** Id de la campagne active (repli : campagne par défaut). */
export function campaignId() {
  return store.get().campaignId || DEFAULT_CAMPAIGN_ID;
}

/** Ligne de la campagne active ({ id, name, system, owner_id … }) ou null. */
export function activeCampaign() {
  const cid = campaignId();
  return (store.get().campaigns || []).find((c) => c.id === cid) || null;
}

/** Rôle de l'utilisateur DANS la campagne active ('dm' | 'player'). */
export function campaignRole() {
  const m = (store.get().campaignMemberships || []).find((x) => x.campaign_id === campaignId());
  return m?.role || store.get().role; // repli : rôle global historique
}

/**
 * Charge campagnes + adhésions et résout la campagne active.
 * À appeler au boot APRÈS le chargement du profil et AVANT les features.
 */
export async function initCampaigns() {
  const { user, profile } = store.get();
  const [cRes, mRes] = await Promise.all([
    backend.db.from('campaigns').select('*').order('created_at', { ascending: true }),
    backend.db.from('campaign_members').select('*').eq('user_id', user.id),
  ]);
  if (cRes.error) console.warn('[campagnes] chargement impossible:', cRes.error.message);
  const campaigns = cRes.data || [];
  const memberships = mRes.data || [];

  // Campagne active : pointeur du profil s'il pointe sur une campagne visible,
  // sinon première adhésion, sinon campagne par défaut.
  let cid = profile?.active_campaign_id;
  if (!campaigns.some((c) => c.id === cid)) {
    cid = memberships.find((m) => campaigns.some((c) => c.id === m.campaign_id))?.campaign_id || DEFAULT_CAMPAIGN_ID;
  }
  // Rôle effectif = rôle dans la campagne active (cf. en-tête du fichier).
  const role = memberships.find((m) => m.campaign_id === cid)?.role || store.get().role;
  store.set({ campaignId: cid, campaigns, campaignMemberships: memberships, role, isDM: role === 'dm' });
}

/** Crée une campagne (l'appelant devient propriétaire + MJ) et l'active. */
export async function createCampaign(name, system) {
  const uid = store.get().user?.id;
  const { data, error } = await backend.db
    .from('campaigns')
    .insert({ name: String(name).trim() || 'Campagne', system: system || 'dnd5e-2014', owner_id: uid })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const { error: mErr } = await backend.db
    .from('campaign_members')
    .insert({ campaign_id: row.id, user_id: uid, role: 'dm' });
  if (mErr) throw new Error(mErr.message);
  await switchCampaign(row.id);
  return row;
}

/** Bascule de campagne active : persiste le pointeur puis recharge l'app
 *  (le plus sûr — toutes les souscriptions realtime repartent scopées). */
export async function switchCampaign(id) {
  const uid = store.get().user?.id;
  const { error } = await backend.db.from('profiles').update({ active_campaign_id: id }).eq('id', uid);
  if (error) throw new Error(error.message);
  location.reload();
}

/**
 * Supprime une campagne (propriétaire/MJ uniquement). DESTRUCTIF : le
 * ON DELETE CASCADE efface toutes ses données (fiches, scènes, chat, notes…).
 * Interdits : la campagne active (bascule d'abord) et la campagne d'origine
 * (son uuid fixe sert encore de DEFAULT aux colonnes campaign_id).
 */
export async function deleteCampaign(id) {
  if (id === DEFAULT_CAMPAIGN_ID) throw new Error('La campagne d’origine ne peut pas être supprimée.');
  if (id === campaignId()) throw new Error('Bascule d’abord sur une autre campagne.');
  const { error } = await backend.db.from('campaigns').delete().eq('id', id);
  if (error) throw new Error(error.message);
  store.set({ campaigns: (store.get().campaigns || []).filter((c) => c.id !== id) });
}

/* ── Helpers de scoping ─────────────────────────────────────── */

/**
 * Garde realtime : true si l'événement concerne la campagne active.
 * Tolérant si campaign_id est absent du payload (DELETE ne porte que la PK) :
 * appliquer l'événement est alors un no-op inoffensif côté client.
 */
export function sameCampaign(payload) {
  const cid = payload?.new?.campaign_id ?? payload?.old?.campaign_id;
  return !cid || cid === campaignId();
}

/** Lit la valeur d'une clé `session_state` de la campagne active. */
export async function loadSessionValue(key) {
  const { data } = await backend.db
    .from('session_state')
    .select('value')
    .eq('campaign_id', campaignId())
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

/**
 * Écrit une clé `session_state` de la campagne active : UPDATE puis INSERT si
 * absent. Remplace l'upsert `onConflict: 'key'` — fonctionne avec la PK simple
 * (avant la migration des clés composites) ET la PK composite (après), donc
 * aucun déploiement coordonné. Écrivain unique par campagne (MJ) : la course
 * update/insert est théorique ; en cas de conflit d'insert on retente l'update.
 */
export async function saveSessionValue(key, value) {
  return scopedUpsert('session_state', 'key', {
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: store.get().user?.id ?? null,
  });
}

/** UPDATE-puis-INSERT générique scopé campagne (tables à clé sémantique).
 *  Tolère les deux adaptateurs : Supabase renvoie un tableau de lignes,
 *  le backend Go renvoie la ligne (objet) ou null si aucune ne correspond. */
export async function scopedUpsert(table, keyCol, row) {
  const cid = campaignId();
  const full = { ...row, campaign_id: cid };
  const upd = await backend.db.from(table).update(full).eq('campaign_id', cid).eq(keyCol, full[keyCol]).select(keyCol);
  if (upd.error) return { error: upd.error };
  const touched = Array.isArray(upd.data) ? upd.data.length > 0 : !!upd.data;
  if (touched) return { error: null };
  const ins = await backend.db.from(table).insert(full);
  const conflict = ins.error && (ins.error.code === '23505' || /UNIQUE constraint/i.test(ins.error.message || ''));
  if (conflict) {
    const retry = await backend.db.from(table).update(full).eq('campaign_id', cid).eq(keyCol, full[keyCol]);
    return { error: retry.error };
  }
  return { error: ins.error };
}
