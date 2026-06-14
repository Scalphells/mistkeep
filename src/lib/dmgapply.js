import { escapeHtml } from './utils.js';
import { t } from './i18n.js';

/**
 * Modale MJ : appliquer des dégâts à des cibles, avec réduction éventuelle pour
 * gérer armures / résistances / immunités (plein · moitié · quart · nul). Le MJ
 * reste seul juge : un joueur lance ses dégâts, le MJ valide le montant appliqué.
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
 * @param {{amount:number, targets:Array<{name?}>, who?:string, nm?:string,
 *          crit?:boolean, apply:(target:object, amount:number)=>void}} opts
 */
export function openDamageApply({ amount, targets, who, nm, crit, apply }) {
  close();
  const amt = Math.max(0, Math.round(Number(amount) || 0));
  const half = Math.floor(amt / 2);
  const quarter = Math.floor(amt / 4);
  const dbl = amt * 2;
  const list = targets || [];
  const names = list.map((x) => x.name || t('applyroll.target')).join(', ');

  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card dmg-apply" role="dialog" aria-modal="true">
      <h3 class="modal-title">${t('dmgapply.title')}</h3>
      <div class="ac-sub">${escapeHtml(who || '')}${nm ? ` — ${escapeHtml(nm)}` : ''}${crit ? t('dmgapply.critSuffix') : ''}</div>
      <p class="modal-msg"><strong class="ac-dmg-total">${amt}</strong> ${t('ac.dmgWord')} → <strong>${escapeHtml(names || t('dmgapply.noTarget'))}</strong></p>
      <div class="dmg-apply-btns">
        <button class="modal-btn" data-amt="${amt}">${t('dmgapply.full')} <span class="da-n">${amt}</span></button>
        <button class="modal-btn" data-amt="${dbl}" title="${t('dmgapply.double.title')}">${t('dmgapply.double')} <span class="da-n">${dbl}</span></button>
        <button class="modal-btn" data-amt="${half}" title="${t('dmgapply.half.title')}">${t('dmgapply.half')} <span class="da-n">${half}</span></button>
        <button class="modal-btn" data-amt="${quarter}">¼ <span class="da-n">${quarter}</span></button>
        <button class="modal-btn" data-amt="0" title="${t('dmgapply.immune.title')}">${t('dmgapply.immune')}</button>
      </div>
      <div class="modal-actions"><button class="modal-btn dmg-cancel">${t('common.cancel')}</button></div>
    </div>`;
  document.body.appendChild(ov);
  _ov = ov;
  document.addEventListener('keydown', _key, true);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('.dmg-cancel').addEventListener('click', close);
  ov.querySelectorAll('[data-amt]').forEach((b) =>
    b.addEventListener('click', () => {
      const a = Number(b.dataset.amt) || 0;
      for (const tg of list) apply(tg, a);
      close();
    })
  );
}
