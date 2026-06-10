import { backend } from './backend.js';
import { campaignId } from './campaigns.js';
import { store } from '../state.js';
import { escapeHtml } from './utils.js';
import { showToast } from './toast.js';
import { sendD20Check } from '../features/dice.js';
import { abilityMod, saveBonus, skillBonus, ABILITIES, SKILLS } from '../features/characters.js';

/**
 * Demande de jet aux joueurs (façon Foundry).
 *
 * Le MJ diffuse une demande (sauvegarde / compétence / caractéristique + DD) via
 * un canal Realtime *broadcast* (éphémère). Chaque joueur reçoit une fenêtre
 * « Lancer », qui calcule le bonus depuis sa fiche et publie le jet dans le flux
 * des dés (partagé) — chacun voit la réussite/échec vs DD.
 */

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
  showToast('📣 Demande de jet envoyée aux joueurs.', { timeout: 1800 });
}

function labelFor(kind, key) {
  if (kind === 'save') return `Sauvegarde de ${ABILITIES.find((a) => a.key === key)?.label || key}`;
  if (kind === 'skill') return SKILLS[key]?.label || key;
  if (kind === 'ability') return `Test de ${ABILITIES.find((a) => a.key === key)?.label || key}`;
  return 'Jet';
}
function bonusFor(kind, key, data) {
  if (!data) return 0;
  if (kind === 'save') return saveBonus(data, key);
  if (kind === 'skill') return skillBonus(data, key);
  if (kind === 'ability') return abilityMod(data[key]);
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
      <h3 class="modal-title">📣 Le MJ demande un jet</h3>
      <p class="modal-msg"><b>${escapeHtml(lbl)}</b>${p.dc ? ` — DD ${p.dc}` : ''}${ch ? `<br><span style="color:var(--muted)">${escapeHtml(ch.name)}</span>` : '<br><span style="color:var(--muted)">(aucune fiche liée — jet à +0)</span>'}</p>
      <div class="modal-actions">
        <button class="modal-btn rr-ignore">Ignorer</button>
        <button class="modal-btn modal-ok rr-go">🎲 Lancer</button>
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
      await sendD20Check(bonus, `${ch?.name || 'PJ'} — ${lbl}${p.dc ? ` (DD ${p.dc})` : ''}`);
    } catch {
      /* affiché ailleurs */
    }
    closeModal();
  });
}
