import { store } from '../state.js';
import { navigateTo } from '../features/nav.js';
import { openSearch } from './search.js';
import { nextTurn, prevTurn } from '../features/initiative.js';
import { fireHotbarKey } from './hotbar.js';
import { modalPrompt } from './modal.js';
import { sendRoll } from '../features/dice.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';

/**
 * Raccourcis clavier globaux. Inactifs quand le focus est dans un champ de
 * saisie (input/textarea/select/contenteditable) pour ne pas gêner la frappe.
 *
 *   Alt+1..9/0  → onglet n° (selon l'ordre visible de la barre de nav)
 *   Ctrl/Cmd+K  → recherche globale
 *   R           → jet de dés rapide (dans le chat)
 *   ]           → tour de combat suivant (MJ)
 *   [           → tour précédent (MJ)
 *   ?           → aide-mémoire des raccourcis
 */

/** Jet de dés rapide : demande une notation et la publie dans le chat. */
async function quickRoll() {
  const notation = await modalPrompt(t('hotkeys.notation.prompt'), {
    title: t('hotkeys.quick.title'),
    defaultValue: '1d20',
    okLabel: t('dice.roll'),
  });
  if (!notation) return;
  try {
    await sendRoll(notation.trim(), 'public');
  } catch {
    showToast(t('hotkeys.invalid'), { timeout: 2200 });
  }
}

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
    ['Alt + 1…0', t('hotkeys.h.tab')],
    ['1…0', t('hotkeys.h.hotbar')],
    ['Ctrl / ⌘ + K', t('hotkeys.h.search')],
    ['R', t('hotkeys.h.quick')],
    [']', t('hotkeys.h.next')],
    ['[', t('hotkeys.h.prev')],
    ['Ctrl / ⌘ + Z', t('hotkeys.h.undo')],
    [t('hotkeys.k.esc'), t('hotkeys.h.esc')],
    ['?', t('hotkeys.h.help')],
  ];
  const el = document.createElement('div');
  el.className = 'modal-overlay show';
  el.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:360px;max-width:94vw">
      <h3 class="modal-title">${t('hotkeys.title')}</h3>
      <div class="hk-list">
        ${rows.map(([k, d]) => `<div class="hk-row"><kbd>${k}</kbd><span>${d}</span></div>`).join('')}
      </div>
      <div class="modal-actions"><button class="modal-btn modal-ok hk-close">${t('common.close')}</button></div>
    </div>`;
  document.body.appendChild(el);
  _helpEl = el;
  const close = () => toggleHelp();
  const closeBtn = el.querySelector('.hk-close');
  closeBtn.addEventListener('click', close);
  closeBtn.focus(); // accessible au clavier dès l'ouverture
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
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      quickRoll();
    } else if (e.key === '?') {
      e.preventDefault();
      toggleHelp();
    } else if (e.key === 'Escape' && _helpEl) {
      toggleHelp();
    }
  });
}

export { openSearch };
