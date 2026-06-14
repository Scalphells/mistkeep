import { escapeHtml } from './utils.js';
import { sendRoll } from '../features/dice.js';
import { modalPrompt } from './modal.js';
import { t } from './i18n.js';

/**
 * Barre de raccourcis (hotbar) façon Foundry : 10 emplacements (1–0) persistés
 * par appareil (localStorage). Clic = lance la notation ; clic sur vide = assigne ;
 * clic droit = vide. Touches 1–0 = déclenchent (via lib/hotkeys).
 */

const KEY = 'vaultmj_hotbar';
function load() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(a) && a.length === 10 ? a : Array(10).fill(null);
  } catch {
    return Array(10).fill(null);
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots));
  } catch {
    /* no-op */
  }
}

let slots = load();
let host = null;

function render() {
  if (!host) return;
  host.innerHTML = `<div class="hotbar">${slots
    .map(
      (s, i) =>
        `<button class="hotbar-slot ${s ? 'filled' : ''}" data-i="${i}" title="${s ? escapeHtml(`${s.label} — ${s.notation}`) : t('hotbar.empty.title')}">
           <span class="hotbar-key">${(i + 1) % 10}</span>
           ${s ? `<span class="hotbar-lbl">${escapeHtml(s.label || s.notation)}</span>` : '<span class="hotbar-plus">+</span>'}
         </button>`
    )
    .join('')}</div>`;
  host.querySelectorAll('[data-i]').forEach((b) => {
    const i = Number(b.dataset.i);
    b.addEventListener('click', () => trigger(i));
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      slots[i] = null;
      save();
      render();
    });
  });
}

async function trigger(i) {
  const s = slots[i];
  if (s) {
    sendRoll(s.notation, 'public', s.label).catch(() => {});
    return;
  }
  const notation = await modalPrompt(t('hotbar.notation.prompt'), { title: t('hotbar.title') });
  if (!notation || !notation.trim()) return;
  const label = await modalPrompt(t('hotbar.name.prompt'), { title: t('hotbar.title'), defaultValue: notation.trim() });
  slots[i] = { notation: notation.trim(), label: (label || notation).trim() };
  save();
  render();
}

/** Déclenche l'emplacement correspondant à la touche 1–0. */
export function fireHotbarKey(n) {
  trigger(n === 0 ? 9 : n - 1);
}

/** Ajoute une macro au premier emplacement libre de la hotbar. */
export function addHotbarMacro({ label, notation }) {
  if (!notation) return false;
  const i = slots.findIndex((s) => !s);
  if (i < 0) return false;
  slots[i] = { notation: String(notation).trim(), label: String(label || notation).trim() };
  save();
  render();
  return i;
}

export function mountHotbar(container) {
  host = container;
  render();
}
