/**
 * Config du système « Libre » pour la campagne active.
 *
 * La config (caractéristiques/compétences définies par le MJ) vit dans
 * `session_state['system_config']` : scopée par campagne, écriture MJ (RLS),
 * lecture par tous les membres, diffusée en realtime. Ce module fait les E/S
 * et injecte la config dans le descripteur pur (custom.js).
 */
import { backend } from '../backend.js';
import { store } from '../../state.js';
import { activeCampaign, loadSessionValue, saveSessionValue, sameCampaign } from '../campaigns.js';
import { setCustomConfig } from './custom.js';

const KEY = 'system_config';

/** Force un re-rendu des vues qui affichent la fiche. */
function rerenderSheets() {
  store.set({ characters: [...(store.get().characters || [])] });
}

/**
 * Charge la config au boot (no-op hors campagne « Libre ») et suit ses mises à
 * jour en realtime. À appeler après initCampaigns, avant le rendu des vues.
 */
export async function initSystemConfig() {
  if (activeCampaign()?.system !== 'custom') return;
  setCustomConfig(await loadSessionValue(KEY));
  backend.realtime
    .channel('system_config_feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_state', filter: `key=eq.${KEY}` }, (p) => {
      if (!sameCampaign(p)) return;
      setCustomConfig(p.new?.value || null);
      rerenderSheets();
    })
    .subscribe();
}

/** Lit la config brute actuelle (pour l'éditeur MJ). */
export async function loadSystemConfig() {
  return (await loadSessionValue(KEY)) || null;
}

/** Sauvegarde la config (MJ) et l'applique localement sans attendre l'écho. */
export async function saveSystemConfig(cfg) {
  setCustomConfig(cfg);
  rerenderSheets();
  const { error } = await saveSessionValue(KEY, cfg);
  if (error) throw new Error(error.message);
}
