import { backend } from './backend.js';
import { store } from '../state.js';

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
    _banner.innerHTML = '<span>⏸ JEU EN PAUSE</span>';
    document.body.appendChild(_banner);
  } else if (!paused && _banner) {
    _banner.remove();
    _banner = null;
  }
}

export async function initPause() {
  const { data } = await backend.db.from('session_state').select('value').eq('key', 'paused').maybeSingle();
  store.set({ paused: !!data?.value?.on });
  render();
  store.subscribe(render);
  backend.realtime
    .channel('paused_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_state', filter: 'key=eq.paused' },
      (p) => store.set({ paused: !!p.new?.value?.on })
    )
    .subscribe();
}

/** Bascule la pause (MJ). */
export async function togglePause() {
  if (!store.get().isDM) return;
  const on = !store.get().paused;
  store.set({ paused: on });
  await backend.db.from('session_state').upsert(
    { key: 'paused', value: { on }, updated_at: new Date().toISOString(), updated_by: store.get().user?.id ?? null },
    { onConflict: 'key' }
  );
}
