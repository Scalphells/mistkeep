import { supabase } from './supabase.js';
import { store } from '../state.js';

/**
 * Horloge / calendrier in-game (façon Simple Calendar). Le MJ fait avancer le
 * temps ; partagé via `session_state['clock']` ({ day, min }). Panneau flottant
 * basculé par le bouton 🕐 de l'en-tête. Les joueurs le voient en lecture seule.
 */

let _el = null;
let _open = false;

function fmt(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Phase de la journée (icône + libellé) à partir des minutes. */
function phase(min) {
  const h = Math.floor(min / 60) % 24;
  if (h < 5 || h >= 21) return { icon: '🌙', label: 'Nuit' };
  if (h < 8) return { icon: '🌅', label: 'Aube' };
  if (h < 18) return { icon: '☀', label: 'Jour' };
  return { icon: '🌆', label: 'Crépuscule' };
}

function render() {
  if (!_el) return;
  _el.classList.toggle('open', _open);
  if (!_open) return;
  const isDM = store.get().isDM;
  const { day = 1, min = 0 } = store.get().clock || {};
  const p = phase(min);
  _el.innerHTML = `
    <div class="clock-head">${p.icon} Temps<button class="clock-x" title="Fermer">✕</button></div>
    <div class="clock-big">${fmt(min)}</div>
    <div class="clock-sub">Jour ${day} · ${p.label}</div>
    ${
      isDM
        ? `<div class="clock-ctrls">
             <button data-adv="-60">−1 h</button>
             <button data-adv="-10">−10 min</button>
             <button data-adv="10">+10 min</button>
             <button data-adv="60">+1 h</button>
           </div>
           <div class="clock-ctrls">
             <button data-adv="480" title="Repos long (8 h)">🛌 +8 h</button>
             <button data-set="1" title="Régler l'heure">🕐 Régler</button>
           </div>`
        : ''
    }`;
  _el.querySelector('.clock-x')?.addEventListener('click', () => setClockOpen(false));
  _el.querySelectorAll('[data-adv]').forEach((b) =>
    b.addEventListener('click', () => advance(Number(b.dataset.adv)))
  );
  _el.querySelector('[data-set]')?.addEventListener('click', setTimePrompt);
}

function setClockOpen(open) {
  _open = open;
  render();
}

export function toggleClock() {
  setClockOpen(!_open);
}

async function persist(clock) {
  store.set({ clock });
  if (!store.get().isDM) return;
  await supabase.from('session_state').upsert(
    { key: 'clock', value: clock, updated_at: new Date().toISOString(), updated_by: store.get().user?.id ?? null },
    { onConflict: 'key' }
  );
}

/** Fait avancer (ou reculer) le temps de `delta` minutes (MJ). */
function advance(delta) {
  if (!store.get().isDM) return;
  const { day = 1, min = 0 } = store.get().clock || {};
  let total = (day - 1) * 1440 + min + delta;
  if (total < 0) total = 0;
  persist({ day: Math.floor(total / 1440) + 1, min: total % 1440 });
}

async function setTimePrompt() {
  const { modalPrompt } = await import('./modal.js');
  const cur = store.get().clock || { day: 1, min: 0 };
  const v = await modalPrompt('Heure (HH:MM) :', { title: '🕐 Régler le temps', defaultValue: fmt(cur.min) });
  if (!v) return;
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return;
  const min = (Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]))) % 1440;
  persist({ day: cur.day || 1, min });
}

export async function initClock() {
  if (!_el) {
    _el = document.createElement('div');
    _el.className = 'clock-panel';
    document.body.appendChild(_el);
  }
  const { data } = await supabase.from('session_state').select('value').eq('key', 'clock').maybeSingle();
  if (data?.value && typeof data.value.min === 'number') store.set({ clock: data.value });
  render();
  store.subscribe(() => {
    if (_open) render();
  });
  supabase
    .channel('clock_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_state', filter: 'key=eq.clock' },
      (p) => {
        if (p.new?.value && typeof p.new.value.min === 'number') store.set({ clock: p.new.value });
      }
    )
    .subscribe();
}
