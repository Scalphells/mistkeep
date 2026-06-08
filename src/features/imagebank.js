import { supabase } from '../lib/supabase.js';
import { store } from '../state.js';
import { debounce } from '../lib/utils.js';

/**
 * Banque d'images du MJ : bibliothèque réutilisable (jetons, fonds de carte,
 * illustrations de compendium…). Les fichiers vivent dans le bucket `battlemap`
 * (donc directement utilisables comme jeton / fond / image d'entrée). La liste
 * des chemins est partagée via `session_state['imagebank']` (écriture MJ).
 */

const KEY = 'imagebank';

export async function loadImageBank() {
  const { data } = await supabase.from('session_state').select('value').eq('key', KEY).maybeSingle();
  store.set({ imagebank: Array.isArray(data?.value) ? data.value : [] });
}

const persist = debounce(async () => {
  if (!store.get().isDM) return;
  const { error } = await supabase.from('session_state').upsert(
    { key: KEY, value: store.get().imagebank, updated_at: new Date().toISOString(), updated_by: store.get().user?.id ?? null },
    { onConflict: 'key' }
  );
  if (error) console.error('[imagebank]', error.message);
}, 300);

export function addBankImages(paths) {
  if (!store.get().isDM || !paths?.length) return;
  store.set({ imagebank: [...paths, ...(store.get().imagebank || [])] });
  persist();
}

export function removeBankImage(path) {
  if (!store.get().isDM) return;
  store.set({ imagebank: (store.get().imagebank || []).filter((p) => p !== path) });
  persist();
}
