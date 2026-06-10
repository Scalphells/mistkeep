import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { backend } from '../lib/backend.js';
import { campaignId, createCampaign, switchCampaign, deleteCampaign, DEFAULT_CAMPAIGN_ID } from '../lib/campaigns.js';
import { listSystems } from '../lib/systems/index.js';
import { modalConfirm } from '../lib/modal.js';
import { showToast } from '../lib/toast.js';

/**
 * Gestionnaire de campagnes : lister/basculer ses campagnes, en crÃ©er une
 * (nom + systÃ¨me de jeu), gÃ©rer les membres de celles qu'on dirige.
 *
 * TRANSITION : tant que les RLS ne sont pas scopÃ©es par appartenance, la
 * crÃ©ation est rÃ©servÃ©e au MJ Â« global Â» (profiles.role) â€” un joueur qui
 * crÃ©erait sa campagne ne pourrait pas y Ã©crire. La bascule recharge l'app
 * (toutes les souscriptions realtime repartent scopÃ©es proprement).
 */
export function openCampaignManager() {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const close = () => {
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 150);
  };
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });

  const sysLabel = (id) => listSystems().find((s) => s.id === id)?.label || id || '?';

  /** L'utilisateur dirige-t-il cette campagne ? (propriÃ©taire ou membre 'dm') */
  function managesCampaign(c) {
    const uid = store.get().user?.id;
    if (c.owner_id === uid) return true;
    return (store.get().campaignMemberships || []).some(
      (m) => m.campaign_id === c.id && m.user_id === uid && m.role === 'dm'
    );
  }

  function render() {
    const { campaigns = [], isDM } = store.get();
    const active = campaignId();
    ov.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:520px">
        <h3 class="modal-title">ðŸ° Campagnes</h3>
        <div id="camp-list">
          ${campaigns
            .map(
              (c) => `
            <div class="camp-row" data-id="${c.id}" style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid var(--border,#333)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600">${escapeHtml(c.name)} ${c.id === active ? '<span style="font-size:11px;color:var(--accent,#7c6af7)">â— active</span>' : ''}</div>
                <div style="font-size:11px;opacity:.7">${escapeHtml(sysLabel(c.system))}</div>
              </div>
              ${c.id !== active ? `<button class="modal-btn" data-switch="${c.id}">Activer</button>` : ''}
              ${managesCampaign(c) ? `<button class="modal-btn" data-members="${c.id}" title="GÃ©rer les membres">ðŸ‘¥</button>` : ''}
              ${c.owner_id === store.get().user?.id && c.id !== active && c.id !== DEFAULT_CAMPAIGN_ID ? `<button class="modal-btn" data-del="${c.id}" title="Supprimer la campagne (dÃ©finitif)">ðŸ—‘</button>` : ''}
            </div>
            <div class="camp-members" data-members-panel="${c.id}" style="display:none;padding:6px 6px 10px;font-size:12px"></div>`
            )
            .join('') || '<p style="opacity:.7">Aucune campagne visible.</p>'}
        </div>
        ${
          isDM
            ? `<div style="margin-top:14px;border-top:1px solid var(--border,#333);padding-top:10px">
                 <label class="prof-label">Nouvelle campagne</label>
                 <div style="display:flex;gap:8px">
                   <input class="modal-input" id="camp-name" type="text" placeholder="Nom de la campagne" maxlength="60" style="flex:1" />
                   <select class="modal-input" id="camp-system" style="width:auto">
                     ${listSystems().map((s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join('')}
                   </select>
                   <button class="modal-btn modal-ok" id="camp-create">CrÃ©er</button>
                 </div>
                 <div style="font-size:11px;opacity:.7;margin-top:6px">âš  Avant de jouer sur une 2áµ‰ campagne, applique la migration 0024 (clÃ©s composites).</div>
               </div>`
            : ''
        }
        <div class="modal-actions">
          <button class="modal-btn modal-cancel">Fermer</button>
        </div>
      </div>`;

    ov.querySelector('.modal-cancel').addEventListener('click', close);

    ov.querySelectorAll('[data-switch]').forEach((b) =>
      b.addEventListener('click', async () => {
        const c = campaigns.find((x) => x.id === b.dataset.switch);
        const ok = await modalConfirm(
          `Basculer sur Â« ${c?.name || '?'} Â» ? L'application va se recharger.`,
          { title: 'Changer de campagne', okLabel: 'Basculer' }
        );
        if (!ok) return;
        try {
          await switchCampaign(b.dataset.switch);
        } catch (e) {
          showToast('Ã‰chec de la bascule : ' + e.message, { type: 'warn', icon: 'âš ï¸' });
        }
      })
    );

    ov.querySelectorAll('[data-members]').forEach((b) =>
      b.addEventListener('click', () => toggleMembers(b.dataset.members))
    );

    ov.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        const c = campaigns.find((x) => x.id === b.dataset.del);
        const ok = await modalConfirm(
          `Supprimer dÃ©finitivement Â« ${c?.name || '?'} Â» ?\nToutes ses donnÃ©es (fiches, scÃ¨nes, chat, notes, combatâ€¦) seront effacÃ©es. Cette action est irrÃ©versible.`,
          { title: 'Supprimer la campagne', okLabel: 'Supprimer', danger: true }
        );
        if (!ok) return;
        try {
          await deleteCampaign(b.dataset.del);
          showToast('Campagne supprimÃ©e.', { type: 'info', icon: 'ðŸ—‘' });
          render();
        } catch (e) {
          showToast('Suppression impossible : ' + e.message, { type: 'warn', icon: 'âš ï¸' });
        }
      })
    );

    ov.querySelector('#camp-create')?.addEventListener('click', async () => {
      const name = ov.querySelector('#camp-name')?.value?.trim();
      const system = ov.querySelector('#camp-system')?.value;
      if (!name) return;
      const btn = ov.querySelector('#camp-create');
      btn.disabled = true;
      try {
        await createCampaign(name, system); // bascule + reload en cas de succÃ¨s
      } catch (e) {
        btn.disabled = false;
        showToast('CrÃ©ation impossible : ' + e.message, { type: 'warn', icon: 'âš ï¸' });
      }
    });
  }

  /** Affiche/recharge le panneau membres d'une campagne dirigÃ©e. */
  async function toggleMembers(cid) {
    const panel = ov.querySelector(`[data-members-panel="${cid}"]`);
    if (!panel) return;
    if (panel.style.display !== 'none') {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';
    panel.innerHTML = 'Chargementâ€¦';

    const [mRes, pRes] = await Promise.all([
      backend.db.from('campaign_members').select('*').eq('campaign_id', cid),
      backend.db.from('profiles').select('id, display_name, email').order('display_name'),
    ]);
    const members = mRes.data || [];
    const profiles = pRes.data || [];
    const nameOf = (uid) => {
      const p = profiles.find((x) => x.id === uid);
      return p?.display_name || p?.email || uid.slice(0, 8);
    };
    const notMember = profiles.filter((p) => !members.some((m) => m.user_id === p.id));
    const myId = store.get().user?.id;

    panel.innerHTML = `
      ${members
        .map(
          (m) => `
        <div style="display:flex;align-items:center;gap:8px;padding:2px 0">
          <span style="flex:1">${escapeHtml(nameOf(m.user_id))}</span>
          <span style="opacity:.7">${m.role === 'dm' ? 'ðŸŽ­ MJ' : 'ðŸŽ² Joueur'}</span>
          ${m.user_id !== myId ? `<button class="modal-btn" data-rm="${m.user_id}" style="padding:1px 8px">âœ•</button>` : ''}
        </div>`
        )
        .join('')}
      ${
        notMember.length
          ? `<div style="display:flex;gap:6px;margin-top:6px">
               <select class="modal-input" data-add-user style="flex:1">
                 ${notMember.map((p) => `<option value="${p.id}">${escapeHtml(p.display_name || p.email || '?')}</option>`).join('')}
               </select>
               <select class="modal-input" data-add-role style="width:auto">
                 <option value="player">Joueur</option>
                 <option value="dm">MJ</option>
               </select>
               <button class="modal-btn" data-add-btn>Ajouter</button>
             </div>`
          : ''
      }`;

    panel.querySelector('[data-add-btn]')?.addEventListener('click', async () => {
      const userId = panel.querySelector('[data-add-user]')?.value;
      const role = panel.querySelector('[data-add-role]')?.value || 'player';
      if (!userId) return;
      const { error } = await backend.db
        .from('campaign_members')
        .insert({ campaign_id: cid, user_id: userId, role });
      if (error) showToast('Ajout impossible : ' + error.message, { type: 'warn', icon: 'âš ï¸' });
      panel.style.display = 'none';
      toggleMembers(cid);
    });

    panel.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', async () => {
        const { error } = await backend.db
          .from('campaign_members')
          .delete()
          .eq('campaign_id', cid)
          .eq('user_id', b.dataset.rm);
        if (error) showToast('Retrait impossible : ' + error.message, { type: 'warn', icon: 'âš ï¸' });
        panel.style.display = 'none';
        toggleMembers(cid);
      })
    );
  }

  render();
}
