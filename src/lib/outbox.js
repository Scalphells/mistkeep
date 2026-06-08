import { supabase } from './supabase.js';

/**
 * File d'attente d'écritures hors-ligne.
 *
 * Principe : pour les écritures de type « ajout » (chat, notes, dés), si le
 * réseau est coupé, l'opération est mise en file (localStorage) au lieu d'être
 * perdue, puis rejouée automatiquement au retour de la connexion.
 *
 * Idempotence : chaque ligne porte un `id` client (uuid). Le rejeu utilise un
 * upsert `ignoreDuplicates` sur `id` → si l'écriture était finalement passée,
 * le rejeu ne crée pas de doublon.
 *
 * Distinction des erreurs :
 *   - le fetch ÉCHOUE (throw) → on est hors-ligne → on met en file ;
 *   - le serveur RÉPOND une erreur (RLS, validation) → vraie erreur → on
 *     remonte, on ne met PAS en file (sinon boucle infinie).
 */

const KEY = 'vaultmj_outbox';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}
let queue = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* quota / mode privé : on ignore */
  }
}

export function pendingCount() {
  return queue.length;
}

/**
 * Insère une ligne ; en cas de coupure réseau, la met en file pour rejeu.
 * @returns {Promise<{ ok: boolean, queued?: boolean, error?: any, row: object }>}
 */
export async function insertWithOutbox(table, row) {
  const payload = { ...row };
  if (!payload.id) payload.id = crypto.randomUUID();
  try {
    const { error } = await supabase.from(table).insert(payload);
    if (error) return { ok: false, error, row: payload }; // erreur serveur → réelle
    return { ok: true, row: payload };
  } catch {
    // Échec réseau : on met en file pour rejeu ultérieur.
    queue.push({ table, payload });
    persist();
    return { ok: true, queued: true, row: payload };
  }
}

/** Rejoue la file (FIFO) tant que les écritures passent. */
export async function flushOutbox() {
  if (!navigator.onLine || !queue.length) return;
  while (queue.length) {
    const op = queue[0];
    try {
      const { error } = await supabase
        .from(op.table)
        .upsert(op.payload, { onConflict: 'id', ignoreDuplicates: true });
      if (error) {
        // Erreur serveur définitive : on abandonne cette op pour ne pas bloquer.
        console.warn('[outbox] op rejetée:', op.table, error.message);
        queue.shift();
        persist();
        continue;
      }
    } catch {
      // Toujours hors-ligne : on réessaiera au prochain retour réseau.
      break;
    }
    queue.shift();
    persist();
  }
}
