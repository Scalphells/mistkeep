import { backend } from './backend.js';
import { campaignId } from './campaigns.js';
import { store } from '../state.js';
import { escapeHtml } from './utils.js';
import { colorFor, initials } from './profile.js';

/**
 * Présence en ligne (Realtime Presence) : qui est connecté. Liste en bas à
 * gauche avec pastille verte. Aucune migration (présence éphémère côté Realtime).
 */

let _ch = null;
let _el = null;
let collapsed = (() => {
  try {
    return localStorage.getItem('vaultmj_presence_collapsed') === '1';
  } catch {
    return false;
  }
})();

function render() {
  const { players, online, user } = store.get();
  if (!_el) {
    _el = document.createElement('div');
    _el.className = 'presence';
    document.body.appendChild(_el);
  }
  _el.classList.toggle('collapsed', collapsed);
  const set = new Set(online || []);
  // Connectés d'abord, puis le reste ; on masque les profils sans nom.
  const list = (players || [])
    .filter((p) => p.display_name)
    .slice()
    .sort((a, b) => Number(set.has(b.id)) - Number(set.has(a.id)) || a.display_name.localeCompare(b.display_name));
  const onCount = list.filter((p) => set.has(p.id)).length;
  _el.innerHTML = `
    <div class="presence-head">
      <span class="presence-head-lbl">🟢 ${onCount} en ligne</span>
      <button class="presence-toggle" title="${collapsed ? 'Déployer la liste' : 'Réduire la liste'}">${collapsed ? '▸' : '▾'}</button>
    </div>
    <div class="presence-list">
      ${list
        .map(
          (p) => `<div class="presence-item ${set.has(p.id) ? 'on' : 'off'}">
            <span class="presence-av" style="background:${colorFor(p.id, p.display_name)}">${escapeHtml(initials(p.display_name))}</span>
            <span class="presence-nm">${escapeHtml(p.display_name)}${p.id === user?.id ? ' (moi)' : ''}</span>
            ${p.role === 'dm' ? '<span class="presence-mj">MJ</span>' : ''}
          </div>`
        )
        .join('')}
    </div>`;
  _el.querySelector('.presence-toggle')?.addEventListener('click', () => {
    collapsed = !collapsed;
    try {
      localStorage.setItem('vaultmj_presence_collapsed', collapsed ? '1' : '0');
    } catch {
      /* no-op */
    }
    render();
  });
}

export function initPresence() {
  const { user, profile, role } = store.get();
  if (!user?.id) return;
  _ch = backend.realtime.channel(`presence_room:${campaignId()}`, { config: { presence: { key: user.id } } });
  _ch
    .on('presence', { event: 'sync' }, () => {
      store.set({ online: Object.keys(_ch.presenceState()) });
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await _ch.track({ id: user.id, name: profile?.display_name, role });
      }
    });
  render();
  store.subscribe(render);
}
