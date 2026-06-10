import { loadSessionValue, saveSessionValue } from '../lib/campaigns.js';
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
  const v = await loadSessionValue(KEY);
  store.set({ imagebank: Array.isArray(v) ? v : [] });
}

const persist = debounce(async () => {
  if (!store.get().isDM) return;
  const { error } = await saveSessionValue(KEY, store.get().imagebank);
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
