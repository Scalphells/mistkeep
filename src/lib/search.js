import { store } from '../state.js';
import { escapeHtml } from './utils.js';
import { navigateTo } from '../features/nav.js';
import { loadVault } from '../features/vault.js';
import { loadNotes } from '../features/session-notes.js';
import { loadCompendium, KINDS, kindLabel } from '../features/compendium.js';
import { t } from './i18n.js';

/**
 * Recherche globale (Ctrl/Cmd+K) : palette qui cherche dans le Vault, les
 * Notes de session et le Compendium. Les jeux de données sont (re)chargés à
 * l'ouverture pour être à jour. Un résultat ouvre l'élément dans son onglet.
 */

let overlay = null;

function snippet(text, q) {
  const s = String(text || '');
  const i = s.toLowerCase().indexOf(q);
  if (i < 0) return s.slice(0, 80);
  return (i > 24 ? '…' : '') + s.slice(Math.max(0, i - 24), i + 56);
}

function collect(q) {
  const out = [];
  const isDM = store.get().isDM;

  if (isDM) {
    for (const [path, content] of Object.entries(store.get().vaultFiles || {})) {
      if (path.toLowerCase().includes(q) || String(content).toLowerCase().includes(q)) {
        out.push({ type: 'vault', icon: '📓', label: path.replace(/\.md$/, ''), sub: snippet(content, q), action: () => openVault(path) });
      }
    }
  }
  for (const n of store.get().sessionNotes || []) {
    if (String(n.content).toLowerCase().includes(q)) {
      out.push({ type: 'note', icon: '📝', label: (n.content.split('\n')[0] || t('search.noteDefault')).slice(0, 60), sub: snippet(n.content, q), action: () => navigateTo('notes') });
    }
  }
  // Compendium : MJ comme joueurs (le store ne contient que ce que la RLS
  // autorise — sorts/objets côté joueur), pour que la recherche fonctionne aussi.
  for (const e of store.get().compendium || []) {
    if (e.name.toLowerCase().includes(q) || String(e.data?.desc || '').toLowerCase().includes(q)) {
      out.push({ type: 'cmp', icon: KINDS[e.kind]?.icon || '📄', label: e.name, sub: KINDS[e.kind] ? kindLabel(e.kind) : '', action: () => openCompendium(e.id) });
    }
  }
  return out.slice(0, 40);
}

function openVault(path) {
  store.set({ activeTab: path });
  navigateTo('vault');
}
function openCompendium(id) {
  store.set({ compendiumOpenId: id });
  navigateTo('compendium');
}

export function openSearch() {
  if (overlay) return;
  // Rafraîchit les données (best-effort).
  loadNotes();
  loadCompendium(); // MJ + joueurs (RLS limite déjà ce que reçoit le joueur)
  if (store.get().isDM) loadVault();

  overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.innerHTML = `
    <div class="search-box" role="dialog" aria-modal="true">
      <input class="search-input" type="text" placeholder="${t('search.placeholder')}" autocomplete="off" />
      <div class="search-results" id="search-results"></div>
      <div class="search-foot">${t('search.foot')}</div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  const input = overlay.querySelector('.search-input');
  const results = overlay.querySelector('#search-results');
  let items = [];
  let sel = 0;

  const render = () => {
    const q = input.value.trim().toLowerCase();
    items = q.length >= 2 ? collect(q) : [];
    if (!q) {
      results.innerHTML = `<div class="search-hint">${t('search.minChars')}</div>`;
      return;
    }
    if (!items.length) {
      results.innerHTML = `<div class="search-hint">${t('help.empty')}</div>`;
      return;
    }
    results.innerHTML = items
      .map(
        (r, i) =>
          `<button class="search-item ${i === sel ? 'sel' : ''}" data-i="${i}">
             <span class="search-ic">${r.icon}</span>
             <span class="search-txt"><strong>${escapeHtml(r.label)}</strong><span>${escapeHtml(r.sub || '')}</span></span>
           </button>`
      )
      .join('');
    results.querySelectorAll('[data-i]').forEach((b) =>
      b.addEventListener('click', () => choose(Number(b.dataset.i)))
    );
  };

  const choose = (i) => {
    const r = items[i];
    close();
    r?.action?.();
  };

  input.addEventListener('input', () => {
    sel = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      sel = Math.min(items.length - 1, sel + 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      sel = Math.max(0, sel - 1);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length) choose(sel);
    }
  });
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey, true);

  function close() {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey, true);
    overlay.classList.remove('show');
    const o = overlay;
    overlay = null;
    setTimeout(() => o.remove(), 150);
  }

  input.focus();
  render();
}

export function initSearch() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openSearch();
    }
  });
}
