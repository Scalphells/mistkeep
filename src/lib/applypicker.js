import { store } from '../state.js';
import { escapeHtml } from './utils.js';
import { showToast } from './toast.js';

/**
 * Sélecteur rapide de cibles (MJ) pour appliquer des dégâts/soins SANS avoir à
 * cibler au préalable sur la carte. Liste les combattants du tour en cours ;
 * coche un ou plusieurs puis applique. Pratique pour les effets de zone.
 */

let _ov = null;
function close() {
  if (_ov) {
    _ov.remove();
    _ov = null;
    document.removeEventListener('keydown', _key, true);
  }
}
function _key(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
}

/**
 * @param {{amount:number, heal:boolean, onApply:(combatants:object[])=>void}} opts
 */
export function openApplyPicker({ amount, heal, onApply }) {
  const combs = store.get().initiative || [];
  if (!combs.length) {
    showToast('Aucun combattant — ajoute des combattants ou cible un jeton (🎯).', { timeout: 3600 });
    return;
  }
  close();
  const amt = Math.max(0, Math.round(Number(amount) || 0));

  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card apply-picker" role="dialog" aria-modal="true">
      <h3 class="modal-title">${heal ? '💚 Soigner' : '💥 Infliger'} ${amt}</h3>
      <p class="modal-msg">Coche les cibles puis applique.</p>
      <div class="ap-list">
        ${combs
          .map((c) => {
            const hp = c.hp != null ? `${c.hp}${c.hp_max != null ? `/${c.hp_max}` : ''} PV` : '';
            return `<label class="ap-row">
              <input type="checkbox" data-pick="${escapeHtml(c.entity_id)}">
              <span class="ap-name">${escapeHtml(c.name)}</span>
              <span class="ap-hp">${hp}</span>
            </label>`;
          })
          .join('')}
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-cancel">Annuler</button>
        <button class="modal-btn modal-ok">${heal ? 'Soigner' : 'Appliquer'}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _ov = ov;
  document.addEventListener('keydown', _key, true);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('.modal-cancel').addEventListener('click', close);
  ov.querySelector('.modal-ok').addEventListener('click', () => {
    const ids = [...ov.querySelectorAll('[data-pick]:checked')].map((b) => b.dataset.pick);
    if (!ids.length) {
      showToast('Coche au moins une cible.', { timeout: 2000 });
      return;
    }
    const picked = combs.filter((c) => ids.includes(c.entity_id));
    close();
    onApply(picked);
  });
}
