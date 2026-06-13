import { store } from '../state.js';
import { openWindow } from '../lib/floatwindow.js';
import { t } from '../lib/i18n.js';

/**
 * Routeur de vues très léger.
 *
 * Chaque feature expose une fonction `mount(container)` qui prend en charge
 * son propre rendu et ses propres souscriptions au store / realtime.
 * On démonte la vue précédente (cleanup) avant d'en monter une nouvelle.
 *
 * Chargement à la demande (code-split) : `load()` importe le module de la vue
 * seulement quand on l'ouvre, pour ne pas embarquer les 12 vues au démarrage.
 */

// `key` = clé i18n (cf. src/locales/*.json) résolue à l'affichage via t().
const VIEWS = [
  { id: 'vault', key: 'nav.vault', dmOnly: true, load: () => import('./imagebank-ui.js').then((m) => m.mountImageBank) },
  { id: 'campaign', key: 'nav.campaign', dmOnly: true, load: () => import('./campaign-ui.js').then((m) => m.mountCampaign) },
  { id: 'characters', key: 'nav.characters', dmOnly: false, load: () => import('./characters-ui.js').then((m) => m.mountCharacters) },
  { id: 'initiative', key: 'nav.initiative', dmOnly: false, load: () => import('./initiative-ui.js').then((m) => m.mountInitiative) },
  { id: 'map', key: 'nav.map', dmOnly: false, load: () => import('./map-ui.js').then((m) => m.mountMap) },
  { id: 'handouts', key: 'nav.handouts', dmOnly: false, load: () => import('./handouts-ui.js').then((m) => m.mountHandouts) },
  { id: 'notes', key: 'nav.notes', dmOnly: false, load: () => import('./session-notes-ui.js').then((m) => m.mountSessionNotes) },
  { id: 'compendium', key: 'nav.compendium', dmOnly: false, load: () => import('./compendium-ui.js').then((m) => m.mountCompendium) },
  { id: 'ambience', key: 'nav.ambience', dmOnly: true, load: () => import('./ambience-ui.js').then((m) => m.mountAmbience) },
  { id: 'help', key: 'nav.help', dmOnly: false, load: () => import('./help-ui.js').then((m) => m.mountHelp) },
  { id: 'dice', key: 'nav.dice', dmOnly: false, load: () => import('./dice-ui.js').then((m) => m.mountDice) },
  { id: 'chat', key: 'nav.chat', dmOnly: false, load: () => import('./chat-ui.js').then((m) => m.mountChat) },
];

let activeView = null;
let cleanup = null;
let _navEl = null;
let _viewEl = null;
let loadSeq = 0; // garde anti-course : ignore un montage tardif si on a déjà rebasculé

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
        `<button class="nav-tab" data-view="${v.id}">${t(v.key)}</button>`
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
    openWindow(id, { title: t(view.key), mount: (body) => view.load().then((m) => m(body)) });
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

  // Charge le module de la vue à la demande, puis le monte. `mount` peut renvoyer
  // une fonction de cleanup (ou une promesse de cleanup). Le jeton protège d'une
  // bascule rapide : si une vue plus récente a été demandée entre-temps, on
  // abandonne — et on nettoie un montage arrivé trop tard.
  const token = ++loadSeq;
  view.load().then((mount) => {
    if (token !== loadSeq) return;
    Promise.resolve(mount(viewEl)).then((c) => {
      if (typeof c !== 'function') return;
      if (token === loadSeq) cleanup = c;
      else try { c(); } catch { /* no-op */ }
    });
  });
}
