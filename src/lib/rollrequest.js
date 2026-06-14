import { backend } from './backend.js';
import { campaignId, activeCampaign } from './campaigns.js';
import { getSystem } from './systems/index.js';
import { store } from '../state.js';
import { escapeHtml } from './utils.js';
import { showToast } from './toast.js';
import { sendD20Check } from '../features/dice.js';
import { t } from './i18n.js';

/**
 * Demande de jet aux joueurs (façon Foundry).
 *
 * Le MJ diffuse une demande (sauvegarde / compétence / caractéristique + DD) via
 * un canal Realtime *broadcast* (éphémère). Chaque joueur reçoit une fenêtre
 * « Lancer », qui calcule le bonus depuis sa fiche et publie le jet dans le flux
 * des dés (partagé) — chacun voit la réussite/échec vs DD.
 *
 * Labels et bonus passent par le descripteur du système de la campagne (MJ et
 * joueurs sont dans la même campagne, donc le même système) : compétences,
 * caractéristiques et sauvegardes sont celles du système — 5e, pf2e
 * (sauvegardes nommées) ou Libre (listes configurées par le MJ).
 */

/** Descripteur du système de la campagne active. */
function sys() {
  return getSystem(activeCampaign()?.system);
}

let _ch = null;
let _modal = null;

export function initRollRequests() {
  if (_ch) return;
  _ch = backend.realtime.channel(`roll_req:${campaignId()}`, { config: { broadcast: { self: false } } });
  _ch.on('broadcast', { event: 'req' }, ({ payload }) => promptRoll(payload)).subscribe();
}

/** Diffuse une demande de jet (MJ). */
export function requestRoll({ kind, key, dc }) {
  if (!_ch) initRollRequests();
  _ch.send({
    type: 'broadcast',
    event: 'req',
    payload: { kind, key, dc: dc || null, by: store.get().user?.id },
  });
  showToast(t('rr.toast.sent'), { timeout: 1800 });
}

function labelFor(kind, key) {
  const s = sys();
  if (kind === 'save') return t('rr.label.save', { label: s.saveOptions.find((a) => a.key === key)?.label || key });
  if (kind === 'skill') return s.skills[key]?.label || key;
  if (kind === 'ability') return t('rr.label.ability', { label: s.abilities.find((a) => a.key === key)?.label || key });
  return t('rr.label.roll');
}
function bonusFor(kind, key, data) {
  if (!data) return 0;
  const s = sys();
  if (kind === 'save') return s.saveBonus(data, key);
  if (kind === 'skill') return s.skillBonus(data, key);
  if (kind === 'ability') return s.abilityMod(data[key]);
  return 0;
}
function myChar() {
  const { characters, user, activeChar } = store.get();
  const owned = (characters || []).filter((c) => c.owner_id === user?.id);
  return owned.find((c) => c.id === activeChar) || owned[0] || null;
}

function closeModal() {
  if (_modal) {
    _modal.remove();
    _modal = null;
  }
}

function promptRoll(p) {
  closeModal();
  const ch = myChar();
  const lbl = labelFor(p.kind, p.key);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:340px;max-width:92vw">
      <h3 class="modal-title">${t('rr.title')}</h3>
      <p class="modal-msg"><b>${escapeHtml(lbl)}</b>${p.dc ? t('rr.dcSuffix', { dc: p.dc }) : ''}${ch ? `<br><span style="color:var(--muted)">${escapeHtml(ch.name)}</span>` : `<br><span style="color:var(--muted)">${t('rr.noChar')}</span>`}</p>
      <div class="modal-actions">
        <button class="modal-btn rr-ignore">${t('rr.ignore')}</button>
        <button class="modal-btn modal-ok rr-go">🎲 ${t('dice.roll')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  _modal = overlay;
  overlay.querySelector('.rr-ignore').addEventListener('click', closeModal);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelector('.rr-go').addEventListener('click', async () => {
    const bonus = bonusFor(p.kind, p.key, ch?.data);
    try {
      await sendD20Check(bonus, `${ch?.name || t('rr.pc')} — ${lbl}${p.dc ? t('rr.dcParen', { dc: p.dc }) : ''}`);
    } catch {
      /* affiché ailleurs */
    }
    closeModal();
  });
}
