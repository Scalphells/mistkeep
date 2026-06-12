import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { backend } from '../lib/backend.js';
import { campaignId, createCampaign, switchCampaign, deleteCampaign, DEFAULT_CAMPAIGN_ID, generateInviteCode, setInviteCode, joinCampaignByCode } from '../lib/campaigns.js';
import { listSystems } from '../lib/systems/index.js';
import { ABILITIES as CUSTOM_ABILITIES, SKILLS as CUSTOM_SKILLS, slugKey, normalizeConfig, normalizeTestDie } from '../lib/systems/custom.js';
import { loadSystemConfig, saveSystemConfig } from '../lib/systems/config.js';
import { downloadActiveCampaign, importCampaignPayload } from '../lib/campaign-transfer.js';
import { modalConfirm } from '../lib/modal.js';
import { showToast } from '../lib/toast.js';

/**
 * Gestionnaire de campagnes : lister/basculer ses campagnes, en créer une
 * (nom + système de jeu), gérer les membres de celles qu'on dirige.
 *
 * Chacun peut créer SA campagne (il en devient propriétaire + MJ) — appliqué
 * côté serveur par les RLS scopées (Supabase 0026) comme par l'authz par
 * campagne du backend Go. La bascule recharge l'app (toutes les souscriptions
 * realtime repartent scopées proprement).
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

  /** L'utilisateur dirige-t-il cette campagne ? (propriétaire ou membre 'dm') */
  function managesCampaign(c) {
    const uid = store.get().user?.id;
    if (c.owner_id === uid) return true;
    return (store.get().campaignMemberships || []).some(
      (m) => m.campaign_id === c.id && m.user_id === uid && m.role === 'dm'
    );
  }

  function render() {
    const { campaigns = [] } = store.get();
    const canCreate = true; // chacun peut créer sa propre campagne (cf. en-tête)
    const active = campaignId();
    ov.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:520px">
        <h3 class="modal-title">🏰 Campagnes</h3>
        <div id="camp-list">
          ${campaigns
            .map(
              (c) => `
            <div class="camp-row" data-id="${c.id}" style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid var(--border,#333)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600">${escapeHtml(c.name)} ${c.id === active ? '<span style="font-size:11px;color:var(--accent,#7c6af7)">● active</span>' : ''}</div>
                <div style="font-size:11px;opacity:.7">${escapeHtml(sysLabel(c.system))}</div>
              </div>
              ${c.id !== active ? `<button class="modal-btn" data-switch="${c.id}">Activer</button>` : ''}
              ${managesCampaign(c) ? `<button class="modal-btn" data-members="${c.id}" title="Gérer les membres">👥</button>` : ''}
              ${c.id === active && c.system === 'custom' && managesCampaign(c) ? `<button class="modal-btn" data-syscfg title="Configurer le système (caractéristiques / compétences)">🎲</button>` : ''}
              ${c.id === active && managesCampaign(c) ? `<button class="modal-btn" data-export-camp title="Exporter cette campagne (sauvegarde JSON complète)">💾</button>` : ''}
              ${c.owner_id === store.get().user?.id && c.id !== active && c.id !== DEFAULT_CAMPAIGN_ID ? `<button class="modal-btn" data-del="${c.id}" title="Supprimer la campagne (définitif)">🗑</button>` : ''}
            </div>
            <div class="camp-members" data-members-panel="${c.id}" style="display:none;padding:6px 6px 10px;font-size:12px"></div>`
            )
            .join('') || '<p style="opacity:.7">Aucune campagne visible.</p>'}
        </div>
        ${
          canCreate
            ? `<div style="margin-top:14px;border-top:1px solid var(--border,#333);padding-top:10px">
                 <label class="prof-label">Nouvelle campagne</label>
                 <div style="display:flex;gap:8px">
                   <input class="modal-input" id="camp-name" type="text" placeholder="Nom de la campagne" maxlength="60" style="flex:1" />
                   <select class="modal-input" id="camp-system" style="width:auto">
                     ${listSystems().map((s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join('')}
                   </select>
                   <button class="modal-btn modal-ok" id="camp-create">Créer</button>
                 </div>
                 <div style="font-size:11px;opacity:.7;margin-top:6px">⚠ Avant de jouer sur une 2ᵉ campagne, applique la migration des clés composites (Supabase 0025 / SQLite v4 — automatique sur le binaire).</div>
                 <div style="display:flex;gap:8px;margin-top:8px">
                   <label class="modal-btn" style="cursor:pointer">📥 Importer une campagne (.json)…
                     <input type="file" id="camp-import" accept="application/json,.json" hidden />
                   </label>
                   <span id="camp-import-status" style="font-size:11px;opacity:.75;align-self:center"></span>
                 </div>
               </div>`
            : ''
        }
        <div style="margin-top:10px;border-top:1px solid var(--border,#333);padding-top:10px">
          <label class="prof-label">Rejoindre une campagne</label>
          <div style="display:flex;gap:8px">
            <input class="modal-input" id="camp-join-code" type="text" placeholder="Code d'invitation (XXXX-XXXX)" maxlength="9" style="flex:1;text-transform:uppercase" />
            <button class="modal-btn" id="camp-join">Rejoindre</button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn modal-cancel">Fermer</button>
        </div>
      </div>`;

    ov.querySelector('.modal-cancel').addEventListener('click', close);

    ov.querySelector('#camp-join')?.addEventListener('click', async () => {
      const code = ov.querySelector('#camp-join-code')?.value?.trim();
      if (!code) return;
      try {
        await joinCampaignByCode(code); // bascule + reload en cas de succès
      } catch (e) {
        showToast('Impossible de rejoindre : ' + e.message, { type: 'warn', icon: '⚠️' });
      }
    });

    ov.querySelectorAll('[data-switch]').forEach((b) =>
      b.addEventListener('click', async () => {
        const c = campaigns.find((x) => x.id === b.dataset.switch);
        const ok = await modalConfirm(
          `Basculer sur « ${c?.name || '?'} » ? L'application va se recharger.`,
          { title: 'Changer de campagne', okLabel: 'Basculer' }
        );
        if (!ok) return;
        try {
          await switchCampaign(b.dataset.switch);
        } catch (e) {
          showToast('Échec de la bascule : ' + e.message, { type: 'warn', icon: '⚠️' });
        }
      })
    );

    ov.querySelectorAll('[data-members]').forEach((b) =>
      b.addEventListener('click', () => toggleMembers(b.dataset.members))
    );

    ov.querySelector('[data-syscfg]')?.addEventListener('click', () => {
      close();
      openSystemEditor();
    });

    ov.querySelector('[data-export-camp]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await downloadActiveCampaign();
        showToast('Campagne exportée (fichier téléchargé).', { type: 'info', icon: '💾' });
      } catch (err) {
        showToast('Export impossible : ' + err.message, { type: 'warn', icon: '⚠️' });
      } finally {
        btn.disabled = false;
      }
    });

    ov.querySelector('#camp-import')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const status = ov.querySelector('#camp-import-status');
      let payload;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        showToast('Fichier illisible (JSON attendu).', { type: 'warn', icon: '⚠️' });
        return;
      }
      const ok = await modalConfirm(
        `Importer « ${payload?.campaign?.name || '?'} » dans une NOUVELLE campagne ? Les fiches seront à réattribuer aux joueurs.`,
        { title: 'Importer une campagne', okLabel: 'Importer' }
      );
      if (!ok) return;
      try {
        await importCampaignPayload(payload, (table, done, total) => {
          if (status) status.textContent = `${table} ${done}/${total}…`;
        }); // bascule + reload en cas de succès
      } catch (err) {
        if (status) status.textContent = '';
        showToast('Import échoué : ' + err.message + ' — supprime la campagne partielle avant de réessayer.', { type: 'warn', icon: '⚠️', timeout: 8000 });
      }
    });

    ov.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        const c = campaigns.find((x) => x.id === b.dataset.del);
        const ok = await modalConfirm(
          `Supprimer définitivement « ${c?.name || '?'} » ?\nToutes ses données (fiches, scènes, chat, notes, combat…) seront effacées. Cette action est irréversible.`,
          { title: 'Supprimer la campagne', okLabel: 'Supprimer', danger: true }
        );
        if (!ok) return;
        try {
          await deleteCampaign(b.dataset.del);
          showToast('Campagne supprimée.', { type: 'info', icon: '🗑' });
          render();
        } catch (e) {
          showToast('Suppression impossible : ' + e.message, { type: 'warn', icon: '⚠️' });
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
        await createCampaign(name, system); // bascule + reload en cas de succès
      } catch (e) {
        btn.disabled = false;
        showToast('Création impossible : ' + e.message, { type: 'warn', icon: '⚠️' });
      }
    });
  }

  /** Affiche/recharge le panneau membres d'une campagne dirigée. */
  async function toggleMembers(cid) {
    const panel = ov.querySelector(`[data-members-panel="${cid}"]`);
    if (!panel) return;
    if (panel.style.display !== 'none') {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';
    panel.innerHTML = 'Chargement…';

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
    const camp = (store.get().campaigns || []).find((x) => x.id === cid);

    panel.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;padding:2px 0 8px">
        <span style="opacity:.7">Code d'invitation :</span>
        ${camp?.invite_code ? `<code>${escapeHtml(camp.invite_code)}</code>
          <button class="modal-btn" data-code-copy="${escapeHtml(camp.invite_code)}" style="padding:1px 8px" title="Copier le code">📋</button>` : '<em style="opacity:.6">aucun</em>'}
        <button class="modal-btn" data-code-gen style="padding:1px 8px" title="${camp?.invite_code ? 'Régénérer (l’ancien code cesse de fonctionner)' : 'Générer un code'}">${camp?.invite_code ? '♻' : '➕'}</button>
      </div>
      ${members
        .map(
          (m) => `
        <div style="display:flex;align-items:center;gap:8px;padding:2px 0">
          <span style="flex:1">${escapeHtml(nameOf(m.user_id))}</span>
          <span style="opacity:.7">${m.role === 'dm' ? '🎭 MJ' : '🎲 Joueur'}</span>
          ${m.user_id !== myId ? `<button class="modal-btn" data-rm="${m.user_id}" style="padding:1px 8px">✕</button>` : ''}
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

    panel.querySelector('[data-code-copy]')?.addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(e.currentTarget.dataset.codeCopy);
        showToast('Code copié.', { type: 'info', icon: '📋', timeout: 1500 });
      } catch {
        showToast('Copie impossible — sélectionne le code à la main.', { type: 'warn', icon: '⚠️' });
      }
    });
    panel.querySelector('[data-code-gen]')?.addEventListener('click', async () => {
      try {
        await setInviteCode(cid, generateInviteCode());
        panel.style.display = 'none';
        toggleMembers(cid); // ré-affiche avec le nouveau code
      } catch (e) {
        showToast('Génération impossible : ' + e.message, { type: 'warn', icon: '⚠️' });
      }
    });

    panel.querySelector('[data-add-btn]')?.addEventListener('click', async () => {
      const userId = panel.querySelector('[data-add-user]')?.value;
      const role = panel.querySelector('[data-add-role]')?.value || 'player';
      if (!userId) return;
      const { error } = await backend.db
        .from('campaign_members')
        .insert({ campaign_id: cid, user_id: userId, role });
      if (error) showToast('Ajout impossible : ' + error.message, { type: 'warn', icon: '⚠️' });
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
        if (error) showToast('Retrait impossible : ' + error.message, { type: 'warn', icon: '⚠️' });
        panel.style.display = 'none';
        toggleMembers(cid);
      })
    );
  }

  render();
}

/**
 * Éditeur du système « Libre » de la campagne active (MJ) : le MJ définit ses
 * caractéristiques et compétences. Stocké dans session_state['system_config']
 * (scopé campagne, realtime) ; appliqué immédiatement à toutes les fiches.
 * Renommer/supprimer une caractéristique ne modifie pas les fiches existantes
 * (les scores orphelins sont simplement ignorés).
 */
export async function openSystemEditor() {
  const raw = (await loadSystemConfig()) || { abilities: CUSTOM_ABILITIES, skills: CUSTOM_SKILLS };
  // Copie de travail éditable (compétences en tableau, reconverties à la sauvegarde).
  const work = {
    abilities: (raw.abilities || []).map((a) => ({ key: a.key, label: a.label })),
    skills: Object.entries(raw.skills || {}).map(([key, s]) => ({ key, label: s.label, ability: s.ability })),
    testDie: normalizeTestDie(raw.testDie) || '1d20',
  };

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

  function render() {
    ov.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:560px">
        <h3 class="modal-title">🎲 Système de la campagne</h3>
        <p style="font-size:12px;opacity:.75;margin:4px 0 10px">Caractéristiques et compétences des fiches de CETTE campagne. Les scores des caractéristiques supprimées sont ignorés (rien n'est effacé des fiches).</p>

        <label class="prof-label">Caractéristiques</label>
        ${work.abilities
          .map(
            (a, i) => `
          <div style="display:flex;gap:6px;align-items:center;padding:2px 0">
            <input class="modal-input" data-ab-label="${i}" value="${escapeHtml(a.label)}" maxlength="12" style="flex:1" />
            <code style="font-size:11px;opacity:.6">${escapeHtml(a.key)}</code>
            <button class="modal-btn" data-ab-del="${i}" style="padding:1px 8px">✕</button>
          </div>`
          )
          .join('')}
        <div style="display:flex;gap:6px;margin:4px 0 12px">
          <input class="modal-input" id="syscfg-new-ab" placeholder="Nouvelle caractéristique (ex. FOR)" maxlength="12" style="flex:1" />
          <button class="modal-btn" id="syscfg-add-ab">Ajouter</button>
        </div>

        <label class="prof-label">Dé de test</label>
        <div style="display:flex;gap:8px;align-items:center;margin:0 0 12px">
          <input class="modal-input" id="syscfg-die" list="syscfg-die-suggest" value="${escapeHtml(work.testDie)}" maxlength="7" style="width:110px" />
          <datalist id="syscfg-die-suggest">
            <option value="1d20"></option><option value="1d100"></option><option value="2d6"></option><option value="3d6"></option><option value="1d12"></option>
          </datalist>
          <span style="font-size:11px;opacity:.7">Formule lancée pour les tests de caractéristique / compétence (ex. 1d20, 1d100, 2d6).</span>
        </div>

        <label class="prof-label">Compétences</label>
        ${work.skills
          .map(
            (s, i) => `
          <div style="display:flex;gap:6px;align-items:center;padding:2px 0">
            <input class="modal-input" data-sk-label="${i}" value="${escapeHtml(s.label)}" maxlength="30" style="flex:1" />
            <select class="modal-input" data-sk-ab="${i}" style="width:auto">
              ${work.abilities.map((a) => `<option value="${escapeHtml(a.key)}" ${a.key === s.ability ? 'selected' : ''}>${escapeHtml(a.label)}</option>`).join('')}
            </select>
            <button class="modal-btn" data-sk-del="${i}" style="padding:1px 8px">✕</button>
          </div>`
          )
          .join('')}
        <div style="display:flex;gap:6px;margin:4px 0 12px">
          <input class="modal-input" id="syscfg-new-sk" placeholder="Nouvelle compétence" maxlength="30" style="flex:1" />
          <button class="modal-btn" id="syscfg-add-sk">Ajouter</button>
        </div>

        <div class="modal-actions">
          <button class="modal-btn modal-cancel">Annuler</button>
          <button class="modal-btn modal-ok" id="syscfg-save">Enregistrer</button>
        </div>
      </div>`;

    ov.querySelector('.modal-cancel').addEventListener('click', close);

    ov.querySelector('#syscfg-die')?.addEventListener('change', (e) => {
      work.testDie = e.target.value;
    });

    ov.querySelectorAll('[data-ab-label]').forEach((inp) =>
      inp.addEventListener('change', () => {
        work.abilities[Number(inp.dataset.abLabel)].label = inp.value;
      })
    );
    ov.querySelectorAll('[data-ab-del]').forEach((b) =>
      b.addEventListener('click', () => {
        const removed = work.abilities.splice(Number(b.dataset.abDel), 1)[0];
        // Les compétences orphelines suivent la première caractéristique restante.
        work.skills.forEach((s) => {
          if (s.ability === removed?.key) s.ability = work.abilities[0]?.key || '';
        });
        render();
      })
    );
    ov.querySelector('#syscfg-add-ab').addEventListener('click', () => {
      const label = ov.querySelector('#syscfg-new-ab').value.trim();
      const key = slugKey(label);
      if (!label || !key) return showToast('Libellé invalide.', { type: 'warn', icon: '⚠️' });
      if (work.abilities.some((a) => a.key === key)) return showToast('Cette caractéristique existe déjà.', { type: 'warn', icon: '⚠️' });
      work.abilities.push({ key, label });
      render();
    });

    ov.querySelectorAll('[data-sk-label]').forEach((inp) =>
      inp.addEventListener('change', () => {
        work.skills[Number(inp.dataset.skLabel)].label = inp.value;
      })
    );
    ov.querySelectorAll('[data-sk-ab]').forEach((sel) =>
      sel.addEventListener('change', () => {
        work.skills[Number(sel.dataset.skAb)].ability = sel.value;
      })
    );
    ov.querySelectorAll('[data-sk-del]').forEach((b) =>
      b.addEventListener('click', () => {
        work.skills.splice(Number(b.dataset.skDel), 1);
        render();
      })
    );
    ov.querySelector('#syscfg-add-sk').addEventListener('click', () => {
      const label = ov.querySelector('#syscfg-new-sk').value.trim();
      const key = slugKey(label);
      if (!label || !key) return showToast('Libellé invalide.', { type: 'warn', icon: '⚠️' });
      if (work.skills.some((s) => s.key === key)) return showToast('Cette compétence existe déjà.', { type: 'warn', icon: '⚠️' });
      work.skills.push({ key, label, ability: work.abilities[0]?.key || '' });
      render();
    });

    ov.querySelector('#syscfg-save').addEventListener('click', async () => {
      const die = normalizeTestDie(ov.querySelector('#syscfg-die')?.value || work.testDie);
      if (!die) {
        showToast('Dé de test invalide — attendu : NdM (ex. 1d20, 1d100, 2d6).', { type: 'warn', icon: '⚠️' });
        return;
      }
      const cfg = {
        abilities: work.abilities,
        skills: Object.fromEntries(work.skills.map((s) => [s.key, { label: s.label, ability: s.ability }])),
        testDie: die,
      };
      if (!normalizeConfig(cfg)) {
        showToast('Config invalide : il faut au moins une caractéristique.', { type: 'warn', icon: '⚠️' });
        return;
      }
      try {
        await saveSystemConfig(cfg);
        showToast('Système de la campagne enregistré.', { type: 'info', icon: '🎲' });
        close();
      } catch (e) {
        showToast('Enregistrement impossible : ' + e.message, { type: 'warn', icon: '⚠️' });
      }
    });
  }

  render();
}
