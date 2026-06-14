import { backend } from './backend.js';
import { loadSessionValue, saveSessionValue, sameCampaign } from './campaigns.js';
import { store } from '../state.js';
import { t } from './i18n.js';

/**
 * Pause de partie (façon Foundry « GAME PAUSED »). Le MJ bascule l'état, partagé
 * via `session_state['paused']` ; un bandeau s'affiche chez tous.
 */

let _banner = null;
function render() {
  const paused = store.get().paused;
  if (paused && !_banner) {
    _banner = document.createElement('div');
    _banner.className = 'pause-banner';
    _banner.innerHTML = `<span>${t('pause.banner')}</span>`;
    document.body.appendChild(_banner);
  } else if (!paused && _banner) {
    _banner.remove();
    _banner = null;
  }
}

export async function initPause() {
  const v = await loadSessionValue('paused');
  store.set({ paused: !!v?.on });
  render();
  store.subscribe(render);
  backend.realtime
    .channel('paused_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_state', filter: 'key=eq.paused' },
      (p) => sameCampaign(p) && store.set({ paused: !!p.new?.value?.on })
    )
    .subscribe();
}

/** Bascule la pause (MJ). */
export async function togglePause() {
  if (!store.get().isDM) return;
  const on = !store.get().paused;
  store.set({ paused: on });
  await saveSessionValue('paused', { on });
}
