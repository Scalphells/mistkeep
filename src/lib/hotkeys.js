import { store } from '../state.js';
import { navigateTo } from '../features/nav.js';
import { openSearch } from './search.js';
import { nextTurn, prevTurn } from '../features/initiative.js';
import { fireHotbarKey } from './hotbar.js';

/**
 * Raccourcis clavier globaux. Inactifs quand le focus est dans un champ de
 * saisie (input/textarea/select/contenteditable) pour ne pas gêner la frappe.
 *
 *   Alt+1..9/0  → onglet n° (selon l'ordre visible de la barre de nav)
 *   Ctrl/Cmd+K  → recherche globale
 *   ]           → tour de combat suivant (MJ)
 *   [           → tour précédent (MJ)
 *   ?           → aide-mémoire des raccourcis
 */

function inField(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function navIds() {
  return [...document.querySelectorAll('#nav [data-view]')].map((b) => b.dataset.view);
}

let _helpEl = null;
function toggleHelp() {
  if (_helpEl) {
    _helpEl.remove();
    _helpEl = null;
    return;
  }
  const rows = [
    ['Alt + 1…0', 'Changer d’onglet'],
    ['Ctrl / ⌘ + K', 'Recherche globale'],
    [']', 'Combat : tour suivant (MJ)'],
    ['[', 'Combat : tour précédent (MJ)'],
    ['Échap', 'Fermer fenêtre / cible'],
    ['?', 'Afficher cette aide'],
  ];
  const el = document.createElement('div');
  el.className = 'modal-overlay show';
  el.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:360px;max-width:94vw">
      <h3 class="modal-title">⌨ Raccourcis clavier</h3>
      <div class="hk-list">
        ${rows.map(([k, d]) => `<div class="hk-row"><kbd>${k}</kbd><span>${d}</span></div>`).join('')}
      </div>
      <div class="modal-actions"><button class="modal-btn modal-ok hk-close">Fermer</button></div>
    </div>`;
  document.body.appendChild(el);
  _helpEl = el;
  const close = () => toggleHelp();
  el.querySelector('.hk-close').addEventListener('click', close);
  el.addEventListener('mousedown', (e) => {
    if (e.target === el) close();
  });
}

export function initHotkeys() {
  document.addEventListener('keydown', (e) => {
    // Recherche : laissée à lib/search (Ctrl+K) — on n'intercepte pas ici.
    if (e.defaultPrevented) return;
    if (inField(e.target)) return;
    if (e.ctrlKey || e.metaKey) return; // ne pas gêner les raccourcis système

    if (e.altKey && /^[0-9]$/.test(e.key)) {
      const ids = navIds();
      const idx = e.key === '0' ? 9 : Number(e.key) - 1;
      if (ids[idx]) {
        e.preventDefault();
        navigateTo(ids[idx]);
      }
      return;
    }
    if (e.altKey) return;

    // Touches 1–0 : barre de raccourcis (hotbar).
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      fireHotbarKey(Number(e.key));
      return;
    }

    if (e.key === ']') {
      if (store.get().isDM) {
        e.preventDefault();
        nextTurn();
      }
    } else if (e.key === '[') {
      if (store.get().isDM) {
        e.preventDefault();
        prevTurn();
      }
    } else if (e.key === '?') {
      e.preventDefault();
      toggleHelp();
    } else if (e.key === 'Escape' && _helpEl) {
      toggleHelp();
    }
  });
}

export { openSearch };
