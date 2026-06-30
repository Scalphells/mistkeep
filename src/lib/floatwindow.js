import { escapeHtml } from './utils.js';
import { t as tr } from './i18n.js';

/**
 * Gestionnaire de fenêtres flottantes (façon VTT) : chaque vue « lourde » du rail
 * s'ouvre au-dessus de la carte plutôt que de la remplacer. La carte reste donc
 * l'élément central permanent.
 *
 * Une fenêtre par identifiant de vue (instance unique → pas de collision d'IDs au
 * montage). Déplaçable (barre de titre), redimensionnable (coin), réductible.
 * Réutilise le style `.sheet-window` (cf. base.css).
 *
 * Émet `vaultmj:windows` à chaque ouverture/fermeture pour que le rail puisse
 * mettre à jour ses surbrillances.
 */

const WINDOWS = new Map(); // id -> { el, cleanup }
let _z = 1200;

/** Identifiants des fenêtres actuellement ouvertes. */
export function openWindowIds() {
  return [...WINDOWS.keys()];
}

export function isWindowOpen(id) {
  return WINDOWS.has(id);
}

function notify() {
  window.dispatchEvent(new CustomEvent('vaultmj:windows'));
}

export function closeWindow(id) {
  const w = WINDOWS.get(id);
  if (!w) return;
  if (w.cleanup) {
    try {
      w.cleanup();
    } catch {
      /* no-op */
    }
  }
  w.el.remove();
  WINDOWS.delete(id);
  notify();
}

export function closeAllWindows() {
  for (const id of [...WINDOWS.keys()]) closeWindow(id);
}

/** Bascule : ouvre si fermée, ferme si déjà ouverte. */
export function toggleWindow(id, opts) {
  if (WINDOWS.has(id)) {
    closeWindow(id);
    return;
  }
  openWindow(id, opts);
}

/**
 * Ouvre (ou ramène au premier plan) la fenêtre `id`.
 * @param {object} opts
 * @param {string} opts.title  Titre affiché dans la barre.
 * @param {(body:HTMLElement)=>(void|Function|Promise<Function>)} opts.mount
 *        Fonction de montage de la vue ; peut renvoyer un cleanup.
 * @param {number} [opts.width] / [opts.height]  Taille initiale souhaitée.
 */
export function openWindow(id, { title = tr('float.window'), mount, width, height } = {}) {
  const existing = WINDOWS.get(id);
  if (existing) {
    existing.el.classList.remove('minimized');
    bringToFront(existing.el);
    return existing;
  }
  if (typeof mount !== 'function') return null;

  const win = document.createElement('div');
  win.className = 'sheet-window';
  win.dataset.win = id;
  win.innerHTML = `
    <div class="sheet-window-bar" data-drag>
      <span class="sw-title">${escapeHtml(title)}</span>
      <div class="sw-actions">
        <button class="sw-btn sw-min" title="${tr('float.minimize')}">—</button>
        <button class="sw-btn sw-close" title="${tr('common.close')}">✕</button>
      </div>
    </div>
    <div class="sheet-window-body"></div>
    <div class="sw-resize" title="${tr('float.resize')}"></div>`;
  document.body.appendChild(win);

  // Taille initiale (bornée à la fenêtre du navigateur).
  const w = Math.min(width || 960, Math.round(window.innerWidth * 0.7));
  const h = Math.min(height || 680, Math.round(window.innerHeight * 0.8));
  // Cascade : décale chaque nouvelle fenêtre pour ne pas les empiler exactement
  // (sans Date.now/Math.random : on se base sur le nombre déjà ouvert).
  const idx = WINDOWS.size;
  // Cascade ancrée du côté OPPOSÉ au rail pour ne pas naître sous la colonne d'onglets.
  const railLeft = document.documentElement.dataset.vttrail === 'left';
  const RAIL = 46;
  const centerL = Math.max(8, Math.round((window.innerWidth - w) / 2));
  const baseL = railLeft
    ? Math.max(RAIL + 8, centerL) // rail gauche → fenêtres poussées à droite
    : Math.min(centerL, Math.max(8, window.innerWidth - w - RAIL - 8)); // rail droit/classique → à gauche
  const baseT = Math.max(8, Math.round((window.innerHeight - h) / 2));
  win.style.width = `${w}px`;
  win.style.height = `${h}px`;
  win.style.left = `${Math.min(window.innerWidth - 80, baseL + idx * 28)}px`;
  win.style.top = `${Math.min(window.innerHeight - 40, baseT + idx * 28)}px`;

  const entry = { el: win, cleanup: null };
  WINDOWS.set(id, entry);

  win.addEventListener('pointerdown', () => bringToFront(win));
  win.querySelector('.sw-close').addEventListener('click', () => closeWindow(id));
  win.querySelector('.sw-min').addEventListener('click', () => win.classList.toggle('minimized'));
  initDrag(win.querySelector('[data-drag]'), win);
  initResize(win.querySelector('.sw-resize'), win);
  bringToFront(win);

  const body = win.querySelector('.sheet-window-body');
  const res = mount(body);
  Promise.resolve(res).then((c) => {
    entry.cleanup = typeof c === 'function' ? c : null;
  });
  notify();
  return entry;
}

function bringToFront(win) {
  if (!win) return;
  // Les fenêtres flottantes restent SOUS les overlays/modales plein écran
  // (z-index 100000+). On plafonne donc le compteur juste en dessous et on le
  // ré-étale sur les fenêtres ouvertes quand il atteint la borne, pour conserver
  // l'ordre relatif sans jamais repasser au-dessus d'une modale.
  if (_z >= 99989) {
    _z = 1200;
    const ordered = [...WINDOWS.values()]
      .map((e) => e.el)
      .filter((el) => el !== win)
      .sort((a, b) => (parseInt(a.style.zIndex, 10) || 0) - (parseInt(b.style.zIndex, 10) || 0));
    for (const el of ordered) el.style.zIndex = String(++_z);
  }
  win.style.zIndex = String(++_z);
}

function initDrag(handle, win) {
  if (!handle) return;
  let sx = 0;
  let sy = 0;
  let ox = 0;
  let oy = 0;
  const onMove = (e) => {
    const x = Math.max(0, Math.min(window.innerWidth - 80, ox + (e.clientX - sx)));
    const y = Math.max(0, Math.min(window.innerHeight - 40, oy + (e.clientY - sy)));
    win.style.left = `${x}px`;
    win.style.top = `${y}px`;
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.sw-btn')) return; // ne pas démarrer un drag depuis un bouton
    e.preventDefault();
    sx = e.clientX;
    sy = e.clientY;
    const r = win.getBoundingClientRect();
    ox = r.left;
    oy = r.top;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}

function initResize(handle, win) {
  if (!handle) return;
  let sx = 0;
  let sy = 0;
  let ow = 0;
  let oh = 0;
  const onMove = (e) => {
    win.style.width = `${Math.max(360, ow + (e.clientX - sx))}px`;
    win.style.height = `${Math.max(280, oh + (e.clientY - sy))}px`;
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sx = e.clientX;
    sy = e.clientY;
    const r = win.getBoundingClientRect();
    ow = r.width;
    oh = r.height;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}

// Quand on quitte la disposition VTT, on referme toutes les fenêtres flottantes
// (la navigation redevient « plein écran central »).
window.addEventListener('vaultmj:chrome', () => {
  if (document.documentElement.dataset.vttrail == null) closeAllWindows();
});
