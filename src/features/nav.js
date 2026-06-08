import { store } from '../state.js';
import { mountImageBank } from './imagebank-ui.js';
import { mountDice } from './dice-ui.js';
import { mountCharacters } from './characters-ui.js';
import { mountInitiative } from './initiative-ui.js';
import { mountChat } from './chat-ui.js';
import { mountMap } from './map-ui.js';
import { mountHandouts } from './handouts-ui.js';
import { mountSessionNotes } from './session-notes-ui.js';
import { mountCompendium } from './compendium-ui.js';
import { mountAmbience } from './ambience-ui.js';
import { mountHelp } from './help-ui.js';
import { mountCampaign } from './campaign-ui.js';
import { openWindow } from '../lib/floatwindow.js';

/**
 * Routeur de vues très léger.
 *
 * Chaque feature expose une fonction `mount(container)` qui prend en charge
 * son propre rendu et ses propres souscriptions au store / realtime.
 * On démonte la vue précédente (cleanup) avant d'en monter une nouvelle.
 */

const VIEWS = [
  { id: 'vault', label: '🖼 Banque', dmOnly: true, mount: mountImageBank },
  { id: 'campaign', label: '📖 Campagne', dmOnly: true, mount: mountCampaign },
  { id: 'characters', label: '🛡 Fiches', dmOnly: false, mount: mountCharacters },
  { id: 'initiative', label: '⚔ Combat', dmOnly: false, mount: mountInitiative },
  { id: 'map', label: '🗺 Carte', dmOnly: false, mount: mountMap },
  { id: 'handouts', label: '🖼 Handouts', dmOnly: false, mount: mountHandouts },
  { id: 'notes', label: '📝 Notes', dmOnly: false, mount: mountSessionNotes },
  { id: 'compendium', label: '📚 Compendium', dmOnly: false, mount: mountCompendium },
  { id: 'ambience', label: '🎵 Ambiance', dmOnly: true, mount: mountAmbience },
  { id: 'help', label: '📖 Aide', dmOnly: false, mount: mountHelp },
  { id: 'dice', label: '🎲 Dés', dmOnly: false, mount: mountDice },
  { id: 'chat', label: '💬 Chat', dmOnly: false, mount: mountChat },
];

let activeView = null;
let cleanup = null;
let _navEl = null;
let _viewEl = null;

/** Navigation programmatique (toasts, raccourcis…). */
export function navigateTo(id) {
  if (_navEl && _viewEl) switchView(id, _navEl, _viewEl);
}

/** Met à jour les pastilles de non-lus sur les onglets. */
function renderBadges() {
  if (!_navEl) return;
  const { unreadMessages, unreadHandouts } = store.get();
  const map = { chat: unreadMessages, handouts: unreadHandouts };
  _navEl.querySelectorAll('[data-view]').forEach((b) => {
    const n = map[b.dataset.view] || 0;
    let badge = b.querySelector('.nav-badge');
    if (n > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge';
        b.appendChild(badge);
      }
      badge.textContent = n > 99 ? '99+' : String(n);
    } else if (badge) {
      badge.remove();
    }
  });
}

export function mountNav(navEl, viewEl) {
  const { isDM } = store.get();
  _navEl = navEl;
  _viewEl = viewEl;
  const visible = VIEWS.filter((v) => !v.dmOnly || isDM);

  // Vue par défaut : en disposition VTT la carte est l'élément central ; sinon on
  // restaure la dernière vue (ou la première accessible).
  const vtt = document.documentElement.dataset.vttrail === '1';
  const initial = vtt
    ? 'map'
    : visible.some((v) => v.id === store.get().sideTab)
      ? store.get().sideTab
      : visible[0]?.id;

  navEl.innerHTML = visible
    .map(
      (v) =>
        `<button class="nav-tab" data-view="${v.id}">${v.label}</button>`
    )
    .join('');

  navEl.querySelectorAll('[data-view]').forEach((btn) =>
    btn.addEventListener('click', () => switchView(btn.dataset.view, navEl, viewEl))
  );

  store.subscribe(renderBadges);
  switchView(initial, navEl, viewEl);
}

function switchView(id, navEl, viewEl) {
  // En disposition VTT, la carte reste l'élément central permanent : toute autre
  // vue s'ouvre (ou revient au premier plan) dans une fenêtre flottante.
  if (id !== 'map' && document.documentElement.dataset.vttrail === '1') {
    const view = VIEWS.find((v) => v.id === id);
    if (!view) return;
    store.set({ sideTab: id });
    if (id === 'handouts' && store.get().unreadHandouts) store.set({ unreadHandouts: 0 });
    if (id === 'chat' && store.get().unreadMessages) store.set({ unreadMessages: 0 });
    openWindow(id, { title: view.label, mount: view.mount });
    return;
  }
  if (id === activeView) return;
  const view = VIEWS.find((v) => v.id === id);
  if (!view) return;

  // Démonte proprement la vue précédente.
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch {
      /* no-op */
    }
  }
  cleanup = null;

  activeView = id;
  store.set({ sideTab: id });
  // Remet à zéro les non-lus de l'onglet ouvert.
  if (id === 'chat' && store.get().unreadMessages) store.set({ unreadMessages: 0 });
  if (id === 'handouts' && store.get().unreadHandouts) store.set({ unreadHandouts: 0 });

  navEl.querySelectorAll('[data-view]').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === id)
  );
  renderBadges();

  // Léger fondu d'entrée à chaque changement de vue.
  viewEl.classList.remove('view-anim');
  void viewEl.offsetWidth; // relance l'animation
  viewEl.classList.add('view-anim');

  // `mount` peut renvoyer une fonction de cleanup (ou une promesse de cleanup).
  const result = view.mount(viewEl);
  if (typeof result === 'function') cleanup = result;
  else if (result && typeof result.then === 'function') {
    result.then((c) => {
      if (typeof c === 'function') cleanup = c;
    });
  }
}
